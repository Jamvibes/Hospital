import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const index=await readFile(join(root,'index.html'),'utf8');
const releasePath=index.match(/<script type="module" src="([^"]+)"/)?.[1];
assert.ok(releasePath,'index.html must identify a module release');
await access(join(root,releasePath));

for(const path of [join(root,'src','app.js'),join(root,releasePath)]){
  const source=await readFile(path,'utf8');
  assert.ok(!source.includes('truncated'),`${path} contains a truncation marker`);
  const withoutImports=source.replace(/^import .*;\r?\n/gm,'');
  assert.doesNotThrow(()=>new Function(withoutImports),`${path} must parse`);
}

for(const directory of ['src','tests','sim']){
  for(const name of await readdir(join(root,directory))){
    if(!/\.(?:js|mjs)$/.test(name))continue;
    const source=await readFile(join(root,directory,name),'utf8');
    const transferMarker=['tokens','truncated'].join(' ');
    assert.ok(!source.includes(transferMarker),`${directory}/${name} contains a transfer truncation marker`);
  }
}

console.log(`release validation passed: ${releasePath}`);
