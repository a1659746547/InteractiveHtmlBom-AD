from pathlib import Path
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer
import base64, hashlib, importlib.util, json, sys, tempfile, threading, unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT
sys.path.insert(0, str(SOURCE/'analytics'))

def module(name, path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

chat=module('chat_admin_test_backend', SOURCE/'chat_server.py')
stats=module('chat_admin_test_stats', SOURCE/'analytics/analytics_server.py')
AUTH='Basic '+base64.b64encode(b'test-admin:local-test-only').decode()

class Environment:
    def __init__(self, port=0):
        self.temp=tempfile.TemporaryDirectory(prefix='pcb-admin-test-')
        self.data=Path(self.temp.name)
        self.state=chat.ChatState(self.data/'chat','pending')
        state=self.state
        class ChatHandler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):state.handle(self)
            def do_POST(self):state.handle(self)
        self.chat=ThreadingHTTPServer(('127.0.0.1',0),ChatHandler)
        class Handler(stats.Handler,SimpleHTTPRequestHandler):
            def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(SOURCE),**kwargs)
            def do_GET(self):
                if self.path.startswith('/stats/'):
                    return stats.Handler.do_GET(self)
                if self.path.startswith('/api/chat/'):
                    return state.handle(self)
                if self.path.split('?')[0] not in ('/','/index.html','/gerber.html','/favicon.ico','/favicon.svg'):
                    return self.send_error(404)
                return SimpleHTTPRequestHandler.do_GET(self)
            def do_POST(self):
                if self.path == '/api/usage' or self.path.startswith('/api/failures'):
                    return stats.Handler.do_POST(self)
                if self.path.startswith('/stats/'):
                    return stats.Handler.do_POST(self)
                if self.path.startswith('/api/chat/'):
                    return state.handle(self)
                return self.send_error(404)
        self.server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
        self.url='http://127.0.0.1:'+str(self.server.server_port)
        self.state.origin=self.url
        stats.CHAT_CONTROL_URL='http://127.0.0.1:'+str(self.chat.server_port)+'/_internal/chat/settings'
        stats.ADMIN_ORIGIN=self.url
        stats.CONFIG.clear()
        stats.USAGE = stats.UsageStore(self.data/'usage')
        stats.failure_http.STORE = stats.failure_http.FailureStore(self.data/'failures')
        stats.CONFIG.update(username='test-admin',salt='0f'*16,password_hash=hashlib.pbkdf2_hmac('sha256',b'local-test-only',bytes.fromhex('0f'*16),200000).hex(),log_directory=str(self.data),shares_db=str(self.data/'not-present.sqlite'))
        (self.data/'pcb.kn21.xyz.log').write_text('127.0.0.1 - - [20/Oct/2026:12:00:00 +0800] "GET / HTTP/1.1" 200 100 "-" "Mozilla/5.0"\n')
        stats.CACHE.update(loaded=0,rows=[],unparsed=0)
        self.threads=[]
        for server in (self.chat,self.server):
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();self.threads.append(thread)
    def close(self):
        for server in (self.server,self.chat):server.shutdown();server.server_close()
        self.temp.cleanup()
    def request(self,path,body=None,auth=False,origin=True,content_type='application/json',base=None,extra=None,method=None):
        headers={}
        if auth:headers['Authorization']=AUTH
        if origin:headers['Origin']=self.url if origin is True else origin
        if body is not None:headers['Content-Type']=content_type
        headers.update(extra or {})
        req=Request((base or self.url)+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
        try:
            with urlopen(req,timeout=5) as r:return r.status,json.loads(r.read())
        except HTTPError as r:
            payload=r.read()
            try:payload=json.loads(payload)
            except ValueError:payload=payload.decode(errors='replace')
            return r.code,payload

class AdminTests(unittest.TestCase):
    def setUp(self):self.env=Environment()
    def tearDown(self):self.env.close()
    def call(self,*args,**kwargs):return self.env.request(*args,**kwargs)
    def test_default_and_admin_auth(self):
        self.assertEqual(self.call('/api/chat/config'),(200,{'enabled':True}))
        self.assertEqual(self.call('/stats/chat-settings')[0],401)
        self.assertEqual(self.call('/stats/chat-settings',{'enabled':False})[0],401)
        self.assertTrue(self.env.state.enabled)
        self.assertEqual(self.call('/stats/chat-settings',auth=True),(200,{'enabled':True}))
    def test_csrf_and_strict_values(self):
        for origin in [False,'https://invalid.example','null']:
            self.assertEqual(self.call('/stats/chat-settings',auth=True,origin=origin,method='POST')[0],403)
        self.assertEqual(self.call('/stats/chat-settings',{'enabled':False},auth=True,content_type='text/plain')[0],415)
        for bad in [{},{'enabled':'false'},{'enabled':0},{'enabled':None},{'enabled':False,'extra':1},[],True]:
            self.assertEqual(self.call('/stats/chat-settings',bad,auth=True)[0],400)
        self.assertTrue(self.env.state.enabled)
    def test_disabled_gates_existing_clients_and_survives_restart(self):
        _,joined=self.call('/api/chat/join',{'nickname':'Local test','avatar_id':1});token=joined['token']
        self.assertEqual(self.call('/api/chat/messages',{'token':token,'text':'Retain history'})[0],201)
        self.call('/api/chat/presence',{'token':token,'progress':{'level':'percent','percent':40,'board':'Synthetic'}})
        self.assertEqual(self.call('/stats/chat-settings',{'enabled':False},auth=True),(200,{'enabled':False}))
        self.assertEqual(self.call('/api/chat/snapshot')[1],{'enabled':False,'messages':[],'participants':[],'online':0})
        for path,body in [('join',{'nickname':'Denied'}),('messages',{'token':token,'text':'Denied'}),('presence',{'token':token,'progress':{'level':'none'}}),('completions',{'token':token,'model':'Denied'}),('profile',{'token':token,'avatar_id':2})]:
            status,value=self.call('/api/chat/'+path,body)
            self.assertEqual(status,503);self.assertEqual(value['code'],'chat_disabled')
        restarted=chat.ChatState(self.env.data/'chat',self.env.url)
        self.assertFalse(restarted.enabled)
        with restarted.connect() as db:self.assertEqual(db.execute('SELECT body FROM messages').fetchall(),[('Retain history',)])
        self.assertEqual(self.call('/stats/chat-settings',{'enabled':True},auth=True),(200,{'enabled':True}))
        self.assertEqual(self.call('/api/chat/snapshot')[1]['messages'][0]['text'],'Retain history')
        self.assertEqual(self.call('/api/chat/presence',{'token':token,'progress':{'level':'none'}})[0],401)
        self.assertEqual(self.call('/api/chat/join',{'nickname':'Fresh'})[1]['participant']['progress'],{'level':'none'})
    def test_internal_control_not_public(self):
        self.assertEqual(self.call('/_internal/chat/settings')[0],404)
        base='http://127.0.0.1:'+str(self.env.chat.server_port)
        self.assertEqual(self.call('/_internal/chat/settings',base=base)[0],404)
        self.assertEqual(self.call('/api/chat/_internal/chat/settings',{'enabled':False},extra={'X-PCB-Chat-Control':'stats-v1'})[0],401)
        self.assertTrue(self.env.state.enabled)
    def test_unavailable_does_not_report_closed_or_changed(self):
        saved=stats.CHAT_CONTROL_URL
        stats.CHAT_CONTROL_URL='http://127.0.0.1:1/_internal/chat/settings'
        try:
            self.assertEqual(self.call('/stats/chat-settings',auth=True)[0],503)
            self.assertEqual(self.call('/stats/chat-settings',{'enabled':False},auth=True)[0],503)
            self.assertTrue(self.env.state.enabled)
        finally:stats.CHAT_CONTROL_URL=saved

    def test_usage_capture_is_public_but_reports_require_login(self):
        body={'session':'a'*32,'seq':1,'active_ms':0,'parses':1}
        self.assertEqual(self.call('/api/usage',body),(200,{'ok':True}))
        # Send no body when checking early Origin rejection (portable to Windows).
        self.assertEqual(self.call('/api/usage',origin=False,method='POST')[0],403)
        self.assertEqual(self.call('/api/usage',{**body,'filename':'private.PcbDoc'})[0],400)
        self.assertEqual(self.call('/stats/usage')[0],401)
        status,value=self.call('/stats/usage',auth=True)
        self.assertEqual(status,200);self.assertEqual(value['parses'],1);self.assertEqual(value['used_ips'],1)

if __name__=='__main__':
    if '--serve' in sys.argv:
        env=Environment(int(sys.argv[sys.argv.index('--port')+1]) if '--port' in sys.argv else 62472)
        print(env.url+'/stats/',flush=True)
        try:threading.Event().wait()
        except KeyboardInterrupt:pass
        finally:env.close()
    else:unittest.main(verbosity=2)
