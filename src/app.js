import {createGame,investigate,treat,admit,discharge,buy,endRound,assignStaff,returnStaff,placeFacility,compatible,getFacility} from './engine.js?v=5';
import {STAFF,FACILITIES,MARKET} from './data.js?v=2';

let game=createGame(),selectedStaff=null,selectedAdmission=null,selectedFacility=null;
const $=id=>document.getElementById(id),names={nursing:'Nursing',medication:'Medication',surgery:'Surgery'};

function render(){
  const nursing=game.facilities.reduce((n,f)=>n+f.nursing,0),mode=selectedAdmission?'admission':selectedFacility?'building':null;
  $('stats').innerHTML=stat('Round',game.round)+stat('Reputation',game.reputation)+stat('Money','$'+game.money);
  $('briefing').className=`briefing ${mode?`${mode}-mode`:''}`;
  $('briefing').innerHTML=selectedAdmission
    ?`<div><strong>Choose a bed</strong><span>Vacant ward beds are highlighted for Patient ${patientPortrait(selectedAdmission)}.</span><button data-action="cancelMode">Cancel</button></div>`
    :selectedFacility?`<div><strong>Place ${FACILITIES[getFacility(game,selectedFacility).key].name}</strong><span>Choose any highlighted plot. Its grid position will support future adjacency effects.</span><button data-action="cancelFacility">Cancel purchase</button></div>`
    :`<div><strong>Round ${game.round}</strong><span>Investigate in Emergency, admit to a ward, and keep each room staffed.</span></div><div class="resource-bank"><b>Available</b><span class="resource nursing">Nursing ${nursing}</span><span class="resource medication">Medication ${game.resources.medication}</span><span class="resource surgery">Surgery ${game.resources.surgery}</span></div>`;
  $('hospitalMap').innerHTML=Array.from({length:6},(_,slot)=>{const f=game.facilities.find(x=>x.slotIndex===slot);return f?facilityTile(f):buildPlot(slot)}).join('');
  $('staff').innerHTML=game.staff.map(staffCard).join('');
  $('market').innerHTML=MARKET.map(marketCard).join('');
  $('log').innerHTML=game.log.slice(0,9).map(x=>`<li>${x}</li>`).join('');
  $('endTurn').disabled=game.gameOver||Boolean(mode);bind();
}

function buildPlot(slot){return selectedFacility?`<button class="build-plot placement-target" data-action="placeFacility" data-facility="${selectedFacility}" data-slot="${slot}"><span>+</span><small>Build here</small></button>`:'<div class="build-plot"><span>+</span><small>Future facility</small></div>'}

function facilityTile(f){
  const d=FACILITIES[f.key],assigned=game.staff.filter(s=>s.facilityId===f.id);
  const beds=d.beds?Array.from({length:d.beds},(_,i)=>bed(f,f.patients[i],i)).join(''):`<div class="equipment ${f.key}"><div class="equipment-core">${d.short}</div><span>${f.key==='pharmacy'?'Medication store':'Operating table'}</span></div>`;
  const selectedMember=game.staff.find(s=>s.id===selectedStaff),selectedRole=selectedMember&&STAFF[selectedMember.key].role;
  const slots=d.slots.map(role=>{
    const s=assigned.find(x=>STAFF[x.key].role===role);
    if(s)return `<button class="staff-slot filled selectable-staff" data-action="selectStaff" data-staff="${s.id}" title="Select ${STAFF[s.key].name}"><span>${STAFF[s.key].monogram}</span><small>${STAFF[s.key].name}</small></button>`;
    if(selectedStaff&&role===selectedRole&&compatible(game,selectedStaff,f.id))return `<button class="staff-slot assignment-target" data-action="assign" data-staff="${selectedStaff}" data-facility="${f.id}" title="Move ${STAFF[selectedMember.key].name} here"><span>+</span><small>Move here</small></button>`;
    return `<div class="staff-slot"><span>${role.toUpperCase()}</span><small>${role} slot</small></div>`;
  }).join('');
  return `<article class="facility ${d.colour}" data-facility="${f.id}" data-map-slot="${f.slotIndex}"><header><div><span class="room-code">${d.short}</span><h3>${d.name}</h3></div><span class="occupancy">${d.beds?`${f.patients.length}/${d.beds} beds`:`plot ${f.slotIndex+1}`}</span></header><div class="room-art"><div class="floor-lines"></div><div class="beds">${beds}</div><div class="station"><div class="desk"></div><small>${d.kind==='ward'?'Nurse station':d.kind==='clinical'?'Assessment desk':'Work area'}</small></div></div><div class="room-footer"><div class="slots">${slots}</div><div class="room-actions"><small>${d.effect}</small></div></div></article>`;
}

