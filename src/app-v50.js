import {createGame,investigate,treat,admit,buy,advancePhase,assignStaff,returnStaff,placeFacility,compatible,getFacility,previewResolution,patientRisk,scheduleSurgery,cancelSurgery,placePostoperativePatient,surgeryEligibility,theatreCapacity,purchaseCost,upkeepCost} from './engine-v50.js';
import {STAFF,FACILITIES} from './data.js?v=12';

let game=createGame(),selectedStaff=null,selectedAdmission=null,selectedFacility=null,selectedAbility=null,selectedSurgery=null,resolutionAnimating=false,rulesOpen=false;
const $=id=>document.getElementById(id),names={nursing:'Nursing',medication:'Medication',surgery:'Surgery'},roleNames={doctor:'Doctor',nurse:'Nurse',pharmacist:'Pharmacist',surgeon:'Surgeon',theatreNurse:'Theatre Nurse',administrator:'Administrator'};
const treatmentIcons={
  nursing:'<svg class="treatment-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2 4.8 13C1 9.2 3.7 4 8.1 4c1.7 0 3.1.8 3.9 2 1-1.2 2.3-2 4-2 4.4 0 7 5.2 3.2 9L12 20.2Z"/><path d="M12 8.2v6.3M8.9 11.35h6.2"/></svg>',
  medication:'<svg class="treatment-icon" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-35 12 12)"><rect x="4" y="8" width="16" height="8" rx="4"/><path d="M12 8v8"/></g></svg>',
  surgery:'<svg class="treatment-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 1.3-5L15 5.3l3.7 3.7-9.8 9.7L4 20Z"/><path d="m14 6.3 3.7 3.7M9 18.6l-3.6-3.5M17.2 4.2l2.6 2.6"/></svg>'
};
const phaseCopy={
  operations:{name:'Hospital operations',help:'Move unused staff, use abilities, investigate patients, allocate treatment, and admit patients. A staff member becomes committed after using an active ability.',button:'Resolve patients'},
  resolution:{name:'Patient resolution',help:'Completed patients were discharged, rewards resolved, and remaining patients were checked for deterioration.',button:'Schedule surgery'},
  scheduling:{name:'Surgery scheduling',help:'Schedule Surgery. When this stage ends, waiting patients fill vacant Emergency spaces. Lose 1 reputation for every 2 patients still queued, rounded up.',button:'Resolve arrival queue'},
  postoperative:{name:'Postoperative placement',help:'Surgery is complete. Place every Theatre patient into a vacant ward bed before new patients arrive.',button:'Place Theatre patients'},
  purchasing:{name:'Purchasing',help:'Upkeep has resolved. Spend the remaining money on staff and facilities; new cards become active next round.',button:'Start next round'}
};
phaseCopy.victory={name:'Campaign complete',help:'The hospital has completed its campaign. Review the final results.',button:'Campaign complete'};

