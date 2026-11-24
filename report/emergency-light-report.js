'use strict';
// Route remains off until an approved signed-in read endpoint is configured and verified.
const emergencyReportEmptyMessage='ยังไม่เชื่อมช่องทางอ่านผลตรวจสำหรับผู้ได้รับอนุญาต ไม่สามารถสรุปได้ว่าไม่มีข้อมูล';
function emergencyReportState(message){
 document.getElementById('emergencyLightReportStatus').textContent=message;
 document.getElementById('emergencyLightReportRows').replaceChildren();
}
function renderEmergencyLightRows(rows){
 if(!rows.length){emergencyReportState('ไม่พบรายการตรวจโคมไฟฟ้าแสงสว่างฉุกเฉินในเดือนและหน่วยงานที่เลือก');return;}
 const body=document.getElementById('emergencyLightReportRows');body.replaceChildren();
 document.getElementById('emergencyLightReportStatus').textContent='พบผลตรวจ '+rows.length+' รายการ';
 rows.forEach(row=>{
  const tr=document.createElement('tr');
  const d=String(row.inspectionDate||'');
  const displayDate=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)?thaiReportDate.format(new Date(d+'T00:00:00Z')):'—';
  [displayDate,row.department,row.location,row.floor,row.testStatus,row.batteryStatus,row.inspectorName,row.note].forEach(value=>{
   const td=document.createElement('td');td.textContent=String(value??'').trim()||'—';tr.append(td);
  });
  body.append(tr);
 });
}
async function loadEmergencyLightReport(month,scope,isCurrent){
 const configured=typeof EMERGENCY_LIGHT_REPORT_URL==='string'?EMERGENCY_LIGHT_REPORT_URL.trim():'';
 if(!configured){emergencyReportState(emergencyReportEmptyMessage);return;}
 emergencyReportState('กำลังอ่านผลตรวจโคมไฟฟ้าแสงสว่างฉุกเฉิน…');
 let timer;
 try{
  const url=new URL(configured);
  if(url.protocol!=='https:'||url.hostname!=='script.google.com')throw Error('ปลายทางการอ่านข้อมูลไม่ถูกต้อง');
  url.searchParams.set('action','get_emergency_light_report');
  url.searchParams.set('month',month);
  if(scope)url.searchParams.set('scope',scope);
  const controller=new AbortController();
  timer=setTimeout(()=>controller.abort(),8000);
  const response=await fetch(url,{credentials:'include',cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('อ่านข้อมูลไม่สำเร็จ');
  const data=await response.json();
  if(!isCurrent())return;
  if(data.status==='unauthorized'){emergencyReportState('บัญชีนี้ยังไม่ได้รับสิทธิ์อ่านผลตรวจโคมไฟฟ้าแสงสว่างฉุกเฉิน');return;}
  if(data.status!=='success'||!Array.isArray(data.rows))throw Error('รูปแบบข้อมูลไม่ถูกต้อง');
  renderEmergencyLightRows(data.rows);
 }catch(error){if(isCurrent())emergencyReportState('ยังอ่านผลตรวจโคมไฟฟ้าแสงสว่างฉุกเฉินไม่ได้ โปรดตรวจการเชื่อมต่อและสิทธิ์ ไม่ใช่สถานะไม่มีผลตรวจ');}
 finally{clearTimeout(timer);}
}