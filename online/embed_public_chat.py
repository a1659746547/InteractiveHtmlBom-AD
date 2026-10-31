"""Embed edited chat sources into the current HTML without rebuilding PCB parsers."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent
page = root / 'index.html'
html = page.read_bytes().decode('utf-8')
start, end = '<!-- PUBLIC_CHAT_START -->', '<!-- PUBLIC_CHAT_END -->'
block = start+'\n<style id="public-chat-style">'+(root/'public-chat.css').read_text(encoding='utf-8')+'</style>\n<script id="public-chat-avatars">'+(root/'chat-avatars.js').read_text(encoding='utf-8')+'</script>\n<script id="public-chat-script">'+(root/'public-chat.js').read_text(encoding='utf-8')+'</script>\n'+end
if start in html:
    assert html.count(start) == html.count(end) == 1
    a, b = html.index(start), html.index(end)+len(end)
    html = html[:a]+block+html[b:]
else:
    html += '\n'+block+'\n'
page.write_bytes(html.encode('utf-8'))
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest_path = root/'release-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
files = ['index.html', 'chat_server.py', 'public-chat.js', 'public-chat.css', 'chat-avatars.js', 'start_local.py',
         'pcb-chat.service', 'chat-nginx.conf', 'embed_public_chat.py', 'PUBLIC-CHAT.md']
for name in files:
    manifest[name] = {'bytes': (root/name).stat().st_size, 'sha256': digest(root/name)}
for feature in ['public_user_chat', 'optional_live_assembly_disclosure', 'independent_board_name_and_reference_disclosure', 'optional_component_model_disclosure', 'opt_in_component_completion_ticker', 'chat_message_first_layout']:
    if feature not in manifest['features']:
        manifest['features'].append(feature)
manifest['status'] = 'LOCAL_REVIEW_ONLY_NOT_DEPLOYED'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
glass_path = root/'glass-manifest.json'
glass = json.loads(glass_path.read_text(encoding='utf-8'))
glass['index.html'] = digest(page)
if 'public_user_chat' not in glass['script_changes']:
    glass['script_changes'].append('public_user_chat')
glass_path.write_text(json.dumps(glass, ensure_ascii=False, indent=2), encoding='utf-8')
checks_path = root/'package-checksums.json'
checks = json.loads(checks_path.read_text(encoding='utf-8'))
for name in files:
    checks[name] = digest(root/name)
checks = {name: digest(root/name) for name in checks}
checks_path.write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding='utf-8')
print('CHAT_EMBEDDED', digest(page), 'FILES', len(checks))
