var browser = browser || chrome;

var storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage : browser.storage;

chrome.runtime.onStartup.addListener(() => {
    storage.sync.get(['maximizeOnStartup'], function(result) {
        if (result.maximizeOnStartup) {
            chrome.windows.getCurrent((window) => {
                if (window.state !== 'maximized') {
                    chrome.windows.update(window.id, { state: 'maximized' });
                }
            });
        }
    });
});

chrome.windows.onCreated.addListener((window) => {
    storage.sync.get(['maximizeNewWindows'], function(result) {
        if (result.maximizeNewWindows) {
            if (window.state !== 'maximized' && window.type !== 'popup') {
                chrome.windows.update(window.id, { state: 'maximized' });
            }
        }
    });
});

const menuItems = [
  { id: "_execute_detach_tab", title: "Detach Tab" },
  { id: "_execute_merge_windows", title: "Merge All Windows" },
  { id: "separator-2", type: "separator" },
  { id: "_execute_close_tabs_to_left", title: "Close Tabs To Left" },
  { id: "_execute_close_tabs_to_right", title: "Close Tabs To Right" },
  { id: "_execute_close_other_tabs", title: "Close Other Tabs" },
];

menuItems.forEach(item => {
  browser.contextMenus.create({
    id: item.id,
    title: item.title,
    type: item.type,
    contexts: ["tab"],
  });
});

var detachedTabs = new Map();

async function executeCommand(command) {
  let tabs = await browser.tabs.query({currentWindow: true, highlighted: true});
  let currentTab = tabs[0];
  let allTabs, tabsToClose;

  switch (command) {
    case "_execute_detach_tab":
      detachedTabs.set(currentTab.id, currentTab.index);
      let newWindow = await browser.windows.create({tabId: currentTab.id});
      tabs.slice(1).forEach(tab => {
        detachedTabs.set(tab.id, tab.index);
        browser.tabs.move(tab.id, {windowId: newWindow.id, index: -1});
      });
      break;
    case "_execute_merge_windows":
      let windows = await browser.windows.getAll({windowTypes: ["normal"]});
      allTabs = [];
      for (let win of windows) {
        let winTabs = await browser.tabs.query({windowId: win.id});
        allTabs = allTabs.concat(winTabs.map(tab => ({id: tab.id, index: detachedTabs.get(tab.id) || -1})));
      }
      if (allTabs.length > 0) {
        let newWin = await browser.windows.create({tabId: allTabs[0].id});
        allTabs.slice(1).sort((a, b) => a.index - b.index).forEach((tab, i) => {
          browser.tabs.move(tab.id, {windowId: newWin.id, index: i});
        });
        browser.tabs.update(currentTab.id, {active: true});
        windows.forEach(win => {
          if (win.id !== newWin.id) browser.windows.remove(win.id);
        });
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
  }
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  executeCommand(info.menuItemId);
});

browser.commands.onCommand.addListener((command) => {
  executeCommand(command);
});

browser.runtime.onStartup.addListener(async () => {
  let currentWindow = await browser.windows.getCurrent();
  browser.windows.update(currentWindow.id, { state: "maximized" });
});

browser.windows.onCreated.addListener(async (window) => {
  if (window.type !== "popup") {
    browser.windows.update(window.id, { state: "maximized" });
  }
});