function render(){
  if(game.phase==='postoperative'&&!selectedAdmission)selectedAdmission=postoperativePatients()[0]?.id||null;
  const mode=selectedAdmission?'admission':selectedFacility?'building':selectedAbility?'ability':selectedSurgery?'surgery':selectedStaff?'staff':null,phase=phaseCopy[game.phase],preview=game.phase==='operations'&&previewResolution(game);
  $('stats').innerHTML=stat('Round',game.round)+stat('Stage',phase.name)+stat('Queue',game.queue.length)+stat('Reputation',game.reputation)+stat('Money','$'+game.money)+stat('Next upkeep','$'+upkeepCost(game));
  $('briefing').className=`briefing ${mode?`${mode}-mode`:''}`;
  $('briefing').innerHTML=selectedAdmission
    ?`<div><strong>${game.phase==='postoperative'?'Postoperative placement':'Choose a ward bed'}</strong><span>Vacant ward beds are highlighted for Patient ${patientPortrait(selectedAdmission)}.${game.phase==='postoperative'?` ${postoperativePatients().length} patient${postoperativePatients().length===1?'':'s'} remaining.`:''}</span>${game.phase==='postoperative'?'':'<button data-action="cancelMode">Cancel</button>'}</div>`
    :selectedFacility?`<div><strong>Place ${FACILITIES[getFacility(game,selectedFacility).key].name}</strong><span>Choose any highlighted plot. Its grid position will support future adjacency effects.</span><button data-action="cancelFacility">Cancel purchase</button></div>`
    :selectedAbility?`<div><strong>Use ${STAFF[game.staff.find(s=>s.id===selectedAbility).key].name}</strong><span>Choose one of the highlighted patients in this staff member’s assigned facility.</span><button data-action="cancelAbility">Cancel</button></div>`
    :selectedSurgery?`<div><strong>Choose an Operating Theatre</strong><span>Vacant spaces in staffed Theatres are highlighted for Patient ${patientPortrait(selectedSurgery)}. Their previous space will become vacant.</span><button data-action="cancelSurgerySelection">Cancel</button></div>`
    :selectedStaff?staffInspector(selectedStaff)
    :`<div><strong>${phase.name}</strong><span>${phase.help}</span></div>${game.phase==='operations'?`<div class="activation-sidebar"><div class="resource-bank"><b>Shared resource</b>${resourceBadge('medication',game.resources.medication)}</div>${resolutionPreview(preview)}</div>`:''}`;
  $('hospitalMap').innerHTML=Array.from({length:6},(_,slot)=>{const f=game.facilities.find(x=>x.slotIndex===slot);return f?facilityTile(f):buildPlot(slot)}).join('');
  $('arrivalQueue').innerHTML=game.queue.length?game.queue.map(queueCard).join(''):'<div class="queue-empty">No patients waiting</div>';
  $('staff').innerHTML=game.staff.map(staffCard).join('');
  $('market').innerHTML=game.market.length?game.market.map(marketCard).join(''):'<div class="market-empty">All of this round’s offers have been purchased.</div>';
  $('log').innerHTML=game.log.slice(0,9).map(x=>`<li>${x}</li>`).join('');
  $('endTurn').textContent=phase.button;
  $('endTurn').disabled=resolutionAnimating||game.gameOver||game.gameWon||Boolean(mode)||game.phase==='postoperative'||(game.phase==='purchasing'&&game.facilities.some(f=>f.slotIndex===null));
  $('victoryScreen').hidden=!game.gameWon;
  $('victoryScreen').innerHTML=game.gameWon?victoryScreen():'';
  $('rulesPanel').hidden=!rulesOpen;
  $('rulesPanel').innerHTML=rulesOpen?rulesGuide():'';
  bind();
}

function rulesGuide(){
  return `<section class="rules-sheet"><header><div><span class="eyebrow">HOW TO PLAY</span><h2>Hospital Rules</h2></div><button data-action="closeRules">Close</button></header>
  <div class="rules-grid">
    <article><h3>Goal</h3><p>Keep the hospital operating for <b>${game.roundLimit} rounds</b> and finish with as much Reputation as possible. The hospital closes if Reputation reaches 0.</p></article>
    <article><h3>How to score Reputation</h3><p>Addressing all of a patient's needs will reward you with Money and Reputation. Patients must be investigated with a Doctor card to reveal their needs, which need to be addressed for the patient to be discharged.</p></article>
    <article><h3>Treatment</h3><ul><li><b>Nursing</b> comes from nurses in the patient’s facility. Normally, a patient receives at most 1 each round.</li><li><b>Medication</b> is generated automatically by assigned Pharmacists at round start and can be used anywhere.</li><li><b>Surgery</b> requires scheduling into a staffed Operating Theatre and completes next round.</li></ul></article>
    <article><h3>Patient risk</h3><ul><li><b>0–3 unmet needs:</b> stable.</li><li><b>4–6 unmet needs:</b> gains one random need at resolution.</li><li><b>7+ unmet needs:</b> dies and costs 2 Reputation.</li></ul><p>Uninvestigated patients still deteriorate, but their risk remains hidden.</p></article>
    <article><h3>Upkeep</h3><p>The starting hospital is funded. Purchased staff and facilities add Upkeep, paid before Purchasing each round. If Money cannot cover the full cost, every $2 unpaid costs 1 Reputation, rounded up.</p></article>
  </div>
  <h3 class="rules-stage-title">Round sequence</h3>
  <ol class="rules-stages">
    <li><b>Round start</b><span>Scheduled Surgery resolves. Postoperative patients must receive ward beds. Pharmacists generate Medication. Patient arrivals increase every four rounds: 2 in rounds 1–4, 3 in rounds 5–8, and 4 in rounds 9–12.</span></li>
    <li><b>Hospital Operations</b><span>Move unused staff, investigate patients, provide Nursing and Medication, and admit ED patients into vacant ward beds. Active staff become committed after their first use.</span></li>
    <li><b>Patient Resolution</b><span>Fully treated patients discharge first. Rewards are collected, then untreated patients deteriorate or die according to their unmet needs.</span></li>
    <li><b>Surgery Scheduling</b><span>Move eligible patients into staffed Theatre spaces. One Surgery need resolves at the start of the next round.</span></li>
    <li><b>Arrival queue</b><span>Waiting patients fill vacant ED spaces. Lose 1 Reputation for every 2 patients still waiting, rounded up.</span></li>
    <li><b>Purchasing</b><span>Pay upkeep, then spend the remaining Money on available staff and facilities. Place new facilities on empty map plots and purchased staff into compatible vacant slots.</span></li>
  </ol>
  <footer><b>Capacity matters:</b> ED spaces, ward beds, Theatre spaces, staff slots, and the arrival queue are separate constraints.</footer></section>`
}

