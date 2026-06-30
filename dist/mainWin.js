
function startWin() {
    mainWin.Show(); 
}

var UI_LANG = "zh";

var UI_I18N = {
    "not_initialized": {
        "en": "InteractiveHtmlBomForAD is not initialized. Please run Initialize.bat first.",
        "zh": "\u0069\u006e\u0074\u0065\u0072\u0061\u0063\u0074\u0069\u0076\u0065\u0048\u0074\u006d\u006c\u0042\u006f\u006d\u0046\u006f\u0072\u0041\u0044 \u672a\u521d\u59cb\u5316\uff0c\u8bf7\u5148\u8fd0\u884c Initialize.bat"
    },
    "outline_guess_prefix": {
        "en": "Outline layer may be wrong: seems more likely on ",
        "zh": "\u677f\u6846\u5c42\u53ef\u80fd\u9009\u9519\uff1a\u68c0\u6d4b\u5230\u66f4\u53ef\u80fd\u5728"
    },
    "dir_error": {
        "en": "Directory error",
        "zh": "\u8def\u5f84\u9519\u8bef"
    },
    "win_caption": { "en": "Interactive BOM", "zh": "\u4ea4\u4e92\u5f0f BOM" },
    "tab_general": { "en": "General", "zh": "\u901a\u7528" },
    "tab_html_defaults": { "en": "Html defaults", "zh": "HTML \u9ed8\u8ba4" },
    "tab_extra_fields": { "en": "Extra fields", "zh": "\u6269\u5c55\u5b57\u6bb5" },
    "tab_pcb_tools": { "en": "PCB tools", "zh": "PCB \u5de5\u5177" },
    "group_language": { "en": "Language", "zh": "\u8bed\u8a00" },
    "group_bom_dest": { "en": "Save to", "zh": "\u4fdd\u5b58\u4f4d\u7f6e" },
    "label_directory": { "en": "Output", "zh": "\u8f93\u51fa" },
    "group_additional": { "en": "Board data", "zh": "\u677f\u56fe\u9644\u52a0\u6570\u636e" },
    "include_tracks": { "en": "Include tracks/solid polygons", "zh": "\u5305\u542b\u8d70\u7ebf/\u5b9e\u5fc3\u94dc\u76ae" },
    "include_vias": { "en": "Include vias", "zh": "\u5305\u542b\u8fc7\u5b54" },
    "group_blacklist": { "en": "Component filters", "zh": "\u5668\u4ef6\u8fc7\u6ee4" },
    "blacklist_empty": { "en": "Component with \"DNP\"|\"\"|\"~\" comment", "zh": "\u6ce8\u91ca\u4e3a \"DNP\"/\u7a7a/\u201c~\u201d \u7684\u5668\u4ef6" },
    "blacklist_1pad": { "en": "Component with 1 pad", "zh": "\u5355 Pad \u5668\u4ef6" },
    "blacklist_th": { "en": "Component of th", "zh": "\u63d2\u88c5\u5668\u4ef6(TH)" },
    "btn_generate": { "en": "Export HTML", "zh": "\u5bfc\u51fa HTML" },
    "group_outline": { "en": "Outline layer", "zh": "\u677f\u6846\u5c42" },
    "outline_keepout": { "en": "Keep out layer", "zh": "Keep Out \u5c42" },
    "outline_mech1": { "en": "Mechanical 1", "zh": "Mechanical1" },
    "dark_mode": { "en": "Dark mode", "zh": "\u6df1\u8272\u6a21\u5f0f" },
    "show_pads": { "en": "Show footprint pads", "zh": "\u663e\u793a Pad" },
    "show_fab": { "en": "Show fabrication layer", "zh": "\u663e\u793a\u5de5\u827a\u5c42" },
    "show_silk": { "en": "Show silkscreen", "zh": "\u663e\u793a\u4e1d\u5370" },
    "highlight_pin1": { "en": "Highlight first pin", "zh": "\u9ad8\u4eae 1 \u811a" },
    "continuous_redraw": { "en": "Continuous redraw on drag", "zh": "\u62d6\u52a8\u65f6\u8fde\u7eed\u91cd\u7ed8" },
    "label_rotation": { "en": "Board rotation", "zh": "\u677f\u5b50\u65cb\u8f6c" },
    "group_checkboxes": { "en": "Checkboxes", "zh": "\u5feb\u6377\u52fe\u9009\u9879" },
    "group_bom_view": { "en": "BOM View", "zh": "BOM \u5e03\u5c40" },
    "bom_only": { "en": "BOM only", "zh": "\u4ec5 BOM" },
    "bom_left_right": { "en": "BOM left, drawings right", "zh": "BOM \u5de6 \u00b7 PCB \u53f3" },
    "bom_top_bottom": { "en": "BOM top, drawings bottom", "zh": "BOM \u4e0a \u00b7 PCB \u4e0b" },
    "group_layer_view": { "en": "Layer View", "zh": "\u5c42\u663e\u793a" },
    "layer_fb": { "en": "Front and Back", "zh": "\u6b63\u53cd\u9762" },
    "layer_f": { "en": "Front only", "zh": "\u4ec5\u6b63\u9762" },
    "layer_b": { "en": "Back only", "zh": "\u4ec5\u53cd\u9762" },
    "group_other": { "en": "Export", "zh": "\u5bfc\u51fa" },
    "open_browser": { "en": "Open browser", "zh": "\u6253\u5f00\u6d4f\u89c8\u5668" },
    "open_explorer": { "en": "Open explorer", "zh": "\u6253\u5f00\u6587\u4ef6\u5939" },
    "lang_zh": { "en": "Chinese", "zh": "\u4e2d\u6587" },
    "lang_en": { "en": "English", "zh": "\u82f1\u6587" },
    "group_extra_file": { "en": "Extra file (not implemeted)", "zh": "\u6269\u5c55\u6587\u4ef6(\u672a\u5b9e\u73b0)" }
};

