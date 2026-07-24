import assert from 'node:assert/strict';
import {
  createGame, addFacility, addStaff, investigate, treat, admit, buy, assignStaff, returnStaff,
  placeFacility, advancePhase, compatible, calculateRewards, patientCategory, previewResolution,
  unmetNeeds, patientRisk, scheduleSurgery, placePostoperativePatient, surgeryEligibility
} from '../src/engine.js';
import {PATIENTS} from '../src/data.js';

assert.equal(PATIENTS.length,30);
assert.equal(new Set(PATIENTS.map(p=>p.id)).size,PATIENTS.length);
for(const patient of PATIENTS){
  const total=Object.values(patient.needs).reduce((sum,value)=>sum+value,0);
  assert.ok(total>=1&&total<=6,`${patient.id} must begin with 1–6 needs`);
  const expected=total<=2?'quick':total<=4?'standard':'complex';
  assert.equal(patientCategory(patient.needs).key,expected);
}
const seededOrder=seed=>{const game=createGame(seed),ed=game.facilities.find(f=>f.key==='ed');return [...ed.patients,...game.deck].map(p=>p.id)};
assert.deepEqual(seededOrder(42),seededOrder(42));
assert.notDeepEqual(seededOrder(42),seededOrder(43));
const seededMarket=seed=>createGame(seed).market.map(card=>`${card.kind}:${card.key}`);
assert.deepEqual(seededMarket(42),seededMarket(42));
assert.notDeepEqual(seededMarket(42),seededMarket(43));

assert.deepEqual(calculateRewards({nursing:1,medication:1,surgery:0}),{value:1.5,reward:3,reputation:2,category:'quick'});
assert.deepEqual(calculateRewards({nursing:1,medication:2,surgery:1}),{value:3,reward:9,reputation:5,category:'standard'});
assert.deepEqual(calculateRewards({nursing:3,medication:2,surgery:1}),{value:5,reward:20,reputation:10,category:'complex'});
const riskPatient={revealed:true,needs:{nursing:4,medication:2,surgery:1},completed:{nursing:1,medication:1,surgery:0}};
assert.equal(unmetNeeds(riskPatient),5);
assert.deepEqual(patientRisk(riskPatient),{key:'deteriorate',label:'Will deteriorate',unmet:5});
riskPatient.completed.nursing=3;
assert.deepEqual(patientRisk(riskPatient),{key:'stable',label:'Stable',unmet:3});
riskPatient.completed={nursing:0,medication:0,surgery:0};
assert.deepEqual(patientRisk(riskPatient),{key:'death',label:'Will die',unmet:7});

const g=createGame(1);
assert.equal(g.reputation,8);
const ed=g.facilities.find(f=>f.key==='ed');
const ward=g.facilities.find(f=>f.key==='ward');
const startingTheatre=g.facilities.find(f=>f.key==='theatre');
assert.equal(ward.patients.length,0);
assert.equal((await import('../src/data.js')).FACILITIES.ward.beds,4);
assert.equal((await import('../src/data.js')).FACILITIES.theatre.patientSpaces,1);
assert.equal(startingTheatre.slotIndex,2);
assert.equal(g.staff.filter(s=>s.key==='surgeon'&&s.facilityId===startingTheatre.id).length,1);
assert.deepEqual(g.staff.map(s=>s.key),['doctor','nurse','pharmacist','surgeon']);
assert.equal(g.phase,'assignment');
assert.equal(ed.patients.length,2);
assert.equal(ward.nursing,0);
assert.equal(g.resources.medication,0);
assert.equal(g.market.filter(card=>card.kind==='staff').length,3);
assert.equal(g.market.filter(card=>card.kind==='facility').length,3);
assert.equal(new Set(g.market.map(card=>`${card.kind}:${card.key}`)).size,6);

