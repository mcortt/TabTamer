var detachedTabs = new Map();
var refreshIntervals = new Map();
var pageActionStates = new Map();

const menuItems = [
  { id: "_execute_detach_tab", title: "Detach Tab" },
  { id: "_execute_merge_windows", title: "Merge All Windows" },
  { id: "separator-2", type: "separator" },
  { id: "_execute_close_tabs_to_left", title: "Close Tabs To Left" },
  { id: "_execute_close_tabs_to_right", title: "Close Tabs To Right" },
  { id: "_execute_close_other_tabs", title: "Close Other Tabs" },
  { id: "_execute_remove_duplicates", title: "Remove Duplicate Tabs" },
  { id: "_set_refresh_interval", title: "Auto Refresh Page" },
];

function convertTimeToMilliseconds(time) {
  let value = parseInt(time.slice(0, -1));
  let unit = time.slice(-1);

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
  }
}

function updateContextMenu(enable) {
  if (enable) {
    browser.storage.sync.get(menuItems.map(item => item.id), function(results) {
      menuItems.forEach(item => {
        if (browser.contextMenus.remove(item.id)) {
          browser.contextMenus.remove(item.id);
        }
        if (results[item.id] !== false) {
          let id = browser.contextMenus.create({
            id: item.id,
            title: item.title,
            type: item.type,
            contexts: ["tab"],
          });

          if (item.id === "_set_refresh_interval") {
            ["5s", "10s", "15s", "30s", "45s", "1m", "2m", "5m", "10m", "15m", "30m", "45m", "1h"].forEach(time => {
              browser.contextMenus.create({
                id: `_set_refresh_interval_${time}`,
                title: time,
                parentId: id,
                contexts: ["tab"],
              });
            });
          }
        }
      });
    });
  } else {
    browser.contextMenus.removeAll();
  }
}

async function executeCommand(command, info) {
  console.log("executeCommand called with command: ", command);
  console.trace(); 
  let tabs = await browser.tabs.query({currentWindow: true, highlighted: true});
  let currentTab = tabs[0];
  let allTabs, tabsToClose;

  switch (command) {
    case "_execute_detach_tab":
      let selectedTabs = await browser.tabs.query({windowId: currentTab.windowId, highlighted: true});
      if (selectedTabs.length > 0) {
        let newWin = await browser.windows.create({tabId: selectedTabs[0].id});
        let movePromises = selectedTabs.slice(1).map((tab, i) => {
          detachedTabs.set(tab.id, tab.index);
          return browser.tabs.move(tab.id, {windowId: newWin.id, index: -1}); 
        });
        await Promise.all(movePromises);
      }
      break;

    case "_execute_merge_windows":
      let windows = await browser.windows.getAll({windowTypes: ["normal"]});
      allTabs = [];
      for (let win of windows) {
        let winTabs = await browser.tabs.query({windowId: win.id});
        allTabs = allTabs.concat(winTabs);
      }
      if (allTabs.length > 0) {
        let newWin = await browser.windows.create({tabId: allTabs[0].id});
        let movePromises = allTabs.slice(1).map((tab, i) => {
          return browser.tabs.move(tab.id, {windowId: newWin.id, index: -1}); 
        });
        await Promise.all(movePromises);
        await browser.tabs.update(currentTab.id, {active: true});
        windows = await browser.windows.getAll({windowTypes: ["normal"]}); 
        for (let win of windows) {
          if (win.id !== newWin.id) {
            await browser.windows.remove(win.id);
          }
        }
      }
      break;
    case "_execute_close_tabs_to_right":
      allTabs = await browser.tabs.query({currentWindow: true});
      tabsToClose = allTabs.filter(tab => tab.index > currentTab.index);
      tabsToClose.forEach(tab => browser.tabs.remove(tab.id));
      break;
    case "_execute_close_tabs_to_left":
      allTabs = await browser.tabs.query({currentWindow: true});
      tabsToClose = allTabs.filter(tab => tab.index < currentTab.index);
      tabsToClose.forEach(tab => browser.tabs.remove(tab.id));
      break;
    case "_execute_close_other_tabs":
      allTabs = await browser.tabs.query({currentWindow: true});
      tabsToClose = allTabs.filter(tab => tab.id !== currentTab.id);
      tabsToClose.forEach(tab => browser.tabs.remove(tab.id));
      break;
    case "_execute_remove_duplicates":
      allTabs = await browser.tabs.query({currentWindow: true});
      let urls = new Set();
      let duplicateTabs = allTabs.filter(tab => {
        if (urls.has(tab.url)) {
          return true;
        } else {
          urls.add(tab.url);
          return false;
        }
      });
      duplicateTabs.forEach(tab => browser.tabs.remove(tab.id));
      break;
      case "_set_refresh_interval_5s":
      case "_set_refresh_interval_10s":
      case "_set_refresh_interval_15s":
      case "_set_refresh_interval_30s":
      case "_set_refresh_interval_45s":
      case "_set_refresh_interval_1m":
      case "_set_refresh_interval_2m":
      case "_set_refresh_interval_5m":
      case "_set_refresh_interval_10m":
      case "_set_refresh_interval_15m":
      case "_set_refresh_interval_30m":
      case "_set_refresh_interval_45m":
      case "_set_refresh_interval_1h":
        let time = command.split("_set_refresh_interval_")[1];
        let interval = convertTimeToMilliseconds(time);
      
        if (refreshIntervals.has(currentTab.id)) {
          clearInterval(refreshIntervals.get(currentTab.id));
          refreshIntervals.delete(currentTab.id);
        }
      
        refreshIntervals.set(currentTab.id, setInterval(() => {
          browser.tabs.reload(currentTab.id);
        }, interval));
        currentRefreshInterval = command;
        browser.pageAction.show(currentTab.id);
        break;
    }
}

