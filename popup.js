(() => {
    'use strict';

    const STORAGE_KEY = 'enabled';

    const toggle = document.getElementById('toggleEnabled');
    const status = document.getElementById('status');

    const setStatus = (text) => {
        status.textContent = text;
    };

    const loadSetting = async () => {
        const result = await chrome.storage.sync.get([STORAGE_KEY]);

        // 既定値は true（初回はON）
        const enabled = typeof result[STORAGE_KEY] === 'boolean' ? result[STORAGE_KEY] : true;

        toggle.checked = enabled;
        setStatus(enabled ? '現在：ON' : '現在：OFF');
    };

    const saveSetting = async (enabled) => {
        await chrome.storage.sync.set({ [STORAGE_KEY]: enabled });
        setStatus(enabled ? '現在：ON' : '現在：OFF');
    };

    toggle.addEventListener('change', () => {
        saveSetting(toggle.checked);
    });

    loadSetting();
})();
