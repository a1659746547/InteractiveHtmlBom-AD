from pathlib import Path
import sys,tempfile,unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'analytics'))
from usage_store import UsageStore, UsageError

class UsageTests(unittest.TestCase):
    def setUp(self):self.temp=tempfile.TemporaryDirectory();self.store=UsageStore(self.temp.name);self.sid='a'*32;self.now=1792468800
    def tearDown(self):self.temp.cleanup()
    def record(self,seq,active=0,parses=0,offset=0,ip='192.0.2.1',sid=None):self.store.record({'session':sid or self.sid,'seq':seq,'active_ms':active,'parses':parses},ip,self.now+offset)
    def report(self,offset=0):return self.store.report('2026-01-01','2027-01-01',self.now+offset)
    def test_idempotence_out_of_order_and_persistence(self):
        self.record(1);self.record(2,15000,1,15);self.record(2,15000,1,16);self.record(1,0,0,17)
        r=self.report(17);self.assertEqual((r['parses'],r['active_ms'],r['used_ips'],r['active_ips']),(1,15000,1,1))
        restored=UsageStore(self.temp.name).report('2026-01-01','2027-01-01',self.now+17);self.assertEqual(restored,r)
    def test_bounded_time_and_activity_expiry(self):
        self.record(1);self.record(2,900000,10000,1)
        r=self.report(1);self.assertEqual(r['active_ms'],3000);self.assertEqual(r['parses'],20)
        self.assertEqual(self.report(47)['active_ips'],0)
        self.record(3,900000,10000,60);self.assertEqual(self.report(61)['active_ips'],0)
    def test_strict_schema_and_no_file_fields(self):
        good={'session':self.sid,'seq':1,'active_ms':0,'parses':0}
        for bad in [{**good,'filename':'private.PcbDoc'},{**good,'active_ms':True},{**good,'parses':-1},{**good,'seq':'1'},{**good,'session':'bad'},[],{}]:
            with self.assertRaises(UsageError):self.store.record(bad,'192.0.2.1',self.now)
        self.record(1,100,1)
        with self.assertRaises(UsageError):self.record(2,0,0,10)
        with self.assertRaises(UsageError):self.store.record(good,'invalid',self.now)
    def test_ip_aggregation_ranges_and_no_parse_visit(self):
        self.record(1);self.record(2,1000,0,1);self.record(1,1000,2,2,sid='b'*32)
        r=self.report(3);self.assertEqual(len(r['items']),1);self.assertEqual(r['items'][0]['sessions'],2);self.assertEqual(r['used_ips'],1)
        self.assertEqual(self.store.report('2020-01-01','2020-01-02',self.now)['items'],[])
        self.record(1,0,0,3,ip='198.51.100.5',sid='c'*32)
        r=self.report(4);self.assertEqual(r['used_ips'],1);self.assertEqual(len(r['items']),2)
    def test_retention_drops_old_sessions(self):
        self.record(1,1000,1)
        self.record(1,0,0,91*86400,sid='d'*32)
        with self.store.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM sessions').fetchone()[0],1)

if __name__=='__main__':unittest.main(verbosity=2)
