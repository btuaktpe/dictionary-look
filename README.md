# Dictionary Look

An Obsidian plugin for dictionary-style notes: serif headwords, muted labels, and a dark HUD glass workspace.

On macOS it uses system **New York** and **SF Pro**, plus Electron HUD vibrancy. On Windows and Linux it falls back to system serif and sans-serif faces. Designed for **dark theme**.

## Install

Community directory listing is not submitted yet. Until then:

### Manual

1. Download `dictionary-look.zip` from the [latest release](https://github.com/btuaktpe/dictionary-look/releases/latest).
2. Unzip it into `Vault/.obsidian/plugins/dictionary-look/`.
3. Reload Obsidian (`Cmd+R` / `Ctrl+R`).
4. Enable **Dictionary Look** in Settings → Community plugins.
5. Use a dark theme. On Mac, turn on **Settings → Appearance → Native translucent titlebar** (or Translucency).

### BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Add the beta plugin `btuaktpe/dictionary-look`.

## Markup

| Markdown | Role |
| --- | --- |
| `# Headword` | Large serif title |
| `## Homograph` | Secondary serif title |
| `> \| pronunciation \|` | Gray phonetic line |
| `==noun==` | Small sans-serif label |
| `#### ORIGIN` | Small-caps section label |
| plain text / lists | Serif definition |
| `*muted*` | Upright gray serif |
| `_example_` | Italic gray serif |

Command Palette (search **Sözlük** or **Dictionary**) can apply each role. No default hotkeys — assign your own in Settings → Hotkeys.

## Notes

- Fonts are not bundled. macOS already has New York and SF Pro; other systems use fallbacks.
- HUD glass is macOS-only. Other platforms keep the dark type ramp without vibrancy.
- The plugin is dark-theme only.

## License

[MIT](LICENSE)