function victoryScreen(){
  const rating=game.reputation>=40?'Centre of Excellence':game.reputation>=25?'Highly Regarded Hospital':game.reputation>=12?'Trusted Hospital':'Hospital Sustained';
  const a=game.analytics,averageUnmet=a.resolutionSamples?(a.totalUnmetAtResolution/a.resolutionSamples).toFixed(1):'0.0',purchases=a.purchases.staff+a.purchases.facilities;
  return `<section class="victory-card"><span class="victory-mark">★</span><span class="eyebrow">CAMPAIGN COMPLETE</span><h2>${rating}</h2><p>Your hospital remained operational for all ${game.roundLimit} rounds.</p><div class="victory-results"><div><strong>${game.reputation}</strong><span>Final Reputation</span></div><div><strong>${game.outcomes.discharged}</strong><span>Discharged</span></div><div><strong>${game.outcomes.deaths}</strong><span>Deaths</span></div><div><strong>${a.reputationLost.queue}</strong><span>Queue Reputation Lost</span></div><div><strong>$${a.moneyEarned}</strong><span>Money Earned</span></div><div><strong>$${a.moneySpent}</strong><span>Purchase Spending</span></div><div><strong>${purchases}</strong><span>Cards Purchased</span></div><div><strong>${a.peakQueue}</strong><span>Highest Queue</span></div></div><div class="victory-analysis"><div><b>Treatment delivered</b><span>${a.treatments.nursing} Nursing · ${a.treatments.medication} Medication · ${a.treatments.surgery} Surgery</span></div><div><b>Hospital activity</b><span>${a.investigations} investigations · ${averageUnmet} average unmet needs at resolution</span></div><div><b>Upkeep</b><span>$${a.upkeepPaid} paid · $${a.upkeepUnpaid} unpaid · ${a.reputationLost.upkeep} Reputation lost</span></div><div><b>Peak occupancy</b><span>ED ${a.peakOccupancy.ed} · Wards ${a.peakOccupancy.ward} · Theatre ${a.peakOccupancy.theatre}</span></div><div><b>Expansion</b><span>${a.purchases.staff} staff · ${a.purchases.facilities} facilities</span></div></div><button class="primary" data-action="restartGame">Play another campaign</button></section>`
}

function buildPlot(slot){return selectedFacility?`<button class="build-plot placement-target" data-action="placeFacility" data-facility="${selectedFacility}" data-slot="${slot}"><span>+</span><small>Build here</small></button>`:'<div class="build-plot"><span>+</span><small>Future facility</small></div>'}
function patientVisual(p,className='patient-art'){return p.art?`<img class="${className}" src="assets/patients/${p.art}" alt="" loading="lazy" decoding="async">`:`<div class="patient-token">${p.portrait}</div>`}
function queueCard(p){return `<div class="queue-patient">${patientVisual(p,'queue-patient-art')}<div><strong>Waiting</strong><small>Needs hidden</small></div></div>`}

