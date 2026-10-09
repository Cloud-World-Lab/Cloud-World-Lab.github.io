import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const known=new Set(ids);
const views=[...html.matchAll(/<section class="view [^"]*" id="([^"]+)"/g)].map(m=>m[1]);
const expectedViews=['overview','routes','route-dreamer','route-jepa','route-generative','route-structured','paper-dreamer','paper-dreamerv3','paper-dreamer4','paper-vjepa','paper-vjepa2','paper-vjepa21','paper-diamond','paper-genie','paper-gns','paper-routenet'];
if(views.length!==expectedViews.length||expectedViews.some(id=>!views.includes(id)))throw new Error('Published view set is incomplete or unexpected');
if(ids.length!==known.size)throw new Error('Duplicate DOM ids');
const hrefs=[...html.matchAll(/\bhref="([^"]+)"/g)].map(m=>m[1]);
for(const href of hrefs){
  if(href.startsWith('#')){
    const [view,anchor]=href.slice(1).split('/');
    if(!known.has(view)||anchor&&!known.has(`${view}--${anchor}`))throw new Error(`Broken anchor: ${href}`);
  }else if(!href.startsWith('https://')&&!existsSync(resolve(root,href)))throw new Error(`Missing local resource: ${href}`);
}
for(const name of ['dreamer','jepa','generative','structured'])JSON.parse(readFileSync(resolve(root,`evidence/${name}.json`),'utf8'));
for(const text of ['短提纲','尚未发布','尚未扩写','网站设计原型','精选导读提纲'])if(html.includes(text))throw new Error(`Obsolete publication text: ${text}`);
if(/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(html))throw new Error('Credential-shaped content in output');
const articleCount=(html.match(/<article class="reading-article">/g)||[]).length;
if(articleCount!==expectedViews.length-2)throw new Error(`Expected ${expectedViews.length-2} full articles, got ${articleCount}`);
if((html.match(/<aside class="page-design">/g)||[]).length!==views.length)throw new Error('Design notes must be retained on every page');
const dreamer=html.match(/<section class="view paper-view" id="paper-dreamer"[\s\S]*?(?=<section class="view|<\/main>)/)?.[0];
if(!dreamer||!dreamer.includes('ICLR 2020')||!dreamer.includes('1912.01603')||!dreamer.includes('<math'))throw new Error('Dreamer paper identity or rendered formulas missing');
console.log(JSON.stringify({views:views.length,expandedArticles:articleCount,localLinks:hrefs.filter(h=>!h.startsWith('https://')).length,externalUrls:new Set(hrefs.filter(h=>h.startsWith('https://'))).size,ids:ids.length,checks:'passed'},null,2));
