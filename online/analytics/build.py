from pathlib import Path
import sys

root = Path(__file__).resolve().parent
page = (root / 'index.template.html').read_text(encoding='utf-8')
for marker, name in [('STYLE', 'styles.css'), ('CORE', 'analytics-core.js'), ('APP', 'app.js')]:
    page = page.replace('/*' + marker + '*/', (root / name).read_text(encoding='utf-8'))
snapshot = (root / 'initial-data.example.json').read_text(encoding='utf-8')
page = page.replace('/*DATA*/', snapshot.replace('<', '\\u003c'))
if '--server' in sys.argv:
    page = page.replace('<section class="grid">', (root/'failure-admin.html').read_text(encoding='utf-8') + '<section class="grid">',1)
    page = page.replace('</body>', '<script>'+(root/'failure-admin.js').read_text(encoding='utf-8')+'</script></body>')
    page = page.replace('</style>', (root / 'usage-admin.css').read_text(encoding='utf-8') + '</style>', 1)
    page = page.replace('<section class="grid">', (root / 'usage-admin.html').read_text(encoding='utf-8') + '<section class="grid">', 1)
    page = page.replace('</body>', '<script>'+(root / 'usage-admin.js').read_text(encoding='utf-8')+'</script></body>')
    page = page.replace('</style>', (root / 'chat-admin.css').read_text(encoding='utf-8') + '</style>', 1)
    page = page.replace('<div class="controls">', (root / 'chat-admin.html').read_text(encoding='utf-8') + '<div class="controls">', 1)
    page = page.replace('</body>', '<script>'+(root / 'chat-admin.js').read_text(encoding='utf-8')+'</script></body>')
    page = page.replace('</style>', (root / 'visitor.css').read_text(encoding='utf-8') + '</style>', 1)
    page = page.replace('<body>', '<body data-live="true">').replace('本地预览', '管理页面')
    page = page.replace('<button class="primary" id="import">导入数据</button>', '<button class="primary" id="refresh">刷新数据</button><button id="import" hidden>导入数据</button>')
    begin, finish = page.index('<details>'), page.index('</details>') + len('</details>')
    page = page[:begin] + '''<details><summary>统计口径与更新方式</summary><p>服务器每 30 秒重新读取日志，页面每 60 秒更新，可点击「刷新数据」立即获取。日期筛选由服务器计算跨日去重 IP。IP 明细仅限登录后台查看，汇总导出仍不含 IP。</p><p>主页访问统计 GET / 或 /index.html 返回 200 / 304。根据爬虫标识、探测路径和测试出口过滤机器流量；过滤结果不等于确认的真实用户。服务器 IP 直访也可能计入，现有日志无法区分请求 Host。</p><p>估算地区由服务器本地 ip2region 地址库解析，不向第三方发送访客 IP。地区代表网络出口的大致位置，使用代理或 VPN 时可能不准确。共享出口的多个用户可能使用同一个 IP。</p><p>分享接口没有历史访问记录；本站 PCB 导入、解析和导出操作尚未统计。</p><p id="share-note"></p><input id="exclude" hidden></details>''' + page[finish:]
    visitors = '''<section class="panel table-panel" id="visitor-panel"><div class="panel-head"><div><h2>IP 访问明细</h2><div class="small">估算地区 · 明细包含所选日期内的全部请求，主页筛选沿用上方过滤开关</div></div><span class="pill">仅管理员可见</span></div><div class="visitor-controls"><input id="visitor-search" placeholder="搜索 IP、地区或运营商" maxlength="64" aria-label="搜索 IP、地区或运营商"><select id="visitor-scope" aria-label="访问来源"><option value="all">全部来源</option><option value="home">主页访问</option><option value="machine">疑似机器流量</option><option value="test">已排除测试出口</option></select><select id="visitor-sort" aria-label="明细排序"><option value="recent">最近访问优先</option><option value="requests">请求次数优先</option></select><span class="small" id="geo-status"></span></div><div id="visitor-error" class="error" role="alert" hidden></div><div class="table-wrap"><table class="visitor-table"><thead><tr><th>IP 地址</th><th>估算地区 / 运营商</th><th>全部请求</th><th>成功获取主页</th><th>最近访问（北京时间）</th><th>来源标记</th></tr></thead><tbody id="visitor-body"></tbody></table></div><div class="pagination"><span class="small" id="visitor-total">正在读取…</span><div><button id="visitor-prev">上一页</button><span id="visitor-page" class="small"></span><button id="visitor-next">下一页</button></div></div></section>'''
    page = page.replace('<div class="notice">', visitors + '<div class="notice">')
    page = page.replace('<th>来源标记</th>', '<th>成功解析</th><th>使用状态</th><th>活跃时长（估算）</th><th>最近解析</th><th>来源标记</th>')
    page = page.replace('本站 PCB 导入、解析和导出操作尚未统计。', '解析次数和活跃时长从新版页面上线后统计，旧日志无法补回；不收集 PCB 内容。')
    page = page.replace('当前日志无法统计 PCB 导入、解析或导出操作。', '下方使用记录由新版页面上报，和访问日志分别统计；不收集 PCB 内容。')
    page = page.replace('本地数据视图 · 尚未接入实时统计或后台登录', '独立账号登录 · 自动更新 · 本地地区解析')
    output = root / 'server-index.html'
else:
    output = root / 'index.html'
if '--server' in sys.argv:
    from admin_layout import render
    page = render(page)
output.write_text(page, encoding='utf-8')
print('Built', output)
