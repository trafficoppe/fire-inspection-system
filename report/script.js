'use strict';
let cache=null,run=0,loaded=false;
const deptMap={traffic:'งานจราจรและความปลอดภัย',salaya:'อาคารศาลายา กองกายภาพฯ',mlc:'ศูนย์การเรียนรู้มหิดล',sitthakarn:'มหิดลสิทธาคาร',siriwittaya:'อาคารสิริวิทยา',substation:'สถานีไฟฟ้าย่อยมหิดล',wastewater:'อาคารบำบัดน้ำเสีย'};
const requestedScope=new URLSearchParams(location.search).get('dept')||'';
let initialScope=deptMap[requestedScope]||requestedScope;
const el=id=>document.getElementById(id);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function read(url){return FireSheet.read(url);}
function controls(){el('printButton').disabled=!loaded;}
function clear(){el('combinedSummary').textContent='';el('scopeSummary').textContent='';resetAlarmReport();loaded=false;controls();el('fireExtinguisherTable').tBodies[0].innerHTML='';for(const id of ['sumUnknown','sumUninspected'])el(id).textContent='—';}
const reportPage=document.querySelector('.page');
const reportTemplate=reportPage.innerHTML;
let reportEdited=false,lastRendered=null;
reportPage.addEventListener('input',()=>{reportEdited=true;});
reportPage.addEventListener('paste',event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
function resetManual(){reportPage.innerHTML=reportTemplate;reportEdited=false;}
async function updateReport(force=false){if(reportEdited&&!window.confirm('การเปลี่ยนเดือน หน่วยงาน หรือโหลดใหม่ จะล้างข้อความที่แก้ในรายงาน ต้องการดำเนินการต่อหรือไม่?')){if(lastRendered){el('monthPicker').value=lastRendered.month;el('buildingPicker').value=lastRendered.scope;}return;}const seq=++run;resetManual();clear();el('reportStatus').hidden=true;el('reportStatus').textContent='กำลังโหลดข้อมูล';try{
 if(force||!cache){const [inventory,inspections]=await Promise.all([read(EXTINGUISHER_TOTAL_URL),read(INSPECTION_DATA_URL)]);if(seq!==run)return;if(!inventory.length||!('หน่วยงาน' in inventory[0]))throw Error('หัวทะเบียนไม่ตรง');if(inspections.length&&!('สรุปผล' in inspections[0]))throw Error('หัวผลตรวจไม่ตรง');cache={inventory,inspections};const selected=initialScope||el('buildingPicker').value;initialScope='';el('buildingPicker').innerHTML='<option value="">ทั้งหมด</option><option value="งานสาธารณูปโภคและระบบอาคาร">งานสาธารณูปโภคและระบบอาคาร (รวม 4 อาคาร)</option>'+[...new Set(inventory.map(r=>r['หน่วยงาน']).filter(Boolean))].map(n=>`<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('');if(selected&&selected!==FireReport.utilityScope&&![...new Set(inventory.map(r=>r['หน่วยงาน']).filter(Boolean))].includes(selected)){const option=document.createElement('option');option.value=selected;option.textContent='ไม่พบ: '+selected;option.disabled=true;el('buildingPicker').appendChild(option);}el('buildingPicker').value=selected;}
 if(seq!==run)return;const month=el('monthPicker').value,scope=el('buildingPicker').value,report=FireReport.build(cache.inventory,cache.inspections,month,scope);
 setReportDepartment(scope);setAlarmReportVisibility(scope);let alarmData=null;try{if(scope!==ALARM_DEPTS.traffic){alarmData=await fetchAlarmReport(month,scope);if(seq!==run)return;renderAlarmReport(alarmData,scope);}}catch(alarmError){if(seq!==run)return;el('alarmReportStatus').textContent='ยังอ่านผลตรวจระบบแจ้งเหตุไม่ได้: '+alarmError.message;}
 el('scopeSummary').hidden=!scope;el('combinedSummary').hidden=!!scope;if(!scope)el('combinedSummary').textContent=combinedReportSummary(report,alarmData);
 const monthText=new Date(+month.slice(0,4),+month.slice(5)-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'});
 setReportSigner(scope);
 if(scope)el('scopeSummary').textContent=scopedReportSummary(report,alarmData,scope,monthText);
 el('monthText').textContent=monthText;el('subjectMonthText').textContent=monthText;
 el('fireExtinguisherTable').tBodies[0].innerHTML=report.rows.map(g=>`<tr><td style="text-align:left">${escapeHTML(g.department)}</td><td>${g.missingInventory?'—':g.total}</td><td>${g.missingInventory?'—':g.ready}</td><td>${g.missingInventory?'—':g.notReady}</td></tr>`).join('');
 for(const [id,key] of Object.entries({sumUnknown:'unknown',sumUninspected:'uninspected'}))el(id).textContent=report.totals[key];
 const invalidWarning=report.invalidDates?` • อ่านวันที่ไม่ได้ ${report.invalidDates} รายการในขอบเขตที่เลือก (ไม่ทราบเดือน จึงไม่รวมในยอด)`:'';
 el('reportStatus').textContent=`โหลดข้อมูลแล้ว${invalidWarning}${report.unmatched?` • มีผลตรวจ ${report.unmatched} รายการที่จับคู่ทะเบียนไม่ได้ ไม่รวมในยอด`:''}`;
 el('sourceNote').textContent=`แหล่งข้อมูล: ทะเบียนถังดับเพลิงปัจจุบัน และผลตรวจเดือน${monthText} จากฐานข้อมูลงานจราจร ใช้ผลล่าสุดต่อถังที่จับคู่ได้แน่ชัด ไม่ใช่จำนวนครั้งตรวจ${invalidWarning}${report.unmatched?` • ผลตรวจจับคู่ไม่ได้ ${report.unmatched} รายการ`:''}`;
 document.title=`รายงานถังดับเพลิง_${scope||'รวมทุกอาคาร'}_${month}`;lastRendered={month,scope};loaded=true;controls();
 }catch(error){if(seq!==run)return;clear();el('reportStatus').hidden=false;el('reportStatus').textContent='ไม่สามารถแสดงรายงาน: '+error.message;console.error(error);}}
function printReport(){if(!loaded)return;window.print();}
window.addEventListener('DOMContentLoaded',()=>{el('monthPicker').value=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'2-digit'}).slice(0,7);if(!/^\d{4}-\d{2}$/.test(el('monthPicker').value)){const d=new Date();el('monthPicker').value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}updateReport();});

function setReportDepartment(scope){
 const reportingUnit=['อาคารบำบัดน้ำเสีย','สถานีไฟฟ้าย่อยมหิดล','อาคารสิริวิทยา','อาคารศาลายา กองกายภาพฯ'].includes(scope)?'งานสาธารณูปโภคและระบบอาคาร':scope==='ศูนย์การเรียนรู้มหิดล'?'งานบริหารและพัฒนาระบบ':scope==='มหิดลสิทธาคาร'?'อาคารมหิดลสิทธาคาร':scope;
 el('headerDepartment').textContent=reportingUnit||'งานจราจรและความปลอดภัย';
 el('introDepartment').textContent=reportingUnit||'งานจราจรและความปลอดภัย กองกายภาพและสิ่งแวดล้อม';
 el('senderDepartment').textContent=reportingUnit||'งานจราจรและความปลอดภัย';
 el('introScope').textContent=scope===FireReport.utilityScope?'ภายในอาคารบำบัดน้ำเสีย สถานีไฟฟ้าย่อยมหิดล อาคารสิริวิทยา และอาคารศาลายา':scope?'เฉพาะพื้นที่ของ'+scope:'ภายในอาคารที่อยู่ในความดูแลของกองกายภาพและสิ่งแวดล้อม';
}

function setReportSigner(scope){
 const utility=['งานสาธารณูปโภคและระบบอาคาร','อาคารบำบัดน้ำเสีย','สถานีไฟฟ้าย่อยมหิดล','อาคารสิริวิทยา','อาคารศาลายา กองกายภาพฯ'].includes(scope);
 const administration=['งานบริหารและพัฒนาระบบ','ศูนย์การเรียนรู้มหิดล'].includes(scope);
 const auditorium=['มหิดลสิทธาคาร','อาคารมหิดลสิทธาคาร'].includes(scope);
 el('signerName').textContent=auditorium?'(นายจักรยศนันท์ เตียวตระกูล)':administration?'(นางสาวอรวรรณ ไพรี)':utility?'(ว่าที่ร้อยตรีอัครนันท์ เซี่ยงเห็น)':scope?'(นายพุฒิเศรษฐ์ ตันติเมธิน)':'(นายยุทธภูมิ ญานเพิ่ม)';
 el('signerPosition').textContent=auditorium?'หัวหน้างานบริหารอาคารมหิดลสิทธาคาร':administration?'รักษาการแทนหัวหน้างานบริหารและพัฒนาระบบ':utility?'หัวหน้างานสาธารณูปโภคและระบบอาคาร':scope?'ผู้อำนวยการกองกายภาพและสิ่งแวดล้อม':'หัวหน้างานจราจรและความปลอดภัย';
}
