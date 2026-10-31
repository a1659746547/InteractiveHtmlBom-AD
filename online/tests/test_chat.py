from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
import sqlite3
import tempfile
import threading
import time
import unittest
import uuid
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('chat', ROOT/'chat_server.py')
chat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chat)


class ChatTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.state = chat.ChatState(self.temp.name, '')
        state = self.state
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def do_GET(self): state.handle(self)
            def do_POST(self): state.handle(self)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.url = 'http://127.0.0.1:'+str(self.server.server_port)
        self.state.origin = self.url
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.temp.cleanup()

    def api(self, path, body=None, origin=None, method=None):
        request = Request(self.url+'/api/chat/'+path, data=json.dumps(body).encode() if body is not None else None,
                          headers={'Origin': origin or self.url, 'Content-Type': 'application/json'}, method=method)
        try:
            with urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def join(self, name='Test'):
        status, person = self.api('join', {'nickname': name})
        self.assertEqual(status, 201)
        return person

    def test_independent_scopes_and_immediate_withdrawal(self):
        a, b = self.join('A'), self.join('B')
        token = a['token']
        self.assertEqual(a['participant']['progress'], {'level': 'none'})
        self.api('presence', {'token': token, 'progress': {'level': 'percent', 'percent': 25, 'done': 1, 'total': 4, 'pcbdata': 'DO NOT STORE'}})
        state = self.api('snapshot')[1]
        value = next(p['progress'] for p in state['participants'] if p['id']==a['participant']['id'])
        self.assertEqual(value, {'level': 'percent', 'percent': 25})
        self.api('presence', {'token': token, 'progress': {'level': 'counts', 'done': 2, 'total': 4, 'board': 'Demo', 'current': {'ref': 'R2', 'value': 'HIDDEN', 'package': 'HIDDEN'}}})
        value = self.api('snapshot')[1]['participants'][0]['progress']
        self.assertEqual(value, {'level':'counts', 'done':2, 'total':4, 'percent':50, 'board':'Demo', 'current':{'ref':'R2'}})
        self.api('presence', {'token':token, 'progress':{'level':'none', 'board':'Board only'}})
        self.assertEqual(self.api('snapshot')[1]['participants'][0]['progress'], {'level':'none','board':'Board only'})
        self.api('presence', {'token':token, 'progress':{'level':'none'}})
        self.assertEqual(self.api('snapshot')[1]['participants'][0]['progress'], {'level':'none'})
        self.api('leave', {'token': token})
        self.assertEqual(self.api('snapshot')[1]['online'], 1)
        self.assertEqual(self.api('presence', {'token':token,'progress':{'level':'none'}})[0],401)
        self.assertNotIn(b['token'], json.dumps(state))

    def test_model_independent_and_completion_retry_deduplication(self):
        a=self.join();token=a['token']
        self.api('presence', {'token':token,'progress':{'level':'none','model':'ESP32-S3','current':{'ref':''}}})
        shared=self.api('snapshot')[1]['participants'][0]['progress']
        self.assertEqual(shared,{'level':'none','model':'ESP32-S3','current':{'ref':''}})
        event={'token':token,'event_id':str(uuid.uuid4()),'model':'ESP32-S3','board':'DO NOT PUBLISH','ref':'DO NOT PUBLISH'}
        code,created=self.api('completions',event);self.assertEqual(code,201)
        code,retry=self.api('completions',event);self.assertEqual(code,200);self.assertEqual(created,retry)
        messages=self.api('snapshot')[1]['messages'];self.assertEqual(len(messages),1)
        self.assertEqual(messages[0]['kind'],'complete');self.assertEqual(messages[0]['model'],'ESP32-S3')
        self.assertNotIn('DO NOT PUBLISH',json.dumps(messages))
        b=self.join('B');event['token']=b['token'];self.assertEqual(self.api('completions',event)[0],409)
        self.assertEqual(self.api('completions',{'token':token,'model':'ESP32-S3','event_id':'bad'})[0],400)

    def test_existing_message_schema_migrates_without_data_loss(self):
        with tempfile.TemporaryDirectory() as folder:
            connection=sqlite3.connect(Path(folder)/'chat.sqlite3')
            with connection:
                connection.execute('CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT,author TEXT NOT NULL,nickname TEXT NOT NULL,body TEXT NOT NULL,created REAL NOT NULL)')
                connection.execute('INSERT INTO messages(author,nickname,body,created) VALUES(?,?,?,?)',('old','Old','Original message',time.time()))
            connection.close()
            migrated=chat.ChatState(folder,self.url)
            with migrated.connect() as db:
                self.assertEqual(db.execute('SELECT body,kind,model FROM messages').fetchall(),[('Original message','text','')])

    def test_messages_persist_progress_and_tokens_do_not(self):
        a=self.join('<img src=x onerror=alert(1)> '[:20])
        token=a['token']
        self.assertEqual(self.api('messages', {'token': token, 'text':'<script>alert(1)</script>', 'nickname':'spoof', 'author':'spoof'})[0],201)
        self.api('presence', {'token':token,'progress':{'level':'counts','done':1,'total':2,'board':'Transient'}})
        other=chat.ChatState(self.temp.name,self.url)
        status,snapshot=other.dispatch('GET','/api/chat/snapshot',{},'test')
        self.assertEqual(snapshot['online'],0)
        self.assertEqual(snapshot['messages'][0]['nickname'],a['participant']['nickname'])
        self.assertEqual(snapshot['messages'][0]['text'],'<script>alert(1)</script>')
        self.assertNotIn(token, Path(self.state.db).read_bytes().decode('latin1'))
        self.assertNotIn('Transient',Path(self.state.db).read_bytes().decode('latin1'))

    def test_origin_token_and_validation(self):
        # No unread body: Windows may reset a socket when an early 403 closes it.
        # This remains a real POST and must be rejected before body validation.
        self.assertEqual(self.api('join',origin='https://evil.invalid',method='POST')[0],403)
        self.assertEqual(self.api('messages',{'token':'0'*64,'text':'fake'})[0],401)
        a=self.join();token=a['token']
        for value in [{'level':'counts','done':3,'total':2},{'level':'percent','percent':float('nan')},
                      {'level':'percent','percent':101},{'level':'counts','done':True,'total':1},
                      {'level':'none','board':'x'*81},{'level':'none','current':{'ref':'x'*81}}]:
            self.assertEqual(self.api('presence',{'token':token,'progress':value})[0],400)
        self.assertEqual(self.api('messages',{'token':token,'text':'x'*601})[0],400)
        self.assertEqual(self.api('messages',{'token':token,'text':'   '})[0],400)
        self.assertEqual(self.api('join',{'nickname':'a\nb'})[0],400)

    def test_rate_limit_and_expiry(self):
        a=self.join();token=a['token']
        for i in range(20):self.assertEqual(self.api('messages',{'token':token,'text':str(i)})[0],201)
        self.assertEqual(self.api('messages',{'token':token,'text':'excess'})[0],429)
        person=self.state.people[next(iter(self.state.people))]
        person['seen']=time.monotonic()-chat.ONLINE_TTL-1
        self.assertEqual(self.api('snapshot')[1]['online'],0)
        self.assertEqual(self.api('presence',{'token':token,'progress':{'level':'none'}})[0],200)
        person['seen']=time.monotonic()-chat.SESSION_TTL-1
        self.assertEqual(self.api('presence',{'token':token,'progress':{'level':'none'}})[0],401)

    def test_online_expiry_withdraws_private_details_without_losing_session(self):
        a=self.join();token=a['token']
        self.api('presence',{'token':token,'progress':{'level':'counts','done':1,'total':2,'board':'Private board','model':'Model'}})
        person=next(iter(self.state.people.values()))
        person['seen']=time.monotonic()-chat.ONLINE_TTL-1
        self.assertEqual(self.api('snapshot')[1]['participants'],[])
        self.assertEqual(person['progress'],{'level':'none'})
        self.assertEqual(self.api('presence',{'token':token,'progress':{'level':'percent','percent':75}})[0],200)
        restored=self.api('snapshot')[1]['participants'][0]
        self.assertEqual(restored['id'],a['participant']['id'])
        self.assertEqual(restored['progress'],{'level':'percent','percent':75})

    def test_only_text_messages_change_speaker_order(self):
        a=self.join('A');token=a['token']
        self.assertEqual(a['participant']['last_spoken'],0)
        code,msg=self.api('messages',{'token':token,'text':'Hello'})
        self.assertEqual(code,201)
        self.api('presence',{'token':token,'progress':{'level':'percent','percent':50}})
        self.api('profile',{'token':token,'avatar_id':3})
        self.api('completions',{'token':token,'model':'Part','event_id':str(uuid.uuid4())})
        self.assertEqual(self.api('snapshot')[1]['participants'][0]['last_spoken'],msg['id'])

    def test_offline_cache_is_bounded_without_counting_as_full_room(self):
        people=[self.join('Cached '+str(i)) for i in range(3)]
        for i,person in enumerate(self.state.people.values()):
            person['seen']=time.monotonic()-chat.ONLINE_TTL-3+i
        with patch.object(chat,'MAX_SESSIONS',3):
            self.join('New online user')
        self.assertEqual(len(self.state.people),3)
        self.assertEqual(self.api('snapshot')[1]['online'],1)
        self.assertEqual(self.api('presence',{'token':people[0]['token'],'progress':{'level':'none'}})[0],401)
        self.assertEqual(self.api('presence',{'token':people[1]['token'],'progress':{'level':'none'}})[0],200)
        template=next(iter(self.state.people.values())).copy()
        self.state.people={str(i):dict(template,id=str(i),seen=time.monotonic()) for i in range(100)}
        self.assertEqual(self.api('join',{'nickname':'Room full'})[0],503)

    def test_bounded_history(self):
        a=self.join()
        with self.state.connect() as db:
            db.executemany('INSERT INTO messages(author,nickname,body,created) VALUES(?,?,?,?)', [('test','test','synthetic',time.time())]*350)
        self.assertEqual(len(self.api('snapshot')[1]['messages']),20)
        self.api('messages',{'token':a['token'],'text':'prune'})
        with self.state.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM messages').fetchone()[0],300)

    def test_builtin_avatars_validate_sync_and_persist(self):
        code,a=self.api('join',{'nickname':'Avatar A','avatar_id':18})
        self.assertEqual(code,201);token=a['token']
        self.assertEqual(a['participant']['avatar_id'],18)
        self.api('messages',{'token':token,'text':'Original avatar message'})
        code,b=self.api('join',{'nickname':'Avatar B','avatar_id':6})
        self.assertEqual(code,201)
        self.api('messages',{'token':b['token'],'text':'Other author'})
        for number in range(1,21):
            code,result=self.api('profile',{'token':token,'avatar_id':number})
            self.assertEqual(code,200);self.assertEqual(result['participant']['avatar_id'],number)
        snapshot=self.api('snapshot')[1]
        self.assertEqual(snapshot['messages'][0]['avatar_id'],20)
        self.assertEqual(snapshot['messages'][1]['avatar_id'],6)
        self.assertEqual(next(p for p in snapshot['participants'] if p['id']==a['participant']['id'])['avatar_id'],20)
        for invalid in [None,0,-1,21,True,1.5,'1','https://example.invalid/a.svg',{}]:
            self.assertEqual(self.api('profile',{'token':token,'avatar_id':invalid})[0],400)
            self.assertEqual(self.api('join',{'nickname':'Invalid','avatar_id':invalid})[0],400)
        self.assertEqual(self.api('profile',{'token':'0'*64,'avatar_id':1})[0],401)
        self.assertEqual(self.api('profile',{'token':token,'avatar_id':1})[0],429)
        reopened=chat.ChatState(self.temp.name,self.url)
        persisted=reopened.dispatch('GET','/api/chat/snapshot',{},'test')[1]
        self.assertEqual(persisted['online'],0)
        self.assertEqual(persisted['messages'][0]['avatar_id'],20)


if __name__=='__main__':unittest.main(verbosity=2)
