/* A request is confirmed only after a readable success response. Never retry automatically. */
(function(root){
'use strict';
async function send(url,payload){
 let response,data;
 try{
  response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow'});
  if(!response.ok||response.type==='opaque')throw Error('Unreadable response');
  data=await response.json();
 }catch(error){throw Error('ยังตรวจสอบผลบันทึกจากระบบไม่ได้ ข้อมูลอาจถูกบันทึกแล้ว กรุณาตรวจประวัติก่อนส่งซ้ำ');}
 if(!data||data.status!=='success')throw Error(data&&typeof data.message==='string'?data.message:'ระบบยังไม่ยืนยันการบันทึก กรุณาตรวจประวัติก่อนส่งซ้ำ');
 return data;
}
const api={send};root.FireSubmit=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
