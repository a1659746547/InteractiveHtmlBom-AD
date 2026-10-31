# 聊天室开关

在现有 `/stats/` 后台的「聊天室管理」中开启／关闭，沿用原有独立管理员账号。状态由聊天服务保存到自己的 SQLite settings 表，重启保留，首次安装默认开启。

关闭后服务端拒绝加入、文字、进度、头像和完成播报；撤回在线用户与实时公开字段，保留历史消息。新版前端隐藏入口并收起已打开面板；打开中的聊天室通常在下一次轮询（约 2 秒）获知，未打开面板的解析页最多约 15 秒刷新状态，后台休眠页在唤醒后检查。重新开启后需主动重新加入，公开范围恢复关闭，未发送文字保留且不自动发送。首页仍不显示聊天室。

后台 GET／POST `/stats/chat-settings` 均先验证原有 Basic 管理员身份；POST 还要求精确本站 Origin、application/json、严格的 boolean enabled 和不超过 1 KB 的请求。读取失败显示「状态不可用」并禁用开关，避免误报已关闭。

统计服务通过固定的 `http://127.0.0.1:8770/_internal/chat/settings` 控制聊天服务。该路径必须只在回环访问，且请求头含 `X-PCB-Chat-Control: stats-v1`；它不是公开 `/api/chat/` 的一部分。标记头不是密码，权限边界是现有后台认证、回环监听和 Nginx 仅代理 `/api/chat/`。不要新增将 `/_internal/` 转发到聊天服务的公网路由。统计服务不直接读取或修改聊天数据库，不需要新增文件写权限。

上线需要一起更新 index.html、chat_server.py、analytics_server.py、server-index.html，并重启 pcb-chat 与 pcb-stats。沿用现有 systemd／Nginx 配置，无需改管理员密码／SMTP／分享数据库。先核实线上统计服务与当前源码一致，备份后再更新，不能使用历史统计部署脚本覆盖私有配置。