function facilityTile(f){
  const d=FACILITIES[f.key],assigned=game.staff.filter(s=>s.facilityId===f.id);
  const illustrated=['ed','ward','theatre'].includes(f.key);
  const capacity=d.kind==='theatre'?theatreCapacity(game,f):0;
  const beds=d.beds?Array.from({length:d.beds},(_,i)=>bed(f,f.patients[i],i)).join(''):d.kind==='theatre'?theatreSpaces(f,capacity):`<div class="equipment ${f.key}"><div class="equipment-core">${d.short}</div><span>Medication store</span></div>`;
  const selectedMember=game.staff.find(s=>s.id===selectedStaff&&!s.used&&(game.phase==='operations'||(game.phase==='purchasing'&&s.purchasedRound===game.round))),selectedRole=selectedMember&&STAFF[selectedMember.key].role;
  const slots=d.slots.map(role=>{
    const s=assigned.find(x=>STAFF[x.key].role===role);
    if(s)return game.phase==='operations'||(game.phase==='purchasing'&&s.purchasedRound===game.round)?`<button class="staff-slot filled selectable-staff ${s.used?'committed':''} ${selectedStaff&&selectedRole===role?'occupied-target':''}" data-action="selectStaff" data-staff="${s.id}" title="View ${STAFF[s.key].name} card and abilities"><span>${STAFF[s.key].monogram}</span><small>${STAFF[s.key].name}${s.used?' · committed':''}</small></button>`:`<div class="staff-slot filled ${s.used?'committed':''}" title="${s.used?'Committed for this round':`${roleNames[role]} slot occupied`}"><span>${STAFF[s.key].monogram}</span><small>${STAFF[s.key].name}${s.used?' · committed':''}</small></div>`;
    if(selectedStaff&&role===selectedRole&&compatible(game,selectedStaff,f.id))return `<button class="staff-slot assignment-target" data-action="assign" data-staff="${selectedStaff}" data-facility="${f.id}" title="Move ${STAFF[selectedMember.key].name} here"><span>+</span><small>Move here</small></button>`;
    if(selectedStaff)return `<div class="staff-slot unavailable-target" title="${role===selectedRole?`${roleNames[role]} slot unavailable`:`${STAFF[selectedMember.key].name} requires a ${roleNames[selectedRole]} slot`}"><span>×</span><small>${role===selectedRole?'Unavailable':`${roleNames[role]} only`}</small></div>`;
    return `<div class="staff-slot"><span>${(roleNames[role]||role).split(' ').map(x=>x[0]).join('')}</span><small>${roleNames[role]||role} slot</small></div>`;
  }).join('');
  return `<article class="facility facility-${f.key} ${d.colour} ${illustrated?'illustrated-facility':''}" data-facility="${f.id}" data-map-slot="${f.slotIndex}"><header><div><span class="room-code">${d.short}</span><h3>${d.name}</h3></div><span class="occupancy">${d.beds?`${f.patients.length}/${d.beds} beds`:d.kind==='theatre'?`${f.patients.length}/${capacity} occupied`:`plot ${f.slotIndex+1}`}</span></header><div class="room-art"><div class="floor-lines"></div><div class="beds">${beds}</div>${illustrated?`<div class="art-staff-slots" aria-label="Ward staff">${slots}</div>`:`<div class="station"><div class="desk"></div><small>${d.kind==='ward'?'Nurse station':d.kind==='clinical'?'Assessment desk':d.kind==='theatre'?'Theatre team':'Work area'}</small></div>`}</div><div class="room-footer">${illustrated?'':`<div class="slots">${slots}</div>`}<div class="facility-status">${facilityStatus(f,assigned,capacity)}</div><div class="room-actions"><small>${d.effect}</small><span class="upkeep-label">${f.funded?'Funded':`$${d.upkeep} upkeep`}</span></div></div></article>`;
}

