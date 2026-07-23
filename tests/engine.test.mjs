import assert from 'node:assert/strict';
import {
  createGame, investigate, treat, admit, buy, assignStaff, returnStaff,
  placeFacility, advancePhase, compatible
} from '../src/engine.js';

const g=createGame(1);
const ed=g.facilities.find(f=>f.key==='ed');
const ward=g.facilities.find(f=>f.key==='ward');
assert.equal(g.phase,'assignment');
assert.equal(ed.patients.length,2);
assert.equal(ward.nursing,0);
assert.equal(g.resources.medication,0);

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
assert.equal(g.phase,'purchasing');

assert.equal(buy(g,'facility','pharmacy'),true);
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
advancePhase(resolutionGame);
assert.equal(resolutionGame.phase,'resolution');
assert.equal(resolutionEd.patients.includes(completedPatient),false);
assert.equal(resolutionGame.money,moneyBefore+completedPatient.reward);
assert.equal(resolutionGame.reputation,reputationBefore+completedPatient.reputation);
console.log('engine tests passed');