const marketGame=createGame(99);
const firstOffers=marketGame.market.map(card=>`${card.kind}:${card.key}`);
advancePhase(marketGame);
advancePhase(marketGame);
advancePhase(marketGame);
advancePhase(marketGame);
advancePhase(marketGame);
const secondOffers=marketGame.market.map(card=>`${card.kind}:${card.key}`);
assert.equal(secondOffers.length,6);
assert.notDeepEqual(secondOffers,firstOffers);

const nurse=g.staff.find(s=>s.key==='nurse');
assert.equal(compatible(g,nurse.id,ed.id),true);
assert.equal(assignStaff(g,nurse.id,ed.id),true);
assert.equal(nurse.facilityId,ed.id);
assert.equal(returnStaff(g,nurse.id),true);
assert.equal(assignStaff(g,nurse.id,ward.id),true);

assert.equal(advancePhase(g),true);
assert.equal(g.phase,'activation');
assert.equal(ward.nursing,2);
assert.equal(g.resources.medication,1);
assert.equal(assignStaff(g,nurse.id,ed.id),false);

const hiddenPatient=ed.patients[0];
assert.equal(hiddenPatient.revealed,false);
assert.equal(admit(g,hiddenPatient.id,ward.id),true);
assert.equal(ward.patients[0].revealed,false);

const doctor=g.staff.find(s=>s.key==='doctor');
const edPatient=ed.patients[0];
assert.equal(investigate(g,edPatient.id),true);
assert.equal(doctor.used,true);
if(edPatient.needs.medication)assert.equal(treat(g,edPatient.id,'medication'),true);

assert.equal(buy(g,'facility','pharmacy'),false);
assert.equal(advancePhase(g),true);
assert.equal(g.phase,'resolution');
assert.equal(advancePhase(g),true);
assert.equal(g.phase,'scheduling');
assert.equal(advancePhase(g),true);
assert.equal(g.phase,'purchasing');

g.market=[{kind:'facility',key:'pharmacy'}];
assert.equal(buy(g,'facility','pharmacy'),true);
assert.equal(g.market.length,0);
const pharmacy=g.facilities.find(f=>f.key==='pharmacy');
assert.equal(pharmacy.slotIndex,null);
assert.equal(placeFacility(g,pharmacy.id,4),true);
assert.equal(placeFacility(g,pharmacy.id,5),false);

const round=g.round;
assert.equal(advancePhase(g),true);
assert.equal(g.phase,'assignment');
assert.equal(g.round,round+1);
assert.equal(nurse.facilityId,ward.id);
assert.equal(g.resources.medication,0);
assert.equal(assignStaff(g,doctor.id,ward.id),true);

const resolutionGame=createGame(3);
const resolutionEd=resolutionGame.facilities.find(f=>f.key==='ed');
const completedPatient=resolutionEd.patients[0];
completedPatient.revealed=true;
completedPatient.wardRequired=false;
completedPatient.completed={...completedPatient.needs};
const moneyBefore=resolutionGame.money,reputationBefore=resolutionGame.reputation;
advancePhase(resolutionGame);
const resolutionPreview=previewResolution(resolutionGame);
assert.equal(resolutionPreview.ready,1);
assert.equal(resolutionPreview.money,completedPatient.reward);
assert.equal(resolutionPreview.reputation,completedPatient.reputation);
advancePhase(resolutionGame);
assert.equal(resolutionGame.phase,'resolution');
assert.equal(resolutionEd.patients.includes(completedPatient),false);
assert.equal(resolutionGame.money,moneyBefore+completedPatient.reward);
assert.equal(resolutionGame.reputation,reputationBefore+completedPatient.reputation);
assert.deepEqual(completedPatient.baseNeeds,completedPatient.needs);

