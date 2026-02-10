(() => {
    'use strict';

    const DEBUG = false;

    const log = (...args) => {
        if (!DEBUG) {
            return;
        }
        // eslint-disable-next-line no-console
        console.log('[YouTube-Reload]', ...args);
    };

    let lastHandledUrl = '';
    let pendingTimerId = null;

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

        // video要素の生成待ち（最大10秒）
        const video = await waitForVideoElement(10000);
        if (!video) {
            log('video not found', { url, reason });
            return;
        }

        // 0秒に戻す処理は、YouTube側の初期化と競合することがあるため
        // loadedmetadata / playing のタイミングでも保険で叩く
        const tryReset = (tag) => {
            try {
                // currentTimeはメタデータ読み込み後の方が確実に効く
                video.currentTime = 0;
                log('reset currentTime=0', { tag });
            } catch (e) {
                log('reset failed', { tag, e });
            }
        };

        // 1) すぐ試す
        tryReset('immediate');

        // 2) メタデータ読み込み時
        const onLoadedMetadata = () => {
            tryReset('loadedmetadata');
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
        video.addEventListener('loadedmetadata', onLoadedMetadata);

        // 3) 再生開始時（自動再生が先に走るケースの保険）
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
        // YouTubeのSPA遷移完了イベント（watch遷移でも発火）
        window.addEventListener('yt-navigate-finish', () => {
            scheduleHandle('yt-navigate-finish');
        });
    };

    const observeDomForVideoSwap = () => {
        const observer = new MutationObserver(() => {
            // videoが差し替わった / watchに入ったのにイベントが拾えなかった時の保険
            scheduleHandle('mutation');
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    };

    // 初期化
    hookHistoryApi();
    hookYouTubeNavigateEvent();
    observeDomForVideoSwap();

    // 初回ロード時
    scheduleHandle('initial');
})();
