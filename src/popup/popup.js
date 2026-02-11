(() => {
    'use strict';

    const STORAGE = chrome.storage.local;

    const STORAGE_DEFAULTS = {
        enabled: true
    };

    let initialized = false;

    const setStatus = (statusEl, text) => {
        if (!statusEl) {
            return;
        }
        statusEl.textContent = text;
    };

    const openOptions = async () => {
        if (chrome.runtime.openOptionsPage) {
            await chrome.runtime.openOptionsPage();
            return;
        }

        const url = chrome.runtime.getURL('options.html');
        await chrome.tabs.create({ url });
    };

    const init = async () => {
        if (initialized) {
            return;
        }
        initialized = true;

        const toggle = document.getElementById('toggleEnabled');
        const status = document.getElementById('status');
        const openSettings = document.getElementById('openSettings');

        // トグルが見つからない場合，ここで止める（落とさない）
        if (!toggle) {
            // eslint-disable-next-line no-console
            console.warn('[YouTube-Reset] toggleEnabled not found in popup.html');
            return;
        }

        try {
            const result = await STORAGE.get(STORAGE_DEFAULTS);
            toggle.checked = !!result.enabled;
            setStatus(status, result.enabled ? '現在：ON' : '現在：OFF');
        } catch (e) {
            setStatus(status, '現在：ON');
        }

        toggle.addEventListener('change', async () => {
            try {
                const enabled = !!toggle.checked;
                await STORAGE.set({ enabled });
                setStatus(status, enabled ? '現在：ON' : '現在：OFF');
            } catch (e) {
                // 保存失敗でも落とさない
            }
        });

        if (openSettings) {
            openSettings.addEventListener('click', async () => {
                await openOptions();
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
        });
        return;
    }

    init();
})();
