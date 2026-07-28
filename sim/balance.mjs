import {
  createGame, advancePhase, assignStaff, returnStaff, investigate, treat, admit,
  scheduleSurgery, surgeryEligibility, placePostoperativePatient, buy, placeFacility,
  unmetNeeds, canEnterWard, radiologyInvestigate, hospitalHomeDischarge, appealLevel
} from '../src/engine.js';
import {STAFF, FACILITIES, MARKET} from '../src/data.js';

const RUNS = Number(process.argv[2] || 1000);
const HORIZON = Number(process.argv[3] || 12);
const MODE = process.argv[4] || 'baseline';
const POLICIES = ['balanced', 'nursing', 'surgery', 'capacity', 'economy', 'appeal', 'random'];
const BASELINE = {key:'baseline',label:'Current rules',startingReputation:8,queueDivisor:2,doctorActions:1};
const ADJUSTMENTS = [
  BASELINE,
  {key:'oldRules',label:'Previous reputation rules',startingReputation:5,queueDivisor:1,doctorActions:1},
  {key:'reputation10',label:'Start with 10 reputation',startingReputation:10,queueDivisor:2,doctorActions:1},
  {key:'fullQueuePenalty',label:'Lose 1 reputation per queued patient',startingReputation:8,queueDivisor:1,doctorActions:1},
  {key:'doctor2',label:'Doctors investigate 2 patients',startingReputation:8,queueDivisor:2,doctorActions:2},
  {key:'rep10Doctor2',label:'10 reputation + Doctor investigates 2',startingReputation:10,queueDivisor:2,doctorActions:2}
];

const totals = needs =>
  (needs.nursing || 0) + (needs.medication || 0) + (needs.surgery || 0);
const remainingValue = patient =>
  Math.max(0, patient.needs.nursing - (patient.completed.nursing || 0)) +
  Math.max(0, patient.needs.medication - (patient.completed.medication || 0)) * .5 +
  Math.max(0, patient.needs.surgery - (patient.completed.surgery || 0));
const allPatients = game => game.facilities.flatMap(f => f.patients);
const wardFacilities = game =>
  game.facilities.filter(f => FACILITIES[f.key].kind === 'ward');
const theatreFacilities = game =>
  game.facilities.filter(f => FACILITIES[f.key].kind === 'theatre');

function seeded(seed) {
  let x = seed || 1;
  return () => ((x = (x * 48271) % 2147483647) / 2147483647);
}

function rankPatients(policy, patients, rng) {
  const copy = [...patients];
  if (policy === 'random') return copy.sort(() => rng() - .5);
  const score = patient => {
    const unmet = unmetNeeds(patient);
    const remain = remainingValue(patient);
    const reward = patient.reputation || 0;
    if (policy === 'nursing') return remain * 12 - (patient.needs.nursing || 0) * 3 - reward;
    if (policy === 'surgery') return remain * 12 - (patient.needs.surgery || 0) * 8 - reward;
    if (policy === 'capacity') return remain * 20 - reward * 2 + unmet;
    if (policy === 'economy') return remain * 30 - reward * 2 + unmet;
    return remain * 12 - unmet * 3 - reward;
  };
  return copy.sort((a, b) => score(a) - score(b));
}

function assignTeam(game, policy, rng) {
  for (const member of game.staff) if (member.facilityId) returnStaff(game, member.id);
  const assigned = new Set();
  const choose = (member, candidates, value) => {
    const available = candidates.filter(f => !assigned.has(`${f.id}:${STAFF[member.key].role}`));
    available.sort((a, b) => value(b) - value(a));
    const target = policy === 'random'
      ? available[Math.floor(rng() * available.length)]
      : available[0];
    if (target && assignStaff(game, member.id, target.id))
      assigned.add(`${target.id}:${STAFF[member.key].role}`);
  };
  for (const member of game.staff) {
    const role = STAFF[member.key].role;
    const candidates = game.facilities.filter(f => FACILITIES[f.key].slots.includes(role));
    if (role === 'doctor')
      choose(member, candidates, f => f.patients.filter(p => !p.revealed).length * 10 + f.patients.length);
    else if (role === 'nurse')
      choose(member, candidates, f => f.patients.reduce((n, p) =>
        n + Math.max(0, (p.needs?.nursing || 0) - (p.completed?.nursing || 0)), 0));
    else if (role === 'pharmacist')
      choose(member, candidates, f => f.key === 'pharmacy' ? 100 : f.patients.length);
    else if (role === 'surgeon')
      choose(member, candidates, f => FACILITIES[f.key].kind === 'theatre' ? 100 : 0);
  }
}

