# IT World Model

Cloud World Lab 的公开世界模型学习网站，沿用已认可的概览 / 研究路线与四个问题入口。

网址：https://cloud-world-lab.github.io/

本仓库只包含公开网站素材、论文导读与来源证据，不包含私人研究计划或凭据。论文结论来自作者实验，本站未独立复现。

网站有 16 个视图：概览、路线总览、4 条路线与 10 篇论文导读。四个入口是问题导向的阅读路径，可以重叠与组合。Dreamer 路线按初代 Dreamer（ICLR 2020）→ DreamerV3 → Dreamer4 阅读。

正文位于 `content/`，原始来源、所读版本和证据位置位于 `evidence/`。`templates/base.html` 保留已认可的视觉结构与第三方图形声明；`scripts/build.mjs` 将 Markdown 编译进可离线使用的 `index.html`。内联 `$...$` 与 `math` 代码块在构建时通过 KaTeX 转为原生 MathML，阅读时无需加载公式脚本或网络字体。未经用户选择，本仓库没有为全部原创内容另行承诺开放许可。

更新内容后，运行 `npm ci --ignore-scripts`、`npm run build`、`npm run check`。本地预览：`python3 -m http.server 8000`，打开 `http://localhost:8000/`。

浏览器验收：`node scripts/browser-qa.mjs`，使用 macOS 已安装的 Chrome 与独立临时配置。公开网址也可作为参数传入。截图及包含本机路径的原始报告不进入 Git。外链验收：`python3 scripts/check-links.py`。

Pages 从 `main` 分支根目录发布。来源图形许可保留在 HTML 中。
