# PCB 焊接助手 · InteractiveHtmlBom-AD

从 PCB 设计文件打开交互式 BOM，定位元件、记录焊接进度，也可以查看 Gerber 生产图层。

**[在线使用 PCB 焊接助手](https://pcb.kn21.xyz/)** · [本地预览与部署](online/README.md) · [AD 脚本导出](docs/altium-exporter.md) · [问题与建议](https://github.com/a1659746547/InteractiveHtmlBom-AD/issues)

本项目从 Altium Designer 脚本导出工具发展而来。仓库现在同时提供当前在线版源码，以及原来的 AD 脚本版本。仓库名保持不变，原脚本安装入口继续保留。

## 选择使用方式

| 方式 | 适合的场景 | 入口 |
| --- | --- | --- |
| 在线版 | 直接打开 PCB 或 Gerber，无需安装 EDA 软件 | [pcb.kn21.xyz](https://pcb.kn21.xyz/) |
| 本地运行 | 在自己的电脑预览，或部署到自己的服务器 | [`online/`](online/) |
| AD 脚本 | 在 Altium Designer 内导出交互式 HTML BOM | [`InteractiveHtmlBom.PrjScr`](InteractiveHtmlBom.PrjScr) 和 [使用说明](docs/altium-exporter.md) |

## 在线版功能

- 查看、搜索和导出 BOM，点选元件并在板图定位，切换正面、背面和双面。
- 勾选装配状态，记录焊接进度，定位上一个或下一个未完成元件。
- 导出 Excel / CSV BOM，以及携带当前进度的独立 HTML。
- 读取 ZIP 和多板工程；Gerber 支持图层显示、叠加、测量及同层图形连通高亮。
- 分享直链可选 1 小时、3 天、7 天、30 天有效期，并可设置访问密码。
- 手机、平板和桌面布局，多语言、主题与夜间模式，支持图片反馈。
- 可选后端提供分享、邮件反馈、公共聊天室、统计与失败排查管理。

### 格式支持

| 软件 / 格式 | 文件 | 能力与边界 |
| --- | --- | --- |
| Altium Designer | `.PcbDoc` | BOM 与二维装配查看 |
| KiCad | `.kicad_pcb` | BOM 与二维装配查看 |
| 立创 EDA 标准版 | PCB `.json` | PCB 源工程，非原理图 JSON |
| 立创 EDA 专业版 | `.eprj2` / `.epro` / `.epro2` | 读取完整工程，支持选择 PCB |
| PADS Layout ASCII | `.asc` | ASCII 装配预览；二进制 `.pcb` 暂不支持 |
| Gerber / Excellon | `.gbr` / `.gtl` / `.gbl` / `.drl` 等 | 生产图层查看，不含 BOM 或原始元件型号 |
| 普通 ZIP | `.zip` | 读取包含的支持格式；加密 ZIP、RAR、7z 暂不支持 |

用于焊接与装配预览。3D、部分铜皮、内层铜和特殊焊盘存在限制，请以原始设计为准。同层图形连通高亮不等同于恢复完整跨层电气网络。

## 本地预览

需要 Python 3.10 或更新版本，无需 npm：

```sh
git clone https://github.com/a1659746547/InteractiveHtmlBom-AD.git
cd InteractiveHtmlBom-AD
python online/start_local.py
```

打开 `http://127.0.0.1:8883/`。本地运行数据保存在 `online/.local-data/`，不会连接生产数据库。本地反馈预览不发送邮件。

页面已经构建好，日常预览可直接运行。修改前端后重新构建：

```sh
python online/build.py
python online/build.py --check
python -m unittest discover -s online/tests -p "test_*.py"
```

服务器部署见 [`online/DEPLOYMENT.md`](online/DEPLOYMENT.md)。不要把整个仓库作为公开网站根目录。

## 文件与隐私

常规解析在浏览器本地进行。生成分享链接时，会把设计数据和进度保存到分享服务；设置密码后需同时提供密码。失败排查功能在符合规则时可能上传失败的原文件，详细规则见 [数据处理说明](online/PRIVACY.md)。

聊天室的公开信息由用户选择；网站统计、失败排查和邮件服务各有独立配置。自部署时请根据自己的数据处理方式调整页面说明，不要把“本地解析”理解为所有功能都不联网。

## 代码结构

```text
online/                    当前在线版：网页、后端、配置模板与测试
  src/index/               PCB 导入、分享、反馈、主题、聊天、统计等脚本
  src/gerber/              Gerber 解析、工作区与显示脚本
  src/*.template.html      页面结构与样式模板
  analytics/               管理后台、统计和失败排查
  tests/                   使用临时数据的后端隔离测试
  build.py                 可重复构建当前网页
docs/                      AD 脚本说明、开源来源与许可说明
core/ ecad/ dist/ web/      原有 AD 脚本与导出查看器资源
Initialize.bat             原 AD 脚本初始化入口
InteractiveHtmlBom.PrjScr   原 AD 脚本工程
```

当前网页以 2026-10-31 核对的线上内容为基础；后端源码来自 2026-10-21 完整包，未宣称与生产服务器所有后端文件逐字节一致。来源见 [`online/SOURCE-PROVENANCE.json`](online/SOURCE-PROVENANCE.json)。微信小程序和鸿蒙应用不在本次网站开源范围内。

## 参考与许可

感谢 [InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)、[InteractiveHtmlBomForAD](https://github.com/lianlian33/InteractiveHtmlBomForAD) 及相关开源依赖。

本仓库新增原创代码采用 MIT 许可；第三方代码、字体和数据按各自原许可保留。请同时阅读 [LICENSE](LICENSE)、[第三方说明](docs/THIRD-PARTY.md) 和 [`online/THIRD-PARTY-NOTICES.txt`](online/THIRD-PARTY-NOTICES.txt)。

---

**English:** PCB Soldering Assistant is a browser-based interactive BOM and PCB assembly viewer, with Gerber inspection tools. Use the [live website](https://pcb.kn21.xyz/), run [`online/`](online/) locally, or keep using the original [Altium Designer script exporter](docs/altium-exporter.md). Format limitations, data handling and deployment instructions are documented above.
