"""Refresh the host-only diagnostic script without rebuilding parsers."""
from pathlib import Path
root=Path(__file__).resolve().parent
p=root/'index.html';s=p.read_text(encoding='utf-8')
start='<script id="failure-capture-script">';end='</script>'
a=s.index(start)+len(start);b=s.index(end,a)
s=s[:a]+(root/'failure-capture.js').read_text(encoding='utf-8')+s[b:]
p.write_bytes(s.encode('utf-8'))
