'use strict';
function emergencyReportState(message){
 const status=document.getElementById('emergencyLightReportStatus');
 status.textContent=message;
 status.hidden=!message;
 document.getElementById('emergencyLightNarrative')?.remove();
 document.getElementById('emergencyLightReportRows').replaceChildren();
}
function renderEmergencyLightSummary(total,ready,notReady,note){
 emergencyReportState(note);
 const row=document.createElement('tr'), label=document.createElement('th');
 label.scope='row';label.textContent='ไฟฉุกเฉิน';row.append(label);
 for(const value of [total,ready,notReady]){
  const cell=document.createElement('td');cell.textContent=value==null?'—':String(value);row.append(cell);
 }
 document.getElementById('emergencyLightReportRows').append(row);
 if([total,ready,notReady].every(Number.isSafeInteger)){
  const scoped=document.getElementById('scopeSummary');
  const paragraph=scoped.hidden?document.getElementById('combinedSummary'):scoped;
  const narrative=document.createElement('span');
  narrative.id='emergencyLightNarrative';
  narrative.textContent=` และมีไฟฉุกเฉินทั้งหมด ${total} ตัว พร้อมใช้งาน ${ready} ตัว และไม่พร้อมใช้งาน ${notReady} ตัว`;
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
 emergencyReportState('กำลังอ่านทะเบียนและผลตรวจโคมไฟฉุกเฉิน…');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){renderEmergencyLightSummary(null,null,null,'เดือนรายงานไม่ถูกต้อง');return;}
 if(!window.FireLightPublicApi?.createReport||typeof ALARM_DEPTS!=='object'){renderEmergencyLightSummary(null,null,null,'ยังเชื่อมทะเบียนโคมไฟฉุกเฉินไม่ได้');return;}
 const groups=Object.entries(ALARM_DEPTS).filter(([slug,name])=>!scope||FireReport.includes(scope,name));
 if(!groups.length){renderEmergencyLightSummary(null,null,null,'ยังไม่พบหน่วยงานที่ตรงกับทะเบียนโคมไฟฉุกเฉิน');return;}
 let total=null;
 const work=async(input,run)=>{
  let next=0,failed=false;const output=new Array(input.length);
  await Promise.all(Array.from({length:Math.min(input.length,4)},async()=>{
   while(!failed&&isCurrent()&&next<input.length){const index=next++;try{output[index]=await run(input[index]);}catch(_){failed=true;}}
  }));
  if(failed)throw Error('source unavailable');return output;
 };
 try{
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
  const assets=registries.flat();total=assets.length;
  const outcomes=await work(assets,async ({call,name,id})=>{
   const data=await call('listEmergencyLightAssetHistory',[name,id]);
   if(data?.status!=='success'||!Array.isArray(data.rows))throw Error('history unavailable');
   return summarizeEmergencyLightMonth(data.rows,month);
  });
  if(!isCurrent())return;
  const ready=outcomes.filter(v=>v==='ready').length,notReady=outcomes.filter(v=>v==='notReady').length;
  renderEmergencyLightSummary(total,ready,notReady,'');
 }catch(_){if(isCurrent())renderEmergencyLightSummary(total,null,null,total==null?'อ่านทะเบียนบางหน่วยงานไม่สำเร็จ จึงยังสรุปยอดไม่ได้':'อ่านผลตรวจไม่ครบ จึงยังไม่แสดงยอดพร้อมใช้งานและไม่พร้อมใช้งาน');}
}
