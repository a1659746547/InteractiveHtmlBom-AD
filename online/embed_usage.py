"""Embed anonymous counters without rebuilding any PCB or Gerber parser."""
from pathlib import Path
root=Path(__file__).resolve().parent
page=root/'index.html'
html=page.read_text(encoding='utf-8')
start,end='<!-- USAGE_CAPTURE_START -->','<!-- USAGE_CAPTURE_END -->'
block=start+'\n<script id="usage-capture-script">'+(root/'usage-capture.js').read_text(encoding='utf-8')+'</script>\n'+end
if start in html:
    assert html.count(start)==html.count(end)==1
    html=html[:html.index(start)]+block+html[html.index(end)+len(end):]
else:
    html+='\n'+block+'\n'
page.write_bytes(html.encode('utf-8'))
