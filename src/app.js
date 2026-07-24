import {createGame,investigate,treat,admit,buy,advancePhase,assignStaff,returnStaff,placeFacility,compatible,getFacility,previewResolution,patientRisk,scheduleSurgery,cancelSurgery,placePostoperativePatient,surgeryEligibility} from './engine.js?v=21';
import {STAFF,FACILITIES} from './data.js?v=7';

let game=createGame(),selectedStaff=null,selectedAdmission=null,selectedFacility=null,selectedAbility=null,selectedSurgery=null,resolutionAnimating=false;
const $=id=>document.getElementById(id),names={nursing:'Nursing',medication:'Medication',surgery:'Surgery'};
const treatmentIcons={
  nursing:'<svg class="treatment-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2 4.8 13C1 9.2 3.7 4 8.1 4c1.7 0 3.1.8 3.9 2 1-1.2 2.3-2 4-2 4.4 0 7 5.2 3.2 9L12 20.2Z"/><path d="M12 8.2v6.3M8.9 11.35h6.2"/></svg>',
  medication:'<svg class="treatment-icon" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-35 12 12)"><rect x="4" y="8" width="16" height="8" rx="4"/><path d="M12 8v8"/></g></svg>',
  surgery:'<svg class="treatment-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 1.3-5L15 5.3l3.7 3.7-9.8 9.7L4 20Z"/><path d="m14 6.3 3.7 3.7M9 18.6l-3.6-3.5M17.2 4.2l2.6 2.6"/></svg>'
};
const phaseCopy={
  assignment:{name:'Staff assignment',help:'New patients have arrived. Move staff between compatible vacant facility slots, then activate the team.',button:'Activate staff'},
  activation:{name:'Staff actions',help:'Use staff abilities, investigate patients, allocate treatment, and admit patients to wards.',button:'Resolve patients'},
  resolution:{name:'Patient resolution',help:'Completed patients were discharged, rewards resolved, and remaining patients were checked for deterioration.',button:'Schedule surgery'},
  scheduling:{name:'Surgery scheduling',help:'Schedule Surgery. When this stage ends, waiting patients fill vacant Emergency spaces. Lose 1 reputation for every 2 patients still queued, rounded up.',button:'Resolve arrival queue'},
  postoperative:{name:'Postoperative placement',help:'Surgery is complete. Place every Theatre patient into a vacant ward bed before new patients arrive.',button:'Place Theatre patients'},
  purchasing:{name:'Purchasing',help:'Spend this round’s money on staff and facilities. New cards become available next round.',button:'Start next round'}
};

