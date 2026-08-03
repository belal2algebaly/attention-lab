const definitions = [
  {id:'logo', label:'Logo', icon:'◈', hint:'Brand recognition'},
  {id:'image', label:'Product image', icon:'▧', hint:'Identify the product'},
  {id:'title', label:'Product title', icon:'T', hint:'Product identity'},
  {id:'rating', label:'Reviews', icon:'★', hint:'Social proof'},
  {id:'price', label:'Price', icon:'$', hint:'Cost and value'},
  {id:'variants', label:'Size / variants', icon:'⌘', hint:'Required choice'},
  {id:'shipping', label:'Shipping info', icon:'↗', hint:'Delivery reassurance'},
  {id:'cta', label:'Add to cart', icon:'＋', hint:'Primary action'},
  {id:'model', label:'Gaze cue model', icon:'☺', hint:'Double-click to flip'}
];

const defaults={logo:[24,78],image:[22,130],title:[22,330],rating:[22,386],price:[22,432],variants:[22,486],cta:[22,555],shipping:[22,616],model:[214,333]};
const taskOrder=['image','title','rating','price','variants','cta','shipping'];
let placed=new Map(),draggedId=null,activeDrag=null,rafPending=false;

const palette=document.getElementById('palette'),canvas=document.getElementById('canvas'),pathLayer=document.getElementById('pathLayer'),dropHint=document.getElementById('dropHint'),modeSelect=document.getElementById('modeSelect');

function makePalette(){palette.innerHTML='';definitions.forEach(d=>{const el=document.createElement('div');el.className='palette-item';el.draggable=true;el.dataset.id=d.id;el.innerHTML=`<span class="icon">${d.icon}</span><span>${d.label}<small>${d.hint}</small></span>`;el.addEventListener('dragstart',()=>draggedId=d.id);palette.appendChild(el)})}
function clamp(v,min,max){return Math.max(min,Math.min(v,max))}
function scheduleAnalysis(){if(rafPending)return;rafPending=true;requestAnimationFrame(()=>{rafPending=false;runLive()})}

function addToCanvas(id,x,y){
  const d=definitions.find(v=>v.id===id);if(!d)return;let el=placed.get(id);
  if(!el){
    el=document.createElement('div');el.className='canvas-item';el.dataset.type=id;el.dataset.id=id;
    el.innerHTML=`<strong>${d.label}</strong><span>${d.hint}</span>`;
    if(id==='model')el.classList.add('looking-left');
    el.addEventListener('pointerdown',startPointerDrag);
    el.addEventListener('dblclick',e=>{e.preventDefault();if(id==='model'){el.classList.toggle('looking-left');el.classList.toggle('looking-right');scheduleAnalysis()}else removeFromCanvas(id)});
    canvas.appendChild(el);placed.set(id,el);
  }
  const maxX=canvas.clientWidth-el.offsetWidth-5,maxY=canvas.clientHeight-el.offsetHeight-5;
  el.style.left=clamp(x,4,maxX)+'px';el.style.top=clamp(y,55,maxY)+'px';syncPalette();scheduleAnalysis();
}
function removeFromCanvas(id){const el=placed.get(id);if(el)el.remove();placed.delete(id);syncPalette();scheduleAnalysis()}
function syncPalette(){document.querySelectorAll('.palette-item').forEach(el=>el.classList.toggle('used',placed.has(el.dataset.id)));dropHint.style.display=placed.size?'none':'grid'}
canvas.addEventListener('dragover',e=>e.preventDefault());
canvas.addEventListener('drop',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();addToCanvas(draggedId,e.clientX-r.left-55,e.clientY-r.top-22)});

function startPointerDrag(e){if(e.button!==undefined&&e.button!==0)return;const el=e.currentTarget,r=el.getBoundingClientRect();activeDrag={el,dx:e.clientX-r.left,dy:e.clientY-r.top};el.setPointerCapture?.(e.pointerId);el.classList.add('dragging');document.addEventListener('pointermove',movePointer);document.addEventListener('pointerup',endPointer,{once:true})}
function movePointer(e){if(!activeDrag)return;const cr=canvas.getBoundingClientRect(),el=activeDrag.el;const x=e.clientX-cr.left-activeDrag.dx,y=e.clientY-cr.top-activeDrag.dy;el.style.left=clamp(x,4,canvas.clientWidth-el.offsetWidth-5)+'px';el.style.top=clamp(y,55,canvas.clientHeight-el.offsetHeight-5)+'px';scheduleAnalysis()}
function endPointer(){if(activeDrag)activeDrag.el.classList.remove('dragging');activeDrag=null;document.removeEventListener('pointermove',movePointer);scheduleAnalysis()}

