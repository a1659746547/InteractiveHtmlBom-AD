/* Utility functions */

var storagePrefix = 'KiCad_HTML_BOM__' + pcbdata.metadata.title + '__' +
  pcbdata.metadata.revision + '__#';
var storage;

function initStorage(key) {
  try {
    window.localStorage.getItem("blank");
    storage = window.localStorage;
  } catch (e) {
    // localStorage not available
  }
  if (!storage) {
    try {
      window.sessionStorage.getItem("blank");
      storage = window.sessionStorage;
    } catch (e) {
      // sessionStorage also not available
    }
  }
}

function readStorage(key) {
  if (storage) {
    return storage.getItem(storagePrefix + key);
  } else {
    return null;
  }
}

function writeStorage(key, value) {
  if (storage) {
    storage.setItem(storagePrefix + key, value);
  }
}

function fancyDblClickHandler(el, onsingle, ondouble) {
  return function() {
    if (el.getAttribute("data-dblclick") == null) {
      el.setAttribute("data-dblclick", 1);
      setTimeout(function() {
        if (el.getAttribute("data-dblclick") == 1) {
          onsingle();
        }
        el.removeAttribute("data-dblclick");
      }, 200);
    } else {
      el.removeAttribute("data-dblclick");
      ondouble();
    }
  }
}

function smoothScrollToRow(rowid) {
  document.getElementById(rowid).scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest"
  });
}

function focusInputField(input) {
  input.scrollIntoView(false);
  input.focus();
  input.select();
}

function copyToClipboard() {
  var text = '';
  for (var node of bomhead.childNodes[0].childNodes) {
    if (node.firstChild) {
      text = text + node.firstChild.nodeValue;
    }
    if (node != bomhead.childNodes[0].lastChild) {
      text += '\t';
    }
  }
  text += '\n';
  for (var row of bombody.childNodes) {
    for (var cell of row.childNodes) {
      for (var node of cell.childNodes) {
        if (node.nodeName == "INPUT") {
          if (node.checked) {
            text = text + '✓';
          }
        } else if (node.nodeName == "MARK") {
          text = text + node.firstChild.nodeValue;
        } else {
          text = text + node.nodeValue;
        }
      }
      if (cell != row.lastChild) {
        text += '\t';
      }
    }
    text += '\n';
  }
  var textArea = document.createElement("textarea");
  textArea.classList.add('clipboard-temp');
  textArea.value = text;

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (document.execCommand('copy')) {
      console.log('Bom copied to clipboard.');
    }
  } catch (err) {
    console.log('Can not copy to clipboard.');
  }

  document.body.removeChild(textArea);
}

function removeGutterNode(node) {
  for (var i = 0; i < node.childNodes.length; i++) {
    if (node.childNodes[i].classList &&
      node.childNodes[i].classList.contains("gutter")) {
      node.removeChild(node.childNodes[i]);
      break;
    }
  }
}

function cleanGutters() {
  removeGutterNode(document.getElementById("bot"));
  removeGutterNode(document.getElementById("canvasdiv"));
}

var units = {
  prefixes: {
    giga: ["G", "g", "giga", "Giga", "GIGA"],
    mega: ["M", "mega", "Mega", "MEGA"],
    kilo: ["K", "k", "kilo", "Kilo", "KILO"],
    milli: ["m", "milli", "Milli", "MILLI"],
    micro: ["U", "u", "micro", "Micro", "MICRO", "μ", "µ"], // different utf8 μ
    nano: ["N", "n", "nano", "Nano", "NANO"],
    pico: ["P", "p", "pico", "Pico", "PICO"],
  },
  unitsShort: ["R", "r", "Ω", "F", "f", "H", "h"],
  unitsLong: [
    "OHM", "Ohm", "ohm", "ohms",
    "FARAD", "Farad", "farad",
    "HENRY", "Henry", "henry"
  ],
  getMultiplier: function(s) {
    if (this.prefixes.giga.includes(s)) return 1e9;
    if (this.prefixes.mega.includes(s)) return 1e6;
    if (this.prefixes.kilo.includes(s)) return 1e3;
    if (this.prefixes.milli.includes(s)) return 1e-3;
    if (this.prefixes.micro.includes(s)) return 1e-6;
    if (this.prefixes.nano.includes(s)) return 1e-9;
    if (this.prefixes.pico.includes(s)) return 1e-12;
    return 1;
  },
  valueRegex: null,
}

