(() => {
 'use strict';
 const $=id=>document.getElementById(id), allowedStatus=['ปกติ','ไม่ปกติ'];
 const panels=['inventory','adding','inspecting'].map($);
 const unavailable='ยังไม่ได้เชื่อมระบบทะเบียนสำหรับผู้ได้รับอนุญาต';
 const denied='บัญชีนี้ไม่ได้รับสิทธิ์ในหน่วยงานนี้';
 let dept='', slug='', selected=null, generation=0, busy=false, ready=false;
 const pending=new Map();
 const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 let historyRows=null,historyGeneration=0,historyAssetId=null,historyOpener=null;
 const state=()=>$('notice');const msg=text=>{const list=!$('inventory').hidden;state().textContent=text;state().className=list&&text?'a11y-status':'';$('inventory-notice').textContent=list?text:'';};
 const pick=id=>{generation++;panels.forEach(p=>{p.hidden=p.id!==id;});msg('');};
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 const createButton=(label,cb,cls)=>{const b=node('button',label,cls);b.type='button';b.addEventListener('click',cb);return b;};
 function outputError(code,fallback){
  if(code==='unauthorized'||code==='ACCESS_DENIED')return denied;
  if(code==='duplicate_asset'||code==='duplicate_asset_no'||code==='ASSET_EXISTS')return 'ตัวที่นี้มีในทะเบียนของหน่วยงานแล้ว';
  if(code==='invalid'||code==='validation'||code==='INVALID_INPUT')return 'ข้อมูลไม่ถูกต้อง กรุณาตรวจข้อมูลแล้วลองใหม่';
  if(code==='invalid_asset')return 'ไม่พบโคมไฟตัวนี้ในทะเบียนของหน่วยงาน';
  if(code==='request_conflict')return 'รหัสคำขอไม่ตรงกับข้อมูล กรุณาตรวจประวัติก่อนส่งใหม่';
  if(code==='busy')return 'ระบบกำลังบันทึกรายการอื่น กรุณาลองอีกครั้ง';
  if(code==='unavailable'||code==='source_error'||code==='SCHEMA_NOT_READY')return 'ยังอ่านหรือบันทึกข้อมูลไม่ได้ กรุณาตรวจการตั้งค่าฐานข้อมูล';
  return fallback;
 }
 const iso=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(new Date(x+'T00:00:00Z').getTime())&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(({type,value})=>[type,value]));return [p.year,p.month,p.day].join('-');};
 const shortDate=new Intl.DateTimeFormat('th-TH-u-ca-buddhist-nu-latn',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'});
 const str=(v,n)=>typeof v==='string'&&v.trim()&&v.length<=n;
 const assetOK=r=>r&&str(r.assetId,120)&&str(r.assetNo,40)&&str(r.location,200);
 const recordOK=r=>r&&iso(r.inspectionDate)&&allowedStatus.includes(r.testStatus)&&allowedStatus.includes(r.batteryStatus);
 const transport=window.FireLightTransport;
 const demo=transport.isLocal;
 let callBackend=null;
 function rpc(name,...args){
  if(!callBackend)return Promise.reject(new Error(unavailable));
  return callBackend(name,args);
 }
 function newId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  if(!globalThis.crypto?.getRandomValues)throw new Error('เบราว์เซอร์นี้ไม่รองรับการบันทึกแบบปลอดภัย');
  const a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
  const s=Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
 }
 function attempt(kind,data){const key=kind+'|'+JSON.stringify(data);if(!pending.has(key))pending.set(key,newId());return {key,id:pending.get(key)};}
 function formBusy(form,on){busy=on;form.querySelectorAll('button,input,textarea').forEach(el=>{el.disabled=on;});}
 function setReady(on){ready=on;$('add').disabled=!on;}
 function showRows(items){
  const fragment=document.createDocumentFragment();
  for(const asset of items){
   const card=node('article','','asset-card');
   card.append(node('p','ตัวที่ '+asset.assetNo),node('p','จุดติดตั้ง '+asset.location));
   const buttons=node('div','','row-actions');
   buttons.append(createButton('ประวัติการตรวจ',e=>openHistory(asset,e.currentTarget)),createButton('ตรวจ',()=>openInspect(asset),'inspect-action'));
   card.append(buttons);fragment.append(card);
  }
  $('items').replaceChildren(fragment);
 }
 async function load(success){
  if(!dept||busy)return;
  selected=null;pick('inventory');const n=generation;setReady(false);$('items').replaceChildren();msg('กำลังโหลดทะเบียน…');
  try{
   const data=await rpc('listEmergencyLightAssets',dept);
   if(n!==generation)return;
   if(data?.status!=='success'){msg(outputError(data?.code??data?.status,'ยังโหลดรายการไม่ได้'));return;}
   if(!Array.isArray(data.items)||!data.items.every(assetOK)){msg('ยังโหลดรายการไม่ได้เนื่องจากรูปแบบข้อมูลไม่ตรง');return;}
   showRows(data.items);setReady(true);msg(success||(!data.items.length?'ยังไม่มีรายการในหน่วยงานนี้':'พบ '+data.items.length+' รายการ'));
  }catch(e){if(n===generation)msg(e.message||'ยังโหลดทะเบียนไม่ได้');}
 }
 function openAdd(){if(!ready||busy)return;selected=null;$('add-form').reset();pick('adding');$('number').focus();}
 const inspectorMemory=new Map();
 const inspectorKey=()=>slug?'oppe.emergency-light.inspector.'+(demo?'demo':'private')+'.v1.'+slug:null;
 const lastInspector=()=>{const key=inspectorKey();if(!key)return '';if(inspectorMemory.has(key))return inspectorMemory.get(key);try{const name=(demo?window.localStorage:window.sessionStorage).getItem(key);return str(name,150)?name.trim():'';}catch(_){return '';}};
 function recallInspector(){const name=lastInspector();$('inspectorName').value=name;$('clear-inspector').hidden=!name;}
 function rememberInspector(name){const key=inspectorKey();if(!key||!str(name,150))return;const value=name.trim();inspectorMemory.set(key,value);try{(demo?window.localStorage:window.sessionStorage).setItem(key,value);}catch(_){}}
 $('clear-inspector').addEventListener('click',()=>{
  const key=inspectorKey();if(key){inspectorMemory.set(key,'');try{(demo?window.localStorage:window.sessionStorage).removeItem(key);}catch(_){}}
  $('inspectorName').value='';$('clear-inspector').hidden=true;$('inspectorName').focus();
 });
 function openInspect(asset){
  if(!ready||busy)return;selected=asset;const f=$('inspect-form');f.reset();pick('inspecting');
  $('targetNumber').value=asset.assetNo;$('targetLocation').value=asset.location;$('inspectionDate').value=$('inspectionDate').max=today();
  f.elements.testStatus.value=f.elements.batteryStatus.value='ปกติ';recallInspector();
 }
 const historyDialog=$('history');
 function historyMsg(content,isError=false){const el=$('history-status');el.textContent=content;el.className=isError?'history-error':'';}
 function historyYear(year){
  if(!historyRows||!Number.isInteger(year))return;
  const f=document.createDocumentFragment(), details=document.createDocumentFragment(), groups=months.map(()=>[]);
  for(const row of historyRows){if(Number(row.inspectionDate.slice(0,4))===year)groups[Number(row.inspectionDate.slice(5,7))-1].push(row);}
  const status=(v)=>{const td=node('td','','status-cell '+(v==='ปกติ'?'is-normal':'is-abnormal'));const sign=node('span',v==='ปกติ'?'✓':'✗');sign.setAttribute('aria-hidden','true');td.append(sign,node('span',v,'a11y-status'));return td;};
  let resultCount=0;
  groups.forEach((entries,i)=>{
   const month=node('th',months[i]+' '+String(year+543).slice(-2));month.scope='row';
   if(!entries.length){
    const tr=node('tr','','empty');tr.append(month);
    for(let j=0;j<4;j++)tr.append(node('td','-'));
    f.append(tr);return;
   }
   entries.sort((a,b)=>b.inspectionDate.localeCompare(a.inspectionDate));const r=entries[0];
   const ok=r.testStatus==='ปกติ'&&r.batteryStatus==='ปกติ', tr=node('tr','',ok?'passed':'anomaly');
   const label=node('td');label.append(node('span',ok?'ใช้งานได้':'ไม่ผ่าน','history-badge '+(ok?'pass':'fail')));
   const inspector=node('td',typeof r.inspectorName==='string'&&r.inspectorName?r.inspectorName:'-','inspector-cell');inspector.title=inspector.textContent;
   tr.append(month,status(r.testStatus),status(r.batteryStatus),label,inspector);f.append(tr);
   entries.forEach(e=>{
    resultCount++;
    const text=shortDate.format(new Date(e.inspectionDate+'T00:00:00Z'))+' · ทดสอบ: '+e.testStatus+' · แบตเตอรี่: '+e.batteryStatus+
      (e.inspectorName?' · ผู้ตรวจ: '+e.inspectorName:'')+(e.note?' · หมายเหตุ: '+e.note:'');
    details.append(node('li',text));
   });
  });
  $('history-rows').replaceChildren(f);$('history-detail-rows').replaceChildren(details);
  $('history-details').open=false;$('history-details').hidden=!resultCount;
  $('history-detail-toggle').textContent='ผลตรวจทั้งหมด ('+resultCount+')';
  historyMsg(resultCount?'':'ไม่มีผลตรวจในปี พ.ศ. '+(year+543));
 }
 async function openHistory(asset,opener){
  if(!ready||busy)return;
  const n=++historyGeneration;historyAssetId=asset.assetId;historyOpener=opener;historyRows=null;
  $('history-controls').hidden=$('history-table').hidden=$('history-details').hidden=true;
  $('history-rows').replaceChildren();$('history-year').replaceChildren();$('history-detail-rows').replaceChildren();
  $('history-target').textContent='ตัวที่ '+asset.assetNo;historyMsg('');$('history-wait').hidden=false;
  if(!historyDialog.open)historyDialog.showModal();
  $('history-close').focus();
  try{
   const data=await rpc('listEmergencyLightAssetHistory',dept,asset.assetId);
   if(n!==historyGeneration||historyAssetId!==asset.assetId||!historyDialog.open)return;
   $('history-wait').hidden=true;
   if(data?.status!=='success'){historyMsg(outputError(data?.code??data?.status,'เกิดข้อผิดพลาดในการดึงข้อมูล'),true);return;}
   if(!Array.isArray(data.rows)||!data.rows.every(recordOK)){historyMsg('ยังอ่านประวัติไม่ได้เนื่องจากรูปแบบข้อมูลไม่ตรง',true);return;}
   historyRows=data.rows;
   const currentYear=Number(today().slice(0,4)),years=new Set([currentYear,...historyRows.map(r=>Number(r.inspectionDate.slice(0,4)))]);
   const select=$('history-year');for(const yr of [...years].sort((a,b)=>b-a)){const opt=node('option',String(yr+543));opt.value=String(yr);select.append(opt);}
   select.value=String(currentYear);$('history-controls').hidden=(years.size<=1);
   $('history-table').hidden=false;historyYear(currentYear);
  }catch(e){if(n===historyGeneration&&historyDialog.open){$('history-wait').hidden=true;historyMsg(e.message||'เกิดข้อผิดพลาดในการดึงข้อมูล',true);}}
 }
 function closeHistory(){
  historyGeneration++;historyAssetId=null;historyRows=null;
  const opener=historyOpener;historyOpener=null;
  if(historyDialog.open)historyDialog.close();
  if(opener)opener.focus();
 }
 $('history-close').addEventListener('click',closeHistory);
 historyDialog.addEventListener('cancel',e=>{e.preventDefault();closeHistory();});
 $('history-year').addEventListener('change',e=>historyYear(Number(e.currentTarget.value)));
 async function save(form,kind,name,data){
  if(busy)return;
  let done=false;try{
   const {id,key}=attempt(kind,data);formBusy(form,true);msg('กำลังบันทึก…');
   const resp=await rpc(name,dept,data,id);
   if(resp?.status!=='success'){msg(outputError(resp?.code??resp?.status,'ยังไม่ได้ยืนยันการบันทึก'));return;}
   if(resp.requestId!==id){msg('ยังไม่ได้ยืนยันการบันทึก กรุณาตรวจรายการก่อนส่งซ้ำ');return;}
   pending.delete(key);done=true;
   if(kind==='inspect')rememberInspector(data.inspectorName);
  }catch(e){msg(e.message||'ยังไม่ได้ยืนยันการบันทึก');}
  finally{formBusy(form,false);}
  if(done)load(kind==='add'?'เพิ่มรายการแล้ว':'บันทึกผลตรวจแล้ว');
 }
 $('add-form').addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;if(!ready||busy||!f.reportValidity())return;
  const assetNo=$('number').value.trim(),location=$('location').value.trim();
  if(!str(assetNo,40)||!str(location,200)){msg('กรุณากรอกตัวที่และจุดติดตั้ง');return;}
  save(f,'add','addEmergencyLightAsset',{assetNo,location});
 });
 $('inspect-form').addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;$('inspectionDate').max=today();
  if(!ready||busy||!selected||!f.reportValidity())return;
  const inspectionDate=$('inspectionDate').value,testStatus=f.elements.testStatus.value,batteryStatus=f.elements.batteryStatus.value,inspectorName=$('inspectorName').value.trim(),note=$('inspectionNote').value.trim();
  if(!iso(inspectionDate)||inspectionDate>today()||!allowedStatus.includes(testStatus)||!allowedStatus.includes(batteryStatus)||!str(inspectorName,150)){msg('กรุณากรอกวันที่ ผลทดสอบ แบตเตอรี่และผู้ตรวจสอบ');return;}
  save(f,'inspect','inspectEmergencyLightAsset',{assetId:selected.assetId,inspectionDate,testStatus,batteryStatus,inspectorName,note});
 });
 $('add').addEventListener('click',openAdd);
 document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>load()));
 function start(){
  const vals=new URLSearchParams(window.location.search).getAll('dept');
  const safe=vals.length===1?vals[0]:vals.length===0&&demo?'traffic':null;
  if(!safe||!Object.hasOwn(ALARM_DEPTS,safe)){$('inventory').hidden=true;msg('ไม่พบหน่วยงาน กรุณากลับไปเลือกหน่วยงานจากหน้าหลัก');return;}
  slug=safe;dept=ALARM_DEPTS[slug];$('department').textContent=dept;
  $('list-back').href='inspection-choice.html?dept='+encodeURIComponent(slug);
  callBackend=demo?window.FireLightDemo.create(slug):transport.create(slug);
  load();
 }
 setReady(false);
 start();
})();
