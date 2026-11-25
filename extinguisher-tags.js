(() => {
 'use strict';
 const ascii=value=>new TextEncoder().encode(value);
 function pdfBlob(pages){
  const chunks=[], offsets=[0];let length=0;
  const add=value=>{const bytes=typeof value==='string'?ascii(value):value;chunks.push(bytes);length+=bytes.byteLength;};
  const obj=(id,...parts)=>{offsets[id]=length;add(id+' 0 obj\n');parts.forEach(add);add('\nendobj\n');};
  add('%PDF-1.4\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  const pageIds=pages.map((_,i)=>3+i*3);
  obj(2,'<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+pages.length+' >>');
  for(const [i,{jpeg,width,height}] of pages.entries()){
   const id=pageIds[i];
   obj(id,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 '+(id+1)+' 0 R >> >> /Contents '+(id+2)+' 0 R >>');
   obj(id+1,'<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.byteLength+' >>\nstream\n',jpeg,'\nendstream');
   const stream='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
   obj(id+2,'<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
  }
  const xref=length,total=offsets.length;
  add('xref\n0 '+total+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+total+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(chunks,{type:'application/pdf'});
 }
 const $=id=>document.getElementById(id), button=$('fire-tags-pdf'),picker=$('fire-tags-year'),message=$('fire-tags-status');
 const now=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Bangkok',year:'numeric'}).format(new Date()));
 picker.value=picker.max=now+543;
 const month=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 const checks=['สภาพถัง','แรงดัน','สายฉีด','สลักและซีล','คันบีบ','ป้ายแนะนำ','ตำแหน่งติดตั้ง','ฐาน/ที่แขวน'];
 const txt=v=>String(v??'').trim(),key=v=>{const s=txt(v);return !s||s==='-'||s.toLowerCase()==='null'?'':s;};
 let state=null,running=false;
 const refresh=()=>{button.disabled=!state?.rows.length||running;};
 function setInventory(rows){
  state=Array.isArray(rows)?{rows:rows.slice(),department:DEPT_NAME}:null;
  refresh();
 }
 function assign(inv,logs,department,year){
  const canonical=new Map(),alias=new Map(),add=(m,k,i)=>{if(!k)return;if(!m.has(k))m.set(k,new Set());m.get(k).add(i);};
  const tags=inv.map((asset,i)=>{
   const code=key(asset['หมายเลขครุภัณฑ์']),n=key(asset['เลขที่ถัง']);
   add(canonical,code||n,i);add(alias,code,i);add(alias,n,i);
   return {asset,months:Array(12).fill(null),uncertain:!!asset._ambiguousAsset,invalidDate:false};
  });
  for(const log of logs){
   if(key(log['หน่วยงาน'])!==department)continue;
   const explicit=key(log['รหัสครุภัณฑ์']),code=explicit||key(log['เลขที่ถัง']);
   if(!code)continue;
   const ids=(explicit?canonical:alias).get(code);
   if(!ids?.size)continue;
   const d=FireReport.inspectionDay(log);
   if(d&&d.getFullYear()!==year)continue;
   if(ids.size!==1){for(const idx of ids)tags[idx].uncertain=true;continue;}
   const tag=tags[[...ids][0]];
   if(tag.uncertain)continue;
   if(!d){tag.invalidDate=true;continue;}
   const i=d.getMonth(),prev=tag.months[i],time=d.getTime(),recorded=FireReport.inspectionRecordedTime(log);
   if(!prev||time>prev.time||(time===prev.time&&recorded>prev.recorded))tag.months[i]={time,recorded,d,log,conflict:false};
   else if(time===prev.time&&recorded===prev.recorded&&JSON.stringify(log)!==JSON.stringify(prev.log))prev.conflict=true;
  }
  return tags;
 }
 const logo=new Image();logo.src='report/logo-MU.png';let font;
 async function draw(tag,department,year){
  font??=new FontFace('FireTagSarabun','url(report/fonts/THSarabunNew.ttf)').load().then(f=>document.fonts.add(f)).catch(e=>{font=null;throw e;});
  await Promise.all([font,logo.decode()]);
  const canvas=document.createElement('canvas');canvas.width=1488;canvas.height=2105;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas');
  ctx.scale(2.5,2.5);ctx.fillStyle='#fff';ctx.fillRect(0,0,596,842);ctx.fillStyle=ctx.strokeStyle='#000';ctx.lineWidth=.7;ctx.textBaseline='middle';
  const write=(v,x,y,size=15,maxWidth=530,align='center')=>{ctx.font=size+'px FireTagSarabun';ctx.textAlign=align;ctx.fillText(txt(v),x,y,maxWidth);};
  const line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();};
  const check=v=>{const text=txt(v);return /ชำรุด|ผิดปกติ|ไม่ปกติ|ไม่พร้อม/.test(text)?'ไม่ผ่าน':/^(ปกติ|พร้อมใช้งาน)$/.test(text)?'ผ่าน':text?'ตรวจสอบ':'—';};
  ctx.drawImage(logo,271.5,26,52,52);
  write('ป้ายบันทึกการตรวจถังดับเพลิง',297.5,98,24);
  write(department+'  |  ประจำปี พ.ศ. '+(year+543),297.5,120,17);
  const tank=tag.asset,x=[28,91,132,173,214,255,296,337,378,419,483,567], top=165,body=203,rh=29;
  write('เลขที่ถัง: '+(key(tank['เลขที่ถัง'])||'—')+'  •  รหัสครุภัณฑ์: '+(key(tank['หมายเลขครุภัณฑ์'])||'—'),28,141,16,539,'left');
  write('จุดติดตั้ง: '+(key(tank['สถานที่ติดตั้ง'])||'—'),28,155,16,539,'left');
  ctx.strokeRect(x[0],top,x.at(-1)-x[0],body+12*rh-top);
  x.slice(1,-1).forEach(n=>line(n,top,n,body+12*rh));
  for(let i=0;i<12;i++)line(x[0],body+i*rh,x.at(-1),body+i*rh);
  const mid=i=>(x[i]+x[i+1])/2;
  ['วันตรวจ','ถัง','เกจ','สาย','สลัก','คันบีบ','ป้าย','จุดติดตั้ง','ฐาน','สรุปผล','ผู้ตรวจ'].forEach((v,i)=>write(v,mid(i),184,15,x[i+1]-x[i]-4));
  month.forEach((label,i)=>{
   const y=body+i*rh+rh/2,m=tag.uncertain?null:tag.months[i];
   write(m&&!m.conflict?m.d.getDate()+' '+label+' '+String(year+543).slice(-2):label,mid(0),y,14,59);
   if(!m||m.conflict){if(m?.conflict)write('ตรวจสอบ',mid(9),y,14,59);return;}
   checks.forEach((n,j)=>write(check(m.log[n]),mid(j+1),y,13,37));
   const outcome={ready:'ใช้งานได้',notReady:'ไม่พร้อม',unknown:'ตรวจสอบ'}[FireReport.status(m.log)]||'ตรวจสอบ';
   write(outcome,mid(9),y,15,60);write(m.log['ผู้ตรวจ']||'—',mid(10),y,14,78);
  });
  let note='แสดงผลตรวจล่าสุดที่จับคู่กับทะเบียนได้ในแต่ละเดือน ช่องว่างหมายถึงไม่มีผลตรวจที่ยืนยันได้ในเดือนนั้น';
  if(tag.uncertain)note='ระบุถังจากทะเบียนหรือประวัติไม่ชัดเจน จึงไม่แสดงผลตรวจเพื่อป้องกันการใช้ข้อมูลข้ามถัง';
  else if(tag.invalidDate)note='มีผลตรวจบางแถวที่อ่านวันที่ไม่ได้ จึงไม่สามารถจัดเข้าตารางรายเดือนได้';
  write(note,28,body+12*rh+19,14,535,'left');
  const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!jpeg)throw Error('jpeg');
  return {jpeg:new Uint8Array(await jpeg.arrayBuffer()),width:canvas.width,height:canvas.height};
 }
 async function download(){
  if(running||!state?.rows.length)return;
  const selected=state,year=Number(picker.value)-543;
  if(!picker.reportValidity()||!Number.isInteger(year)||year<1957||year>now){message.textContent='กรุณาระบุปี พ.ศ. ให้ถูกต้อง';return;}
  running=true;picker.disabled=true;refresh();message.textContent='กำลังอ่านผลตรวจถังดับเพลิง…';
  try{
   const logs=await FireSheet.read(INSPECTION_DATA_URL);
   if(!Array.isArray(logs)||(logs.length&&!['หน่วยงาน','วันเวลาที่ตรวจ','เลขที่ถัง','สรุปผล'].every(k=>Object.hasOwn(logs[0],k))))throw Error('columns');
   if(state!==selected){message.textContent='ทะเบียนเปลี่ยน กรุณากดดาวน์โหลดใหม่';return;}
   const tags=assign(selected.rows,logs,selected.department,year),pages=[];
   const warnings=tags.filter(tag=>tag.uncertain||tag.invalidDate||tag.months.some(m=>m?.conflict)).length;
   for(const tag of tags){
    if(state!==selected){message.textContent='ทะเบียนเปลี่ยน กรุณากดดาวน์โหลดใหม่';return;}
    message.textContent='กำลังสร้างแท็ก '+(pages.length+1)+'/'+tags.length+' ถัง…';
    pages.push(await draw(tag,selected.department,year));
   }
   if(state!==selected){message.textContent='ทะเบียนเปลี่ยน กรุณากดดาวน์โหลดใหม่';return;}
   const safe=selected.department.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_'),url=URL.createObjectURL(pdfBlob(pages));
   const a=document.createElement('a');a.href=url;a.download='แท็กถังดับเพลิง-'+safe+'-พ.ศ.'+(year+543)+'.pdf';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   message.textContent='จัดทำ PDF ครบ '+tags.length+' ถังแล้ว'+(warnings?' มี '+warnings+' ถังที่ระบุข้อควรตรวจสอบไว้ใน PDF':'');
  }catch(_){message.textContent='อ่านประวัติหรือสร้าง PDF ไม่สำเร็จ ยังไม่มีไฟล์ถูกดาวน์โหลด กรุณาลองใหม่';}
  finally{running=false;picker.disabled=false;refresh();}
 }
 button.addEventListener('click',download);
 window.FireTankTags={setInventory};
})();