function initUtils() {
  var allPrefixes = units.prefixes.giga
                    .concat(units.prefixes.mega)
                    .concat(units.prefixes.kilo)
                    .concat(units.prefixes.milli)
                    .concat(units.prefixes.micro)
                    .concat(units.prefixes.nano)
                    .concat(units.prefixes.pico);
  var allUnits = units.unitsShort.concat(units.unitsLong);
  units.valueRegex = new RegExp("^([0-9\.]+)" +
                         "\\s*(" + allPrefixes.join("|") + ")?" +
                         "(" + allUnits.join("|") + ")?" +
                         "(\\b.*)?$", "");
  units.valueAltRegex = new RegExp("^([0-9]*)" +
                         "(" + units.unitsShort.join("|") + ")?" +
                         "([GgMmKkUuNnPp])?" +
                         "([0-9]*)" +
                         "(\\b.*)?$", "");
  for (var bom_type of ["both", "F", "B"]) {
    for (var row of pcbdata.bom[bom_type]) {
      row.push(parseValue(row[1], row[3][0][0]));
    }
  }
}

function parseValue(val, ref) {
  var inferUnit = (unit, ref) => {
    if (unit) {
      unit = unit.toLowerCase();
      if (unit == 'Ω' || unit == "ohm" || unit == "ohms") {
        unit = 'r';
      }
      unit = unit[0];
    } else {
      ref = /^([a-z]+)\d+$/i.exec(ref);
      if (ref) {
        ref = ref[1].toLowerCase();
        if (ref == "c") unit = 'f';
        else if (ref == "l") unit = 'h';
        else if (ref == "r" || ref == "rv") unit = 'r';
        else unit = null;
      }
    }
    return unit;
  };
  val = val.replace(/,/g, "");
  var match = units.valueRegex.exec(val);
  var unit;
  if (match) {
    val = parseFloat(match[1]);
    if (match[2]) {
      val = val * units.getMultiplier(match[2]);
    }
    unit = inferUnit(match[3], ref);
    if (!unit) return null;
    else return {
      val: val,
      unit: unit,
      extra: match[4],
    }
  }
  match = units.valueAltRegex.exec(val);
  if (match && (match[1] || match[4])) {
    val = parseFloat(match[1] + "." + match[4]);
    if (match[3]) {
      val = val * units.getMultiplier(match[3]);
    }
    unit = inferUnit(match[2], ref);
    if (!unit) return null;
    else return {
      val: val,
      unit: unit,
      extra: match[5],
    }
  }
  return null;
}

function valueCompare(a, b, stra, strb) {
  if (a === null && b === null) {
    // Failed to parse both values, compare them as strings.
    if (stra != strb) return stra > strb ? 1 : -1;
    else return 0;
  } else if (a === null) {
    return 1;
  } else if (b === null) {
    return -1;
  } else {
    if (a.unit != b.unit) return a.unit > b.unit ? 1 : -1;
    else if (a.val != b.val) return a.val > b.val ? 1 : -1;
    else if (a.extra != b.extra) return a.extra > b.extra ? 1 : -1;
    else return 0;
  }
}

function validateSaveImgDimension(element) {
  var valid = false;
  var intValue = 0;
  if (/^[1-9]\d*$/.test(element.value)) {
    intValue = parseInt(element.value);
    if (intValue <= 16000) {
      valid = true;
    }
  }
  if (valid) {
    element.classList.remove("invalid");
  } else {
    element.classList.add("invalid");
  }
  return intValue;
}

function saveImage(layer) {
  var width = validateSaveImgDimension(document.getElementById("render-save-width"));
  var height = validateSaveImgDimension(document.getElementById("render-save-height"));
  var bgcolor = null;
  if (!document.getElementById("render-save-transparent").checked) {
    var style = getComputedStyle(topmostdiv);
    bgcolor = style.getPropertyValue("background-color");
  }
  if (!width || !height) return;

  // Prepare image
  var canvas = document.createElement("canvas");
  var layerdict = {
    transform: {
      x: 0,
      y: 0,
      s: 1,
      panx: 0,
      pany: 0,
      zoom: 1,
    },
    bg: canvas,
    fab: canvas,
    silk: canvas,
    highlight: canvas,
    layer: layer,
  }
  // Do the rendering
  recalcLayerScale(layerdict, width, height);
  prepareLayer(layerdict);
  clearCanvas(canvas, bgcolor);
  drawBackground(layerdict, false);
  drawHighlightsOnLayer(layerdict, false);

  // Save image
  var imgdata = canvas.toDataURL("image/png");

  var filename = pcbdata.metadata.title;
  if (pcbdata.metadata.revision) {
    filename += `.${pcbdata.metadata.revision}`;
  }
  filename += `.${layer}.png`;
  saveFile(filename, dataURLtoBlob(imgdata));
}