browser.runtime.onStartup.addListener(() => {
  browser.storage.sync.get(['maximizeOnStartup'], function(result) {
      if (result.maximizeOnStartup) {
          browser.windows.getCurrent((window) => {
              if (window.state !== 'maximized') {
                  browser.windows.update(window.id, { state: 'maximized' });
              }
          });
      }
  });
});

browser.windows.onCreated.addListener((window) => {
  browser.storage.sync.get(['maximizeNewWindows'], function(result) {
      if (result.maximizeNewWindows) {
          if (window.state !== 'maximized' && window.type !== 'popup') {
              browser.windows.update(window.id, { state: 'maximized' });
          }
      }
  });
});

browser.storage.sync.get(['enableContextMenu'], function(result) {
  let enableContextMenu = result.hasOwnProperty('enableContextMenu') ? result.enableContextMenu : true;
  updateContextMenu(enableContextMenu);
});

browser.storage.onChanged.addListener(function(changes, namespace) {
  if (changes.hasOwnProperty('enableContextMenu')) {
    updateContextMenu(changes.enableContextMenu.newValue);
  } else {
    menuItems.forEach(item => {
      if (changes.hasOwnProperty(item.id)) {
        updateContextMenu(changes[item.id].newValue);
      }
    });
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message.command === 'set_refresh_interval') {
    if (refreshIntervalId !== null) {
      clearInterval(refreshIntervalId);
    }
    
    refreshIntervalId = setInterval(() => {
      browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
        browser.tabs.reload(tabs[0].id);
      });
    }, message.interval * 1000); 

    browser.tabs.query({active: true, currentWindow: true}, function(tabs) {
      pageActionStates.set(tabs[0].id, true);
      browser.pageAction.show(tabs[0].id);
    });
  }
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "_stop_refresh") {
    if (refreshIntervals.has(tab.id)) {
      clearInterval(refreshIntervals.get(tab.id));
      refreshIntervals.delete(tab.id);
      browser.pageAction.hide(tab.id);
      browser.contextMenus.update(stopRefreshMenuItemId, { visible: false });
    }
  } else {
    executeCommand(info.menuItemId, info, tab);
    if (info.menuItemId.startsWith("_set_refresh_interval_")) {
      pageActionStates.set(tab.id, true);
      browser.pageAction.show(tab.id);
      browser.contextMenus.update(stopRefreshMenuItemId, { visible: true });
    }
  }
});

browser.pageAction.onClicked.addListener((tab) => {
  if (refreshIntervals.has(tab.id)) {
    clearInterval(refreshIntervals.get(tab.id));
    refreshIntervals.delete(tab.id);
    currentRefreshInterval = null;
    browser.pageAction.hide(tab.id);
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (pageActionStates.has(tabId) && pageActionStates.get(tabId)) {
      browser.pageAction.show(tabId);
    } else {
      browser.pageAction.hide(tabId);
    }
  }
});

browser.commands.onCommand.addListener((command) => {
  executeCommand(command);
});

browser.tabs.onRemoved.addListener((tabId) => {
  if (refreshIntervals.has(tabId)) {
    clearInterval(refreshIntervals.get(tabId));
    refreshIntervals.delete(tabId);
    if (currentRefreshInterval === tabId) {
      currentRefreshInterval = null;
    }
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  let tabId = activeInfo.tabId;
  let isVisible = refreshIntervals.has(tabId);
  browser.contextMenus.update(stopRefreshMenuItemId, { visible: isVisible });
});

let stopRefreshMenuItemId = browser.contextMenus.create({
  id: "_stop_refresh",
  title: "Stop Auto Refresh",
  contexts: ["tab"],
  icons: {
    "16": "stopicon.svg"
  },
  visible: false
});