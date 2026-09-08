"use strict";

const { Plugin, MarkdownRenderChild, Platform } = require("obsidian");

const VIBRANCY = "hud";
const HUD_OVERLAY = "rgba(0, 0, 0, 0.38)";
const EMPHASIS_RETRY_MS = 80;

const NY = '"New York", ui-serif, "Iowan Old Style", Palatino, Georgia, serif';
const NY_XL = '".New York Extra Large", "New York Extra Large", "New York", ui-serif, "Iowan Old Style", Palatino, Georgia, serif';
const NY_L = '".New York Large", "New York Large", "New York", ui-serif, "Iowan Old Style", Palatino, Georgia, serif';
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", system-ui, sans-serif';

const GLASS_PROPS = {
  "--workspace-background-translucent": HUD_OVERLAY,
  "--titlebar-background": "transparent",
  "--titlebar-background-focused": "transparent",
  "--translucent-dark-opacity": "0%",
  "--background-primary": "transparent",
  "--background-secondary": "transparent",
  "--background-modifier-cover": "transparent",
};

const TYPE_PROPS = {
  "--font-text": NY,
  "--font-text-theme": NY,
  "--font-text-override": "New York",
  "--font-heading": NY,
  "--h1-font": NY_XL,
  "--h2-font": NY_L,
  "--h3-font": NY,
  "--h4-font": SF,
  "--h5-font": SF,
  "--h6-font": SF,
  "--inline-title-font": NY,
  "--font-interface": SF,
  "--font-interface-theme": SF,
  "--font-interface-override": SF,
  "--h1-weight": "700",
  "--h2-weight": "700",
  "--h3-weight": "700",
};

function isEscaped(md, index) {
  return index > 0 && md[index - 1] === "\\";
}

function skipTo(md, start, close, closeLength = close.length) {
  const end = md.indexOf(close, start);
  return end === -1 ? md.length : end + closeLength;
}

function skipFence(md, start) {
  const fence = md.startsWith("```", start) ? "```" : "~~~";
  const lineEnd = md.indexOf("\n", start);
  if (lineEnd === -1) return md.length;
  return skipTo(md, lineEnd + 1, "\n" + fence, fence.length + 1);
}