function render(){
  if(game.phase==='postoperative'&&!selectedAdmission)selectedAdmission=postoperativePatients()[0]?.id||null;
  const nursing=game.facilities.reduce((n,f)=>n+f.nursing,0),mode=selectedAdmission?'admission':selectedFacility?'building':selectedAbility?'ability':selectedSurgery?'surgery':null,phase=phaseCopy[game.phase],preview=game.phase==='activation'&&previewResolution(game);
  $('stats').innerHTML=stat('Round',game.round)+stat('Stage',phase.name)+stat('Queue',game.queue.length)+stat('Reputation',game.reputation)+stat('Money','$'+game.money);
  $('briefing').className=`briefing ${mode?`${mode}-mode`:''}`;
  $('briefing').innerHTML=selectedAdmission
    ?`<div><strong>${game.phase==='postoperative'?'Postoperative placement':'Choose a ward bed'}</strong><span>Vacant ward beds are highlighted for Patient ${patientPortrait(selectedAdmission)}.${game.phase==='postoperative'?` ${postoperativePatients().length} patient${postoperativePatients().length===1?'':'s'} remaining.`:''}</span>${game.phase==='postoperative'?'':'<button data-action="cancelMode">Cancel</button>'}</div>`
    :selectedFacility?`<div><strong>Place ${FACILITIES[getFacility(game,selectedFacility).key].name}</strong><span>Choose any highlighted plot. Its grid position will support future adjacency effects.</span><button data-action="cancelFacility">Cancel purchase</button></div>`
    :selectedAbility?`<div><strong>Use ${STAFF[game.staff.find(s=>s.id===selectedAbility).key].name}</strong><span>Choose one of the highlighted patients in this staff member’s assigned facility.</span><button data-action="cancelAbility">Cancel</button></div>`
    :selectedSurgery?`<div><strong>Choose an Operating Theatre</strong><span>Vacant spaces in staffed Theatres are highlighted for Patient ${patientPortrait(selectedSurgery)}. Their previous space will become vacant.</span><button data-action="cancelSurgerySelection">Cancel</button></div>`
    :`<div><strong>${phase.name}</strong><span>${phase.help}</span></div>${game.phase==='activation'?`<div class="activation-sidebar"><div class="resource-bank"><b>Available</b>${resourceBadge('nursing',nursing)}${resourceBadge('medication',game.resources.medication)}</div>${resolutionPreview(preview)}</div>`:''}`;
  $('hospitalMap').innerHTML=Array.from({length:6},(_,slot)=>{const f=game.facilities.find(x=>x.slotIndex===slot);return f?facilityTile(f):buildPlot(slot)}).join('');
  $('arrivalQueue').innerHTML=game.queue.length?game.queue.map(queueCard).join(''):'<div class="queue-empty">No patients waiting</div>';
  $('staff').innerHTML=game.staff.map(staffCard).join('');
  $('market').innerHTML=game.market.length?game.market.map(marketCard).join(''):'<div class="market-empty">All of this round’s offers have been purchased.</div>';
  $('log').innerHTML=game.log.slice(0,9).map(x=>`<li>${x}</li>`).join('');
  $('endTurn').textContent=phase.button;
  $('endTurn').disabled=resolutionAnimating||game.gameOver||Boolean(mode)||game.phase==='postoperative'||(game.phase==='purchasing'&&game.facilities.some(f=>f.slotIndex===null));
  bind();
}

function buildPlot(slot){return selectedFacility?`<button class="build-plot placement-target" data-action="placeFacility" data-facility="${selectedFacility}" data-slot="${slot}"><span>+</span><small>Build here</small></button>`:'<div class="build-plot"><span>+</span><small>Future facility</small></div>'}
function queueCard(p){return `<div class="queue-patient"><div class="patient-token">${p.portrait}</div><div><strong>Waiting</strong><small>Needs hidden</small></div></div>`}

function facilityTile(f){
  const d=FACILITIES[f.key],assigned=game.staff.filter(s=>s.facilityId===f.id);
  const beds=d.beds?Array.from({length:d.beds},(_,i)=>bed(f,f.patients[i],i)).join(''):d.kind==='theatre'?theatreSpaces(f,d):`<div class="equipment ${f.key}"><div class="equipment-core">${d.short}</div><span>Medication store</span></div>`;
  const selectedMember=game.phase==='assignment'&&game.staff.find(s=>s.id===selectedStaff),selectedRole=selectedMember&&STAFF[selectedMember.key].role;
  const slots=d.slots.map(role=>{
    const s=assigned.find(x=>STAFF[x.key].role===role);
    if(s)return game.phase==='assignment'?`<button class="staff-slot filled selectable-staff" data-action="selectStaff" data-staff="${s.id}" title="Select ${STAFF[s.key].name}"><span>${STAFF[s.key].monogram}</span><small>${STAFF[s.key].name}</small></button>`:`<div class="staff-slot filled"><span>${STAFF[s.key].monogram}</span><small>${STAFF[s.key].name}</small></div>`;
    if(selectedStaff&&role===selectedRole&&compatible(game,selectedStaff,f.id))return `<button class="staff-slot assignment-target" data-action="assign" data-staff="${selectedStaff}" data-facility="${f.id}" title="Move ${STAFF[selectedMember.key].name} here"><span>+</span><small>Move here</small></button>`;
    return `<div class="staff-slot"><span>${role.toUpperCase()}</span><small>${role} slot</small></div>`;
  }).join('');
  return `<article class="facility ${d.colour}" data-facility="${f.id}" data-map-slot="${f.slotIndex}"><header><div><span class="room-code">${d.short}</span><h3>${d.name}</h3></div><span class="occupancy">${d.beds?`${f.patients.length}/${d.beds} beds`:d.kind==='theatre'?`${f.patients.length}/${d.patientSpaces} occupied`:`plot ${f.slotIndex+1}`}</span></header><div class="room-art"><div class="floor-lines"></div><div class="beds">${beds}</div><div class="station"><div class="desk"></div><small>${d.kind==='ward'?'Nurse station':d.kind==='clinical'?'Assessment desk':d.kind==='theatre'?'Theatre team':'Work area'}</small></div></div><div class="room-footer"><div class="slots">${slots}</div><div class="room-actions"><small>${d.effect}</small></div></div></article>`;
}

