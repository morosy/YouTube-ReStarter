(() => {
    'use strict';

    const DEBUG = false;

    const log = (...args) => {
        if (!DEBUG) {
            return;
        }
        // eslint-disable-next-line no-console
        console.log('[YouTube-Reset]', ...args);
    };

    const STORAGE = chrome.storage.local;

    const STORAGE_DEFAULTS = {
        enabled: true,
        showToast: true,
        toastPosition: 'center',
        toastScale: 1.0,
        toastDurationMs: 2000,
        toastBgColor: '#141414',
        toastTextColor: '#ffffff'
    };

    const TOAST_ID = 'ytr-toast';

    let lastHandledUrl = '';
    let pendingTimerId = null;

    let isEnabledCache = true;
    let showToastCache = true;
    let wasEnabledCache = true;

    // 直前に 0:00 へ戻す前の再生時間（拡張がリセットしたときのみ記録）
    let lastResetSnapshot = null;
    // { url: string, timeSec: number, savedAt: number }

    const loadSettings = async () => {
        try {
            const data = await STORAGE.get(STORAGE_DEFAULTS);

            wasEnabledCache = isEnabledCache;

            isEnabledCache = typeof data.enabled === 'boolean' ? data.enabled : true;
            showToastCache = typeof data.showToast === 'boolean' ? data.showToast : true;

            log('settings loaded', { enabled: isEnabledCache, showToast: showToastCache });
        } catch (e) {
            wasEnabledCache = true;
            isEnabledCache = true;
            showToastCache = true;
            log('settings load failed, fallback enabled=true', e);
        }
    };

    const startStorageListener = () => {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') {
                return;
            }

            if (changes.enabled) {
                wasEnabledCache = isEnabledCache;
                isEnabledCache = changes.enabled.newValue;
                log('enabled changed', { before: wasEnabledCache, after: isEnabledCache });
            }

            if (changes.showToast) {
                showToastCache = changes.showToast.newValue;
                log('showToast changed', { showToast: showToastCache });
            }
        });
    };

    const ensureToastElement = () => {
        let el = document.getElementById(TOAST_ID);
        if (el) {
            return el;
        }

        el = document.createElement('div');
        el.id = TOAST_ID;
        el.className = 'ytr-toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        document.documentElement.appendChild(el);

        return el;
    };

    const showToast = (message, settings) => {
        if (!showToastCache) {
            return;
        }

        const el = ensureToastElement();
        el.textContent = message;

        if (settings.toastPosition === 'left') {
            el.style.left = '18px';
            el.style.right = 'auto';
            el.style.setProperty('--ytr-x', '0%');
        } else if (settings.toastPosition === 'right') {
            el.style.left = 'auto';
            el.style.right = '18px';
            el.style.setProperty('--ytr-x', '0%');
        } else {
            el.style.left = '50%';
            el.style.right = 'auto';
            el.style.setProperty('--ytr-x', '-50%');
        }

        el.style.setProperty('--ytr-scale', String(settings.toastScale));
        el.style.setProperty('--ytr-bg', settings.toastBgColor);
        el.style.setProperty('--ytr-fg', settings.toastTextColor);

        el.classList.add('ytr-toast--show');

        if (el._ytrHideTimerId) {
            clearTimeout(el._ytrHideTimerId);
        }

        const durationMs = typeof settings.toastDurationMs === 'number' ? settings.toastDurationMs : 2000;

        el._ytrHideTimerId = setTimeout(() => {
            el.classList.remove('ytr-toast--show');
            el._ytrHideTimerId = null;
        }, durationMs);
    };

    const isWatchUrl = (url) => {
        try {
            const u = new URL(url);
            return u.hostname === 'www.youtube.com' && u.pathname === '/watch' && u.searchParams.has('v');
        } catch (e) {
            return false;
        }
    };

    const waitForVideoElement = async (timeoutMs) => {
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            const video = document.querySelector('video');
            if (video) {
                return video;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return null;
    };

    const formatTime = (sec) => {
        const s = Math.max(0, Math.floor(sec));
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return `${mm}:${ss}`;
    };

    const getSnapshotForCurrentUrl = () => {
        const url = location.href;

        if (!isWatchUrl(url)) {
            return null;
        }

        if (!lastResetSnapshot) {
            return null;
        }

        if (lastResetSnapshot.url !== url) {
            return null;
        }

        if (typeof lastResetSnapshot.timeSec !== 'number' || Number.isNaN(lastResetSnapshot.timeSec)) {
            return null;
        }

        return lastResetSnapshot;
    };

    const restoreLastTime = async () => {
        const snap = getSnapshotForCurrentUrl();
        if (!snap) {
            return { ok: false, message: '復元できる再生時間がありません' };
        }

        const video = await waitForVideoElement(8000);
        if (!video) {
            return { ok: false, message: '動画が見つかりません' };
        }

        try {
            const target = snap.timeSec;
            video.currentTime = target;

            const restoredTimeText = formatTime(target);

            const settings = await STORAGE.get(STORAGE_DEFAULTS);
            showToast(`再生時間を復元しました（${restoredTimeText}）`, settings);

            return { ok: true, restoredTimeText };
        } catch (e) {
            return { ok: false, message: '復元に失敗しました' };
        }
    };

    const resetToZeroSafely = async (reason) => {
        if (!isEnabledCache) {
            log('disabled - skip', { reason, url: location.href });
            return;
        }

        const url = location.href;

        if (!isWatchUrl(url)) {
            log('skip (not watch url)', { url, reason });
            return;
        }

        if (!wasEnabledCache && isEnabledCache) {
            const currentVideo = document.querySelector('video');
            if (currentVideo && !currentVideo.paused && !currentVideo.ended) {
                log('skip (OFF->ON while playing)', { url, reason });
                lastHandledUrl = url;
                return;
            }
        }

        if (url === lastHandledUrl) {
            log('skip (already handled)', { url, reason });
            return;
        }

        lastHandledUrl = url;
        log('handle', { url, reason });

        const settings = await STORAGE.get(STORAGE_DEFAULTS);

        const video = await waitForVideoElement(10000);
        if (!video) {
            log('video not found', { url, reason });
            return;
        }

        let toastShown = false;

        const tryReset = (tag) => {
            try {
                const before = Number(video.currentTime);
                if (!Number.isNaN(before)) {
                    lastResetSnapshot = {
                        url,
                        timeSec: before,
                        savedAt: Date.now()
                    };
                }

                video.currentTime = 0;
                log('reset currentTime=0', { tag, before });

                if (!toastShown) {
                    toastShown = true;
                    showToast('実行完了しました', settings);
                }
            } catch (e) {
                log('reset failed', { tag, e });
            }
        };

        tryReset('immediate');

        const onLoadedMetadata = () => {
            tryReset('loadedmetadata');
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
        video.addEventListener('loadedmetadata', onLoadedMetadata);

        const onPlaying = () => {
            tryReset('playing');
            video.removeEventListener('playing', onPlaying);
        };
        video.addEventListener('playing', onPlaying);
    };

    const scheduleHandle = (reason) => {
        if (pendingTimerId !== null) {
            clearTimeout(pendingTimerId);
        }
        pendingTimerId = setTimeout(() => {
            pendingTimerId = null;
            resetToZeroSafely(reason);
        }, 50);
    };

    const hookHistoryApi = () => {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            originalPushState.apply(this, args);
            scheduleHandle('history.pushState');
        };

        history.replaceState = function (...args) {
            originalReplaceState.apply(this, args);
            scheduleHandle('history.replaceState');
        };

        window.addEventListener('popstate', () => {
            scheduleHandle('popstate');
        });
    };

    const hookYouTubeNavigateEvent = () => {
        window.addEventListener('yt-navigate-finish', () => {
            scheduleHandle('yt-navigate-finish');
        });
    };

    const observeDomForVideoSwap = () => {
        const observer = new MutationObserver(() => {
            scheduleHandle('mutation');
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message) {
            return;
        }

        if (message.type === 'YTR_RESTORE_TIME') {
            restoreLastTime().then((res) => {
                sendResponse(res);
            });
            return true;
        }

        if (message.type === 'YTR_GET_SNAPSHOT') {
            const snap = getSnapshotForCurrentUrl();
            if (!snap) {
                sendResponse({ ok: false });
                return;
            }

            sendResponse({
                ok: true,
                timeText: formatTime(snap.timeSec)
            });
        }
    });

    const init = async () => {
        await loadSettings();
        startStorageListener();

        hookHistoryApi();
        hookYouTubeNavigateEvent();
        observeDomForVideoSwap();

        scheduleHandle('initial');
    };

    init();
})();
