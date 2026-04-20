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
        skipLiveRestart: true,
        showToast: true,

        toastPosition: 'center',
        toastScale: 1.5,
        toastDurationMs: 2000,

        toastBgColor: '#ff0033',
        toastTextColor: '#ffffff',

        toastAnimationEnabled: true,
        toastAnimationDurationMs: 500,

        bgColorHistory: [...TEMPLATE_COLORS],
        textColorHistory: [...TEMPLATE_COLORS],

        customCss: ''
    };

    const RESET_DEFAULTS = {
        skipLiveRestart: true,
        showToast: true,
        toastPosition: 'center',
        toastAnimationEnabled: true,
        toastTextColor: '#ffffff',
        toastBgColor: '#ff0033',
        toastAnimationDurationMs: 500,
        toastScale: 1.0
    };

    const els = {
        // Tabs
        tabBasic: document.getElementById('tabBasic'),
        tabPopup: document.getElementById('tabPopup'),
        tabAdvanced: document.getElementById('tabAdvanced'),
        tabPrivacy: document.getElementById('tabPrivacy'),
        tabTerms: document.getElementById('tabTerms'),
        tabContact: document.getElementById('tabContact'),

        panelBasic: document.getElementById('panelBasic'),
        panelPopup: document.getElementById('panelPopup'),
        panelAdvanced: document.getElementById('panelAdvanced'),
        panelPrivacy: document.getElementById('panelPrivacy'),
        panelTerms: document.getElementById('panelTerms'),
        panelContact: document.getElementById('panelContact'),

        // Basic
        enabled: document.getElementById('enabled'),
        skipLiveRestart: document.getElementById('skipLiveRestart'),

        // Popup
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

        toastDetailArea: document.getElementById('toastDetailArea'),
        colorSettingsBlock: document.getElementById('colorSettingsBlock'),
        disabledMaskTarget: document.getElementById('disabledMaskTarget'),

        // Color
        bgPalette: document.getElementById('bgPalette'),
        textPalette: document.getElementById('textPalette'),
        bgPicker: document.getElementById('bgPicker'),
        textPicker: document.getElementById('textPicker'),
        bgPickApply: document.getElementById('bgPickApply'),
        textPickApply: document.getElementById('textPickApply'),
        bgColorValue: document.getElementById('bgColorValue'),
        textColorValue: document.getElementById('textColorValue'),

        previewToast: document.getElementById('previewToast'),

        // Advanced
        customCss: document.getElementById('customCss'),
        exportSettings: document.getElementById('exportSettings'),
        importSettings: document.getElementById('importSettings'),
        importFile: document.getElementById('importFile'),

        // Footer actions
        saveSettings: document.getElementById('saveSettings'),
        resetSettings: document.getElementById('resetSettings'),
        dirtyDot: document.getElementById('dirtyDot'),
        saveToast: document.getElementById('saveToast'),
        saveLabel: document.getElementById('saveLabel')
    };

    let draft = null;
    let saveToastTimerId = null;
    let activeTabKey = 'basic';

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

    const isMac = () => {
        const p = String(navigator.platform || '').toLowerCase();
        const ua = String(navigator.userAgent || '').toLowerCase();
        return p.includes('mac') || ua.includes('mac os');
    };

    const setSaveLabel = () => {
        if (!els.saveLabel) {
            return;
        }

        const suffix = isMac() ? '⌘+S' : 'Ctrl+S';
        els.saveLabel.textContent = `設定を保存 ${suffix}`;
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

    const setDirty = (dirty) => {
        if (!els.dirtyDot) {
            return;
        }

        els.dirtyDot.classList.toggle('is-dirty', !!dirty);
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


        if (els.skipLiveRestart) {
            els.skipLiveRestart.checked = !!draft.skipLiveRestart;
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

        const durationSec = clamp(Math.round(Number(draft.toastDurationMs) / 1000), 1, 10);
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

        if (els.customCss) {
            els.customCss.value = String(draft.customCss || '');
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
            skipLiveRestart: typeof data.skipLiveRestart === 'boolean'
                ? data.skipLiveRestart
                : STORAGE_DEFAULTS.skipLiveRestart,
            showToast: !!data.showToast,

            toastPosition: data.toastPosition || 'center',
            toastScale: typeof data.toastScale === 'number' ? data.toastScale : STORAGE_DEFAULTS.toastScale,
            toastDurationMs: typeof data.toastDurationMs === 'number' ? data.toastDurationMs : STORAGE_DEFAULTS.toastDurationMs,

            toastBgColor: normalizeColor(data.toastBgColor) || STORAGE_DEFAULTS.toastBgColor,
            toastTextColor: normalizeColor(data.toastTextColor) || STORAGE_DEFAULTS.toastTextColor,

            toastAnimationEnabled: typeof data.toastAnimationEnabled === 'boolean'
                ? data.toastAnimationEnabled
                : STORAGE_DEFAULTS.toastAnimationEnabled,

            toastAnimationDurationMs: typeof data.toastAnimationDurationMs === 'number'
                ? data.toastAnimationDurationMs
                : STORAGE_DEFAULTS.toastAnimationDurationMs,

            bgColorHistory: ensureHistoryArray(data.bgColorHistory),
            textColorHistory: ensureHistoryArray(data.textColorHistory),

            customCss: typeof data.customCss === 'string' ? data.customCss : ''
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
            skipLiveRestart: !!draft.skipLiveRestart,
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
            textColorHistory: draft.textColorHistory.slice(0, 10),

            customCss: String(draft.customCss || '')
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

    const resetSettings = async () => {
        const ok = window.confirm('警告：設定を初期化しますか？');
        if (!ok) {
            return;
        }

        if (!draft) {
            return;
        }

        draft.skipLiveRestart = RESET_DEFAULTS.skipLiveRestart;
        draft.showToast = RESET_DEFAULTS.showToast;
        draft.toastPosition = RESET_DEFAULTS.toastPosition;
        draft.toastAnimationEnabled = RESET_DEFAULTS.toastAnimationEnabled;
        draft.toastTextColor = RESET_DEFAULTS.toastTextColor;
        draft.toastBgColor = RESET_DEFAULTS.toastBgColor;
        draft.toastAnimationDurationMs = RESET_DEFAULTS.toastAnimationDurationMs;
        draft.toastScale = RESET_DEFAULTS.toastScale;

        await STORAGE.set(buildSavePayload());

        setDirty(false);
        syncUiFromDraft();

        showSaveToast('設定を初期化しました');
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

        // toast.css と「同等の見え方」を保つ前提（必要最小限）
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

    const activateTab = (tabKey) => {
        activeTabKey = tabKey;

        const tabButtons = [
            { key: 'basic', el: els.tabBasic },
            { key: 'popup', el: els.tabPopup },
            { key: 'advanced', el: els.tabAdvanced },
            { key: 'privacy', el: els.tabPrivacy },
            { key: 'terms', el: els.tabTerms },
            { key: 'contact', el: els.tabContact }
        ];

        const panels = [
            { key: 'basic', el: els.panelBasic },
            { key: 'popup', el: els.panelPopup },
            { key: 'advanced', el: els.panelAdvanced },
            { key: 'privacy', el: els.panelPrivacy },
            { key: 'terms', el: els.panelTerms },
            { key: 'contact', el: els.panelContact }
        ];

        tabButtons.forEach((t) => {
            if (!t.el) {
                return;
            }
            const active = t.key === tabKey;
            t.el.classList.toggle('is-active', active);
            t.el.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        panels.forEach((p) => {
            if (!p.el) {
                return;
            }
            p.el.classList.toggle('is-active', p.key === tabKey);
        });
    };

    const importSettings = async () => {
        if (!els.importFile) {
            return;
        }

        // ファイル選択ダイアログを表示
        els.importFile.click();
    };

    const handleImportFile = async (file) => {
        if (!file) {
            return;
        }

        // ファイル形式の確認
        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            showSaveToast('このファイルには対応していません');
            return;
        }

        try {
            const text = await file.text();
            const payload = JSON.parse(text);

            // 最小限の検証：必須フィールドが存在するか
            const requiredFields = ['enabled', 'showToast', 'toastPosition', 'toastScale', 'toastDurationMs'];
            const hasRequiredFields = requiredFields.every(field => field in payload);

            if (!hasRequiredFields) {
                showSaveToast('このファイルには対応していません');
                return;
            }

            // draft に新しい設定をマージ
            if (!draft) {
                return;
            }

            draft.enabled = !!payload.enabled;
            draft.skipLiveRestart = typeof payload.skipLiveRestart === 'boolean'
                ? payload.skipLiveRestart
                : STORAGE_DEFAULTS.skipLiveRestart;
            draft.showToast = !!payload.showToast;
            draft.toastPosition = payload.toastPosition || 'center';
            draft.toastScale = typeof payload.toastScale === 'number' ? payload.toastScale : 1.5;
            draft.toastDurationMs = typeof payload.toastDurationMs === 'number' ? payload.toastDurationMs : 2000;
            draft.toastBgColor = normalizeColor(payload.toastBgColor) || draft.toastBgColor;
            draft.toastTextColor = normalizeColor(payload.toastTextColor) || draft.toastTextColor;
            draft.toastAnimationEnabled = typeof payload.toastAnimationEnabled === 'boolean' ? payload.toastAnimationEnabled : true;
            draft.toastAnimationDurationMs = typeof payload.toastAnimationDurationMs === 'number' ? payload.toastAnimationDurationMs : 500;
            draft.bgColorHistory = ensureHistoryArray(payload.bgColorHistory);
            draft.textColorHistory = ensureHistoryArray(payload.textColorHistory);
            draft.customCss = typeof payload.customCss === 'string' ? payload.customCss : '';

            // UI に反映
            setDirty(true);
            syncUiFromDraft();

            showSaveToast('読み込みが完了しました');
        } catch (e) {
            console.error('Import error:', e);
            showSaveToast('このファイルには対応していません');
        }

        // ファイル入力をリセット
        els.importFile.value = '';
    };

    const exportSettings = async () => {
        if (!draft) {
            return;
        }

        const payload = buildSavePayload();
        const json = JSON.stringify(payload, null, 4);

        // File System Access API を使用（Chrome 86+）
        if (typeof window.showSaveFilePicker === 'function') {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: 'ytr.json',
                    types: [
                        {
                            description: 'JSON Files',
                            accept: { 'application/json': ['.json'] }
                        }
                    ]
                });

                const writable = await fileHandle.createWritable();
                await writable.write(json);
                await writable.close();

                showSaveToast('設定を書き出しました');
                return;
            } catch (e) {
                // ユーザーがキャンセルした場合など
                if (e.name !== 'AbortError') {
                    console.error('File save error:', e);
                }
                return;
            }
        }

        // フォールバック：ダウンロード
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'ytr.json';
        a.click();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 2000);

        showSaveToast('設定を書き出しました');
    };

    const bindTabEvents = () => {
        const handler = (e) => {
            const btn = e.currentTarget;
            if (!btn) {
                return;
            }

            const key = btn.dataset.tab;
            if (!key) {
                return;
            }

            activateTab(key);
        };

        if (els.tabBasic) {
            els.tabBasic.addEventListener('click', handler);
        }
        if (els.tabPopup) {
            els.tabPopup.addEventListener('click', handler);
        }
        if (els.tabAdvanced) {
            els.tabAdvanced.addEventListener('click', handler);
        }
        if (els.tabPrivacy) {
            els.tabPrivacy.addEventListener('click', handler);
        }
        if (els.tabTerms) {
            els.tabTerms.addEventListener('click', handler);
        }
        if (els.tabContact) {
            els.tabContact.addEventListener('click', handler);
        }
    };

    const bindEvents = () => {
        if (els.enabled) {
            els.enabled.addEventListener('change', () => {
                if (!draft) {
                    return;
                }
                draft.enabled = !!els.enabled.checked;
                setDirty(true);
                applyEnabledMask();
            });
        }

        if (els.skipLiveRestart) {
            els.skipLiveRestart.addEventListener('change', () => {
                if (!draft) {
                    return;
                }
                draft.skipLiveRestart = !!els.skipLiveRestart.checked;
                setDirty(true);
            });
        }

        if (els.showToast) {
            els.showToast.addEventListener('change', () => {
                if (!draft) {
                    return;
                }
                draft.showToast = !!els.showToast.checked;
                setDirty(true);
                applyToastDetailVisibility();
            });
        }

        if (els.toastPosition) {
            els.toastPosition.addEventListener('change', () => {
                if (!draft) {
                    return;
                }
                draft.toastPosition = els.toastPosition.value;
                setDirty(true);
            });
        }

        if (els.toastScale) {
            els.toastScale.addEventListener('input', () => {
                if (!draft) {
                    return;
                }

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
                if (!draft) {
                    return;
                }

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
                if (!draft) {
                    return;
                }

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
                if (!draft) {
                    return;
                }

                draft.toastAnimationEnabled = !!els.toastAnimationEnabled.checked;
                setDirty(true);
                applyAnimationSettingsVisibility();
            });
        }

        if (els.toastAnimationDuration) {
            els.toastAnimationDuration.addEventListener('input', () => {
                if (!draft) {
                    return;
                }

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
                if (!draft) {
                    return;
                }

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
                if (!draft) {
                    return;
                }

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

        if (els.customCss) {
            els.customCss.addEventListener('input', () => {
                if (!draft) {
                    return;
                }
                draft.customCss = String(els.customCss.value || '');
                setDirty(true);
            });
        }

        if (els.exportSettings) {
            els.exportSettings.addEventListener('click', () => {
                exportSettings();
            });
        }

        if (els.importSettings) {
            els.importSettings.addEventListener('click', () => {
                importSettings();
            });
        }

        if (els.importFile) {
            els.importFile.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    handleImportFile(file);
                }
            });
        }

        if (els.saveSettings) {
            els.saveSettings.addEventListener('click', () => {
                save();
            });
        }

        if (els.resetSettings) {
            els.resetSettings.addEventListener('click', () => {
                resetSettings();
            });
        }
    };

    const bindSaveShortcut = () => {
        window.addEventListener('keydown', (e) => {
            const key = String(e.key || '').toLowerCase();
            const mac = isMac();

            const isSave = key === 's' && (mac ? e.metaKey : e.ctrlKey);
            if (!isSave) {
                return;
            }

            e.preventDefault();
            save();
        });
    };

    const init = async () => {
        setSaveLabel();
        bindTabEvents();
        bindEvents();
        bindSaveShortcut();
        activateTab(activeTabKey);
        await load();
        // Load policy/terms external text files
        try {
            await loadPolicyText('privacy', 'texts/privacy.txt', 'privacyContent');
        } catch (e) {
            // ignore
        }
        try {
            await loadPolicyText('terms', 'texts/terms.txt', 'termsContent');
        } catch (e) {
            // ignore
        }
    };

    const loadPolicyText = async (key, relPath, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const res = await fetch(relPath);
            if (!res.ok) throw new Error('fetch failed');
            const text = await res.text();

            // Insert as plain text but allow simple headings by splitting
            container.textContent = text;
        } catch (e) {
            console.error('loadPolicyText error', key, e);
            container.textContent = '読み込みに失敗しました';
        }
    };

    init();
})();