function saveSettings() {
  var data = {
    type: "InteractiveHtmlBom settings",
    version: 1,
    pcbmetadata: pcbdata.metadata,
    settings: settings,
  }
  var blob = new Blob([JSON.stringify(data, null, 4)], {type: "application/json"});
  saveFile(`${pcbdata.metadata.title}.settings.json`, blob);
}

function loadSettings() {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = ".settings.json";
  input.onchange = function(e) {
    var file = e.target.files[0];
    var reader = new FileReader();
    reader.onload = readerEvent => {
      var content = readerEvent.target.result;
      var newSettings;
      try {
        newSettings = JSON.parse(content);
      } catch(e) {
        alert(t("invalid_settings_file"));
        return;
      }
      if (newSettings.type != "InteractiveHtmlBom settings") {
        alert(t("invalid_settings_file"));
        return;
      }
      var metadataMatches = newSettings.hasOwnProperty("pcbmetadata");
      if (metadataMatches) {
        for (var k in pcbdata.metadata) {
          if (!newSettings.pcbmetadata.hasOwnProperty(k) || newSettings.pcbmetadata[k] != pcbdata.metadata[k]) {
            metadataMatches = false;
          }
        }
      }
      if (!metadataMatches) {
        var currentMetadata = JSON.stringify(pcbdata.metadata, null, 4);
        var fileMetadata = JSON.stringify(newSettings.pcbmetadata, null, 4);
        if (!confirm(
          `${t("settings_metadata_mismatch")}\n\n` +
          `${t("page_metadata")}:\n${currentMetadata}\n\n` +
          `${t("settings_file_metadata")}:\n${fileMetadata}\n\n` +
          `${t("import_anyway")}`)) {
          return;
        }
      }
      overwriteSettings(newSettings.settings);
    }
    reader.readAsText(file, 'UTF-8');
  }
  input.click();
}

function overwriteSettings(newSettings) {
  initDone = false;
  Object.assign(settings, newSettings);
  writeStorage("bomlayout", settings.bomlayout);
  writeStorage("bommode", settings.bommode);
  writeStorage("canvaslayout", settings.canvaslayout);
  writeStorage("bomCheckboxes", settings.checkboxes.join(","));
  document.getElementById("bomCheckboxes").value = settings.checkboxes.join(",");
  for (var checkbox of settings.checkboxes) {
    writeStorage("checkbox_" + checkbox, settings.checkboxStoredRefs[checkbox]);
  }
  writeStorage("darkenWhenChecked", settings.darkenWhenChecked);
  writeStorage("theme", settings.theme || "light");
  padsVisible(settings.renderPads);
  document.getElementById("padsCheckbox").checked = settings.renderPads;
  fabricationVisible(settings.renderFabrication);
  document.getElementById("fabricationCheckbox").checked = settings.renderFabrication;
  silkscreenVisible(settings.renderSilkscreen);
  document.getElementById("silkscreenCheckbox").checked = settings.renderSilkscreen;
  referencesVisible(settings.renderReferences);
  document.getElementById("referencesCheckbox").checked = settings.renderReferences;
  valuesVisible(settings.renderValues);
  document.getElementById("valuesCheckbox").checked = settings.renderValues;
  tracksVisible(settings.renderTracks);
  document.getElementById("tracksCheckbox").checked = settings.renderTracks;
  zonesVisible(settings.renderZones);
  document.getElementById("zonesCheckbox").checked = settings.renderZones;
  dnpOutline(settings.renderDnpOutline);
  document.getElementById("dnpOutlineCheckbox").checked = settings.renderDnpOutline;
  setRedrawOnDrag(settings.redrawOnDrag);
  document.getElementById("dragCheckbox").checked = settings.redrawOnDrag;
  setTheme(settings.theme || (settings.darkMode ? "dark" : "light"));
  document.getElementById("darkmodeCheckbox").checked = settings.theme == "dark";
  setHighlightPin1(settings.highlightpin1);
  document.getElementById("highlightpin1Checkbox").checked = settings.highlightpin1;
  writeStorage("boardRotation", settings.boardRotation);
  document.getElementById("boardRotation").value = settings.boardRotation / 5;
  document.getElementById("rotationDegree").textContent = settings.boardRotation;
  initDone = true;
  prepCheckboxes();
  changeBomLayout(settings.bomlayout);
}

