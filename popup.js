(() => {
    'use strict';

    const STORAGE_DEFAULTS = {
        enabled: true
    };

    const toggle = document.getElementById('toggleEnabled');
    const status = document.getElementById('status');
    const openSettings = document.getElementById('openSettings');

    const setStatus = (text) => {
        status.textContent = text;
    };

    const loadSetting = async () => {
        const result = await chrome.storage.sync.get(STORAGE_DEFAULTS);
        toggle.checked = result.enabled;
        setStatus(result.enabled ? '現在：ON' : '現在：OFF');
    };

    const saveEnabled = async (enabled) => {
        await chrome.storage.sync.set({ enabled });
        setStatus(enabled ? '現在：ON' : '現在：OFF');
    };

    toggle.addEventListener('change', () => {
        saveEnabled(toggle.checked);
    });

    openSettings.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    loadSetting();
})();