function reset(){[...placed.values()].forEach(el=>el.remove());placed.clear();Object.entries(defaults).forEach(([id,p])=>addToCanvas(id,p[0],p[1]));scheduleAnalysis()}
function rect(el){const c=canvas.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:r.left-c.left,y:r.top-c.top,w:r.width,h:r.height,right:r.right-c.left,bottom:r.bottom-c.top}}
function center(el){const r=rect(el);return{x:r.x+r.w/2,y:r.y+r.h/2}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function overlapArea(a,b){const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));return w*h}
function grade(v){return v>=85?'Strong':v>=70?'Good':v>=50?'Mixed':'Weak'}

function visibilityData(){
  const entries=[...placed.entries()],per={},pairs=[];
  entries.forEach(([id,el])=>per[id]=1);
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const [idA,elA]=entries[i],[idB,elB]=entries[j],a=rect(elA),b=rect(elB),area=overlapArea(a,b);if(!area)continue;
    const ratioA=area/(a.w*a.h),ratioB=area/(b.w*b.h);per[idA]=Math.max(0,per[idA]-ratioA);per[idB]=Math.max(0,per[idB]-ratioB);pairs.push({a:idA,b:idB,area,ratioA,ratioB});
  }
  const values=Object.values(per);return{per,pairs,score:values.length?100*values.reduce((a,b)=>a+b,0)/values.length:0};
}

function calculate(){
  const mode=modeSelect.value,findings=[],vis=visibilityData();
  const critical=['price','cta','title','image'];let criticalFailure=false;
  critical.forEach(id=>{if(!placed.has(id)){findings.push(`${definitions.find(d=>d.id===id).label} is missing.`);criticalFailure=true}else if((vis.per[id]??1)<.85){findings.push(`${definitions.find(d=>d.id===id).label} is partially or fully covered (${Math.round((1-vis.per[id])*100)}% hidden).`);criticalFailure=true}});
  if(vis.pairs.length)findings.push(`${vis.pairs.length} overlap${vis.pairs.length>1?'s':''} detected. Covered content cannot receive a strong score.`);

  const cW=canvas.clientWidth,cH=canvas.clientHeight;
  let placement=70,grouping=70,flow=70;
  const common={logo:[0,.48,.07,.22],image:[0,.95,.10,.48],title:[0,.95,.38,.62],rating:[0,.95,.42,.68],price:[0,.95,.48,.72],variants:[0,.95,.54,.82],cta:[0,.95,.62,.90],shipping:[0,.95,.68,.98],model:[0,1,.25,.76]};
  const placementVals=[];placed.forEach((el,id)=>{if(!common[id])return;const p=center(el),z=common[id],nx=p.x/cW,ny=p.y/cH;placementVals.push(nx>=z[0]&&nx<=z[1]&&ny>=z[2]&&ny<=z[3]?100:35)});placement=placementVals.length?placementVals.reduce((a,b)=>a+b,0)/placementVals.length:0;

  const pairs=[['title','rating'],['title','price'],['price','variants'],['variants','cta'],['cta','shipping']];
  const groupVals=pairs.filter(([a,b])=>placed.has(a)&&placed.has(b)).map(([a,b])=>clamp(110-dist(center(placed.get(a)),center(placed.get(b)))/2.2,0,100));grouping=groupVals.length?groupVals.reduce((a,b)=>a+b,0)/groupVals.length:0;

  if(mode==='task'){
    const present=taskOrder.filter(id=>placed.has(id));let good=0;
    for(let i=1;i<present.length;i++){const a=center(placed.get(present[i-1])),b=center(placed.get(present[i]));if(b.y>=a.y-10)good++}
    flow=present.length>1?100*good/(present.length-1):0;
    if(flow<70)findings.push('The product evaluation sequence is broken: identify → evaluate → select → act.');
  }else if(mode==='gutenberg'){
    const terminal=placed.has('cta')?center(placed.get('cta')):null;
    const primary=placed.has('title')?center(placed.get('title')):null;
    const primaryFit=primary&&primary.x<cW*.55&&primary.y<cH*.45?100:35;
    const terminalFit=terminal&&terminal.x>cW*.45&&terminal.y>cH*.48?100:35;
    flow=(primaryFit+terminalFit)/2;
    if(flow<70)findings.push('In the Gutenberg lens, the opening information and terminal action do not anchor the expected diagonal journey.');
  }else{
    flow=Math.max(0,100-vis.pairs.length*22);
    if(grouping<70)findings.push('Related product information is too dispersed to read as one coherent group.');
  }

  let gazeBonus=0;
  if(placed.has('model')&&placed.has('cta')&&(vis.per.model??1)>.8&&(vis.per.cta??1)>.85){const m=placed.get('model'),mp=center(m),cp=center(placed.get('cta')),right=m.classList.contains('looking-right');if((right&&cp.x>mp.x)||(!right&&cp.x<mp.x))gazeBonus=3;else findings.push('The model gaze points away from the primary action.');}

  let score=Math.round(vis.score*.38+placement*.20+grouping*.20+flow*.22+gazeBonus);
  if(criticalFailure)score=Math.min(score,49);
  if((vis.per.price??1)<.5||!placed.has('price'))score=Math.min(score,35);
  if((vis.per.cta??1)<.5||!placed.has('cta'))score=Math.min(score,30);
  if(!vis.pairs.length&&score>=78)findings.push('All critical elements remain visible and the layout forms a readable path.');
  return{score,visibility:vis.score,placement,grouping,flow,findings:findings.slice(0,6),vis};
}

