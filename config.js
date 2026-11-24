// ==========================================
// ไฟล์ตั้งค่าส่วนกลาง (Global Configuration)
// ==========================================

const CONFIG = {
    // 1. ลิงก์ Web App จาก Google Apps Script (เปลี่ยนที่นี่ที่เดียว)
    GAS_URL: 'https://script.google.com/macros/s/AKfycby6fRJJsptv_n8bh5CN7kn3NOniSjMPdULbBA0wGHBTdyUGgidUtQjIoLRxVoXhNv-y/exec',
    
    // เปิดเฉพาะ URL Apps Script ที่ตรวจแล้วว่ามีตัวบันทึกผลตรวจโคมไฟฉุกเฉิน
    EMERGENCY_LIGHT_INVENTORY_URL: '',

    // 2. ลิงก์สำหรับโหลดไฟล์ APK (ถ้ามี)
    APK_LINK: 'https://example.com/download/fire-app.apk',
    
    // 3. ชื่อระบบ (เผื่ออยากเปลี่ยนชื่อทีเดียวทุกหน้า)
    APP_NAME: 'ระบบตรวจถังดับเพลิงออนไลน์',
    
    // 4. เวอร์ชันแอปพลิเคชัน
    VERSION: '1.1.1'
};