
// ==================== DIRECT MESSAGING ====================
let currentDMChatUser = null;
function openDMModal() {
  document.getElementById('dmModal').classList.remove('hidden');
  loadDMs();
}
function closeDMModal() {
  document.getElementById('dmModal').classList.add('hidden');
}
function loadDMs() {
  const inboxList = document.getElementById('dmChatList');
  if (!inboxList) return;
  
  pawCache.directMessages = pawCache.directMessages || [];
  const chats = {};
  pawCache.directMessages.forEach(msg => {
    const otherUser = msg.sender === 'Me' ? msg.recipient : msg.sender;
    if (!chats[otherUser]) chats[otherUser] = [];
    chats[otherUser].push(msg);
  });
  
  let html = '';
  Object.keys(chats).forEach(user => {
    const msgs = chats[user];
    const lastMsg = msgs[msgs.length - 1];
    html += `<div class="dm-chat-item" onclick="openDMChat('${user}')" style="display:flex;align-items:center;padding:12px;border-bottom:1px solid var(--border);cursor:pointer">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold">${user.charAt(0)}</div>
      <div style="margin-left:12px;flex:1">
        <div style="font-weight:bold">${user}</div>
        <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lastMsg.text}</div>
      </div>
    </div>`;
  });
  if (!html) html = '<div style="text-align:center;padding:20px;color:var(--muted)">No messages yet.</div>';
  inboxList.innerHTML = html;
}

function showNewDMView() {
  document.getElementById('dmInboxView').classList.add('hidden');
  document.getElementById('dmSearchView').classList.remove('hidden');
}
function backToInbox() {
  document.getElementById('dmChatView').classList.add('hidden');
  document.getElementById('dmSearchView').classList.add('hidden');
  document.getElementById('dmInboxView').classList.remove('hidden');
  loadDMs();
}
function searchUsers() {
  const query = document.getElementById('dmSearchInput').value.trim();
  if (!query) return;
  const results = document.getElementById('dmSearchList');
  results.innerHTML = `<div style="padding:12px;cursor:pointer" onclick="openDMChat('${query}')"><b>${query}</b> - Tap to chat</div>`;
}
function openDMChat(user) {
  currentDMChatUser = user;
  document.getElementById('dmInboxView').classList.add('hidden');
  document.getElementById('dmSearchView').classList.add('hidden');
  document.getElementById('dmChatView').classList.remove('hidden');
  document.getElementById('dmChatRecipientName').innerText = user;
  renderDMChat();
}
function renderDMChat() {
  const list = document.getElementById('dmMessageList');
  if (!list) return;
  pawCache.directMessages = pawCache.directMessages || [];
  const msgs = pawCache.directMessages.filter(m => 
    (m.sender === 'Me' && m.recipient === currentDMChatUser) || 
    (m.sender === currentDMChatUser && m.recipient === 'Me')
  );
  
  list.innerHTML = msgs.map(m => `
    <div style="display:flex;justify-content:${m.sender === 'Me' ? 'flex-end' : 'flex-start'}">
      <div style="max-width:70%;padding:10px 14px;border-radius:18px;background:${m.sender === 'Me' ? 'var(--primary)' : 'var(--input-bg)'};color:${m.sender === 'Me' ? '#fff' : 'var(--dark)'};font-size:14px">
        ${m.text}
      </div>
    </div>
  `).join('');
  list.scrollTop = list.scrollHeight;
}
function sendDM() {
  const input = document.getElementById('dmInput');
  const text = input.value.trim();
  if (!text || !currentDMChatUser) return;
  
  pawCache.directMessages = pawCache.directMessages || [];
  pawCache.directMessages.push({
    id: Date.now(),
    sender: 'Me',
    recipient: currentDMChatUser,
    text,
    timestamp: new Date().toISOString()
  });
  savePawCache();
  input.value = '';
  renderDMChat();
}
