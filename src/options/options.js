(() => {
    'use strict';

    const STORAGE = chrome.storage.local;

    const TEMPLATE_COLORS = [
        '#ff0033',
        '#ffffff',
        '#111111',
        '#666666',
        '#2d7dff'
    ];

    const STORAGE_DEFAULTS = {
        enabled: true,
        showToast: true,

        toastPosition: 'center',
        toastScale: 1.5,
        toastDurationMs: 2000,

        toastBgColor: '#ff0033',
        toastTextColor: '#ffffff',

        toastAnimationEnabled: true,
        toastAnimationDurationMs: 500,

        bgColorHistory: [...TEMPLATE_COLORS],
        textColorHistory: [...TEMPLATE_COLORS]
    };

    const els = {
        enabled: document.getElementById('enabled'),
        showToast: document.getElementById('showToast'),

        toastPosition: document.getElementById('toastPosition'),
        toastScale: document.getElementById('toastScale'),
        toastScaleValue: document.getElementById('toastScaleValue'),

        toastDuration: document.getElementById('toastDuration'),
        toastDurationText: document.getElementById('toastDurationText'),

        toastAnimationEnabled: document.getElementById('toastAnimationEnabled'),
        animationSettings: document.getElementById('animationSettings'),
        toastAnimationDuration: document.getElementById('toastAnimationDuration'),
        toastAnimationDurationValue: document.getElementById('toastAnimationDurationValue'),

        bgPalette: document.getElementById('bgPalette'),
        textPalette: document.getElementById('textPalette'),

        bgPicker: document.getElementById('bgPicker'),
        textPicker: document.getElementById('textPicker'),

        bgPickApply: document.getElementById('bgPickApply'),
        textPickApply: document.getElementById('textPickApply'),

        bgColorValue: document.getElementById('bgColorValue'),
        textColorValue: document.getElementById('textColorValue'),

        previewToast: document.getElementById('previewToast'),
        saveSettings: document.getElementById('saveSettings'),

        dirtyDot: document.getElementById('dirtyDot'),
        saveToast: document.getElementById('saveToast'),

        disabledMaskTarget: document.getElementById('disabledMaskTarget'),
        toastDetailArea: document.getElementById('toastDetailArea'),

        // 追加：カラー設定ブロック
        colorSettingsBlock: document.getElementById('colorSettingsBlock')
    };

    let draft = null;
    let saveToastTimerId = null;

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const normalizeColor = (c) => {
        if (!c) {
            return null;
        }

        const s = String(c).trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(s)) {
            return s;
        }

        return null;
    };

    const setDirty = (dirty) => {
        if (!els.dirtyDot) {
            return;
        }

        els.dirtyDot.classList.toggle('is-dirty', !!dirty);
    };

    const showSaveToast = (message) => {
        if (!els.saveToast) {
            return;
        }

        els.saveToast.textContent = message;
        els.saveToast.classList.add('is-show');

        if (saveToastTimerId) {
            clearTimeout(saveToastTimerId);
        }

        saveToastTimerId = setTimeout(() => {
            els.saveToast.classList.remove('is-show');
            saveToastTimerId = null;
        }, 2000);
    };

    const applyEnabledMask = () => {
        if (!els.disabledMaskTarget || !els.enabled) {
            return;
        }

        els.disabledMaskTarget.classList.toggle('is-disabled', !els.enabled.checked);
    };

    const applyToastDetailVisibility = () => {
        if (!els.showToast) {
            return;
        }

        const visible = !!els.showToast.checked;

        if (els.toastDetailArea) {
            els.toastDetailArea.style.display = visible ? 'block' : 'none';
        }

        if (els.colorSettingsBlock) {
            els.colorSettingsBlock.style.display = visible ? 'block' : 'none';
        }
    };

    const applyAnimationSettingsVisibility = () => {
        if (!els.animationSettings || !els.toastAnimationEnabled) {
            return;
        }

        els.animationSettings.style.display = els.toastAnimationEnabled.checked ? 'block' : 'none';
    };

    const ensureHistoryArray = (arr) => {
        if (!Array.isArray(arr)) {
            return [...TEMPLATE_COLORS];
        }

        const normalized = arr
            .map((c) => normalizeColor(c))
            .filter((c) => !!c);

        if (normalized.length === 0) {
            return [...TEMPLATE_COLORS];
        }

        return normalized;
    };

    const pushColorFifo = (history, color) => {
        const c = normalizeColor(color);
        if (!c) {
            return history.slice();
        }

        const next = history.slice();

        const idx = next.indexOf(c);
        if (idx !== -1) {
            next.splice(idx, 1);
        }

        next.push(c);

        while (next.length > 10) {
            next.shift();
        }

        return next;
    };

    const renderPalette = (container, history, selectedColor, onPick) => {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        history.forEach((color) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-swatch';
            btn.style.background = color;
            btn.setAttribute('aria-label', `color ${color}`);

            if (normalizeColor(selectedColor) === normalizeColor(color)) {
                btn.classList.add('is-selected');
            }

            btn.addEventListener('click', () => {
                onPick(color);
            });

            container.appendChild(btn);
        });

        for (let i = history.length; i < 10; i += 1) {
            const spacer = document.createElement('div');
            spacer.style.width = '36px';
            spacer.style.height = '36px';
            container.appendChild(spacer);
        }
    };

    const renderAllPalettes = () => {
        if (!draft) {
            return;
        }

        renderPalette(els.bgPalette, draft.bgColorHistory, draft.toastBgColor, (picked) => {
            draft.toastBgColor = normalizeColor(picked) || draft.toastBgColor;
            draft.bgColorHistory = pushColorFifo(draft.bgColorHistory, draft.toastBgColor);

            if (els.bgPicker) {
                els.bgPicker.value = draft.toastBgColor;
            }
            if (els.bgColorValue) {
                els.bgColorValue.textContent = draft.toastBgColor;
            }

            setDirty(true);
            renderAllPalettes();
        });

        renderPalette(els.textPalette, draft.textColorHistory, draft.toastTextColor, (picked) => {
            draft.toastTextColor = normalizeColor(picked) || draft.toastTextColor;
            draft.textColorHistory = pushColorFifo(draft.textColorHistory, draft.toastTextColor);

            if (els.textPicker) {
                els.textPicker.value = draft.toastTextColor;
            }
            if (els.textColorValue) {
                els.textColorValue.textContent = draft.toastTextColor;
            }

            setDirty(true);
            renderAllPalettes();
        });
    };

    const syncUiFromDraft = () => {
        if (!draft) {
            return;
        }

        if (els.enabled) {
            els.enabled.checked = !!draft.enabled;
        }
        if (els.showToast) {
            els.showToast.checked = !!draft.showToast;
        }
        if (els.toastPosition) {
            els.toastPosition.value = draft.toastPosition || 'center';
        }

        if (els.toastScale) {
            els.toastScale.min = '0.5';
            els.toastScale.max = '2.0';
            els.toastScale.step = '0.05';
            els.toastScale.value = String(draft.toastScale);
        }
        if (els.toastScaleValue) {
            els.toastScaleValue.textContent = String(Number(draft.toastScale).toFixed(2));
        }

        const durationSec = clamp(Math.round(draft.toastDurationMs / 1000), 1, 10);
        if (els.toastDuration) {
            els.toastDuration.value = String(durationSec);
        }
        if (els.toastDurationText) {
            els.toastDurationText.value = String(durationSec);
        }

        if (els.bgPicker) {
            els.bgPicker.value = draft.toastBgColor;
        }
        if (els.textPicker) {
            els.textPicker.value = draft.toastTextColor;
        }
        if (els.bgColorValue) {
            els.bgColorValue.textContent = draft.toastBgColor;
        }
        if (els.textColorValue) {
            els.textColorValue.textContent = draft.toastTextColor;
        }

        if (els.toastAnimationEnabled) {
            els.toastAnimationEnabled.checked = !!draft.toastAnimationEnabled;
        }

        if (els.toastAnimationDuration) {
            els.toastAnimationDuration.min = '100';
            els.toastAnimationDuration.max = '1000';
            els.toastAnimationDuration.step = '10';
            els.toastAnimationDuration.value = String(draft.toastAnimationDurationMs);
        }
        if (els.toastAnimationDurationValue) {
            els.toastAnimationDurationValue.textContent = String(draft.toastAnimationDurationMs);
        }

        applyEnabledMask();
        applyToastDetailVisibility();
        applyAnimationSettingsVisibility();
        renderAllPalettes();
    };

    const load = async () => {
        const data = await STORAGE.get(STORAGE_DEFAULTS);

        draft = {
            enabled: !!data.enabled,
            showToast: !!data.showToast,

            toastPosition: data.toastPosition || 'center',
            toastScale: typeof data.toastScale === 'number' ? data.toastScale : 1.5,
            toastDurationMs: typeof data.toastDurationMs === 'number' ? data.toastDurationMs : 2000,

            toastBgColor: normalizeColor(data.toastBgColor) || STORAGE_DEFAULTS.toastBgColor,
            toastTextColor: normalizeColor(data.toastTextColor) || STORAGE_DEFAULTS.toastTextColor,

            toastAnimationEnabled: typeof data.toastAnimationEnabled === 'boolean'
                ? data.toastAnimationEnabled
                : true,

            toastAnimationDurationMs: typeof data.toastAnimationDurationMs === 'number'
                ? data.toastAnimationDurationMs
                : 500,

            bgColorHistory: ensureHistoryArray(data.bgColorHistory),
            textColorHistory: ensureHistoryArray(data.textColorHistory)
        };

        draft.toastScale = clamp(Number(draft.toastScale), 0.5, 2.0);
        draft.toastDurationMs = clamp(Number(draft.toastDurationMs), 1000, 10000);

        draft.toastAnimationDurationMs = clamp(
            Math.round(Number(draft.toastAnimationDurationMs) / 10) * 10,
            100,
            1000
        );

        while (draft.bgColorHistory.length > 10) {
            draft.bgColorHistory.shift();
        }
        while (draft.textColorHistory.length > 10) {
            draft.textColorHistory.shift();
        }

        setDirty(false);
        syncUiFromDraft();
    };

    const buildSavePayload = () => {
        return {
            enabled: !!draft.enabled,
            showToast: !!draft.showToast,

            toastPosition: draft.toastPosition,
            toastScale: clamp(Number(draft.toastScale), 0.5, 2.0),
            toastDurationMs: clamp(Number(draft.toastDurationMs), 1000, 10000),

            toastBgColor: draft.toastBgColor,
            toastTextColor: draft.toastTextColor,

            toastAnimationEnabled: !!draft.toastAnimationEnabled,
            toastAnimationDurationMs: clamp(
                Math.round(Number(draft.toastAnimationDurationMs) / 10) * 10,
                100,
                1000
            ),

            bgColorHistory: draft.bgColorHistory.slice(0, 10),
            textColorHistory: draft.textColorHistory.slice(0, 10)
        };
    };

    const save = async () => {
        if (!draft) {
            return;
        }

        await STORAGE.set(buildSavePayload());
        setDirty(false);
        showSaveToast('設定を保存しました');
    };

    const preview = () => {
        if (!draft) {
            return;
        }

        const toast = document.createElement('div');
        toast.textContent = 'プレビュー表示です';
        toast.style.position = 'fixed';
        toast.style.top = '18px';
        toast.style.zIndex = '2147483647';
        toast.style.padding = '18px 22px';
        toast.style.borderRadius = '16px';
        toast.style.fontSize = '18px';
        toast.style.fontWeight = '700';
        toast.style.minWidth = '320px';
        toast.style.textAlign = 'center';
        toast.style.boxShadow = '0 12px 34px rgba(0, 0, 0, 0.38)';
        toast.style.background = draft.toastBgColor;
        toast.style.color = draft.toastTextColor;

        const scale = clamp(Number(draft.toastScale), 0.5, 2.0);

        if (draft.toastPosition === 'left') {
            toast.style.left = '18px';
            toast.style.right = 'auto';
            toast.style.transform = `scale(${scale})`;
        } else if (draft.toastPosition === 'right') {
            toast.style.left = 'auto';
            toast.style.right = '18px';
            toast.style.transform = `scale(${scale})`;
        } else {
            toast.style.left = '50%';
            toast.style.right = 'auto';
            toast.style.transform = `translateX(-50%) scale(${scale})`;
        }

        if (draft.toastAnimationEnabled) {
            toast.animate(
                [
                    { transform: `${toast.style.transform} translateY(-24px)`, opacity: 0 },
                    { transform: toast.style.transform, opacity: 1 }
                ],
                {
                    duration: clamp(draft.toastAnimationDurationMs, 100, 1000),
                    easing: 'cubic-bezier(0.2, 0.9, 0.2, 1.0)'
                }
            );
        }

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 1500);
    };

    const bindEvents = () => {
        if (els.enabled) {
            els.enabled.addEventListener('change', () => {
                draft.enabled = !!els.enabled.checked;
                setDirty(true);
                applyEnabledMask();
            });
        }

        if (els.showToast) {
            els.showToast.addEventListener('change', () => {
                draft.showToast = !!els.showToast.checked;
                setDirty(true);
                applyToastDetailVisibility();
            });
        }

        if (els.toastPosition) {
            els.toastPosition.addEventListener('change', () => {
                draft.toastPosition = els.toastPosition.value;
                setDirty(true);
            });
        }

        if (els.toastScale) {
            els.toastScale.addEventListener('input', () => {
                const v = Number(els.toastScale.value);
                draft.toastScale = clamp(v, 0.5, 2.0);

                if (els.toastScaleValue) {
                    els.toastScaleValue.textContent = String(draft.toastScale.toFixed(2));
                }

                setDirty(true);
            });
        }

        if (els.toastDuration) {
            els.toastDuration.addEventListener('input', () => {
                const sec = clamp(Number(els.toastDuration.value), 1, 10);
                draft.toastDurationMs = sec * 1000;

                if (els.toastDurationText) {
                    els.toastDurationText.value = String(sec);
                }

                setDirty(true);
            });
        }

        if (els.toastDurationText) {
            els.toastDurationText.addEventListener('change', () => {
                const sec = clamp(Number(els.toastDurationText.value), 1, 10);
                draft.toastDurationMs = sec * 1000;

                if (els.toastDuration) {
                    els.toastDuration.value = String(sec);
                }

                els.toastDurationText.value = String(sec);
                setDirty(true);
            });
        }

        if (els.toastAnimationEnabled) {
            els.toastAnimationEnabled.addEventListener('change', () => {
                draft.toastAnimationEnabled = !!els.toastAnimationEnabled.checked;
                setDirty(true);
                applyAnimationSettingsVisibility();
            });
        }

        if (els.toastAnimationDuration) {
            els.toastAnimationDuration.addEventListener('input', () => {
                const v = clamp(Number(els.toastAnimationDuration.value), 100, 1000);
                draft.toastAnimationDurationMs = Math.round(v / 10) * 10;

                if (els.toastAnimationDurationValue) {
                    els.toastAnimationDurationValue.textContent = String(draft.toastAnimationDurationMs);
                }

                setDirty(true);
            });
        }

        if (els.bgPickApply) {
            els.bgPickApply.addEventListener('click', () => {
                const c = els.bgPicker ? normalizeColor(els.bgPicker.value) : null;
                if (!c) {
                    return;
                }

                draft.toastBgColor = c;
                draft.bgColorHistory = pushColorFifo(draft.bgColorHistory, c);

                if (els.bgColorValue) {
                    els.bgColorValue.textContent = c;
                }

                setDirty(true);
                renderAllPalettes();
            });
        }

        if (els.textPickApply) {
            els.textPickApply.addEventListener('click', () => {
                const c = els.textPicker ? normalizeColor(els.textPicker.value) : null;
                if (!c) {
                    return;
                }

                draft.toastTextColor = c;
                draft.textColorHistory = pushColorFifo(draft.textColorHistory, c);

                if (els.textColorValue) {
                    els.textColorValue.textContent = c;
                }

                setDirty(true);
                renderAllPalettes();
            });
        }

        if (els.previewToast) {
            els.previewToast.addEventListener('click', () => {
                preview();
            });
        }

        if (els.saveSettings) {
            els.saveSettings.addEventListener('click', () => {
                save();
            });
        }
    };

    const init = async () => {
        bindEvents();
        await load();
    };

    init();
})();
