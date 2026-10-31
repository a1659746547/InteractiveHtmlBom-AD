# 在线版源码

**[在线体验](https://pcb.kn21.xyz/)** · [GitHub 仓库](https://github.com/a1659746547/InteractiveHtmlBom-AD) · [部署说明](DEPLOYMENT.md)

## 预览与编辑

在仓库根目录运行 `python online/start_local.py`，或 Windows 下双击本目录的 `start-local.cmd`。

- `index.html`：可直接运行的 PCB 入口，内嵌解析器与装配查看器。
- `gerber.html`：可直接运行的 Gerber 工作区。
- `src/index.template.html`、`src/index/*.js`：当前首页结构和按功能拆分的源脚本。
- `src/gerber.template.html`、`src/gerber/*.js`：Gerber 页面结构和源脚本。
- `build.py`：从这些文件重新构建成品；`--check` 检查源码与成品是否一致。

模板里的 `/* SOURCE:... */` 由构建器替换，不要修改成其他占位符。部分脚本内嵌完整查看器或 SQLite 运行时，因此文件较大。`gerber/05-third-party-comment.js` 是原页面用于展示许可的文本块，按原 HTML 标签类型嵌入，不作为 JavaScript 执行。

`public-chat.js`、`usage-capture.js` 等根目录文件保留作历史单功能嵌入器输入。当前主站开发以 `src/` 和 `build.py` 为准；不要使用旧嵌入器覆盖当前页面。

## 本地与生产的边界

本地预览只监听回环地址；分享、聊天、统计和失败记录使用 `online/.local-data/` 下的独立数据。本地反馈不发送邮件。生产邮件需安装 `feedback-requirements.txt` 并配置自己的 SMTP 账号；`feedback.env.example` 不包含密码。

源码不包含用户 PCB、失败样本、分享数据库、聊天记录、访问日志、生产账号或私钥。后端源码来自 2026-10-21 完整包，部署到已有服务前请比较实际版本。

IP 地区查询绑定与许可保留在 `analytics/vendor/`。较大的公开 XDB 数据文件不随 Git 分发，按该目录 `manifest.json` 中的固定版本和 SHA-256 获取；缺少数据库时地区查询退化为“地址库未加载”，核心 PCB 功能不受影响。

## 测试

```sh
python online/build.py --check
python -m unittest discover -s online/tests -p "test_*.py"
```

测试使用合成数据和临时目录。不要把生产配置或用户文件复制到测试目录。
