# InteractiveHtmlBom-AD

[中文](README.zh-CN.md) | [English](README.en.md)

`InteractiveHtmlBom-AD` 是一个面向 Altium Designer 脚本环境的
`InteractiveHtmlBom` 改进版。项目保留了交互式 HTML BOM 的核心体验，并把
导出流程适配到了 AD 脚本环境中，方便直接从 PCB 文档生成可交互的装配页面。

## 兼容性

- Altium Designer：已在 AD10 与 AD24 实测可用。
- 脚本入口：`startWin()` 用于界面模式，`main()` 用于无界面直接导出。

## 特性亮点

- 支持 Altium Designer 脚本工作流，已在 AD10 与 AD24 验证。
- 同时提供 GUI 模式与脚本直接导出模式。
- 可导出用于装配与检视的交互式 HTML BOM。
- 内置 JSON、TXT BOM 和 CSV PnP 等辅助导出能力。
- 支持正反面视图、深色模式以及多种显示选项。
- 增加 `Mechanical1` 与 `Keep Out Layer` 之间的板框层自动判断。
- 常见提示信息支持多语言显示。

## 项目结构

- `core/`：配置、BOM 生成与输出拼装。
- `ecad/`：Altium PCB 解析逻辑。
- `dist/`：分发用脚本入口与 GUI 代码。
- `web/`：生成 HTML 页面所需的前端资源。
- `tools/`：JSON / TXT / PnP CSV 等辅助导出工具。
- `Initialize.bat`：将脚本拼接为可分发入口文件。

## 安装方法

1. 在项目根目录运行一次 `Initialize.bat`。
2. 在 Altium Designer 中打开 `InteractiveHtmlBom.PrjScr`。
3. 打开一个 `PcbDoc`，再打开 `Run Script...`。
4. 运行 `startWin()` 启动界面，或运行 `main()` 直接导出。

## 使用方式

打开 GUI 后，你可以：

- 选择输出 HTML 路径。
- 配置空值、单焊盘、通孔器件等过滤规则。
- 选择板框来源层。
- 切换焊盘、丝印、制造层、深色模式等显示选项。
- 生成 HTML BOM 并打开输出目录。

生成文件通常会输出到当前 PCB 文档附近的 `PnPout` 目录中。

## 本次新增功能

- 启动方式优化：推荐先运行 `startWin()` 打开 GUI，再点击 Generate 生成 HTML；同时保留 `main()` 直接导出模式。
- 工程入口简化：脚本工程文件改为 `InteractiveHtmlBom.PrjScr`，名称更短、更直观。
- 初始化自检：打开 GUI 或点击 Generate 时会检查脚本是否已初始化，未初始化时会提示先运行 `Initialize.bat`。
- 板框层智能预判：自动在 `Mechanical1` 与 `Keep Out Layer` 之间做板框层猜测，减少板框识别错误。
- 前端多语言：HTML 页面支持 `中文 / English / 日本語 / 한국어`。
- 语言搜索：语言下拉框加入搜索框，语言较多时更容易定位。
- 页面翻译补齐：菜单、导出、筛选、元数据、弹窗等常用文案已补齐本地化。
- 多主题系统：新增 `Light / Dark / Apple / Blue Gray / Eye Care Green` 主题切换。
- Apple 风界面：增加 Apple 风整体主题，并支持跟随系统深色模式切换。
- Apple 风表格：对 BOM 表格做 Apple 风样式优化，表头、圆角、悬停和高亮表现更统一。
- 深色主题可见性修复：修正深色模式下按钮和图标发灰、只有悬停时才清晰的问题。
- 菜单布局优化：顶部选项区改成更紧凑的双列布局，常用开关更容易查看和操作。
- 字体与中英混排优化：统一页面字体栈，改善中文和英文混排时的观感与一致性。
- 语言选择器优化：缩小语言区域尺寸，不再显得过大，同时保留可读性。
- 启动动画：打开导出的 HTML 时显示轻量启动动画，增强页面打开时的仪式感。
- 右键拖动画布：PCB 画布除左键/中键外，右键也可以拖动平移；右键单击仍可快速复位视图。
- 脚本提示本地化：常见脚本报错已支持按 AD 本地资源设置自动切换提示语言，并对中文环境做了更友好的错误提示。
- 文档不是 PCB 时的提示优化：例如 `Current document is not a PCB document` 已改为更清晰、更适合中文用户理解的提示。
- 页面信息简化：移除了 HTML 页面里的版本显示行，使信息区更干净。

## 额外导出工具

除了 HTML BOM 生成之外，脚本还提供以下辅助导出：

- `exportJSON()`：将解析后的 PCB 与器件数据导出为 JSON。
- `exportBOM()`：将 BOM 导出为制表符分隔的 TXT。
- `exportPnP()`：将贴片坐标数据导出为 CSV。

## 说明

- 本项目基于原始 [InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom) 的设计思路与工作流。
- `web/` 目录保存生成页面所需的前端资源。
- 如果你要继续发布自己的增强版本，建议在 README 中补充准确的功能清单、截图和支持的 Altium 版本。

## 致谢

- 原始项目：[openscopeproject/InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)
- 原始 AD 适配参考：[lianlian33/InteractiveHtmlBomForAD](https://github.com/lianlian33/InteractiveHtmlBomForAD)
