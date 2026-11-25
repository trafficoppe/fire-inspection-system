(() => {
 'use strict';
 const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 const normal='ปกติ', mark=' | ชั้นที่ติดตั้ง: ';
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
 const logo=new Image();logo.src='report/logo-MU.png';
 let font;
 async function report(asset,department,year,rows){
  if(!asset||!Number.isInteger(year)||!Array.isArray(rows))throw Error('ข้อมูลรายงานไม่ครบ');
  font??=new FontFace('FireLightSarabun','url(report/fonts/THSarabunNew.ttf)').load().then(f=>document.fonts.add(f)).catch(e=>{font=null;throw e;});
  await Promise.all([font,logo.decode()]);
  const canvas=document.createElement('canvas');canvas.width=1785;canvas.height=2526;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('ไม่สามารถสร้าง PDF บนอุปกรณ์นี้');
  ctx.scale(3,3);ctx.fillStyle='#fff';ctx.fillRect(0,0,595,842);
  ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.textBaseline='middle';ctx.lineWidth=.75;
  const write=(value,x,y,size=14,max=480,align='center')=>{
   ctx.font=size+'px FireLightSarabun';ctx.textAlign=align;ctx.fillText(String(value??''),x,y,max);
  };
  const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  const rect=(x,y,w,h)=>ctx.strokeRect(x,y,w,h);
  const check=(x,y)=>{ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x-1,y+4);ctx.lineTo(x+5,y-5);ctx.stroke();};
  ctx.drawImage(logo,269.5,24,56,56);
  write('แบบฟอร์มตรวจสอบโคมไฟฟ้าแสงสว่างฉุกเฉิน',297.5,95,19);
  write('(Emergency Light Check List Form)',297.5,114,15);
  write(department+'  |  ตัวที่ '+asset.assetNo+'  |  ประจำปี พ.ศ. '+(year+543),297.5,135,16);
  const split=asset.location.lastIndexOf(mark),point=split<0?asset.location:asset.location.slice(0,split),floor=split<0?'':asset.location.slice(split+mark.length);
  const x=[65,131,197,263,329,395,461,529], top=152, meta=184, head=210, body=236, height=28, bottom=body+12*height;
  rect(x[0],top,x[7]-x[0],bottom-top);
  [meta,body].forEach(y=>line(x[0],y,x[7],y));line(x[1],head,x[5],head);
  [1,3,6].forEach(i=>line(x[i],meta,x[i],bottom));[2,4].forEach(i=>line(x[i],head,x[i],bottom));line(x[5],top,x[5],bottom);
  for(let i=1;i<12;i++)line(x[0],body+i*height,x[7],body+i*height);
  write('จุดติดตั้ง (Location): '+point,x[0]+5,(top+meta)/2,15,x[5]-x[0]-10,'left');
  write('ชั้น (Floor): '+floor,x[5]+5,(top+meta)/2,15,x[7]-x[5]-10,'left');
  const mid=i=>(x[i]+x[i+1])/2;
  write('วันเดือนปี',mid(0),210,15);write('ทดสอบการทำงาน (Test)',x[2],197,15,125);write('สถานะแบตเตอรี่',x[4],197,15,125);
  write('ผู้ตรวจสอบ',mid(5),210,15);write('หมายเหตุ',mid(6),210,15);
  ['ปกติ','ไม่ปกติ','ปกติ','ไม่ปกติ'].forEach((label,i)=>write(label,mid(i+1),223,15,60));
  const latest=new Map();
  for (const row of rows){
   if(Number(row.inspectionDate.slice(0,4))!==year)continue;
   const month=Number(row.inspectionDate.slice(5,7))-1;
   if(!latest.has(month)||row.inspectionDate>latest.get(month).inspectionDate)latest.set(month,row);
  }
  months.forEach((month,i)=>{
   const row=latest.get(i), y=body+i*height+height/2;
   write(row?Number(row.inspectionDate.slice(8,10))+' '+month+' '+String(year+543).slice(-2):month,mid(0),y,15,62);
   if(!row)return;
   check(mid(row.testStatus===normal?1:2),y);check(mid(row.batteryStatus===normal?3:4),y);
  });
  const foot=[28,78,255,567], y=[602,627,654,697];
  rect(foot[0],y[0],foot[3]-foot[0],y[3]-y[0]);foot.slice(1,3).forEach(v=>line(v,y[0],v,y[3]));y.slice(1,3).forEach(v=>line(foot[0],v,foot[3],v));
  ['ลำดับ','รายละเอียดการตรวจสอบ','วิธีปฏิบัติและข้อสังเกต'].forEach((h,i)=>write(h,(foot[i]+foot[i+1])/2,614.5,15));
  write('1',53,640,15);write('2',53,675,15);
  write('ตรวจสอบการทำงานกรณีฉุกเฉิน',83,640,15,166,'left');write('ตรวจสอบสถานะแบตเตอรี่',83,675,15,166,'left');
  write('กดสวิตช์ “TEST” สังเกตว่าหลอดไฟฉุกเฉินติดสว่างหรือไม่',260,640,15,301,'left');
  write('สังเกตไฟแสดงสถานะช่อง BATT หากเป็นไฟสีเขียวแสดงว่าปกติ',260,668,15,301,'left');
  write('หากเป็นสีแดงหรือดับ อาจมีปัญหา',260,684,15,301,'left');
  const jpeg=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.96));
  if(!jpeg)throw Error('ไม่สามารถสร้าง PDF บนอุปกรณ์นี้');
  const safe=String(asset.assetNo).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_');
  return {page:{jpeg:new Uint8Array(await jpeg.arrayBuffer()),width:canvas.width,height:canvas.height},name:'ตรวจไฟฉุกเฉิน-'+safe+'-พ.ศ.'+(year+543)+'.pdf'};
 }
 function savePdf(blob,name){
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 async function download(asset,department,year,rows){
  const {page,name}=await report(asset,department,year,rows);
  savePdf(pdfBlob([page]),name);
 }
 async function downloadAll(entries,department,year,canSave=()=>true){
  if(!Array.isArray(entries)||!entries.length)throw Error('ไม่มีโคมไฟฉุกเฉินในทะเบียน');
  const pages=[];
  for(const {asset,rows} of entries){
   if(!canSave())return false;
   pages.push((await report(asset,department,year,rows)).page);
  }
  if(!canSave())return false;
  const safe=String(department).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_');
  savePdf(pdfBlob(pages),'ตรวจไฟฉุกเฉิน-ทุกโคม-'+safe+'-พ.ศ.'+(year+543)+'.pdf');
  return true;
 }
 window.FireLightPdf={download,downloadAll};
})();

