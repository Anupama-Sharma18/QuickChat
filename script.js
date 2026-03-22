const API_URL = "https://z8km24rfx8.execute-api.ap-south-1.amazonaws.com/prod";


const USER_COLORS = [
  "#4f8ef7", "#f43f5e", "#f59e0b", "#8b5cf6",
  "#10b981", "#ef4444", "#3b82f6", "#ec4899",
];

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('show');
}

// ── LOCALSTORAGE HELPERS ───────────────────────────

function getUsers() {
  return JSON.parse(localStorage.getItem("qc_users") || "{}");
}
function saveUsers(users) {
  localStorage.setItem("qc_users", JSON.stringify(users));
}

function getLoggedIn() {
  return localStorage.getItem("qc_loggedin") || null;
}
function setLoggedIn(username) {
  localStorage.setItem("qc_loggedin", username);
}
function clearLoggedIn() {
  localStorage.removeItem("qc_loggedin");
}

function getOnlineUsers() {
  return JSON.parse(localStorage.getItem("qc_online") || "[]");
}
function setOnlineUsers(arr) {
  localStorage.setItem("qc_online", JSON.stringify(arr));
}
function markOnline(username) {
  const list = getOnlineUsers();
  if (!list.includes(username)) { list.push(username); setOnlineUsers(list); }
}
function markOffline(username) {
  const list = getOnlineUsers().filter(u => u !== username);
  setOnlineUsers(list);
}

function getRoomMessages(room) {
  return JSON.parse(localStorage.getItem("qc_room_" + room) || "[]");
}
function saveRoomMessages(room, msgs) {
  localStorage.setItem("qc_room_" + room, JSON.stringify(msgs));
}

async function addMessage(room, msgObj) {
  // LocalStorage backup
  const msgs = getRoomMessages(room);
  msgs.push(msgObj);
  saveRoomMessages(room, msgs);

  // AWS mein save karo
  try {
    await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msgObj),
    });
  } catch (err) {
    console.warn("AWS error:", err);
  }
}


// ── STATE ──────────────────────────────────────────
let currentUser = null;
let currentRoom = "general";


// ── PAGE NAVIGATION ────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}


// ── REGISTER ──────────────────────────────────────
function doRegister() {
  const name     = document.getElementById("reg-name").value.trim();
  const username = document.getElementById("reg-username").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;
  const errEl    = document.getElementById("reg-error");

  errEl.textContent = "";

  if (!name)                           { errEl.textContent = "Please enter your name."; return; }
  if (!username)                       { errEl.textContent = "Please choose a username."; return; }
  if (username.length < 3)             { errEl.textContent = "Username must be at least 3 characters."; return; }
  if (!/^[a-z0-9_]+$/.test(username)) { errEl.textContent = "Username: only letters, numbers, underscore."; return; }
  if (!password)                       { errEl.textContent = "Please enter a password."; return; }
  if (password.length < 4)             { errEl.textContent = "Password must be at least 4 characters."; return; }

  const users = getUsers();
  if (users[username])                 { errEl.textContent = "Username already taken!"; return; }

  const colorIndex = Object.keys(users).length % USER_COLORS.length;

  users[username] = {
    name,
    password,
    avatar: "",
    color: USER_COLORS[colorIndex],
  };
  saveUsers(users);

  // ✅ FIX: Register ke baad login page pe bhejo, auto-login nahi
  showPage("page-login");
  document.getElementById("login-username").value = username;
  document.getElementById("login-error").textContent = "";

  // Green success message
  const loginErrEl = document.getElementById("login-error");
  loginErrEl.style.color = "#22c55e";
  loginErrEl.textContent = "✅ Account created! Please login now.";
}


// ── LOGIN ──────────────────────────────────────────
function doLogin() {
  const username = document.getElementById("login-username").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("login-error");

  errEl.textContent = "";
  errEl.style.color = "#ef4444"; // reset to red for errors

  if (!username) { errEl.textContent = "Please enter your username."; return; }
  if (!password) { errEl.textContent = "Please enter your password."; return; }

  const users = getUsers();
  if (!users[username])                      { errEl.textContent = "Username not found."; return; }
  if (users[username].password !== password) { errEl.textContent = "Incorrect password."; return; }

  loginUser(username);
}

function loginUser(username) {
  setLoggedIn(username);
  markOnline(username);
  initApp(username);
}


