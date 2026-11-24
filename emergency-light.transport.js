(() => {
 'use strict';
 const APP_ORIGIN='https://trafficoppe.github.io';
 const APP_BASE='/OPPE-10-P-04-Fire-Protection-and-Suppression-System-Operation-and-Maintenance/';
 const PROTOCOL='oppe-fire-rpc/v1';
 const METHODS=new Map([
  ['listEmergencyLightAssets',1],['addEmergencyLightAsset',3],
  ['inspectEmergencyLightAsset',3],['listEmergencyLightAssetHistory',2],
  ['getEmergencyLightViewerConfig',0],['getEmergencyLightTable2',1]
 ]);
 const u=window.location;
 const local=u.protocol==='file:'||((u.protocol==='http:'||u.protocol==='https:')&&['localhost','127.0.0.1','[::1]'].includes(u.hostname));
 const unavailable='ยังไม่ได้เชื่อมระบบทะเบียนสำหรับผู้ได้รับอนุญาต';
 const timeoutText='ยังเชื่อมบัญชีมหิดลไม่ได้ กรุณาตรวจว่าลงชื่อเข้าใช้บัญชีที่มีสิทธิ์และลองเปิดใหม่';
 // The list has a single end-to-end budget, including the waiting time before READY.
 const LIST_DEADLINE_MS=8000;
 const listTimeout='ยังดึงทะเบียนไม่ได้ กรุณาตรวจการเชื่อมต่อและลองใหม่';
 const noReceipt='ยังไม่ได้รับคำยืนยัน กรุณาตรวจรายการก่อนส่งซ้ำ';
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 const exact=(data,keys)=>data&&typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).length===keys.length&&keys.every(k=>Object.hasOwn(data,k));
 function create(slug){
  const deny=()=>Promise.reject(new Error(unavailable));
  if(local||u.origin!==APP_ORIGIN||!u.pathname.startsWith(APP_BASE)||window.top!==window||typeof slug!=='string'||!/^[a-z][a-z0-9-]{0,30}$/.test(slug))return deny;
  const address=window.FIRE_LIGHT_RELAY_URL;
  const origin=window.FIRE_LIGHT_RELAY_ORIGIN;
  if(typeof address!=='string'||!/^https:\/\/script\.google\.com\/(?:macros|a\/macros\/mahidol\.ac\.th)\/s\/[A-Za-z0-9_-]+\/exec$/.test(address))return deny;
  if(typeof origin!=='string'||!/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*-script\.googleusercontent\.com$/.test(origin))return deny;
  if(!window.crypto?.getRandomValues)return deny;
  let channel=random();
  const url=new URL(address);
  url.searchParams.set('view','emergency-light-bridge');
  url.searchParams.set('dept',slug);
  url.searchParams.set('channel',channel);
  const iframe=document.createElement('iframe');
  iframe.referrerPolicy='no-referrer';iframe.title='ช่องทางรับส่งข้อมูลที่จำกัดสิทธิ์';
  iframe.setAttribute('sandbox','allow-scripts allow-same-origin');iframe.hidden=true;
  let source=null,active=true,resolveReady,rejectReady;
  const pending=new Map();
  const ready=new Promise((ok,bad)=>{resolveReady=ok;rejectReady=bad;});
  // Prevent an unhandled rejection if the user leaves before making a call.
  ready.catch(()=>{});
  const deadline=setTimeout(()=>stop(new Error(timeoutText)),LIST_DEADLINE_MS);
  function stop(error){
   if(!active)return;
   active=false;channel='';source=null;clearTimeout(deadline);
   window.removeEventListener('message',receive);window.removeEventListener('pagehide',pageHide);
   for(const q of pending.values())q.finish(false,error);pending.clear();
   iframe.remove();rejectReady(error);
  }
  const pageHide=()=>stop(new Error(timeoutText));
  function receive(event){
   const d=event.data;
   if(!active||event.origin!==origin||!event.source||!d||d.protocol!==PROTOCOL||d.channel!==channel)return;
   if(d.type==='ready'&&exact(d,['protocol','type','channel'])&&!source){
    // HTMLService inserts more than one nested sandbox frame. Authenticate the
    // sender against this exact iframe chain as well as the pinned origin + nonce.
    try{
     const outer=iframe.contentWindow;if(!outer)return;
     let candidate=event.source,found=false;
     for(let hop=0;hop<=4&&candidate;hop++){
      if(candidate===outer){found=true;break;}
      if(candidate===window)break;
      const parent=candidate.parent;if(parent===candidate)break;
      candidate=parent;
     }
     if(!found)return;
    }catch(_){return;}
    source=event.source;clearTimeout(deadline);resolveReady();return;
   }
   if(d.type!=='result'||event.source!==source||!exact(d,['protocol','type','channel','id','payload'])||typeof d.id!=='string')return;
   const q=pending.get(d.id);if(!q)return;
   q.finish(true,d.payload);
  }
  window.addEventListener('message',receive);
  window.addEventListener('pagehide',pageHide,{once:true});
  try{iframe.src=url.href;document.body.append(iframe);}catch(_){stop(new Error(timeoutText));}
  const call=(method,args)=>{
   if(!active)return Promise.reject(new Error(timeoutText));
   if(!METHODS.has(method)||!Array.isArray(args)||args.length!==METHODS.get(method))return Promise.reject(new Error('ไม่รองรับคำขอนี้'));
   const isList=method==='listEmergencyLightAssets';
   const id=random();
   return new Promise((resolve,reject)=>{
    let done=false, posted=false;
    function finish(ok,value){
     if(done)return;
     done=true;clearTimeout(timer);pending.delete(id);
     (ok?resolve:reject)(value);
    }
    const timer=setTimeout(()=>finish(false,new Error(isList?(posted?listTimeout:timeoutText):noReceipt)),isList?LIST_DEADLINE_MS:25000);
    ready.then(()=>{
     if(done)return;  // A late READY must never dispatch the expired request.
     if(!active||!source){finish(false,new Error(timeoutText));return;}
     pending.set(id,{finish});
     try{source.postMessage({protocol:PROTOCOL,type:'request',channel,id,method,args},origin);posted=true;}
     catch(_){finish(false,new Error(timeoutText));}
    },error=>finish(false,error));
   });
  };
  call.close=()=>stop(new Error(timeoutText));
  return call;
 }
 window.FireLightTransport=Object.freeze({create,isLocal:local});
})();
