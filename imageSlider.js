// 1. ฟังก์ชันนี้ทำหน้าที่แปลงลิงก์ Google Drive ธรรมดา ให้เป็นลิงก์ "รูปย่อ" เพื่อให้โหลดไวสุดๆ
function convertDriveLink(url) {
    // ถ้าไม่มีลิงก์ส่งมา ให้ใช้รูป default.jpg
    if (!url || url.trim() === "" || url === "-") {
        return "images/default.jpg";
    }
    
    let fileId = "";
    // ดักจับหา รหัสไฟล์ (File ID) จากลิงก์ Google Drive
    let matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    let matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    
    if (matchD && matchD[1]) {
        fileId = matchD[1];
    } else if (matchId && matchId[1]) {
        fileId = matchId[1];
    }
    
    // ถ้าหารหัสไฟล์เจอ ให้สร้างลิงก์แบบ Thumbnail (กว้าง 400px โหลดไวแน่นอน)
    if (fileId !== "") {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }
    
    // ถ้าไม่ใช่ลิงก์ Google Drive ให้คืนค่าลิงก์เดิมไปเลย
    return url; 
}

function getFireExtinguisherImageBlock(exId) {
    let imagePath1 = `images/${exId}_1.jpg`;
    let imagePath2 = `images/${exId}_2.jpg`;
    // ลบ imagePath3 ออกไปแล้ว

    return `
      <div class="me-3 flex-shrink-0 auto-slider-container">
        <div class="auto-slider-track">
          <img src="${imagePath1}" onerror="this.onerror=null; this.src='images/default.jpg';">
          <img src="${imagePath2}" onerror="this.onerror=null; this.src='images/default.jpg';">
        </div>
      </div>
    `;
}