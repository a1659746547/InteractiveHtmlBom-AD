"""Small same-origin public chat. PCB files and full board data are never accepted."""
from collections import deque
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlsplit

ONLINE_TTL = 60
SESSION_TTL = 2 * 60 * 60
MAX_SESSIONS = 1000


class ChatError(Exception):
    def __init__(self, status, message, code=None):
        self.status, self.message = status, message
        self.code = code


def text(value, limit, empty=False):
    if not isinstance(value, str) or len(value) > limit or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ud800-\udfff]', value):
        raise ChatError(400, '输入内容不符合要求')
    value = value.strip()
    if not value and not empty:
        raise ChatError(400, '请填写内容')
    return value


def avatar_id(value):
    if type(value) is not int or not 1 <= value <= 20:
        raise ChatError(400, '请选择内置头像')
    return value


def progress(value):
    if not isinstance(value, dict):
        raise ChatError(400, '进度格式无效')
    level = value.get('level')
    result = {'level': level}
    if level == 'percent':
        percent = value.get('percent')
        if type(percent) not in (int, float) or not math.isfinite(percent) or not 0 <= percent <= 100:
            raise ChatError(400, '进度格式无效')
        result['percent'] = round(percent, 1)
    elif level == 'counts':
        done, total = value.get('done'), value.get('total')
        if type(done) is not int or type(total) is not int or not 0 <= done <= total <= 1_000_000 or total == 0:
            raise ChatError(400, '进度数量无效')
        result.update(done=done, total=total, percent=round(done * 100 / total, 1))
    elif level != 'none':
        raise ChatError(400, '请选择展示范围')
    if 'board' in value:
        result['board'] = text(value['board'], 80, True)
    if 'model' in value:
        result['model'] = text(value['model'], 120, True)
    if 'current' in value:
        current = value.get('current', {})
        if not isinstance(current, dict):
            raise ChatError(400, '当前元件格式无效')
        result['current'] = {'ref': text(current.get('ref', ''), 80, True)}
    return result


