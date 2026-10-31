"""Loopback website and share preview; keeps runtime data outside public routes."""
import argparse
import importlib.util
import os
import sys
from pathlib import Path
from http.server import SimpleHTTPRequestHandler
from urllib.parse import urlsplit
import webbrowser

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8883)
    parser.add_argument('--no-browser', action='store_true')
    options = parser.parse_args()
    root = Path(__file__).resolve().parent
    local_data = Path(os.environ.get('PCB_LOCAL_DATA_DIR', str(root / '.local-data')))
    os.environ['SHARE_DATA_DIR'] = str(local_data / 'shares')
    os.environ['SHARE_ORIGIN'] = 'http://127.0.0.1:' + str(options.port)
    spec = importlib.util.spec_from_file_location('local_share', root / 'share_server.py')
    backend = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backend)
    chat_spec = importlib.util.spec_from_file_location('local_chat', root / 'chat_server.py')
    chat = importlib.util.module_from_spec(chat_spec)
    chat_spec.loader.exec_module(chat)
    chat_state = chat.ChatState(local_data / 'chat', os.environ['SHARE_ORIGIN'])
    sys.path.insert(0, str(root/'analytics'))
    stats_spec = importlib.util.spec_from_file_location('local_stats', root/'analytics/analytics_server.py')
    stats = importlib.util.module_from_spec(stats_spec)
    stats_spec.loader.exec_module(stats)
    stats.USAGE = stats.UsageStore(local_data/'usage')
    stats.failure_http.STORE = stats.failure_http.FailureStore(local_data/'failures')
    stats.failure_http.start_cleanup()
    public = {'/', '/index.html', '/gerber.html', '/favicon.svg', '/favicon.ico', '/THIRD-PARTY-NOTICES.txt'}
    class Preview(backend.Handler, SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)
        def do_GET(self):
            path = urlsplit(self.path).path
            if path.startswith('/api/chat/'):
                return chat_state.handle(self)
            if path.startswith('/api/shares'):
                return backend.Handler.do_GET(self)
            if path not in public:
                return self.send_error(404)
            return SimpleHTTPRequestHandler.do_GET(self)
        def do_POST(self):
            if urlsplit(self.path).path.startswith('/api/failures'):
                return stats.Handler.capture_failure(self, urlsplit(self.path).path, stats.ADMIN_ORIGIN)
            if urlsplit(self.path).path == '/api/usage':
                return stats.Handler.capture_usage(self)
            if urlsplit(self.path).path.startswith('/api/chat/'):
                return chat_state.handle(self)
            return backend.Handler.do_POST(self)
        def send(self, *args, **kwargs):
            return stats.Handler.send(self, *args, **kwargs)
        def do_HEAD(self):
            if urlsplit(self.path).path not in public:
                return self.send_error(404)
            return SimpleHTTPRequestHandler.do_HEAD(self)
    try:
        server = backend.ThreadingHTTPServer(('127.0.0.1', options.port), Preview)
    except OSError as error:
        raise SystemExit(str(error) + '\nTry: python start_local.py --port 8884')
    url = 'http://127.0.0.1:' + str(server.server_port)
    backend.ORIGIN = url
    chat_state.origin = url
    stats.ADMIN_ORIGIN = url
    print(url, flush=True)
    print('Local preview. Ctrl+C to stop. Share links work only on this computer.', flush=True)
    if not options.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
