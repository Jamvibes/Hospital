import {PATIENTS, STAFF, FACILITIES} from './data.js?v=3';
const clone=value=>JSON.parse(JSON.stringify(value));

export function createGame(seed=1){
  const state={round:1,phase:'assignment',money:10,reputation:5,deck:shuffle(clone(PATIENTS),seed),discard:[],facilities:[],staff:[],resources:{medication:0,surgery:0},log:[],resolutionEvents:[],gameOver:false,nextId:1};
  const ed=addFacility(state,'ed',0); const ward=addFacility(state,'ward',1);
  addStaff(state,'doctor',ed.id); addStaff(state,'nurse',ward.id); addStaff(state,'pharmacist',ed.id);
  drawPatients(state,2); state.log.unshift('Round 1: two new patient cards entered Emergency. Assign staff, then activate them.'); return state;
}

export function addFacility(state,key,slotIndex=null){const facility={id:`f${state.nextId++}`,key,patients:[],nursing:0,slotIndex};state.facilities.push(facility);return facility}
export function addStaff(state,key,facilityId=null){const member={id:`s${state.nextId++}`,key,facilityId,used:false};state.staff.push(member);return member}
export function getFacility(state,id){return state.facilities.find(f=>f.id===id)}
export function facilityDefinition(f){return FACILITIES[f.key]}
export function patientFacility(state,patientId){return state.facilities.find(f=>f.patients.some(p=>p.id===patientId))}
export function calculateRewards(needs){const value=(needs.nursing||0)+(needs.medication||0)/2+(needs.surgery||0);return {value,reward:value*2,reputation:Math.ceil(value)}}
export function unmetNeeds(patient){return Object.keys(patient.needs).reduce((total,key)=>total+Math.max(0,(patient.needs[key]||0)-(patient.completed[key]||0)),0)}
export function patientRisk(patient){
  if(!patient.revealed)return {key:'unknown',label:'Risk hidden',unmet:null};
  return resolutionRisk(patient);
}
function resolutionRisk(patient){
  const unmet=unmetNeeds(patient);
  if(unmet>=7)return {key:'death',label:'Will die',unmet};
  if(unmet>=4)return {key:'deteriorate',label:'Will deteriorate',unmet};
  return {key:'stable',label:'Stable',unmet};
}
export function previewResolution(state){const result={ready:0,money:0,reputation:0,worsening:0,deaths:0,reputationLoss:0,hiddenAtRisk:0};for(const f of state.facilities)for(const p of f.patients){if(canDischarge(f,p)){result.ready++;result.money+=p.reward;result.reputation+=p.reputation;continue}const risk=resolutionRisk(p);if(!p.revealed){if(risk.key==='death'||risk.key==='deteriorate')result.hiddenAtRisk++;continue}if(risk.key==='death'){result.deaths++;result.reputationLoss+=2}else if(risk.key==='deteriorate')result.worsening++}return result}

export function activateStaff(state){state.resources={medication:0,surgery:0};for(const f of state.facilities)f.nursing=0;for(const member of state.staff){member.used=false;const facility=getFacility(state,member.facilityId);if(!facility)continue;const def=FACILITIES[facility.key];const role=STAFF[member.key].role;if(role==='nurse'&&def.kind!=='support')facility.nursing+=2;if(role==='pharmacist')state.resources.medication+=facility.key==='pharmacy'?2:1;if(role==='surgeon'&&facility.key==='theatre')state.resources.surgery+=1}}

export function compatible(state,staffId,facilityId){const member=state.staff.find(s=>s.id===staffId);const facility=getFacility(state,facilityId);if(!member||!facility)return false;const role=STAFF[member.key].role;const def=FACILITIES[facility.key];if(!def.slots.includes(role))return false;return !state.staff.some(s=>s.id!==staffId&&s.facilityId===facilityId&&STAFF[s.key].role===role)}
export function assignStaff(state,staffId,facilityId){const member=state.staff.find(s=>s.id===staffId);if(state.phase!=='assignment'||!member||!compatible(state,staffId,facilityId))return false;const old=getFacility(state,member.facilityId);member.facilityId=facilityId;state.log.unshift(`${STAFF[member.key].name} moved from ${old?FACILITIES[old.key].name:'available staff'} to ${FACILITIES[getFacility(state,facilityId).key].name}.`);return true}
export function returnStaff(state,staffId){const member=state.staff.find(s=>s.id===staffId),old=getFacility(state,member?.facilityId);if(state.phase!=='assignment'||!member||!old)return false;member.facilityId=null;state.log.unshift(`${STAFF[member.key].name} returned from ${FACILITIES[old.key].name} to available staff.`);return true}
export function placeFacility(state,facilityId,slotIndex){const facility=getFacility(state,facilityId),slot=Number(slotIndex);if(state.phase!=='purchasing'||!facility||facility.slotIndex!==null||slot<0||slot>=6||state.facilities.some(f=>f.slotIndex===slot))return false;facility.slotIndex=slot;state.log.unshift(`${FACILITIES[facility.key].name} placed on the hospital map.`);return true}

