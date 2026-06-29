# InteractiveHtmlBom-AD

`InteractiveHtmlBom-AD` is an Altium Designer / AD10 oriented adaptation of
[InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom).
It keeps the familiar interactive HTML BOM experience while making the export
workflow usable from Altium script projects.

`InteractiveHtmlBom-AD` 是一个面向 Altium Designer / AD10 的
`InteractiveHtmlBom` 改进版。项目保留了交互式 HTML BOM 的核心体验，并把
导出流程适配到了 AD 脚本环境中，方便直接从 PCB 文档生成可交互的装配页面。

## Highlights

- Supports AD10 / Altium script workflow
- Provides both GUI mode and direct script export mode
- Exports interactive HTML BOM for assembly and inspection
- Includes extra export helpers for JSON, TXT BOM and CSV PnP
- Supports front/back board view, dark mode and several display options
- Adds board outline auto-detection between `Mechanical1` and `Keep Out Layer`
- Includes built-in multilingual messages for common prompts

## Project Structure

- `core/`: configuration, BOM generation and output assembly
- `ecad/`: Altium PCB parsing logic
- `dist/`: distributable script entry and GUI code
- `web/`: frontend assets used by generated HTML output
- `tools/`: helper exporters such as JSON / TXT / PnP CSV
- `Initialize.bat`: combines scripts into the distributable entry file

## Installation

1. Run `Initialize.bat` once in the project root.
2. Open `InteractiveHtmlBom.PrjScr` in Altium Designer.
3. Open a `PcbDoc`, then open `Run Script...`.
4. Run `startWin()` to launch the GUI, or run `main()` for direct export.

## Usage

After opening the GUI you can:

- Choose the output HTML path
- Configure blacklists such as empty value / one-pad / through-hole parts
- Select the PCB outline source layer
- Toggle display options like pads, silkscreen, fabrication layer and dark mode
- Generate HTML BOM and open the output folder

The generated files are typically written into a `PnPout` directory near the
current PCB document.

## Extra Export Tools

Besides HTML BOM generation, the script also provides helper exports:

- `exportJSON()`: exports parsed PCB and component data as JSON
- `exportBOM()`: exports BOM as tab-separated TXT
- `exportPnP()`: exports pick-and-place data as CSV

## Notes

- This project is based on the original
  [InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)
  idea and workflow.
- The `web/` directory keeps frontend assets used by the generated viewer.
- If you are publishing your own enhanced version, update this README again with
  your exact feature additions, screenshots and supported Altium versions.

## Credits

- Original project:
  [openscopeproject/InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)
- Original AD adaptation reference:
  [lianlian33/InteractiveHtmlBomForAD](https://github.com/lianlian33/InteractiveHtmlBomForAD)
