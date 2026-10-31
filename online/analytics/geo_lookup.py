"""Offline IP-region lookup; never sends visitor addresses to an external API."""
from datetime import datetime, timezone, timedelta
from functools import lru_cache
import ipaddress
from pathlib import Path
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parent / 'vendor'))
import ip2region.searcher as xdb
import ip2region.util as util


class GeoLookup:
    def __init__(self, directory=None):
        self.directory = Path(directory or Path(__file__).resolve().parent / 'vendor')
        self.lock = threading.Lock()
        self.searchers = {}
        self.metadata = {'source': 'ip2region 离线地址库', 'ipv4': False, 'ipv6': False, 'dates': {}}
        for version in (4, 6):
            path = self.directory / f'ip2region_v{version}.xdb'
            try:
                util.verify_from_file(str(path))
                header = util.load_header_from_file(str(path))
                if header.ipVersion != version:
                    raise ValueError('Database IP version mismatch')
                vector = util.load_vector_index_from_file(str(path))
                self.searchers[version] = xdb.new_with_vector_index(util.IPv4 if version == 4 else util.IPv6, str(path), vector)
                self.metadata[f'ipv{version}'] = True
                self.metadata['dates'][f'ipv{version}'] = datetime.fromtimestamp(header.createdAt,timezone(timedelta(hours=8))).date().isoformat()
            except (OSError, ValueError, IndexError):
                continue

    @lru_cache(maxsize=20000)
    def lookup(self, address):
        result = {'country': '', 'province': '', 'city': '', 'isp': '', 'region': '未识别'}
        try:
            ip = ipaddress.ip_address(address)
            if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
                ip = ip.ipv4_mapped
            if not ip.is_global:
                return {**result, 'region': '局域网 / 保留地址'}
            searcher = self.searchers.get(ip.version)
            if searcher is None:
                return {**result, 'region': '地址库未就绪'}
            with self.lock:
                region = searcher.search(str(ip))
            fields = region.split('|')
            for key, field in zip(('country', 'province', 'city', 'isp'), fields):
                result[key] = '' if field in ('', '0', '-') else field
            result['region'] = ' · '.join(result[k] for k in ('country', 'province', 'city') if result[k]) or '未识别'
        except (ValueError, OSError, IndexError, UnicodeError):
            pass
        return result

    def close(self):
        for searcher in self.searchers.values():
            searcher.close()