function drawPath(r){pathLayer.innerHTML='';let ids=taskOrder.filter(id=>placed.has(id)&&(r.vis.per[id]??1)>.5);if(modeSelect.value==='gutenberg')ids=['logo','title','image','cta'].filter(id=>placed.has(id)&&(r.vis.per[id]??1)>.5);if(ids.length<2)return;const ns='http://www.w3.org/2000/svg',pts=ids.map(id=>center(placed.get(id)));const line=document.createElementNS(ns,'polyline');line.setAttribute('points',pts.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#20211d');line.setAttribute('stroke-width','2');line.setAttribute('stroke-dasharray','5 6');line.setAttribute('opacity','.64');pathLayer.appendChild(line);pts.forEach((p,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r','11');c.setAttribute('fill','#dbff3f');c.setAttribute('stroke','#20211d');pathLayer.appendChild(c);const t=document.createElementNS(ns,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+4);t.setAttribute('text-anchor','middle');t.setAttribute('font-size','10');t.setAttribute('font-weight','800');t.textContent=i+1;pathLayer.appendChild(t)})}
function moveEyesTo(el){if(!el)return;const p=center(el),x=(p.x/canvas.clientWidth-.5)*8,y=(p.y/canvas.clientHeight-.42)*6;document.querySelectorAll('.pupil').forEach(v=>v.style.transform=`translate(${x}px,${y}px)`)}
function paintOcclusion(r){placed.forEach((el,id)=>{const hidden=1-(r.vis.per[id]??1);el.classList.toggle('occluded',hidden>.05);el.style.setProperty('--hidden',`${Math.round(hidden*100)}%`);el.title=hidden>.05?`${Math.round(hidden*100)}% covered`:''})}
function runLive(){
  const r=calculate();drawPath(r);paintOcclusion(r);
  const readable=taskOrder.find(id=>placed.has(id)&&(r.vis.per[id]??1)>.6);moveEyesTo(readable?placed.get(readable):null);
  document.getElementById('scoreValue').textContent=r.score+'/100';document.getElementById('scoreBar').style.width=r.score+'%';document.getElementById('scoreLabel').textContent=r.score>=85?'Clear and readable':r.score>=65?'Usable with friction':r.score>=50?'Weak structure':'Critical usability failure';
  ['visibility','placement','grouping','flow'].forEach(k=>document.getElementById(k+'Metric').textContent=grade(r[k]));
  const list=document.getElementById('findingsList');list.innerHTML='';r.findings.forEach(f=>{const li=document.createElement('li');li.textContent=f;list.appendChild(li)});
  const mouth=document.getElementById('mouth');mouth.className='mouth '+(r.score>=78?'happy':r.score<50?'sad':'neutral');
  document.getElementById('observerText').textContent=r.score>=85?'I can see the important information and follow the next step immediately.':r.score>=65?'I can complete the task, but a few relationships slow me down.':r.score>=50?'I need to search and reconstruct the page structure.':'Important information is missing, hidden or blocked.';
}

modeSelect.addEventListener('change',()=>{document.getElementById('modeNote').textContent=modeSelect.value==='task'?'Task completion model':modeSelect.value==='gutenberg'?'Historical layout heuristic':'Perceptual grouping model';scheduleAnalysis()});
document.getElementById('resetBtn').addEventListener('click',reset);
const dialog=document.getElementById('evidenceDialog');document.getElementById('evidenceBtn').addEventListener('click',()=>dialog.showModal());document.getElementById('closeDialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
window.addEventListener('resize',scheduleAnalysis);makePalette();setTimeout(reset,60);
