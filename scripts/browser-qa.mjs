import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'qa');mkdirSync(resolve(output,'screenshots'),{recursive:true});
const base=process.argv[2]||pathToFileURL(resolve(root,'index.html')).href;
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless','--disable-gpu','--no-first-run','--remote-debugging-port=0',
  `--user-data-dir=/tmp/cwl-browser-qa-${process.pid}`,'about:blank'
],{stdio:['ignore','ignore','pipe']});
let websocketUrl;
const endpoint=new Promise((res,rej)=>{
  const timer=setTimeout(()=>rej(new Error('Chrome startup timeout')),15000);
  chrome.stderr.on('data',data=>{const match=String(data).match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);websocketUrl=match[1];res(match[1])}});
  chrome.on('exit',code=>rej(new Error(`Chrome exited early: ${code}`)));
});
const report={date:new Date().toISOString(),base,viewportChecks:[],navigationChecks:[],consoleErrors:[],screenshots:[]};
let ws;
try{
  ws=new WebSocket(await endpoint);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
  let counter=0;const pending=new Map();let session;
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const {res,rej,timer}=pending.get(msg.id);clearTimeout(timer);pending.delete(msg.id);msg.error?rej(new Error(msg.error.message)):res(msg.result)}else if(msg.method==='Runtime.exceptionThrown')report.consoleErrors.push(msg.params.exceptionDetails)};
  function command(method,params={},sessionId=session){return new Promise((res,rej)=>{const id=++counter;const timer=setTimeout(()=>{pending.delete(id);rej(new Error(`${method} timeout`))},15000);pending.set(id,{res,rej,timer});ws.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}))})}
  const target=await command('Target.createTarget',{url:'about:blank'},null);
  session=(await command('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await command('Page.enable');await command('Runtime.enable');
  async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value}
  await command('Page.navigate',{url:base});
  for(let attempt=0;attempt<50;attempt++){if(await evaluate('document.readyState==="complete" && typeof validIds!=="undefined"'))break;await new Promise(r=>setTimeout(r,100));if(attempt===49)throw new Error('Site did not initialize')}
  const ids=await evaluate('Array.from(validIds)');
  const frames=[{width:1440,height:1000},{width:390,height:900},{width:320,height:900}];
  for(const viewport of frames){
    await command('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:viewport.width<650});
    for(const id of ids){
      await evaluate(`location.hash=${JSON.stringify('#'+id)}; navigate();`);
      await command('Runtime.evaluate',{expression:'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))',awaitPromise:true});
      const state=await evaluate(`(()=>{const v=document.querySelector('.view.active');const overflow=Array.from(v.querySelectorAll('*')).filter(e=>{if(e.closest('.table-scroll,pre,svg'))return false;const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5)}).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,70)}));return {id:v.id,visibleViews:Array.from(document.querySelectorAll('.view')).filter(e=>getComputedStyle(e).display!=='none').length,documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,overflow,title:document.title,designNote:!!v.querySelector('.page-design'),tables:v.querySelectorAll('table').length}})()`);
      if(state.id!==id||state.visibleViews!==1||state.documentWidth>state.viewportWidth+1||state.overflow.length||!state.designNote)throw new Error(`Layout or navigation failure: ${JSON.stringify({viewport,state})}`);
      report.viewportChecks.push({viewport:viewport.width,...state});
      const filename=`${viewport.width}-${id}.png`;
      const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      writeFileSync(resolve(output,'screenshots',filename),Buffer.from(screenshot.data,'base64'));report.screenshots.push(filename);
      if(viewport.width===390&&id.startsWith('paper-')){
        await evaluate(`(()=>{const t=document.querySelector('.view.active .table-scroll');if(t)t.scrollIntoView({behavior:'instant',block:'center'});else document.querySelector('.view.active .reading-article').scrollIntoView({behavior:'instant',block:'start'})})()`);
        await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        const tableName=`390-${id}-evidence.png`;writeFileSync(resolve(output,'screenshots',tableName),Buffer.from(shot.data,'base64'));report.screenshots.push(tableName);
      }
    }
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const links=await evaluate(`Array.from(document.querySelectorAll('a[href^="#"]')).filter(a=>!a.classList.contains('skip')).map(a=>a.getAttribute('href'))`);
  for(const href of links){const state=await evaluate(`location.hash=${JSON.stringify(href)}; navigate(); ({id:document.querySelector('.view.active').id,hash:location.hash,focused:document.activeElement.id})`);const [id,anchor]=href.slice(1).split('/');if(state.id!==id||anchor&&state.focused!==`${id}--${anchor}`)throw new Error(`Broken navigation ${href}`);report.navigationChecks.push({href,...state})}
  await evaluate('location.hash="#invalid-route";navigate()');
  if(await evaluate('location.hash')!=='#overview')throw new Error('Unknown-route recovery failed');
  await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  if(await evaluate('getComputedStyle(document.documentElement).scrollBehavior')!=='auto')throw new Error('Reduced-motion preference ignored');
  await command('Emulation.setEmulatedMedia',{media:'print',features:[]});
  const printState=await evaluate('({visibleViews:Array.from(document.querySelectorAll(".view")).filter(e=>getComputedStyle(e).display!=="none").length,designVisible:getComputedStyle(document.querySelector(".view.active .page-design")).display!=="none"})');
  if(printState.visibleViews!==1||!printState.designVisible)throw new Error('Print view includes hidden pages or loses design notes');
  report.reducedMotion=true;report.printView=printState;
  report.status=report.consoleErrors.length?'failed':'passed';
  writeFileSync(resolve(output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,viewports:report.viewportChecks.length,navigations:report.navigationChecks.length,consoleErrors:report.consoleErrors.length,screenshots:report.screenshots.length,print:printState},null,2));
  if(report.consoleErrors.length)process.exitCode=1;
}catch(error){report.status='failed';report.error=String(error);writeFileSync(resolve(output,'browser-report.json'),JSON.stringify(report,null,2)+'\n');throw error}
finally{if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({id:999999,method:'Browser.close'}));ws.close()}chrome.kill('SIGTERM')}