function facilityStatus(f,assigned,capacity){
  const d=FACILITIES[f.key],chips=[];
  if(d.beds)chips.push(`<span><b>${d.beds-f.patients.length}</b> beds free</span>`);
  if(d.kind==='theatre')chips.push(`<span><b>${capacity-f.patients.length}</b> Theatre spaces free</span>`);
  if(f.nursing)chips.push(`<span class="nursing"><b>${f.nursing}</b> Nursing available</span>`);
  for(const s of assigned){
    const role=STAFF[s.key].role;
    if(role==='pharmacist')chips.push(`<span class="medication"><b>${s.generatedAmount||0}</b> generated this round</span>`);
    if(role==='surgeon')chips.push(`<span class="surgery"><b>✓</b> Surgery enabled</span>`);
    if(role==='theatreNurse')chips.push('<span class="surgery"><b>+1</b> Theatre space</span>');
    if(role==='administrator')chips.push(`<span><b>${game.facilityDiscountUsed?'✓':'−$2'}</b> ${game.facilityDiscountUsed?'discount used':'facility discount'}</span>`);
  }
  if(f.key==='shortStay')chips.push('<span class="ability"><b>↯</b> ≤3 needs: +1 Nursing</span>');
  if(f.key==='icu')chips.push('<span class="ability"><b>◆</b> prevents deterioration</span>');
  if(f.key==='ward')chips.push('<span class="neutral"><b>—</b> no special ability</span>');
  return chips.join('')
}

function theatreSpaces(f,capacity){return Array.from({length:capacity},(_,i)=>{const patient=f.patients[i];if(patient)return `<div class="theatre-space occupied">${patientVisual(patient,'theatre-patient-art')}<span>${patient.postoperative?'Needs ward bed':'Scheduled'}</span>${game.phase==='scheduling'?`<button data-action="cancelScheduledSurgery" data-id="${patient.id}">Remove</button>`:game.phase==='postoperative'?`<button data-action="startPostoperative" data-id="${patient.id}">Place in ward</button>`:''}</div>`;const staffed=game.staff.some(s=>s.facilityId===f.id&&STAFF[s.key].role==='surgeon');return selectedSurgery&&staffed?`<button class="theatre-space surgery-target" data-action="scheduleSurgery" data-id="${selectedSurgery}" data-target="${f.id}"><span>+</span><small>Schedule here</small></button>`:`<div class="theatre-space empty"><div class="equipment-core">OT</div><span>${staffed?'Available':'Needs Surgeon'}</span></div>`}).join('')}

function bed(f,p,i){
  if(!p){const target=selectedAdmission&&FACILITIES[f.key].kind==='ward',action=game.phase==='postoperative'?'placePostoperative':'admit';return target?`<button class="bed empty admission-target" data-action="${action}" data-id="${selectedAdmission}" data-target="${f.id}"><div class="pillow"></div><span>Place in bed ${i+1}</span></button>`:`<div class="bed empty"><div class="pillow"></div><span>Bed ${i+1}</span></div>`}
  const needs=p.revealed?Object.entries(p.needs).filter(([,n])=>n).flatMap(([k,n])=>Array.from({length:n},(_,x)=>`<span class="need ${k} ${x<(p.completed[k]||0)?'done':''}" title="${names[k]}${x<(p.completed[k]||0)?' completed':''}">${treatmentIcons[k]}</span>`)).join(''):'<span class="need unknown" title="Needs hidden">?</span>';
  const risk=patientRisk(p),riskBadge=p.revealed?`<span class="patient-risk ${risk.key}" title="${risk.unmet} unmet needs">${risk.unmet} unmet · ${risk.label}</span>`:'';
  if(selectedAbility&&canTargetPatient(selectedAbility,p,f)){
    const member=game.staff.find(s=>s.id===selectedAbility),role=STAFF[member.key].role;
    return `<button class="bed occupied ability-target" data-action="useStaffAbility" data-staff="${member.id}" data-id="${p.id}"><div class="pillow"></div>${patientVisual(p,'patient-bed-art')}<div class="bed-needs">${needs}</div><span class="target-label">${role==='doctor'?'Investigate':'Give care'}</span></button>`;
  }
  let actions=game.phase==='scheduling'?(p.revealed&&(p.completed.surgery||0)<p.needs.surgery?`<button data-action="startSurgery" data-id="${p.id}">Schedule surgery</button><small>${surgeryEligibility(game,p.id).reason}</small>`:'<small>No revealed unmet Surgery need</small>'):game.phase!=='operations'?'<small>Available during Hospital Operations</small>':!p.revealed?'<small class="map-action-hint">Select a Doctor card to investigate</small>':`${(p.completed.medication||0)<p.needs.medication?`<button class="treatment-button medication" data-action="treat" data-type="medication" data-id="${p.id}">${treatmentIcons.medication}<span>Medication</span></button>`:''}${(p.completed.nursing||0)<p.needs.nursing?'<small class="map-action-hint">Select a Nurse card to provide care</small>':''}`;
  if(game.phase==='operations'&&f.key==='ed')actions+=`<button data-action="startAdmission" data-id="${p.id}" ${hasVacantWard()?'':'disabled'}>Admit to ward</button>`;
  return `<div class="bed occupied ${p.revealed?'revealed':''}" data-patient-id="${p.id}"><div class="pillow"></div>${patientVisual(p,'patient-bed-art')}${riskBadge}${p.revealed?`<div class="bed-needs">${needs}</div>`:''}<div class="patient-popover">${p.art?patientVisual(p,'patient-popover-art'):''}<strong>Patient ${p.portrait}</strong><small>${p.revealed?`$${p.reward} &middot; +${p.reputation} rep`:'Needs and reward hidden'}</small>${riskBadge}<div class="risk-rules">0–3 stable · 4–6 deteriorates · 7+ dies</div><div class="needs">${needs}</div><div class="patient-actions">${actions}</div></div></div>`;
}

