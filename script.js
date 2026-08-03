const defs=[
{id:'image',label:'Product image',icon:'▧',desc:'Identify the product'},
{id:'title',label:'Product title',icon:'T',desc:'Understand what it is'},
{id:'rating',label:'Reviews',icon:'★',desc:'Evaluate trust'},
{id:'price',label:'Price',icon:'$',desc:'Evaluate cost'},
{id:'variants',label:'Size / options',icon:'⌘',desc:'Make a required choice'},
{id:'shipping',label:'Shipping info',icon:'↗',desc:'Reduce delivery uncertainty'},
{id:'cta',label:'Add to cart',icon:'＋',desc:'Complete the next action'}
];
const defaults={image:[16,82],title:[16,286],rating:[16,338],price:[16,386],variants:[16,438],cta:[16,510],shipping:[16,572]};
const taskOrder=['image','title','rating','price','variants','cta','shipping'];
const palette=document.getElementById('palette'),canvas=document.getElementById('canvas'),pathLayer=document.getElementById('pathLayer'),emptyHint=document.getElementById('emptyHint'),modeSelect=document.getElementById('modeSelect');
let placed=new Map(),dragId=null,active=null,raf=false;

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function center(el){const c=canvas.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:r.left-c.left+r.width/2,y:r.top-c.top+r.height/2}}
function box(el){const c=canvas.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:r.left-c.left,y:r.top-c.top,w:r.width,h:r.height,right:r.right-c.left,bottom:r.bottom-c.top}}
function overlap(a,b){const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));return w*h}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function schedule(){if(raf)return;raf=true;requestAnimationFrame(()=>{raf=false;analyze()})}

function renderPalette(){palette.innerHTML='';defs.forEach(d=>{const el=document.createElement('div');el.className='palette-item';el.draggable=true;el.dataset.id=d.id;el.innerHTML=`<span class="palette-icon">${d.icon}</span><span><strong>${d.label}</strong><small>${d.desc}</small></span>`;el.addEventListener('dragstart',()=>dragId=d.id);el.addEventListener('click',()=>{if(!placed.has(d.id)){const p=defaults[d.id]||[16,90+placed.size*58];add(d.id,p[0],p[1])}});palette.appendChild(el)})}
function syncPalette(){document.querySelectorAll('.palette-item').forEach(el=>el.classList.toggle('used',placed.has(el.dataset.id)));emptyHint.style.display=placed.size?'none':'grid'}
function add(id,x,y){const d=defs.find(v=>v.id===id);if(!d)return;let el=placed.get(id);if(!el){el=document.createElement('div');el.className='canvas-item';el.dataset.type=id;el.innerHTML=`<strong>${d.label}</strong><small>${d.desc}</small>`;el.addEventListener('pointerdown',startDrag);el.addEventListener('dblclick',()=>remove(id));canvas.appendChild(el);placed.set(id,el)}const maxX=canvas.clientWidth-el.offsetWidth-4,maxY=canvas.clientHeight-el.offsetHeight-4;el.style.left=clamp(x,4,maxX)+'px';el.style.top=clamp(y,60,maxY)+'px';syncPalette();schedule()}
function remove(id){placed.get(id)?.remove();placed.delete(id);syncPalette();schedule()}
function reset(){[...placed.values()].forEach(el=>el.remove());placed.clear();Object.entries(defaults).forEach(([id,p])=>add(id,p[0],p[1]));schedule()}
canvas.addEventListener('dragover',e=>e.preventDefault());canvas.addEventListener('drop',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();add(dragId,e.clientX-r.left-55,e.clientY-r.top-20)});
function startDrag(e){if(e.button!==undefined&&e.button!==0)return;const el=e.currentTarget,r=el.getBoundingClientRect();active={el,dx:e.clientX-r.left,dy:e.clientY-r.top};el.setPointerCapture?.(e.pointerId);el.classList.add('dragging');document.addEventListener('pointermove',moveDrag);document.addEventListener('pointerup',endDrag,{once:true})}
function moveDrag(e){if(!active)return;const r=canvas.getBoundingClientRect(),el=active.el;el.style.left=clamp(e.clientX-r.left-active.dx,4,canvas.clientWidth-el.offsetWidth-4)+'px';el.style.top=clamp(e.clientY-r.top-active.dy,60,canvas.clientHeight-el.offsetHeight-4)+'px';schedule()}
function endDrag(){active?.el.classList.remove('dragging');active=null;document.removeEventListener('pointermove',moveDrag);schedule()}

