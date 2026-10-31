"""Routes shared by the authenticated statistics service and loopback preview."""
from pathlib import Path
import json, os, re, sqlite3, threading, time
from urllib.parse import parse_qs
from failure_store import FailureStore, FailureError, MAX_FILE

STORE=None
LOCK=threading.Lock()

def store():
    global STORE
    with LOCK:
        if STORE is None:STORE=FailureStore(Path(os.environ.get('PCB_USAGE_DATA_DIR','/var/lib/pcb-stats'))/'failures')
        return STORE

def start_cleanup():
    def sweep():
        while True:
            try:store().cleanup()
            except (OSError, sqlite3.Error):pass
            time.sleep(15)
    threading.Thread(target=sweep,daemon=True).start()

class FailureRoutes:
    def failure_get(self,url):
        try:
            if url.path=='/stats/failures':
                query=parse_qs(url.query)
                start,end=query.get('start',['2000-01-01'])[0],query.get('end',['2099-12-31'])[0]
                page=query.get('page',['1'])[0]
                if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',start) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',end) or start>end or not re.fullmatch(r'[1-9]\d{0,5}',page):raise FailureError('Invalid filters')
                return self.send(200,json.dumps(store().report(start,end,int(page))).encode())
            match=re.fullmatch('/stats/failures/([a-f0-9]{32})/sample',url.path)
            if not match:return self.send(404,b'{}')
            body,format=store().sample(match[1])
            extension={'unknown':'bin','gerber':'gbr'}.get(format,format)
            self.send_response(200)
            for key,value in {'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="failure-'+match[1]+'.'+extension+'"','Content-Length':str(len(body)),'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}.items():self.send_header(key,value)
            self.end_headers()
            if self.command!='HEAD':self.wfile.write(body)
        except FailureError as e:self.send(e.status,json.dumps({'error':e.message}).encode())
        except (OSError,sqlite3.Error):self.send(503,b'{"error":"Failure records unavailable"}')

    def capture_failure(self,path,origin):
        if self.headers.get('Origin')!=origin:return self.send(403,b'{"error":"Invalid origin"}')
        lengths=self.headers.get_all('Content-Length',[])
        if len(lengths)!=1 or not lengths[0].isdigit() or len(lengths[0])>12 or self.headers.get('Transfer-Encoding'):return self.send(400,b'{"error":"Invalid length"}')
        length=int(lengths[0]);kind=self.headers.get('Content-Type','').split(';')[0].strip().lower()
        match=re.fullmatch('/api/failures/([a-f0-9]{32})/sample',path)
        try:
            if path=='/api/failures':
                if kind!='application/json':return self.send(415,b'{}')
                if not 0<length<=2048:return self.send(413,b'{}')
                self.connection.settimeout(5)
                raw=self.rfile.read(length)
                if len(raw)!=length:raise FailureError('Incomplete metadata')
                value=json.loads(raw)
                result=store().record(value,self.headers.get('X-Real-IP',self.client_address[0])[:64])
                return self.send(201,json.dumps(result).encode())
            if not match:return self.send(404,b'{}')
            if kind!='application/octet-stream':return self.send(415,b'{}')
            if not 0<length<=MAX_FILE:return self.send(413,b'{}')
            token=self.headers.get('X-Failure-Token','')
            if not re.fullmatch('[a-f0-9]{64}',token):return self.send(403,b'{}')
            self.connection.settimeout(20)
            store().upload(match[1],token,self.rfile,length)
            self.send(201,b'{"saved":true}')
        except FailureError as e:self.send(e.status,json.dumps({'error':e.message}).encode())
        except (ValueError,TypeError,UnicodeError):self.send(400,b'{"error":"Invalid metadata"}')
        except (TimeoutError,ConnectionError):return
        except (OSError,sqlite3.Error):self.send(503,b'{"error":"Failure storage unavailable"}')