function bed(f,p,i){
  if(!p){const target=selectedAdmission&&FACILITIES[f.key].kind==='ward';return target?`<button class="bed empty admission-target" data-action="admit" data-id="${selectedAdmission}" data-target="${f.id}"><div class="pillow"></div><span>Admit to bed ${i+1}</span></button>`:`<div class="bed empty"><div class="pillow"></div><span>Bed ${i+1}</span></div>`}
  const needs=p.revealed?Object.entries(p.needs).filter(([,n])=>n).flatMap(([k,n])=>Array.from({length:n},(_,x)=>`<span class="need ${k} ${x<(p.completed[k]||0)?'done':''}">${names[k][0]}</span>`)).join(''):'<span class="need unknown">?</span>';
  let actions=!p.revealed?`<button data-action="investigate" data-id="${p.id}">Investigate</button>`:Object.keys(names).filter(k=>(p.completed[k]||0)<p.needs[k]).map(k=>`<button data-action="treat" data-type="${k}" data-id="${p.id}">${names[k]}</button>`).join('');
  if(f.key==='ed')actions+=`<button data-action="startAdmission" data-id="${p.id}" ${hasVacantWard()?'':'disabled'}>Admit to ward</button>`;
  if(p.revealed)actions+=`<button data-action="discharge" data-id="${p.id}">Discharge</button>`;
  return `<div class="bed occupied"><div class="pillow"></div><div class="patient-token">${p.portrait}</div><div class="patient-popover"><strong>Patient ${p.portrait}</strong><small>${p.revealed?`$${p.reward} · +${p.reputation} rep`:'Needs hidden'}</small><div class="needs">${needs}</div><div class="patient-actions">${actions}</div></div></div>`;
}

function staffCard(s){const d=STAFF[s.key],f=getFacility(game,s.facilityId);return `<article class="staff-card ${selectedStaff===s.id?'selected':''} ${s.used?'used':''}"><div class="staff-portrait">${d.monogram}</div><strong>${d.name}</strong><small>${f?FACILITIES[f.key].name:'Available staff'}</small><p>${d.effect}</p><button data-action="selectStaff" data-staff="${s.id}">${selectedStaff===s.id?'Selected':'Move / assign'}</button>${f?`<button class="secondary" data-action="returnStaff" data-staff="${s.id}">Return to available</button>`:''}</article>`}
function marketCard(m){const d=m.kind==='staff'?STAFF[m.key]:FACILITIES[m.key],noPlot=m.kind==='facility'&&!hasFreePlot();return `<article class="market-card"><span class="market-icon">${d.monogram||d.short}</span><strong>${d.name}</strong><small>${d.effect}</small><button data-action="buy" data-kind="${m.kind}" data-key="${m.key}" ${game.money<d.cost||noPlot||selectedFacility?'disabled':''}>Buy · $${d.cost}</button></article>`}

function bind(){document.querySelectorAll('[data-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=b.dataset,a=x.action;let ok=true;
  if(a==='selectStaff'){selectedStaff=x.staff;selectedAdmission=null;render();return}
  if(a==='startAdmission'){selectedAdmission=x.id;selectedStaff=null;render();return}
  if(a==='cancelMode'){selectedAdmission=null;render();return}
  if(a==='cancelFacility'){const f=getFacility(game,selectedFacility);if(f&&f.slotIndex===null){game.money+=FACILITIES[f.key].cost;game.facilities.splice(game.facilities.indexOf(f),1)}selectedFacility=null;render();return}
  if(a==='assign'){ok=assignStaff(game,x.staff,x.facility);if(ok)selectedStaff=null}
  else if(a==='returnStaff'){ok=returnStaff(game,x.staff);if(ok&&selectedStaff===x.staff)selectedStaff=null}
  else if(a==='placeFacility'){ok=placeFacility(game,x.facility,x.slot);if(ok)selectedFacility=null}
  else if(a==='investigate')ok=investigate(game,x.id);else if(a==='treat')ok=treat(game,x.id,x.type);else if(a==='admit'){ok=admit(game,x.id,x.target);if(ok)selectedAdmission=null}else if(a==='discharge')ok=discharge(game,x.id);
  else if(a==='buy'){ok=buy(game,x.kind,x.key);if(ok&&x.kind==='facility')selectedFacility=game.facilities.find(f=>f.slotIndex===null)?.id||null}
  if(!ok)toast('That action is not available. Check compatibility, capacity, or resources.');render();})}

function hasVacantWard(){return game.facilities.some(f=>f.slotIndex!==null&&FACILITIES[f.key].kind==='ward'&&f.patients.length<FACILITIES[f.key].beds)}function hasFreePlot(){return game.facilities.filter(f=>f.slotIndex!==null).length<6}function patientPortrait(id){for(const f of game.facilities){const p=f.patients.find(x=>x.id===id);if(p)return p.portrait}return '?'}
function stat(k,v){return `<span class="stat">${k} ${v}</span>`}function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1700)}
$('endTurn').onclick=()=>{endRound(game);selectedAdmission=null;render()};$('reset').onclick=()=>{game=createGame(Date.now()%1000);selectedStaff=selectedAdmission=selectedFacility=null;render()};$('clearSelection').onclick=()=>{selectedStaff=null;render()};render();