// ── LOGOUT ─────────────────────────────────────────
function doLogout() {
  if (currentUser) markOffline(currentUser.username);
  clearLoggedIn();
  currentUser = null;

  ["login-username","login-password","reg-name","reg-username","reg-password"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("login-error").textContent = "";
  document.getElementById("login-error").style.color = "#ef4444";
  document.getElementById("reg-error").textContent   = "";

  showPage("page-login");
}


// ── INIT APP ───────────────────────────────────────
function initApp(username) {
  const users = getUsers();
  const user  = users[username];
  currentUser = { username, ...user };

  updateSidebarProfile();
  renderMembersList();

  currentRoom = "general";
  document.querySelectorAll(".room-item").forEach(r => r.classList.remove("active"));
  document.querySelectorAll(".room-item")[0].classList.add("active");
  document.getElementById("room-title").textContent = "general";
  document.getElementById("msg-input").placeholder  = "Message #general...";

  loadRoomMessages("general");
  showPage("page-app");
}


// ── SIDEBAR PROFILE UPDATE ─────────────────────────
function updateSidebarProfile() {
  document.getElementById("sidebar-name").textContent     = currentUser.name;
  document.getElementById("sidebar-initials").textContent = currentUser.name[0].toUpperCase();

  const img = document.getElementById("sidebar-avatar");
  if (currentUser.avatar) {
    img.src           = currentUser.avatar;
    img.style.display = "block";
    document.getElementById("sidebar-initials").style.display = "none";
  } else {
    img.style.display = "none";
    document.getElementById("sidebar-initials").style.display = "flex";
  }

  document.getElementById("sidebar-initials").style.background = currentUser.color;
}


// ── MEMBERS LIST ───────────────────────────────────
function renderMembersList() {
  const users  = getUsers();
  const online = getOnlineUsers();
  const list   = document.getElementById("members-list");
  list.innerHTML = "";

  const sorted = Object.keys(users).sort((a, b) => {
    return (online.includes(a) ? 0 : 1) - (online.includes(b) ? 0 : 1);
  });

  sorted.forEach(uname => {
    const u        = users[uname];
    const isOnline = online.includes(uname);
    const isMe     = uname === currentUser.username;

    const item = document.createElement("div");
    item.className = `member-item ${isOnline ? "is-online" : ""}`;

    const avatarHtml = u.avatar
      ? `<img class="member-img" src="${u.avatar}" style="display:block"/>
         <div class="member-initials" style="background:${u.color};display:none">${u.name[0].toUpperCase()}</div>`
      : `<img class="member-img" style="display:none"/>
         <div class="member-initials" style="background:${u.color}">${u.name[0].toUpperCase()}</div>`;

    item.innerHTML = `
      <div class="member-avatar-wrap">
        ${avatarHtml}
        <div class="member-status-dot ${isOnline ? "status-online" : "status-offline"}"></div>
      </div>
      <span class="member-name">${escHtml(u.name)}${isMe ? " (you)" : ""}</span>`;

    list.appendChild(item);
  });

  const onlineCount = online.length;
  document.getElementById("room-sub").textContent = `${onlineCount} member${onlineCount !== 1 ? "s" : ""} online`;
}


// ── SWITCH ROOM ────────────────────────────────────
function switchRoom(roomName, el) {
  currentRoom = roomName;
  document.querySelectorAll(".room-item").forEach(r => r.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("room-title").textContent = roomName;
  document.getElementById("msg-input").placeholder  = `Message #${roomName}...`;
  hideTyping();
  loadRoomMessages(roomName);
}


// ── LOAD ROOM MESSAGES ─────────────────────────────
async function loadRoomMessages(room) {
  const box = document.getElementById("messages-box");
  box.innerHTML = "";
  addDateDivider("Today");

  // Pehle localStorage se dikhao (fast)
  const localMsgs = getRoomMessages(room);
  localMsgs.forEach(m => {
    const isSent = m.sender === currentUser.username;
    renderMessage(m.sender, m.senderName, m.text, m.time, isSent, m.avatar, m.color, m.messageId);
  });

  // Phir AWS se fetch karo aur jo missing hain wo add karo
  try {
    const res  = await fetch(`${API_URL}/messages?room=${room}`);
    const data = await res.json();
    const existingIds = new Set(localMsgs.map(m => m.messageId));

    let added = false;
    (data.messages || []).forEach(m => {
      if (!existingIds.has(m.messageId)) {
        const isSent = m.sender === currentUser.username;
        const time   = m.time || new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        renderMessage(m.sender, m.senderName, m.text, time, isSent, m.avatar, m.color, m.messageId);
        localMsgs.push({ ...m, time });
        added = true;
      }
    });

    if (added) saveRoomMessages(room, localMsgs);
  } catch (err) {
    console.warn("Could not fetch from AWS:", err);
  }

  addSysMsg(`${currentUser.name} joined #${room}`);
  scrollBottom();
}


// ── SEND MESSAGE ───────────────────────────────────
function sendMessage() {
  const input = document.getElementById("msg-input");
  const text  = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";

  const time      = getTime();
  const messageId = Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const msgObj = {
    messageId,
    sender:     currentUser.username,
    senderName: currentUser.name,
    text,
    time,
    room:   currentRoom,
    avatar: currentUser.avatar || "",
    color:  currentUser.color,
  };

  addMessage(currentRoom, msgObj);

  // ✅ FIX: messageId pass karo renderMessage ko
  renderMessage(msgObj.sender, msgObj.senderName, msgObj.text, msgObj.time, true, msgObj.avatar, msgObj.color, msgObj.messageId);
  scrollBottom();
}


// ── RENDER ONE MESSAGE ─────────────────────────────
// ✅ FIX: msgId parameter add kiya — DOM element pe store hoga duplicate check ke liye
function renderMessage(sender, senderName, text, time, isSent, avatar, color, msgId = "") {
  const box = document.getElementById("messages-box");
  const row = document.createElement("div");
  row.className      = `msg-row ${isSent ? "sent" : "recv"}`;
  row.dataset.msgId  = msgId; // ← polling duplicate check ke liye

  const initial    = (senderName || sender)[0].toUpperCase();
  const avatarHtml = avatar
    ? `<img class="msg-avatar-img" src="${avatar}" style="display:block"/>
       <div class="msg-avatar-initials" style="background:${color};display:none">${initial}</div>`
    : `<img class="msg-avatar-img" style="display:none"/>
       <div class="msg-avatar-initials" style="background:${color}">${initial}</div>`;

  row.innerHTML = `
    <div class="msg-avatar-wrap">${avatarHtml}</div>
    <div class="msg-content">
      ${!isSent ? `<div class="msg-sender-name">${escHtml(senderName || sender)}</div>` : ""}
      <div class="msg-bubble">${escHtml(text)}</div>
      <div class="msg-time">${time}</div>
    </div>`;

  box.appendChild(row);
}


// ── PROFILE MODAL ──────────────────────────────────
function openProfile() {
  document.getElementById("modal-name").value        = currentUser.name;
  document.getElementById("modal-username").value    = currentUser.username;
  document.getElementById("modal-error").textContent = "";

  const previewImg      = document.getElementById("modal-avatar-img");
  const previewInitials = document.getElementById("modal-avatar-initials");

  if (currentUser.avatar) {
    previewImg.src              = currentUser.avatar;
    previewImg.style.display    = "block";
    previewInitials.style.display = "none";
  } else {
    previewImg.style.display    = "none";
    previewInitials.style.display = "flex";
  }

  previewInitials.textContent      = currentUser.name[0].toUpperCase();
  previewInitials.style.background = currentUser.color;

  document.getElementById("profile-modal").classList.add("open");
}

function closeProfile() {
  document.getElementById("profile-modal").classList.remove("open");
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    document.getElementById("modal-error").textContent = "Please select an image file.";
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    document.getElementById("modal-error").textContent = "Image too large. Max 2MB.";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64      = e.target.result;
    const previewImg  = document.getElementById("modal-avatar-img");
    const previewInit = document.getElementById("modal-avatar-initials");
    previewImg.src              = base64;
    previewImg.style.display    = "block";
    previewInit.style.display   = "none";
    previewImg.dataset.newAvatar = base64;
  };
  reader.readAsDataURL(file);
}

function removePhoto() {
  const previewImg  = document.getElementById("modal-avatar-img");
  const previewInit = document.getElementById("modal-avatar-initials");
  previewImg.src               = "";
  previewImg.style.display     = "none";
  previewImg.dataset.newAvatar = "REMOVE";
  previewInit.style.display    = "flex";
}

function saveProfile() {
  const newName = document.getElementById("modal-name").value.trim();
  const errEl   = document.getElementById("modal-error");

  errEl.textContent = "";
  if (!newName) { errEl.textContent = "Name cannot be empty."; return; }

  const previewImg    = document.getElementById("modal-avatar-img");
  const newAvatarFlag = previewImg.dataset.newAvatar;

  let newAvatar = currentUser.avatar;
  if (newAvatarFlag === "REMOVE") {
    newAvatar = "";
  } else if (newAvatarFlag) {
    newAvatar = newAvatarFlag;
  }

  const users = getUsers();
  users[currentUser.username].name   = newName;
  users[currentUser.username].avatar = newAvatar;
  saveUsers(users);

  currentUser.name   = newName;
  currentUser.avatar = newAvatar;

  updateSidebarProfile();
  renderMembersList();

  previewImg.dataset.newAvatar = "";
  document.getElementById("avatar-upload").value = "";

  closeProfile();
}


// ── TYPING ─────────────────────────────────────────
function showTyping() {
  document.getElementById("typing-indicator").style.display = "flex";
}
function hideTyping() {
  document.getElementById("typing-indicator").style.display = "none";
}


// ── EMOJI ──────────────────────────────────────────
function toggleEmoji() {
  const panel = document.getElementById("emoji-panel");
  panel.style.display = panel.style.display === "flex" ? "none" : "flex";
}


// ── HELPERS ────────────────────────────────────────
function addDateDivider(label) {
  const el       = document.createElement("div");
  el.className   = "date-divider";
  el.textContent = label;
  document.getElementById("messages-box").appendChild(el);
}

function addSysMsg(text) {
  const el       = document.createElement("div");
  el.className   = "sys-msg";
  el.textContent = `— ${text} —`;
  document.getElementById("messages-box").appendChild(el);
}

function scrollBottom() {
  const b   = document.getElementById("messages-box");
  b.scrollTop = b.scrollHeight;
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ── DOM READY ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // Emoji click → insert into input
  document.getElementById("emoji-panel").addEventListener("click", e => {
    if (e.target.tagName === "SPAN") {
      const input   = document.getElementById("msg-input");
      input.value  += e.target.textContent.trim();
      input.focus();
      document.getElementById("emoji-panel").style.display = "none";
    }
  });

  // Close emoji panel on outside click
  document.addEventListener("click", e => {
    if (!e.target.closest(".emoji-btn") && !e.target.closest(".emoji-panel")) {
      document.getElementById("emoji-panel").style.display = "none";
    }
  });

  // Enter = send, Shift+Enter = newline
  const msgInput = document.getElementById("msg-input");
  msgInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  msgInput.addEventListener("input", () => {
    msgInput.style.height = "auto";
    msgInput.style.height = Math.min(msgInput.scrollHeight, 100) + "px";
  });

  // Enter on login/register screens
  document.getElementById("login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("reg-password").addEventListener("keydown", e => {
    if (e.key === "Enter") doRegister();
  });

  // Close modal on overlay click
  document.getElementById("profile-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("profile-modal")) closeProfile();
  });

  // Auto-login if session exists
  const saved = getLoggedIn();
  if (saved && getUsers()[saved]) {
    loginUser(saved);
  }

  // Members list refresh every 5s
  setInterval(() => {
    if (currentUser) renderMembersList();
  }, 5000);

  // Mark offline on tab close
  window.addEventListener("beforeunload", () => {
    if (currentUser) markOffline(currentUser.username);
  });

  // ── POLLING — har 3 second mein AWS se naye messages fetch karo ──
  setInterval(async () => {
    if (!currentUser) return;
    try {
      const res  = await fetch(`${API_URL}/messages?room=${currentRoom}`);
      const data = await res.json();
      if (!data.messages || data.messages.length === 0) return;

      // ✅ FIX: localStorage ke IDs ki jagah DOM pe rendered message IDs check karo
      // Isse doosre users ke messages bhi correctly aayenge
      const renderedIds = new Set(
        Array.from(document.querySelectorAll(".msg-row[data-msg-id]"))
             .map(el => el.dataset.msgId)
             .filter(Boolean)
      );

      let hasNew = false;

      data.messages.forEach(m => {
        if (!renderedIds.has(m.messageId)) {
          const isSent = m.sender === currentUser.username;
          const time   = m.time || new Date(m.timestamp).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit"
          });
          renderMessage(m.sender, m.senderName, m.text, time, isSent, m.avatar, m.color, m.messageId);
          hasNew = true;

          // localStorage mein bhi save karo
          const local = getRoomMessages(currentRoom);
          if (!local.find(x => x.messageId === m.messageId)) {
            local.push({ ...m, time });
            saveRoomMessages(currentRoom, local);
          }
        }
      });

      if (hasNew) scrollBottom();

    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 3000);

});