function investigatePatients(game, policy, rng, rules) {
  for (const doctor of game.staff.filter(s => STAFF[s.key].role === 'doctor')) {
    const facility = game.facilities.find(f => f.id === doctor.facilityId);
    if (!facility) continue;
    doctor.actionsRemaining=Math.max(doctor.actionsRemaining||0,rules.doctorActions);
    for(let action=0;action<rules.doctorActions;action++){
      const hidden = facility.patients.filter(p => !p.revealed);
      if(policy==='random')hidden.sort(()=>rng()-.5);
      if (!hidden[0]) break;
      investigate(game, hidden[0].id,doctor.id);
    }
  }
}

function useRadiology(game,policy,rng){
  for(const radiology of game.facilities.filter(f=>f.key==='radiology'&&!f.abilityUsed)){
    const hidden=game.facilities.filter(f=>FACILITIES[f.key].kind!=='theatre').flatMap(f=>f.patients.filter(p=>!p.revealed));
    if(policy==='random')hidden.sort(()=>rng()-.5);
    if(hidden[0])radiologyInvestigate(game,radiology.id,hidden[0].id);
  }
}

function admitPatients(game, policy, rng,metrics) {
  const ed = game.facilities.find(f => f.key === 'ed');
  const beds = wardFacilities(game);
  for (const patient of rankPatients(policy, ed.patients.filter(p => p.revealed), rng)) {
    const target = beds
      .filter(f => canEnterWard(patient,f))
      .sort((a, b) => (b.key==='rehabilitation'?100:0)-(a.key==='rehabilitation'?100:0)||a.patients.length-b.patients.length)[0];
    if (!target) break;
    if (patient.wardRequired || patient.needs.nursing > 0 || patient.needs.surgery > 0){
      const admitted=admit(game, patient.id, target.id);
      if(admitted&&target.key==='rehabilitation')metrics.rehabilitationAdmissions++;
    }
  }
}

function useHospitalHome(game,policy,rng){
  for(const service of game.facilities.filter(f=>f.key==='hospitalHome'&&!f.abilityUsed)){
    const eligible=game.facilities.filter(f=>FACILITIES[f.key].kind!=='theatre').flatMap(f=>f.patients.filter(p=>p.revealed&&unmetNeeds(p)===1));
    if(policy==='random')eligible.sort(()=>rng()-.5);
    else eligible.sort((a,b)=>{
      const surgeryA=(a.completed.surgery||0)<a.needs.surgery?1:0,surgeryB=(b.completed.surgery||0)<b.needs.surgery?1:0;
      const bedA=game.facilities.some(f=>FACILITIES[f.key].kind==='ward'&&f.patients.includes(a))?1:0,bedB=game.facilities.some(f=>FACILITIES[f.key].kind==='ward'&&f.patients.includes(b))?1:0;
      return surgeryB-surgeryA||bedB-bedA||(b.reputation||0)-(a.reputation||0);
    });
    if(eligible[0])hospitalHomeDischarge(game,service.id,eligible[0].id);
  }
}

function allocateTreatment(game, policy, rng) {
  for (const facility of game.facilities) {
    const eligible = () => rankPatients(policy, facility.patients.filter(p =>
      p.revealed && (p.completed.nursing || 0) < p.needs.nursing &&
      p.nursingRound !== game.round), rng);
    while (facility.nursing > 0 && eligible().length)
      if (!treat(game, eligible()[0].id, 'nursing')) break;
  }
  const medication = () => rankPatients(policy, allPatients(game).filter(p =>
    p.revealed && (p.completed.medication || 0) < p.needs.medication), rng);
  while (game.resources.medication > 0 && medication().length)
    if (!treat(game, medication()[0].id, 'medication')) break;
}

function scheduleOperations(game, policy, rng) {
  const candidates = rankPatients(policy, allPatients(game).filter(p =>
    p.revealed && (p.completed.surgery || 0) < p.needs.surgery), rng);
  for (const patient of candidates) {
    for (const theatre of theatreFacilities(game)) {
      if (surgeryEligibility(game, patient.id, theatre.id).ok) {
        scheduleSurgery(game, patient.id, theatre.id);
        break;
      }
    }
  }
}

