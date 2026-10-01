'use strict';
const views=Array.from(document.querySelectorAll('.view'));
const navLinks=Array.from(document.querySelectorAll('[data-nav]'));
const pageNames={overview:'概览',routes:'研究路线','route-dreamer':'Dreamer 路线','route-jepa':'JEPA 路线','route-generative':'生成式交互模拟','route-structured':'结构化动力学'};
const validIds=new Set(views.map(v=>v.id));
function navigate(){
  let [id,anchor]=location.hash.slice(1).split('/');
  id=id||'overview';
  if(!validIds.has(id)){id='overview';anchor='';history.replaceState(null,'','#overview')}
  const current=document.getElementById(id);
  views.forEach(v=>{const active=v.id===id;v.classList.toggle('active',active);v.setAttribute('aria-hidden',String(!active))});
  navLinks.forEach(a=>{const active=a.dataset.nav===current.dataset.section;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  document.title=(pageNames[id]||current.querySelector('h1').textContent)+' · IT World Model';
  const target=anchor?document.getElementById(`${id}--${anchor}`):null;
  if(target){target.setAttribute('tabindex','-1');target.scrollIntoView({behavior:'instant',block:'start'});target.focus({preventScroll:true})}
  else{window.scrollTo({top:0,behavior:'instant'});current.focus({preventScroll:true})}
}
document.documentElement.classList.add('js');
window.addEventListener('hashchange',navigate);
document.getElementById('print-view').addEventListener('click',()=>window.print());
navigate();
