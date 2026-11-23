 'use strict';
function resetAlarmReport(){document.getElementById('alarmReportStatus').textContent='กำลังอ่านผลตรวจระบบแจ้งเหตุ';document.querySelectorAll('#fireAlarmTable tbody tr').forEach(row=>{row.hidden=false;row.querySelectorAll('.alarm-saved-result').forEach(cell=>cell.textContent='—');});}
function buildAlarmReport(records,month,scope){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('เลือกเดือนให้ถูกต้อง');
 const latest=new Map();records.forEach((r,index)=>{const department=String(r['หน่วยงาน']||'').trim(),date=FireReport.date(r['วันเวลาที่ตรวจ']);if(!date||!Object.values(ALARM_DEPTS).includes(department)||!FireReport.includes(scope,department))return;
 const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');if(key!==month)return;
 const old=latest.get(department),time=date.getTime();if(!old||time>old.time||(time===old.time&&index>old.index))latest.set(department,{time,index,department,note:String(r['หมายเหตุ']||'').trim(),checks:ALARM_CHECKS.map(k=>['ปกติ','ไม่ปกติ'].includes(String(r[k]||'').trim())?String(r[k]).trim():'—')});});
 return {status:'success',month,rows:[...latest.values()]};
}
async function fetchAlarmReport(month,scope){const records=await read(ALARM_DATA_URL);if(records.length&&!Object.hasOwn(records[0],ALARM_CHECKS[0]))throw Error('หัวตารางผลตรวจระบบแจ้งเหตุไม่ตรง');return buildAlarmReport(records,month,scope);}
function renderAlarmReport(data,scope){document.getElementById('alarmReportStatus').textContent='';const names=Object.values(ALARM_DEPTS);document.querySelectorAll('#fireAlarmTable tbody tr').forEach((row,i)=>{const name=names[i];row.hidden=(!scope && name===ALARM_DEPTS.traffic)||!FireReport.includes(scope,name);const saved=data.rows.find(r=>r.department===name);row.querySelectorAll('.alarm-saved-result').forEach((cell,j)=>cell.textContent=saved&&['ปกติ','ไม่ปกติ'].includes(saved.checks[j])?saved.checks[j]:'—');});}

function combinedReportSummary(report,alarmData){
 const t=report.totals;
 let text=`จากการรวบรวมข้อมูลรายงานผลความพร้อมใช้งานของถังดับเพลิงและระบบป้องกันอัคคีภัย ของอาคารต่างๆที่อยู่ในการควบคุมดูแลของกองกายภาพและสิ่งแวดล้อม มีถังดับเพลิงรวม ${t.total} ถัง พบว่าอยู่ในสภาพพร้อมใช้งาน ${t.ready} ถัง ไม่พร้อมใช้งาน ${t.notReady} ถัง`;


 if(!alarmData)return text;
 const missing=[],abnormal=[];
 for(const name of Object.values(ALARM_DEPTS)){
  const row=alarmData.rows.find(r=>r.department===name);
  if(!row){missing.push(name);continue;}
  const bad=row.checks.map((v,i)=>v==='ไม่ปกติ'?ALARM_CHECKS[i]:null).filter(Boolean);
  if(bad.length)abnormal.push(name);
  if(row.checks.length!==ALARM_CHECKS.length||row.checks.some(v=>!['ปกติ','ไม่ปกติ'].includes(v)))missing.push(name);
 }
 if(!missing.length&&!abnormal.length)return text+' และระบบป้องกันอัคคีภัย สามารถใช้งานได้ทุกจุด';
 if(abnormal.length)text+=' และระบบป้องกันอัคคีภัย พบไม่สามารถใช้งานได้ '+abnormal.length+' อาคาร คือ '+abnormal.join(' และ ');

 return text;
}

function setAlarmReportVisibility(scope){document.getElementById("alarmReportSection").hidden=scope===ALARM_DEPTS.traffic;}

function scopedReportSummary(report,alarmData,scope,monthText){
 const t=report.totals,traffic=scope===ALARM_DEPTS.traffic;
 let text=`จากการรวบรวมข้อมูลรายงานผลความพร้อมใช้งานของถังดับเพลิง${traffic?'':'และระบบป้องกันอัคคีภัย'} ของอาคารที่อยู่ในการควบคุมดูแลของ${scope} มีถังดับเพลิงรวม ${t.total} ถัง พบว่าอยู่ในสภาพพร้อมใช้งาน ${t.ready} ถัง ไม่พร้อมใช้งาน ${t.notReady} ถัง`;



 if(traffic)return text;
 const names=FireReport.departments(scope),missing=[],abnormal=[];
 for(const name of names){
  const row=alarmData&&alarmData.rows.find(r=>r.department===name);
  if(!row){missing.push(name);continue;}
  const bad=row.checks.map((v,i)=>v==='ไม่ปกติ'?ALARM_CHECKS[i]:null).filter(Boolean);
  if(bad.length)abnormal.push(name);
  if(row.checks.length!==ALARM_CHECKS.length||row.checks.some(v=>!['ปกติ','ไม่ปกติ'].includes(v)))missing.push(name);
 }
 if(!missing.length&&!abnormal.length)return text+' และระบบป้องกันอัคคีภัย สามารถใช้งานได้ทุกจุด';
 if(abnormal.length)text+=' และระบบป้องกันอัคคีภัย พบไม่สามารถใช้งานได้ '+abnormal.length+' อาคาร คือ '+abnormal.join(' และ ');

 return text;
}
