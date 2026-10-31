"""Bounded, anonymous usage counters; no filenames or PCB contents are accepted."""
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
from pathlib import Path
import ipaddress
import json
import re
import sqlite3
import threading
import time

TZ = timezone(timedelta(hours=8))


class UsageError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class UsageStore:
    def __init__(self, directory):
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory/'usage.sqlite3'
        self.lock = threading.RLock()
        self.rates = {}
        self.cleaned = 0
        with self.connect() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, ip TEXT NOT NULL, seq INTEGER NOT NULL,
                active_ms INTEGER NOT NULL, parses INTEGER NOT NULL,
                created REAL NOT NULL, seen REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS daily (
                session TEXT NOT NULL, day TEXT NOT NULL, ip TEXT NOT NULL,
                active_ms INTEGER NOT NULL, parses INTEGER NOT NULL,
                seen REAL NOT NULL, active REAL NOT NULL, parsed REAL NOT NULL,
                PRIMARY KEY(session,day));
                CREATE INDEX IF NOT EXISTS daily_range ON daily(day,ip);''')
        self.path.chmod(0o600)

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=3)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def record(self, value, ip, now=None):
        now = time.time() if now is None else now
        if not isinstance(value, dict) or set(value) != {'session', 'seq', 'active_ms', 'parses'}:
            raise UsageError(400, 'Invalid counters')
        sid = value['session']
        if not isinstance(sid, str) or not re.fullmatch(r'[a-f0-9]{32}', sid):
            raise UsageError(400, 'Invalid session')
        for key, maximum in [('seq', 10_000_000), ('active_ms', 604_800_000), ('parses', 1_000_000)]:
            if type(value[key]) is not int or not 0 <= value[key] <= maximum:
                raise UsageError(400, 'Invalid counters')
        try:
            parsed = ipaddress.ip_address(ip)
            ip = str(parsed.ipv4_mapped or parsed) if isinstance(parsed, ipaddress.IPv6Address) else str(parsed)
        except ValueError:
            raise UsageError(400, 'Invalid address')
        day = datetime.fromtimestamp(now, TZ).date().isoformat()
        with self.lock, self.connect() as db:
            stamps = [t for t in self.rates.get(ip, []) if now-t < 60]
            if len(stamps) >= 1200 or len(self.rates) >= 4096 and ip not in self.rates:
                raise UsageError(429, 'Too many requests')
            stamps.append(now);self.rates[ip] = stamps
            if now-self.cleaned >= 3600:
                self.rates = {key: items for key, items in self.rates.items() if items[-1] > now-60}
                db.execute('DELETE FROM daily WHERE seen < ?', (now-90*86400,))
                db.execute('DELETE FROM sessions WHERE seen < ?', (now-90*86400,))
                self.cleaned = now
            previous = db.execute('SELECT seq,active_ms,parses,seen FROM sessions WHERE id=?', (sid,)).fetchone()
            if previous and value['seq'] <= previous[0]:
                return
            if previous and (value['active_ms'] < previous[1] or value['parses'] < previous[2]):
                raise UsageError(400, 'Counters must increase')
            if not previous and db.execute('SELECT count(*) FROM sessions').fetchone()[0] >= 200_000:
                raise UsageError(503, 'Usage storage full')
            elapsed = min(60_000, max(0, round((now-previous[3])*1000))+2000) if previous else 2000
            active = min(value['active_ms']-(previous[1] if previous else 0), elapsed)
            parses = min(value['parses']-(previous[2] if previous else 0), 20)
            created = db.execute('SELECT created FROM sessions WHERE id=?', (sid,)).fetchone() if previous else None
            db.execute('INSERT OR REPLACE INTO sessions VALUES(?,?,?,?,?,?,?)', (sid,ip,value['seq'],value['active_ms'],value['parses'],created[0] if created else now,now))
            db.execute('''INSERT INTO daily VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(session,day) DO UPDATE SET
                ip=excluded.ip,active_ms=daily.active_ms+excluded.active_ms,parses=daily.parses+excluded.parses,
                seen=excluded.seen,active=MAX(daily.active,excluded.active),parsed=MAX(daily.parsed,excluded.parsed)''',
                (sid,day,ip,active,parses,now,now if active else 0,now if parses else 0))

    def report(self, start, end, now=None):
        now = time.time() if now is None else now
        with self.lock, self.connect() as db:
            rows = db.execute('''SELECT ip,sum(parses),sum(active_ms),max(seen),max(active),max(parsed),count(DISTINCT session)
                FROM daily WHERE day>=? AND day<=? GROUP BY ip ORDER BY max(active) DESC,max(seen) DESC LIMIT 10000''', (start,end)).fetchall()
            first = db.execute('SELECT min(created) FROM sessions').fetchone()[0]
        items = [{'ip':ip,'parses':parses,'active_ms':active_ms,'last_seen':seen,'last_active':active or None,
                  'last_parse':parsed or None,'active_now':bool(active and now-active<=45),'sessions':sessions}
                 for ip,parses,active_ms,seen,active,parsed,sessions in rows]
        return {'items':items,'parses':sum(r['parses'] for r in items),'used_ips':sum(r['parses']>0 for r in items),
                'active_ips':sum(r['active_now'] for r in items),'active_ms':sum(r['active_ms'] for r in items),
                'since':first,'start':start,'end':end,'retention_days':90,'capped':len(items)==10000}
