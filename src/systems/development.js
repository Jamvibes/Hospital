import {FACILITIES, STAFF, MARKET} from '../data.js?v=16';

export function appealLevel(state){
  return state.facilities.reduce((total,facility)=>total+(FACILITIES[facility.key].appeal||0),0);
}

export function staffOfferCount(state){
  const appeal=appealLevel(state);
  return appeal>=6?4:appeal>=3?3:2;
}

export function recruitmentPool(state){
  return MARKET.filter(card=>card.kind==='staff'&&!(
    STAFF[card.key].unique&&state.staff.some(member=>member.key===card.key)
  ));
}

export function passiveIncome(state){
  const facilities=state.facilities.reduce((total,facility)=>total+(FACILITIES[facility.key].income||0),0);
  const staff=state.staff.reduce((total,member)=>total+(STAFF[member.key].income||0),0);
  return {facilities,staff,total:facilities+staff};
}

export function additionalQuickArrivals(state){
  return state.facilities.reduce((total,facility)=>total+(FACILITIES[facility.key].quickArrivals||0),0);
}