const purchasePriority = {
  balanced: ['ward','nurse','radiology','nursingAssistant','shortStay','hospitalHome','doctor','pharmacy','pharmacist','staffLounge','volunteer','cafe','rehabilitation','seniorNurse','seniorDoctor','icu','surgeon','theatre','theatreNurse','hospitalLibrary','walkInCentre','administrator','helipad'],
  nursing: ['nurse','nursingAssistant','seniorNurse','rehabilitation','ward','shortStay','hospitalHome','radiology','doctor','seniorDoctor','pharmacy','pharmacist','staffLounge','volunteer','cafe','icu','surgeon','theatre','theatreNurse','hospitalLibrary','walkInCentre','administrator','helipad'],
  surgery: ['surgeon','theatre','theatreNurse','hospitalHome','helipad','ward','radiology','doctor','seniorDoctor','nurse','nursingAssistant','pharmacy','pharmacist','seniorNurse','staffLounge','volunteer','cafe','shortStay','rehabilitation','icu','hospitalLibrary','walkInCentre','administrator'],
  capacity: ['ward','shortStay','rehabilitation','icu','hospitalHome','radiology','theatre','nurse','nursingAssistant','doctor','seniorNurse','seniorDoctor','pharmacy','pharmacist','staffLounge','volunteer','cafe','surgeon','theatreNurse','hospitalLibrary','walkInCentre','administrator','helipad'],
  economy: ['administrator','cafe','volunteer','staffLounge','hospitalLibrary','hospitalHome','radiology','nursingAssistant','nurse','pharmacist','doctor','pharmacy','ward','theatreNurse','shortStay','rehabilitation','seniorNurse','surgeon','seniorDoctor','theatre','icu','walkInCentre','helipad'],
  appeal: ['hospitalLibrary','staffLounge','nursingAssistant','nurse','doctor','volunteer','cafe','seniorNurse','seniorDoctor','radiology','pharmacist','pharmacy','ward','shortStay','rehabilitation','hospitalHome','surgeon','theatreNurse','theatre','icu','walkInCentre','administrator','helipad'],
  random: []
};

function canUseStaff(game, key) {
  if(STAFF[key].hospitalWide)return !STAFF[key].unique||!game.staff.some(s=>s.key===key);
  const role = STAFF[key].role;
  const capacity = game.facilities.reduce((n, f) =>
    n + FACILITIES[f.key].slots.filter(r => r === role).length, 0);
  return game.staff.filter(s => STAFF[s.key].role === role).length < capacity;
}

function purchase(game, policy, rng, metrics) {
  let offers = [...game.market];
  if (policy === 'random') offers.sort(() => rng() - .5);
  else {
    const order = purchasePriority[policy];
    const priority=key=>{const index=order.indexOf(key);return index<0?999:index};
    offers.sort((a, b) => priority(a.key) - priority(b.key));
  }
  for (const offer of offers) {
    const def = offer.kind === 'staff' ? STAFF[offer.key] : FACILITIES[offer.key];
    if (game.money < def.cost) continue;
    if (offer.kind === 'facility' && game.facilities.filter(f => f.slotIndex !== null).length >= 6) continue;
    if (offer.kind === 'staff' && !canUseStaff(game, offer.key)) continue;
    if (!buy(game, offer.kind, offer.key)) continue;
    metrics.purchases[`${offer.kind}:${offer.key}`] =
      (metrics.purchases[`${offer.kind}:${offer.key}`] || 0) + 1;
    if (offer.kind === 'facility') {
      const facility = game.facilities.find(f => f.slotIndex === null);
      const free = Array.from({length: 6}, (_, i) => i)
        .find(i => !game.facilities.some(f => f.slotIndex === i));
      if (facility && free !== undefined) placeFacility(game, facility.id, free);
    }
  }
}

function placePostoperative(game) {
  while (game.phase === 'postoperative') {
    const theatre = theatreFacilities(game).find(f => f.patients.some(p => p.postoperative));
    const patient = theatre?.patients.find(p => p.postoperative);
    const ward = wardFacilities(game)
      .filter(f => canEnterWard(patient,f))
      .sort((a, b) => a.patients.length - b.patients.length)[0];
    if (!patient || !ward || !placePostoperativePatient(game, patient.id, ward.id)) break;
  }
}

