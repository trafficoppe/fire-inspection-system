'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=s=>s.replace(/\r\n/g,'\n');
function one(s, before, after) {
  const n=typeof before==='string'?s.split(before).length-1:[...s.matchAll(new RegExp(before.source,'g'))].length;
  assert.equal(n,1,'exact upstream match required: '+before);
  return s.replace(before,()=>after);
}
function prepareIdentityGuard(s) {
  s=source(s);
  s=one(s,/function fireRequireUnique_\(ss, code, department\) \{[\s\S]*?\n\}(?=\nfunction doPost\(e\))/, [
    'function fireRequireUnique_(ss, code, department) {',
    '  return fireExtResolve_(ss, code, department).row;',
    '}'
  ].join('\n'));
  return one(s,/    if \(data\.action === 'inspection' \|\| data\.action === 'refill_chemical'\) \{[\s\S]*?    return fireOriginalPost_\(e\);/,[
    "    if (data.action === 'inspection' || data.action === 'refill_chemical' || data.action === 'add_extinguisher') {",
    '      fireExtNormalizeWrite_(ss, data);',
    "    } else throw new Error('ไม่รู้จักคำสั่ง');",
    '    var scopedRequest = Object.assign({}, e, {postData: Object.assign({}, e.postData, {contents: JSON.stringify(data)})});',
    '    return fireOriginalPost_(scopedRequest);'
  ].join('\n'));
}
function prepareApi(s) {
  s=source(s);
  s=one(s,'      fireRequireUnique_(ss, assetCodeToFind, e.parameter.department);','      const tank = fireExtResolve_(ss, assetCodeToFind, e.parameter.department);');
  return one(s,'        if (data[i][14] == assetCodeToFind) {','        if (fireExtScopedLogRow_(data[i], tank)) {');
}
module.exports={prepareIdentityGuard,prepareApi};
if (require.main===module) {
 const [, , sourceDir, targetDir]=process.argv;
 if (!sourceDir||!targetDir) throw Error('node prepare-head.cjs <exact Apps Script source directory> <output directory>');
 fs.mkdirSync(targetDir,{recursive:true});
 for(const [n,fn] of [['IdentityGuard.gs',prepareIdentityGuard],['API_FireExtinguisher.gs',prepareApi]]) {
   const s=fs.readFileSync(path.join(sourceDir,n),'utf8'),t=fn(s);
   fs.writeFileSync(path.join(targetDir,n),t);
 }
}
