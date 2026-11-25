/* Pure report calculations. No network, mutations, or inferred historical identities. */
(function(root){
'use strict';
const utilityScope='งานสาธารณูปโภคและระบบอาคาร';
const utilityDepartments=['อาคารบำบัดน้ำเสีย','สถานีไฟฟ้าย่อยมหิดล','อาคารศาลายา กองกายภาพฯ'];
const pmhLabel='อาคารมหิดลสิทธาคาร';
const pmhNames=[pmhLabel,'มหิดลสิทธาคาร'];
const libraryName='ศูนย์การเรียนรู้มหิดล';
const environmentName='อาคารอนุรักษ์สิ่งแวดล้อม';
const siriName='อาคารสิริวิทยา';
const pairedScope='ศูนย์การเรียนรู้มหิดลและอาคารสิริวิทยา';
const pairedDepartments=[libraryName,siriName];
const departments=scope=>scope===utilityScope?utilityDepartments:scope===pairedScope?pairedDepartments:pmhNames.includes(scope)?pmhNames:[scope];
const includes=(scope,dept)=>!scope||departments(scope).includes(dept);
const text=v=>String(v??'').trim();
const validCode=v=>!['','-','null'].includes(text(v));
function date(v){
 if(v instanceof Date&&!isNaN(v)) return v;
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text(v))){
  const instant=new Date(text(v));
  if(!Number.isFinite(instant.getTime()))return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant).map(({type,value})=>[type,Number(value)]));
  return new Date(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second,instant.getUTCMilliseconds());
 }
 let m=text(v).match(/^Date\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)/);
 if(m) return new Date(+m[1],+m[2],+m[3],+m[4]||0,+m[5]||0,+m[6]||0);
 m=text(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
 if(m){let y=+m[3];if(y>2400)y-=543;const d=new Date(y,+m[2]-1,+m[1],+m[4]||0,+m[5]||0,+m[6]||0);return d.getFullYear()===y&&d.getMonth()===+m[2]-1&&d.getDate()===+m[1]?d:null;}
 m=text(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
 if(m){const d=new Date(+m[1],+m[2]-1,+m[3],+m[4]||0,+m[5]||0,+m[6]||0);return d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;}return null;
}
function inspectionDay(row) {
 const selected=text(row['วันที่ตรวจ']);
 return selected?date(selected):date(row['วันเวลาที่ตรวจ']);
}
function inspectionRecordedTime(row) {
 return date(row['วันเวลาที่ตรวจ'])?.getTime() ?? -Infinity;
}
function status(r){
 const result=text(r['สรุปผล']);
 if(['ชำรุด','ผิดปกติ','ไม่ปกติ','ไม่พร้อมใช้งาน'].includes(result))return 'notReady';
 if(!['ปกติ','พร้อมใช้งาน'].includes(result))return 'unknown';
 // Contradictory details or notes cannot silently certify readiness.
 const checks=['แรงดัน','สลักและซีล','สภาพถัง','สายฉีด','คันบีบ','ป้ายแนะนำ','ตำแหน่งติดตั้ง','ฐาน/ที่แขวน'];
 if(checks.some(k=>/ชำรุด|ผิดปกติ|ไม่ปกติ|ไม่พร้อม/.test(text(r[k]))))return 'unknown';
 const note=text(r['หมายเหตุ']).replace(/\s+/g,'');
 if(/^(รอเติมน้ำยา)+$/.test(note)||['รอซ่อม','ส่งซ่อม','ไม่พร้อมใช้งาน','ชำรุด','ไม่ปกติ'].includes(note))return 'notReady';
 if(!['','-','ไม่มี','ปกติ','ปกติพร้อมใช้งาน','พร้อมใช้งาน','ไม่มีปัญหา','ไม่มีข้อบกพร่อง'].includes(note))return 'unknown';
 return 'ready';
}
function build(inventory,inspections,month,scope=''){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('เลือกเดือนให้ถูกต้อง');
 const [year,mon]=month.split('-').map(Number), groups=new Map(), aliases=new Map(), canonical=new Map();
 const add=(index,key,i)=>{if(!index.has(key))index.set(key,new Set());index.get(key).add(i);};
 inventory.forEach((r,i)=>{const dept=text(r['หน่วยงาน']);if(!dept)return;if(!groups.has(dept))groups.set(dept,{department:dept,total:0,ready:0,notReady:0,unknown:0,uninspected:0});groups.get(dept).total++;
 const asset=validCode(r['หมายเลขครุภัณฑ์'])?text(r['หมายเลขครุภัณฑ์']):'';
 const number=validCode(r['เลขที่ถัง'])?text(r['เลขที่ถัง']):'';
 if(asset||number)add(canonical,JSON.stringify([dept,asset||number]),i);
 for(const key of [asset,number].filter(Boolean))add(aliases,JSON.stringify([dept,key]),i);
 });
 const latest=new Map(),ambiguous=new Set();let unmatched=0,invalidDates=0;
 inspections.forEach((r,row)=>{if(!includes(scope,text(r['หน่วยงาน'])))return;const d=inspectionDay(r);if(!d){invalidDates++;return;}if(d.getFullYear()!==year||d.getMonth()+1!==mon)return;
 const dept=text(r['หน่วยงาน']);if(!includes(scope,dept))return;
 // Prefer explicit asset column; legacy 'เลขที่ถัง' sometimes stores the asset code.
 const explicit=validCode(r['รหัสครุภัณฑ์']);
 const code=explicit?text(r['รหัสครุภัณฑ์']):text(r['เลขที่ถัง']);
 const candidates=validCode(code)?(explicit?canonical:aliases).get(JSON.stringify([dept,code])):null;
 if(!candidates||!candidates.size){unmatched++;return;}
 if(candidates.size!==1){for(const i of candidates)ambiguous.add(i);return;}
 const i=[...candidates][0];
 if(explicit&&!validCode(inventory[i]['หมายเลขครุภัณฑ์'])&&aliases.get(JSON.stringify([dept,code]))?.size!==1){ambiguous.add(i);return;}
 const old=latest.get(i),time=d.getTime(),recorded=inspectionRecordedTime(r);
 if(!old||time>old.time||(time===old.time&&recorded>old.recorded))latest.set(i,{time,recorded,row,r,conflict:false});
 else if(time===old.time&&recorded===old.recorded&&JSON.stringify(old.r)!==JSON.stringify(r))old.conflict=true;
 });
 inventory.forEach((r,i)=>{const group=groups.get(text(r['หน่วยงาน']));if(!group)return;const item=latest.get(i);if(ambiguous.has(i)||(item&&item.conflict))group.unknown++;else if(!item)group.uninspected++;else group[status(item.r)]++;});
 const columns=['total','ready','notReady','unknown','uninspected'];
 const mainDepartments=['งานจราจรและความปลอดภัย',libraryName,'มหิดลสิทธาคาร',siriName,...utilityDepartments.slice().reverse(),environmentName];
 const missingRow=department=>({department,total:0,ready:0,notReady:0,unknown:0,uninspected:0,missingInventory:true});
 const rows=scope?[...groups.values()].filter(g=>includes(scope,g.department)):mainDepartments.map(department=>{
  const sources=departments(department).map(name=>groups.get(name)).filter(Boolean);
  const row=missingRow(department);
  if(!sources.length)return row;
  delete row.missingInventory;
  for(const source of sources)for(const column of columns)row[column]+=source[column];
  return row;
 });
 const allowMissing=scope===utilityScope||scope===pairedScope||scope===siriName||scope===environmentName||pmhNames.includes(scope);
 if(scope&&!allowMissing&&!departments(scope).some(d=>groups.has(d)))throw Error('ไม่พบอาคารหรือหน่วยงานนี้ในทะเบียน');
 const missingInventory=!scope?rows.filter(g=>g.missingInventory).map(g=>g.department):scope===utilityScope?utilityDepartments.filter(d=>!groups.has(d)):scope===pairedScope?pairedDepartments.filter(d=>!groups.has(d)):pmhNames.includes(scope)&&!pmhNames.some(d=>groups.has(d))?[pmhLabel]:scope===siriName&&!groups.has(siriName)?[siriName]:scope===environmentName&&!groups.has(environmentName)?[environmentName]:[];
 if(scope)for(const department of missingInventory)rows.push(missingRow(department));
 const totals=rows.reduce((a,g)=>{for(const k of columns)a[k]+=g[k];return a;},{total:0,ready:0,notReady:0,unknown:0,uninspected:0});
 return {month,scope,rows,totals,unmatched,invalidDates,missingInventory};
}
const api={date,inspectionDay,inspectionRecordedTime,status,build,departments,includes,utilityScope,pmhLabel,pmhNames,libraryName,siriName,pairedScope,environmentName};if(typeof module!=='undefined')module.exports=api;root.FireReport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