export function investigate(state,patientId){const facility=patientFacility(state,patientId);const patient=facility?.patients.find(p=>p.id===patientId);if(state.phase!=='activation'||!patient||patient.revealed)return false;const doctor=state.staff.find(s=>s.facilityId===facility.id&&STAFF[s.key].role==='doctor'&&!s.used);if(!doctor)return false;patient.revealed=true;doctor.used=true;state.log.unshift(`Patient ${patient.portrait} investigated in ${FACILITIES[facility.key].name}.`);return true}
export function treat(state,patientId,type){const facility=patientFacility(state,patientId);const patient=facility?.patients.find(p=>p.id===patientId);if(state.phase!=='activation'||!patient?.revealed||!['nursing','medication','surgery'].includes(type))return false;const done=patient.completed[type]||0;if(done>=patient.needs[type])return false;if(type==='nursing'){if(facility.nursing<1||patient.nursingRound===state.round)return false;facility.nursing--;patient.nursingRound=state.round}else{if(state.resources[type]<1)return false;state.resources[type]--}patient.completed[type]=done+1;state.log.unshift(`${label(type)} provided to patient ${patient.portrait}.`);return true}
export function admit(state,patientId,targetId){const from=patientFacility(state,patientId);const target=getFacility(state,targetId);if(state.phase!=='activation'||!from||from.key!=='ed'||!target||FACILITIES[target.key].kind!=='ward')return false;const patient=from.patients.find(p=>p.id===patientId);if(!patient||target.patients.length>=FACILITIES[target.key].beds)return false;from.patients.splice(from.patients.indexOf(patient),1);target.patients.push(patient);if(target.key==='shortStay'&&patient.needs.nursing===1&&patient.completed.nursing===0)patient.completed.nursing=1;state.log.unshift(`Patient ${patient.portrait} admitted to ${FACILITIES[target.key].name}.`);return true}
export function discharge(state,patientId){const facility=patientFacility(state,patientId);const i=facility?.patients.findIndex(p=>p.id===patientId)??-1;if(i<0)return false;const p=facility.patients[i];if(!canDischarge(facility,p))return false;facility.patients.splice(i,1);state.money+=p.reward;state.reputation+=p.reputation;state.discard.push(p);state.resolutionEvents.push({type:'discharge',patientId:p.id,portrait:p.portrait,facilityId:facility.id,reward:p.reward,reputation:p.reputation});state.log.unshift(`Patient ${p.portrait} discharged from ${FACILITIES[facility.key].name}: +$${p.reward}, +${p.reputation} reputation.`);return true}
export function buy(state,kind,key){const def=kind==='staff'?STAFF[key]:FACILITIES[key];if(state.phase!=='purchasing'||!def||state.money<def.cost)return false;state.money-=def.cost;if(kind==='staff')addStaff(state,key);else addFacility(state,key);state.log.unshift(`${def.name} purchased for $${def.cost}.`);return true}
export function advancePhase(state){
  if(state.gameOver)return false;
  if(state.phase==='assignment'){activateStaff(state);state.phase='activation';state.log.unshift('Staff activated. Use their abilities and allocate treatment.');return true}
  if(state.phase==='activation'){resolvePatients(state);state.phase='resolution';if(state.reputation<=0){state.gameOver=true;state.log.unshift('The hospital has lost public confidence.')}else state.log.unshift('Patient resolution complete. Review the outcomes.');return true}
  if(state.phase==='resolution'){state.phase='purchasing';state.log.unshift('Purchasing stage opened. Spend this round’s rewards.');return true}
  if(state.phase==='purchasing'){
    if(state.facilities.some(f=>f.slotIndex===null))return false;
    state.round++;state.resources={medication:0,surgery:0};for(const f of state.facilities)f.nursing=0;
    drawPatients(state,Math.min(2+Math.floor((state.round-1)/4),3));state.phase='assignment';
    state.log.unshift(`Round ${state.round}: new patient cards entered Emergency. Assign or move staff.`);return true
  }
  return false
}

function drawPatients(state,count){const ed=state.facilities.find(f=>f.key==='ed');for(let i=0;i<count;i++){if(!state.deck.length)break;if(ed.patients.length>=FACILITIES.ed.beds){state.reputation=Math.max(0,state.reputation-1);state.log.unshift('Emergency is full: an arriving patient was turned away. -1 reputation.');continue}const p=state.deck.shift(),baseNeeds=clone(p.needs),rewards=calculateRewards(baseNeeds);Object.assign(p,{baseNeeds,...rewards,revealed:false,completed:{nursing:0,medication:0,surgery:0}});ed.patients.push(p)}}
function resolvePatients(state){state.resolutionEvents=[];for(const f of state.facilities)for(const p of [...f.patients])discharge(state,p.id);deteriorate(state)}
function canDischarge(f,p){const complete=Object.keys(p.needs).every(k=>(p.completed[k]||0)>=p.needs[k]);return p.revealed&&complete&&(!p.wardRequired||f.key!=='ed')}
function deteriorate(state){for(const f of state.facilities)for(const p of [...f.patients]){const risk=resolutionRisk(p);if(risk.key==='death'){f.patients.splice(f.patients.indexOf(p),1);state.reputation=Math.max(0,state.reputation-2);state.resolutionEvents.push({type:'death',patientId:p.id,portrait:p.portrait,facilityId:f.id,unmet:risk.unmet,reputationLoss:2,hidden:!p.revealed});state.log.unshift(`Patient ${p.portrait} died with ${risk.unmet} unmet needs. -2 reputation.`)}else if(risk.key==='deteriorate'){const types=['nursing','medication','surgery'],type=types[Math.floor(Math.random()*types.length)];p.needs[type]++;state.resolutionEvents.push({type:'deteriorate',patientId:p.id,portrait:p.portrait,facilityId:f.id,unmet:risk.unmet,need:type,hidden:!p.revealed});state.log.unshift(p.revealed?`Patient ${p.portrait} deteriorated with ${risk.unmet} unmet needs and gained a ${label(type)} need.`:`Uninvestigated patient ${p.portrait} deteriorated and gained a hidden need.`)}}}
function label(x){return x[0].toUpperCase()+x.slice(1)}function shuffle(a,seed){let x=seed;for(let i=a.length-1;i>0;i--){x=(x*9301+49297)%233280;const j=Math.floor(x/233280*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
