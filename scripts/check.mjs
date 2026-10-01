import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const known=new Set(ids);
const views=[...html.matchAll(/<section class="view [^"]*" id="([^"]+)"/g)].map(m=>m[1]);
if(views.length!==15)throw new Error(`Expected 15 views, got ${views.length}`);
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
if(articleCount!==13)throw new Error(`Expected 13 full articles, got ${articleCount}`);
if((html.match(/<aside class="page-design">/g)||[]).length!==15)throw new Error('Design notes must be retained on every page');
console.log(JSON.stringify({views:views.length,expandedArticles:articleCount,localLinks:hrefs.filter(h=>!h.startsWith('https://')).length,externalUrls:new Set(hrefs.filter(h=>h.startsWith('https://'))).size,ids:ids.length,checks:'passed'},null,2));