function makeMetrics() {
  return {
    rounds: 0, discharges: 0, deaths: 0, deterioration: 0, protected: 0,
    queuePenalty: 0, queuePeak: 0, edOccupancy: 0, wardOccupancy: 0,
    theatreOccupancy: 0, samples: 0, finalMoney: 0, finalReputation: 0,
    unusedMedication:0,unusedNursing:0,gameOver:false,purchases:{},
    averageUnmetNeeds:0,moneyEarned:0,moneySpent:0,investigations:0,
    nursingDelivered:0,medicationDelivered:0,surgeryDelivered:0,
    upkeepPaid:0,upkeepUnpaid:0,upkeepReputationLoss:0,
    radiologyInvestigations:0,homeDischarges:0,homeMoney:0,homeReputation:0,
    helipadArrivals:0,walkInArrivals:0,rehabilitationAdmissions:0,
    passiveIncome:0,finalAppeal:0,averageAppeal:0,averageStaffOffers:0,
    appealSamples:0,facilityOwnedRounds:{},staffOwnedRounds:{}
  };
}

function runOne(policy, seed, rules=BASELINE) {
  const game = createGame(seed);
  game.reputation=rules.startingReputation;
  const rng = seeded(seed * 7919 + 17);
  const metrics = makeMetrics();
  while (!game.gameOver && !game.gameWon && game.round <= HORIZON) {
    metrics.rounds = game.round;
    for(const facility of game.facilities)metrics.facilityOwnedRounds[facility.key]=(metrics.facilityOwnedRounds[facility.key]||0)+1;
    for(const member of game.staff)metrics.staffOwnedRounds[member.key]=(metrics.staffOwnedRounds[member.key]||0)+1;
    metrics.averageAppeal+=appealLevel(game);
    metrics.appealSamples++;
    assignTeam(game, policy, rng);
    useRadiology(game,policy,rng);
    investigatePatients(game, policy, rng, rules);
    admitPatients(game, policy, rng,metrics);
    allocateTreatment(game, policy, rng);
    useHospitalHome(game,policy,rng);
    metrics.unusedMedication+=game.resources.medication;
    metrics.unusedNursing+=game.facilities.reduce((sum,f)=>sum+(f.nursing||0),0);
    const reputationBeforeResolution = game.reputation;
    advancePhase(game);
    for (const event of game.resolutionEvents) {
      if (event.type === 'discharge') metrics.discharges++;
      if (event.type === 'death') metrics.deaths++;
      if (event.type === 'deteriorate') metrics.deterioration++;
      if (event.type === 'protected') metrics.protected++;
    }
    if (game.gameOver) break;
    advancePhase(game);
    scheduleOperations(game, policy, rng);
    const beforeQueue = game.reputation;
    advancePhase(game);
    if(rules.queueDivisor>1){
      const desiredLoss=Math.min(beforeQueue,Math.ceil(game.queue.length/rules.queueDivisor));
      game.reputation=beforeQueue-desiredLoss;
      if(game.reputation>0)game.gameOver=false;
    }
    metrics.queuePenalty += Math.max(0, beforeQueue - game.reputation);
    metrics.queuePeak = Math.max(metrics.queuePeak, game.queue.length);
    if (game.gameOver) break;
    purchase(game, policy, rng, metrics);
    sample(game, metrics);
    advancePhase(game);
    placePostoperative(game);
    if (game.round > HORIZON) break;
    if (game.reputation > reputationBeforeResolution + 1000) throw new Error('Invalid reputation');
  }
  metrics.finalMoney = game.money;
  metrics.finalReputation = game.reputation;
  metrics.finalAppeal=appealLevel(game);
  metrics.averageAppeal=metrics.appealSamples?metrics.averageAppeal/metrics.appealSamples:0;
  metrics.averageStaffOffers=game.analytics.marketRefreshes?game.analytics.staffOffers/game.analytics.marketRefreshes:0;
  metrics.gameOver = game.gameOver;
  metrics.discharges=game.outcomes.discharged;
  metrics.deaths=game.outcomes.deaths;
  metrics.queuePenalty=game.analytics.reputationLost.queue;
  metrics.queuePeak=game.analytics.peakQueue;
  metrics.averageUnmetNeeds=game.analytics.resolutionSamples?game.analytics.totalUnmetAtResolution/game.analytics.resolutionSamples:0;
  metrics.moneyEarned=game.analytics.moneyEarned;
  metrics.passiveIncome=game.analytics.passiveIncome;
  metrics.moneySpent=game.analytics.moneySpent;
  metrics.investigations=game.analytics.investigations;
  metrics.nursingDelivered=game.analytics.treatments.nursing;
  metrics.medicationDelivered=game.analytics.treatments.medication;
  metrics.surgeryDelivered=game.analytics.treatments.surgery;
  metrics.upkeepPaid=game.analytics.upkeepPaid;
  metrics.upkeepUnpaid=game.analytics.upkeepUnpaid;
  metrics.upkeepReputationLoss=game.analytics.reputationLost.upkeep;
  metrics.radiologyInvestigations=game.analytics.facilityAbilities.radiologyInvestigations;
  metrics.homeDischarges=game.analytics.facilityAbilities.homeDischarges;
  metrics.homeMoney=game.analytics.facilityAbilities.homeMoney;
  metrics.homeReputation=game.analytics.facilityAbilities.homeReputation;
  metrics.helipadArrivals=game.analytics.facilityAbilities.helipadArrivals;
  metrics.walkInArrivals=game.analytics.facilityAbilities.walkInArrivals;
  return metrics;
}