const surgeryGame=createGame(31);
const surgeryEd=surgeryGame.facilities.find(f=>f.key==='ed');
const theatre=surgeryGame.facilities.find(f=>f.key==='theatre');
const surgeon=surgeryGame.staff.find(s=>s.key==='surgeon');
const surgicalPatient=surgeryEd.patients[0];
surgicalPatient.revealed=true;
surgicalPatient.needs={nursing:0,medication:0,surgery:2};
surgicalPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(surgeryGame);
advancePhase(surgeryGame);
assert.equal(surgeryGame.phase,'resolution');
advancePhase(surgeryGame);
assert.equal(surgeryGame.phase,'scheduling');
assert.equal(scheduleSurgery(surgeryGame,surgicalPatient.id,theatre.id),true);
assert.equal(scheduleSurgery(surgeryGame,surgicalPatient.id,theatre.id),false);
assert.equal(theatre.patients.length,1);
assert.equal(surgeryEd.patients.includes(surgicalPatient),false);
advancePhase(surgeryGame);
advancePhase(surgeryGame);
assert.equal(surgicalPatient.completed.surgery,1);
assert.equal(surgeryGame.phase,'postoperative');
assert.equal(theatre.patients.length,1);
const surgeryWard=surgeryGame.facilities.find(f=>f.key==='ward');
assert.equal(placePostoperativePatient(surgeryGame,surgicalPatient.id,surgeryWard.id),true);
assert.equal(theatre.patients.length,0);
assert.equal(surgeryWard.patients.includes(surgicalPatient),true);
assert.equal(surgeryGame.phase,'assignment');
assert.equal(surgeon.facilityId,theatre.id);

const noRecoveryBedGame=createGame(32);
const noBedEd=noRecoveryBedGame.facilities.find(f=>f.key==='ed');
const noBedWard=noRecoveryBedGame.facilities.find(f=>f.key==='ward');
const noBedTheatre=noRecoveryBedGame.facilities.find(f=>f.key==='theatre');
const noBedPatient=noBedEd.patients[0];
noBedPatient.revealed=true;
noBedPatient.needs={nursing:0,medication:0,surgery:1};
noBedPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(noRecoveryBedGame);
advancePhase(noRecoveryBedGame);
advancePhase(noRecoveryBedGame);
noBedWard.patients=Array.from({length:4},(_,i)=>({id:`full-${i}`}));
assert.equal(scheduleSurgery(noRecoveryBedGame,noBedPatient.id,noBedTheatre.id),false);
assert.equal(surgeryEligibility(noRecoveryBedGame,noBedPatient.id,noBedTheatre.id).reason,'A vacant postoperative ward bed must be guaranteed before this patient can enter Theatre.');
assert.equal(noBedEd.patients.includes(noBedPatient),true);

const queueGame=createGame(33);
advancePhase(queueGame);
advancePhase(queueGame);
advancePhase(queueGame);
assert.equal(queueGame.phase,'scheduling');
const queueEd=queueGame.facilities.find(f=>f.key==='ed');
while(queueEd.patients.length<3)queueEd.patients.push({id:`ed-fill-${queueEd.patients.length}`,portrait:'ED'});
queueGame.queue.push({id:'q1',portrait:'Q1'},{id:'q2',portrait:'Q2'},{id:'q3',portrait:'Q3'});
const queueReputation=queueGame.reputation;
advancePhase(queueGame);
assert.equal(queueGame.phase,'purchasing');
assert.equal(queueEd.patients.some(p=>p.id==='q1'),true);
assert.equal(queueGame.queue.length,2);
assert.equal(queueGame.queue[0].id,'q2');
assert.equal(queueGame.reputation,queueReputation-1);

const deteriorationGame=createGame(5);
const deteriorationPatient=deteriorationGame.facilities.find(f=>f.key==='ed').patients[0];
deteriorationPatient.revealed=true;
deteriorationPatient.needs={nursing:2,medication:1,surgery:1};
deteriorationPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(deteriorationGame);
assert.equal(previewResolution(deteriorationGame).worsening,1);
const needsBefore=unmetNeeds(deteriorationPatient);
advancePhase(deteriorationGame);
assert.equal(unmetNeeds(deteriorationPatient),needsBefore+1);

