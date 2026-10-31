"""Private analytics and chat controls protected by the existing admin login."""
import base64
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import hmac
import ipaddress
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen
from geo_lookup import GeoLookup
from usage_store import UsageStore, UsageError
import failure_http
from failure_http import FailureRoutes

TZ = timezone(timedelta(hours=8))
BOT = re.compile(r'bot|crawler|spider|censys|palo alto|zgrab|nmap|l9tcp|l9explore|urlscan|research|forestengine|python|curl|wget|okhttp|libredtail', re.I)
PROBE = re.compile(r'[.]env|[.]git|wp-|phpinfo|phpunit|cgi-bin|actuator|HNAP|nmap|/sdk|/auth$|/webui|geoserver|/wiki$|sellers.json|security.txt|ReportServer|containers/json|developmentserver|secrets|ssh/|config[.](php|py)|Dr0v|kmonbase', re.I)
RX = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\d+|-) "([^"]*)" "([^"]*)"')
LOCK = threading.Lock()
CACHE = {'loaded': 0, 'rows': [], 'unparsed': 0}
AUTH_LOCK = threading.Lock()
FAILURES = {}
CONFIG = {}
GEO = None
GEO_LOCK = threading.Lock()
CHAT_CONTROL_URL = 'http://127.0.0.1:8770/_internal/chat/settings'
ADMIN_ORIGIN = os.environ.get('PCB_STATS_ORIGIN', 'https://pcb.kn21.xyz')
USAGE = None
USAGE_LOCK = threading.Lock()


def usage_store():
    global USAGE
    with USAGE_LOCK:
        if USAGE is None:
            USAGE = UsageStore(os.environ.get('PCB_USAGE_DATA_DIR', '/var/lib/pcb-stats'))
        return USAGE


def chat_settings(value=None):
    payload = json.dumps(value).encode() if value is not None else None
    request = Request(CHAT_CONTROL_URL, data=payload, headers={
        'Content-Type': 'application/json', 'X-PCB-Chat-Control': 'stats-v1'})
    with urlopen(request, timeout=3) as response:
        result = json.loads(response.read(4096))
    if type(result.get('enabled')) is not bool:
        raise ValueError('Invalid chat control response')
    return {'enabled': result['enabled']}


def geolocation():
    global GEO
    with GEO_LOCK:
        if GEO is None:
            GEO = GeoLookup()
        return GEO


def parse_lines(lines, excluded):
    rows, unparsed = [], 0
    for line in lines:
        if not line.strip():
            continue
        m = RX.match(line)
        if not m:
            unparsed += 1
            continue
        ip, stamp, req, status, _, ref, ua = m.groups()
        try:
            parsed_ip = ipaddress.ip_address(ip)
            ip = str(parsed_ip.ipv4_mapped or parsed_ip) if isinstance(parsed_ip, ipaddress.IPv6Address) else str(parsed_ip)
            dt = datetime.strptime(stamp, '%d/%b/%Y:%H:%M:%S %z').astimezone(TZ)
        except ValueError:
            unparsed += 1
            continue
        parts = req.split()
        method, path = parts[0] if parts else '', parts[1].split('?')[0] if len(parts) > 1 else ''
        # Exclude the admin dashboard from the public site's usage metrics.
        if path == '/stats' or path.startswith('/stats/'):
            continue
        rows.append({'ip': ip, 'time': dt, 'date': dt.date().isoformat(), 'home': method == 'GET' and path in ('/', '/index.html') and int(status) in (200, 304), 'status': int(status), 'bot': bool(BOT.search(ua) or PROBE.search(path)), 'browser': 'Mozilla/' in ua})
        if len(rows) > 1_000_000:
            raise ValueError('Too many log entries')
    scan_ips = {r['ip'] for r in rows if r['bot']}
    excluded = set(excluded)
    for r in rows:
        r['machine'] = r['ip'] in scan_ips
        r['excluded'] = r['ip'] in excluded
        r['candidate'] = r['home'] and r['browser'] and r['ip'] not in scan_ips | excluded
    return sorted(rows, key=lambda r: r['time']), unparsed


def load_rows():
    with LOCK:
        if time.monotonic() - CACHE['loaded'] < 30:
            return CACHE['rows'], CACHE['unparsed'], CACHE['checked_at']
        root = Path(CONFIG['log_directory']).resolve()
        files = sorted(root.glob('pcb.kn21.xyz.log*'))
        if sum(p.stat().st_size for p in files if p.is_file()) > 200 * 1024 * 1024:
            raise ValueError('Log input limit exceeded')
        def lines():
            total = 0
            for path in files:
                if not path.is_file() or path.resolve().parent != root:
                    continue
                opener = gzip.open if path.suffix == '.gz' else open
                with opener(path, 'rt', encoding='utf-8', errors='replace') as f:
                    for line in f:
                        total += len(line)
                        if total > 200 * 1024 * 1024:
                            raise ValueError('Decompressed log input limit exceeded')
                        yield line
        rows, unparsed = parse_lines(lines(), CONFIG.get('excluded_ips', []))
        if not rows:
            raise ValueError('No log records available')
        CACHE.update(rows=rows, unparsed=unparsed, checked_at=datetime.now(TZ).isoformat(), loaded=time.monotonic())
        return rows, unparsed, CACHE['checked_at']


def count_ip(rows):
    return len({r['ip'] for r in rows})


def summarize(rows, unparsed=0):
    buckets = defaultdict(list)
    for r in rows:
        buckets[r['date']].append(r)
    daily = []
    for date, items in sorted(buckets.items()):
        home = [r for r in items if r['home']]
        candidates = [r for r in items if r['candidate']]
        daily.append({'date': date, 'requests': len(items), 'home_success': len(home), 'home_distinct_ips': count_ip(home), 'remaining_browser_shaped_requests': len(candidates), 'remaining_browser_shaped_distinct_ips': count_ip(candidates)})
    home, candidates = [r for r in rows if r['home']], [r for r in rows if r['candidate']]
    active = None
    db = Path(CONFIG.get('shares_db', '/var/lib/pcb-shares/shares.sqlite3'))
    if db.is_file():
        try:
            with sqlite3.connect(f'file:{db}?mode=ro', uri=True, timeout=1) as c:
                active = c.execute('SELECT count(*) FROM shares WHERE expires > ?', (int(time.time()),)).fetchone()[0]
        except sqlite3.Error:
            pass
    return {'site': 'https://pcb.kn21.xyz/', 'timezone': '+08:00', 'log_first': rows[0]['time'].isoformat(), 'log_last': rows[-1]['time'].isoformat(), 'requests': len(rows), 'unparsed': unparsed, 'status_counts': dict(Counter(str(r['status']) for r in rows)), 'homepage_success_requests': len(home), 'homepage_success_distinct_ips': count_ip(home), 'remaining_browser_shaped_homepage_requests': len(candidates), 'remaining_browser_shaped_distinct_ips': count_ip(candidates), 'daily': daily, 'active_unexpired_shares_at_query': active, 'production_modified': False}


def select_stats(rows, snapshot, start, end, filtered):
    selected = [r for r in rows if start <= r['date'] <= end]
    home = [r for r in selected if r['home']]
    visits = [r for r in selected if r['candidate']] if filtered else home
    return {'daily': [d for d in snapshot['daily'] if start <= d['date'] <= end], 'requests': len(selected), 'home': len(home), 'visits': len(visits), 'ip': count_ip(visits), 'status': dict(Counter(str(r['status']) for r in selected)), 'start': start, 'end': end, 'filtered': filtered}


def visitor_details(rows, start, end, scope='all', query='', page=1, sort='recent', filtered=True):
    try:
        usage = usage_store().report(start,end)
        usage_by_ip = {item['ip']:item for item in usage['items']}
    except (OSError, ValueError, sqlite3.Error):
        usage_by_ip = None
    grouped = defaultdict(list)
    for r in rows:
        if start <= r['date'] <= end:
            grouped[r['ip']].append(r)
    result = []
    geo = geolocation()
    for ip, visits in grouped.items():
        machine = any(r['machine'] for r in visits)
        excluded = any(r['excluded'] for r in visits)
        kind = 'test' if excluded else 'machine' if machine else 'browser' if any(r['browser'] for r in visits) else 'unknown'
        if scope == 'machine' and not machine or scope == 'test' and not excluded:
            continue
        if scope == 'home' and not any(r['candidate'] if filtered else r['home'] for r in visits):
            continue
        location = geo.lookup(ip)
        if query and query.lower() not in ' '.join([ip, location['region'], location['isp']]).lower():
            continue
        metrics = usage_by_ip.get(ip, {'parses':0,'active_ms':0,'active_now':False,'last_parse':None,'sessions':0}) if usage_by_ip is not None else None
        result.append({'ip': ip, **location, 'requests': len(visits), 'home_visits': sum(r['home'] for r in visits), 'filtered_home_visits': sum(r['candidate'] for r in visits), 'first_visit': visits[0]['time'].isoformat(), 'last_visit': visits[-1]['time'].isoformat(), 'kind': kind, 'usage':metrics})
    result.sort(key=lambda r: (r['requests'],r['last_visit'],r['ip']) if sort == 'requests' else (r['last_visit'],r['ip']),reverse=True)
    total, size = len(result), 25
    page = max(1, min(page, max(1, (total + size - 1)//size)))
    return {'items': result[(page-1)*size:page*size], 'total': total, 'page': page, 'page_size': size, 'geo': geo.metadata}


class Handler(FailureRoutes, BaseHTTPRequestHandler):
    server_version = 'PCB-Stats'
    def log_message(self, *args):
        pass

    def send(self, status, body=b'', kind='application/json; charset=utf-8', challenge=False):
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
        if challenge:
            self.send_header('WWW-Authenticate', 'Basic realm="PCB statistics", charset="UTF-8"')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def authenticate(self):
        ip = self.headers.get('X-Real-IP', self.client_address[0])[:64]
        now = time.monotonic()
        with AUTH_LOCK:
            for old in [k for k, (stamp, _) in FAILURES.items() if now - stamp > 300]:
                FAILURES.pop(old, None)
            count = FAILURES.get(ip, (now, 0))[1]
        if count >= 10:
            self.send(429, b'{"error":"Too many login attempts; try again in 5 minutes"}')
            return False
        header = self.headers.get('Authorization', '')
        if not header:
            self.send(401, b'{"error":"Login required"}', challenge=True)
            return False
        valid = False
        try:
            if len(header) > 1024 or not header.startswith('Basic '):
                raise ValueError()
            user, password = base64.b64decode(header[6:], validate=True).decode('utf-8').split(':', 1)
            computed = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(CONFIG['salt']), 200000).hex()
            valid = hmac.compare_digest(user.encode('utf-8'), CONFIG['username'].encode('utf-8')) and hmac.compare_digest(computed, CONFIG['password_hash'])
        except (ValueError, UnicodeError):
            pass
        if valid:
            with AUTH_LOCK:
                FAILURES.pop(ip, None)
            return True
        with AUTH_LOCK:
            if len(FAILURES) < 10000:
                stamp, count = FAILURES.get(ip, (now, 0))
                FAILURES[ip] = stamp, count + 1
        self.send(401, b'{"error":"Invalid login"}', challenge=True)
        return False

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if urlsplit(self.path).path.startswith('/api/failures'):
            return self.send(405, b'{}')
        if urlsplit(self.path).path == '/api/usage':
            return self.send(405, b'{"error":"POST required"}')
        if not self.authenticate():
            return
        url = urlsplit(self.path)
        if url.path == '/stats/failures' or url.path.startswith('/stats/failures/'):
            return self.failure_get(url)
        if url.path == '/stats/chat-settings':
            try:
                self.send(200, json.dumps(chat_settings()).encode())
            except (OSError, ValueError):
                self.send(503, json.dumps({'error': '聊天室服务暂不可用，请稍后刷新状态'}, ensure_ascii=False).encode())
        elif url.path == '/stats/usage':
            query = parse_qs(url.query)
            today = datetime.now(TZ).date().isoformat()
            start, end = query.get('start', ['2000-01-01'])[0], query.get('end', [today])[0]
            try:
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', start) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', end) or start > end:
                    return self.send(400, b'{"error":"Invalid date range"}')
                self.send(200, json.dumps(usage_store().report(start,end)).encode())
            except (OSError, ValueError, sqlite3.Error):
                self.send(503, b'{"error":"Usage statistics temporarily unavailable"}')
        elif url.path in ('/stats/', '/stats/index.html'):
            self.send(200, (Path(__file__).parent / 'server-index.html').read_bytes(), 'text/html; charset=utf-8')
        elif url.path in ('/stats/data', '/stats/visitors'):
            try:
                query = parse_qs(url.query)
                rows, unparsed, checked = load_rows()
                snapshot = summarize(rows, unparsed)
                start, end = query.get('start', [rows[0]['date']])[0], query.get('end', [rows[-1]['date']])[0]
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', start) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', end) or start > end:
                    self.send(400, b'{"error":"Invalid date range"}')
                    return
                if url.path == '/stats/visitors':
                    scope = query.get('scope', ['all'])[0]
                    search = query.get('q', [''])[0].strip()
                    sort = query.get('sort', ['recent'])[0]
                    page = query.get('page', ['1'])[0]
                    if scope not in ('all','home','machine','test') or len(search)>64 or sort not in ('recent','requests') or not page.isdigit() or len(page)>6:
                        self.send(400, b'{"error":"Invalid visitor filters"}')
                        return
                    details = visitor_details(rows,start,end,scope,search,int(page),sort,query.get('filtered',['1'])[0]!='0')
                    self.send(200,json.dumps({**details,'checked_at':checked},ensure_ascii=False).encode())
                    return
                selected = select_stats(rows, snapshot, start, end, query.get('filtered', ['1'])[0] != '0')
                self.send(200, json.dumps({'snapshot': snapshot, 'selected': selected, 'checked_at': checked}, ensure_ascii=False).encode())
            except (OSError, ValueError):
                self.send(503, b'{"error":"Statistics temporarily unavailable"}')
        else:
            self.send(404, b'{"error":"Not found"}')

    def do_POST(self):
        if urlsplit(self.path).path == '/api/failures' or urlsplit(self.path).path.startswith('/api/failures/'):
            return self.capture_failure(urlsplit(self.path).path, ADMIN_ORIGIN)
        if urlsplit(self.path).path == '/api/usage':
            return self.capture_usage()
        if not self.authenticate():
            return
        if urlsplit(self.path).path != '/stats/chat-settings':
            return self.send(404, b'{"error":"Not found"}')
        if self.headers.get('Origin') != ADMIN_ORIGIN:
            return self.send(403, b'{"error":"Invalid origin"}')
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            return self.send(415, b'{"error":"JSON required"}')
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not lengths[0].isdigit() or self.headers.get('Transfer-Encoding'):
            return self.send(400, b'{"error":"Invalid length"}')
        length = int(lengths[0])
        if not 0 < length <= 1024:
            return self.send(413, b'{"error":"Body too large"}')
        try:
            self.connection.settimeout(5)
            raw = self.rfile.read(length)
            value = json.loads(raw)
            if len(raw) != length or not isinstance(value, dict) or set(value) != {'enabled'} or type(value['enabled']) is not bool:
                raise ValueError()
        except (ValueError, UnicodeError):
            return self.send(400, b'{"error":"Boolean enabled required"}')
        except (TimeoutError, ConnectionError):
            return
        try:
            self.send(200, json.dumps(chat_settings(value)).encode())
        except (OSError, ValueError):
            self.send(503, json.dumps({'error': '保存失败，请刷新状态后重试'}, ensure_ascii=False).encode())

    def capture_usage(self):
        if self.headers.get('Origin') != ADMIN_ORIGIN:
            return self.send(403, b'{"error":"Invalid origin"}')
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            return self.send(415, b'{"error":"JSON required"}')
        lengths = self.headers.get_all('Content-Length', [])
        if len(lengths) != 1 or not lengths[0].isdigit() or self.headers.get('Transfer-Encoding'):
            return self.send(400, b'{"error":"Invalid length"}')
        length = int(lengths[0])
        if not 0 < length <= 2048:
            return self.send(413, b'{"error":"Body too large"}')
        try:
            self.connection.settimeout(5)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError()
            value = json.loads(raw)
            ip = self.headers.get('X-Real-IP', self.client_address[0])[:64]
            usage_store().record(value,ip)
            self.send(200, b'{"ok":true}')
        except UsageError as error:
            self.send(error.status, json.dumps({'error':error.message}).encode())
        except (ValueError, UnicodeError):
            self.send(400, b'{"error":"Invalid counters"}')
        except (TimeoutError, ConnectionError):
            return
        except (OSError, sqlite3.Error):
            self.send(503, b'{"error":"Usage statistics temporarily unavailable"}')


if __name__ == '__main__':
    CONFIG.update(json.loads(Path(os.environ.get('PCB_STATS_CONFIG', '/etc/pcb-stats/config.json')).read_text()))
    failure_http.start_cleanup()
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('PCB_STATS_PORT', '8768'))), Handler).serve_forever()
