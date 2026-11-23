 'use strict';
const alarmDept=new URLSearchParams(location.search).get('dept'),alarmForm=document.getElementById('alarmForm'),alarmMessage=document.getElementById('message');
let alarmBusy=false,alarmPending=null;
function alarmRequestId(){return crypto.randomUUID();}
if(!Object.hasOwn(ALARM_DEPTS,alarmDept)){alarmForm.hidden=true;alarmMessage.textContent='ไม่พบหน่วยงาน';}else{
document.getElementById('department').textContent=ALARM_DEPTS[alarmDept];document.getElementById('back').href='inspection-choice.html?dept='+encodeURIComponent(alarmDept);document.getElementById('alarmReport').href='report/index.html?dept='+encodeURIComponent(alarmDept);
function syncAlarmNotes(){
 ALARM_CHECKS.forEach((_,i)=>{const input=document.getElementById('alarmNote'+i),box=document.getElementById('alarmNoteBox'+i),abnormal=alarmForm.elements['alarmCheck'+i].value==='ไม่ปกติ';box.hidden=!abnormal;input.required=abnormal;input.setCustomValidity(abnormal&&!input.value.trim()?'กรุณาระบุหมายเหตุสำหรับข้อ '+(i+1):'');});
}
ALARM_CHECKS.forEach((name,i)=>{
 const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=(i+1)+'. '+name;group.append(legend);
 const opts=document.createElement('div');opts.className='alarm-options';
 ['ปกติ','ไม่ปกติ'].forEach(value=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='radio';input.name='alarmCheck'+i;input.value=value;input.required=true;input.addEventListener('change',syncAlarmNotes);span.textContent=value;label.append(input,span);opts.append(label);});group.append(opts);
 const box=document.createElement('div');box.id='alarmNoteBox'+i;box.className='alarm-check-note';box.hidden=true;
 const label=document.createElement('label');label.htmlFor='alarmNote'+i;label.textContent='หมายเหตุ';
 const note=document.createElement('textarea');note.id='alarmNote'+i;note.name='alarmNote'+i;note.rows=2;note.maxLength=250;note.addEventListener('input',syncAlarmNotes);box.append(label,note);group.append(box);document.getElementById('checks').append(group);
});
alarmForm.addEventListener('submit',async event=>{event.preventDefault();syncAlarmNotes();if(alarmBusy||!alarmForm.reportValidity())return;
const checks=ALARM_CHECKS.map((_,i)=>alarmForm.elements['alarmCheck'+i].value),inspectorName=document.getElementById('inspectorName').value.trim(),generalNote=document.getElementById('note').value.trim();if(!inspectorName){document.getElementById('inspectorName').focus();return;}
const checkNotes=ALARM_CHECKS.map((_,i)=>checks[i]==='ไม่ปกติ'?document.getElementById('alarmNote'+i).value.trim():'');
const note=checkNotes.map((text,i)=>text?'ข้อ '+(i+1)+' '+ALARM_CHECKS[i]+': '+text:'').filter(Boolean).concat(generalNote?['หมายเหตุเพิ่มเติม: '+generalNote]:[]).join('\n');
const body={action:'alarm_inspection',department:ALARM_DEPTS[alarmDept],inspectorName,checks,checkNotes,note},fingerprint=JSON.stringify(body);if(!alarmPending||alarmPending.fingerprint!==fingerprint)alarmPending={fingerprint,requestId:alarmRequestId()};body.requestId=alarmPending.requestId;
alarmBusy=true;alarmForm.querySelectorAll('input,textarea').forEach(n=>n.disabled=true);const btn=document.getElementById('saveAlarm');btn.disabled=true;btn.querySelector('.loading-ring').hidden=false;alarmMessage.textContent='';try{let timer;const result=await Promise.race([FireSubmit.send(CONFIG.GAS_URL,body),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('ยังยืนยันการบันทึกไม่ได้ กรุณาตรวจรายงานก่อนส่งซ้ำ')),30000);})]).finally(()=>clearTimeout(timer));if(result.requestId!==body.requestId)throw Error('คำตอบไม่ตรงกับรายการที่ส่ง');alarmPending=null;alarmMessage.textContent='บันทึกผลตรวจแล้ว';alarmForm.querySelectorAll('input[type=radio]').forEach(n=>n.checked=false);document.getElementById('note').value='';ALARM_CHECKS.forEach((_,i)=>document.getElementById('alarmNote'+i).value='');syncAlarmNotes();}catch(error){alarmMessage.textContent=error.message;}finally{alarmBusy=false;alarmForm.querySelectorAll('input,textarea').forEach(n=>n.disabled=false);btn.disabled=false;btn.querySelector('.loading-ring').hidden=true;}});
}
