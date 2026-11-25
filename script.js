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
const CACHE_KEY = "gasData_folder_and_sheet_photos_dept_scope_v1_" + DEPT_NAME;

let renderedRecords = [];
let selectedRecord = null;
function extinguisherKey(value) {
    const v = String(value ?? '').trim();
    return v && v !== '-' && v.toLowerCase() !== 'null' ? v : '';
}
function assetOf(row) {
    return extinguisherKey(row['หมายเลขครุภัณฑ์']) || extinguisherKey(row['เลขที่ถัง']);
}
function prepareRecords(rows) {
    const canonical = new Map(), alias = new Map();
    const deptCode = (row, code) => JSON.stringify([extinguisherKey(row['หน่วยงาน']), code]);
    const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    rows.forEach(row => {
        const code = assetOf(row), number = extinguisherKey(row['เลขที่ถัง']);
        if (code) add(canonical, deptCode(row, code));
        for (const value of new Set([code, number].filter(Boolean))) add(alias, deptCode(row, value));
    });
    return rows.map((row, index) => {
        const code = assetOf(row), k = deptCode(row, code);
        return {...row, _recordKey: JSON.stringify([index, ...Object.values(row)]),
            _ambiguousAsset: !code || canonical.get(k) !== 1 ||
                (!extinguisherKey(row['หมายเลขครุภัณฑ์']) && alias.get(k) !== 1)};
    });
}
function warnDuplicate() {
    const message = 'รหัสระบุถังไม่ครบหรือซ้ำในหน่วยงานนี้ กรุณาตรวจทะเบียนก่อนบันทึก';
    if (typeof Swal !== 'undefined') Swal.fire({icon: 'warning', title: 'รหัสถังซ้ำ', text: message});
    else alert(message);
}
function openRecord(index) {
    selectedRecord = renderedRecords[index];
    if (!selectedRecord || selectedRecord._ambiguousAsset) return warnDuplicate();
    openForm(assetOf(selectedRecord), selectedRecord['สถานที่ติดตั้ง'], '', assetOf(selectedRecord));
}
function historyRecord(index) {
    const row = renderedRecords[index];
    if (!row || row._ambiguousAsset) return warnDuplicate();
    showHistoryModal(assetOf(row), extinguisherKey(row['หน่วยงาน']));
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

function inspectionToday() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone:'Asia/Bangkok', calendar:'gregory', numberingSystem:'latn',
        year:'numeric', month:'2-digit', day:'2-digit'
    }).formatToParts(new Date()).map(({type,value})=>[type,value]));
    return [parts.year,parts.month,parts.day].join('-');
}
function validInspectionDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > inspectionToday()) return false;
    const date = new Date(value+'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
function openForm(extId, location, imgSrc, assetCode) {
    document.getElementById('extinguisherId').value = extId;
    document.getElementById('extinguisherLocation').value = location;
    const dateField = document.getElementById('inspectionDate');
    dateField.max = inspectionToday();
    dateField.value = dateField.max;
    
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
    window.FireTankTags?.setInventory(null);
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
        const filtered = prepareRecords(allData.filter(item => extinguisherKey(item['หน่วยงาน']) === DEPT_NAME));

        sessionStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
        renderList(filtered, container, countBadge);
        window.FireTankTags?.setInventory(filtered);

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
        countBadge.innerText = `พบ 0 รายการ`;
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
    countBadge.innerText = `พบ ${data.length} รายการ`;

    renderedRecords = data.slice();
    data.forEach((ext, recordIndex) => {
        const recordKey = ext._recordKey;
        const assetCode = assetOf(ext);
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
            <article class="card tank-card cursor-pointer" style="${cardStyle}"
                 onclick="openRecord(${recordIndex})">
                <div class="card-body tank-body">
                    <div class="tank-info">
                        ${imageBlockHTML}
                        <div>
                            <p>ถังเลขที่ ${escapePhotoAttribute(ext['เลขที่ถัง'] || '-')} ${statusBadge}</p>
                            <p>จุดติดตั้ง ${escapePhotoAttribute(ext['สถานที่ติดตั้ง'] || '-')}</p>
                            <p class="tank-details">ชนิด ${escapePhotoAttribute(ext['ชนิด'] || '-')} · ขนาด ${escapePhotoAttribute(ext['ขนาด'] || '-')} · ครุภัณฑ์ ${escapePhotoAttribute(assetCode || '-')}</p>
                        </div>
                    </div>
                    <div class="tank-actions">
                        <button type="button" class="tank-button" onclick="event.stopPropagation(); refillRecord(${recordIndex})">เติมน้ำยา</button>
                        <button type="button" class="tank-button" onclick="event.stopPropagation(); historyRecord(${recordIndex})">ประวัติการตรวจ</button>
                        <button type="button" class="tank-button tank-primary" onclick="event.stopPropagation(); openRecord(${recordIndex})">ตรวจ</button>
                    </div>
                </div>
            </article>
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
        const dateField = document.getElementById('inspectionDate');
        const inspectionDate = dateField.value;
        if (!dateField.reportValidity() || !validInspectionDay(inspectionDate)) {
            if (typeof Swal !== 'undefined') Swal.fire({icon:'warning',text:'กรุณาเลือกวันที่ตรวจที่ไม่เกินวันนี้'});
            else alert('กรุณาเลือกวันที่ตรวจที่ไม่เกินวันนี้');
            return;
        }
        const recordKey = selectedRecord._recordKey;

        const submitBtn = form.querySelector('button[type="submit"]');
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
            action: "inspection",
            inspectionDate,
            extinguisherId: assetCode,
            assetCode: assetCode,
            extId: extinguisherKey(selectedRecord['เลขที่ถัง']),
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
            if (receipt.inspectionDate !== inspectionDate) throw Error('ระบบยังไม่ยืนยันวันที่ตรวจที่เลือก กรุณาตรวจประวัติก่อนส่งซ้ำ');
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

let historyRequest = 0;
async function showHistoryModal(assetCode, department) {
    const request = ++historyRequest;
    const picker = document.getElementById('historyYearPicker');
    const controls = document.getElementById('historyYearControls');
    const message = document.getElementById('historyYearMessage');
    controls.classList.add('d-none');
    picker.replaceChildren();
    picker.onchange = null;
    message.textContent = '';
    document.getElementById('historyAssetCode').innerText = assetCode;
    const historyListContainer = document.getElementById('historyListContainer');
    
    historyListContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 fw-normal small">กำลังโหลดประวัติ...</p></div>';

    const myModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('historyModal'));
    myModal.show();

    try {
        const url = new URL(CONFIG.GAS_URL);
        url.search = new URLSearchParams({action:'get_log', assetCode, department});
        const response = await fetch(url);
        const raw = await response.json();
        if (!response.ok || !Array.isArray(raw)) throw Error('โหลดประวัติถังไม่ได้');
        if (request !== historyRequest) return;
        const logs = raw.filter(row => row && extinguisherKey(row.department) === department);

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

        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const todayYear = Number(inspectionToday().slice(0,4));
        const years = new Map();
        for (const log of logs) {
            const day = FireReport.date(log.inspectionDate || log.timestamp);
            if (!day || day.getFullYear() > todayYear) continue;
            const year = day.getFullYear(), month = day.getMonth();
            const stamp = FireReport.date(log.timestamp)?.getTime() ?? -Infinity;
            if (!years.has(year)) years.set(year, new Map());
            const entries = years.get(year), old = entries.get(month), time = day.getTime();
            if (!old || time > old.time || (time === old.time && stamp > old.stamp)) entries.set(month,{log,time,stamp});
        }
        const available = [...new Set([todayYear, todayYear - 1, ...years.keys()])].sort((a,b)=>b-a);
        for (const year of available) picker.add(new Option(String(year+543),String(year)));
        picker.value = String(todayYear);
        picker.onchange = () => {
            const year = Number(picker.value), latest = years.get(year) || new Map();
            let result = tableHTML;
            message.textContent = latest.size ? '' : 'ไม่พบผลตรวจในปี พ.ศ. ' + (year+543);
        months.forEach((month, index) => {
            const logEntry = latest.get(index)?.log;

            if (logEntry) {
                 const isPass = logEntry.finalStatus === "ปกติ";
                 const tick = `<span class="text-success" style="font-weight: normal; font-size: 11px;">✓</span>`;
                 const cross = `<span class="text-danger" style="font-weight: normal; font-size: 11px;">✗</span>`;
                 const rowClass = isPass ? 'table-success' : 'table-danger';

                 result += `
                    <tr class="${rowClass}">
                        <td style="font-weight: normal; padding: 6px 4px;">${month} ${String(year + 543).slice(-2)}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkBody ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkPressure ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkHose ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkPin ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkLever ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkLabel ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkInstall ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">${String(logEntry.checkBase ?? "").trim() === "ปกติ" ? tick : cross}</td>
                        <td style="padding: 6px 4px;">
                            <span class="badge ${isPass ? 'bg-success' : 'tank-history-damaged'} shadow-sm px-2 py-1" style="font-size: 10px; font-weight: normal;">${isPass ? 'ใช้งานได้' : 'ชำรุด'}</span>
                        </td>
                        <td class="text-truncate" style="max-width: 70px; font-weight: normal; padding: 6px 4px;">${escapePhotoAttribute(logEntry.inspectorName)}</td>
                    </tr>
                `;
            } else {
                 result += `
                    <tr>
                        <td style="font-weight: normal; padding: 6px 4px;">${month} ${String(year + 543).slice(-2)}</td>
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

        result += `
                    </tbody>
                </table>
            </div>
        `;

            historyListContainer.innerHTML = result;
        };
        controls.classList.remove('d-none');
        picker.onchange();

    } catch (error) {
        if (request !== historyRequest) return;
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