function uiStr(key) {
    try {
        if (Object.prototype.hasOwnProperty.call(UI_I18N, key)) {
            if (Object.prototype.hasOwnProperty.call(UI_I18N[key], UI_LANG)) {
                return UI_I18N[key][UI_LANG];
            }
            return UI_I18N[key]["en"];
        }
    } catch(e) {}
    return key;
}

function applyUiLang() {
    try { mainWin.Caption = uiStr("win_caption"); } catch(e) {}
    try { TabSheet1.Caption = uiStr("tab_general"); } catch(e) {}
    try { TabSheet2.Caption = uiStr("tab_html_defaults"); } catch(e) {}
    try { TabSheet3.Caption = uiStr("tab_extra_fields"); } catch(e) {}
    try { TabSheet4.Caption = uiStr("tab_pcb_tools"); } catch(e) {}

    try { GroupBoxLang.Caption = uiStr("group_language"); } catch(e) {}
    try { GroupBox1.Caption = uiStr("group_bom_dest"); } catch(e) {}
    try { StaticText1.Caption = uiStr("label_directory"); } catch(e) {}
    try { GroupBox3.Caption = uiStr("group_additional"); } catch(e) {}
    try { CbIncludeTracksAndSolidPolygons.Caption = uiStr("include_tracks"); } catch(e) {}
    try { CbIncludeVias.Caption = uiStr("include_vias"); } catch(e) {}
    try { GroupBox4.Caption = uiStr("group_blacklist"); } catch(e) {}
    try { CbBlacklistEmpty.Caption = uiStr("blacklist_empty"); } catch(e) {}
    try { CbBlacklist1Pad.Caption = uiStr("blacklist_1pad"); } catch(e) {}
    try { CbBlacklistTh.Caption = uiStr("blacklist_th"); } catch(e) {}
    try { GenerateBom.Caption = uiStr("btn_generate"); } catch(e) {}
    try { GroupBox10.Caption = uiStr("group_outline"); } catch(e) {}
    try { RBtnKeepOutLayer.Caption = uiStr("outline_keepout"); } catch(e) {}
    try { RBtnMech1.Caption = uiStr("outline_mech1"); } catch(e) {}

    try { CbDarkMode.Caption = uiStr("dark_mode"); } catch(e) {}
    try { CbShowFootprintPads.Caption = uiStr("show_pads"); } catch(e) {}
    try { CbShowFabricationLayer.Caption = uiStr("show_fab"); } catch(e) {}
    try { CbShowSilkscreen.Caption = uiStr("show_silk"); } catch(e) {}
    try { CbHighlightFirstPin.Caption = uiStr("highlight_pin1"); } catch(e) {}
    try { CbContinuousRedrawOnDrag.Caption = uiStr("continuous_redraw"); } catch(e) {}
    try { StaticText2.Caption = uiStr("label_rotation"); } catch(e) {}
    try { GroupBox5.Caption = uiStr("group_checkboxes"); } catch(e) {}
    try { GroupBox6.Caption = uiStr("group_bom_view"); } catch(e) {}
    try { RBtnBomOnly.Caption = uiStr("bom_only"); } catch(e) {}
    try { RBtnBomLeftDrawingRight.Caption = uiStr("bom_left_right"); } catch(e) {}
    try { RBtnBomTopDrawingBottom.Caption = uiStr("bom_top_bottom"); } catch(e) {}
    try { GroupBox7.Caption = uiStr("group_layer_view"); } catch(e) {}
    try { RBtnFrontAndBack.Caption = uiStr("layer_fb"); } catch(e) {}
    try { RBtnFrontOnly.Caption = uiStr("layer_f"); } catch(e) {}
    try { RBtnBackOnly.Caption = uiStr("layer_b"); } catch(e) {}
    try { GroupBox8.Caption = uiStr("group_other"); } catch(e) {}
    try { CbOpenBrowser.Caption = uiStr("open_browser"); } catch(e) {}
    try { CbOpenExplorer.Caption = uiStr("open_explorer"); } catch(e) {}
    try { RBtnLangZh.Caption = uiStr("lang_zh"); } catch(e) {}
    try { RBtnLangEn.Caption = uiStr("lang_en"); } catch(e) {}

    try { GroupBox2.Caption = uiStr("group_extra_file"); } catch(e) {}
}

