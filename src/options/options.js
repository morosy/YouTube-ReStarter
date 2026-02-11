(() => {
    'use strict';

    // storage.sync は quota が厳しいため，local を使用
    const STORAGE = chrome.storage.local;

    const DEFAULTS = {
        enabled: true,
        showToast: true,
        toastPosition: 'center',
        toastScale: 1.0,
        toastDurationMs: 2000,
        toastBgColor: '#141414',
        toastTextColor: '#ffffff'
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
        settingsBody: document.getElementById('settingsBody'),

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

        previewToast: document.getElementById('previewToast'),
        saveSettings: document.getElementById('saveSettings'),
        unsavedDot: document.getElementById('unsavedDot')
    };

    let saveToastTimerId = null;
    let lastSavedPayloadStr = '';
    let isSaving = false;

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

    const isValidHexColor = (value) => {
        return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
    };

    const updateEnabledLook = () => {
        if (!els.enabled.checked) {
            els.settingsBody.classList.add('is-disabled-look');
            return;
        }
        els.settingsBody.classList.remove('is-disabled-look');
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

        // 保存通知は常に中央上部
        el.style.left = '50%';
        el.style.right = 'auto';
        el.style.setProperty('--ytr-x', '-50%');
        el.style.setProperty('--ytr-scale', '1');
        el.style.setProperty('--ytr-bg', 'rgba(20, 20, 20, 0.92)');
        el.style.setProperty('--ytr-fg', '#ffffff');

        document.documentElement.appendChild(el);
        return el;
    };

    const showSaveToast = () => {
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

    const collectPayloadFromUi = () => {
        const seconds = clampInt(els.toastDuration.value, 1, 10);

        const bg = isValidHexColor(els.toastBgColor.value) ? els.toastBgColor.value : DEFAULTS.toastBgColor;
        const fg = isValidHexColor(els.toastTextColor.value) ? els.toastTextColor.value : DEFAULTS.toastTextColor;

        return {
            enabled: els.enabled.checked,
            showToast: els.showToast.checked,
            toastPosition: els.toastPosition.value,
            toastScale: clampFloat(els.toastScale.value, 0.8, 1.5),
            toastDurationMs: seconds * 1000,
            toastBgColor: bg,
            toastTextColor: fg
        };
    };

    const normalizePayloadFromStorage = (data) => {
        const seconds = clampInt(Math.round(clampInt(data.toastDurationMs, 1000, 10000) / 1000), 1, 10);

        return {
            enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULTS.enabled,
            showToast: typeof data.showToast === 'boolean' ? data.showToast : DEFAULTS.showToast,
            toastPosition: data.toastPosition || DEFAULTS.toastPosition,
            toastScale: clampFloat(data.toastScale, 0.8, 1.5),
            toastDurationMs: seconds * 1000,
            toastBgColor: isValidHexColor(data.toastBgColor) ? data.toastBgColor : DEFAULTS.toastBgColor,
            toastTextColor: isValidHexColor(data.toastTextColor) ? data.toastTextColor : DEFAULTS.toastTextColor
        };
    };

    const updateUnsavedIndicator = () => {
        const currentStr = JSON.stringify(collectPayloadFromUi());
        const isDirty = (currentStr !== lastSavedPayloadStr);

        // options.html 側で dot が hidden 属性の場合に対応
        if (els.unsavedDot.hasAttribute('hidden')) {
            els.unsavedDot.hidden = !isDirty;
            return;
        }

        // class 運用の場合にも対応
        if (isDirty) {
            els.unsavedDot.classList.add('is-visible');
            return;
        }
        els.unsavedDot.classList.remove('is-visible');
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

    const load = async () => {
        const raw = await STORAGE.get(DEFAULTS);
        const data = normalizePayloadFromStorage(raw);

        els.enabled.checked = data.enabled;
        updateEnabledLook();

        els.showToast.checked = data.showToast;
        updateDetailsVisibility();

        els.toastPosition.value = data.toastPosition;

        els.toastScale.value = String(data.toastScale);
        updateScaleLabel();

        els.toastDuration.value = String(data.toastDurationMs / 1000);
        els.toastDurationInput.value = String(data.toastDurationMs / 1000);

        els.toastBgColor.value = data.toastBgColor;
        els.toastTextColor.value = data.toastTextColor;
        updateColorLabels();

        renderPresetButtons(els.bgPresets, BG_PRESETS, (color) => {
            els.toastBgColor.value = color;
            updateColorLabels();
            updateUnsavedIndicator();
        });

        renderPresetButtons(els.fgPresets, FG_PRESETS, (color) => {
            els.toastTextColor.value = color;
            updateColorLabels();
            updateUnsavedIndicator();
        });

        lastSavedPayloadStr = JSON.stringify(data);
        updateUnsavedIndicator();
    };

    // 変更で未保存表示を更新（保存はボタンのみ）
    els.enabled.addEventListener('change', () => {
        updateEnabledLook();
        updateUnsavedIndicator();
    });

    els.showToast.addEventListener('change', () => {
        updateDetailsVisibility();
        updateUnsavedIndicator();
    });

    els.toastPosition.addEventListener('change', updateUnsavedIndicator);

    els.toastScale.addEventListener('input', () => {
        updateScaleLabel();
        updateUnsavedIndicator();
    });

    els.toastDuration.addEventListener('input', () => {
        applyRangeToDurationInput();
        updateUnsavedIndicator();
    });

    els.toastDurationInput.addEventListener('input', () => {
        applyDurationInputToRange();
        updateUnsavedIndicator();
    });

    els.toastBgColor.addEventListener('input', () => {
        updateColorLabels();
        updateUnsavedIndicator();
    });

    els.toastTextColor.addEventListener('input', () => {
        updateColorLabels();
        updateUnsavedIndicator();
    });

    els.previewToast.addEventListener('click', () => {
        const payload = collectPayloadFromUi();
        createPreviewToast(payload);
    });

    // 保存（local なので quota 問題を回避できる）
    els.saveSettings.addEventListener('click', async () => {
        if (isSaving) {
            return;
        }

        isSaving = true;
        els.saveSettings.disabled = true;

        try {
            const payload = collectPayloadFromUi();
            await STORAGE.set(payload);

            lastSavedPayloadStr = JSON.stringify(payload);
            updateUnsavedIndicator();
            showSaveToast();
        } finally {
            window.setTimeout(() => {
                els.saveSettings.disabled = false;
                isSaving = false;
            }, 350);
        }
    });

    load();
})();
