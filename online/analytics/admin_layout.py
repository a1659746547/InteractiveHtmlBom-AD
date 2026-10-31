"""Arrange existing controls into four views without changing their IDs or data APIs."""
from html.parser import HTMLParser
from pathlib import Path

class Elements(HTMLParser):
    def __init__(self,text):
        super().__init__(convert_charrefs=False)
        self.text,self.nodes,self.stack=text,[],[]
        self.lines=[0]
        for line in text.splitlines(keepends=True):self.lines.append(self.lines[-1]+len(line))
        self.feed(text)
    def source_offset(self):
        line,col=self.getpos();return self.lines[line-1]+col
    def handle_starttag(self,tag,attrs):
        node={'tag':tag,'attrs':dict(attrs),'start':self.source_offset(),'end':None}
        self.nodes.append(node)
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(node)
        else:node['end']=self.source_offset()+len(self.get_starttag_text())
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if self.stack and self.stack[-1]['tag']==tag:self.stack.pop()['end']=self.source_offset()+len(self.get_starttag_text())
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i]['tag']==tag:
                node=self.stack[i];node['end']=self.source_offset()+len('</'+tag+'>');self.stack=self.stack[:i];break
    def find(self,tag=None,id=None,cls=None):
        return next(n for n in self.nodes if n['end'] is not None and (tag is None or n['tag']==tag) and (id is None or n['attrs'].get('id')==id) and (cls is None or cls in n['attrs'].get('class','').split()))
    def raw(self,**args):
        n=self.find(**args);return self.text[n['start']:n['end']]
    def enclosing(self,tag,id):
        child=self.find(id=id)
        node=next(n for n in self.nodes if n['tag']==tag and n['end'] is not None and n['start']<child['start'] and n['end']>child['end'])
        return self.text[node['start']:node['end']]

def render(page):
    root=Path(__file__).parent;dom=Elements(page)
    shell=dom.find(tag='main',cls='shell')
    html=(root/'admin.template.html').read_text(encoding='utf-8')
    pieces={'ACTIONS':dom.raw(tag='div',cls='actions'),'CONTROLS':dom.raw(tag='div',cls='controls'),'ERROR':dom.raw(id='error'),
        'USAGE':dom.raw(tag='section',cls='usage-panel'),'CARDS':dom.raw(tag='section',cls='cards'),'CHARTS':dom.raw(tag='section',cls='grid'),
        'DAILY':dom.raw(tag='section',cls='table-panel'),'VISITORS':dom.raw(id='visitor-panel'),'FAILURES':dom.raw(tag='section',id='failure-panel'),
        'CHAT':dom.raw(tag='section',cls='chat-admin'),'NOTICE':dom.raw(cls='notice'),'METHOD':dom.enclosing('details','share-note')}
    for key,value in pieces.items():html=html.replace('<!--'+key+'-->',value)
    page=page[:shell['start']]+html+page[shell['end']:]
    page=page.replace('下方使用记录由新版页面上报，和访问日志分别统计；不收集 PCB 内容。','使用计数与访问日志分别统计；使用计数不含 PCB 内容。失败原文件按页面告知暂存 1 小时。')
    page=page.replace('解析次数和活跃时长从新版页面上线后统计，旧日志无法补回；不收集 PCB 内容。','解析次数和活跃时长从新版页面上线后统计，旧日志无法补回；使用计数不含 PCB 内容。失败排查样本按用户开始解析时的告知暂存 1 小时。')
    page=page.replace('<title>访问统计 · PCB 装配助手</title>','<title>管理后台 · PCB 焊接助手</title>')
    page=page.replace('</style>',(root/'admin.css').read_text(encoding='utf-8')+'</style>',1)
    page=page.replace('</body>','<script>'+(root/'admin.js').read_text(encoding='utf-8')+'</script></body>')
    return page
