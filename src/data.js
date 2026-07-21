export const PATIENTS = [
  {id:'p1',portrait:'A',needs:{nursing:1,medication:1,surgery:0},wardRequired:false,reward:4,reputation:1,deterioratesAfter:3},
  {id:'p2',portrait:'B',needs:{nursing:2,medication:0,surgery:0},wardRequired:true,reward:5,reputation:1,deterioratesAfter:2},
  {id:'p3',portrait:'C',needs:{nursing:1,medication:1,surgery:1},wardRequired:true,reward:9,reputation:2,deterioratesAfter:2},
  {id:'p4',portrait:'D',needs:{nursing:3,medication:0,surgery:0},wardRequired:true,reward:7,reputation:2,deterioratesAfter:3},
  {id:'p5',portrait:'E',needs:{nursing:0,medication:2,surgery:0},wardRequired:false,reward:5,reputation:1,deterioratesAfter:2},
  {id:'p6',portrait:'F',needs:{nursing:2,medication:1,surgery:0},wardRequired:true,reward:7,reputation:2,deterioratesAfter:2},
  {id:'p7',portrait:'G',needs:{nursing:1,medication:0,surgery:1},wardRequired:true,reward:8,reputation:2,deterioratesAfter:2},
  {id:'p8',portrait:'H',needs:{nursing:1,medication:2,surgery:0},wardRequired:true,reward:7,reputation:1,deterioratesAfter:3},
  {id:'p9',portrait:'I',needs:{nursing:0,medication:1,surgery:0},wardRequired:false,reward:3,reputation:1,deterioratesAfter:3},
  {id:'p10',portrait:'J',needs:{nursing:2,medication:1,surgery:1},wardRequired:true,reward:11,reputation:3,deterioratesAfter:2}
];

export const STAFF = {
  doctor:{name:'Doctor',icon:'D',cost:7,effect:'Investigate one patient each round.',action:'investigate'},
  nurse:{name:'Nurse',icon:'N',cost:6,effect:'Generate 2 Nursing Care each round.',production:{nursing:2}},
  pharmacist:{name:'Pharmacist',icon:'P',cost:6,effect:'Generate 1 Medication each round.',production:{medication:1}},
  surgeon:{name:'Surgeon',icon:'S',cost:10,effect:'With a Theatre, generate 1 Surgery each round.',requires:'theatre',production:{surgery:1}}
};

export const FACILITIES = {
  ed:{name:'Emergency Department',icon:'ED',cost:0,effect:'Holds 4 patients for investigation and partial treatment.',capacity:{ed:4}},
  ward:{name:'General Ward',icon:'W',cost:8,effect:'Provides 2 beds. Patients receive at most 1 Nursing Care per round.',capacity:{ward:2}},
  pharmacy:{name:'Pharmacy',icon:'Rx',cost:7,effect:'Generate 1 additional Medication each round.',production:{medication:1}},
  theatre:{name:'Operating Theatre',icon:'OT',cost:12,effect:'Enables a Surgeon to generate Surgery.',capacity:{theatre:1}}
};

export const MARKET = [
  {kind:'staff',key:'doctor'}, {kind:'staff',key:'nurse'}, {kind:'staff',key:'pharmacist'},
  {kind:'staff',key:'surgeon'}, {kind:'facility',key:'ward'}, {kind:'facility',key:'pharmacy'}, {kind:'facility',key:'theatre'}
];
