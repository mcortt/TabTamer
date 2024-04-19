var storage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync ? chrome.storage : browser.storage;

const optionIds = [
    'maximizeOnStartup',
    'maximizeNewWindows',
    'enableContextMenu',
    '_execute_detach_tab',
    '_execute_merge_windows',
    '_execute_close_tabs_to_left',
    '_execute_close_tabs_to_right',
    '_execute_close_other_tabs',
    '_set_refresh_interval'
];

document.addEventListener('DOMContentLoaded', restoreOptions);
optionIds.forEach(id => document.querySelector(`#${id}`).addEventListener('change', saveOptions));

function saveOptions() {
    const options = optionIds.reduce((acc, id) => {
        acc[id] = document.querySelector(`#${id}`).checked;
        return acc;
    }, {});
    storage.sync.set(options);
}

function restoreOptions() {
    const defaultOptions = optionIds.reduce((acc, id) => {
        acc[id] = true;
        return acc;
    }, {});

    storage.sync.get(defaultOptions, function(result) {
        optionIds.forEach(id => document.querySelector(`#${id}`).checked = result[id]);
    });
}