function setUiLang(lang) {
    UI_LANG = (lang == "en") ? "en" : "zh";
    applyUiLang();
}

function LangRadioClick(Sender) {
    if (RBtnLangEn.Checked) {
        setUiLang("en");
    } else {
        setUiLang("zh");
    }
}

function ibomIsInitialized() {
    try {
        if (typeof CURRENT_PATH === "undefined" || CURRENT_PATH == "") {
            return false;
        }
        return FileExists(CURRENT_PATH + "web\\ibom.html");
    } catch(e) {
        return false;
    }
}

function countOutlineObjects(board, layerId) {
    var count = 0;
    var Iter = board.BoardIterator_Create;
    Iter.AddFilter_ObjectSet(MkSet(eArcObject, eTrackObject));
    Iter.AddFilter_LayerSet(MkSet(layerId));
    Iter.AddFilter_Method(eProcessAll);
    var Prim = Iter.FirstPCBObject;
    while (Prim != null) {
        count++;
        Prim = Iter.NextPCBObject;
    }
    board.BoardIterator_Destroy(Iter);
    return count;
}

function guessOutlineMech1(board) {
    var keepOut = String2Layer("Keep Out Layer");
    var cMech1 = countOutlineObjects(board, eMechanical1);
    var cKeepout = countOutlineObjects(board, keepOut);
    if (cMech1 == 0 && cKeepout == 0) {
        return false;
    }
    if (cMech1 == 0) {
        return false;
    }
    if (cKeepout == 0) {
        return true;
    }
    return cMech1 >= cKeepout;
}

