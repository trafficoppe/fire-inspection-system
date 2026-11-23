const urlParams = new URLSearchParams(window.location.search);
const deptKey = urlParams.get('dept') || 'traffic';

const DEPT_MAP = {
    'traffic': 'งานจราจรและความปลอดภัย',
    'salaya': 'อาคารศาลายา กองกายภาพฯ',
    'mlc': 'ศูนย์การเรียนรู้มหิดล',
    'sitthakarn': 'มหิดลสิทธาคาร',
    'siriwittaya': 'อาคารสิริวิทยา',   
    'substation': 'สถานีไฟฟ้าย่อยมหิดล',
    'wastewater': 'อาคารบำบัดน้ำเสีย'
};

const DEPT_NAME = DEPT_MAP[deptKey] || 'งานจราจรและความปลอดภัย';
const CACHE_KEY = "gasData_folder_and_sheet_photos_v1_17_" + DEPT_NAME;

let renderedRecords = [];
let selectedRecord = null;
function assetOf(row) { return String(row['หมายเลขครุภัณฑ์'] || row['เลขที่ถัง'] || ''); }
function prepareRecords(rows) {
    const counts = new Map();
    rows.forEach(row => counts.set(assetOf(row), (counts.get(assetOf(row)) || 0) + 1));
    return rows.map((row, index) => ({...row,
        _recordKey: JSON.stringify([index, ...Object.values(row)]),
        _ambiguousAsset: !assetOf(row) || counts.get(assetOf(row)) > 1
    }));
}
function warnDuplicate() {
    const message = 'รหัสถังซ้ำในฐานข้อมูล ยังแยกประวัติหรือบันทึกของถังนี้ไม่ได้ กรุณาตรวจรหัสก่อน';
    if (typeof Swal !== 'undefined') Swal.fire({icon: 'warning', title: 'รหัสถังซ้ำ', text: message});
    else alert(message);
}
function openRecord(index) {
    selectedRecord = renderedRecords[index];
    if (!selectedRecord) return;
    openForm(assetOf(selectedRecord), selectedRecord['สถานที่ติดตั้ง'], '', assetOf(selectedRecord));
}
function historyRecord(index) {
    const row = renderedRecords[index];
    if (!row || row._ambiguousAsset) return warnDuplicate();
    showHistoryModal(assetOf(row));
}
function refillRecord(index) {
    const row = renderedRecords[index];
    if (!row || row._ambiguousAsset) return warnDuplicate();
    window.location.href = 'refill_form.html?' + new URLSearchParams({
        dept: deptKey, assetCode: assetOf(row), extId: row['เลขที่ถัง'] || ''
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const titleDisplay = document.getElementById('dept-title-display');
    if (titleDisplay) {
        titleDisplay.innerHTML = DEPT_NAME; 
    }
    loadExtinguishers();
    setupForm();
});

function goToAddDataPage() {
    window.location.href = `add_data.html?dept=${deptKey}`;
}

function showSection(sectionId) {
    document.getElementById('page-list').style.display = sectionId === 'page-list' ? 'block' : 'none';
    document.getElementById('page-form').style.display = sectionId === 'page-form' ? 'block' : 'none';
    window.scrollTo(0, 0);
}

function clearCacheAndReload() {
    sessionStorage.removeItem(CACHE_KEY);
    loadExtinguishers();
}

// สร้างวันตามปฏิทินสากลและเขตเวลาไทย โดยไม่ใช้ UTC หรือเขตเวลาเครื่อง
function todayBangkok(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok', calendar: 'gregory', numberingSystem: 'latn',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const part = type => parts.find(p => p.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

function openForm(extId, location, imgSrc, assetCode) {
    document.getElementById('extinguisherId').value = extId;
    document.getElementById('extinguisherLocation').value = location;
    document.getElementById('inspectionDate').value = todayBangkok();
    const dateHelp = document.getElementById('inspectionDateHelp');
    if (dateHelp) dateHelp.textContent = CONFIG.INSPECTION_DATE_WRITE_READY === true
        ? 'ตั้งเป็นวันนี้ตามเวลาไทย แตะเพื่อเลือกวันอื่นได้'
        : 'วันนี้บันทึกได้ตามเดิม วันอื่นต้องเปิดการบันทึกวันที่ใน Apps Script ก่อน';
    
    ['pin', 'gauge', 'hose', 'body', 'lever', 'label', 'installPoint', 'base'].forEach(item => {
        const passRadio = document.getElementById(`${item}_pass`);
        if(passRadio) passRadio.checked = true;
        
        const reasonInput = document.getElementById(`${item}_reason`);
        if (reasonInput) {
            reasonInput.value = '';
            reasonInput.classList.add('d-none');
        }
    });
    document.getElementById('remark').value = '';
    showSection('page-form');
}

function toggleReason(item) {
    const isFail = document.getElementById(`${item}_fail`).checked;
    const reasonInput = document.getElementById(`${item}_reason`);
    if (reasonInput) {
        if (isFail) {
            reasonInput.classList.remove('d-none');
        } else {
            reasonInput.classList.add('d-none');
            reasonInput.value = '';
        }
    }
}

async function loadExtinguishers() {
    const container = document.getElementById('extinguisher-container');
    const countBadge = document.getElementById('ext-count');

    const cachedData = sessionStorage.getItem(CACHE_KEY);
    let hasCache = false;

    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            renderList(parsed, container, countBadge);
            hasCache = true;
        } catch (e) {
            console.error("Cache parsing error:", e);
        }
    }

    if (!hasCache) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
                <p class="text-muted mt-3 fw-normal" style="font-size: 12px;">กำลังดึงข้อมูลล่าสุด...</p>
            </div>`;
        countBadge.innerText = '...';
    }

    try {
        const response = await fetch(CONFIG.GAS_URL);
        const allData = await response.json();
        
        if (allData.error) throw new Error(allData.error);

        if(DEPT_NAME!=='งานจราจรและความปลอดภัย'){
            // Read H/I from the exact inventory row; never borrow another tank's photos.
            const photoRows=await FireSheet.read('https://docs.google.com/spreadsheets/d/1LD5AVbwLV2RplbUYNlzY529rkN41dgvvqcXzGjBFBW8/export?format=csv&gid=62276880');
            allData.forEach(item=>{const matches=photoRows.filter(r=>r['หน่วยงาน']===item['หน่วยงาน']&&String(r['หมายเลขครุภัณฑ์']||'').trim()===String(item['หมายเลขครุภัณฑ์']||'').trim()&&String(r['เลขที่ถัง']||'').trim()===String(item['เลขที่ถัง']||'').trim());if(matches.length===1){item['รูปภาพ1']=matches[0]['รูปภาพ1'];item['รูปภาพ2']=matches[0]['รูปภาพ2'];}});
        }
        const filtered = prepareRecords(allData).filter(item => item['หน่วยงาน'] === DEPT_NAME);

        sessionStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
        renderList(filtered, container, countBadge);

    } catch (error) {
        console.error("Fetch Error:", error);
        if (!hasCache) {
            container.innerHTML = `
                <div class="text-center text-danger py-4 p-4 bg-white rounded-3 border border-danger shadow-sm">
                    <h6 class="fw-normal" style="font-size: 13px;">ไม่สามารถดึงข้อมูลได้</h6>
                    <p class="mb-0" style="font-size: 11px;">โปรดตรวจสอบการตั้งค่า Deploy หรืออินเทอร์เน็ต</p>
                    <button onclick="clearCacheAndReload()" class="btn btn-outline-danger btn-sm mt-3 fw-normal" style="font-size: 11px;">ลองใหม่อีกครั้ง</button>
                </div>`;
            countBadge.innerText = `Error`;
        }
    }
}

function renderList(data, container, countBadge) {
    if (!data || data.length === 0) {
        container.innerHTML = `<div class="text-center text-muted py-5 bg-white rounded-3 border shadow-sm" style="font-size: 12px;">ยังไม่มีข้อมูลถังดับเพลิงในระบบ</div>`;
        countBadge.innerText = `0 ถัง`;
        return;
    }

    let inspectedLog = JSON.parse(localStorage.getItem('inspectedLog_confirmed_v2_' + DEPT_NAME) || '{}');
    const now = new Date().getTime();

    data.sort((a, b) => {
        const aId = a._recordKey;
        const bId = b._recordKey;
        const aInspected = inspectedLog[aId] && (now - inspectedLog[aId].timestamp < 10 * 60 * 1000) ? 1 : 0;
        const bInspected = inspectedLog[bId] && (now - inspectedLog[bId].timestamp < 10 * 60 * 1000) ? 1 : 0;
        return aInspected - bInspected;
    });

    container.innerHTML = '';
    countBadge.innerText = `${data.length} ถัง`;

    renderedRecords = data.slice();
    data.forEach((ext, recordIndex) => {
        const recordKey = ext._recordKey;
        const assetCode = ext['หมายเลขครุภัณฑ์'] || ext['เลขที่ถัง'];
        let borderClass = ""; 
        let cardStyle = "background-color: #ffffff;"; 
        let statusBadge = "";

        if (inspectedLog[recordKey]) {
            const timeDiff = now - inspectedLog[recordKey].timestamp;
            if (timeDiff < 10 * 60 * 1000) { 
                if (inspectedLog[recordKey].status === 'pass') {
                    cardStyle = "background-color: #d1e7dd !important;";
                    statusBadge = `<span class="badge bg-success ms-1 px-2 py-1 fw-normal rounded-pill" style="font-size: 10px;">ตรวจแล้ว</span>`;
                } else {
                    cardStyle = "background-color: #f8d7da !important;";
                    statusBadge = `<span class="badge ms-1 px-2 py-1 fw-normal rounded-pill" style="background-color: #dc3545; color: white; font-size: 10px;">ชำรุด</span>`;
                }
            } else {
                delete inspectedLog[recordKey];
            }
        }

        // ใช้โฟลเดอร์ images ตามรหัสครุภัณฑ์ที่ไม่ซ้ำ ห้าม fallback ไปเลขถัง
        
        const imageBlockHTML = getFireExtinguisherImageBlock(ext);

        container.innerHTML += `
            <div class="card mb-2 shadow-sm border-0 ${borderClass} cursor-pointer" 
                 style="${cardStyle}"
                 onclick="openRecord(${recordIndex})" role="button" tabindex="0" aria-label="ตรวจสภาพถัง ${escapePhotoAttribute(assetCode)}" onkeydown="if(event.target===this &amp;&amp; (event.key==='Enter' || event.key===' ')){event.preventDefault();openRecord(${recordIndex});}">
                
                <div class="card-body p-2 d-flex align-items-center">
                    
                    ${imageBlockHTML}
                    
                    <div class="flex-grow-1 d-flex flex-column justify-content-between" style="min-height: 80px;">
                        
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <div class="text-start mb-0" style="line-height: 1.35;">
                                <div style="font-size: 11px; color: #000; font-weight: normal;">ชนิด ${escapePhotoAttribute(ext['ชนิด'] || '-')}</div>
                                <div style="font-size: 11px; color: #000; font-weight: normal;">ขนาด ${escapePhotoAttribute(ext['ขนาด'] || '-')}</div>
                                <div style="font-size: 11px;">ครุภัณฑ์ ${escapePhotoAttribute(assetCode)} · จุดติดตั้ง ${escapePhotoAttribute(ext['สถานที่ติดตั้ง'] || '-')}</div>
                                <div style="font-size: 11px; color: #000; font-weight: normal;">ถังเลขที่ ${escapePhotoAttribute(ext['เลขที่ถัง'] || '-')}</div>
                            </div>
                            <div class="flex-shrink-0 ms-1">
                                ${statusBadge}
                            </div>
                        </div>
                        
                        <!-- ปรับแก้ปุ่มสีเหลืองและปุ่มสีเทาตามภาพตัวอย่าง -->
                        <div class="text-end d-flex justify-content-end gap-2 mt-auto pt-1">
                            <button class="btn btn-sm rounded-pill px-3 py-1 fw-bold shadow-sm" style="color: #333; font-size: 11px; background-color: #ffca28; border: none;"
                                onclick="event.stopPropagation(); refillRecord(${recordIndex})">
                                เติมน้ำยา
                            </button>
                            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1" style="font-size: 11px; color: #555; background-color: #f8f9fa;"
                                    onclick="event.stopPropagation(); historyRecord(${recordIndex})">
                                ประวัติการตรวจ
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        `;
    });

    localStorage.setItem('inspectedLog_confirmed_v2_' + DEPT_NAME, JSON.stringify(inspectedLog));

    const carousels = document.querySelectorAll('.carousel');
    carousels.forEach(carousel => {
        new bootstrap.Carousel(carousel, {
            interval: 2500,
            ride: 'carousel'
        });
    });
}

function setupForm() {
    const form = document.getElementById('inspection-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedRecord || selectedRecord._ambiguousAsset) { warnDuplicate(); return; }
        const recordKey = selectedRecord._recordKey;

        const submitBtn = form.querySelector('button[type="submit"]');
        const dateInput = document.getElementById('inspectionDate');
        if (!dateInput.reportValidity()) return;
        const inspectionDate = dateInput.value;
        const dateWriteReady = CONFIG.INSPECTION_DATE_WRITE_READY === true;
        if (!dateWriteReady && inspectionDate !== todayBangkok()) {
            const message = 'ระบบยังบันทึกวันที่อื่นไม่ได้ จึงยังไม่ได้ส่งข้อมูล กรุณาเลือกวันนี้หรือแจ้งผู้ดูแล';
            if (typeof Swal !== 'undefined') await Swal.fire({icon:'warning',title:'ยังไม่ได้ส่งข้อมูล',text:message});
            else alert(message);
            return;
        }
        submitBtn.disabled = true; // ป้องกันการกดปุ่มซ้ำ

        const assetCode = document.getElementById('extinguisherId').value;
        
        const getVal = (name) => {
            const el = document.querySelector(`input[name="${name}"]:checked`);
            return el ? el.value : 'pass';
        };
        const getReason = (name) => document.getElementById(`${name}_reason`) ? document.getElementById(`${name}_reason`).value : '';

        const body = getVal('body');
        const gauge = getVal('gauge');
        const hose = getVal('hose');
        const pin = getVal('pin');
        const lever = getVal('lever');
        const label = getVal('label');
        const installPoint = getVal('installPoint');
        const base = getVal('base');

        const isAllPass = (body === 'pass' && gauge === 'pass' && hose === 'pass' && pin === 'pass' && 
                           lever === 'pass' && label === 'pass' && installPoint === 'pass' && base === 'pass');

        const formatCheck = (status, reason) => status === 'pass' ? 'ปกติ' : 'ชำรุด: ' + reason;

        const payload = {
            action: dateWriteReady ? "inspection_with_date" : "inspection",
            ...(dateWriteReady ? {inspectionDate} : {}),
            extinguisherId: assetCode,
            assetCode: assetCode,
            inspectorName: document.getElementById('inspectorName').value,
            checkBody: formatCheck(body, getReason('body')),
            checkPressure: formatCheck(gauge, getReason('gauge')),
            checkHose: formatCheck(hose, getReason('hose')),
            checkPin: formatCheck(pin, getReason('pin')),
            checkLever: formatCheck(lever, getReason('lever')),
            checkLabel: formatCheck(label, getReason('label')),
            checkInstall: formatCheck(installPoint, getReason('installPoint')),
            checkBase: formatCheck(base, getReason('base')),
            finalStatus: isAllPass ? 'ปกติ' : 'ชำรุด',
            note: document.getElementById('remark').value,
            department: DEPT_NAME
        };

        try {
            const receipt = await FireSubmit.send(CONFIG.GAS_URL, payload);
            if (dateWriteReady && receipt.inspectionDate !== inspectionDate) {
                throw new Error('ระบบยังไม่ยืนยันวันที่ตรวจที่เลือก กรุณาตรวจประวัติก่อนส่งซ้ำ');
            }
        } catch (error) {
            submitBtn.disabled = false;
            if (typeof Swal !== 'undefined') await Swal.fire({icon:'warning',title:'ยังไม่ยืนยันการบันทึก',text:error.message});
            else alert(error.message);
            return;
        }

        // 2. อัปเดตสถานะการ์ดให้เป็น "ตรวจแล้ว" ในเครื่องทันที
        let inspectedLog = JSON.parse(localStorage.getItem('inspectedLog_confirmed_v2_' + DEPT_NAME) || '{}');
        inspectedLog[recordKey] = {
            timestamp: new Date().getTime(),
            status: isAllPass ? 'pass' : 'fail'
        };
        localStorage.setItem('inspectedLog_confirmed_v2_' + DEPT_NAME, JSON.stringify(inspectedLog));
        sessionStorage.removeItem(CACHE_KEY);

        // 3. แสดง Popup SweetAlert2 แจ้งเตือนกลางจอ
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'บันทึกเรียบร้อย',
                text: 'ข้อมูลถูกบันทึกลงระบบแล้ว',
                showConfirmButton: false,
                timer: 1500 // แสดงค้าง 1.5 วินาทีแล้วเปลี่ยนหน้าอัตโนมัติ
            }).then(() => {
                submitBtn.disabled = false;
                showSection('page-list');
                loadExtinguishers(); 
            });
        } else {
            // สำรองไว้กรณีไม่ได้ติดโค้ด SweetAlert2
            alert('บันทึกการตรวจเรียบร้อยแล้ว');
            submitBtn.disabled = false;
            showSection('page-list');
            loadExtinguishers(); 
        }
    });
}

async function showHistoryModal(assetCode) {
    document.getElementById('historyAssetCode').innerText = assetCode;
    const historyListContainer = document.getElementById('historyListContainer');
    
    historyListContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 fw-normal small">กำลังโหลดประวัติ...</p></div>';

    const myModal = new bootstrap.Modal(document.getElementById('historyModal'));
    myModal.show();

    try {
        const response = await fetch(CONFIG.GAS_URL + "?action=get_log&assetCode=" + assetCode);
        const logs = await response.json();

        let tableHTML = `
            <div class="table-responsive border rounded">
                <table class="table table-bordered text-center align-middle mb-0" 
                       style="font-size: 11px; white-space: nowrap; width: 100%; color: #000;">
                    <thead class="table-light">
                        <tr>
                            <th style="font-weight: normal; padding: 6px 4px;">ด/ป</th>
                            <th style="font-weight: normal; padding: 6px 4px;">ถัง</th>
                            <th style="font-weight: normal; padding: 6px 4px;">เกจ์</th>
                            <th style="font-weight: normal; padding: 6px 4px;">สาย</th>
                            <th style="font-weight: normal; padding: 6px 4px;">สลัก</th>
                            <th style="font-weight: normal; padding: 6px 4px;">บีบ</th>
                            <th style="font-weight: normal; padding: 6px 4px;">ป้าย</th>
                            <th style="font-weight: normal; padding: 6px 4px;">จุด</th>
                            <th style="font-weight: normal; padding: 6px 4px;">ฐาน</th>
                            <th style="font-weight: normal; padding: 6px 4px;">สถานะ</th>
                            <th style="font-weight: normal; padding: 6px 4px;">ผู้ตรวจ</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const gregorianYear = Number(todayBangkok().slice(0, 4));
        const currentYear = gregorianYear + 543;
        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

        months.forEach((month, index) => {
            const logsForMonth = logs.filter(log => {
                // ใช้วันที่ตรวจสำหรับรายการใหม่ และอ่านวันที่เดิมสำหรับประวัติเก่า
                const selected = /^(\d{4})-(\d{2})-\d{2}$/.exec(log.inspectionDate || '');
                if (selected) return Number(selected[1]) === gregorianYear && Number(selected[2]) === index + 1;
                const stamp = String(log.timestamp || '');
                const iso = /^(\d{4})-(\d{2})-\d{2}(?:[T ]|$)/.exec(stamp);
                const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(stamp);
                if (iso) return Number(iso[1]) === gregorianYear && Number(iso[2]) === index + 1;
                if (!local) return false;
                const y = Number(local[3]);
                return (y > 2400 ? y - 543 : y) === gregorianYear && Number(local[2]) === index + 1;
            });

            // เลือกผลตรวจที่เกิดหลังสุดจริง ไม่ให้การกรอกย้อนหลังทับผลตรวจล่าสุด
            const dayOf = log => {
                const selected = /^(\d{4})-(\d{2})-(\d{2})$/.exec(log.inspectionDate || '');
                if (selected) return Number(selected[3]);
                const stamp = String(log.timestamp || '');
                const iso = /^\d{4}-\d{2}-(\d{2})/.exec(stamp);
                const local = /^(\d{1,2})\//.exec(stamp);
                return Number((iso || local || [])[1]) || 0;
            };
            const logEntry = logsForMonth.reduce((latest, item) =>
                !latest || dayOf(item) >= dayOf(latest) ? item : latest, undefined);

            if (logEntry) {
                 const isPass = logEntry.finalStatus === "ปกติ";
                 const tick = `<span class="text-success" style="font-weight: normal; font-size: 11px;">✓</span>`;
                 const cross = `<span class="text-danger" style="font-weight: normal; font-size: 11px;">✗</span>`;
                 const rowClass = isPass ? 'table-success' : 'table-danger';

                 tableHTML += `
                    <tr class="${rowClass}">
                        <td style="font-weight: normal; padding: 6px 4px;">${month} ${currentYear.toString().substring(2)}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkBody || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkPressure || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkHose || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkPin || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkLever || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkLabel || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkInstall || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${(logEntry.checkBase || "").includes("ปกติ") ? tick : cross}</td>
                        <td style="padding: 6px 4px;">
                            <span class="badge ${isPass ? 'bg-success' : 'bg-danger'} shadow-sm px-2 py-1" style="font-size: 10px; font-weight: normal;">${isPass ? 'ใช้งานได้' : 'ชำรุด'}</span>
                        </td>
                        <td class="text-truncate" style="max-width: 70px; font-weight: normal; padding: 6px 4px;">${logEntry.inspectorName}</td>
                    </tr>
                `;
            } else {
                 tableHTML += `
                    <tr>
                        <td style="font-weight: normal; padding: 6px 4px;">${month} ${currentYear.toString().substring(2)}</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                        <td style="color: #6c757d; padding: 6px 4px;">-</td>
                    </tr>
                `;
            }
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        historyListContainer.innerHTML = tableHTML;

    } catch (error) {
        console.error("Error loading history:", error);
        historyListContainer.innerHTML = '<div class="text-center text-danger p-4" style="font-weight: normal;">เกิดข้อผิดพลาดในการดึงข้อมูล</div>';
    }
}

function filterExtinguisher() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const items = document.querySelectorAll("#extinguisher-container .card"); 

    items.forEach(function(item) {
        const itemText = item.textContent.toLowerCase();
        if (itemText.includes(query)) {
            item.style.display = "";
        } else {
            item.style.display = "none";
        }
    });
}