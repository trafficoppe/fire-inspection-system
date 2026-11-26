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
 const checks=['สภาพถัง','สายฉีด','คันบีบ','สลักและซีล','แรงดัน','น้ำหนัก','สิ่งกีดขวาง'];
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
  ctx.scale(canvas.width/595.28,canvas.height/841.89);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,595.28,841.89);
  ctx.fillStyle=ctx.strokeStyle='#15242d';ctx.lineWidth=.65;ctx.textBaseline='middle';
  const write=(v,x,y,size=15,maxWidth=530,align='center')=>{ctx.font=size+'px FireTagSarabun';ctx.textAlign=align;ctx.fillText(txt(v),x,y,maxWidth);};
  const line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();};
  const check=v=>{const s=key(v);return !s?'':/ชำรุด|ผิดปกติ|ไม่ปกติ|ไม่พร้อม/.test(s)?'ไม่ผ่าน':/^(ปกติ|พร้อมใช้งาน)$/.test(s)?'ผ่าน':s;};
  ctx.drawImage(logo,(595.28-60)/2,25,60,60);
  write('แบบฟอร์มตรวจสอบเครื่องดับเพลิง',297.64,99,22);
  write('(Fire Extinguisher Portable Check List Form)',297.64,121,17);
  write(department+'  |  ปี พ.ศ. '+(year+543),297.64,142,16);
  const tank=tag.asset,x=[25,100,151,202,253,304,355,406,457,570.28];
  const left=x[0],right=x.at(-1),width=right-left;
  const start=176,meta2=198,head=220,head2=240,body=269,rh=23,end=body+12*rh,split=286;
  const meta=(label,value,a,b,y)=>write(label+': '+(key(value)||''),a+5,y,15,b-a-10,'left');
  ctx.strokeRect(left,start,width,end-start);
  [meta2,head,body].forEach(y=>line(left,y,right,y));
  line(split,start,split,head);line(144,meta2,144,head);
  line(x[1],head,x[1],end);line(x[8],head,x[8],end);
  line(x[1],head2,x[8],head2);
  x.slice(2,8).forEach(n=>line(n,head2,n,end));
  for(let i=1;i<12;i++)line(left,body+i*rh,right,body+i*rh);
  meta('รหัสเครื่อง (Code No.)',key(tank['หมายเลขครุภัณฑ์'])||key(tank['เลขที่ถัง']),left,split,(start+meta2)/2);
  meta('สถานที่ (Location)',tank['สถานที่ติดตั้ง'],split,right,(start+meta2)/2);
  meta('ชั้น (Floor)',tank['ชั้น'],left,144,(meta2+head)/2);
  meta('โซน (Zone)',tank['โซน'],144,split,(meta2+head)/2);
  meta('ชนิดถังดับเพลิง (Fire Extinguisher Type)',tank['ชนิด'],split,right,(meta2+head)/2);
  const mid=i=>(x[i]+x[i+1])/2;
  write('ว/ด/ป',mid(0),(head+body)/2,17);
  write('รายละเอียดการตรวจสอบ',(x[1]+x[8])/2,(head+head2)/2,17);
  write('ผู้ตรวจเช็ค',mid(8),(head+body)/2,17);
  ['ตัวถัง','สายฉีด','คันบีบ','เซฟตี้','แรงดัน','น้ำหนัก','สิ่งกีดขวาง'].forEach((v,i)=>write(v,mid(i+1),(head2+body)/2,16,x[i+2]-x[i+1]-5));
  month.forEach((label,i)=>{
   const y=body+i*rh+rh/2,m=tag.uncertain?null:tag.months[i];
   write(m&&!m.conflict?m.d.getDate()+' '+label+' '+(year+543):'… '+label+' …',mid(0),y,16,69);
   if(!m||m.conflict)return;
   checks.forEach((n,j)=>write(check(m.log[n]),mid(j+1),y,15,x[j+2]-x[j+1]-6));
   write(m.log['ผู้ตรวจ'],mid(8),y,16,x[9]-x[8]-8);
  });
  let note='';
  if(tag.uncertain)note='ยังยืนยันการจับคู่ถังกับผลตรวจไม่ได้ จึงไม่แสดงผลตรวจในตาราง';
  else if(tag.invalidDate||tag.months.some(m=>m?.conflict))note='ผลตรวจบางรายการมีวันที่ไม่ชัดเจนหรือข้อมูลขัดกัน จึงเว้นช่องที่ยืนยันไม่ได้';
  if(note)write(note,left,162,15,width,'left');
  const guide=[
   ['ตรวจเช็คตัวถังดับเพลิงและเช็ดทำความสะอาด','ตัวถังดับเพลิงอยู่ในสภาพปกติ ไม่แตกหรือขึ้นสนิม'],
   ['ตรวจเช็คสายฉีดดับเพลิง','สายฉีด กระบอกฉีดติดแน่นหนา ไม่แตกรั่ว'],
   ['ตรวจเช็คคันบีบถังดับเพลิง','คันบีบ รูปทรงจะต้องไม่ผิดไปจากเดิม'],
   ['ตรวจเช็คเซฟตี้หัวดับเพลิง','เซฟตี้หัวถังดับเพลิง มีอุปกรณ์ติดตั้งแน่นหนา ไม่ติดขัด พร้อมใช้งาน'],
   ['ตรวจเช็คแรงดันในถังดับเพลิง','แรงดันในถังอยู่ในช่วงที่กำหนด โดยดูจากเกจ (Gauge)'],
   ['ตรวจเช็คน้ำหนักปริมาณน้ำยาในถัง','น้ำหนักถังจะต้องตรวจสอบโดยการชั่ง น้ำหนักที่ชั่งได้ต้องอยู่ในเกณฑ์']
  ];
  const gy=end+29,gr=26,gx=[left,68,273,right];
  ctx.strokeRect(left,gy,width,gr*(guide.length+1));
  gx.slice(1,-1).forEach(n=>line(n,gy,n,gy+gr*(guide.length+1)));
  ['ลำดับ','รายละเอียดการตรวจสอบ','วิธีปฏิบัติและข้อสังเกต'].forEach((label,i)=>write(label,(gx[i]+gx[i+1])/2,gy+gr/2,17,gx[i+1]-gx[i]-8));
  guide.forEach(([item,method],i)=>{
   const top=gy+gr*(i+1),y=top+gr/2;
   line(left,top,right,top);
   write(i+1,(gx[0]+gx[1])/2,y,16);
   write(item,gx[1]+5,y,16,gx[2]-gx[1]-10,'left');
   write(method,gx[2]+5,y,16,gx[3]-gx[2]-10,'left');
  });
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