function sample(game, metrics) {
  const ed = game.facilities.find(f => f.key === 'ed');
  const wards = wardFacilities(game);
  const theatres = theatreFacilities(game);
  const wardBeds = wards.reduce((n, f) => n + FACILITIES[f.key].beds, 0);
  const theatreSpaces = theatres.reduce((n, f) => n + (FACILITIES[f.key].patientSpaces || 0), 0);
  metrics.edOccupancy += ed.patients.length / FACILITIES.ed.beds;
  metrics.wardOccupancy += wardBeds ? wards.reduce((n, f) => n + f.patients.length, 0) / wardBeds : 0;
  metrics.theatreOccupancy += theatreSpaces ? theatres.reduce((n, f) => n + f.patients.length, 0) / theatreSpaces : 0;
  metrics.samples++;
}

function summarize(policy, results) {
  const avg = key => results.reduce((n, r) => n + r[key], 0) / results.length;
  const purchases = {};
  for (const result of results)
    for (const [key, value] of Object.entries(result.purchases))
      purchases[key] = (purchases[key] || 0) + value;
  const topPurchases = Object.entries(purchases)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([key, value]) => `${key} ${(value / results.length).toFixed(2)}/game`);
  const leastPurchases = MARKET.map(card=>`${card.kind}:${card.key}`)
    .map(key=>[key,purchases[key]||0])
    .sort((a,b)=>a[1]-b[1]).slice(0,5)
    .map(([key,value])=>`${key} ${(value/results.length).toFixed(2)}/game`);
  const specialFacilities=['radiology','rehabilitation','hospitalHome','helipad','walkInCentre','cafe','staffLounge','hospitalLibrary'];
  const facilityPerformance=Object.fromEntries(specialFacilities.map(key=>{
    const purchaseKey=`facility:${key}`;
    const usesKey=key==='radiology'?'radiologyInvestigations':key==='rehabilitation'?'rehabilitationAdmissions':key==='hospitalHome'?'homeDischarges':key==='helipad'?'helipadArrivals':key==='walkInCentre'?'walkInArrivals':null;
    const ownedRounds=results.reduce((sum,r)=>sum+(r.facilityOwnedRounds[key]||0),0)/results.length;
    return [key,{
      purchaseRatePct:+(100*results.filter(r=>(r.purchases[purchaseKey]||0)>0).length/results.length).toFixed(1),
      averagePurchases:+((purchases[purchaseKey]||0)/results.length).toFixed(2),
      averageOwnedRounds:+ownedRounds.toFixed(2),
      ...(usesKey?{averageAbilityUses:+avg(usesKey).toFixed(2)}:{}),
      ...(key==='hospitalHome'?{averageMoneyGenerated:+avg('homeMoney').toFixed(2),averageReputationGenerated:+avg('homeReputation').toFixed(2)}:{}),
      ...(FACILITIES[key].income?{averageIncomeGenerated:+(ownedRounds*FACILITIES[key].income).toFixed(2)}:{}),
      ...(FACILITIES[key].appeal?{averageAppealRoundValue:+(ownedRounds*FACILITIES[key].appeal).toFixed(2)}:{})
    }]
  }));
  const volunteerKey='staff:volunteer',volunteerOwned=results.reduce((sum,r)=>sum+(r.staffOwnedRounds.volunteer||0),0)/results.length;
  return {
    policy,
    games: results.length,
    survivedHorizonPct: +(100 * results.filter(r => !r.gameOver).length / results.length).toFixed(1),
    averageRounds: +avg('rounds').toFixed(2),
    averageFinalReputation: +avg('finalReputation').toFixed(2),
    averageFinalMoney: +avg('finalMoney').toFixed(2),
    averageDischarges: +avg('discharges').toFixed(2),
    averageDeaths: +avg('deaths').toFixed(2),
    averageDeteriorations: +avg('deterioration').toFixed(2),
    averageUnmetNeedsAtResolution:+avg('averageUnmetNeeds').toFixed(2),
    averageMoneyEarned:+avg('moneyEarned').toFixed(2),
    averagePassiveIncome:+avg('passiveIncome').toFixed(2),
    averageMoneySpent:+avg('moneySpent').toFixed(2),
    averageFinalAppeal:+avg('finalAppeal').toFixed(2),
    averageAppeal:+avg('averageAppeal').toFixed(2),
    averageStaffOffers:+avg('averageStaffOffers').toFixed(2),
    averageInvestigations:+avg('investigations').toFixed(2),
    averageNursingDelivered:+avg('nursingDelivered').toFixed(2),
    averageMedicationDelivered:+avg('medicationDelivered').toFixed(2),
    averageSurgeryDelivered:+avg('surgeryDelivered').toFixed(2),
    averageUpkeepPaid:+avg('upkeepPaid').toFixed(2),
    averageUpkeepUnpaid:+avg('upkeepUnpaid').toFixed(2),
    averageUpkeepReputationLoss:+avg('upkeepReputationLoss').toFixed(2),
    averageUnusedMedication: +avg('unusedMedication').toFixed(2),
    averageUnusedNursing: +avg('unusedNursing').toFixed(2),
    averageQueuePenalty: +avg('queuePenalty').toFixed(2),
    averagePeakQueue: +avg('queuePeak').toFixed(2),
    averageEdOccupancyPct: +(100 * results.reduce((n, r) => n + r.edOccupancy / Math.max(1, r.samples), 0) / results.length).toFixed(1),
    averageWardOccupancyPct: +(100 * results.reduce((n, r) => n + r.wardOccupancy / Math.max(1, r.samples), 0) / results.length).toFixed(1),
    averageTheatreOccupancyPct: +(100 * results.reduce((n, r) => n + r.theatreOccupancy / Math.max(1, r.samples), 0) / results.length).toFixed(1),
    facilityPerformance,
    volunteerPerformance:{
      purchaseRatePct:+(100*results.filter(r=>(r.purchases[volunteerKey]||0)>0).length/results.length).toFixed(1),
      averagePurchases:+((purchases[volunteerKey]||0)/results.length).toFixed(2),
      averageOwnedRounds:+volunteerOwned.toFixed(2),
      averageIncomeGenerated:+volunteerOwned.toFixed(2)
    },
    topPurchases,
    leastPurchases
  };
}