class ChatState:
    def __init__(self, directory, origin):
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        self.db = directory / 'chat.sqlite3'
        self.origin = origin
        self.lock = threading.RLock()
        self.people = {}
        self.rates = {}
        self.salt = secrets.token_bytes(32)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT NOT NULL, nickname TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL)')
            columns = {row[1] for row in db.execute('PRAGMA table_info(messages)')}
            for name, definition in [('kind', "TEXT NOT NULL DEFAULT 'text'"), ('model', "TEXT NOT NULL DEFAULT ''"), ('event_id', 'TEXT'), ('avatar_id', 'INTEGER')]:
                if name not in columns:
                    db.execute('ALTER TABLE messages ADD COLUMN '+name+' '+definition)
            db.execute('CREATE UNIQUE INDEX IF NOT EXISTS completion_event ON messages(event_id) WHERE event_id IS NOT NULL')
            db.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
            saved = db.execute("SELECT value FROM settings WHERE key='enabled'").fetchone()
            if saved and saved[0] not in ('0', '1'):
                raise ValueError('Invalid stored chat setting')
            self.enabled = not saved or saved[0] == '1'
        os.chmod(self.db, 0o600)

    def settings(self, enabled=None):
        with self.lock:
            if enabled is not None:
                if type(enabled) is not bool:
                    raise ChatError(400, '开关值无效')
                with self.connect() as db:
                    db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('enabled',?)", ('1' if enabled else '0',))
                self.enabled = enabled
                if not enabled:
                    self.people.clear()
            return {'enabled': self.enabled}

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.db, timeout=5)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def clean(self):
        now = time.monotonic()
        self.people = {key: person for key, person in self.people.items() if now - person['seen'] < SESSION_TTL}
        for person in self.people.values():
            if now - person['seen'] >= ONLINE_TTL:
                person['progress'] = {'level': 'none'}
        self.rates = {key: values for key, values in self.rates.items() if values and now - values[-1] < 60}

    def rate(self, key, maximum):
        now = time.monotonic()
        if key not in self.rates and len(self.rates) >= 4096:
            raise ChatError(503, '聊天室繁忙，请稍后重试')
        values = self.rates.setdefault(key, deque())
        while values and now - values[0] > 60:
            values.popleft()
        if len(values) >= maximum:
            raise ChatError(429, '操作太快，请稍后再试')
        values.append(now)

    def identity(self, body):
        token = body.get('token')
        if not isinstance(token, str) or not re.fullmatch(r'[a-f0-9]{64}', token):
            raise ChatError(401, '请重新进入聊天室')
        key = hashlib.sha256(token.encode()).hexdigest()
        person = self.people.get(key)
        if person is None:
            raise ChatError(401, '连接已过期，请重新进入聊天室')
        return key, person

    @staticmethod
    def public(person):
        return {key: person[key] for key in ['id', 'nickname', 'progress', 'avatar_id', 'last_spoken']}

    def dispatch(self, method, path, body, ip):
        ip_key = hmac.new(self.salt, ip.encode(), 'sha256').hexdigest()
        with self.lock:
            self.clean()
            if method == 'GET' and path == '/api/chat/config':
                self.rate(('read', ip_key), 1800)
                return 200, self.settings()
            if method == 'GET' and path == '/api/chat/snapshot':
                self.rate(('read', ip_key), 1800)
                if not self.enabled:
                    return 200, {'enabled': False, 'messages': [], 'participants': [], 'online': 0}
                with self.connect() as db:
                    db.execute('DELETE FROM messages WHERE created < ?', (time.time()-7*86400,))
                    rows = db.execute('SELECT id,author,nickname,body,created,kind,model,avatar_id FROM messages ORDER BY id DESC LIMIT 20').fetchall()
                online = [self.public(p) for p in self.people.values() if time.monotonic() - p['seen'] < ONLINE_TTL]
                return 200, {'messages': [dict(zip(['id', 'author', 'nickname', 'text', 'created', 'kind', 'model', 'avatar_id'], row)) for row in reversed(rows)],
                             'participants': online, 'online': len(online), 'enabled': True}
            if method != 'POST':
                raise ChatError(404, '未找到接口')
            if not self.enabled:
                raise ChatError(503, '管理员已关闭聊天室', 'chat_disabled')
            if path == '/api/chat/join':
                nickname = text(body.get('nickname'), 20)
                if '\n' in nickname or '\r' in nickname:
                    raise ChatError(400, '昵称不能换行')
                avatar = avatar_id(body['avatar_id']) if 'avatar_id' in body else None
                self.rate(('join', ip_key), 8)
                if sum(time.monotonic() - p['seen'] < ONLINE_TTL for p in self.people.values()) >= 100:
                    raise ChatError(503, '聊天室已满，请稍后再来')
                if len(self.people) >= MAX_SESSIONS:
                    oldest = min(self.people, key=lambda key: self.people[key]['seen'])
                    del self.people[oldest]
                token = secrets.token_hex(32)
                person = dict(id=secrets.token_hex(8), nickname=nickname, progress={'level': 'none'}, avatar_id=avatar, last_spoken=0, seen=time.monotonic())
                self.people[hashlib.sha256(token.encode()).hexdigest()] = person
                return 201, {'token': token, 'participant': self.public(person)}
            key, person = self.identity(body)
            if path == '/api/chat/profile':
                avatar = avatar_id(body.get('avatar_id'))
                self.rate(('profile', key), 20)
                with self.connect() as db:
                    db.execute('UPDATE messages SET avatar_id=? WHERE author=?', (avatar, person['id']))
                person.update(avatar_id=avatar, seen=time.monotonic())
                return 200, {'participant': self.public(person)}
            if path == '/api/chat/leave':
                del self.people[key]
                return 200, {'ok': True}
            if path == '/api/chat/presence':
                value = progress(body.get('progress'))
                self.rate(('presence', key), 90)
                person.update(progress=value, seen=time.monotonic())
                return 200, {'participant': self.public(person)}
            if path in ('/api/chat/messages', '/api/chat/completions'):
                kind, model, event_id = 'text', '', None
                if path.endswith('/completions'):
                    model = text(body.get('model'), 120)
                    event_id = body.get('event_id')
                    if not isinstance(event_id, str) or not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', event_id):
                        raise ChatError(400, '完成动态标识无效')
                    with self.connect() as db:
                        existing = db.execute('SELECT id,author FROM messages WHERE event_id=?', (event_id,)).fetchone()
                    if existing:
                        if existing[1] != person['id']:
                            raise ChatError(409, '完成动态标识已使用')
                        return 200, {'id': existing[0]}
                    kind, message = 'complete', '完成焊接 · '+model
                else:
                    message = text(body.get('text'), 600)
                self.rate(('message', key), 20)
                self.rate(('message-ip', ip_key), 40)
                now = time.time()
                with self.connect() as db:
                    cursor = db.execute('INSERT INTO messages(author,nickname,body,created,kind,model,event_id,avatar_id) VALUES(?,?,?,?,?,?,?,?)',
                                        (person['id'], person['nickname'], message, now, kind, model, event_id, person['avatar_id']))
                    message_id = cursor.lastrowid
                    db.execute('DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT 300) OR created < ?', (now-7*86400,))
                person['seen'] = time.monotonic()
                if kind == 'text':
                    person['last_spoken'] = message_id
                return 201, {'id': message_id}
            raise ChatError(404, '未找到接口')

    def handle(self, handler):
        def reply(status, data):
            payload = json.dumps(data, ensure_ascii=False, allow_nan=False).encode()
            handler.send_response(status)
            handler.send_header('Content-Type', 'application/json; charset=utf-8')
            handler.send_header('Content-Length', str(len(payload)))
            handler.send_header('Cache-Control', 'no-store')
            handler.send_header('X-Content-Type-Options', 'nosniff')
            if status == 429:
                handler.send_header('Retry-After', '10')
            handler.end_headers()
            handler.wfile.write(payload)
        try:
            path = urlsplit(handler.path).path
            internal = path == '/_internal/chat/settings'
            if internal and (handler.client_address[0] != '127.0.0.1' or handler.headers.get('X-PCB-Chat-Control') != 'stats-v1'):
                raise ChatError(404, '未找到接口')
            body = {}
            if handler.command == 'POST':
                if not internal and handler.headers.get('Origin') != self.origin:
                    raise ChatError(403, '请从本站打开聊天室')
                if handler.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
                    raise ChatError(415, '请求格式无效')
                lengths = handler.headers.get_all('Content-Length', [])
                if len(lengths) != 1 or not lengths[0].isdigit() or handler.headers.get('Transfer-Encoding'):
                    raise ChatError(400, '请求长度无效')
                length = int(lengths[0])
                if not 0 < length <= 8192:
                    raise ChatError(413, '内容过长')
                handler.connection.settimeout(10)
                raw = handler.rfile.read(length)
                if len(raw) != length:
                    raise ChatError(400, '请求不完整')
                body = json.loads(raw)
                if not isinstance(body, dict):
                    raise ChatError(400, '请求格式无效')
            if internal:
                if handler.command == 'GET':
                    return reply(200, self.settings())
                if set(body) != {'enabled'} or type(body['enabled']) is not bool:
                    raise ChatError(400, '开关值无效')
                return reply(200, self.settings(body['enabled']))
            ip = handler.headers.get('X-Real-IP') or handler.client_address[0]
            status, result = self.dispatch(handler.command, path, body, ip[:128])
            reply(status, result)
        except ChatError as error:
            reply(error.status, {'error': error.message, **({'code': error.code} if error.code else {})})
        except (ValueError, UnicodeError):
            reply(400, {'error': '请求格式无效'})
        except (TimeoutError, ConnectionError):
            return
        except sqlite3.Error:
            reply(503, {'error': '聊天服务暂不可用，请稍后重试'})


if __name__ == '__main__':
    state = ChatState(os.environ.get('CHAT_DATA_DIR', '/var/lib/pcb-chat'),
                      os.environ.get('CHAT_ORIGIN', 'https://pcb.kn21.xyz'))
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass
        def do_GET(self):
            state.handle(self)
        def do_POST(self):
            state.handle(self)
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('CHAT_PORT', '8770'))), Handler).serve_forever()
