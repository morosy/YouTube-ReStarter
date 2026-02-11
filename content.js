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

    const STORAGE_DEFAULTS = {
        enabled: true,
        showToast: true,
        toastPosition: 'center',     // left | center | right
        toastScale: 1.0,             // 0.8 - 1.5
        toastDurationMs: 2000        // 1000 - 10000
    };

    const TOAST_ID = 'ytr-toast';

    let lastHandledUrl = '';
    let pendingTimerId = null;

    // OFF/ON切替時に過去イベントが走っても無効化するための世代番号
    let generation = 0;

    const clampInt = (v, min, max) => {
        const n = Number.parseInt(v, 10);
        if (Number.isNaN(n)) {
            return min;
        }
        return Math.min(max, Math.max(min, n));
    };

    const getSettings = async () => {
        try {
            const data = await chrome.storage.sync.get(STORAGE_DEFAULTS);
            data.toastDurationMs = clampInt(data.toastDurationMs, 1000, 10000);
            data.toastScale = Math.min(1.5, Math.max(0.8, Number(data.toastScale)));
            return data;
        } catch (e) {
            return { ...STORAGE_DEFAULTS };
        }
    };

    const isWatchUrl = (url) => {
        try {
            const u = new URL(url);
            return u.hostname === 'www.youtube.com' && u.pathname === '/watch' && u.searchParams.has('v');
        } catch (e) {
            return false;
        }
    };

    const cancelPending = () => {
        if (pendingTimerId !== null) {
            clearTimeout(pendingTimerId);
            pendingTimerId = null;
        }
    };

    const startStorageListener = () => {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'sync' && areaName !== 'local') {
                return;
            }
            if (!changes.enabled) {
                // toast設定だけの変更もあるため，enabled以外は無視しない
            }

            // 切替が入ったら世代を進めて過去イベントを無効化
            if (changes.enabled || changes.showToast || changes.toastPosition || changes.toastScale || changes.toastDurationMs) {
                generation += 1;
            }

            // OFFになったら予約済み処理をキャンセル
            if (changes.enabled && changes.enabled.newValue === false) {
                cancelPending();
                log('disabled: cancel pending', { areaName });
                return;
            }

            // ver 1.2.1 以降：動画再生中に OFF -> ON したとき，その動画には実行しない
            if (changes.enabled && changes.enabled.oldValue === false && changes.enabled.newValue === true) {
                const currentUrl = location.href;
                if (isWatchUrl(currentUrl)) {
                    lastHandledUrl = currentUrl;
                    cancelPending();
                    log('OFF->ON: skip current watch', { currentUrl });
                }
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

    const applyToastStyle = (el, settings) => {
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
    };

    const showToast = (message, settings) => {
        if (!settings.showToast) {
            return;
        }

        const el = ensureToastElement();
        el.textContent = message;

        applyToastStyle(el, settings);

        el.classList.add('ytr-toast--show');

        if (el._ytrHideTimerId) {
            clearTimeout(el._ytrHideTimerId);
        }

        el._ytrHideTimerId = setTimeout(() => {
            el.classList.remove('ytr-toast--show');
            el._ytrHideTimerId = null;
        }, settings.toastDurationMs);
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
        const settings = await getSettings();
        if (!settings.enabled) {
            log('disabled - skip', { reason, url: location.href });
            return;
        }

        const url = location.href;

        if (!isWatchUrl(url)) {
            log('skip (not watch url)', { url, reason });
            return;
        }

        if (url === lastHandledUrl) {
            log('skip (already handled)', { url, reason });
            return;
        }

        lastHandledUrl = url;
        log('handle', { url, reason });

        const currentGeneration = generation;

        const video = await waitForVideoElement(10000);
        if (!video) {
            log('video not found', { url, reason });
            return;
        }

        let toastShown = false;

        const tryReset = async (tag) => {
            // 途中で設定が切り替わっていたら無効化
            if (currentGeneration !== generation) {
                log('generation changed - skip', { tag });
                return;
            }

            // 実行直前にも enabled を再確認（OFFでも実行される問題の対策）
            const latest = await getSettings();
            if (!latest.enabled) {
                log('disabled before apply - skip', { tag });
                return;
            }

            try {
                video.currentTime = 0;
                log('reset currentTime=0', { tag });

                if (!toastShown) {
                    toastShown = true;
                    showToast('実行完了しました', latest);
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
        cancelPending();

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
        startStorageListener();

        hookHistoryApi();
        hookYouTubeNavigateEvent();
        observeDomForVideoSwap();

        scheduleHandle('initial');
    };

    init();
})();
