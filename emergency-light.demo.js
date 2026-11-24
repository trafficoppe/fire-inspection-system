(() => {
 'use strict';
 if(!window.FireLightTransport.isLocal)return;
 const create=slug=>{
 const active=Object.hasOwn(ALARM_DEPTS,slug)?ALARM_DEPTS[slug]:null;
 const key=active?'oppe.emergency-light.local-preview.v4.'+slug:null;
 let items=[],history=new Map(),requests=new Map();
 try{
  const raw=key?window.localStorage.getItem(key):null;
  if(raw){const saved=JSON.parse(raw);if(Array.isArray(saved?.items)&&Array.isArray(saved?.history)&&Array.isArray(saved?.requests)){items=saved.items;history=new Map(saved.history);requests=new Map(saved.requests);}}
 }catch(_){}
 const persist=()=>{try{if(key)window.localStorage.setItem(key,JSON.stringify({items,history:[...history],requests:[...requests]}));}catch(_){}};
 const scoped=department=>active!==null&&department===active;
 const authorized={status:'unauthorized'};
  const factory=done=>({
  listEmergencyLightAssets(department){done(scoped(department)?{status:'success',items:items.map(r=>({...r})).sort((a,b)=>a.assetNo.localeCompare(b.assetNo,'th',{numeric:true}))}:authorized);},
  addEmergencyLightAsset(department,data,requestId){
   if(!scoped(department)){done(authorized);return;}
   if(requests.has(requestId)){done(requests.get(requestId));return;}
   if(items.some(r=>r.assetNo===data.assetNo)){done({status:'duplicate_asset_no'});return;}
   const asset={assetId:'local-'+requestId,...data};items.push(asset);history.set(asset.assetId,[]);
   const receipt={status:'success',requestId,...asset};requests.set(requestId,receipt);persist();done(receipt);
  },
  inspectEmergencyLightAsset(department,data,requestId){
   if(!scoped(department)||!history.has(data.assetId)){done(authorized);return;}
   if(requests.has(requestId)){done(requests.get(requestId));return;}
   history.get(data.assetId).unshift({...data});
   const receipt={status:'success',requestId};requests.set(requestId,receipt);persist();done(receipt);
  },
  listEmergencyLightAssetHistory(department,assetId){done(scoped(department)&&history.has(assetId)?{status:'success',rows:history.get(assetId).slice().sort((a,b)=>b.inspectionDate.localeCompare(a.inspectionDate))}:authorized);}
  });
  return (method,args)=>new Promise((done,reject)=>{
   const api=factory(done);
   if(!Object.hasOwn(api,method)){reject(new Error('ไม่รองรับคำขอนี้'));return;}
   api[method](...args);
  });
 };
 window.FireLightDemo=Object.freeze({create});
})();
