const definitions = [
  {id:'logo', label:'Logo', icon:'◈', hint:'Brand recognition'},
  {id:'title', label:'Product title', icon:'T', hint:'What is this?'},
  {id:'image', label:'Product image', icon:'▧', hint:'Primary product visual'},
  {id:'price', label:'Price', icon:'$', hint:'Cost and value'},
  {id:'rating', label:'Reviews', icon:'★', hint:'Social proof'},
  {id:'variants', label:'Size / variants', icon:'⌘', hint:'Required selection'},
  {id:'shipping', label:'Shipping info', icon:'↗', hint:'Delivery reassurance'},
  {id:'cta', label:'Add to cart', icon:'＋', hint:'Primary action'},
  {id:'model', label:'Gaze cue model', icon:'☺', hint:'Double-click to flip gaze'}
];

const defaults = {
  logo:[30,55], image:[38,145], title:[275,130], rating:[275,190], price:[275,235], variants:[275,295], cta:[275,370], shipping:[275,430], model:[470,145]
};
const preferred = {
  logo:{x:[0,.35],y:[0,.18]}, image:{x:[0,.52],y:[.12,.7]}, title:{x:[.35,1],y:[.08,.35]}, rating:{x:[.34,1],y:[.1,.45]}, price:{x:[.34,1],y:[.18,.52]}, variants:{x:[.34,1],y:[.28,.65]}, cta:{x:[.34,1],y:[.38,.77]}, shipping:{x:[.34,1],y:[.45,.86]}, model:{x:[0,1],y:[.1,.7]}
};
const taskOrder=['image','title','rating','price','variants','cta','shipping'];
let placed = new Map();
let draggedId = null;

const palette=document.getElementById('palette');
const canvas=document.getElementById('canvas');
const pathLayer=document.getElementById('pathLayer');
const dropHint=document.getElementById('dropHint');

function makePalette(){
  palette.innerHTML='';
  definitions.forEach(d=>{
    const el=document.createElement('div'); el.className='palette-item'; el.draggable=true; el.dataset.id=d.id;
    el.innerHTML=`<span class="icon">${d.icon}</span><span>${d.label}<small class="small">${d.hint}</small></span>`;
    el.addEventListener('dragstart',()=>{draggedId=d.id});
    palette.appendChild(el);
  });
}

function addToCanvas(id,x,y){
  const d=definitions.find(v=>v.id===id); if(!d) return;
  let el=placed.get(id);
  if(!el){
    el=document.createElement('div'); el.className='canvas-item'; el.dataset.type=id; el.dataset.id=id; el.draggable=true;
    el.innerHTML=`${d.label}<span class="small">${d.hint}</span>`;
    el.addEventListener('dragstart',e=>{draggedId=id; el.classList.add('dragging'); e.dataTransfer.setData('text/plain',id)});
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dblclick',()=>{
      if(id==='model'){el.classList.toggle('looking-left');el.classList.toggle('looking-right');}
      else removeFromCanvas(id);
    });
    if(id==='model') el.classList.add('looking-left');
    canvas.appendChild(el); placed.set(id,el);
  }
  const maxX=canvas.clientWidth-el.offsetWidth-6, maxY=canvas.clientHeight-el.offsetHeight-6;
  el.style.left=Math.max(4,Math.min(x,maxX))+'px'; el.style.top=Math.max(38,Math.min(y,maxY))+'px';
  syncPalette(); clearSimulation();
}
function removeFromCanvas(id){const el=placed.get(id);if(el)el.remove();placed.delete(id);syncPalette();clearSimulation()}
function syncPalette(){document.querySelectorAll('.palette-item').forEach(el=>el.classList.toggle('used',placed.has(el.dataset.id)));dropHint.style.display=placed.size?'none':'grid'}
canvas.addEventListener('dragover',e=>e.preventDefault());
canvas.addEventListener('drop',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();addToCanvas(draggedId,e.clientX-r.left-55,e.clientY-r.top-20)});