function theatreSpaces(f,d){return Array.from({length:d.patientSpaces||0},(_,i)=>{const patient=f.patients[i];if(patient)return `<div class="theatre-space occupied"><div class="patient-token">${patient.portrait}</div><span>${patient.postoperative?'Needs ward bed':'Scheduled'}</span>${game.phase==='scheduling'?`<button data-action="cancelScheduledSurgery" data-id="${patient.id}">Remove</button>`:game.phase==='postoperative'?`<button data-action="startPostoperative" data-id="${patient.id}">Place in ward</button>`:''}</div>`;const staffed=game.staff.some(s=>s.facilityId===f.id&&STAFF[s.key].role==='surgeon');return selectedSurgery&&staffed?`<button class="theatre-space surgery-target" data-action="scheduleSurgery" data-id="${selectedSurgery}" data-target="${f.id}"><span>+</span><small>Schedule here</small></button>`:`<div class="theatre-space empty"><div class="equipment-core">OT</div><span>${staffed?'Available':'Needs Surgeon'}</span></div>`}).join('')}

function bed(f,p,i){
  if(!p){const target=selectedAdmission&&FACILITIES[f.key].kind==='ward',action=game.phase==='postoperative'?'placePostoperative':'admit';return target?`<button class="bed empty admission-target" data-action="${action}" data-id="${selectedAdmission}" data-target="${f.id}"><div class="pillow"></div><span>Place in bed ${i+1}</span></button>`:`<div class="bed empty"><div class="pillow"></div><span>Bed ${i+1}</span></div>`}
  const needs=p.revealed?Object.entries(p.needs).filter(([,n])=>n).flatMap(([k,n])=>Array.from({length:n},(_,x)=>`<span class="need ${k} ${x<(p.completed[k]||0)?'done':''}" title="${names[k]}${x<(p.completed[k]||0)?' completed':''}">${treatmentIcons[k]}</span>`)).join(''):'<span class="need unknown" title="Needs hidden">?</span>';
  const risk=patientRisk(p),riskBadge=p.revealed?`<span class="patient-risk ${risk.key}" title="${risk.unmet} unmet needs">${risk.unmet} unmet · ${risk.label}</span>`:'';
  if(selectedAbility&&canTargetPatient(selectedAbility,p,f)){
    const member=game.staff.find(s=>s.id===selectedAbility),role=STAFF[member.key].role;
    return `<button class="bed occupied ability-target" data-action="useStaffAbility" data-staff="${member.id}" data-id="${p.id}"><div class="pillow"></div><div class="patient-token">${p.portrait}</div><div class="bed-needs">${needs}</div><span class="target-label">${role==='doctor'?'Investigate':'Give care'}</span></button>`;
  }
  let actions=game.phase==='scheduling'?(p.revealed&&(p.completed.surgery||0)<p.needs.surgery?`<button data-action="startSurgery" data-id="${p.id}">Schedule surgery</button><small>${surgeryEligibility(game,p.id).reason}</small>`:'<small>No revealed unmet Surgery need</small>'):game.phase!=='activation'?'<small>Available during staff actions</small>':!p.revealed?`<button data-action="investigate" data-id="${p.id}">Investigate</button>`:Object.keys(names).filter(k=>k!=='surgery'&&(p.completed[k]||0)<p.needs[k]).map(k=>`<button class="treatment-button ${k}" data-action="treat" data-type="${k}" data-id="${p.id}">${treatmentIcons[k]}<span>${names[k]}</span></button>`).join('');
  if(game.phase==='activation'&&f.key==='ed')actions+=`<button data-action="startAdmission" data-id="${p.id}" ${hasVacantWard()?'':'disabled'}>Admit to ward</button>`;
  return `<div class="bed occupied ${p.revealed?'revealed':''}" data-patient-id="${p.id}"><div class="pillow"></div><div class="patient-token">${p.portrait}</div>${riskBadge}${p.revealed?`<div class="bed-needs">${needs}</div>`:''}<div class="patient-popover"><strong>Patient ${p.portrait}</strong><small>${p.revealed?`$${p.reward} &middot; +${p.reputation} rep`:'Needs and reward hidden'}</small>${riskBadge}<div class="risk-rules">0–3 stable · 4–6 deteriorates · 7+ dies</div><div class="needs">${needs}</div><div class="patient-actions">${actions}</div></div></div>`;
}

