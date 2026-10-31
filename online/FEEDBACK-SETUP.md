# 网站反馈服务

反馈后端为 `feedback_server.py`，默认只监听 `127.0.0.1:8769`。本地预览不会发送邮件。

自部署步骤：

1. 把后端代码放到 `/opt/pcb-feedback/`，在该目录建立 Python 虚拟环境并安装 `feedback-requirements.txt`。
2. 将 `feedback.env.example` 复制到网站根目录以外的 `/etc/pcb-feedback.env`，配置自己的 SMTP 发件账号、授权码和站点 Origin；文件设为 root 所有、权限 0600。
3. 核对并修改源码的固定收件人 `RECIPIENT`。当前默认收件人为本项目反馈邮箱；自部署者应改成自己的邮箱。
4. 安装并核对 `pcb-feedback.service`，确保 `www` 用户与虚拟环境路径存在；合并 `feedback-nginx.conf`，检查 Nginx 配置后启动服务。
5. `GET /api/feedback` 返回 `ready: true` 仅代表读取了配置。实际提交一条明确标记的测试反馈并核对收件箱，才能确认邮件送达。

SMTP 授权码只在服务器配置，不要写入网页、Git 仓库或公开网站目录。服务使用 TLS，不需要开放 8769 公网端口；完整服务路径见 [部署说明](DEPLOYMENT.md)。

## 反馈范围

表单收集类型、5～3000 字反馈内容及选填联系方式，最多 3 张静态 JPG/PNG/WebP，每张 5 MB、2000 万像素以内。服务端核验实际图片格式并重新编码去除元数据。固定收件人为 `tnanastar@163.com`，请求无法修改收件人。不会附带 PCB 文件、解析数据、文件名、浏览器信息或分享链接。

本地 localhost、127.0.0.1、直接打开 HTML 均为预览模式，点击提交显示反馈未发送，不调用邮件服务。正式 HTTPS 网站调用同源 `POST /api/feedback`；仅 SMTP 接受且无收件拒绝时显示发送成功。发送失败保留表单内容。

TLS 校验开启，固定收件人和主题；每来源每小时 3 条，全站每小时 50 条，最多 2 个并发处理，请求最大 21 MB。限流只保留内存中的来源散列，重启后重置。不记录反馈正文、联系方式或 SMTP 配置，不连接 POP3/IMAP，不读取邮箱。
