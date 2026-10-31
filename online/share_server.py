import hashlib, hmac, json, os, re, secrets, sqlite3, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from contextlib import contextmanager

ROOT = Path(os.environ.get('SHARE_DATA_DIR', '/var/lib/pcb-shares'))
ROOT.mkdir(parents=True, exist_ok=True)
DB = ROOT / 'shares.sqlite3'
TTL = {'1h': 3600, '3d': 259200, '7d': 604800, '30d': 2592000}
MAX_BODY = 16 * 1024 * 1024
LOCK = threading.Lock()
RATES = {}
ORIGIN = os.environ.get('SHARE_ORIGIN', 'https://pcb.kn21.xyz')
PASSWORD_ITERATIONS = 600000
PASSWORD_SLOTS = threading.BoundedSemaphore(2)
UNLOCK_RATES = {}
IP_UNLOCK_RATES = {}
RATE_SALT = secrets.token_bytes(32)

@contextmanager
def connect():
    conn = sqlite3.connect(DB, timeout=15)
    try:
        with conn:
            yield conn
    finally:
        conn.close()

with connect() as conn:
    conn.execute('PRAGMA secure_delete=ON')
    conn.execute('CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, expires INTEGER, payload TEXT)')
    # Keep protected payloads out of the legacy table. Even an older backend
    # cannot expose them if the service is rolled back.
    conn.execute('CREATE TABLE IF NOT EXISTS protected_shares (id TEXT PRIMARY KEY, expires INTEGER, payload TEXT, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL)')
    columns = {column[1] for column in conn.execute('PRAGMA table_info(shares)')}
    if {'password_salt', 'password_hash'} <= columns:
        # Migrate the unreleased local-preview schema without opening its shares.
        conn.execute("INSERT OR IGNORE INTO protected_shares SELECT id,expires,payload,coalesce(password_salt,''),coalesce(password_hash,'') FROM shares WHERE password_salt IS NOT NULL OR password_hash IS NOT NULL")
        conn.execute('DELETE FROM shares WHERE password_salt IS NOT NULL OR password_hash IS NOT NULL')

def get_share(token, include_payload=False):
    payload = 'payload' if include_payload else 'NULL'
    with connect() as conn:
        row = conn.execute('SELECT expires,' + payload + ',NULL,NULL FROM shares WHERE id=?', (token,)).fetchone()
        if row is None:
            row = conn.execute('SELECT expires,' + payload + ',password_salt,password_hash FROM protected_shares WHERE id=?', (token,)).fetchone()
        return row

def valid_password(value, optional=False):
    return isinstance(value, str) and ((optional and value == '') or
        (4 <= len(value) <= 64 and not value.isspace() and not any(ord(c) < 32 or ord(c) == 127 or 0xD800 <= ord(c) <= 0xDFFF for c in value)))

