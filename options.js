(() => {
    'use strict';

    const DEFAULTS = {
        enabled: true,
        showToast: true,
        toastPosition: 'center',     // left | center | right
        toastScale: 1.0,             // 0.8 - 1.5
        toastDurationMs: 2000        // 1000 - 10000
    };

    const els = {
        enabled: document.getElementById('enabled'),
        showToast: document.getElementById('showToast'),
        toastDetails: document.getElementById('toastDetails'),

        toastPosition: document.getElementById('toastPosition'),
        toastScale: document.getElementById('toastScale'),
        toastScaleValue: document.getElementById('toastScaleValue'),

        toastDuration: document.getElementById('toastDuration'),
        toastDurationInput: document.getElementById('toastDurationInput'),

        previewToast: document.getElementById('previewToast'),
        saveStatus: document.getElementById('saveStatus')
    };

    const setStatus = (text) => {
        els.saveStatus.textContent = text;
    };

    const clampInt = (v, min, max) => {
        const n = Number.parseInt(v, 10);
        if (Number.isNaN(n)) {
            return min;
        }
        return Math.min(max, Math.max(min, n));
    };

    const updateDetailsVisibility = () => {
        els.toastDetails.style.display = els.showToast.checked ? 'block' : 'none';
    };

    const updateScaleLabel = () => {
        els.toastScaleValue.textContent = `${Number(els.toastScale.value).toFixed(2)}x`;
    };

    const load = async () => {
        const data = await chrome.storage.sync.get(DEFAULTS);

        els.enabled.checked = data.enabled;
        els.showToast.checked = data.showToast;

        els.toastPosition.value = data.toastPosition;

        els.toastScale.value = String(data.toastScale);
        updateScaleLabel();

        const seconds = clampInt(Math.round(data.toastDurationMs / 1000), 1, 10);
        els.toastDuration.value = String(seconds);
        els.toastDurationInput.value = String(seconds);

        updateDetailsVisibility();
        setStatus('読み込み完了');
    };

    const save = async () => {
        const seconds = clampInt(els.toastDuration.value, 1, 10);
        const durationMs = seconds * 1000;

        const payload = {
            enabled: els.enabled.checked,
            showToast: els.showToast.checked,
            toastPosition: els.toastPosition.value,
            toastScale: Number.parseFloat(els.toastScale.value),
            toastDurationMs: durationMs
        };

        await chrome.storage.sync.set(payload);
        setStatus('保存しました');
    };

    const applyDurationInputToRange = () => {
        const seconds = clampInt(els.toastDurationInput.value, 1, 10);
        els.toastDurationInput.value = String(seconds);
        els.toastDuration.value = String(seconds);
    };

    const applyRangeToDurationInput = () => {
        els.toastDurationInput.value = String(els.toastDuration.value);
    };

    const createPreviewToast = (settings) => {
        const toast = document.createElement('div');
        toast.className = 'ytr-toast';
        toast.textContent = 'プレビュー表示';

        if (settings.toastPosition === 'left') {
            toast.style.left = '18px';
            toast.style.right = 'auto';
            toast.style.setProperty('--ytr-x', '0%');
        } else if (settings.toastPosition === 'right') {
            toast.style.left = 'auto';
            toast.style.right = '18px';
            toast.style.setProperty('--ytr-x', '0%');
        } else {
            toast.style.left = '50%';
            toast.style.right = 'auto';
            toast.style.setProperty('--ytr-x', '-50%');
        }

        toast.style.setProperty('--ytr-scale', String(settings.toastScale));

        document.documentElement.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('ytr-toast--show');
        });

        window.setTimeout(() => {
            toast.classList.remove('ytr-toast--show');
            window.setTimeout(() => toast.remove(), 220);
        }, settings.toastDurationMs);
    };

    els.enabled.addEventListener('change', save);

    els.showToast.addEventListener('change', () => {
        updateDetailsVisibility();
        save();
    });

    els.toastPosition.addEventListener('change', save);

    els.toastScale.addEventListener('input', () => {
        updateScaleLabel();
        save();
    });

    els.toastDuration.addEventListener('input', () => {
        applyRangeToDurationInput();
        save();
    });

    els.toastDurationInput.addEventListener('input', () => {
        applyDurationInputToRange();
        save();
    });

    els.previewToast.addEventListener('click', async () => {
        const seconds = clampInt(els.toastDuration.value, 1, 10);

        const settings = {
            toastPosition: els.toastPosition.value,
            toastScale: Number.parseFloat(els.toastScale.value),
            toastDurationMs: seconds * 1000
        };

        createPreviewToast(settings);
    });

    load();
})();
