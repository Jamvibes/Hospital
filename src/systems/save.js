export const SAVE_VERSION=1;
export const SAVE_KEY='hospital-prototype-save';

const clone=value=>JSON.parse(JSON.stringify(value));

export function createSaveRecord(game){
  return {version:SAVE_VERSION,savedAt:new Date().toISOString(),game:clone(game)}
}

export function restoreSaveRecord(record){
  if(!record||record.version!==SAVE_VERSION||!record.game)return null;
  const game=clone(record.game);
  if(!Number.isInteger(game.round)||!game.phase||!Array.isArray(game.facilities)||!Array.isArray(game.staff)||!Array.isArray(game.deck)||!Array.isArray(game.queue))return null;
  return game
}

export function encodeSave(game){return JSON.stringify(createSaveRecord(game))}
export function decodeSave(text){
  try{return restoreSaveRecord(JSON.parse(text))}
  catch{return null}
}