function applyOutlineGuess(board, setRadio) {
    var guess = guessOutlineMech1(board);
    if (setRadio) {
        RBtnMech1.Checked = guess;
        RBtnKeepOutLayer.Checked = !guess;
        return;
    }
    if (RBtnMech1.Checked != guess) {
        showmessage(uiStr("outline_guess_prefix") + (guess ? "Mechanical1" : "Keep Out Layer"));
    }
}

function openGeneratedOutputs(filename) {
    if (CbOpenBrowser.Checked) {
        RunApplication('explorer.exe "' + filename + '"');
    }
    if (CbOpenExplorer.Checked) {
        RunApplication('explorer.exe "' + ExtractFilePath(filename) + '"');
    }
}

function mainWinShow(Sender) {
    var iniFileName = CURRENT_PATH + "config.ini";
    try {
        PageControl1.ActivePage = TabSheet1;
    } catch(e) {}

    if (!ibomIsInitialized()) {
        showmessage(uiStr("not_initialized"));
    }

    if (FileExists(iniFileName)) {
        var iniFile = TIniFile.Create(iniFileName);
        var uiLang = iniFile.ReadString("Ui", "Lang", "zh");
        if (uiLang == "en") {
            RBtnLangEn.Checked = true;
            RBtnLangZh.Checked = false;
            setUiLang("en");
        } else {
            RBtnLangEn.Checked = false;
            RBtnLangZh.Checked = true;
            setUiLang("zh");
        }
        if (PCBServer != null) {
            PCBServer.PreProcess;
            var currentPcb = PCBServer.GetCurrentPCBBoard();

            if (currentPcb != null) {
                var currentPath = ExtractFilePath(currentPcb.FileName);
                var filename = currentPath + "PnPout\\" + ExtractFileName(currentPcb.FileName).split(".")[0] + ".html";
                TEditCurrentPcbPath.Text = filename;
                TEditExtraFileName.Text = currentPath;
            } else {
                TEditCurrentPcbPath.Text = iniFile.ReadString("General", "Directory", "");
                TEditExtraFileName.Text = iniFile.ReadString("ExtraFields", "ExtraFileName", "");
            }

            PCBServer.PostProcess;
        } else {
            TEditCurrentPcbPath.Text = iniFile.ReadString("General", "Directory", "");
            TEditExtraFileName.Text = iniFile.ReadString("ExtraFields", "ExtraFileName", "");
        }
        CbIncludeTracksAndSolidPolygons.Checked = iniFile.ReadBool("General", "IncludeTracksAndSolidPolygons", false);
        CbIncludeVias.Checked = iniFile.ReadBool("General", "IncludeVias", false);
        // CbIncludeHatched.Checked = iniFile.ReadBool("General", "IncludeHatched", false);
        // CbIncludeNets.Checked = iniFile.ReadBool("General", "IncludeNets", false);
        CbIncludeHatched.Checked = false;
        CbIncludeNets.Checked = false;

        CbBlacklistEmpty.Checked = iniFile.ReadBool("General", "BlacklistEmpty", true);
        CbBlacklist1Pad.Checked = iniFile.ReadBool("General", "Blacklist1Pad", true);
        CbBlacklistTh.Checked = iniFile.ReadBool("General", "BlacklistTh", true);
        if (iniFile.ReadBool("General", "PcbOutlineMech1", false)) {
            RBtnMech1.Checked = true;
            RBtnKeepOutLayer.Checked = false;
        } else {
            RBtnMech1.Checked = false;
            RBtnKeepOutLayer.Checked = true;
        }
        if (PCBServer != null) {
            PCBServer.PreProcess;
            var currentPcb = PCBServer.GetCurrentPCBBoard();
            if (currentPcb != null) {
                applyOutlineGuess(currentPcb, false);
            }
            PCBServer.PostProcess;
        }

        CbDarkMode.Checked = iniFile.ReadBool("HtmlDefaults", "DarkMode", false);
        CbShowFootprintPads.Checked = iniFile.ReadBool("HtmlDefaults", "ShowFootprintPads", true);
        CbShowFabricationLayer.Checked = iniFile.ReadBool("HtmlDefaults", "ShowFabricationLayer", false);
        CbShowSilkscreen.Checked = iniFile.ReadBool("HtmlDefaults", "ShowSilkscreen", true);
        CbHighlightFirstPin.Checked = iniFile.ReadBool("HtmlDefaults", "HighlightPin1", false);
        CbContinuousRedrawOnDrag.Checked = iniFile.ReadBool("HtmlDefaults", "ContinuousRedrawOnDrag", true);

        TTrackBarRotation.Position = (iniFile.ReadInteger("HtmlDefaults", "PcbRotation", 0) + 180)/5;
        TTextRotation.Caption = [TTrackBarRotation.Position * 5 - 180, String.fromCharCode(176)].join("");

        TEditHtmlCheckboxes.Text = iniFile.ReadString("HtmlDefaults", "HtmlCheckboxes", "Sourced,Placed");
        RBtnBomOnly.Checked = iniFile.ReadBool("HtmlDefaults", "BomViewOnly", false);
        RBtnBomLeftDrawingRight.Checked = iniFile.ReadBool("HtmlDefaults", "BomViewLeftDrawingRight", true);
        RBtnBomTopDrawingBottom.Checked = iniFile.ReadBool("HtmlDefaults", "BomViewTopDrawingBottom", false);
        RBtnFrontOnly.Checked = iniFile.ReadBool("HtmlDefaults", "PcbLayerFrontOnly", false);
        RBtnFrontAndBack.Checked = iniFile.ReadBool("HtmlDefaults", "PcbLayerFrontAndBack", true);
        RBtnBackOnly.Checked = iniFile.ReadBool("HtmlDefaults", "PcbLayerBackOnly", false);
        CbOpenBrowser.Checked = iniFile.ReadBool("HtmlDefaults", "OtherOpenBrowser", false);
        CbOpenExplorer.Checked = iniFile.ReadBool("HtmlDefaults", "OtherOpenExplorer", true);

        iniFile.Free;
    } else {
        RBtnLangEn.Checked = false;
        RBtnLangZh.Checked = true;
        setUiLang("zh");
        if (PCBServer != null) {
            PCBServer.PreProcess;
            var currentPcb = PCBServer.GetCurrentPCBBoard();

            if (currentPcb != null) {
                var currentPath = ExtractFilePath(currentPcb.FileName);
                var filename = currentPath + "PnPout\\" + ExtractFileName(currentPcb.FileName).split(".")[0] + ".html";
                TEditCurrentPcbPath.Text = filename;
                TEditExtraFileName.Text = currentPath;
            } else {
                TEditCurrentPcbPath.Text = "";
                TEditExtraFileName.Text = "";
            }

            if (currentPcb != null) {
                applyOutlineGuess(currentPcb, true);
            }

            PCBServer.PostProcess;
        } else {
            TEditCurrentPcbPath.Text = "";
            TEditExtraFileName.Text = "";
        }

        CbBlacklistEmpty.Checked = true;
        CbBlacklist1Pad.Checked = true;
        CbBlacklistTh.Checked = true;

        CbIncludeTracksAndSolidPolygons.Checked = false;
        CbIncludeVias.Checked = false;
        CbIncludeHatched.Checked = false;
        CbIncludeNets.Checked = false;

        CbBlacklistEmpty.Checked = true;
        CbBlacklist1Pad.Checked = true;
        RBtnKeepOutLayer.Checked = true;
        RBtnMech1.Checked = false;

        CbDarkMode.Checked = false;
        CbShowFootprintPads.Checked = true;
        CbShowFabricationLayer.Checked = false;
        CbShowSilkscreen.Checked = true;
        CbHighlightFirstPin.Checked = false;
        CbContinuousRedrawOnDrag.Checked = true;

        TTrackBarRotation.Position = 36;
        TTextRotation.Caption = [0, String.fromCharCode(176)].join("");

        TEditHtmlCheckboxes.Text = "Sourced,Placed";
        RBtnBomOnly.Checked = false;
        RBtnBomLeftDrawingRight.Checked = true;
        RBtnBomTopDrawingBottom.Checked = false;
        RBtnFrontOnly.Checked = false;
        RBtnFrontAndBack.Checked = true;
        RBtnBackOnly.Checked = false;
        CbOpenBrowser.Checked = false;
        CbOpenExplorer.Checked = true;
    }
}