function staffCard(s){
  const d=STAFF[s.key],f=getFacility(game,s.facilityId),operations=game.phase==='operations',placing=game.phase==='purchasing'&&s.purchasedRound===game.round;
  const movement=(operations||placing)&&!s.used?`<button data-action="selectStaff" data-staff="${s.id}">${selectedStaff===s.id?'Selected':placing?'Place on map':'Move / assign'}</button>${f?`<button class="secondary" data-action="returnStaff" data-staff="${s.id}">Return to available</button>`:''}`:s.used?'<small class="committed-label">Committed here this round</small>':'';
  let controls=operations?`${movement}${staffAbilityControl(s,f)}`:placing?`${movement}<button disabled>Becomes active next round</button>`:staffAbilityControl(s,f);
  return `<article class="staff-card ${selectedStaff===s.id||selectedAbility===s.id?'selected':''} ${s.used?'used':''}"><div class="staff-card-heading"><div class="staff-portrait">${d.monogram}</div><span class="staff-state ${s.used?'committed':f?'ready':'available'}">${s.used?'Committed':f?'Ready':'Available'}</span></div><strong>${d.name}</strong><small>${f?FACILITIES[f.key].name:'Available staff'}</small><span class="upkeep-label">${s.funded?'Funded':`$${d.upkeep} upkeep`}</span>${staffRemaining(s)}<p>${d.effect}</p><div class="staff-controls">${controls}</div></article>`
}
function staffRemaining(s){
  const role=STAFF[s.key].role;
  if(role==='doctor')return `<div class="staff-remaining"><b>${s.actionsRemaining||0}</b><span>investigation${(s.actionsRemaining||0)===1?'':'s'} left</span></div>`;
  if(role==='nurse')return `<div class="staff-remaining"><b>${s.resourceRemaining||0}</b><span>Nursing Care left</span></div>`;
  if(role==='pharmacist')return `<div class="staff-remaining"><b>${s.generatedAmount||0}</b><span>generated at round start</span></div>`;
  return `<div class="staff-remaining passive"><span>Placement ability</span></div>`
}
function staffInspector(staffId){
  const s=game.staff.find(x=>x.id===staffId),d=STAFF[s.key],f=getFacility(game,s.facilityId);
  const movement=s.used?'This staff member is committed here for the rest of the round.':f?'Select a highlighted compatible slot to move them, or use their ability below.':'Select a highlighted compatible facility slot.';
  return `<div class="staff-inspector"><div class="staff-inspector-identity"><span class="staff-inspector-monogram">${d.monogram}</span><div><span class="eyebrow">${s.used?'COMMITTED':'SELECTED STAFF'}</span><strong>${d.name}</strong><small>${f?FACILITIES[f.key].name:'Available staff'}</small></div></div><div class="staff-inspector-copy"><span>${movement}</span><small>${d.effect}</small></div><div class="staff-inspector-actions">${staffRemaining(s)}${staffAbilityControl(s,f)}${f&&!s.used?`<button class="secondary" data-action="returnStaff" data-staff="${s.id}">Return to available</button>`:''}<button class="secondary" data-action="clearStaffInspector">Close</button></div></div>`
}
function marketCard(m){const d=m.kind==='staff'?STAFF[m.key]:FACILITIES[m.key],cost=purchaseCost(game,m.kind,m.key),noPlot=m.kind==='facility'&&!hasFreePlot(),open=game.phase==='purchasing';return `<article class="market-card"><span class="market-icon">${d.monogram||d.short}</span><strong>${d.name}</strong><span class="upkeep-label">$${d.upkeep} upkeep each round</span><small>${d.effect}</small><button data-action="buy" data-kind="${m.kind}" data-key="${m.key}" ${!open||game.money<cost||noPlot||selectedFacility?'disabled':''}>${open?'Buy':'Purchasing closed'} &middot; $${cost}</button></article>`}

