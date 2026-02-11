(() => {
    'use strict';

    const DEFAULTS = {
        enabled: true,
        showToast: true,
        toastPosition: 'center',     // left | center | right
        toastScale: 1.0,             // 0.8 - 1.5
        toastDurationMs: 2000,       // 1000 - 10000
        toastBgColor: '#141414',     // background color
        toastTextColor: '#ffffff'    // text color
    };

    const BG_PRESETS = [
        '#141414',
        '#1f2937',
        '#0f766e',
        '#7c3aed',
        '#b91c1c'
    ];

    const FG_PRESETS = [
        '#ffffff',
        '#e5e7eb',
        '#111827',
        '#0b0f19',
        '#facc15'
    ];

    const TOAST_ID = 'ytr-options-toast';

    const els = {
        enabled: document.getElementById('enabled'),
        showToast: document.getElementById('showToast'),
        toastDetails: document.getElementById('toastDetails'),

        toastPosition: document.getElementById('toastPosition'),
        toastScale: document.getElementById('toastScale'),
        toastScaleValue: document.getElementById('toastScaleValue'),

        toastDuration: document.getElementById('toastDuration'),
        toastDurationInput: document.getElementById('toastDurationInput'),

        bgPresets: document.getElementById('bgPresets'),
        fgPresets: document.getElementById('fgPresets'),
        toastBgColor: document.getElementById('toastBgColor'),
        toastTextColor: document.getElementById('toastTextColor'),
        toastBgColorValue: document.getElementById('toastBgColorValue'),
        toastTextColorValue: document.getElementById('toastTextColorValue'),

        previewToast: document.getElementById('previewToast')
    };

    let saveToastTimerId = null;
    let saveToastCooldownId = null;
    let canShowSaveToast = true;

    const clampInt = (v, min, max) => {
        const n = Number.parseInt(v, 10);
        if (Number.isNaN(n)) {
            return min;
        }
        return Math.min(max, Math.max(min, n));
    };

    const clampFloat = (v, min, max) => {
        const n = Number.parseFloat(v);
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

    const updateColorLabels = () => {
        els.toastBgColorValue.textContent = els.toastBgColor.value.toUpperCase();
        els.toastTextColorValue.textContent = els.toastTextColor.value.toUpperCase();
    };

    const ensureSaveToastElement = () => {
        let el = document.getElementById(TOAST_ID);
        if (el) {
            return el;
        }

        el = document.createElement('div');
        el.id = TOAST_ID;
        el.className = 'ytr-toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');

        // 設定保存通知は設定に関わらず「中央上部」
        el.style.left = '50%';
        el.style.right = 'auto';
        el.style.setProperty('--ytr-x', '-50%');
        el.style.setProperty('--ytr-scale', '1');

        // 固定配色（見やすさ優先）
        el.style.setProperty('--ytr-bg', 'rgba(20, 20, 20, 0.92)');
        el.style.setProperty('--ytr-fg', '#ffffff');

        document.documentElement.appendChild(el);
        return el;
    };

    const showSaveToast = () => {
        if (!canShowSaveToast) {
            return;
        }
        canShowSaveToast = false;

        const el = ensureSaveToastElement();
        el.textContent = '設定を保存しました';
        el.classList.add('ytr-toast--show');

        if (saveToastTimerId !== null) {
            clearTimeout(saveToastTimerId);
        }

        saveToastTimerId = window.setTimeout(() => {
            el.classList.remove('ytr-toast--show');
            saveToastTimerId = null;
        }, 1400);

        if (saveToastCooldownId !== null) {
            clearTimeout(saveToastCooldownId);
        }

        saveToastCooldownId = window.setTimeout(() => {
            canShowSaveToast = true;
            saveToastCooldownId = null;
        }, 800);
    };

    const renderPresetButtons = (containerEl, colors, onPick) => {
        containerEl.innerHTML = '';

        for (const color of colors) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'preset-btn';
            btn.setAttribute('aria-label', color);
            btn.style.background = color;

            btn.addEventListener('click', () => {
                onPick(color);
            });

            containerEl.appendChild(btn);
        }
    };

    const load = async () => {
        const data = await chrome.storage.sync.get(DEFAULTS);

        els.enabled.checked = data.enabled;
        els.showToast.checked = data.showToast;

        els.toastPosition.value = data.toastPosition;

        els.toastScale.value = String(clampFloat(data.toastScale, 0.8, 1.5));
        updateScaleLabel();

        const seconds = clampInt(Math.round(clampInt(data.toastDurationMs, 1000, 10000) / 1000), 1, 10);
        els.toastDuration.value = String(seconds);
        els.toastDurationInput.value = String(seconds);

        els.toastBgColor.value = (data.toastBgColor || DEFAULTS.toastBgColor);
        els.toastTextColor.value = (data.toastTextColor || DEFAULTS.toastTextColor);
        updateColorLabels();

        renderPresetButtons(els.bgPresets, BG_PRESETS, (color) => {
            els.toastBgColor.value = color;
            updateColorLabels();
            save();
        });

        renderPresetButtons(els.fgPresets, FG_PRESETS, (color) => {
            els.toastTextColor.value = color;
            updateColorLabels();
            save();
        });

        updateDetailsVisibility();
    };

    const save = async () => {
        const seconds = clampInt(els.toastDuration.value, 1, 10);

        const payload = {
            enabled: els.enabled.checked,
            showToast: els.showToast.checked,
            toastPosition: els.toastPosition.value,
            toastScale: clampFloat(els.toastScale.value, 0.8, 1.5),
            toastDurationMs: seconds * 1000,
            toastBgColor: els.toastBgColor.value,
            toastTextColor: els.toastTextColor.value
        };

        await chrome.storage.sync.set(payload);
        showSaveToast();
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
        toast.style.setProperty('--ytr-bg', settings.toastBgColor);
        toast.style.setProperty('--ytr-fg', settings.toastTextColor);

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

    els.toastBgColor.addEventListener('input', () => {
        updateColorLabels();
        save();
    });

    els.toastTextColor.addEventListener('input', () => {
        updateColorLabels();
        save();
    });

    els.previewToast.addEventListener('click', () => {
        const seconds = clampInt(els.toastDuration.value, 1, 10);

        const settings = {
            toastPosition: els.toastPosition.value,
            toastScale: clampFloat(els.toastScale.value, 0.8, 1.5),
            toastDurationMs: seconds * 1000,
            toastBgColor: els.toastBgColor.value,
            toastTextColor: els.toastTextColor.value
        };

        createPreviewToast(settings);
    });

    load();
})();
