(() => {
    'use strict';

    const STORAGE = chrome.storage.local;

    const STORAGE_DEFAULTS = {
        enabled: true
    };

    const toggle = document.getElementById('toggleEnabled');
    const status = document.getElementById('status');
    const openSettings = document.getElementById('openSettings');

    const restoreArea = document.getElementById('restoreArea');
    const restoreTime = document.getElementById('restoreTime');
    const restoreDesc = document.getElementById('restoreDesc');
    const restoreResult = document.getElementById('restoreResult');

    const setStatus = (text) => {
        if (!status) {
            return;
        }
        status.textContent = text;
    };

    const setRestoreDesc = (text) => {
        if (!restoreDesc) {
            return;
        }
        restoreDesc.textContent = text;
    };

    const setRestoreResult = (text) => {
        if (!restoreResult) {
            return;
        }
        restoreResult.textContent = text;
    };

    const setRestoreAreaVisible = (isVisible) => {
        if (!restoreArea) {
            return;
        }
        restoreArea.style.display = isVisible ? 'block' : 'none';

        if (!isVisible) {
            setRestoreResult('');
        }
    };

    const openOptions = async () => {
        if (chrome.runtime.openOptionsPage) {
            await chrome.runtime.openOptionsPage();
            return;
        }

        const url = chrome.runtime.getURL('src/options/options.html');
        await chrome.tabs.create({ url });
    };

    const loadSetting = async () => {
        const result = await STORAGE.get(STORAGE_DEFAULTS);

        const enabled = !!result.enabled;

        if (toggle) {
            toggle.checked = enabled;
        }

        setStatus(enabled ? '現在：ON' : '現在：OFF');
        setRestoreAreaVisible(enabled);

        return enabled;
    };

    const saveEnabled = async (enabled) => {
        await STORAGE.set({ enabled: !!enabled });
        setStatus(enabled ? '現在：ON' : '現在：OFF');
        setRestoreAreaVisible(!!enabled);
    };

    const getActiveTabId = async () => {
        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tabs || tabs.length === 0) {
            return null;
        }

        const tab = tabs[0];
        return tab && tab.id ? tab.id : null;
    };

    const refreshRestoreDescFromContent = async () => {
        // OFF のときは非表示なので何もしない
        if (!toggle || !toggle.checked) {
            return;
        }

        const tabId = await getActiveTabId();
        if (!tabId) {
            setRestoreDesc('再生時間を復元します（復元対象なし）');
            return;
        }

        try {
            const res = await chrome.tabs.sendMessage(tabId, {
                type: 'YTR_GET_SNAPSHOT'
            });

            if (!res || !res.ok || !res.timeText) {
                setRestoreDesc('再生時間を復元します（復元対象なし）');
                return;
            }

            setRestoreDesc(`再生時間を ${res.timeText} へ復元します`);
        } catch (e) {
            setRestoreDesc('再生時間を復元します（復元対象なし）');
        }
    };

    const sendRestoreMessageToActiveTab = async () => {
        setRestoreResult('');

        // OFF のときはそもそも押せない想定だが，安全側でガード
        if (!toggle || !toggle.checked) {
            return;
        }

        const tabId = await getActiveTabId();
        if (!tabId) {
            setRestoreResult('アクティブなタブが見つかりません');
            return;
        }

        try {
            const res = await chrome.tabs.sendMessage(tabId, {
                type: 'YTR_RESTORE_TIME'
            });

            if (!res) {
                setRestoreResult('復元できませんでした');
                await refreshRestoreDescFromContent();
                return;
            }

            if (res.ok) {
                if (res.restoredTimeText) {
                    setRestoreResult(`復元しました：${res.restoredTimeText}`);
                } else {
                    setRestoreResult('復元しました');
                }

                await refreshRestoreDescFromContent();
                return;
            }

            setRestoreResult(res.message || '復元できませんでした');
            await refreshRestoreDescFromContent();
        } catch (e) {
            setRestoreResult('このタブでは復元できません');
            await refreshRestoreDescFromContent();
        }
    };

    const init = async () => {
        const enabled = await loadSetting();

        if (enabled) {
            await refreshRestoreDescFromContent();
        }

        if (toggle) {
            toggle.addEventListener('change', async () => {
                await saveEnabled(toggle.checked);

                if (toggle.checked) {
                    await refreshRestoreDescFromContent();
                }
            });
        }

        if (openSettings) {
            openSettings.addEventListener('click', async () => {
                await openOptions();
            });
        }

        if (restoreTime) {
            restoreTime.addEventListener('click', async () => {
                await sendRestoreMessageToActiveTab();
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