function reset(){[...placed.values()].forEach(el=>el.remove());placed.clear();Object.entries(defaults).forEach(([id,p])=>addToCanvas(id,p[0],p[1]));clearSimulation();}
function center(el){const c=canvas.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:r.left-c.left+r.width/2,y:r.top-c.top+r.height/2}}
function norm(el){const p=center(el);return{x:p.x/canvas.clientWidth,y:(p.y-34)/(canvas.clientHeight-34)}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function grade(v){return v>=80?'Strong':v>=60?'Good':v>=40?'Mixed':'Weak'}

function calculate(){
  const findings=[]; let placementScores=[];
  placed.forEach((el,id)=>{if(!preferred[id])return;const p=norm(el),z=preferred[id];placementScores.push(p.x>=z.x[0]&&p.x<=z.x[1]&&p.y>=z.y[0]&&p.y<=z.y[1]?100:40)});
  const placement=placementScores.length?placementScores.reduce((a,b)=>a+b,0)/placementScores.length:0;
  const pairs=[['title','price'],['price','variants'],['variants','cta'],['rating','title'],['shipping','cta']];
  const pairScores=pairs.filter(([a,b])=>placed.has(a)&&placed.has(b)).map(([a,b])=>Math.max(0,100-dist(center(placed.get(a)),center(placed.get(b)))/3));
  const grouping=pairScores.length?pairScores.reduce((a,b)=>a+b,0)/pairScores.length:20;
  let collisions=0, near=0; const arr=[...placed.values()];
  for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
    const a=arr[i].getBoundingClientRect(),b=arr[j].getBoundingClientRect();
    const overlap=!(a.right<b.left||a.left>b.right||a.bottom<b.top||a.top>b.bottom); if(overlap)collisions++;
    else if(dist(center(arr[i]),center(arr[j]))<90)near++;
  }
  const crowding=Math.max(0,100-collisions*30-near*5);
  const present=taskOrder.filter(id=>placed.has(id)); let good=0;
  for(let i=1;i<present.length;i++){const prev=norm(placed.get(present[i-1])),cur=norm(placed.get(present[i]));if(cur.y>=prev.y-0.10||Math.abs(cur.x-prev.x)<.25)good++}
  const flow=present.length>1?(good/(present.length-1))*100:20;
  let gazeBonus=0;
  if(placed.has('model')&&placed.has('cta')){
    const m=placed.get('model'),mp=center(m),cp=center(placed.get('cta'));const pointsRight=m.classList.contains('looking-right');
    if((pointsRight&&cp.x>mp.x)||(!pointsRight&&cp.x<mp.x)){gazeBonus=5;findings.push('The model’s gaze supports the primary action direction.');}
    else findings.push('The model looks away from the primary action, creating a competing directional cue.');
  }
  let score=Math.round(placement*.32+grouping*.26+crowding*.22+flow*.20+gazeBonus);score=Math.min(100,score);
  if(!placed.has('cta'))findings.unshift('The primary action is missing, so the shopping task cannot be completed.');
  if(collisions)findings.unshift(`${collisions} overlapping relationship${collisions>1?'s':''} may make elements harder to distinguish.`);
  if(grouping<60)findings.push('Related product information is too dispersed; bring title, price, options and CTA into a clearer group.');
  if(placement<65)findings.push('Some familiar controls are outside their expected product-page regions, increasing search effort.');
  if(flow<60)findings.push('The vertical order does not support a clear evaluate → select → act sequence.');
  if(!findings.length)findings.push('The layout forms a coherent product evaluation and action sequence.');
  return{score,placement,grouping,crowding,flow,findings};
}

function drawPath(){
  pathLayer.innerHTML=''; const ids=taskOrder.filter(id=>placed.has(id)); if(ids.length<2)return;
  const pts=ids.map(id=>center(placed.get(id))).map(p=>({x:p.x,y:p.y-34}));
  const ns='http://www.w3.org/2000/svg';
  const line=document.createElementNS(ns,'polyline');line.setAttribute('points',pts.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#22231d');line.setAttribute('stroke-width','2');line.setAttribute('stroke-dasharray','6 6');line.setAttribute('opacity','.7');pathLayer.appendChild(line);
  pts.forEach((p,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);c.setAttribute('r','12');c.setAttribute('fill','#dbff3f');c.setAttribute('stroke','#22231d');pathLayer.appendChild(c);const t=document.createElementNS(ns,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+4);t.setAttribute('text-anchor','middle');t.setAttribute('font-size','10');t.setAttribute('font-weight','800');t.textContent=i+1;pathLayer.appendChild(t)});
}
function moveEyesTo(el){if(!el)return;const p=norm(el);const x=(p.x-.5)*8,y=(p.y-.4)*5;document.querySelectorAll('.pupil').forEach(v=>v.style.transform=`translate(${x}px,${y}px)`)}
function run(){
  const r=calculate();drawPath();const first=taskOrder.find(id=>placed.has(id));moveEyesTo(first?placed.get(first):null);
  document.getElementById('scoreValue').textContent=r.score+'/100';document.getElementById('scoreBar').style.width=r.score+'%';document.getElementById('scoreLabel').textContent=r.score>=80?'Clear and coherent':r.score>=60?'Usable, with friction':r.score>=40?'Competing structure':'High search effort';
  ['placement','grouping','crowding','flow'].forEach(k=>document.getElementById(k+'Metric').textContent=grade(r[k]));
  const list=document.getElementById('findingsList');list.innerHTML='';r.findings.slice(0,5).forEach(f=>{const li=document.createElement('li');li.textContent=f;list.appendChild(li)});
  const mouth=document.getElementById('mouth');mouth.className='mouth '+(r.score>=75?'happy':r.score<50?'sad':'neutral');
  document.getElementById('observerText').textContent=r.score>=80?'I can identify the product, evaluate it and find the next action quickly.':r.score>=60?'I understand the page, but a few relationships make me pause.':r.score>=40?'I need to search around before I know what to do.':'The page feels fragmented. I am not sure where to begin.';
  const ids=taskOrder.filter(id=>placed.has(id));ids.forEach((id,i)=>setTimeout(()=>moveEyesTo(placed.get(id)),i*500));
}
function clearSimulation(){pathLayer.innerHTML='';document.getElementById('scoreValue').textContent='—';document.getElementById('scoreBar').style.width='0';document.getElementById('scoreLabel').textContent='Layout changed — run again';document.querySelectorAll('.pupil').forEach(v=>v.style.transform='translate(0,0)')}

document.getElementById('runBtn').addEventListener('click',run);document.getElementById('resetBtn').addEventListener('click',reset);
const dialog=document.getElementById('evidenceDialog');document.getElementById('evidenceBtn').addEventListener('click',()=>dialog.showModal());document.getElementById('closeDialog').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
makePalette();setTimeout(reset,50);
