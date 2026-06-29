# InteractiveHtmlBom-AD

[中文](README.zh-CN.md) | [English](README.en.md)

`InteractiveHtmlBom-AD` is an Altium Designer script oriented adaptation of
[InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom).
It keeps the familiar interactive HTML BOM experience while making the export
workflow usable from Altium script projects.

## Compatibility

- Altium Designer: tested on AD10 and AD24.
- Script entry points: `startWin()` for GUI mode and `main()` for direct export.

## Highlights

- Supports Altium Designer script workflow, tested on AD10 and AD24.
- Provides both GUI mode and direct script export mode.
- Exports interactive HTML BOM for assembly and inspection.
- Includes helper exports for JSON, TXT BOM and CSV PnP.
- Supports front/back board view, dark mode and multiple display options.
- Adds board outline auto-detection between `Mechanical1` and `Keep Out Layer`.
- Includes multilingual messages for common prompts.

## Project Structure

- `core/`: configuration, BOM generation and output assembly.
- `ecad/`: Altium PCB parsing logic.
- `dist/`: distributable script entry and GUI code.
- `web/`: frontend assets used by generated HTML output.
- `tools/`: helper exporters such as JSON / TXT / PnP CSV.
- `Initialize.bat`: combines scripts into the distributable entry file.

## Installation

1. Run `Initialize.bat` once in the project root.
2. Open `InteractiveHtmlBom.PrjScr` in Altium Designer.
3. Open a `PcbDoc`, then open `Run Script...`.
4. Run `startWin()` to launch the GUI, or run `main()` for direct export.

## Usage

After opening the GUI, you can:

- Choose the output HTML path.
- Configure blacklists such as empty value, one-pad and through-hole parts.
- Select the PCB outline source layer.
- Toggle pads, silkscreen, fabrication layer and dark mode options.
- Generate HTML BOM and open the output folder.

Generated files are typically written into a `PnPout` directory near the current
PCB document.

## What's New

- Improved launch workflow: `startWin()` is recommended for GUI export, while
  `main()` is still kept for direct export.
- Simplified project entry: the script project file is now
  `InteractiveHtmlBom.PrjScr`, which is shorter and clearer.
- Initialization self-check: opening the GUI or clicking Generate now verifies
  whether initialization has been completed, and prompts users to run
  `Initialize.bat` when needed.
- Smarter board outline detection between `Mechanical1` and
  `Keep Out Layer` to reduce outline selection errors.
- Multilingual frontend support for `中文 / English / 日本語 / 한국어`.
- Searchable language selector for faster language switching.
- More complete page translations across menus, export, filters, metadata and
  dialogs.
- Multiple built-in themes: `Light / Dark / Apple / Blue Gray / Eye Care Green`.
- Added an Apple-style overall theme with support for following system dark mode.
- Refined Apple-style BOM table visuals with improved header, radius, hover and
  highlight consistency.
- Improved dark theme visibility so buttons and icons stay clear instead of only
  becoming readable on hover.
- Optimized the top menu into a denser two-column layout for quicker access to
  common options.
- Unified font stack for better Chinese and English mixed-text appearance.
- Reduced the visual size of the language selector while keeping readability.
- Added a lightweight startup animation when opening the exported HTML page.
- Added right-click canvas panning while preserving right-click reset behavior.
- Localized script prompts based on AD locale settings, with friendlier Chinese
  error messages.
- Improved prompts when the current document is not a PCB document.
- Removed the version row from the generated HTML page for a cleaner info panel.

## Extra Export Tools

Besides HTML BOM generation, the script also provides helper exports:

- `exportJSON()`: exports parsed PCB and component data as JSON.
- `exportBOM()`: exports BOM as tab-separated TXT.
- `exportPnP()`: exports pick-and-place data as CSV.

## Notes

- This project is based on the original
  [InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)
  idea and workflow.
- The `web/` directory keeps frontend assets used by the generated viewer.
- If you are publishing your own enhanced version, update this README with your
  exact feature list, screenshots and supported Altium versions.

## Credits

- Original project:
  [openscopeproject/InteractiveHtmlBom](https://github.com/openscopeproject/InteractiveHtmlBom)
- Original AD adaptation reference:
  [lianlian33/InteractiveHtmlBomForAD](https://github.com/lianlian33/InteractiveHtmlBomForAD)
