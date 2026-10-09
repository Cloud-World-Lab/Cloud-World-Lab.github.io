import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import katex from 'katex';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let marked;
try { ({ marked } = await import('marked')); }
catch (error) {
  if (!process.env.CWL_MARKED_PATH) throw error;
  ({ marked } = await import(process.env.CWL_MARKED_PATH));
}
const groups = [
  ['dreamer', ['route-dreamer', 'paper-dreamer', 'paper-dreamerv3', 'paper-dreamer4']],
  ['jepa', ['route-jepa', 'paper-vjepa', 'paper-vjepa2', 'paper-vjepa21']],
  ['generative', ['route-generative', 'paper-diamond', 'paper-genie']],
  ['structured', ['route-structured', 'paper-gns', 'paper-routenet']],
];
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const math = (expression, displayMode = false) => katex.renderToString(expression, {
  output: 'mathml', displayMode, throwOnError: true, trust: false,
});
marked.use({ extensions: [{
  name: 'inlineMath', level: 'inline',
  start: src => src.indexOf('$'),
  tokenizer(src) {
    const match = /^\$([^$\n]+)\$/.exec(src);
    if (match) return { type: 'inlineMath', raw: match[0], text: match[1] };
  },
  renderer: token => `<span class="math-inline">${math(token.text)}</span>`,
}] });
function render(text, id) {
  // The approved template already contains the corresponding mechanism diagrams.
  text = text.replace(/```mermaid\n[\s\S]*?```/g, '');
  const headings = [];
  const renderer = new marked.Renderer();
  renderer.heading = function({tokens, depth}) {
    const title = this.parser.parseInline(tokens);
    const slug = `section-${headings.length + 1}`;
    headings.push({ title, slug, depth });
    return `<h${depth} id="${id}--${slug}">${title}</h${depth}>\n`;
  };
  renderer.link = function({href, title, tokens}) {
    const label = this.parser.parseInline(tokens);
    // Public content accepts source links and the existing local route ids.
    if (!/^(https:\/\/|#)/.test(href || '')) throw new Error(`Unsupported content link: ${href}`);
    const target = href.startsWith('https://') ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escape(href)}"${title ? ` title="${escape(title)}"` : ''}${target}>${label}</a>`;
  };
  renderer.code = ({text, lang}) => lang === 'math'
    ? `<div class="math-block" role="region" aria-label="公式" tabindex="0">${math(text, true)}</div>\n`
    : `<pre class="${lang === 'mermaid' ? 'mechanism-text' : ''}"><code>${escape(text)}</code></pre>\n`;
  renderer.html = ({text}) => { throw new Error(`Raw HTML in content is unsupported: ${text.slice(0,50)}`); };
  const html = marked.parse(text, { renderer, gfm:true, breaks:false });
  const toc = headings.filter(h => h.depth === 3).map(h => `<a href="#${id}/${h.slug}">${h.title}</a>`).join('');
  return `<article class="reading-article"><nav class="article-toc" aria-label="本页阅读导航">${toc}</nav>${html.replace(/<table>/g,'<div class="table-scroll" role="region" aria-label="数据与条件表" tabindex="0"><table>').replace(/<\/table>/g,'</table></div>')}</article>`;
}
const articleMap = new Map();
for (const [name, ids] of groups) {
  const markdown = readFileSync(resolve(root, `content/${name}.md`), 'utf8');
  const blocks = [...markdown.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  if (blocks.length !== ids.length) throw new Error(`${name}: expected ${ids.length} H2 blocks, got ${blocks.length}`);
  blocks.forEach((block, index) => articleMap.set(ids[index], render(block[2], ids[index])));
}
let html = readFileSync(resolve(root,'templates/base.html'), 'utf8');
const starts = [...html.matchAll(/<section class="view [^"]*" id="([^"]+)"/g)];
const pageTitles = new Map(starts.map((view, index) => {
  const end = starts[index + 1]?.index ?? html.indexOf('</main>', view.index);
  const title = html.slice(view.index, end).match(/<h1>([^<]+)<\/h1>/)?.[1];
  if (!title) throw new Error(`Missing page title: ${view[1]}`);
  return [view[1], title];
}));
function paperLinks(ids, current = '') {
  return ids.slice(1).map(id => `<a href="#${id}"${id === current ? ' class="active" aria-current="page"' : ''}>${escape(pageTitles.get(id))}</a>`).join('');
}
function seriesNavigation(ids, current = '') {
  return `<nav class="series-navigation" aria-label="${escape(pageTitles.get(ids[0]))} 论文导航"><span class="series-label">阅读顺序</span><div class="series-links">${paperLinks(ids, current)}</div></nav>`;
}
function adjacentPapers(ids, current) {
  const index = ids.indexOf(current);
  const previous = index > 1 ? `<a href="#${ids[index - 1]}">上一篇：${escape(pageTitles.get(ids[index - 1]))}</a>` : '';
  const next = index < ids.length - 1 ? `<a href="#${ids[index + 1]}">下一篇：${escape(pageTitles.get(ids[index + 1]))}</a>` : '';
  return `<div class="read-next">${previous}${next}<a href="#${ids[0]}">路线目录</a></div>`;
}
for (let i=starts.length-1; i>=0; i--) {
  const start=starts[i].index;
  const end=i+1<starts.length ? starts[i+1].index : html.indexOf('</main>', start);
  let block=html.slice(start,end);
  const id=starts[i][1];
  if (!articleMap.has(id)) continue;
  const [name, groupIds] = groups.find(group => group[1].includes(id));
  block=block.replace('</header>', seriesNavigation(groupIds, id)+'</header>');
  if (id.startsWith('paper-')) {
    const figureEnd=block.indexOf('</figure>')+9;
    const designStart=block.indexOf('<aside class="page-design">');
    if (figureEnd < 9 || designStart < 0) throw new Error(`Missing layout landmark in ${id}`);
    const next=adjacentPapers(groupIds, id);
    const verifiedOn=id==='paper-dreamer'?'2026-10-09':'2026-10-01';
    block=block.slice(0,figureEnd)+articleMap.get(id)+next+'<p class="verification">原始论文与作者资料核验：'+verifiedOn+'。下文区分作者实验与 IT 迁移分析；本站未独立复现。<a href="evidence/'+name+'.json">查看来源与条件记录</a></p>'+block.slice(designStart);
  } else {
    const figureEnd=block.indexOf('</figure>')+9;
    block=block.slice(0,figureEnd)+articleMap.get(id)+block.slice(figureEnd);
  }
  html=html.slice(0,start)+block+html.slice(end);
}
for (const [, ids] of groups) {
  const card = new RegExp(`<a class="route-card ([^"]+)" href="#${ids[0]}">([\\s\\S]*?)<div class="card-bottom">([\\s\\S]*?)<\\/div><\\/a>`);
  if (!card.test(html)) throw new Error(`Missing route card: ${ids[0]}`);
  html=html.replace(card, (_, color, body, footer) => `<article class="route-card ${color}"><a class="route-card-main" href="#${ids[0]}">${body}</a><nav class="route-paper-links" aria-label="${escape(pageTitles.get(ids[0]))} 论文直达"><span class="series-label">直接阅读</span><div class="series-links">${paperLinks(ids)}</div></nav><a class="card-bottom" href="#${ids[0]}">${footer}</a></article>`);
}
html=html.replaceAll('精选导读提纲','论文导读').replaceAll('导读提纲','完整导读').replaceAll('导读样章','完整导读');
html=html.replaceAll('展开完整导读','论文导读');
html=html.replace('九篇精选入口中，V-JEPA 2 是展开样章，其余是短提纲；这仍是网站设计原型，尚非完整论文库。','十篇精选导读解释机制、训练数据、实验条件与迁移边界；原始来源和证据位置可在各篇末尾查阅。');
html=html.replace('当前为首次发布版本，四条路线和论文导读将在同一入口持续完善。','以四个问题入口串联十篇论文导读，关注可检验的环境预测与决策。');
html=html.replace('本页按 v1 导读','按原论文核验');
const css=readFileSync(resolve(root,'scripts/reading.css'),'utf8');
html=html.replace('</style>',css+'\n</style>');
const script=readFileSync(resolve(root,'scripts/navigation.js'),'utf8');
html=html.replace(/<script>[\s\S]*?<\/script>/,`<script>\n${script}\n</script>`);
writeFileSync(resolve(root,'index.html'),html);
console.log(`Built ${starts.length} views: ${articleMap.size} expanded route / paper articles.`);