function staffCard(s){
  const d=STAFF[s.key],f=getFacility(game,s.facilityId),assignment=game.phase==='assignment';
  let controls=assignment?`<button data-action="selectStaff" data-staff="${s.id}">${selectedStaff===s.id?'Selected':'Move / assign'}</button>${f?`<button class="secondary" data-action="returnStaff" data-staff="${s.id}">Return to available</button>`:''}`:staffAbilityControl(s,f);
  return `<article class="staff-card ${selectedStaff===s.id||selectedAbility===s.id?'selected':''} ${s.used?'used':''}"><div class="staff-portrait">${d.monogram}</div><strong>${d.name}</strong><small>${f?FACILITIES[f.key].name:'Available staff'}</small><p>${d.effect}</p>${controls}</article>`
}
function marketCard(m){const d=m.kind==='staff'?STAFF[m.key]:FACILITIES[m.key],noPlot=m.kind==='facility'&&!hasFreePlot(),open=game.phase==='purchasing';return `<article class="market-card"><span class="market-icon">${d.monogram||d.short}</span><strong>${d.name}</strong><small>${d.effect}</small><button data-action="buy" data-kind="${m.kind}" data-key="${m.key}" ${!open||game.money<d.cost||noPlot||selectedFacility?'disabled':''}>${open?'Buy':'Purchasing closed'} &middot; $${d.cost}</button></article>`}

function bind(){document.querySelectorAll('[data-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=b.dataset,a=x.action;let ok=true;
  if(a==='selectStaff'){selectedStaff=x.staff;selectedAdmission=null;render();return}
  if(a==='startAdmission'){selectedAdmission=x.id;selectedStaff=null;render();return}
  if(a==='startPostoperative'){selectedAdmission=x.id;selectedStaff=null;render();return}
  if(a==='startSurgery'){const eligibility=surgeryEligibility(game,x.id);if(!eligibility.ok){toast(eligibility.reason);return}selectedSurgery=x.id;selectedStaff=selectedAdmission=null;render();return}
  if(a==='cancelSurgerySelection'){selectedSurgery=null;render();return}
  if(a==='cancelMode'){selectedAdmission=null;render();return}
  if(a==='startStaffAbility'){selectedAbility=x.staff;selectedStaff=selectedAdmission=null;render();return}
  if(a==='cancelAbility'){selectedAbility=null;render();return}
  if(a==='cancelFacility'){const f=getFacility(game,selectedFacility);if(f&&f.slotIndex===null){game.money+=FACILITIES[f.key].cost;game.facilities.splice(game.facilities.indexOf(f),1)}selectedFacility=null;render();return}
  if(a==='assign'){ok=assignStaff(game,x.staff,x.facility);if(ok)selectedStaff=null}
  else if(a==='returnStaff'){ok=returnStaff(game,x.staff);if(ok&&selectedStaff===x.staff)selectedStaff=null}
  else if(a==='placeFacility'){ok=placeFacility(game,x.facility,x.slot);if(ok)selectedFacility=null}
  else if(a==='investigate')ok=investigate(game,x.id);
  else if(a==='treat')ok=treat(game,x.id,x.type);
  else if(a==='useStaffAbility'){const member=game.staff.find(s=>s.id===x.staff),role=STAFF[member?.key]?.role;ok=role==='doctor'?investigate(game,x.id):role==='nurse'?treat(game,x.id,'nursing'):false;if(ok)selectedAbility=null}
  else if(a==='admit'){ok=admit(game,x.id,x.target);if(ok)selectedAdmission=null}
  else if(a==='placePostoperative'){ok=placePostoperativePatient(game,x.id,x.target);if(ok)selectedAdmission=null}
  else if(a==='scheduleSurgery'){const eligibility=surgeryEligibility(game,x.id,x.target);if(!eligibility.ok){toast(eligibility.reason);render();return}ok=scheduleSurgery(game,x.id,x.target);if(ok)selectedSurgery=null}
  else if(a==='cancelScheduledSurgery')ok=cancelSurgery(game,x.id);
  else if(a==='buy'){ok=buy(game,x.kind,x.key);if(ok&&x.kind==='facility')selectedFacility=game.facilities.find(f=>f.slotIndex===null)?.id||null}
  if(!ok)toast('That action is not available during this stage, or its requirements are not met.');render();})}

