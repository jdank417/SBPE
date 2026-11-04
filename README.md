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
- Save (not finished yet, to be updated)

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