function bind(){document.querySelectorAll('[data-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();const x=b.dataset,a=x.action;let ok=true;
  if(a==='openRules'){rulesOpen=true;render();return}
  if(a==='closeRules'){rulesOpen=false;render();return}
  if(a==='restartGame'){game=createGame();selectedStaff=selectedAdmission=selectedFacility=selectedAbility=selectedSurgery=null;render();return}
  if(a==='selectStaff'){selectedStaff=x.staff;selectedAdmission=null;render();return}
  if(a==='clearStaffInspector'){selectedStaff=null;render();return}
  if(a==='startAdmission'){selectedAdmission=x.id;selectedStaff=null;render();return}
  if(a==='startPostoperative'){selectedAdmission=x.id;selectedStaff=null;render();return}
  if(a==='startSurgery'){const eligibility=surgeryEligibility(game,x.id);if(!eligibility.ok){toast(eligibility.reason);return}selectedSurgery=x.id;selectedStaff=selectedAdmission=null;render();return}
  if(a==='cancelSurgerySelection'){selectedSurgery=null;render();return}
  if(a==='cancelMode'){selectedAdmission=null;render();return}
  if(a==='startStaffAbility'){selectedAbility=x.staff;selectedStaff=selectedAdmission=null;render();return}
  if(a==='cancelAbility'){selectedAbility=null;render();return}
  if(a==='cancelFacility'){const f=getFacility(game,selectedFacility);if(f&&f.slotIndex===null){game.money+=f.purchasePrice??FACILITIES[f.key].cost;if(f.usedAdministratorDiscount)game.facilityDiscountUsed=false;game.market.push({kind:'facility',key:f.key});game.facilities.splice(game.facilities.indexOf(f),1)}selectedFacility=null;render();return}
  if(a==='assign'){ok=assignStaff(game,x.staff,x.facility);if(ok)selectedStaff=null}
  else if(a==='returnStaff'){ok=returnStaff(game,x.staff);if(ok&&selectedStaff===x.staff)selectedStaff=null}
  else if(a==='placeFacility'){ok=placeFacility(game,x.facility,x.slot);if(ok)selectedFacility=null}
  else if(a==='investigate')ok=investigate(game,x.id);
  else if(a==='treat')ok=treat(game,x.id,x.type);
  else if(a==='useStaffAbility'){const member=game.staff.find(s=>s.id===x.staff),role=STAFF[member?.key]?.role;ok=role==='doctor'?investigate(game,x.id,x.staff):role==='nurse'?treat(game,x.id,'nursing',x.staff):false;if(ok)selectedAbility=null}
  else if(a==='admit'){ok=admit(game,x.id,x.target);if(ok)selectedAdmission=null}
  else if(a==='placePostoperative'){ok=placePostoperativePatient(game,x.id,x.target);if(ok)selectedAdmission=null}
  else if(a==='scheduleSurgery'){const eligibility=surgeryEligibility(game,x.id,x.target);if(!eligibility.ok){toast(eligibility.reason);render();return}ok=scheduleSurgery(game,x.id,x.target);if(ok)selectedSurgery=null}
  else if(a==='cancelScheduledSurgery')ok=cancelSurgery(game,x.id);
  else if(a==='buy'){ok=buy(game,x.kind,x.key);if(ok&&x.kind==='facility')selectedFacility=game.facilities.find(f=>f.slotIndex===null)?.id||null;if(ok&&x.kind==='staff')selectedStaff=[...game.staff].reverse().find(s=>s.purchasedRound===game.round&&!s.facilityId)?.id||null}
  if(!ok)toast('That action is not available during this stage, or its requirements are not met.');render();})}