function saveFile(filename, blob) {
  var link = document.createElement("a");
  var objurl = URL.createObjectURL(blob);
  link.download = filename;
  link.href = objurl;
  link.click();
}

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

var settings = {
  canvaslayout: "default",
  bomlayout: "default",
  bommode: "grouped",
  checkboxes: [],
  checkboxStoredRefs: {},
  lang: "en",
  theme: "light",
  darkMode: false,
  highlightpin1: false,
  redrawOnDrag: true,
  boardRotation: 0,
  renderPads: true,
  renderReferences: true,
  renderValues: true,
  renderSilkscreen: true,
  renderFabrication: true,
  renderDnpOutline: false,
  renderTracks: true,
  renderZones: true,
}

var i18nDict = {
  en: {
    theme: "Theme",
    theme_light: "Light",
    theme_dark: "Dark",
    theme_apple: "Apple",
    theme_blue: "Blue Gray",
    theme_green: "Eye Care Green",
    language: "Language",
    lang_en: "English",
    lang_zh: "中文",
    lang_ja: "日本語",
    lang_ko: "한국어",
    lang_fr: "Français",
    lang_de: "Deutsch",
    lang_es: "Español",
    lang_ru: "Русский",
    lang_pt: "Português",
    lang_it: "Italiano",
    language_search: "Search languages",
    dark_mode: "Dark mode",
    full_screen: "Full Screen",
    fab_layer: "Fab layer",
    silkscreen: "Silkscreen",
    references: "References",
    values: "Values",
    tracks: "Tracks",
    zones: "Zones",
    pads: "Pads",
    dnp_outlined: "DNP outlined",
    highlight_pin1: "Highlight first pin",
    continuous_redraw: "Continuous redraw on drag",
    board_rotation: "Board rotation",
    bom_checkboxes: "Bom checkboxes",
    darken_when_checked: "Darken when checked",
    created_using: "Created using",
    front_only: "Front only",
    front_and_back: "Front and Back",
    back_only: "Back only",
    bom_only: "BOM only",
    bom_left_right: "BOM left, drawings right",
    bom_top_bottom: "BOM top, drawings bot",
    grouped_bom: "Grouped BOM",
    ungrouped_bom: "Ungrouped BOM",
    netlist: "Netlist",
    board_stats: "Board stats",
    front: "Front",
    back: "Back",
    total: "Total",
    components: "Components",
    groups: "Groups",
    smd_pads: "SMD pads",
    th_pads: "TH pads",
    checkboxes_label: "Checkboxes",
    save_board_image: "Save board image",
    config_checkbox_state: "Config and checkbox state",
    export: "Export",
    import: "Import",
    transparent_background: "Transparent background",
    width: "Width",
    height: "Height",
    title: "Title",
    revision: "Revision",
    company: "Company",
    date: "Date",
    html_version: "HTML Version",
    html_version_prefix: "HTML Version: ",
    ref_lookup: "Ref lookup",
    filter: "Filter",
    copy_bom: "Copy bom table to clipboard",
    invalid_settings_file: "Selected file is not an InteractiveHtmlBom settings file.",
    settings_metadata_mismatch: "Settings file metadata does not match current metadata.",
    page_metadata: "Page metadata",
    settings_file_metadata: "Settings file metadata",
    import_anyway: "Press OK if you would like to import settings anyway.",
    net_name: "Net name",
    references_col: "References",
    value_col: "Value",
    footprint_col: "Footprint",
    quantity_col: "Quantity",
    none: "None",
    rev_prefix: "Rev: ",
    bom_title_suffix: " BOM",
  },
  zh: {
    theme: "主题",
    theme_light: "浅色",
    theme_dark: "深色",
    theme_apple: "苹果风",
    theme_blue: "蓝灰",
    theme_green: "护眼绿",
    language: "语言",
    lang_en: "English",
    lang_zh: "中文",
    lang_ja: "日本語",
    lang_ko: "한국어",
    lang_fr: "Français",
    lang_de: "Deutsch",
    lang_es: "Español",
    lang_ru: "Русский",
    lang_pt: "Português",
    lang_it: "Italiano",
    language_search: "搜索语言",
    dark_mode: "深色模式",
    full_screen: "全屏",
    fab_layer: "加工层",
    silkscreen: "丝印",
    references: "位号",
    values: "数值",
    tracks: "走线",
    zones: "铺铜",
    pads: "焊盘",
    dnp_outlined: "DNP 标记",
    highlight_pin1: "高亮 1 脚",
    continuous_redraw: "拖动实时重绘",
    board_rotation: "板旋转",
    bom_checkboxes: "BOM 复选框",
    darken_when_checked: "勾选后变暗",
    created_using: "基于",
    front_only: "仅正面",
    front_and_back: "正反面",
    back_only: "仅背面",
    bom_only: "仅 BOM",
    bom_left_right: "BOM 左/板图右",
    bom_top_bottom: "BOM 上/板图下",
    grouped_bom: "分组",
    ungrouped_bom: "展开",
    netlist: "网络表",
    board_stats: "板信息",
    front: "正面",
    back: "背面",
    total: "总计",
    components: "元件",
    groups: "分组",
    smd_pads: "SMD 焊盘",
    th_pads: "通孔焊盘",
    checkboxes_label: "复选框",
    save_board_image: "保存板图",
    config_checkbox_state: "配置和复选框状态",
    export: "导出",
    import: "导入",
    transparent_background: "透明背景",
    width: "宽",
    height: "高",
    title: "标题",
    revision: "版本",
    company: "公司",
    date: "日期",
    html_version: "页面版本",
    html_version_prefix: "页面版本：",
    ref_lookup: "位号查找",
    filter: "筛选",
    copy_bom: "复制 BOM 表到剪贴板",
    invalid_settings_file: "所选文件不是 InteractiveHtmlBom 的设置文件。",
    settings_metadata_mismatch: "设置文件中的元数据与当前页面不一致。",
    page_metadata: "页面元数据",
    settings_file_metadata: "设置文件元数据",
    import_anyway: "如果仍要继续导入，请点击确定。",
    net_name: "网络名",
    references_col: "位号",
    value_col: "数值",
    footprint_col: "封装",
    quantity_col: "数量",
    none: "无",
    rev_prefix: "版本：",
    bom_title_suffix: " BOM",
  },
  ja: {
    theme: "テーマ",
    theme_light: "ライト",
    theme_dark: "ダーク",
    theme_apple: "Apple",
    theme_blue: "ブルーグレー",
    theme_green: "アイケアグリーン",
    language: "言語",
    lang_en: "English",
    lang_zh: "中文",
    lang_ja: "日本語",
    lang_ko: "한국어",
    lang_fr: "Français",
    lang_de: "Deutsch",
    lang_es: "Español",
    lang_ru: "Русский",
    lang_pt: "Português",
    lang_it: "Italiano",
    language_search: "言語を検索",
    dark_mode: "ダークモード",
    full_screen: "全画面",
    fab_layer: "製造層",
    silkscreen: "シルク",
    references: "参照",
    values: "値",
    tracks: "配線",
    zones: "ゾーン",
    pads: "パッド",
    dnp_outlined: "DNP",
    highlight_pin1: "1番ピンを強調",
    continuous_redraw: "ドラッグ中に再描画",
    board_rotation: "基板回転",
    bom_checkboxes: "BOM チェックボックス",
    darken_when_checked: "チェック時に暗くする",
    created_using: "Created using",
    front_only: "表のみ",
    front_and_back: "両面",
    back_only: "裏のみ",
    bom_only: "BOM のみ",
    bom_left_right: "左BOM / 右基板",
    bom_top_bottom: "上BOM / 下基板",
    grouped_bom: "グループ",
    ungrouped_bom: "展開",
    netlist: "ネットリスト",
    board_stats: "統計",
    front: "表",
    back: "裏",
    total: "合計",
    components: "部品",
    groups: "グループ",
    smd_pads: "SMD パッド",
    th_pads: "TH パッド",
    checkboxes_label: "チェック",
    save_board_image: "画像を保存",
    config_checkbox_state: "設定とチェック状態",
    export: "書き出し",
    import: "読み込み",
    transparent_background: "透明背景",
    width: "幅",
    height: "高さ",
    title: "タイトル",
    revision: "版",
    company: "会社",
    date: "日付",
    html_version: "HTML バージョン",
    html_version_prefix: "HTML バージョン: ",
    ref_lookup: "参照検索",
    filter: "フィルター",
    copy_bom: "BOM をクリップボードへコピー",
    invalid_settings_file: "選択したファイルは InteractiveHtmlBom の設定ファイルではありません。",
    settings_metadata_mismatch: "設定ファイルのメタデータが現在のページと一致しません。",
    page_metadata: "ページのメタデータ",
    settings_file_metadata: "設定ファイルのメタデータ",
    import_anyway: "続行する場合は OK を押してください。",
    net_name: "ネット名",
    references_col: "参照",
    value_col: "値",
    footprint_col: "フットプリント",
    quantity_col: "数量",
    none: "なし",
    rev_prefix: "Rev: ",
    bom_title_suffix: " BOM",
  },
  ko: {
    theme: "테마",
    theme_light: "라이트",
    theme_dark: "다크",
    theme_apple: "Apple",
    theme_blue: "블루 그레이",
    theme_green: "눈 보호 그린",
    language: "언어",
    lang_en: "English",
    lang_zh: "中文",
    lang_ja: "日本語",
    lang_ko: "한국어",
    lang_fr: "Français",
    lang_de: "Deutsch",
    lang_es: "Español",
    lang_ru: "Русский",
    lang_pt: "Português",
    lang_it: "Italiano",
    language_search: "언어 검색",
    dark_mode: "다크 모드",
    full_screen: "전체 화면",
    fab_layer: "가공 레이어",
    silkscreen: "실크",
    references: "참조",
    values: "값",
    tracks: "트랙",
    zones: "존",
    pads: "패드",
    dnp_outlined: "DNP 표시",
    highlight_pin1: "1번 핀 강조",
    continuous_redraw: "드래그 중 재그리기",
    board_rotation: "보드 회전",
    bom_checkboxes: "BOM 체크박스",
    darken_when_checked: "체크 시 어둡게",
    created_using: "Created using",
    front_only: "앞면만",
    front_and_back: "양면",
    back_only: "뒷면만",
    bom_only: "BOM만",
    bom_left_right: "왼쪽 BOM / 오른쪽 보드",
    bom_top_bottom: "위 BOM / 아래 보드",
    grouped_bom: "그룹",
    ungrouped_bom: "펼치기",
    netlist: "넷리스트",
    board_stats: "보드 통계",
    front: "앞",
    back: "뒤",
    total: "합계",
    components: "부품",
    groups: "그룹",
    smd_pads: "SMD 패드",
    th_pads: "TH 패드",
    checkboxes_label: "체크박스",
    save_board_image: "보드 이미지 저장",
    config_checkbox_state: "설정 및 체크 상태",
    export: "내보내기",
    import: "가져오기",
    transparent_background: "투명 배경",
    width: "너비",
    height: "높이",
    title: "제목",
    revision: "리비전",
    company: "회사",
    date: "날짜",
    html_version: "HTML 버전",
    html_version_prefix: "HTML 버전: ",
    ref_lookup: "참조 검색",
    filter: "필터",
    copy_bom: "BOM을 클립보드로 복사",
    invalid_settings_file: "선택한 파일은 InteractiveHtmlBom 설정 파일이 아닙니다.",
    settings_metadata_mismatch: "설정 파일 메타데이터가 현재 페이지와 일치하지 않습니다.",
    page_metadata: "페이지 메타데이터",
    settings_file_metadata: "설정 파일 메타데이터",
    import_anyway: "계속하려면 확인을 누르세요.",
    net_name: "넷 이름",
    references_col: "참조",
    value_col: "값",
    footprint_col: "풋프린트",
    quantity_col: "수량",
    none: "없음",
    rev_prefix: "Rev: ",
    bom_title_suffix: " BOM",
  },
};

