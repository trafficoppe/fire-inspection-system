/* Remember only the editable inspector-name field on this browser/origin. */
(function(){'use strict';
 const KEY='fire.inspectorName.v1';
 function bind(){
  const field=document.getElementById('inspectorName');
  if(!field)return;
  try{const saved=localStorage.getItem(KEY);if(!field.value&&typeof saved==='string')field.value=saved;}catch(_){/* Storage disabled: ordinary editable form still works. */}
  function save(){
   try{const value=field.value;if(value.trim())localStorage.setItem(KEY,value);else localStorage.removeItem(KEY);}catch(_){/* Never prevent typing or submission. */}
  }
  field.addEventListener('input',save);
  field.addEventListener('change',save);
  field.addEventListener('blur',save);
  if(field.form)field.form.addEventListener('submit',save,true);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