function GenerateBomClick(Sender) {
    if (!ibomIsInitialized()) {
        showmessage(uiStr("not_initialized"));
        return;
    }
    var iniFileName = CURRENT_PATH + "config.ini";
    setValueToInifile(iniFileName);

    // var config = getConfig();
    var config = {};
    config.include = {};
    config.htmlConfig = {};
    config.bomFilter = {};
    config.bomFilter["skipempty"] = CbBlacklistEmpty.Checked;
    config.bomFilter["skiponepad"] = CbBlacklist1Pad.Checked;
    config.bomFilter["skipth"] = CbBlacklistTh.Checked;

    config.htmlConfig["extra_fields"] = []; 
    config.htmlConfig["redraw_on_drag"] = CbContinuousRedrawOnDrag.Checked;

    if (RBtnMech1.Checked) {
        config.PcbOutlineMech1 = true;
    } else {
        config.PcbOutlineMech1 = false;
    }
    
    if (RBtnBomOnly.Checked) {
        config.htmlConfig["bom_view"] = "bom-only";
    } else if (RBtnBomLeftDrawingRight.Checked) {
        config.htmlConfig["bom_view"] = "left-right";
    } else if (RBtnBomTopDrawingBottom.Checked) {
        config.htmlConfig["bom_view"] = "top-bottom";
    }

    if (RBtnFrontOnly.Checked) {
        config.htmlConfig["layer_view"] = "F";
    } else if (RBtnFrontAndBack.Checked) {
        config.htmlConfig["layer_view"] = "FB";
    } else if (RBtnBackOnly.Checked) {
        config.htmlConfig["layer_view"] = "B";
    }
    
    config.htmlConfig["show_silkscreen"] = CbShowSilkscreen.Checked;
    config.htmlConfig["checkboxes"] = TEditHtmlCheckboxes.Text;
    config.htmlConfig["dark_mode"] = CbDarkMode.Checked;
    config.htmlConfig["highlight_pin1"] = CbHighlightFirstPin.Checked;
    config.htmlConfig["show_pads"] = CbShowFootprintPads.Checked;
    config.htmlConfig["show_fabrication"] = CbShowFabricationLayer.Checked;
    // config.htmlConfig["extra_fields"] = [];
    config.htmlConfig["board_rotation"] = TTrackBarRotation.Position * 5 - 180;

    config.include["tracks"] = CbIncludeTracksAndSolidPolygons.Checked;
    config.include["polys"] = CbIncludeTracksAndSolidPolygons.Checked;
    config.include["polyHatched"] = CbIncludeHatched.Checked;
    config.include["vias"] = CbIncludeVias.Checked;
    config.include["nets"] = CbIncludeNets.Checked;

    var filename = getSaveDir(TEditCurrentPcbPath.Text);
    if (filename == "") {
        return;
    }

    var pcb = parsePcb(config);
    if (!pcb) {
        return;
    };

    var extra_data;

    pcb.pcbdata["bom"] = pickBom(pcb, config, extra_data);
    pcb.pcbdata["ibom_version"] = "v2.3";

    var s = JSON.stringify(pcb.pcbdata);
    var b = LZStr.compressToBase64(s);

    b = 'var pcbdata = JSON.parse(LZString.decompressFromBase64("' + b + '"))';

    var config_js = "var config = " + JSON.stringify(config.htmlConfig);
    var html = generateFile(b, config_js);
    save2file(html, filename, false);

    try {
        openGeneratedOutputs(filename);
    }
    catch(e) {
        showmessage(e.message);
    };
}