function inferLang() {
  try {
    var lang = (navigator.language || "en").toLowerCase();
    if (lang.indexOf("zh") === 0) {
      return "zh";
    }
    if (lang.indexOf("ja") === 0) {
      return "ja";
    }
    if (lang.indexOf("ko") === 0) {
      return "ko";
    }
    if (lang.indexOf("fr") === 0) {
      return "fr";
    }
    if (lang.indexOf("de") === 0) {
      return "de";
    }
    if (lang.indexOf("es") === 0) {
      return "es";
    }
    if (lang.indexOf("ru") === 0) {
      return "ru";
    }
    if (lang.indexOf("pt") === 0) {
      return "pt";
    }
    if (lang.indexOf("it") === 0) {
      return "it";
    }
  } catch(e) {}
  return "en";
}

function applyTheme(theme) {
  var themes = ["light", "dark", "apple", "blue", "green"];
  if (!themes.includes(theme)) {
    theme = "light";
  }
  settings.theme = theme;
  topmostdiv.classList.remove("theme-light", "theme-dark", "theme-blue", "theme-green", "dark");
  topmostdiv.classList.remove("theme-apple");
  topmostdiv.classList.add("theme-" + theme);
  var isDark = (theme == "dark");
  if (theme == "apple") {
    try {
      isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch(e) {
      isDark = false;
    }
  }
  if (isDark) {
    topmostdiv.classList.add("dark");
  }
  var themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.value = theme;
  }
  var darkCheckbox = document.getElementById("darkmodeCheckbox");
  if (darkCheckbox) {
    darkCheckbox.checked = isDark;
  }
  settings.darkMode = isDark;
}