function hasVacantWard(){return game.facilities.some(f=>f.slotIndex!==null&&FACILITIES[f.key].kind==='ward'&&f.patients.length<FACILITIES[f.key].beds)}
function postoperativePatients(){return game.facilities.filter(f=>FACILITIES[f.key].kind==='theatre').flatMap(f=>f.patients.filter(p=>p.postoperative))}
function isScheduled(patientId){return game.facilities.some(f=>FACILITIES[f.key].kind==='theatre'&&f.patients.some(x=>x.id===patientId))}
function hasVacantStaffedTheatre(){return game.facilities.some(f=>FACILITIES[f.key].kind==='theatre'&&f.patients.length<(FACILITIES[f.key].patientSpaces||0)&&game.staff.some(s=>s.facilityId===f.id&&STAFF[s.key].role==='surgeon'))}
function hasFreePlot(){return game.facilities.filter(f=>f.slotIndex!==null).length<6}
function patientPortrait(id){for(const f of game.facilities){const p=f.patients.find(x=>x.id===id);if(p)return p.portrait}return game.queue.find(p=>p.id===id)?.portrait||'?'}
function resourceBadge(type,value){return `<span class="resource ${type}">${treatmentIcons[type]}<span>${names[type]} ${value}</span></span>`}
function resolutionPreview(p){return `<div class="resolution-preview"><b>If resolved now</b><span>Discharge <strong>${p.ready}</strong></span><span>+$${p.money}</span><span>+${p.reputation} rep</span><span class="${p.worsening?'risk':''}">Worsen ${p.worsening}</span>${p.protected?`<span class="protected">ICU protects ${p.protected}</span>`:''}<span class="${p.deaths?'danger':''}">Deaths ${p.deaths}</span>${p.hiddenAtRisk?`<span class="unknown-risk">${p.hiddenAtRisk} hidden patient${p.hiddenAtRisk===1?'':'s'} at unknown risk</span>`:''}</div>`}
function canTargetPatient(staffId,p,f){
  const member=game.staff.find(s=>s.id===staffId);if(game.phase!=='activation'||!member||member.facilityId!==f.id)return false;
  const role=STAFF[member.key].role;
  if(role==='doctor')return !member.used&&!p.revealed;
  if(role==='nurse')return p.revealed&&f.nursing>0&&(p.completed.nursing||0)<p.needs.nursing&&p.nursingRound!==game.round;
  return false
}
function staffAbilityControl(s,f){
  if(game.phase!=='activation')return '<button disabled>Available next round</button>';
  const role=STAFF[s.key].role;
  if(!f)return '<button disabled>Assign to a facility next round</button>';
  if(role==='doctor'){const available=!s.used&&f.patients.some(p=>!p.revealed);return `<button data-action="startStaffAbility" data-staff="${s.id}" ${available?'':'disabled'}>${s.used?'Ability used':available?'Investigate patient':'No hidden patients here'}</button>`}
  if(role==='nurse'){const available=f.nursing>0&&f.patients.some(p=>p.revealed&&(p.completed.nursing||0)<p.needs.nursing&&p.nursingRound!==game.round);return `<button data-action="startStaffAbility" data-staff="${s.id}" ${available?'':'disabled'}>${available?`Allocate Nursing (${f.nursing} left)`:'No eligible patients'}</button>`}
  if(role==='pharmacist')return `<button disabled>Generated ${f.key==='pharmacy'?2:1} Medication</button>`;
  if(role==='surgeon')return `<button disabled>${f.key==='theatre'?'Ready for surgery scheduling':'Requires Operating Theatre'}</button>`;
  return '<button disabled>Ability resolved</button>'
}
function stat(k,v){return `<span class="stat">${k} ${v}</span>`}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1700)}

