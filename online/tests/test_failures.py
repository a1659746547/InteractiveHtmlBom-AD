from pathlib import Path
import io, importlib.util, json, sys, tempfile, unittest, threading
from urllib.request import Request,urlopen
from urllib.error import HTTPError
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('admin_tests',ROOT/'tests/test_admin.py')
admin=importlib.util.module_from_spec(spec);spec.loader.exec_module(admin)
from failure_store import FailureStore,FailureError,MAX_FILE
import failure_store

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.now=1000000000
        self.store=FailureStore(self.temp.name,clock=lambda:self.now)
    def tearDown(self):self.temp.cleanup()
    def record(self,consent=True,event='a'*32):
        return self.store.record(dict(event=event,format='pcbdoc',size=4,reason='invalid_pad',consent=consent),'127.0.0.1')
    def test_consent_and_single_use(self):
        value=self.record(False)
        self.assertFalse(value['sample_allowed'])
        with self.assertRaises(FailureError):self.store.upload(value['id'],'x'*64,io.BytesIO(b'test'),4)
        value=self.record(True,'b'*32)
        self.store.upload(value['id'],value['upload_token'],io.BytesIO(b'test'),4)
        self.assertEqual(self.store.sample(value['id']),(b'test','pcbdoc'))
        with self.assertRaises(FailureError):self.store.upload(value['id'],value['upload_token'],io.BytesIO(b'test'),4)
    def test_exact_expiry_and_metadata_retention(self):
        value=self.record();self.store.upload(value['id'],value['upload_token'],io.BytesIO(b'test'),4)
        self.now+=3599;self.assertEqual(self.store.sample(value['id'])[0],b'test')
        self.now+=1
        with self.assertRaises(FailureError):self.store.sample(value['id'])
        self.assertEqual(list(self.store.samples.iterdir()),[])
        self.assertEqual(self.store.report('2000-01-01','2099-12-31')['total'],1)
        self.now+=30*86400;self.store.cleanup()
        self.assertEqual(self.store.report('2000-01-01','2099-12-31')['total'],0)
    def test_restart_cleanup_orphans_and_incomplete(self):
        value=self.record()
        with self.assertRaises(FailureError):self.store.upload(value['id'],value['upload_token'],io.BytesIO(b'x'),4)
        self.assertFalse(any(self.store.samples.iterdir()))
        (self.store.samples/('f'*32+'.part')).write_bytes(b'orphan')
        restarted=FailureStore(self.temp.name,clock=lambda:self.now)
        self.assertEqual(list(restarted.samples.iterdir()),[])
    def test_strict_schema_rate_and_capacity(self):
        base=dict(event='c'*32,format='pcbdoc',size=4,reason='parser_error',consent=True)
        for patch in [{'filename':'secret'},{'format':[]},{'reason':'private text'},{'consent':'true'},{'size':True}]:
            with self.assertRaises(FailureError):self.store.record({**base,**patch},'127.0.0.1')
        one=self.record();self.assertTrue(self.record()['duplicate'])
        self.assertEqual(self.store.report('2000-01-01','2099-12-31')['total'],1)
        limit=failure_store.MAX_TOTAL;failure_store.MAX_TOTAL=3
        try:
            with self.assertRaises(FailureError):self.store.upload(one['id'],one['upload_token'],io.BytesIO(b'test'),4)
        finally:failure_store.MAX_TOTAL=limit
        for i in range(4):self.record(event=str(i)*32)
        with self.assertRaises(FailureError):self.record(event='d'*32)
    def test_independent_cleanup_cannot_remove_active_upload(self):
        value=self.record();second=FailureStore(self.temp.name,clock=lambda:self.now)
        reading,finish=threading.Event(),threading.Event();errors=[]
        class Stream:
            def read(self,n):reading.set();finish.wait(3);return b'test'
        def upload():
            try:self.store.upload(value['id'],value['upload_token'],Stream(),4)
            except Exception as e:errors.append(e)
        worker=threading.Thread(target=upload);worker.start();self.assertTrue(reading.wait(3))
        cleanup=threading.Thread(target=second.cleanup);cleanup.start()
        self.assertTrue((self.store.samples/(value['id']+'.part')).exists())
        finish.set();worker.join(4);cleanup.join(4)
        self.assertEqual(errors,[]);self.assertEqual(second.sample(value['id'])[0],b'test')

class HttpTests(unittest.TestCase):
    def setUp(self):self.env=admin.Environment()
    def tearDown(self):self.env.close()
    def test_record_auth_download_and_origin(self):
        e=self.env;body=dict(event='e'*32,format='pcbdoc',size=4,reason='invalid_data',consent=True)
        self.assertEqual(e.request('/api/failures',body,origin=False)[0],403)
        self.assertEqual(e.request('/stats/failures')[0],401)
        code,value=e.request('/api/failures',body);self.assertEqual(code,201)
        path='/api/failures/'+value['id']+'/sample'
        request=Request(e.url+path,data=b'test',headers={'Origin':e.url,'Content-Type':'application/octet-stream','X-Failure-Token':value['upload_token']})
        with urlopen(request) as r:self.assertEqual(r.status,201)
        path='/stats/failures/'+value['id']+'/sample'
        self.assertEqual(e.request(path)[0],401)
        with urlopen(Request(e.url+path,headers={'Authorization':admin.AUTH})) as r:
            self.assertEqual(r.read(),b'test');self.assertIn('attachment;',r.headers['Content-Disposition']);self.assertIn('.pcbdoc',r.headers['Content-Disposition']);self.assertIn('no-store',r.headers['Cache-Control'])
        code,report=e.request('/stats/failures?start=2000-01-01&end=2099-12-31',auth=True)
        self.assertEqual(code,200);self.assertEqual(report['total'],1)
        self.assertNotIn('token',report['items'][0]);self.assertNotIn('event',report['items'][0])
    def test_no_public_download_or_invalid_upload(self):
        self.assertEqual(self.env.request('/api/failures/'+('f'*32)+'/sample')[0],404)
        self.assertEqual(self.env.request('/api/failures/'+('f'*32)+'/sample',{})[0],415)
        self.assertEqual(self.env.request('/stats/failures?page=0',auth=True)[0],400)

if __name__=='__main__':unittest.main()
