import assert from 'node:assert/strict';
import {createGame} from '../src/engine.js';
import {SAVE_VERSION,createSaveRecord,encodeSave,decodeSave,restoreSaveRecord} from '../src/systems/save.js';

const game=createGame(123);
game.round=4;
game.money=19;
game.reputation=12;

const record=createSaveRecord(game);
assert.equal(record.version,SAVE_VERSION);
assert.equal(record.game.round,4);
assert.notEqual(record.game,game);

const restored=decodeSave(encodeSave(game));
assert.equal(restored.round,4);
assert.equal(restored.money,19);
assert.equal(restored.reputation,12);
assert.deepEqual(restored.facilities,game.facilities);

assert.equal(decodeSave('{broken'),null);
assert.equal(restoreSaveRecord({version:999,game}),null);
assert.equal(restoreSaveRecord({version:SAVE_VERSION,game:{round:1}}),null);

console.log('save tests passed');