function capturePatientRects(){return Object.fromEntries([...document.querySelectorAll('[data-patient-id]')].map(el=>{const r=el.getBoundingClientRect();return [el.dataset.patientId,{left:r.left,top:r.top,width:r.width,height:r.height}]}))}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function resolutionBanner(text,tone){const el=document.createElement('div');el.className=`resolution-banner ${tone}`;el.textContent=text;document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>el.classList.remove('show'),620);setTimeout(()=>el.remove(),850)}
function patientGhost(event,rect,tone,label){if(!rect)return;const el=document.createElement('div');el.className=`patient-ghost ${tone}`;Object.assign(el.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});el.innerHTML=`<span>${event.portrait}</span><b>${label}</b>`;document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('animate'));setTimeout(()=>el.remove(),850)}
function rewardFly(text,kind,rect){if(!rect)return;const el=document.createElement('span');el.className=`reward-fly ${kind}`;el.textContent=text;el.style.left=`${rect.left+rect.width/2}px`;el.style.top=`${rect.top}px`;document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('animate'));setTimeout(()=>el.remove(),900)}
async function playResolutionEvents(events,rects){
  document.body.classList.add('resolving');
  if(!events.length){resolutionBanner('No patient outcomes this round','neutral');await pause(700)}
  for(const event of events){
    const rect=rects[event.patientId];
    if(event.type==='discharge'){patientGhost(event,rect,'discharge','Discharged');rewardFly(`+$${event.reward}`,'money',rect);if(rect)rewardFly(`+${event.reputation} rep`,'reputation',{...rect,top:rect.top+22});resolutionBanner(`Patient ${event.portrait} discharged`,'success')}
    if(event.type==='deteriorate'){const bed=document.querySelector(`[data-patient-id="${event.patientId}"]`);bed?.classList.add('resolution-deteriorate');const need=event.hidden?'?':names[event.need];resolutionBanner(`Patient ${event.portrait} deteriorated · +${need}`,'warning');if(bed){const burst=document.createElement('span');burst.className=`need-burst ${event.hidden?'unknown':event.need}`;burst.innerHTML=event.hidden?'?':treatmentIcons[event.need];bed.appendChild(burst);setTimeout(()=>{burst.remove();bed.classList.remove('resolution-deteriorate')},850)}}
    if(event.type==='protected'){const bed=document.querySelector(`[data-patient-id="${event.patientId}"]`);bed?.classList.add('resolution-protected');resolutionBanner(`Intensive Care protected Patient ${event.portrait}`,'protected');if(bed)setTimeout(()=>bed.classList.remove('resolution-protected'),850)}
    if(event.type==='death'){patientGhost(event,rect,'death','Patient lost');rewardFly(`-${event.reputationLoss} rep`,'loss',rect);resolutionBanner(`Patient ${event.portrait} died`,'danger')}
    await pause(760);
  }
  document.body.classList.remove('resolving');
}
$('endTurn').onclick=async()=>{
  if(resolutionAnimating)return;
  if(game.phase==='activation'){
    const rects=capturePatientRects();resolutionAnimating=true;
    if(!advancePhase(game)){resolutionAnimating=false;return}
    selectedStaff=selectedAdmission=selectedFacility=selectedAbility=selectedSurgery=null;render();
    await playResolutionEvents(game.resolutionEvents,rects);resolutionAnimating=false;render();return
  }
  if(!advancePhase(game))toast('Place every purchased facility before starting the next round.');
  selectedStaff=selectedAdmission=selectedFacility=selectedAbility=selectedSurgery=null;render()
};
$('reset').onclick=()=>{game=createGame();selectedStaff=selectedAdmission=selectedFacility=selectedAbility=selectedSurgery=null;render()};
$('clearSelection').onclick=()=>{selectedStaff=null;render()};
render();
