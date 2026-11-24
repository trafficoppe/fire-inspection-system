/* Pure report calculations. No network, mutations, or inferred historical identities. */
(function(root){
'use strict';
const utilityScope='งานสาธารณูปโภคและระบบอาคาร';
const utilityDepartments=['อาคารบำบัดน้ำเสีย','สถานีไฟฟ้าย่อยมหิดล','อาคารสิริวิทยา','อาคารศาลายา กองกายภาพฯ'];
const pmhLabel='อาคารมหิดลสิทธาคาร';
const pmhNames=[pmhLabel,'มหิดลสิทธาคาร'];
const libraryName='ศูนย์การเรียนรู้มหิดล';
const siriName='อาคารสิริวิทยา';
const pairedScope='ศูนย์การเรียนรู้มหิดลและอาคารสิริวิทยา';
const pairedDepartments=[libraryName,siriName];
const departments=scope=>scope===utilityScope?utilityDepartments:scope===pairedScope?pairedDepartments:pmhNames.includes(scope)?pmhNames:[scope];
const includes=(scope,dept)=>!scope||departments(scope).includes(dept);
const text=v=>String(v??'').trim();
const validCode=v=>!['','-','null'].includes(text(v));
function date(v){
 if(v instanceof Date&&!isNaN(v)) return v;
 let m=text(v).match(/^Date\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)/);
 if(m) return new Date(+m[1],+m[2],+m[3],+m[4]||0,+m[5]||0,+m[6]||0);
 m=text(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
 if(m){let y=+m[3];if(y>2400)y-=543;const d=new Date(y,+m[2]-1,+m[1],+m[4]||0,+m[5]||0,+m[6]||0);return d.getFullYear()===y&&d.getMonth()===+m[2]-1&&d.getDate()===+m[1]?d:null;}
 m=text(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
 if(m){const d=new Date(+m[1],+m[2]-1,+m[3],+m[4]||0,+m[5]||0,+m[6]||0);return d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;}return null;
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
 const [year,mon]=month.split('-').map(Number), groups=new Map(), indexes=new Map();
 const add=(key,i)=>{if(!indexes.has(key))indexes.set(key,new Set());indexes.get(key).add(i);};
 inventory.forEach((r,i)=>{const dept=text(r['หน่วยงาน']);if(!dept)return;if(!groups.has(dept))groups.set(dept,{department:dept,total:0,ready:0,notReady:0,unknown:0,uninspected:0});groups.get(dept).total++;
 for(const key of ['หมายเลขครุภัณฑ์','เลขที่ถัง'])if(validCode(r[key]))add(JSON.stringify([dept,text(r[key])]),i);
 });
 const latest=new Map(),ambiguous=new Set();let unmatched=0,invalidDates=0;
 inspections.forEach((r,row)=>{if(!includes(scope,text(r['หน่วยงาน'])))return;const d=date(r['วันเวลาที่ตรวจ']);if(!d){invalidDates++;return;}if(d.getFullYear()!==year||d.getMonth()+1!==mon)return;
 const dept=text(r['หน่วยงาน']);if(!includes(scope,dept))return;
 // Prefer explicit asset column; legacy 'เลขที่ถัง' sometimes stores the asset code.
 const code=validCode(r['รหัสครุภัณฑ์'])?text(r['รหัสครุภัณฑ์']):text(r['เลขที่ถัง']);
 const candidates=validCode(code)?indexes.get(JSON.stringify([dept,code])):null;
 if(!candidates||!candidates.size){unmatched++;return;}
 if(candidates.size!==1){for(const i of candidates)ambiguous.add(i);return;}
 const i=[...candidates][0],old=latest.get(i),time=d.getTime();
 if(!old||time>old.time)latest.set(i,{time,row,r,conflict:false});
 else if(time===old.time&&JSON.stringify(old.r)!==JSON.stringify(r))old.conflict=true;
 });
 inventory.forEach((r,i)=>{const group=groups.get(text(r['หน่วยงาน']));if(!group)return;const item=latest.get(i);if(ambiguous.has(i)||(item&&item.conflict))group.unknown++;else if(!item)group.uninspected++;else group[status(item.r)]++;});
 const rows=[...groups.values()].filter(g=>includes(scope,g.department));
 const allowMissing=scope===utilityScope||scope===pairedScope||scope===siriName||pmhNames.includes(scope);
 if(scope&&!allowMissing&&!departments(scope).some(d=>groups.has(d)))throw Error('ไม่พบอาคารหรือหน่วยงานนี้ในทะเบียน');
 const missingInventory=scope===utilityScope?utilityDepartments.filter(d=>!groups.has(d)):scope===pairedScope?pairedDepartments.filter(d=>!groups.has(d)):pmhNames.includes(scope)&&!pmhNames.some(d=>groups.has(d))?[pmhLabel]:scope===siriName&&!groups.has(siriName)?[siriName]:[];
 for(const department of missingInventory)rows.push({department,total:0,ready:0,notReady:0,unknown:0,uninspected:0,missingInventory:true});
 const totals=rows.reduce((a,g)=>{for(const k of ['total','ready','notReady','unknown','uninspected'])a[k]+=g[k];return a;},{total:0,ready:0,notReady:0,unknown:0,uninspected:0});
 return {month,scope,rows,totals,unmatched,invalidDates,missingInventory};
}
const api={date,status,build,departments,includes,utilityScope,pmhLabel,pmhNames,libraryName,siriName,pairedScope};if(typeof module!=='undefined')module.exports=api;root.FireReport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
