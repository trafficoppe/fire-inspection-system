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
 const checks=['checkBody','checkPressure','checkHose','checkPin','checkLever','checkLabel','checkInstall','checkBase'];
 const txt=v=>String(v??'').trim(),key=v=>{const s=txt(v);return !s||s==='-'||s.toLowerCase()==='null'?'':s;};
 let state=null,running=false;
 const refresh=()=>{button.disabled=!state?.rows.length||running;};
 function setInventory(rows){
  state=Array.isArray(rows)?{rows:rows.slice(),department:DEPT_NAME}:null;
  refresh();
 }
 async function fetchTags(rows,department,year,canContinue){
  const tags=Array(rows.length);
  let next=0, stopped=false;
  await Promise.all(Array.from({length:Math.min(rows.length,4)},async()=>{
   while(!stopped&&next<rows.length){
    if(!canContinue())throw Error('stale inventory');
    const i=next++,asset=rows[i],code=assetOf(asset);
    const uncertain=!!asset._ambiguousAsset||!code||key(asset['หน่วยงาน'])!==department;
    if(uncertain){tags[i]={asset,months:new Map(),uncertain,invalidDate:false};continue;}
    try{
     const {years,invalidDate}=selectTankMonths(await readTankHistory(code,department),year);
     tags[i]={asset,months:years.get(year)||new Map(),uncertain,invalidDate};
    }catch(e){stopped=true;throw e;}
   }
  }));
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
  const ink='#15242d';
  ctx.fillStyle=ctx.strokeStyle=ink;ctx.lineWidth=.65;ctx.textBaseline='middle';
  const write=(v,x,y,size=15,maxWidth=530,align='center')=>{ctx.font=size+'px FireTagSarabun';ctx.textAlign=align;ctx.fillText(txt(v),x,y,maxWidth);};
  const line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();};
  const drawMark=(ok,x,y)=>{
   ctx.save();
   ctx.strokeStyle=ink;ctx.lineWidth=1.05;ctx.lineCap='round';ctx.lineJoin='round';
   ctx.beginPath();
   if(ok){
    ctx.moveTo(x-3.45,y+.15);ctx.lineTo(x-.95,y+2.65);ctx.lineTo(x+3.45,y-2.65);
   }else{
    ctx.moveTo(x-2.65,y-2.65);ctx.lineTo(x+2.65,y+2.65);
    ctx.moveTo(x+2.65,y-2.65);ctx.lineTo(x-2.65,y+2.65);
   }
   ctx.stroke();ctx.restore();
  };
  ctx.drawImage(logo,(595.28-60)/2,25,60,60);
  write('แบบฟอร์มตรวจสอบเครื่องดับเพลิง',297.64,99,22);
  write('(Fire Extinguisher Portable Check List Form)',297.64,121,17);
  write(department+'  |  ปี พ.ศ. '+(year+543),297.64,142,16);
  const tank=tag.asset,x=[25,88,127,166,205,244,283,322,361,400,460,570.28];
  const left=x[0],right=x.at(-1),width=right-left;
  const start=176,meta2=198,head=220,head2=240,body=269,rh=23,end=body+12*rh,split=286;
  const meta=(label,value,a,b,y)=>write(label+': '+(key(value)||''),a+5,y,15,b-a-10,'left');
  ctx.strokeRect(left,start,width,end-start);
  [meta2,head,body].forEach(y=>line(left,y,right,y));
  line(split,start,split,head);line(144,meta2,144,head);
  [1,9,10].forEach(i=>line(x[i],head,x[i],end));
  line(x[1],head2,x[9],head2);
  x.slice(2,9).forEach(n=>line(n,head2,n,end));
  for(let i=1;i<12;i++)line(left,body+i*rh,right,body+i*rh);
  meta('รหัสเครื่อง (Code No.)',key(tank['หมายเลขครุภัณฑ์'])||key(tank['เลขที่ถัง']),left,split,(start+meta2)/2);
  meta('สถานที่ (Location)',tank['สถานที่ติดตั้ง'],split,right,(start+meta2)/2);
  meta('ชั้น (Floor)',tank['ชั้น'],left,144,(meta2+head)/2);
  meta('โซน (Zone)',tank['โซน'],144,split,(meta2+head)/2);
  meta('ชนิดถังดับเพลิง (Fire Extinguisher Type)',tank['ชนิด'],split,right,(meta2+head)/2);
  const mid=i=>(x[i]+x[i+1])/2;
  write('ด/ป',mid(0),(head+body)/2,17);
  write('รายละเอียดการตรวจสอบ',(x[1]+x[9])/2,(head+head2)/2,17);
  write('สถานะ',mid(9),(head+body)/2,17);
  write('ผู้ตรวจ',mid(10),(head+body)/2,17);
  ['ถัง','เกจ์','สาย','สลัก','บีบ','ป้าย','จุด','ฐาน'].forEach((v,i)=>write(v,mid(i+1),(head2+body)/2,16,x[i+2]-x[i+1]-5));
  fireMonthLabels.forEach((_,i)=>{
   const y=body+i*rh+rh/2,m=tag.months.get(i);
   write(fireMonthText(i,year),mid(0),y,16,69);
   if(!m){for(let j=1;j<=10;j++)write('-',mid(j),y);return;}
   checks.forEach((n,j)=>drawMark(String(m.log[n]??'').trim()==='ปกติ',mid(j+1),y));
   write(m.log.finalStatus==='ปกติ'?'ใช้งานได้':'ชำรุด',mid(9),y,16,x[10]-x[9]-6);
   write(m.log.inspectorName,mid(10),y,16,x[11]-x[10]-8);
  });
  let note='';
  if(tag.uncertain)note='ยังยืนยันการจับคู่ถังกับผลตรวจไม่ได้ จึงไม่แสดงผลตรวจในตาราง';
  else if(tag.invalidDate)note='ผลตรวจบางรายการมีวันที่ไม่ชัดเจน จึงเว้นช่องที่ยืนยันไม่ได้';
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
 async function download(recordKey=null,cardButton=null){
  if(running)return;
  if(!state?.rows.length){message.textContent='กรุณารอให้ทะเบียนถังโหลดเสร็จก่อนดาวน์โหลด';return;}
  const selected=state,year=Number(picker.value)-543;
  const matches=recordKey===null?[]:selected.rows.map((row,i)=>row._recordKey===recordKey?i:-1).filter(i=>i>=0);
  if(recordKey!==null&&(typeof recordKey!=='string'||!recordKey||matches.length!==1)){
   message.textContent='ยืนยันถังที่เลือกไม่ได้ กรุณาเปิดรายการใหม่';return;
  }
  if(!picker.reportValidity()||!Number.isInteger(year)||year<1957||year>now){message.textContent='กรุณาระบุปี พ.ศ. ให้ถูกต้อง';return;}
  running=true;picker.disabled=true;refresh();message.textContent='กำลังอ่านผลตรวจถังดับเพลิง…';
  if(cardButton){cardButton.disabled=true;cardButton.textContent='กำลังโหลด…';}
  try{
   const chosen=recordKey===null?selected.rows:[selected.rows[matches[0]]];
   const tags=await fetchTags(chosen,selected.department,year,()=>state===selected),pages=[];
   const warnings=tags.filter(tag=>tag.uncertain||tag.invalidDate).length;
   for(const tag of tags){
    if(state!==selected){message.textContent='ทะเบียนเปลี่ยน กรุณากดดาวน์โหลดใหม่';return;}
    message.textContent='กำลังสร้างแท็ก '+(pages.length+1)+'/'+tags.length+' ถัง…';
    pages.push(await draw(tag,selected.department,year));
   }
   if(state!==selected){message.textContent='ทะเบียนเปลี่ยน กรุณากดดาวน์โหลดใหม่';return;}
   const safePart=value=>value.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,100);
   const target=tags[0].asset;
   const label=recordKey===null?'':'-ถัง-'+safePart(key(target['หมายเลขครุภัณฑ์'])||key(target['เลขที่ถัง'])||String(matches[0]+1));
   const safe=safePart(selected.department)+label,url=URL.createObjectURL(pdfBlob(pages));
   const a=document.createElement('a');a.href=url;a.download='แท็กถังดับเพลิง-'+safe+'-พ.ศ.'+(year+543)+'.pdf';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   message.textContent='จัดทำ PDF ครบ '+tags.length+' ถังแล้ว'+(warnings?' มี '+warnings+' ถังที่ระบุข้อควรตรวจสอบไว้ใน PDF':'');
  }catch(_){message.textContent='อ่านประวัติหรือสร้าง PDF ไม่สำเร็จ ยังไม่มีไฟล์ถูกดาวน์โหลด กรุณาลองใหม่';}
  finally{
   running=false;picker.disabled=false;refresh();
   if(cardButton){cardButton.disabled=false;cardButton.textContent='PDF';}
  }
 }
 button.addEventListener('click',()=>download());
 window.FireTankTags={setInventory,downloadOne:(recordKey,cardButton)=>download(recordKey,cardButton)};
})();
