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
const CACHE_KEY = "gasData_" + DEPT_NAME;

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

function openForm(extId, location, imgSrc, assetCode) {
    document.getElementById('extinguisherId').value = extId;
    document.getElementById('extinguisherLocation').value = location;
    document.getElementById('inspectionDate').valueAsDate = new Date();
    
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

        const filtered = allData.filter(item => item['หน่วยงาน'] === DEPT_NAME);

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

    let inspectedLog = JSON.parse(localStorage.getItem('inspectedLog_' + DEPT_NAME) || '{}');
    const now = new Date().getTime();

    data.sort((a, b) => {
        const aId = a['หมายเลขครุภัณฑ์'] || a['เลขที่ถัง'];
        const bId = b['หมายเลขครุภัณฑ์'] || b['เลขที่ถัง'];
        const aInspected = inspectedLog[aId] && (now - inspectedLog[aId].timestamp < 10 * 60 * 1000) ? 1 : 0;
        const bInspected = inspectedLog[bId] && (now - inspectedLog[bId].timestamp < 10 * 60 * 1000) ? 1 : 0;
        return aInspected - bInspected;
    });

    container.innerHTML = '';
    countBadge.innerText = `${data.length} ถัง`;

    data.forEach(ext => {
        const assetCode = ext['หมายเลขครุภัณฑ์'] || ext['เลขที่ถัง'];
        let borderClass = "border-start border-4"; 
        let cardStyle = "background-color: #ffffff; border-left-color: #2b4c65 !important;"; 
        let statusBadge = "";

        if (inspectedLog[assetCode]) {
            const timeDiff = now - inspectedLog[assetCode].timestamp;
            if (timeDiff < 10 * 60 * 1000) { 
                if (inspectedLog[assetCode].status === 'pass') {
                    cardStyle = "background-color: #d1e7dd !important; border-left-color: #198754 !important;";
                    statusBadge = `<span class="badge bg-success ms-1 px-2 py-1 fw-normal rounded-pill" style="font-size: 10px;">ตรวจแล้ว</span>`;
                } else {
                    cardStyle = "background-color: #f8d7da !important; border-left-color: #dc3545 !important;";
                    statusBadge = `<span class="badge ms-1 px-2 py-1 fw-normal rounded-pill" style="background-color: #dc3545; color: white; font-size: 10px;">ชำรุด</span>`;
                }
            } else {
                delete inspectedLog[assetCode];
            }
        }

        let img1Src = (assetCode && assetCode !== '-') ? `images/${assetCode}_1.jpg` : `images/default.jpg`;
        let img2Src = (assetCode && assetCode !== '-') ? `images/${assetCode}_2.jpg` : `images/default.jpg`;

        let carouselId = "slide-" + (assetCode || Math.random().toString(36).substr(2, 5));
        let imageBlockHTML = `
          <div id="${carouselId}" class="carousel slide me-2 flex-shrink-0" data-bs-ride="carousel" data-bs-interval="2500" 
               style="width: 80px; height: 80px; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
            <div class="carousel-inner" style="height: 100%;">
              <div class="carousel-item active" style="height: 100%; transition: transform 0.8s ease-in-out;">
                <img src="${img1Src}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='images/default.jpg';">
              </div>
              <div class="carousel-item" style="height: 100%; transition: transform 0.8s ease-in-out;">
                <img src="${img2Src}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='images/default.jpg';">
              </div>
            </div>
          </div>
        `;

        container.innerHTML += `
            <div class="card mb-2 shadow-sm border-0 ${borderClass} cursor-pointer" 
                 style="${cardStyle}"
                 onclick="openForm('${assetCode}', '${ext['สถานที่ติดตั้ง']}', '${img1Src}', '${assetCode}')">
                
                <div class="card-body p-2 d-flex align-items-center">
                    
                    ${imageBlockHTML}
                    
                    <div class="flex-grow-1 d-flex flex-column justify-content-between" style="min-height: 80px;">
                        
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <div class="text-start mb-0" style="line-height: 1.35;">
                                <div style="font-size: 11px; color: #000; font-weight: normal;">ชนิด ${ext['ชนิด']}</div>
                                <div style="font-size: 11px; color: #000; font-weight: normal;">ขนาด ${ext['ขนาด']}</div>
                                <div style="font-size: 11px; color: #000; font-weight: normal;">ถังเลขที่ ${ext['เลขที่ถัง'] || '-'}</div>
                            </div>
                            <div class="flex-shrink-0 ms-1">
                                ${statusBadge}
                            </div>
                        </div>
                        
                        <!-- ปรับแก้ปุ่มสีเหลืองและปุ่มสีเทาตามภาพตัวอย่าง -->
                        <div class="text-end d-flex justify-content-end gap-2 mt-auto pt-1">
                            <button class="btn btn-sm rounded-pill px-3 py-1 fw-bold shadow-sm" style="color: #333; font-size: 11px; background-color: #ffca28; border: none;"
                                onclick="event.stopPropagation(); window.location.href='refill_form.html?dept=${deptKey}&assetCode=${assetCode}&extId=${ext['เลขที่ถัง'] || ''}';">
                                เติมน้ำยา
                            </button>
                            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3 py-1" style="font-size: 11px; color: #555; background-color: #f8f9fa;"
                                    onclick="event.stopPropagation(); showHistoryModal('${assetCode}')">
                                ประวัติการตรวจ
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        `;
    });

    localStorage.setItem('inspectedLog_' + DEPT_NAME, JSON.stringify(inspectedLog));

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

    form.addEventListener('submit', (e) => {
        e.preventDefault();

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

        // 1. สั่งส่งข้อมูลไป Google Sheets เบื้องหลังแบบไม่ต้องรอ (ไม่มี await)
        fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error("Send error:", err));

        // 2. อัปเดตสถานะการ์ดให้เป็น "ตรวจแล้ว" ในเครื่องทันที
        let inspectedLog = JSON.parse(localStorage.getItem('inspectedLog_' + DEPT_NAME) || '{}');
        inspectedLog[assetCode] = {
            timestamp: new Date().getTime(),
            status: isAllPass ? 'pass' : 'fail'
        };
        localStorage.setItem('inspectedLog_' + DEPT_NAME, JSON.stringify(inspectedLog));
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

        const currentYear = new Date().getFullYear() + 543;
        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

        months.forEach((month, index) => {
            const logsForMonth = logs.filter(log => {
                if (!log.timestamp) return false;
                const logParts = log.timestamp.split('/'); 
                if(logParts.length >= 2) {
                   const logMonth = parseInt(logParts[1], 10);
                   return logMonth === (index + 1);
                }
                return false;
            });

            const logEntry = logsForMonth.length > 0 ? logsForMonth[logsForMonth.length - 1] : undefined;

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