// Original images/<asset>_1.jpg and _2.jpg source, with fail-closed duplicate handling.
function escapePhotoAttribute(value){return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');}
function firePhotoFailed(image){image.hidden=true;image.nextElementSibling.hidden=false;image.parentElement.removeAttribute('href');}
function getFireExtinguisherImageBlock(row){
 if(String(row['หน่วยงาน']||'').trim()!=='งานจราจรและความปลอดภัย'){
  const photos=['รูปภาพ1','รูปภาพ2'].map(k=>{try{const u=new URL(String(row[k]||'').trim());if(u.protocol!=='https:')return null;if(u.hostname==='drive.google.com'){const match=u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/),id=match?match[1]:u.searchParams.get('id');return id&&/^[A-Za-z0-9_-]+$/.test(id)?'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w1200':null;}return u.href;}catch{return null;}}).filter(Boolean);
  if(!photos.length)return '<div class="sheet-photo-empty me-2">ยังไม่มีรูปถังในชีท</div>';
  return '<div class="sheet-photo-group me-2 auto-slider-container '+(photos.length>1?'has-two-photos':'')+'"><div class="auto-slider-track">'+photos.map((src,i)=>'<span class="sheet-photo-link" title="เปิดฟอร์มตรวจสภาพถังนี้"><img loading="lazy" decoding="async" src="'+escapePhotoAttribute(src)+'" alt="รูปถังดับเพลิง '+(i+1)+'" onerror="firePhotoFailed(this)"><span hidden>ไม่สามารถเปิดรูปจากชีทได้</span></span>').join('')+'</div></div>';
 }
 const code=String(row['หมายเลขครุภัณฑ์']||'').trim();
 if(row._ambiguousAsset!==false||!code||code==='-'||! /^[a-zA-Z0-9_-]+$/.test(code))return '<div class="sheet-photo-empty me-2">ยังจับคู่รูปไม่ได้<br>ตรวจรหัสถัง</div>';
 return '<div class="sheet-photo-group me-2 auto-slider-container has-two-photos"><div class="auto-slider-track">'+[1,2].map(i=>{
 const path='images/'+encodeURIComponent(code)+'_'+i+'.jpg';
 return '<span class="sheet-photo-link" title="เปิดฟอร์มตรวจสภาพถังนี้"><img loading="lazy" decoding="async" src="'+escapePhotoAttribute(path)+'" alt="รูปถังดับเพลิง '+i+'" onerror="firePhotoFailed(this)"><span hidden>ไม่พบรูป '+i+'<br>ในโฟลเดอร์</span></span>';
 }).join('')+'</div></div>';
}