function parseEmphasis(md) {
  const hits = [];
  if (!md) return hits;

  const n = md.length;
  let i = 0;

  while (i < n) {
    const atLine = i === 0 || md[i - 1] === "\n";

    if (atLine && (md.startsWith("```", i) || md.startsWith("~~~", i))) {
      i = skipFence(md, i);
      continue;
    }
    if (md[i] === "`") {
      i = skipTo(md, i + 1, "`", 1);
      continue;
    }
    if (md.startsWith("==", i) || md.startsWith("~~", i) || md.startsWith("**", i) || md.startsWith("__", i)) {
      const mark = md.slice(i, i + 2);
      i = skipTo(md, i + 2, mark, 2);
      continue;
    }
    if (atLine && "*+-".includes(md[i]) && md[i + 1] === " ") {
      i += 2;
      continue;
    }

    const mark = md[i];
    if ((mark === "*" || mark === "_") && !isEscaped(md, i)) {
      let j = i + 1;
      let close = -1;
      while (j < n) {
        if (md[j] === "\n" && mark === "_") break;
        if (md[j] === mark && !isEscaped(md, j)) {
          if (md[j + 1] === mark) {
            j += 2;
            continue;
          }
          if (j > i + 1) {
            close = j;
            break;
          }
        }
        j++;
      }
      if (close !== -1) {
        hits.push({ delim: mark, from: i, to: close + 1, text: md.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }
    i++;
  }

  return hits;
}

function setEmphasisClass(el, delim) {
  if (!el || !el.classList) return;
  el.classList.remove("em-star", "em-under");
  el.classList.add(delim === "*" ? "em-star" : "em-under");
}

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function applyEmphasisToTree(root, markdown) {
  const nodes = Array.from(root.querySelectorAll("em"));
  const hits = parseEmphasis(markdown);
  if (!nodes.length || !hits.length) return;

  if (nodes.length === hits.length) {
    nodes.forEach((node, i) => setEmphasisClass(node, hits[i].delim));
    return;
  }

  let cursor = 0;
  for (const node of nodes) {
    const inner = normalize(node.textContent);
    for (let i = cursor; i < hits.length; i++) {
      if (normalize(hits[i].text) === inner) {
        setEmphasisClass(node, hits[i].delim);
        cursor = i + 1;
        break;
      }
    }
  }
}

class ReadingEmphasis extends MarkdownRenderChild {
  constructor(el, ctx, plugin) {
    super(el);
    this.ctx = ctx;
    this.plugin = plugin;
  }

  onload() {
    this.apply();
    const timer = window.setTimeout(() => this.apply(), EMPHASIS_RETRY_MS);
    this.register(() => window.clearTimeout(timer));
  }

  apply() {
    const preview = this.containerEl.closest(".markdown-preview-view") || this.containerEl;
    const info = this.ctx.getSectionInfo(this.containerEl);
    if (info && info.text) {
      applyEmphasisToTree(this.containerEl, info.text);
      applyEmphasisToTree(preview, info.text);
    }

    const file = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!file) return;
    void this.plugin.app.vault.cachedRead(file).then((md) => {
      if (!this.containerEl.isConnected) return;
      applyEmphasisToTree(this.containerEl, md);
      applyEmphasisToTree(preview, md);
    });
  }
}

function createEmphasisExtension() {
  let ViewPlugin;
  let Decoration;
  let RangeSetBuilder;
  try {
    ({ ViewPlugin, Decoration } = require("@codemirror/view"));
    ({ RangeSetBuilder } = require("@codemirror/state"));
  } catch {
    return null;
  }

  const star = Decoration.mark({ class: "em-star" });
  const under = Decoration.mark({ class: "em-under" });

  const build = (view) => {
    const set = new RangeSetBuilder();
    for (const hit of parseEmphasis(view.state.doc.toString())) {
      set.add(hit.from, hit.to, hit.delim === "*" ? star : under);
    }
    return set.finish();
  };

  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = build(view);
      }
      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
}

function styleEditorEmphasis() {
  document.querySelectorAll(".cm-content .cm-line").forEach((line) => {
    const hits = parseEmphasis(line.textContent || "");
    const marks = line.querySelectorAll(".cm-em");
    if (!hits.length || !marks.length) return;

    if (hits.every((hit) => hit.delim === hits[0].delim)) {
      marks.forEach((node) => setEmphasisClass(node, hits[0].delim));
      return;
    }

    line.querySelectorAll("span").forEach((span) => {
      const token = span.textContent;
      if (token !== "*" && token !== "_") return;
      let node = span;
      for (let depth = 0; depth < 6 && node; depth++) {
        if (node.classList && node.classList.contains("cm-em")) {
          setEmphasisClass(node, token);
        }
        node = node.parentElement;
      }
    });
  });
}

function stripRole(line) {
  return line.replace(/^#{1,6}\s+/, "").replace(/^>\s+/, "");
}

function setLinePrefix(editor, prefix) {
  const cursor = editor.getCursor();
  const body = stripRole(editor.getLine(cursor.line));
  editor.setLine(cursor.line, prefix + body);
  editor.setCursor({ line: cursor.line, ch: (prefix + body).length });
}

function toggleWrap(editor, left, right) {
  const from = editor.getCursor("from");
  const selected = editor.getSelection();
  if (!selected) {
    editor.replaceRange(left + right, from);
    editor.setCursor({ line: from.line, ch: from.ch + left.length });
    return;
  }
  if (
    selected.startsWith(left) &&
    selected.endsWith(right) &&
    selected.length >= left.length + right.length
  ) {
    editor.replaceSelection(selected.slice(left.length, selected.length - right.length));
    return;
  }
  editor.replaceSelection(left + selected + right);
}

function clearRole(editor) {
  const selected = editor.getSelection();
  if (selected) {
    editor.replaceSelection(
      selected
        .replace(/^==/, "")
        .replace(/==$/, "")
        .replace(/^\*/, "")
        .replace(/\*$/, "")
        .replace(/^_/, "")
        .replace(/_$/, "")
    );
    return;
  }
  setLinePrefix(editor, "");
}

function setPhonetic(editor) {
  const cursor = editor.getCursor();
  const body = stripRole(editor.getLine(cursor.line)).replace(/^\|\s*|\s*\|$/g, "");
  editor.setLine(cursor.line, body ? `> | ${body} |` : "> |  |");
}

const COMMANDS = [
  { id: "headword", name: "Sözlük: Madde başı (New York Bold)", run: (e) => setLinePrefix(e, "# ") },
  { id: "homograph", name: "Sözlük: Alt madde Q¹ (New York Bold)", run: (e) => setLinePrefix(e, "## ") },
  { id: "phonetic", name: "Sözlük: Telaffuz (New York gri)", run: setPhonetic },
  { id: "label", name: "Sözlük: Etiket noun (SF Pro gri)", run: (e) => toggleWrap(e, "==", "==") },
  { id: "origin", name: "Sözlük: ORIGIN (SF Pro caps)", run: (e) => setLinePrefix(e, "#### ") },
  { id: "example", name: "Sözlük: Örnek cümle (New York italic)", run: (e) => toggleWrap(e, "_", "_") },
  { id: "muted", name: "Sözlük: Silik serif (New York gri)", run: (e) => toggleWrap(e, "*", "*") },
  { id: "definition", name: "Sözlük: Tanım (New York regular)", run: clearRole },
];

class DictionaryLook extends Plugin {
  async onload() {
    this.electronWindow = this.getElectronWindow();
    this.applyGlass();

    const extension = createEmphasisExtension();
    if (extension) this.registerEditorExtension(extension);

    this.registerMarkdownPostProcessor((el, ctx) => {
      ctx.addChild(new ReadingEmphasis(el, ctx, this));
    });

    this.registerEvent(this.app.workspace.on("editor-change", () => this.queueEditorEmphasis()));

    this.app.workspace.onLayoutReady(() => {
      if (!this.electronWindow) this.electronWindow = this.getElectronWindow();
      styleEditorEmphasis();
      this.applyGlass();
    });

    for (const command of COMMANDS) {
      this.addCommand({
        id: command.id,
        name: command.name,
        editorCallback: command.run,
      });
    }
  }

  onunload() {
    if (this._emphasisFrame) {
      window.cancelAnimationFrame(this._emphasisFrame);
      this._emphasisFrame = 0;
    }
    if (!Platform.isMacOS || !this.electronWindow) return;
    try {
      this.electronWindow.setVibrancy(null);
      this.electronWindow.setBackgroundColor("#1e1e1e");
    } catch {
      /* window already gone */
    }
  }

  getElectronWindow() {
    try {
      const req = typeof require !== "undefined" ? require : window.require;
      const remote = req && req("@electron/remote");
      return remote && remote.getCurrentWindow ? remote.getCurrentWindow() : null;
    } catch {
      return null;
    }
  }

  applyCssProps(props) {
    const root = document.body;
    if (!root) return;
    if (root.setCssProps) root.setCssProps(props);
    for (const [name, value] of Object.entries(props)) {
      root.style.setProperty(name, value, "important");
    }
  }

  applyGlass() {
    if (!Platform.isMacOS) return;

    const vault = this.app.vault;
    if (vault.getConfig && !vault.getConfig("translucency") && vault.setConfig) {
      vault.setConfig("translucency", true);
    }

    document.documentElement.style.backgroundColor = "transparent";
    document.body.classList.add("is-translucent");
    document.body.style.backgroundColor = "transparent";
    this.applyCssProps(GLASS_PROPS);
    this.applyCssProps(TYPE_PROPS);

    if (!this.electronWindow) return;
    try {
      this.electronWindow.setBackgroundColor("#00000000");
      this.electronWindow.setVibrancy(VIBRANCY);
    } catch {
      /* vibrancy unavailable */
    }
  }

  queueEditorEmphasis() {
    if (this._emphasisFrame) return;
    this._emphasisFrame = window.requestAnimationFrame(() => {
      this._emphasisFrame = 0;
      styleEditorEmphasis();
    });
  }
}

module.exports = DictionaryLook;
