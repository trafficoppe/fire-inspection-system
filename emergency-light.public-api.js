(() => {
 'use strict';
 const PAGE_HOST='https://trafficoppe.github.io';
 const PAGE_PATH='/fire-inspection-system/';
 const API='fire-light-public-v1';
 const page=window.location;
 const local=page.protocol==='file:'||(['http:','https:'].includes(page.protocol)&&['localhost','127.0.0.1','[::1]'].includes(page.hostname));
 const getMethods=new Map([
  ['listEmergencyLightAssets','emergency_light_list_public'],
  ['listEmergencyLightAssetHistory','emergency_light_history_public']
 ]);
 const postMethods=new Map([
  ['addEmergencyLightAsset','emergency_light_add_public'],
  ['inspectEmergencyLightAsset','emergency_light_inspect_public']
 ]);
 const notAvailable='ยังเชื่อมระบบทะเบียนไม่ได้ กรุณาลองใหม่อีกครั้ง';
 const readError='ยังโหลดข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง';
 const writeError='ยังไม่ได้รับคำยืนยันการบันทึก กรุณาตรวจรายการก่อนส่งซ้ำ';
 const approved=(slug)=>typeof ALARM_DEPTS==='object'&&Object.hasOwn(ALARM_DEPTS,slug);
 const sameEndpoint=url=>typeof url==='string'&&/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);
 const trustedResponse=/^https:\/\/(?:script\.google\.com|script\.googleusercontent\.com)\//;
 const isRecord=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const pick=(o,keys)=>isRecord(o)?Object.fromEntries(keys.map(k=>[k,o[k]])):null;
 async function request(url,options,ms,errorText){
  const controller=new AbortController();let timer;
  try{
   return await Promise.race([
    (async()=>{
     const response=await fetch(url, {...options,signal:controller.signal,mode:'cors',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer',cache:'no-store'});
     if(!response.ok||response.type==='opaque'||response.type==='opaqueredirect'||(response.url&&!trustedResponse.test(response.url)))throw Error(errorText);
     const result=await response.json();
     if(!isRecord(result)||result.api!==API||typeof result.status!=='string')throw Error(errorText);
     return result;
    })(),
    new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error(errorText));},ms);})
   ]);
  }catch(_){throw Error(errorText);}finally{clearTimeout(timer);}
 }
 function create(slug){
  const address=typeof CONFIG==='object'?CONFIG.GAS_URL:null;
  if(local||page.origin!==PAGE_HOST||page.pathname!==PAGE_PATH+'emergency-light.html'||window.top!==window||!approved(slug)||!sameEndpoint(address)){
   return async()=>{throw Error(notAvailable);};
  }
  return async(method,args)=>{
   const write=postMethods.has(method), action=postMethods.get(method)||getMethods.get(method);
   const history=method==='listEmergencyLightAssetHistory';
   const count=write?3:history?2:1;
   if(!action||!Array.isArray(args)||args.length!==count||args[0]!==ALARM_DEPTS[slug])throw Error('ไม่รองรับคำขอนี้');
   if(write){
    const payload=args[1],requestId=args[2];
    if(!isRecord(payload)||typeof requestId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9-]{15,79}$/.test(requestId))throw Error('ข้อมูลไม่ถูกต้อง กรุณาตรวจข้อมูลแล้วลองใหม่');
    const result=await request(address,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action,dept:slug,requestId,payload})},25000,writeError);
    if(result.status!=='success')return {status:result.status};
    if(result.requestId!==requestId)throw Error(writeError);
    if(method==='inspectEmergencyLightAsset'&&result.assetId!==payload.assetId)throw Error(writeError);
    return {status:'success',requestId,assetId:result.assetId};
   }
   const url=new URL(address);url.searchParams.set('action',action);url.searchParams.set('dept',slug);
   if(history){if(typeof args[1]!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(args[1]))throw Error('ไม่พบโคมไฟตัวนี้ในทะเบียนของหน่วยงาน');url.searchParams.set('assetId',args[1]);}
   const result=await request(url.href,{method:'GET'},10000,readError);
   if(result.status!=='success')return {status:result.status};
   const key=history?'rows':'items',fields=history?['inspectionDate','testStatus','batteryStatus']:['assetId','assetNo','location'];
   if(!Array.isArray(result[key]))throw Error(readError);
   return {status:'success',[key]:result[key].map(row=>pick(row,fields))};
  };
 }
 window.FireLightPublicApi=Object.freeze({create,isLocal:local});
})();
