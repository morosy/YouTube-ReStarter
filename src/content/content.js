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

    // OFF -> ON 操作時に「再生中なら実行しない」ためのフラグ
    let wasEnabledCache = true;

    const loadSettings = async () => {
        try {
            const data = await STORAGE.get(STORAGE_DEFAULTS);

            wasEnabledCache = isEnabledCache;

            isEnabledCache = typeof data.enabled === 'boolean' ? data.enabled : true;
            showToastCache = typeof data.showToast === 'boolean' ? data.showToast : true;

            log('settings loaded', { enabled: isEnabledCache, showToast: showToastCache });
        } catch (e) {
            // 読めない場合は安全側
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

        // 位置
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

        // 大きさ・色
        el.style.setProperty('--ytr-scale', String(settings.toastScale));
        el.style.setProperty('--ytr-bg', settings.toastBgColor);
        el.style.setProperty('--ytr-fg', settings.toastTextColor);

        el.classList.add('ytr-toast--show');

        if (el._ytrHideTimerId) {
            clearTimeout(el._ytrHideTimerId);
        }

        el._ytrHideTimerId = setTimeout(() => {
            el.classList.remove('ytr-toast--show');
            el._ytrHideTimerId = null;
        }, settings.toastDurationMs);
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

        // OFF -> ON の瞬間は「再生中なら実行しない」
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
                video.currentTime = 0;
                log('reset currentTime=0', { tag });

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
