/* Read-only CSV reader: preserves mixed text/date cells and long asset identifiers. */
(function(root){
'use strict';
function parseCSV(text){const rows=[];let row=[],field='',quoted=false;text=String(text).replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'&&field==='')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v!==''))rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('ข้อมูล CSV ไม่สมบูรณ์');if(field!==''||row.length){row.push(field);rows.push(row);}return rows;}
function objects(text){if(/^\s*</.test(text))throw Error('ไม่สามารถอ่านชีทได้ กรุณาตรวจสิทธิ์การเข้าถึง');const rows=parseCSV(text),heads=(rows.shift()||[]).map(h=>h.trim());if(!heads.some(Boolean))throw Error('ไม่พบหัวตาราง');return rows.map(row=>Object.fromEntries(heads.map((h,i)=>[h,row[i]??'']).filter(([h])=>h)));}
async function read(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{const res=await fetch(url,{cache:'no-store',signal:controller.signal});if(!res.ok)throw Error('อ่านชีทไม่ได้ ('+res.status+')');return objects(await res.text());}finally{clearTimeout(timer);}}
const api={parseCSV,objects,read};root.FireSheet=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
