"""Private failure metadata and explicitly consented, expiring diagnostic samples."""
from pathlib import Path
from contextlib import closing
import hashlib, hmac, re, secrets, sqlite3, threading, time

MAX_FILE = 50 * 1024 * 1024
MAX_TOTAL = 200 * 1024 * 1024
FORMATS = {'pcbdoc','kicad_pcb','eprj2','epro','epro2','json','asc','pcb','zip','gerber','unknown'}
REASONS = {'unsupported','too_large','timeout','archive','invalid_pad','no_board','invalid_data','parser_error'}

class FailureError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status

class FailureStore:
    def __init__(self, directory, clock=time.time):
        self.root = Path(directory)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.samples = self.root/'samples'
        self.samples.mkdir(exist_ok=True, mode=0o700)
        self.path, self.clock, self.lock = self.root/'failures.sqlite3', clock, threading.RLock()
        with self.db() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS failures (
                id TEXT PRIMARY KEY, event TEXT UNIQUE, created REAL, expires REAL,
                ip TEXT, format TEXT, size INTEGER, reason TEXT, consent INTEGER,
                token TEXT, saved INTEGER DEFAULT 0)''')
            db.execute('CREATE INDEX IF NOT EXISTS failures_created ON failures(created)')
        self.cleanup()

    def db(self):
        # Closing the connection matters on Windows and prevents descriptor leaks.
        class Connection:
            def __enter__(ctx):
                ctx.conn = sqlite3.connect(self.path, timeout=10)
                ctx.conn.execute('BEGIN IMMEDIATE')
                return ctx.conn
            def __exit__(ctx, *args):
                try: return ctx.conn.__exit__(*args)
                finally: ctx.conn.close()
        return Connection()

    def cleanup(self):
        with self.lock, self.db() as db:
            now = self.clock()
            # Sweep even orphaned/partial files after process interruption.
            live = {r[0] for r in db.execute('SELECT id FROM failures WHERE expires>?', (now,))}
            for path in self.samples.iterdir():
                if path.is_file() and (path.stem not in live or path.suffix == '.part'):
                    path.unlink()
            db.execute('UPDATE failures SET saved=0,token=NULL WHERE expires<=?', (now,))
            db.execute('DELETE FROM failures WHERE created<=?', (now-30*86400,))

    def record(self, value, ip):
        if not isinstance(value, dict) or set(value) != {'event','format','size','reason','consent'}:
            raise FailureError('Invalid failure fields')
        if not isinstance(value['event'],str) or not re.fullmatch('[a-f0-9]{32}', value['event']):
            raise FailureError('Invalid event')
        if not isinstance(value['format'],str) or not isinstance(value['reason'],str) or value['format'] not in FORMATS or value['reason'] not in REASONS or type(value['consent']) is not bool:
            raise FailureError('Invalid failure values')
        if type(value['size']) is not int or not 0 <= value['size'] <= 2**53-1:
            raise FailureError('Invalid file size')
        with self.lock:
            self.cleanup()
            with self.db() as db:
                if db.execute('SELECT 1 FROM failures WHERE event=?', (value['event'],)).fetchone():
                    return {'recorded':True,'sample_allowed':False,'duplicate':True}
                now=self.clock()
                if db.execute('SELECT count(*) FROM failures WHERE ip=? AND created>?', (ip,now-60)).fetchone()[0]>=5:
                    raise FailureError('Failure report rate limit',429)
                if db.execute('SELECT count(*) FROM failures').fetchone()[0]>=10000:
                    raise FailureError('Failure storage full',503)
                ident,token=secrets.token_hex(16),secrets.token_hex(32)
                allow=value['consent'] and 0<value['size']<=MAX_FILE
                db.execute('INSERT INTO failures VALUES(?,?,?,?,?,?,?,?,?,?,0)',
                    (ident,value['event'],now,now+3600,ip,value['format'],value['size'],value['reason'],int(value['consent']),hashlib.sha256(token.encode()).hexdigest() if allow else None))
                return {'id':ident,'recorded':True,'sample_allowed':allow,'upload_token':token if allow else None,'expires':now+3600}

    def upload(self, ident, token, stream, length):
        if not re.fullmatch('[a-f0-9]{32}',ident):raise FailureError('Not found',404)
        with self.lock:
            self.cleanup()
            with self.db() as db:
                row=db.execute('SELECT expires,size,consent,token,saved FROM failures WHERE id=?',(ident,)).fetchone()
                if not row or row[0]<=self.clock():raise FailureError('Sample expired or unavailable',410)
                if not row[2] or not row[3] or not hmac.compare_digest(row[3],hashlib.sha256(token.encode()).hexdigest()):
                    raise FailureError('Invalid sample token',403)
                if row[4]:raise FailureError('Sample already saved',409)
                if length!=row[1] or not 0<length<=MAX_FILE:raise FailureError('Invalid sample length',413)
                if sum(p.stat().st_size for p in self.samples.iterdir() if p.is_file())+length>MAX_TOTAL:
                    raise FailureError('Sample capacity reached',507)
                part=self.samples/(ident+'.part')
                try:
                    with part.open('xb') as f:
                        part.chmod(0o600)
                        remaining=length
                        while remaining:
                            chunk=stream.read(min(65536,remaining))
                            if not chunk:raise FailureError('Incomplete sample')
                            f.write(chunk);remaining-=len(chunk)
                    if row[0]<=self.clock():raise FailureError('Sample expired',410)
                    part.replace(self.samples/(ident+'.bin'))
                    db.execute('UPDATE failures SET saved=1,token=NULL WHERE id=?',(ident,))
                finally:
                    part.unlink(missing_ok=True)

    def report(self, start, end, page=1):
        with self.lock:
            self.cleanup()
            with self.db() as db:
                where="date(created+28800,'unixepoch') BETWEEN ? AND ?"
                total=db.execute('SELECT count(*) FROM failures WHERE '+where,(start,end)).fetchone()[0]
                rows=db.execute('SELECT id,created,expires,ip,format,size,reason,consent,saved FROM failures WHERE '+where+' ORDER BY created DESC,id LIMIT 25 OFFSET ?', (start,end,(page-1)*25)).fetchall()
                return {'total':total,'page':page,'page_size':25,'items':[dict(zip(['id','created','expires','ip','format','size','reason','consent','saved'],r)) for r in rows]}

    def sample(self, ident):
        if not re.fullmatch('[a-f0-9]{32}',ident):raise FailureError('Not found',404)
        with self.lock:
            self.cleanup()
            with self.db() as db:
                row=db.execute('SELECT expires,saved,format FROM failures WHERE id=?',(ident,)).fetchone()
                if not row or row[0]<=self.clock() or not row[1]:raise FailureError('Sample expired or unavailable',410)
                return (self.samples/(ident+'.bin')).read_bytes(), row[2]

if __name__ == '__main__':
    import os
    FailureStore(Path(os.environ.get('PCB_USAGE_DATA_DIR','/var/lib/pcb-stats'))/'failures').cleanup()