function pickBom(pcb, config, extra_data) {
    // type (list, dict, dict) -> dict
    // return: dict of BOM tables (qty, value, footprint, refs) and dnp components
    var extra_data = arguments[2] ? arguments[2] : {}; 

    var res = {};
    var extras = [];
    var modules = pcb.modules;
    var rows = {};  // { itemkey: [quantity, comment, footprint, designator, extras] }
    var rowsB = {};
    var rowsF = {};
    var skippedComponents = [];
    var count = modules.length;
    for (var i = 0; i < count; i++) {
        if (skipComponent(modules[i], config)) {
            skippedComponents.push(i);
            continue;
        }
    
        //   extra_data =
        //    {
        //       ref1: {
        //         field_name1: field_value1,
        //         field_name2: field_value2,
        //         ...
        //         },
        //       ref2: ...
        //    }
        if (!Object.prototype.hasOwnProperty.call(rows, modules[i].itemkey)) {

            if (Object.prototype.hasOwnProperty.call(extra_data, modules[i]["component"].ref)) {
                for (var field_name in extra_data[modules[i]["component"].ref]) {
                    extras.push(extra_data[modules[i]["component"].ref][field_name]);  // extras = [field_value1, field_value2 ...]    
                }   
            } else {
                for (var k = config["htmlConfig"].extra_fields.length - 1; k >= 0; k--) {
                    extras.push("");
                }
            }     

            rows[modules[i].itemkey] = [1, modules[i]["component"].val, modules[i]["component"].footprint, [[modules[i]["component"].ref, i]], extras];
            extras = [];
        } else {
            rows[modules[i].itemkey][0]++;
            rows[modules[i].itemkey][3].push([modules[i]["component"].ref, i]);
        }

        if (modules[i]["component"].layer == "F") {
            if (!Object.prototype.hasOwnProperty.call(rowsF, modules[i].itemkey)) {
                rowsF[modules[i].itemkey] = [1, modules[i]["component"].val, modules[i]["component"].footprint, [[modules[i]["component"].ref, i]] ];
            } else {
                rowsF[modules[i].itemkey][0]++;
                rowsF[modules[i].itemkey][3].push([modules[i]["component"].ref, i]);    
            }
        } else {
            if (!Object.prototype.hasOwnProperty.call(rowsB, modules[i].itemkey)) {
                rowsB[modules[i].itemkey] = [1, modules[i]["component"].val, modules[i]["component"].footprint, [[modules[i]["component"].ref, i]] ];
            } else {
                rowsB[modules[i].itemkey][0]++;
                rowsB[modules[i].itemkey][3].push([modules[i]["component"].ref, i]);    
            }
        }
    }

    res.both = []
    for (var i in rows) {
        res.both.push(rows[i]);
    }

    res.F = []
    for (var i in rowsF) {
        rowsF[i].push(rows[i][4]); // add extras
        res.F.push(rowsF[i]);
    }

    res.B = []
    for (var i in rowsB) {
        rowsB[i].push(rows[i][4]); 
        res.B.push(rowsB[i]);
    }
    
    res.skipped = skippedComponents;
    return res;
}


