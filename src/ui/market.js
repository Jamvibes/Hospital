import {STAFF, FACILITIES, STAFF_GROUPS} from '../data.js?v=16';

export function renderMarket(game,options){
  if(!game.market.length)return '<div class="market-empty">All of this roundâ€™s offers have been purchased.</div>';
  const staff=game.market.filter(card=>card.kind==='staff');
  const facilities=game.market.filter(card=>card.kind==='facility');
  return `${heading('Staff candidates',`${options.appealLevel(game)} Appeal Â· ${options.staffOfferCount(game)} offered`)}
    ${staff.map(card=>marketCard(game,card,options)).join('')}
    ${heading('Facility projects','3 offered')}
    ${facilities.map(card=>marketCard(game,card,options)).join('')}`;
}

function heading(title,detail){
  return `<div class="market-section-heading"><strong>${title}</strong><span>${detail}</span></div>`;
}

function marketCard(game,card,options){
  const definition=card.kind==='staff'?STAFF[card.key]:FACILITIES[card.key];
  const cost=options.purchaseCost(game,card.kind,card.key);
  const noPlot=card.kind==='facility'&&!options.hasFreePlot();
  const open=game.phase==='purchasing';
  const group=card.kind==='staff'?`staff-group-${definition.group}`:'';
  const badge=card.kind==='staff'?`<span class="staff-group-badge">${STAFF_GROUPS[definition.group].name}</span>`:'';
  const disabled=!open||game.money<cost||noPlot||options.selectedFacility;
  return `<article class="market-card ${group}">
    <span class="market-icon">${definition.monogram||definition.short}</span>${badge}
    <strong>${definition.name}</strong>
    <span class="upkeep-label">$${definition.upkeep} upkeep each round</span>
    <small>${definition.effect}</small>
    <button data-action="buy" data-kind="${card.kind}" data-key="${card.key}" ${disabled?'disabled':''}>${open?'Buy':'Purchasing closed'} &middot; $${cost}</button>
  </article>`;
}
