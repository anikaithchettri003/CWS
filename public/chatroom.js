// Read params from URL safely
function q(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || '';
  } catch (e) {
    return '';
  }
}

const username = (q('username') || 'Anon').slice(0, 30);
const gender = (q('gender') || 'unknown').slice(0, 20);

// DOM refs
const youNameEl = document.getElementById('youName');
const youMetaEl = document.getElementById('youMeta');
const partnerNameEl = document.getElementById('partnerName');
const partnerMetaEl = document.getElementById('partnerMeta');
const messagesEl = document.getElementById('messages');
const form = document.getElementById('msgForm');
const input = document.getElementById('msgInput');
const actionBtn = document.getElementById('actionBtn');

// Initialize header and status
youNameEl.textContent = `${username} | ${gender}`;
youMetaEl.innerHTML = `<span class="status-dot status-wait"></span> Waiting...`;
partnerNameEl.textContent = 'Searching...';
partnerMetaEl.textContent = '—';

const socket = io();
let connected = false;

// helper: safe time string
function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

// Add system line
function addSystem(text) {
  const el = document.createElement('div');
  el.className = 'chat-system';
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Add message bubble
function addMessage(text, me = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-bubble ' + (me ? 'me' : 'them');

  // message text
  const txt = document.createElement('div');
  txt.textContent = text;
  wrapper.appendChild(txt);

  // meta (time)
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = timeNow();
  wrapper.appendChild(meta);

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// update next/leave button state
function updateActionBtn() {
  if (connected) {
    actionBtn.textContent = 'Leave';
    actionBtn.classList.add('leave');
  } else {
    actionBtn.textContent = 'Next';
    actionBtn.classList.remove('leave');
  }
}

// Join with info
socket.emit('join', { username, gender });

// Event handlers from server
socket.on('system', (msg) => {
  addSystem(msg);

  const lower = (msg || '').toLowerCase();
  if (lower.includes('waiting') || lower.includes('searching')) {
    // partner not connected
    connected = false;
    youMetaEl.innerHTML = `<span class="status-dot status-wait"></span> Waiting...`;
    partnerNameEl.textContent = 'Searching...';
    partnerMetaEl.textContent = '—';
    updateActionBtn();
  }

  if (lower.includes('connected') || lower.includes('you are now connected')) {
    // server also emits matched; keep minimal here
  }
});

socket.on('matched', (data) => {
  connected = true;

  const partnerGender = data?.partnerGender || 'unknown';
  // update header: show partner simple info & online dot
  partnerNameEl.textContent = `Partner (${partnerGender})`;
  partnerMetaEl.innerHTML = `<span class="status-dot status-online"></span> Online`;

  youMetaEl.innerHTML = `<span class="status-dot status-online"></span> Connected`;
  addSystem(`Matched with someone (${partnerGender}) — say hi!`);

  updateActionBtn();
});

socket.on('chat message', (msg) => {
  // add partner message
  addMessage(msg, false);
});

// Send message
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  // locally show message immediately
  addMessage(text, true);
  socket.emit('chat message', text);
  input.value = '';
  input.focus();
});

// Next/Leave button
actionBtn.addEventListener('click', () => {
  // if connected -> Leave (effectively acts like 'next' and returns to waiting)
  socket.emit('next');
  connected = false;
  youMetaEl.innerHTML = `<span class="status-dot status-wait"></span> Waiting...`;
  partnerNameEl.textContent = 'Searching...';
  partnerMetaEl.textContent = '—';
  updateActionBtn();
  addSystem('Searching for a new partner...');
});

// safety: detect socket disconnect locally
socket.on('disconnect', () => {
  connected = false;
  youMetaEl.innerHTML = `<span class="status-dot status-off"></span> Disconnected`;
  partnerNameEl.textContent = 'Searching...';
  partnerMetaEl.textContent = '—';
  updateActionBtn();
  addSystem('Connection lost. Trying to reconnect...');
});

// attempt reconnect message
socket.on('reconnect', () => {
  addSystem('Reconnected to server.');
  socket.emit('join', { username, gender });
});

// keyboard accessibility: Enter sends. Escape clears.
input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '';
  }
});

// ensure scroll when window resizes
window.addEventListener('resize', () => {
  messagesEl.scrollTop = messagesEl.scrollHeight;
});
