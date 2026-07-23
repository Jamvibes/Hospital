export const PATIENTS = [
  {id:'p1',portrait:'A',needs:{nursing:1,medication:1,surgery:0},wardRequired:false,deterioratesAfter:3},
  {id:'p2',portrait:'B',needs:{nursing:2,medication:0,surgery:0},wardRequired:true,deterioratesAfter:2},
  {id:'p3',portrait:'C',needs:{nursing:1,medication:1,surgery:1},wardRequired:true,deterioratesAfter:2},
  {id:'p4',portrait:'D',needs:{nursing:3,medication:0,surgery:0},wardRequired:true,deterioratesAfter:3},
  {id:'p5',portrait:'E',needs:{nursing:0,medication:2,surgery:0},wardRequired:false,deterioratesAfter:2},
  {id:'p6',portrait:'F',needs:{nursing:2,medication:1,surgery:0},wardRequired:true,deterioratesAfter:2},
  {id:'p7',portrait:'G',needs:{nursing:1,medication:0,surgery:1},wardRequired:true,deterioratesAfter:2},
  {id:'p8',portrait:'H',needs:{nursing:1,medication:2,surgery:0},wardRequired:true,deterioratesAfter:3},
  {id:'p9',portrait:'I',needs:{nursing:0,medication:1,surgery:0},wardRequired:false,deterioratesAfter:3},
  {id:'p10',portrait:'J',needs:{nursing:2,medication:1,surgery:1},wardRequired:true,deterioratesAfter:2}
];

export const STAFF = {
  doctor:{name:'Doctor',monogram:'DR',cost:7,role:'doctor',effect:'Investigate 1 patient in the assigned facility each round.'},
  nurse:{name:'Ward Nurse',monogram:'RN',cost:6,role:'nurse',effect:'Provides 2 Nursing Care in the assigned patient-care facility.'},
  pharmacist:{name:'Pharmacist',monogram:'RX',cost:6,role:'pharmacist',effect:'Generates 1 Medication; generates 2 when assigned to Pharmacy.'},
  surgeon:{name:'Surgeon',monogram:'SG',cost:10,role:'surgeon',effect:'Generates 1 Surgery while assigned to an Operating Theatre.'}
};

export const FACILITIES = {
  ed:{name:'Emergency Department',short:'ED',cost:0,kind:'clinical',beds:4,slots:['doctor','nurse','pharmacist'],colour:'blue',effect:'Investigate and partially treat patients before admission.'},
  ward:{name:'General Ward',short:'GW',cost:8,kind:'ward',beds:2,slots:['nurse','doctor'],colour:'sage',effect:'Flexible inpatient beds. Patients can complete treatment here.'},
  shortStay:{name:'Short Stay Ward',short:'SS',cost:9,kind:'ward',beds:2,slots:['nurse'],colour:'amber',effect:'Patients with one Nursing need receive +1 care when admitted.'},
  pharmacy:{name:'Pharmacy',short:'RX',cost:7,kind:'support',beds:0,slots:['pharmacist'],colour:'mint',effect:'A Pharmacist assigned here generates 2 Medication.'},
  theatre:{name:'Operating Theatre',short:'OT',cost:12,kind:'support',beds:0,slots:['surgeon'],colour:'rose',effect:'A Surgeon assigned here generates 1 Surgery.'}
};

export const MARKET = [
  {kind:'staff',key:'doctor'},{kind:'staff',key:'nurse'},{kind:'staff',key:'pharmacist'},{kind:'staff',key:'surgeon'},
  {kind:'facility',key:'ward'},{kind:'facility',key:'shortStay'},{kind:'facility',key:'pharmacy'},{kind:'facility',key:'theatre'}
];
