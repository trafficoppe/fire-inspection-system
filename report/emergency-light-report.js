'use strict';
function emergencyReportState(message){
 const status=document.getElementById('emergencyLightReportStatus');
 status.textContent=message;
 status.hidden=!message;
 document.getElementById('emergencyLightNarrative')?.remove();
 document.getElementById('emergencyLightReportRows').replaceChildren();
}
function renderEmergencyLightSummary(rows,total,ready,notReady,note,all){
 emergencyReportState(note);
 const table=document.getElementById('emergencyLightReportTable');
 table.tHead.rows[0].cells[0].textContent=all?'หน่วยงาน':'รายการ';
 for(const result of rows){
  const row=document.createElement('tr'), label=document.createElement('th');
  label.scope='row';label.textContent=result.name;row.append(label);
  for(const value of [result.total,result.ready,result.notReady]){
   const cell=document.createElement('td');cell.textContent=value==null?'—':String(value);row.append(cell);
  }
  document.getElementById('emergencyLightReportRows').append(row);
 }
 if([total,ready,notReady].every(Number.isSafeInteger)){
  const scoped=document.getElementById('scopeSummary');
  const paragraph=scoped.hidden?document.getElementById('combinedSummary'):scoped;
  const narrative=document.createElement('span');
  narrative.id='emergencyLightNarrative';
  narrative.textContent=` และมีไฟฉุกเฉิน${all?'ในหน่วยงานที่มีข้อมูล':'ทั้งหมด'} ${total} ตัว พร้อมใช้งาน ${ready} ตัว และไม่พร้อมใช้งาน ${notReady} ตัว`;
  paragraph.append(narrative);
 }
}
function summarizeEmergencyLightMonth(history,month){
 const statuses=['ปกติ','ไม่ปกติ'];
 let date='',outcome=null,conflict=false;
 for(const row of history){
  if(!row||typeof row.inspectionDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.inspectionDate))throw Error('invalid inspection date');
  const d=new Date(row.inspectionDate+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==row.inspectionDate)throw Error('invalid inspection date');
  if(row.inspectionDate.slice(0,7)!==month)continue;
  const next=[row.testStatus,row.batteryStatus].every(v=>statuses.includes(v))?(row.testStatus==='ปกติ'&&row.batteryStatus==='ปกติ'?'ready':'notReady'):null;
  if(row.inspectionDate>date){date=row.inspectionDate;outcome=next;conflict=false;}
  else if(row.inspectionDate===date&&outcome!==next)conflict=true;
 }
 return conflict?null:outcome;
}
async function loadEmergencyLightReport(month,scope,isCurrent){
 const all=!scope;
 const unavailable=name=>({name,total:null,ready:null,notReady:null});
 const combined='ไฟฉุกเฉิน';
 const hasGroups=typeof ALARM_DEPTS==='object' && ALARM_DEPTS!==null;
 const configured=hasGroups?Object.entries(ALARM_DEPTS):[];
 const groups=all?configured:configured.filter(([,name])=>FireReport.includes(scope,name));
 const environment=FireReport.environmentName;
 const unsupported=all&&environment&&!groups.some(([,name])=>name===environment)?[unavailable(environment)]:[];
 const render=(rows,total,ready,notReady,note)=>renderEmergencyLightSummary(rows,total,ready,notReady,note,all);
 const emptyRows=()=>all?groups.map(([,name])=>unavailable(name)).concat(unsupported):[unavailable(combined)];
 emergencyReportState('กำลังอ่านทะเบียนและผลตรวจโคมไฟฉุกเฉิน…');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){render(emptyRows(),null,null,null,'เดือนรายงานไม่ถูกต้อง');return;}
 if(!window.FireLightPublicApi?.createReport||!hasGroups){render(emptyRows(),null,null,null,'ยังเชื่อมทะเบียนโคมไฟฉุกเฉินไม่ได้');return;}
 if(!groups.length){render(emptyRows(),null,null,null,'ยังไม่มีแหล่งข้อมูลทะเบียนโคมไฟฉุกเฉินของหน่วยงานที่เลือก');return;}
 const work=async(input,run)=>{
  let next=0;const output=new Array(input.length);
  await Promise.all(Array.from({length:Math.min(input.length,4)},async()=>{
   while(isCurrent()&&next<input.length){const index=next++;try{output[index]=await run(input[index]);}catch(_){output[index]=null;}}
  }));
  return output;
 };
 const registries=await work(groups,async([slug,name])=>{
  const call=window.FireLightPublicApi.createReport(slug),data=await call('listEmergencyLightAssets',[name]);
  if(data?.status!=='success'||!Array.isArray(data.items))throw Error('inventory unavailable');
  const ids=new Set();
  return data.items.map(asset=>{
   if(typeof asset?.assetId!=='string'||!asset.assetId||ids.has(asset.assetId))throw Error('asset identity');
   ids.add(asset.assetId);return {call,name,id:asset.assetId};
  });
 });
 if(!isCurrent())return;
 const assets=registries.flatMap((items,group)=>(items??[]).map(asset=>({...asset,group})));
 const outcomes=await work(assets,async ({call,name,id})=>{
  const data=await call('listEmergencyLightAssetHistory',[name,id]);
  if(data?.status!=='success'||!Array.isArray(data.rows))throw Error('history unavailable');
  return {value:summarizeEmergencyLightMonth(data.rows,month)};
 });
 if(!isCurrent())return;
 const rows=groups.map(([,name],i)=>registries[i]?{name,total:registries[i].length,ready:0,notReady:0}:unavailable(name));
 for(let i=0;i<assets.length;i++){
  const row=rows[assets[i].group],outcome=outcomes[i];
  if(outcome===null){row.ready=row.notReady=null;continue;}
  if(row.ready!==null&&outcome.value)row[outcome.value]++;
 }
 const totals=Object.fromEntries(['total','ready','notReady'].map(k=>[k,rows.every(row=>Number.isSafeInteger(row[k]))?rows.reduce((sum,row)=>sum+row[k],0):null]));
 const {total,ready,notReady}=totals;
 const note=total===null?'อ่านทะเบียนโคมไฟฉุกเฉินบางหน่วยงานไม่สำเร็จ (— คือไม่มีข้อมูลยืนยัน)':ready===null?'อ่านผลตรวจโคมไฟฉุกเฉินบางหน่วยงานไม่ครบ (— คือไม่มีข้อมูลยืนยัน)':'';
 render(all?rows.concat(unsupported):[{name:combined,...totals}],total,ready,notReady,note);
}
