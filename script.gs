// ==========================================
// CONFIGURATION
// ==========================================
// Danh sách email nhận thông báo duyệt (ngăn cách bởi dấu phẩy)
const OWNER_EMAILS = [
  "chungkhanh2005@gmail.com",
  "thanhchung8989@gmail.com" 
]; 
// ==========================================
// CORE LOGIC
// ==========================================
function doGet(e) {
  const p = e.parameter;
  const action = p.action;
  
  // 1. Check Status (Extension gọi)
  if (action === "check") {
    const deviceId = p.deviceId;
    if (!deviceId) return jsonResponse({ error: "Missing deviceId" });
    
    const status = getStatus(deviceId);
    return jsonResponse({ status: status }); // "PENDING", "APPROVED", "REVOKED", "NEW"
  }
  // 2. Owner Actions (Click từ Email)
  if (action === "approve" || action === "revoke") {
    const deviceId = p.deviceId;
    const token = p.token; // Security token để tránh người khác mò link
    
    if (!verifyActionToken(deviceId, token)) {
       return HtmlService.createHtmlOutput("<h1>Invalid or Expired Link</h1>");
    }
    const newStatus = action === "approve" ? "APPROVED" : "REVOKED";
    setStatus(deviceId, newStatus);
    
    return HtmlService.createHtmlOutput(`
      <h1 style='color: ${action === "approve" ? "green" : "red"}'>
        DEVICE ${newStatus}
      </h1>
      <p>Device ID: ${deviceId}</p>
      <p>You can close this tab.</p>
    `);
  }
  
  return HtmlService.createHtmlOutput("YouTube Soundbar Auth Server");
}
function doPost(e) {
  try {
    // Nhận request từ Extension
    const data = JSON.parse(e.postData.contents);
    const deviceId = data.deviceId;
    const note = data.note || "No info";
    const ip = data.user_agent || "Unknown"; // Sơ bộ
    
    if (!deviceId) return jsonResponse({ error: "Missing deviceId" });
    // Kiểm tra xem đã tồn tại chưa
    const currentStatus = getStatus(deviceId);
    if (currentStatus === "APPROVED") return jsonResponse({ status: "APPROVED" });
    if (currentStatus === "REVOKED") return jsonResponse({ status: "REVOKED" });
    if (currentStatus === "PENDING") return jsonResponse({ status: "PENDING", message: "Already waiting" });
    // Lưu trạng thái Pending
    setStatus(deviceId, "PENDING");
    
    // Tạo token bảo mật cho link trong email
    const token = createActionToken(deviceId);
    const scriptUrl = ScriptApp.getService().getUrl();
    
    const approveLink = `${scriptUrl}?action=approve&deviceId=${deviceId}&token=${token}`;
    const revokeLink = `${scriptUrl}?action=revoke&deviceId=${deviceId}&token=${token}`;
    
    // Gửi email cho Owner
    const emailBody = `
      <h3>New Access Request</h3>
      <p><strong>Status:</strong> <span style="color:orange">PENDING</span></p>
      <p><strong>Device ID:</strong> ${deviceId}</p>
      <p><strong>Info:</strong> ${note}</p>
      <p><strong>User Agent:</strong> ${ip}</p>
      <hr/>
      <p>
        <a href="${approveLink}" style="padding:10px 20px; background:green; color:white; text-decoration:none; border-radius:5px;">APPROVE (Cho phép)</a>
        &nbsp;&nbsp;
        <a href="${revokeLink}" style="padding:10px 20px; background:red; color:white; text-decoration:none; border-radius:5px;">REVOKE (Chặn)</a>
      </p>
      <p><small>Giữ email này để Revoke sau này nếu cần.</small></p>
    `;
    
    // Gửi cho tất cả owners
    OWNER_EMAILS.forEach(email => {
       if (email && email.trim()) {
         MailApp.sendEmail({
            to: email.trim(),
            subject: `Soundbar Request: ${deviceId.substring(0, 8)}...`,
            htmlBody: emailBody
          });
       }
    });
    
    return jsonResponse({ status: "PENDING", message: "Request sent" });
    
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}
// ==========================================
// DB & UTILS
// ==========================================
function getStatus(id) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty("STATUS_" + id) || "NEW";
}
function setStatus(id, stat) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("STATUS_" + id, stat);
}
function createActionToken(id) {
  // Tạo một token đơn giản dựa trên ID và secret script
  // Trong thực tế nên random và lưu lại, nhưng để đơn giản ta hash
  const secret = ScriptApp.getScriptId(); 
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, id + "SALT" + secret));
}
function verifyActionToken(id, token) {
  return token === createActionToken(id);
}
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function setup() {
    // Chạy hàm này 1 lần để cấp quyền gửi mail nếu cần
    console.log("Setup complete. Current User:", Session.getActiveUser().getEmail());
}