export const PATIENTS = [
  // Quick patients: 1–2 initial needs.
  {id:'p01',portrait:'A',needs:{nursing:0,medication:1,surgery:0},wardRequired:false},
  {id:'p02',portrait:'B',needs:{nursing:1,medication:0,surgery:0},wardRequired:false},
  {id:'p03',portrait:'C',needs:{nursing:0,medication:2,surgery:0},wardRequired:false},
  {id:'p04',portrait:'D',needs:{nursing:1,medication:1,surgery:0},wardRequired:false},
  {id:'p05',portrait:'E',needs:{nursing:2,medication:0,surgery:0},wardRequired:true},
  {id:'p06',portrait:'F',needs:{nursing:1,medication:0,surgery:1},wardRequired:true},
  {id:'p07',portrait:'G',needs:{nursing:0,medication:1,surgery:1},wardRequired:true},

  // Standard patients: 3–4 initial needs.
  {id:'p08',portrait:'H',needs:{nursing:3,medication:0,surgery:0},wardRequired:true},
  {id:'p09',portrait:'I',needs:{nursing:2,medication:1,surgery:0},wardRequired:true},
  {id:'p10',portrait:'J',needs:{nursing:1,medication:2,surgery:0},wardRequired:true},
  {id:'p11',portrait:'K',needs:{nursing:1,medication:1,surgery:1},wardRequired:true},
  {id:'p12',portrait:'L',needs:{nursing:0,medication:3,surgery:0},wardRequired:false},
  {id:'p13',portrait:'M',needs:{nursing:2,medication:0,surgery:1},wardRequired:true},
  {id:'p14',portrait:'N',needs:{nursing:0,medication:2,surgery:1},wardRequired:true},
  {id:'p15',portrait:'O',needs:{nursing:1,medication:2,surgery:0},wardRequired:false},
  {id:'p16',portrait:'P',needs:{nursing:2,medication:1,surgery:0},wardRequired:true},
  {id:'p17',portrait:'Q',needs:{nursing:3,medication:0,surgery:0},wardRequired:true},
  {id:'p18',portrait:'R',needs:{nursing:1,medication:1,surgery:1},wardRequired:true},
  {id:'p19',portrait:'S',needs:{nursing:3,medication:1,surgery:0},wardRequired:true},
  {id:'p20',portrait:'T',needs:{nursing:2,medication:2,surgery:0},wardRequired:true},
  {id:'p21',portrait:'U',needs:{nursing:2,medication:1,surgery:1},wardRequired:true},
  {id:'p22',portrait:'V',needs:{nursing:1,medication:2,surgery:1},wardRequired:true},

  // Complex patients: 5–6 initial needs.
  {id:'p23',portrait:'W',needs:{nursing:4,medication:1,surgery:0},wardRequired:true},
  {id:'p24',portrait:'X',needs:{nursing:3,medication:2,surgery:0},wardRequired:true},
  {id:'p25',portrait:'Y',needs:{nursing:3,medication:1,surgery:1},wardRequired:true},
  {id:'p26',portrait:'Z',needs:{nursing:2,medication:2,surgery:1},wardRequired:true},
  {id:'p27',portrait:'AA',needs:{nursing:4,medication:2,surgery:0},wardRequired:true},
  {id:'p28',portrait:'AB',needs:{nursing:3,medication:2,surgery:1},wardRequired:true},
  {id:'p29',portrait:'AC',needs:{nursing:2,medication:3,surgery:1},wardRequired:true},
  {id:'p30',portrait:'AD',needs:{nursing:4,medication:1,surgery:1},wardRequired:true}
];

export const STAFF = {
  doctor:{name:'Doctor',monogram:'DR',cost:7,role:'doctor',investigations:1,effect:'Investigate 1 patient in the assigned facility each round.'},
  seniorDoctor:{name:'Senior Doctor',monogram:'SD',cost:12,role:'doctor',investigations:2,effect:'Investigate up to 2 patients in the assigned facility each round.'},
  nurse:{name:'Ward Nurse',monogram:'RN',cost:6,role:'nurse',nursing:2,effect:'Provides 2 Nursing Care in the assigned patient-care facility.'},
  nursingAssistant:{name:'Nursing Assistant',monogram:'NA',cost:4,role:'nurse',nursing:1,effect:'Provides 1 Nursing Care to a patient in the assigned patient-care facility.'},
  seniorNurse:{name:'Senior Nurse',monogram:'SN',cost:10,role:'nurse',nursing:2,doubleNursing:true,effect:'Provides 2 Nursing Care. One patient in this facility may receive both during the same round.'},
  pharmacist:{name:'Pharmacist',monogram:'RX',cost:6,role:'pharmacist',effect:'Generates 1 Medication; generates 2 when assigned to Pharmacy.'},
  surgeon:{name:'Surgeon',monogram:'SG',cost:10,role:'surgeon',effect:'Operates on scheduled patients in an assigned Operating Theatre at the start of the next round.'},
  theatreNurse:{name:'Theatre Nurse',monogram:'TN',cost:8,role:'theatreNurse',effect:'Adds 1 patient space to the assigned Operating Theatre.'},
  administrator:{name:'Hospital Administrator',monogram:'HA',cost:8,role:'administrator',effect:'The first facility purchased each round costs $2 less while assigned.'}
};

export const FACILITIES = {
  ed:{name:'Emergency Department',short:'ED',cost:0,kind:'clinical',beds:4,slots:['doctor','nurse','pharmacist','administrator'],colour:'blue',effect:'Investigate and partially treat patients before admission.'},
  ward:{name:'General Ward',short:'GW',cost:8,kind:'ward',beds:4,slots:['nurse','doctor','administrator'],colour:'sage',effect:'Four flexible inpatient beds with no special ability.'},
  shortStay:{name:'Short Stay Ward',short:'SS',cost:9,kind:'ward',beds:2,slots:['nurse'],colour:'amber',effect:'On admission, patients with 3 or fewer unmet needs receive 1 Nursing Care.'},
  icu:{name:'Intensive Care Unit',short:'ICU',cost:13,kind:'ward',beds:1,slots:['nurse','doctor'],colour:'rose',effect:'Prevents deterioration during resolution, but cannot prevent death at 7+ unmet needs.'},
  pharmacy:{name:'Pharmacy',short:'RX',cost:7,kind:'support',beds:0,slots:['pharmacist'],colour:'mint',effect:'A Pharmacist assigned here generates 2 Medication.'},
  theatre:{name:'Operating Theatre',short:'OT',cost:12,kind:'theatre',beds:0,patientSpaces:1,slots:['surgeon','theatreNurse'],colour:'rose',effect:'Holds 1 surgical patient, plus 1 when staffed by a Theatre Nurse. Surgery resolves next round.'}
};

export const MARKET = [
  {kind:'staff',key:'doctor'},{kind:'staff',key:'seniorDoctor'},{kind:'staff',key:'nurse'},{kind:'staff',key:'nursingAssistant'},
  {kind:'staff',key:'seniorNurse'},{kind:'staff',key:'pharmacist'},{kind:'staff',key:'surgeon'},{kind:'staff',key:'theatreNurse'},{kind:'staff',key:'administrator'},
  {kind:'facility',key:'ward'},{kind:'facility',key:'shortStay'},{kind:'facility',key:'icu'},{kind:'facility',key:'pharmacy'},{kind:'facility',key:'theatre'}
];