function setTheme(theme) {
  writeStorage("theme", theme);
  writeStorage("darkmode", theme == "dark");
  applyTheme(theme);
  if (typeof redrawIfInitDone === "function") {
    redrawIfInitDone();
  }
}

function initThemeWatcher() {
  if (!window.matchMedia) {
    return;
  }
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  var handler = function() {
    if (settings.theme == "apple") {
      applyTheme("apple");
      if (typeof redrawIfInitDone === "function") {
        redrawIfInitDone();
      }
    }
  };
  try {
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
    }
  } catch(e) {}
}

function t(key) {
  var lang = settings.lang || "en";
  if (Object.prototype.hasOwnProperty.call(i18nDict, lang) && Object.prototype.hasOwnProperty.call(i18nDict[lang], key)) {
    return i18nDict[lang][key];
  }
  if (Object.prototype.hasOwnProperty.call(i18nDict.en, key)) {
    return i18nDict.en[key];
  }
  return key;
}

function applyI18n(lang) {
  settings.lang = lang;
  var htmlLang = "en";
  if (lang == "zh") {
    htmlLang = "zh-CN";
  } else if (lang == "ja") {
    htmlLang = "ja";
  } else if (lang == "ko") {
    htmlLang = "ko";
  } else if (lang == "fr") {
    htmlLang = "fr";
  } else if (lang == "de") {
    htmlLang = "de";
  } else if (lang == "es") {
    htmlLang = "es";
  } else if (lang == "ru") {
    htmlLang = "ru";
  } else if (lang == "pt") {
    htmlLang = "pt";
  } else if (lang == "it") {
    htmlLang = "it";
  }
  document.documentElement.lang = htmlLang;
  var nodes = document.querySelectorAll("[data-i18n]");
  for (var i = 0; i < nodes.length; i++) {
    var k = nodes[i].getAttribute("data-i18n");
    if (nodes[i].tagName == "INPUT") {
      nodes[i].value = t(k);
    } else if (nodes[i].tagName == "OPTION") {
      nodes[i].text = t(k);
    } else {
      nodes[i].textContent = t(k);
    }
  }
  nodes = document.querySelectorAll("[data-i18n-title]");
  for (var i = 0; i < nodes.length; i++) {
    var k = nodes[i].getAttribute("data-i18n-title");
    nodes[i].title = t(k);
  }
  nodes = document.querySelectorAll("[data-i18n-placeholder]");
  for (var i = 0; i < nodes.length; i++) {
    var k = nodes[i].getAttribute("data-i18n-placeholder");
    nodes[i].placeholder = t(k);
  }
}