function visibility(){const entries=[...placed.entries()],per={};entries.forEach(([id])=>per[id]=1);for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){const [aId,aEl]=entries[i],[bId,bEl]=entries[j],a=box(aEl),b=box(bEl),area=overlap(a,b);if(!area)continue;per[aId]=Math.max(0,per[aId]-area/(a.w*a.h));per[bId]=Math.max(0,per[bId]-area/(b.w*b.h))}return per}
function grade(n){return n>=85?'Strong':n>=70?'Good':n>=50?'Needs work':'Critical'}

function analyze(){
 const mode=modeSelect.value,per=visibility(),findings=[],critical=[];
 placed.forEach((el,id)=>{const hidden=Math.round((1-(per[id]??1))*100);el.classList.toggle('occluded',hidden>4);el.dataset.hidden=hidden});
 ['price','cta'].forEach(id=>{if(!placed.has(id))critical.push(`${defs.find(d=>d.id===id).label} is missing.`);else if((per[id]??1)<.85)critical.push(`${defs.find(d=>d.id===id).label} is ${Math.round((1-per[id])*100)}% hidden.`)});
 ['image','title'].forEach(id=>{if(!placed.has(id))critical.push(`${defs.find(d=>d.id===id).label} is missing.`);else if((per[id]??1)<.65)critical.push(`${defs.find(d=>d.id===id).label} is too obscured to support the task.`)});
 const visVals=Object.values(per),visibilityScore=visVals.length?Math.round(visVals.reduce((a,b)=>a+b,0)/visVals.length*100):0;
 const present=taskOrder.filter(id=>placed.has(id));let sequenceScore=0;if(present.length>1){let good=0;for(let i=1;i<present.length;i++){const a=center(placed.get(present[i-1])),b=center(placed.get(present[i]));if(b.y>=a.y-12)good++}sequenceScore=Math.round(good/(present.length-1)*100)}
 const groupPairs=[['title','rating'],['rating','price'],['price','variants'],['variants','cta'],['cta','shipping']];const groupVals=groupPairs.filter(([a,b])=>placed.has(a)&&placed.has(b)).map(([a,b])=>clamp(115-dist(center(placed.get(a)),center(placed.get(b)))/2.5,0,100));const groupingScore=groupVals.length?Math.round(groupVals.reduce((a,b)=>a+b,0)/groupVals.length):0;
 let modeFit=sequenceScore;
 if(mode==='grouping')modeFit=Math.round((groupingScore+visibilityScore)/2);
 if(mode==='gutenberg'){const title=placed.get('title'),cta=placed.get('cta'),w=canvas.clientWidth,h=canvas.clientHeight;const a=title?center(title):null,b=cta?center(cta):null;modeFit=Math.round(((a&&a.x<w*.58&&a.y<h*.48?100:35)+(b&&b.x>w*.42&&b.y>h*.48?100:35))/2)}
 if(sequenceScore<70)findings.push('The shopping sequence is interrupted. Keep product identity, price, options and action in a readable top-to-bottom order.');
 if(groupingScore<70)findings.push('Related information is too far apart to feel like one product-information group.');
 Object.entries(per).forEach(([id,v])=>{if(v<.95)findings.push(`${defs.find(d=>d.id===id).label} is partially covered (${Math.round((1-v)*100)}%).`)});
 if(!placed.has('variants'))findings.push('No option selector is available before the purchase action.');
 if(!placed.has('shipping'))findings.push('Shipping reassurance is missing from the visible decision flow.');
 if(mode==='gutenberg')findings.push('Gutenberg is only a comparison heuristic; it does not override missing or hidden task-critical content.');
 let score=Math.round(visibilityScore*.42+sequenceScore*.30+groupingScore*.18+modeFit*.10);if(critical.length)score=Math.min(score,44);if(!placed.has('price')||(per.price??1)<.5)score=Math.min(score,30);if(!placed.has('cta')||(per.cta??1)<.5)score=Math.min(score,25);
 if(!critical.length&&findings.length===0)findings.push('All critical elements are visible, grouped and ordered for a clear shopping task.');
 updateUI({score,visibilityScore,sequenceScore,groupingScore,critical,findings:findings.slice(0,6),per});drawPath(per)
}
function updateCharacter(score,critical){const c=document.getElementById('shopperCharacter'),m=document.getElementById('characterMood'),q=document.getElementById('characterQuote');let mood='hesitant',label='Hesitant shopper',quote='“I need to search before I can decide.”';if(score>=85){mood='satisfied';label='Satisfied shopper';quote='“Everything is clear. I know what to do next.”'}else if(score>=70){mood='good';label='Comfortable shopper';quote='“I understand the page, but one thing still slows me down.”'}else if(score<50||critical.length){mood='critical';label='Confused shopper';quote='“I cannot find or trust the information I need.”'}c.dataset.mood=mood;m.textContent=label;q.textContent=quote}
function updateUI(r){updateCharacter(r.score,r.critical);document.getElementById('score').textContent=r.score;document.getElementById('scoreFill').style.width=r.score+'%';document.getElementById('scoreState').textContent=grade(r.score);document.getElementById('visibility').textContent=r.visibilityScore;document.getElementById('sequence').textContent=r.sequenceScore;document.getElementById('grouping').textContent=r.groupingScore;const banner=document.getElementById('criticalBanner');banner.hidden=!r.critical.length;banner.textContent=r.critical[0]||'';document.getElementById('shopperText').textContent=r.score>=85?'I can understand the product and reach the next action without searching.':r.score>=70?'The page is usable, but one relationship still slows the decision.':r.score>=50?'I need to search and reconstruct the page before acting.':'Critical information is missing, covered or disconnected.';const ul=document.getElementById('findings');ul.innerHTML='';(r.critical.concat(r.findings).slice(0,6)).forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.appendChild(li)})}
function drawPath(per){pathLayer.innerHTML='';let ids=taskOrder.filter(id=>placed.has(id)&&(per[id]??1)>.5);if(modeSelect.value==='gutenberg')ids=['title','image','price','cta'].filter(id=>placed.has(id)&&(per[id]??1)>.5);if(ids.length<2)return;const ns='http://www.w3.org/2000/svg',pts=ids.map(id=>center(placed.get(id))),line=document.createElementNS(ns,'polyline');line.setAttribute('points',pts.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#1f201c');line.setAttribute('stroke-width','2');line.setAttribute('stroke-dasharray','5 6');line.setAttribute('opacity','.55');pathLayer.appendChild(line);pts.forEach((p,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r','10');c.setAttribute('fill','#dfff3f');c.setAttribute('stroke','#1f201c');pathLayer.appendChild(c);const t=document.createElementNS(ns,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+4);t.setAttribute('text-anchor','middle');t.setAttribute('font-size','9');t.setAttribute('font-weight','800');t.textContent=i+1;pathLayer.appendChild(t)})}
modeSelect.addEventListener('change',()=>{document.getElementById('modeText').textContent=modeSelect.value==='task'?'Can the shopper identify, evaluate, choose and act?':modeSelect.value==='grouping'?'Are related elements visible and read as one group?':'Does the layout roughly follow the Gutenberg diagonal heuristic?';schedule()});
document.getElementById('resetBtn').addEventListener('click',reset);const dialog=document.getElementById('methodDialog');document.getElementById('methodBtn').addEventListener('click',()=>dialog.showModal());document.getElementById('closeDialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});window.addEventListener('resize',schedule);renderPalette();setTimeout(reset,60);
