// Listen for Chrome alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.storage.local.get(['currentMode', 'pomoPhase', 'pomoCyclesLeft', 'pomoWorkMins', 'pomoRestMins'], (res) => {
    
    // 1. REGULAR TIMER COMPLETE
    if (alarm.name === "regularTimerEnd") {
      disableBlocking();
      popModalAlert("🎉 Focus Session Complete!", "Great job locking in! Your blocked sites are now accessible.");
      chrome.storage.local.remove(['sessionActive', 'endTime', 'currentMode']);
    } 
    
    // 2. POMODORO TIMER TRANSITIONS
    else if (alarm.name === "pomoAlarm") {
      if (res.pomoPhase === 'work') {
        // Transition from Work -> Rest
        disableBlocking();
        popModalAlert("☕ Work Session Complete!", "Time for a break! Your sites are unblocked. Click OK to start rest timer.");
        
        let restMs = (res.pomoRestMins || 5) * 60 * 1000;
        let nextEndTime = Date.now() + restMs;
        
        chrome.storage.local.set({ pomoPhase: 'rest', endTime: nextEndTime });
        chrome.alarms.create("pomoAlarm", { when: nextEndTime });
      } 
      else if (res.pomoPhase === 'rest') {
        let remainingCycles = (res.pomoCyclesLeft || 1) - 1;
        
        if (remainingCycles > 0) {
          // Transition from Rest -> Work (Next Cycle)
          enableBlocking();
          popModalAlert("🔒 Break Finished!", `Time to lock back in! Starting cycle ${remainingCycles}. Click OK to continue.`);
          
          let workMs = (res.pomoWorkMins || 25) * 60 * 1000;
          let nextEndTime = Date.now() + workMs;
          
          chrome.storage.local.set({ pomoPhase: 'work', pomoCyclesLeft: remainingCycles, endTime: nextEndTime });
          chrome.alarms.create("pomoAlarm", { when: nextEndTime });
        } else {
          // All Pomodoro Cycles Finished
          disableBlocking();
          popModalAlert("🎉 All Pomodoro Cycles Complete!", "You finished all your planned focus cycles! Great job.");
          chrome.storage.local.remove(['sessionActive', 'endTime', 'currentMode', 'pomoPhase', 'pomoCyclesLeft', 'pomoWorkMins', 'pomoRestMins']);
        }
      }
    }
  });
});

// Force a visible on-screen alert box (with "OK" button) on your active browser tab
function popModalAlert(title, message) {
  // macOS / Chrome Native Notification
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      title: title,
      message: message,
      priority: 2
    });
  } catch (e) {
    console.log("Notification error:", e);
  }

  // On-screen modal window alert
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (alertTitle, alertMessage) => {
          alert(`${alertTitle}\n\n${alertMessage}`);
        },
        args: [title, message]
      }).catch(err => console.log("Script injection skipped on internal page:", err));
    }
  });
}

function enableBlocking() {
  chrome.storage.local.get(['blockedUrls'], (res) => {
    let urls = res.blockedUrls || [];
    let rules = urls.map((pattern, index) => {
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
  });
}

function disableBlocking() {
  let ruleIds = Array.from({ length: 50 }, (_, i) => i + 1);
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
}