const deathGame=createGame(6);
const deathEd=deathGame.facilities.find(f=>f.key==='ed');
const deathPatient=deathEd.patients[0];
deathPatient.revealed=true;
deathPatient.needs={nursing:4,medication:2,surgery:1};
deathPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(deathGame);
assert.equal(previewResolution(deathGame).deaths,1);
advancePhase(deathGame);
assert.equal(deathEd.patients.includes(deathPatient),false);

const hiddenGame=createGame(7);
const hiddenEd=hiddenGame.facilities.find(f=>f.key==='ed');
const hiddenRiskPatient=hiddenEd.patients[0];
hiddenRiskPatient.revealed=false;
hiddenRiskPatient.needs={nursing:2,medication:1,surgery:1};
hiddenRiskPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(hiddenGame);
const hiddenPreview=previewResolution(hiddenGame);
assert.equal(hiddenPreview.worsening,0);
assert.equal(hiddenPreview.hiddenAtRisk,1);
const hiddenNeedsBefore=unmetNeeds(hiddenRiskPatient);
advancePhase(hiddenGame);
assert.equal(unmetNeeds(hiddenRiskPatient),hiddenNeedsBefore+1);
assert.equal(hiddenRiskPatient.revealed,false);
assert.equal(hiddenGame.resolutionEvents.length,1);
assert.equal(hiddenGame.resolutionEvents[0].type,'deteriorate');
assert.equal(hiddenGame.resolutionEvents[0].hidden,true);

const shortStayGame=createGame(20);
const shortStayEd=shortStayGame.facilities.find(f=>f.key==='ed');
const shortStay=addFacility(shortStayGame,'shortStay',2);
const shortStayPatient=shortStayEd.patients[0];
shortStayPatient.needs={nursing:1,medication:2,surgery:0};
shortStayPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(shortStayGame);
assert.equal(admit(shortStayGame,shortStayPatient.id,shortStay.id),true);
assert.equal(shortStayPatient.completed.nursing,1);

const complexShortStayGame=createGame(21);
const complexEd=complexShortStayGame.facilities.find(f=>f.key==='ed');
const complexShortStay=addFacility(complexShortStayGame,'shortStay',2);
const complexPatient=complexEd.patients[0];
complexPatient.needs={nursing:1,medication:3,surgery:0};
complexPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(complexShortStayGame);
assert.equal(admit(complexShortStayGame,complexPatient.id,complexShortStay.id),true);
assert.equal(complexPatient.completed.nursing,0);

const icuGame=createGame(22);
const icuEd=icuGame.facilities.find(f=>f.key==='ed');
const icu=addFacility(icuGame,'icu',2);
const icuPatient=icuEd.patients[0];
icuPatient.revealed=true;
icuPatient.needs={nursing:2,medication:1,surgery:1};
icuPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(icuGame);
assert.equal(admit(icuGame,icuPatient.id,icu.id),true);
const icuNeedsBefore=unmetNeeds(icuPatient);
assert.equal(previewResolution(icuGame).protected,1);
advancePhase(icuGame);
assert.equal(unmetNeeds(icuPatient),icuNeedsBefore);
assert.equal(icuGame.resolutionEvents.some(event=>event.type==='protected'),true);

const icuDeathGame=createGame(23);
const icuDeathEd=icuDeathGame.facilities.find(f=>f.key==='ed');
const deathIcu=addFacility(icuDeathGame,'icu',2);
const icuDeathPatient=icuDeathEd.patients[0];
icuDeathPatient.revealed=true;
icuDeathPatient.needs={nursing:4,medication:2,surgery:1};
icuDeathPatient.completed={nursing:0,medication:0,surgery:0};
advancePhase(icuDeathGame);
assert.equal(admit(icuDeathGame,icuDeathPatient.id,deathIcu.id),true);
advancePhase(icuDeathGame);
assert.equal(deathIcu.patients.includes(icuDeathPatient),false);
assert.equal(icuDeathGame.resolutionEvents.some(event=>event.type==='death'),true);
console.log('engine tests passed');