function hasVacantWard(){return game.facilities.some(f=>f.slotIndex!==null&&FACILITIES[f.key].kind==='ward'&&f.patients.length<FACILITIES[f.key].beds)}
function postoperativePatients(){return game.facilities.filter(f=>FACILITIES[f.key].kind==='theatre').flatMap(f=>f.patients.filter(p=>p.postoperative))}
function isScheduled(patientId){return game.facilities.some(f=>FACILITIES[f.key].kind==='theatre'&&f.patients.some(x=>x.id===patientId))}
function hasVacantStaffedTheatre(){return game.facilities.some(f=>FACILITIES[f.key].kind==='theatre'&&f.patients.length<theatreCapacity(game,f)&&game.staff.some(s=>s.facilityId===f.id&&STAFF[s.key].role==='surgeon'))}
function hasFreePlot(){return game.facilities.filter(f=>f.slotIndex!==null).length<6}
function patientPortrait(id){for(const f of game.facilities){const p=f.patients.find(x=>x.id===id);if(p)return p.portrait}return game.queue.find(p=>p.id===id)?.portrait||'?'}
function resourceBadge(type,value){return `<span class="resource ${type}">${treatmentIcons[type]}<span>${names[type]} ${value}</span></span>`}
function resolutionPreview(p){return `<div class="resolution-preview"><b>If resolved now</b><span>Discharge <strong>${p.ready}</strong></span><span>+$${p.money}</span><span>+${p.reputation} rep</span><span class="${p.worsening?'risk':''}">Worsen ${p.worsening}</span>${p.protected?`<span class="protected">ICU protects ${p.protected}</span>`:''}<span class="${p.deaths?'danger':''}">Deaths ${p.deaths}</span>${p.hiddenAtRisk?'<span class="unknown-risk">Uninvestigated patients may be at risk</span>':''}</div>`}
function canTargetPatient(staffId,p,f){
  const member=game.staff.find(s=>s.id===staffId);if(game.phase!=='operations'||!member||member.facilityId!==f.id)return false;
  const role=STAFF[member.key].role;
  if(role==='doctor')return (member.actionsRemaining||0)>0&&!p.revealed;
  if(role==='nurse'){const limit=STAFF[member.key].doubleNursing?2:1,received=p.nursingRound===game.round?(p.nursingThisRound||1):0;return p.revealed&&(member.resourceRemaining||0)>0&&(p.completed.nursing||0)<p.needs.nursing&&received<limit}
  return false
}
function staffAbilityControl(s,f){
  if(game.phase!=='operations')return '<button disabled>Available next round</button>';
  const role=STAFF[s.key].role;
  if(!f)return '<button disabled>Move to a compatible facility to use</button>';
  if(role==='doctor'){const available=(s.actionsRemaining||0)>0&&f.patients.some(p=>!p.revealed);return `<button data-action="startStaffAbility" data-staff="${s.id}" ${available?'':'disabled'}>${(s.actionsRemaining||0)===0?'Ability used':available?`Investigate patient (${s.actionsRemaining} left)`:'No hidden patients here'}</button>`}
  if(role==='nurse'){const limit=STAFF[s.key].doubleNursing?2:1,available=(s.resourceRemaining||0)>0&&f.patients.some(p=>{const received=p.nursingRound===game.round?(p.nursingThisRound||1):0;return p.revealed&&(p.completed.nursing||0)<p.needs.nursing&&received<limit});return `<button data-action="startStaffAbility" data-staff="${s.id}" ${available?'':'disabled'}>${available?`Allocate Nursing (${s.resourceRemaining} left)`:'No eligible patients'}</button>`}
  if(role==='pharmacist')return `<button disabled>${s.generated?`${s.generatedAmount} Medication generated this round`:'Assign now to generate next round'}</button>`;
  if(role==='surgeon')return `<button disabled>${f.key==='theatre'?'Ready for surgery scheduling':'Requires Operating Theatre'}</button>`;
  if(role==='theatreNurse')return `<button disabled>${f.key==='theatre'?'+1 Theatre patient space':'Requires Operating Theatre'}</button>`;
  if(role==='administrator')return `<button disabled>${game.facilityDiscountUsed?'Facility discount used':'Next facility costs $2 less'}</button>`;
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
  if(game.phase==='operations'){
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