function filterLanguageOptions(query) {
  var sel = document.getElementById("langSelect");
  if (!sel) {
    return;
  }
  // Keep the browser control in single-line dropdown mode.
  sel.size = 1;
  var q = (query || "").trim().toLowerCase();
  for (var i = 0; i < sel.options.length; i++) {
    var opt = sel.options[i];
    if (opt.selected) {
      opt.hidden = false;
      continue;
    }
    if (q == "") {
      opt.hidden = false;
      continue;
    }
    var t = (opt.text || "").toLowerCase();
    var v = (opt.value || "").toLowerCase();
    opt.hidden = (t.indexOf(q) < 0 && v.indexOf(q) < 0);
  }
}

function setLanguage(lang) {
  writeStorage("lang", lang);
  applyI18n(lang);
  var langSearch = document.getElementById("langSearch");
  if (langSearch) {
    langSearch.value = "";
  }
  filterLanguageOptions("");
  if (typeof populateBomTable === "function") {
    populateBomTable();
  }
  if (typeof populateMetadata === "function") {
    populateMetadata();
  }
  if (typeof populateDarkenWhenCheckedOptions === "function") {
    populateDarkenWhenCheckedOptions();
  }
}

function initDefaults() {
  initThemeWatcher();
  settings.lang = readStorage("lang");
  if (settings.lang === null) {
    settings.lang = inferLang();
  }
  if (!["en", "zh", "ja", "ko", "fr", "de", "es", "ru", "pt", "it"].includes(settings.lang)) {
    settings.lang = "en";
  }
  var langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.size = 1;
    langSelect.value = settings.lang;
  }
  filterLanguageOptions("");
  applyI18n(settings.lang);

  settings.theme = readStorage("theme");
  if (settings.theme === null) {
    settings.theme = config.dark_mode ? "dark" : "light";
  }
  if (!["light", "dark", "apple", "blue", "green"].includes(settings.theme)) {
    settings.theme = "light";
  }
  applyTheme(settings.theme);

  settings.bomlayout = readStorage("bomlayout");
  if (settings.bomlayout === null) {
    settings.bomlayout = config.bom_view;
  }
  if (!['bom-only', 'left-right', 'top-bottom'].includes(settings.bomlayout)) {
    settings.bomlayout = config.bom_view;
  }
  settings.bommode = readStorage("bommode");
  if (settings.bommode === null) {
    settings.bommode = "grouped";
  }
  if (!["grouped", "ungrouped", "netlist"].includes(settings.bommode)) {
    settings.bommode = "grouped";
  }
  settings.canvaslayout = readStorage("canvaslayout");
  if (settings.canvaslayout === null) {
    settings.canvaslayout = config.layer_view;
  }
  var bomCheckboxes = readStorage("bomCheckboxes");
  if (bomCheckboxes === null) {
    bomCheckboxes = config.checkboxes;
  }
  settings.checkboxes = bomCheckboxes.split(",").filter((e) => e);
  document.getElementById("bomCheckboxes").value = bomCheckboxes;

  settings.darkenWhenChecked = readStorage("darkenWhenChecked") || "";
  populateDarkenWhenCheckedOptions();

  function initBooleanSetting(storageString, def, elementId, func) {
    var b = readStorage(storageString);
    if (b === null) {
      b = def;
    } else {
      b = (b == "true");
    }
    document.getElementById(elementId).checked = b;
    func(b);
  }

  initBooleanSetting("padsVisible", config.show_pads, "padsCheckbox", padsVisible);
  initBooleanSetting("fabricationVisible", config.show_fabrication, "fabricationCheckbox", fabricationVisible);
  initBooleanSetting("silkscreenVisible", config.show_silkscreen, "silkscreenCheckbox", silkscreenVisible);
  initBooleanSetting("referencesVisible", true, "referencesCheckbox", referencesVisible);
  initBooleanSetting("valuesVisible", true, "valuesCheckbox", valuesVisible);
  if ("tracks" in pcbdata) {
    initBooleanSetting("tracksVisible", true, "tracksCheckbox", tracksVisible);
    initBooleanSetting("zonesVisible", true, "zonesCheckbox", zonesVisible);
  } else {
    document.getElementById("tracksAndZonesCheckboxes").style.display = "none";
    tracksVisible(false);
    zonesVisible(false);
  }
  initBooleanSetting("dnpOutline", false, "dnpOutlineCheckbox", dnpOutline);
  initBooleanSetting("redrawOnDrag", config.redraw_on_drag, "dragCheckbox", setRedrawOnDrag);
  document.getElementById("darkmodeCheckbox").checked = settings.theme == "dark";
  initBooleanSetting("highlightpin1", config.highlight_pin1, "highlightpin1Checkbox", setHighlightPin1);
  settings.boardRotation = readStorage("boardRotation");
  if (settings.boardRotation === null) {
    settings.boardRotation = config.board_rotation * 5;
  } else {
    settings.boardRotation = parseInt(settings.boardRotation);
  }
  document.getElementById("boardRotation").value = settings.boardRotation / 5;
  document.getElementById("rotationDegree").textContent = settings.boardRotation;
}

// Helper classes for user js callbacks.

const IBOM_EVENT_TYPES = {
  ALL: "all",
  HIGHLIGHT_EVENT: "highlightEvent",
  CHECKBOX_CHANGE_EVENT: "checkboxChangeEvent",
  BOM_BODY_CHANGE_EVENT: "bomBodyChangeEvent",
}

const EventHandler = {
  callbacks: {},
  init: function() {
    for (eventType of Object.values(IBOM_EVENT_TYPES))
      this.callbacks[eventType] = [];
  },
  registerCallback: function(eventType, callback) {
    this.callbacks[eventType].push(callback);
  },
  emitEvent: function(eventType, eventArgs) {
    event = {
      eventType: eventType,
      args: eventArgs,
    }
    var callback;
    for(callback of this.callbacks[eventType])
      callback(event);
    for(callback of this.callbacks[IBOM_EVENT_TYPES.ALL])
      callback(event);
  }
}
EventHandler.init();
