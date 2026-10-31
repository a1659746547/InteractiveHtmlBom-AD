# 服务器部署与迁移

当前成品已用于 https://pcb.kn21.xyz/。本包不含生产登录／SMTP 配置和运行数据库，迁移需由站点管理员在服务器单独准备。不要把整个源码目录作为可公开下载的网站根目录。

| 服务 | 应放置的代码／文件 | 回环端口 | 私有配置／运行数据 |
|---|---|---|---|
| 主站 | 网站根目录仅放 index.html、gerber.html、favicon.svg、favicon.ico、THIRD-PARTY-NOTICES.txt | Nginx HTTPS | 无 |
| 分享 | /opt/pcb-shares/share_server.py | 8767 | /var/lib/pcb-shares |
| 统计／管理／失败样本 | analytics/ 的 Python 模块、server-index.html、vendor/ 放 /opt/pcb-stats | 8768 | /etc/pcb-stats/config.json；/var/lib/pcb-stats |
| 邮件反馈 | /opt/pcb-feedback/feedback_server.py 及 requirements 依赖 | 8769 | /etc/pcb-feedback.env |
| 聊天 | /opt/pcb-chat/chat_server.py | 8770 | /var/lib/pcb-chat |

统计服务必须同时包含 analytics_server.py、geo_lookup.py、usage_store.py、failure_store.py、failure_http.py、server-index.html 和完整 vendor/。仅更新 HTML 无法为新服务器创建这些后端。

## systemd 与权限

服务模板 pcb-shares.service、pcb-feedback.service、pcb-chat.service 在根目录；统计模板及 pcb-failure-cleanup.service／timer 在 analytics/。模板按现有 www 用户、上述目录和端口编写；在不同发行版上核对用户名、Python 绝对路径与环境变量。状态目录归服务用户，私有配置和样本不得公开读取。代码可读但不可由公网写入。

务必启用 pcb-failure-cleanup.timer，确保统计服务停止时仍清理已接收样本。样本目录 /var/lib/pcb-stats/failures/samples 需排除外部备份；到期 3600 秒后立即不可下载，物理清扫由进程内 15 秒及独立 timer 每 30 秒执行。管理员本机下载副本需自行删除。

## 认证与域名

统计配置由管理员自行生成，字段包括 username、salt（随机 16 字节十六进制）、password_hash（PBKDF2-HMAC-SHA256，200000 次）、log_directory（现有 Nginx 日志目录），可选 shares_db／excluded_ips。不要使用测试账号配置生产，也不要通过源码或网页公开配置文件。服务读取 PCB_STATS_CONFIG 指定路径，默认 /etc/pcb-stats/config.json。

更换域名时同时核对分享、反馈、聊天和统计的 Origin；统计默认 https://pcb.kn21.xyz，可用 PCB_STATS_ORIGIN 配置。前端 API 均为本站相对路径；主站与后台应使用同一 HTTPS 域名。反馈邮箱配置见 FEEDBACK-SETUP.md，只在服务器输入授权码。

## Nginx 路由

保留既有 HTTPS／证书设置，合并 chat-nginx.conf、feedback-nginx.conf、analytics/failure-nginx.conf 的对应片段。分享代理转发 /api/shares 前缀到 8767；/stats/ 前缀转发到 8768；精确 /api/usage 以 2k 上限转发到 8768。各代理覆盖 X-Real-IP 为 $remote_addr，避免接受客户端伪造 IP。使用计数与失败上传端点关闭 access_log，避免心跳误算访问和记录样本令牌。

失败样本上传片段禁用 proxy_request_buffering 并限制 50m，避免 Nginx 暂存额外原文件；普通失败元数据限制 2k。不要把聊天内部 /_internal/chat/settings 路径公开代理；后台通过服务本机回环调用该路径。分享／反馈的请求体上限沿用对应模板，勿用样本上传上限覆盖所有接口。

在修改实际配置前备份代码、私有配置及原数据库（失败样本除外）。先部署后端与权限并检查服务，nginx -t 通过后再重载，最后发布网页；验证主站、后台登录、聊天室状态及清理 timer。后端模块更新需重启对应服务，单独更新后台 HTML 不需要重启。

## 旧发布脚本

旧发布包中的 deploy.py、deploy_stats.py、deploy_ip_details.py 等脚本没有随本次源码分发。它们有旧基线／旧目录／配置假设，不能直接在新服务器执行或覆盖现有私有配置。本包没有一条命令创建生产账号、TLS、日志及全部服务的全自动安装器。

仅更新现有站点后台 UI 时，当前实际文件为 /opt/pcb-stats/server-index.html；主站为网站根目录的 index.html。完整重建请使用上述服务清单，保留现有数据和密钥。
