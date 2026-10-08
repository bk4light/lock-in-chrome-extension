let blockedUrls = [];
let uiInterval = null;

const urlInput = document.getElementById('urlInput');
const addUrlBtn = document.getElementById('addUrlBtn');
const urlList = document.getElementById('urlList');
const timerMode = document.getElementById('timerMode');
const regularTimerConfig = document.getElementById('regularTimerConfig');
const pomodoroConfig = document.getElementById('pomodoroConfig');
const setupSection = document.getElementById('setupSection');
const activeSection = document.getElementById('activeSection');
const timerDisplay = document.getElementById('timerDisplay');
const statusLabel = document.getElementById('statusLabel');
const startBtn = document.getElementById('startBtn');
const exitBtn = document.getElementById('exitBtn');
const statusMsg = document.getElementById('statusMsg');

// Restore UI state when opening popup
chrome.storage.local.get(['blockedUrls', 'sessionActive', 'endTime', 'currentMode', 'pomoPhase', 'pomoCyclesLeft'], (res) => {
  if (res.blockedUrls) {
    blockedUrls = res.blockedUrls;
    renderUrlList();
  }

  if (res.sessionActive) {
    showActiveUI();
    if (res.currentMode === 'noTimer') {
      timerDisplay.textContent = "∞";
      statusLabel.textContent = "Focus Active (No Timer)";
    } else if (res.endTime) {
      updateUICountdown(res.endTime, res.currentMode, res.pomoPhase, res.pomoCyclesLeft);
    }
  }
});

addUrlBtn.addEventListener('click', () => {
  let val = urlInput.value.trim().toLowerCase();
  val = val.replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (val && !blockedUrls.includes(val)) {
    blockedUrls.push(val);
    chrome.storage.local.set({ blockedUrls });
    renderUrlList();
    urlInput.value = '';
  }
});

function renderUrlList() {
  urlList.innerHTML = '';
  if (blockedUrls.length === 0) {
    urlList.innerHTML = '<span style="color:#A09090;">No URLs added yet.</span>';
    return;
  }
  blockedUrls.forEach((url, idx) => {
    const item = document.createElement('div');
    item.className = 'url-item';
    item.innerHTML = `<span>${url}</span><span class="remove-link" data-idx="${idx}">✕</span>`;
    urlList.appendChild(item);
  });

  document.querySelectorAll('.remove-link').forEach(el => {
    el.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-idx'));
      blockedUrls.splice(idx, 1);
      chrome.storage.local.set({ blockedUrls });
      renderUrlList();
    });
  });
}

timerMode.addEventListener('change', () => {
  const mode = timerMode.value;
  regularTimerConfig.style.display = mode === 'regular' ? 'block' : 'none';
  pomodoroConfig.style.display = mode === 'pomodoro' ? 'block' : 'none';
});

function enableBlocking() {
  const rules = blockedUrls.map((pattern, index) => {
    let escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      id: index + 1,
      priority: 1,
      action: { type: "block" },
      condition: {
        regexFilter: `.*${escaped}.*`,
        resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "other"]
      }
    };
  });
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id),
    addRules: rules
  });
}

function disableBlocking() {
  const ruleIds = Array.from({ length: 50 }, (_, i) => i + 1);
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
}

// Start Session
startBtn.addEventListener('click', () => {
  if (blockedUrls.length === 0) {
    statusMsg.textContent = "Please add at least one URL to block!";
    return;
  }

  const selectedMode = timerMode.value;

  if (selectedMode === 'noTimer') {
    enableBlocking();
    chrome.storage.local.set({ sessionActive: true, currentMode: 'noTimer' });
    timerDisplay.textContent = "∞";
    statusLabel.textContent = "Focus Active (No Timer)";
    showActiveUI();
  } else if (selectedMode === 'regular') {
    enableBlocking();
    let mins = parseInt(document.getElementById('regularMinutes').value) || 25;
    let endTime = Date.now() + (mins * 60 * 1000);
    
    chrome.storage.local.set({ sessionActive: true, currentMode: 'regular', endTime });
    chrome.alarms.create("regularTimerEnd", { when: endTime });
    
    showActiveUI();
    updateUICountdown(endTime, 'regular');
  } else if (selectedMode === 'pomodoro') {
    enableBlocking();
    let workMins = parseInt(document.getElementById('pomoWork').value) || 25;
    let restMins = parseInt(document.getElementById('pomoRest').value) || 5;
    let cycles = parseInt(document.getElementById('pomoCycles').value) || 3;
    let endTime = Date.now() + (workMins * 60 * 1000);

    chrome.storage.local.set({ 
      sessionActive: true, 
      currentMode: 'pomodoro', 
      pomoPhase: 'work', 
      pomoWorkMins: workMins, 
      pomoRestMins: restMins, 
      pomoCyclesLeft: cycles, 
      endTime 
    });

    chrome.alarms.create("pomoAlarm", { when: endTime });
    showActiveUI();
    updateUICountdown(endTime, 'pomodoro', 'work', cycles);
  }
});

function updateUICountdown(endTime, mode, phase, cyclesLeft) {
  clearInterval(uiInterval);
  
  function tick() {
    let remainingMs = endTime - Date.now();
    if (remainingMs <= 0) {
      clearInterval(uiInterval);
      timerDisplay.textContent = "00:00";
      statusLabel.textContent = "Session Complete!";
      return;
    }
    let totalSec = Math.floor(remainingMs / 1000);
    let m = Math.floor(totalSec / 60);
    let s = totalSec % 60;
    timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;

    if (mode === 'regular') {
      statusLabel.textContent = "🔒 Focus Active";
    } else if (mode === 'pomodoro') {
      statusLabel.textContent = phase === 'work' 
        ? `🔒 Work Phase (${cyclesLeft} cycle${cyclesLeft > 1 ? 's' : ''} left)` 
        : `☕ Rest Phase (${cyclesLeft} cycle${cyclesLeft > 1 ? 's' : ''} left)`;
    }
  }

  tick();
  uiInterval = setInterval(tick, 1000);
}

exitBtn.addEventListener('click', () => {
  clearInterval(uiInterval);
  disableBlocking();
  chrome.alarms.clearAll();
  chrome.storage.local.remove(['sessionActive', 'endTime', 'currentMode', 'pomoPhase', 'pomoCyclesLeft', 'pomoWorkMins', 'pomoRestMins']);
  
  setupSection.style.display = 'block';
  activeSection.style.display = 'none';
  statusMsg.textContent = "🔓 Session ended early.";
});

function showActiveUI() {
  setupSection.style.display = 'none';
  activeSection.style.display = 'block';
  statusMsg.textContent = "";
}