def password_digest(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf8'), salt, PASSWORD_ITERATIONS).hex()

def allow_unlock(ip, token):
    now = time.monotonic()
    # Do not retain raw addresses or share tokens in the password limiter.
    key = hashlib.sha256(RATE_SALT + ip.encode()).hexdigest()
    pair = hashlib.sha256(RATE_SALT + ip.encode() + b':' + token.encode()).hexdigest()
    with LOCK:
        for entries in (UNLOCK_RATES, IP_UNLOCK_RATES):
            for entry in list(entries):
                history = [stamp for stamp in entries[entry] if stamp > now - 600]
                if history: entries[entry] = history
                else: del entries[entry]
        if len(UNLOCK_RATES) >= 5000 or len(IP_UNLOCK_RATES) >= 5000:
            return False
        attempts = UNLOCK_RATES.get(pair, [])
        ip_attempts = IP_UNLOCK_RATES.get(key, [])
        if len(attempts) >= 5 or len(ip_attempts) >= 30: return False
        UNLOCK_RATES[pair] = attempts + [now]
        IP_UNLOCK_RATES[key] = ip_attempts + [now]
    return True

def cleanup():
    with connect() as conn:
        conn.execute('PRAGMA secure_delete=ON')
        conn.execute('DELETE FROM shares WHERE expires <= ?', (int(time.time()),))
        conn.execute('DELETE FROM protected_shares WHERE expires <= ?', (int(time.time()),))

def sweep():
    while True:
        cleanup()
        time.sleep(60)

class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(60)

    def log_message(self, *args):
        pass  # Do not log bearer links or design data.

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        unlock = re.fullmatch(r'/api/shares/([a-f0-9]{48})/unlock', self.path)
        creating = self.path in ('/api/shares', '/api/shares/protected')
        if not creating and not unlock:
            return self.reply(404, {'error': '接口不存在'})
        if self.headers.get('Origin') != ORIGIN:
            return self.reply(403, {'error': '请在本站生成分享'})
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            return self.reply(415, {'error': '请求格式错误'})
        if self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length', [])) != 1:
            return self.reply(400, {'error': '请求格式错误'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if not 0 < length <= (MAX_BODY if creating else 4096):
            return self.reply(413, {'error': '分享数据最大 16 MB'})
        if unlock:
            return self.unlock(unlock[1], length)
        ip = self.headers.get('X-Real-IP', self.client_address[0])
        with LOCK:
            now = time.time()
            for key in list(RATES):
                if not RATES[key] or RATES[key][-1] < now - 3600:
                    del RATES[key]
            history = [v for v in RATES.get(ip, []) if v > now - 3600]
            if len(history) >= 20:
                return self.reply(429, {'error': '每小时最多生成 20 个分享，请稍后再试'})
            RATES[ip] = history + [now]
        try:
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict): raise ValueError()
            ttl = TTL[request['ttl']]
            data = request['data']
            password = request.get('password', '')
            if not valid_password(password, optional=self.path == '/api/shares'):
                return self.reply(400, {'error': '访问密码须为 4～64 个字符，留空则无需密码'})
            if not isinstance(data, dict) or not isinstance(data.get('metadata'), dict) or not isinstance(data.get('bom'), dict):
                raise ValueError()
            payload = json.dumps(data, ensure_ascii=False, allow_nan=False)
        except (ValueError, KeyError, TypeError, RecursionError):
            return self.reply(400, {'error': '分享内容或有效期无效'})
        salt = digest = None
        if password:
            if not PASSWORD_SLOTS.acquire(blocking=False):
                return self.reply(503, {'error': '分享服务繁忙，请稍后重试'})
            try:
                salt = secrets.token_bytes(16).hex()
                digest = password_digest(password, bytes.fromhex(salt))
            finally:
                PASSWORD_SLOTS.release()
        cleanup()
        expires = int(time.time()) + ttl
        token = secrets.token_hex(24)
        with LOCK, connect() as conn:
            size = conn.execute('SELECT coalesce(sum(length(CAST(payload AS BLOB))),0) FROM shares').fetchone()[0]
            size += conn.execute('SELECT coalesce(sum(length(CAST(payload AS BLOB))),0) FROM protected_shares').fetchone()[0]
            if size + len(payload.encode()) > 512 * 1024 * 1024:
                return self.reply(507, {'error': '分享存储已满，请稍后再试'})
            if password:
                conn.execute('INSERT INTO protected_shares VALUES (?,?,?,?,?)', (token, expires, payload, salt, digest))
            else:
                conn.execute('INSERT INTO shares (id,expires,payload) VALUES (?,?,?)', (token, expires, payload))
        self.reply(201, {'id': token, 'expires': expires, 'password_protected': bool(password)})

    def unlock(self, token, length):
        row = get_share(token)
        if not row or row[0] <= int(time.time()):
            cleanup()
            return self.reply(410, {'error': '分享链接无效或已过期'})
        try:
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict) or not isinstance(request.get('password'), str): raise ValueError()
            password = request['password']
        except (ValueError, TypeError, RecursionError):
            return self.reply(400, {'error': '密码格式无效'})
        if row[2] is not None or row[3] is not None:
            if not allow_unlock(self.headers.get('X-Real-IP', self.client_address[0])[:100], token):
                return self.reply(429, {'error': '密码尝试过于频繁，请 10 分钟后再试'})
            if not valid_password(password):
                return self.reply(403, {'error': '密码不正确，请重新输入', 'password_required': True})
            if not PASSWORD_SLOTS.acquire(blocking=False):
                return self.reply(503, {'error': '分享服务繁忙，请稍后重试'})
            try:
                if not isinstance(row[2], str) or not re.fullmatch(r'[a-f0-9]{32}', row[2]) or not isinstance(row[3], str) or not re.fullmatch(r'[a-f0-9]{64}', row[3]):
                    return self.reply(503, {'error': '分享暂时无法解锁，请联系分享者'})
                digest = password_digest(password, bytes.fromhex(row[2]))
                if not hmac.compare_digest(digest, row[3]):
                    return self.reply(403, {'error': '密码不正确，请重新输入', 'password_required': True})
            finally:
                PASSWORD_SLOTS.release()
        # Load design data only after authentication, and recheck expiry.
        row = get_share(token, include_payload=True)
        if not row or row[0] <= int(time.time()):
            cleanup()
            return self.reply(410, {'error': '分享链接无效或已过期'})
        return self.reply(200, {'expires': row[0], 'data': json.loads(row[1])})

    def do_GET(self):
        match = re.fullmatch(r'/api/shares/([a-f0-9]{48})', self.path)
        if not match:
            return self.reply(404, {'error': '分享链接无效或已过期'})
        row = get_share(match[1])
        if not row or row[0] <= int(time.time()):
            cleanup()
            return self.reply(410, {'error': '分享链接无效或已过期'})
        if row[2] is not None or row[3] is not None:
            return self.reply(401, {'error': '此分享需要访问密码', 'password_required': True})
        row = get_share(match[1], include_payload=True)
        if not row or row[0] <= int(time.time()):
            cleanup()
            return self.reply(410, {'error': '分享链接无效或已过期'})
        self.reply(200, {'expires': row[0], 'data': json.loads(row[1])})

if __name__ == '__main__':
    threading.Thread(target=sweep, daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('SHARE_PORT', '8767'))), Handler).serve_forever()