function BtnOpenClick(Sender) {
    OpenDialog1.InitialDir = ExtractFilePath(TEditExtraFileName.Text);
    if (OpenDialog1.Execute) {
        TEditExtraFileName.Text = OpenDialog1.FileName;
    }
}

function BtnSaveClick(Sender) {
    SaveDialog1.InitialDir = ExtractFilePath(TEditCurrentPcbPath.Text);
    if (SaveDialog1.Execute) {
        TEditCurrentPcbPath.Text = SaveDialog1.Filename;
    }
}

function TTrackBarRotationChange(Sender) {
    TTextRotation.Caption = [TTrackBarRotation.Position * 5 - 180, String.fromCharCode(176)].join("");
}


function setValueToInifile(iniFileName) {
    var iniFile = TIniFile.Create(iniFileName);
    iniFile.WriteString("Ui", "Lang", UI_LANG);
    iniFile.WriteString("General", "Directory", TEditCurrentPcbPath.Text);
    iniFile.WriteBool("General", "IncludeTracksAndSolidPolygons", CbIncludeTracksAndSolidPolygons.Checked);
    iniFile.WriteBool("General", "IncludeVias", CbIncludeVias.Checked);
    iniFile.WriteBool("General", "IncludeHatched", CbIncludeHatched.Checked);
    iniFile.WriteBool("General", "IncludeNets", CbIncludeNets.Checked);
    iniFile.WriteBool("General", "BlacklistEmpty", CbBlacklistEmpty.Checked);
    iniFile.WriteBool("General", "Blacklist1Pad", CbBlacklist1Pad.Checked);
    iniFile.WriteBool("General", "BlacklistTh", CbBlacklistTh.Checked);
    iniFile.WriteBool("General", "PcbOutlineMech1", RBtnMech1.Checked);

    iniFile.WriteBool("HtmlDefaults", "DarkMode", CbDarkMode.Checked);
    iniFile.WriteBool("HtmlDefaults", "ShowFootprintPads", CbShowFootprintPads.Checked);
    iniFile.WriteBool("HtmlDefaults", "ShowFabricationLayer", CbShowFabricationLayer.Checked);
    iniFile.WriteBool("HtmlDefaults", "ShowSilkscreen", CbShowSilkscreen.Checked);
    iniFile.WriteBool("HtmlDefaults", "HighlightPin1", CbHighlightFirstPin.Checked);
    iniFile.WriteBool("HtmlDefaults", "ContinuousRedrawOnDrag", CbContinuousRedrawOnDrag.Checked);
    iniFile.WriteInteger("HtmlDefaults", "PcbRotation", (TTrackBarRotation.Position * 5 - 180));
    iniFile.WriteString("HtmlDefaults", "HtmlCheckboxes", TEditHtmlCheckboxes.Text);
    iniFile.WriteBool("HtmlDefaults", "BomViewOnly", RBtnBomOnly.Checked);
    iniFile.WriteBool("HtmlDefaults", "BomViewLeftDrawingRight", RBtnBomLeftDrawingRight.Checked);
    iniFile.WriteBool("HtmlDefaults", "BomViewTopDrawingBottom", RBtnBomTopDrawingBottom.Checked);
    iniFile.WriteBool("HtmlDefaults", "PcbLayerFrontOnly", RBtnFrontOnly.Checked);
    iniFile.WriteBool("HtmlDefaults", "PcbLayerFrontAndBack", RBtnFrontAndBack.Checked);
    iniFile.WriteBool("HtmlDefaults", "PcbLayerBackOnly", RBtnBackOnly.Checked);
    iniFile.WriteBool("HtmlDefaults", "OtherOpenBrowser", CbOpenBrowser.Checked);
    iniFile.WriteBool("HtmlDefaults", "OtherOpenExplorer", CbOpenExplorer.Checked);

    iniFile.WriteString("ExtraFields", "ExtraFileName", TEditExtraFileName.Text);
    iniFile.Free;
}

function getSaveDir(text) {
    var fso = new ActiveXObject("Scripting.FileSystemObject"); 
    var filename = text.replace("/", "\\");
    var arr = filename.split("\\");
    var len = arr.length - 1;

    if (!fso.FolderExists(arr[0])) {
        showmessage(uiStr("dir_error"));
        return "";
    }

    for (var i = 0; i <= len; i++) {
        if (arr[i] == "") {
            showmessage(uiStr("dir_error"));
            return "";
        }
    }

    return filename;
}
