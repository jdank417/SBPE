# SBPE — Flowchart Editor

> English translation of [zhangyuanliang/flowchart](https://github.com/zhangyuanliang/flowchart) (MIT License, © zhangyuanliang).
> All UI text, comments, and config labels have been translated from Chinese to English.

Original demo (Chrome, Chinese UI):
> &mdash;[**Demo Online**](https://zhangyuanliang.github.io/flowchart/flowchart.html)

SVG-based flowchart drawing. Front-end stack: `jquery.js` / `d3.js` / `semantic.css`

Features:
- Create, drag and connect flowchart blocks
- Zoom in/out
- Import/export `json` data
- Generates the corresponding `xml` and `xpdl`
- **Open existing XPDL files** (toolbar folder icon, or drag a file onto the canvas)
- **Save** (toolbar save icon or Ctrl/Cmd+S; Shift for Save As). Files opened from disk are saved back
  losslessly — see below

## Opening XPDL files

Click the **folder icon** in the toolbar (or drop a `.xpdl` / `.xml` file onto the canvas). The importer
(`js/xpdlImport.js`) reads XPDL from any tool:

- **Versions:** XPDL 1.0, 2.0, 2.1 and 2.2 (plus older drafts), with or without namespace prefixes, and
  bare `<WorkflowProcesses>` fragments
- **Encodings:** UTF-8, UTF-16, Windows-1252/Latin-1 and anything declared in the XML header
- **Layouts:** XPDL 2.x `NodeGraphicsInfo` (absolute or lane-relative, horizontal or vertical pools),
  JaWE/TWE lane offsets, and this editor's own format. Files with no layout are arranged automatically
- **Colors:** fill/border colors of activities and events, and line colors of transitions, in every format
  tools use (`220,220,220`, `220;220;220`, .NET ARGB integers like `-16553830`, `#RRGGBB`, `#AARRGGBB`,
  color names). They're kept when you save.
- **Content:** activities, routes/gateways, sub-flows, block activities/embedded sub-processes (open them
  with right-click → Edit), BPMN start/end events, transitions and conditions, participants, deadlines,
  and extended attributes (unknown ones are kept, so they're written back out on export)

### Swim lanes and saving (Shoobx / TWE files)

Pools and lanes are drawn as in Together Workflow Editor (horizontal or vertical, with the lane colors from
the file). Dragging an activity into another lane moves it to that lane **and hands it to that lane's
performer**, exactly like TWE.

Saving does not regenerate the file: the original XPDL is patched with only what you changed (names,
positions/lanes, performers, conditions, colors, added/removed activities and transitions, split/join
references, block activities). Pools, lanes, applications, participants, data fields, scripts, other
processes and tool-specific attributes are left untouched, and new elements are written in the file's own
style. Saving without changes reproduces the original file byte for byte (checked on every Shoobx/TWE
sample). In Chrome/Edge, Save writes back to the file you opened (the browser asks for permission once);
in other browsers it downloads the file. Before anything is written, the result is read back and checked.

If a file contains several processes (e.g. one per pool), you pick which one to open. Things the editor
can't show (message flows between pools, annotations) are skipped, and a summary tells you what was left out.

Tested against 200+ real XPDL files from Bizagi, Enhydra JaWE/TWE, Joget, TIBCO, Bonita, OFBiz/Shark,
BPSim, CMDBuild and others: every process imports, and exporting then re-importing gives the same diagram.

## Running locally

The page loads `wfConf/WfDSystemConfig.xml` via XHR, so serve it over HTTP rather than opening the file directly:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/flowchart.html
```

### Screenshots
![Demo](img/show.gif)
#### Main View
![Main view](img/img_3.png)
#### Xpdl View
![Xpdl view](img/img_1.png)
#### Xml View
![Xml view](img/img_2.png)

This project supports `Chrome/Firefox/IE11`; `Chrome` is recommended for testing.
