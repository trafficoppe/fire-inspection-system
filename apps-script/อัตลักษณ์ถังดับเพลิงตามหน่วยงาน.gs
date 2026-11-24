/** คู่ระบุตัวถัง = หน่วยงาน + รหัสครุภัณฑ์ (เลขที่ถังใช้แทนเมื่อไม่มีรหัสจริง) */
function fireExtKey_(value) {
  var key = fireText_(value);
  return key && key !== '-' && key.toLowerCase() !== 'null' ? key : '';
}

function fireExtMasterRows_(ss) {
  var sheet = ss.getSheetByName(FIRE_MASTER_SHEET);
  if (!sheet) throw Error('ไม่พบทะเบียนถังดับเพลิง');
  var grid = sheet.getDataRange().getValues(), h = grid[0] || [];
  if (fireText_(h[0]) !== 'หน่วยงาน' || fireText_(h[4]) !== 'เลขที่ถัง' || fireText_(h[5]) !== 'หมายเลขครุภัณฑ์') {
    throw Error('หัวตารางทะเบียนถังดับเพลิงไม่ตรงกับแบบฟอร์ม');
  }
  return grid.slice(1).filter(function(row) {return fireExtKey_(row[0]);});
}

function fireExtCanonical_(row) {
  return fireExtKey_(row[5]) || fireExtKey_(row[4]);
}

function fireExtResolve_(ss, code, department) {
  code = fireExtKey_(code);
  department = fireExtKey_(department);
  if (!code) throw Error('ไม่มีรหัสครุภัณฑ์ที่ใช้ระบุถังได้ กรุณาตรวจทะเบียน');
  var all = fireExtMasterRows_(ss);
  var matches = all.filter(function(row) {
    return (!department || fireExtKey_(row[0]) === department) && fireExtCanonical_(row) === code;
  });
  if (matches.length !== 1) {
    if (!department && matches.length > 1) throw Error('รหัสถังนี้พบในหลายรายการ กรุณาระบุหน่วยงาน');
    throw Error('ไม่พบถังหรือรหัสถังซ้ำในหน่วยงานที่เลือก กรุณาตรวจทะเบียน');
  }
  var row = matches[0], dept = fireExtKey_(row[0]), extId = fireExtKey_(row[4]);
  var inDept = all.filter(function(item) {return fireExtKey_(item[0]) === dept;});
  var aliasCount = inDept.filter(function(item) {
    return extId && (fireExtKey_(item[4]) === extId || fireExtCanonical_(item) === extId);
  }).length;
  if (!fireExtKey_(row[5]) && aliasCount !== 1) throw Error('เลขที่ถังซ้ำในหน่วยงานนี้และไม่มีรหัสครุภัณฑ์แยก กรุณาตรวจทะเบียน');
  // Old callers can omit department only if the code is globally unambiguous, including aliases.
  if (!department && all.some(function(item) {
    return item !== row && (fireExtKey_(item[4]) === code || fireExtCanonical_(item) === code);
  })) throw Error('รหัสถังนี้พบในหลายรายการ กรุณาระบุหน่วยงาน');
  // The canonical-key fallback to B is disabled if it could have been another tank's display number.
  var canonicalBIsUnique = !inDept.some(function(item) {return item !== row && fireExtKey_(item[4]) === code;});
  return {row:row, department:dept, assetCode:code, extId:extId,
    canonicalBIsUnique:canonicalBIsUnique, displayBIsUnique:aliasCount === 1};
}

function fireExtNormalizeWrite_(ss, data) {
  var dept = fireExtKey_(data.department);
  if (!dept) throw Error('ต้องระบุหน่วยงาน');
  if (data.action === 'add_extinguisher') {
    if (ALARM_DEPTS_.indexOf(dept) === -1) throw Error('หน่วยงานไม่ถูกต้อง');
    var asset = fireExtKey_(data.assetCode), number = fireExtKey_(data.extId);
    if (!asset) throw Error('ต้องระบุรหัสครุภัณฑ์');
    var dupe = fireExtMasterRows_(ss).some(function(row) {
      if (fireExtKey_(row[0]) !== dept) return false;
      var existingCode = fireExtKey_(row[5]), existingNo = fireExtKey_(row[4]);
      return asset === existingCode || asset === existingNo ||
        !!number && (number === existingNo || number === existingCode);
    });
    if (dupe) throw Error('เลขที่ถังหรือรหัสครุภัณฑ์นี้มีอยู่แล้วในหน่วยงานที่เลือก');
    data.department = dept;
    data.assetCode = asset;
    data.extId = number || '-';
    return;
  }
  var tank = fireExtResolve_(ss, data.assetCode, dept), supplied = fireExtKey_(data.extId);
  if (supplied && supplied !== tank.extId) throw Error('เลขที่ถังไม่ตรงกับทะเบียนของหน่วยงานนี้');
  data.department = tank.department;
  data.assetCode = tank.assetCode;
  if (data.action === 'inspection') data.extinguisherId = tank.assetCode;
  if (data.action === 'refill_chemical') data.extId = tank.extId || '-';
}

function fireExtScopedLogRow_(row, tank) {
  // Do not infer the owner of historical rows with no department.
  if (fireExtKey_(row[13]) !== tank.department) return false;
  var storedAsset = fireExtKey_(row[14]);
  if (storedAsset) return storedAsset === tank.assetCode;
  var old = fireExtKey_(row[1]);
  return !!old && ((tank.canonicalBIsUnique && old === tank.assetCode) ||
      (tank.displayBIsUnique && old === tank.extId));
}
