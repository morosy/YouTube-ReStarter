(() => {
    'use strict';

    const DEBUG = false;

    const log = (...args) => {
        if (!DEBUG) {
            return;
        }
        // eslint-disable-next-line no-console
        console.log('[YouTube-ReStarter]', ...args);
    };

    const STORAGE = chrome.storage.local;

    const STORAGE_DEFAULTS = {
        enabled: true,
        showToast: true,

        toastPosition: 'center',
        toastScale: 1.5,
        toastDurationMs: 2000,

        toastBgColor: '#ff0033',
        toastTextColor: '#ffffff',

        toastAnimationEnabled: true,
        toastAnimationDurationMs: 500
    };

    const TOAST_ID = 'ytr-toast';

    let lastHandledUrl = '';
    let pendingTimerId = null;

    let isEnabledCache = true;
    let wasEnabledCache = true;
    let showToastCache = true;

    // ON/OFF 切替や非同期競合を潰すための世代
    let generation = 0;

    // 復元用スナップショット（直前の currentTime）
    // { url: string, timeSec: number, savedAt: number }
    let lastResetSnapshot = null;

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const normalizeAnimDurationMs = (v) => {
        const n = Number(v);
        if (Number.isNaN(n)) {
            return 500;
        }
        const snapped = Math.round(n / 10) * 10;
        return clamp(snapped, 100, 1000);
    };

    const isWatchUrl = (url) => {
        try {
            const u = new URL(url);
            return u.hostname === 'www.youtube.com' && u.pathname === '/watch' && u.searchParams.has('v');
        } catch (e) {
            return false;
        }
    };

    const formatTime = (sec) => {
        const s = Math.max(0, Math.floor(sec));
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return `${mm}:${ss}`;
    };

    const computeToastTopPx = (scale) => {
        // ベースが大きくなった前提で，上部バー被りを避けるために scale に応じて下げる
        // 必要に応じて base/k を微調整
        const base = 22;
        const k = 22;
        return Math.round(base + (scale - 1) * k);
    };

    const loadSettingsCache = async () => {
        try {
            const data = await STORAGE.get(STORAGE_DEFAULTS);

            wasEnabledCache = isEnabledCache;

            isEnabledCache = typeof data.enabled === 'boolean' ? data.enabled : true;
            showToastCache = typeof data.showToast === 'boolean' ? data.showToast : true;

            log('setting loaded', { enabled: isEnabledCache, showToast: showToastCache });
        } catch (e) {
            wasEnabledCache = true;
            isEnabledCache = true;
            showToastCache = true;
            log('setting load failed, fallback enabled=true', e);
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

                generation += 1;

                // OFF にした瞬間に予約が残ると誤動作するのでキャンセル
                if (!isEnabledCache && pendingTimerId !== null) {
                    clearTimeout(pendingTimerId);
                    pendingTimerId = null;
                }

                log('enabled changed', {
                    before: wasEnabledCache,
                    after: isEnabledCache,
                    generation
                });
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

    const applyToastPosition = (el, position) => {
        if (position === 'left') {
            el.style.left = '18px';
            el.style.right = 'auto';
            el.style.setProperty('--ytr-x', '0%');
        } else if (position === 'right') {
            el.style.left = 'auto';
            el.style.right = '18px';
            el.style.setProperty('--ytr-x', '0%');
        } else {
            el.style.left = '50%';
            el.style.right = 'auto';
            el.style.setProperty('--ytr-x', '-50%');
        }
    };

    // force=true のときは showToast 設定に関わらず表示（エラー通知など）
    const showToast = (message, settings, force) => {
        if (!force && !showToastCache) {
            return;
        }

        const el = ensureToastElement();
        el.textContent = message;

        applyToastPosition(el, settings.toastPosition || 'center');

        const scale = clamp(Number(settings.toastScale ?? 1.5), 0.5, 2.0);
        el.style.setProperty('--ytr-scale', String(scale));

        const topPx = computeToastTopPx(scale);
        el.style.setProperty('--ytr-top', `${topPx}px`);

        el.style.setProperty('--ytr-bg', settings.toastBgColor || '#ff0033');
        el.style.setProperty('--ytr-fg', settings.toastTextColor || '#ffffff');

        const animMs = normalizeAnimDurationMs(settings.toastAnimationDurationMs);
        el.style.setProperty('--ytr-anim-duration', `${animMs}ms`);

        el.classList.remove('ytr-toast--anim-drop');
        void el.offsetWidth;

        if (settings.toastAnimationEnabled) {
            el.classList.add('ytr-toast--anim-drop');
        }

        el.classList.add('ytr-toast--show');

        if (el._ytrHideTimerId) {
            clearTimeout(el._ytrHideTimerId);
        }

        const durationMs = typeof settings.toastDurationMs === 'number'
            ? clamp(settings.toastDurationMs, 1000, 10000)
            : 2000;

        el._ytrHideTimerId = setTimeout(() => {
            el.classList.remove('ytr-toast--show');
            el._ytrHideTimerId = null;
        }, durationMs);
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
            return { ok: false, message: '復元対象なし' };
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
            showToast(`再生時間を復元しました（${restoredTimeText}）`, settings, false);

            return { ok: true, restoredTimeText };
        } catch (e) {
            return { ok: false, message: '復元に失敗しました' };
        }
    };

    const resetToZeroSafely = async (reason, scheduledGeneration) => {
        // 世代が変わっていたら，予約が古いので無視
        if (scheduledGeneration !== generation) {
            log('skip (generation changed)', { reason, scheduledGeneration, generation });
            return;
        }

        if (!isEnabledCache) {
            log('disabled - skip', { reason, url: location.href });
            return;
        }

        const url = location.href;

        if (!isWatchUrl(url)) {
            log('skip (not watch url)', { url, reason });
            return;
        }

        // OFF -> ON を再生中に切り替えた瞬間は実行しない（次の遷移から）
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
            // 世代が変わっていたらイベント競合なので無視
            if (scheduledGeneration !== generation) {
                log('skip reset (generation changed)', { tag, scheduledGeneration, generation });
                return;
            }

            // 念のため実行直前でも OFF を見て弾く
            if (!isEnabledCache) {
                log('skip reset (disabled)', { tag });
                return;
            }

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
                    showToast('実行完了しました', settings, false);
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

    const forceResetToZero = async () => {
        const url = location.href;
        const settings = await STORAGE.get(STORAGE_DEFAULTS);

        if (!isWatchUrl(url)) {
            showToast('このページでは使用できません', settings, true);
            return { ok: false, reason: 'not_watch' };
        }

        const video = await waitForVideoElement(8000);
        if (!video) {
            showToast('動画が見つかりません', settings, true);
            return { ok: false, reason: 'no_video' };
        }

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

            // 成功通知は設定に従う（showToast OFF なら出ない）
            showToast('0:00に戻しました', settings, false);

            return { ok: true };
        } catch (e) {
            showToast('0:00に戻せませんでした', settings, true);
            return { ok: false, reason: 'failed' };
        }
    };

    const scheduleHandle = (reason) => {
        const scheduledGeneration = generation;

        if (pendingTimerId !== null) {
            clearTimeout(pendingTimerId);
        }

        pendingTimerId = setTimeout(() => {
            pendingTimerId = null;
            resetToZeroSafely(reason, scheduledGeneration);
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

    // popup からの操作
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message) {
            return;
        }

        if (message.type === 'YTR_GET_SNAPSHOT') {
            const snap = getSnapshotForCurrentUrl();
            if (!snap) {
                sendResponse({ ok: false });
                return;
            }
            sendResponse({ ok: true, timeText: formatTime(snap.timeSec) });
            return;
        }

        if (message.type === 'YTR_RESTORE_TIME') {
            restoreLastTime().then((res) => {
                sendResponse(res);
            });
            return true;
        }

        if (message.type === 'YTR_FORCE_RESET') {
            forceResetToZero().then((res) => {
                sendResponse(res);
            });
            return true;
        }
    });

    const init = async () => {
        await loadSettingsCache();
        startStorageListener();

        hookHistoryApi();
        hookYouTubeNavigateEvent();
        observeDomForVideoSwap();

        scheduleHandle('initial');
    };

    try {
        init();
    } catch (e) {
        log('init failed', e);
    }
})();