const report = {
  simulatorVersion: 3,
  generatedAt: new Date().toISOString(),
  runsPerPolicy: RUNS,
  horizon: HORIZON,
  assumptions: [
    'Automated policies use only information visible after investigation.',
    'Staff are reassigned each round to the facility where their role has the most immediate work.',
    'Radiology is used before Doctor actions; Hospital in the Home targets patients with exactly one unmet need.',
    'Rehabilitation restrictions, Helipad Complex arrivals, and Walk-in Centre Quick arrivals are resolved by the game engine.',
    'Appeal changes the number of staff offers; passive-income cards generate Money at round start.',
    'Purchases follow fixed policy priorities and never exceed available staff slots or map plots.',
    'Results measure system pressure, not player enjoyment or optimal human play.'
  ],
  policies: []
};

if(MODE==='adjustments'){
  report.mode='adjustments';
  report.scenarios=ADJUSTMENTS.map(rules=>({
    key:rules.key,
    label:rules.label,
    rules,
    policies:POLICIES.map(policy=>{
      const results=Array.from({length:RUNS},(_,i)=>runOne(policy,i+1,rules));
      return summarize(policy,results);
    })
  }));
}else{
  for (const policy of POLICIES) {
    const results = Array.from({length: RUNS}, (_, i) => runOne(policy, i + 1));
    report.policies.push(summarize(policy, results));
  }
}

console.log(JSON.stringify(report, null, 2));
