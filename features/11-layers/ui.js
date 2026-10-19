// js/features/11-layers/ui.js
// 🌟 [레이어 기능] #lyr-list를 그리는 역할만 담당 - 이벤트 처리는 logic.js가 위임(delegation)으로
// #lyr-list 자체에 한 번만 걸어두므로, 매번 다시 그려도 리스너가 쌓이지 않는다.
import { t } from '../../core/state.js';

const BLEND_MODE_LABELS = {
    normal: 'blend_normal', multiply: 'blend_multiply', screen: 'blend_screen',
    overlay: 'blend_overlay', darken: 'blend_darken', lighten: 'blend_lighten'
};
const BLEND_ORDER = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];

export class LayersUI {
    constructor() {
        this.list = document.getElementById('lyr-list');
        this.btnAddOutline = document.getElementById('lyr-btn-add-outline');
        this.btnAddImage = document.getElementById('lyr-btn-add-image');
        this.fileInput = document.getElementById('lyr-file-input');
        this.chkAllowOffPalette = document.getElementById('lyr-chk-allow-offpalette');
    }

    escape(str) {
        const div = document.createElement('div');
        div.textContent = str ?? '';
        return div.innerHTML;
    }

    renderBlendOptions(current) {
        return BLEND_ORDER.map(mode =>
            `<option value="${mode}" ${mode === current ? 'selected' : ''}>${t(BLEND_MODE_LABELS[mode])}</option>`
        ).join('');
    }

    renderStatusBadge(status) {
        if (status === 'pending') return `<span class="lyr-status lyr-status-pending" data-i18n="status_layer_pending">${t('status_layer_pending')}</span>`;
        if (status === 'error') return `<span class="lyr-status lyr-status-error" data-i18n="status_layer_error">${t('status_layer_error')}</span>`;
        return '';
    }

    // 화면 맨 위에 가장 나중(제일 위) 레이어가 보이도록, 배열을 뒤집어서 그린다.
    renderList(layers) {
        if (!this.list) return;
        const openDetailIds = new Set(
            Array.from(this.list.querySelectorAll('details.lyr-outline-settings[open]'))
                .map(d => d.closest('[data-layer-id]')?.dataset.layerId)
                .filter(Boolean)
        );

        this.list.innerHTML = '';
        const total = layers.length;
        for (let i = total - 1; i >= 0; i--) {
            this.list.appendChild(this.renderRow(layers[i], i, total, openDetailIds.has(layers[i].id)));
        }
    }

    renderRow(layer, index, total, keepOpen) {
        const li = document.createElement('li');
        li.dataset.layerId = layer.id;

        if (layer.type === 'base') {
            li.className = 'lyr-row lyr-row-base';
            li.innerHTML = `
                <div class="lyr-row-main">
                    <label class="lyr-vis-toggle">
                        <input type="checkbox" data-action="toggleVisible" ${layer.visible !== false ? 'checked' : ''}>
                    </label>
                    <span class="lyr-name" data-i18n="layer_base">${t('layer_base')}</span>
                </div>
            `;
            return li;
        }

        li.className = 'lyr-row';
        const name = layer.name || t(layer.type === 'outline' ? 'layer_default_name_outline' : 'layer_default_name_image');
        const statusBadge = layer.type === 'outline' ? this.renderStatusBadge(layer.status) : '';
        const isTop = index === total - 1;
        const isBottom = index <= 1; // index 0은 항상 베이스라 레이어는 최소 index 1부터 시작

        li.innerHTML = `
            <div class="lyr-row-main">
                <label class="lyr-vis-toggle">
                    <input type="checkbox" data-action="toggleVisible" ${layer.visible !== false ? 'checked' : ''}>
                </label>
                <span class="lyr-name" title="${this.escape(name)}">${this.escape(name)}</span>
                ${statusBadge}
                <div class="lyr-row-btns">
                    <button type="button" data-action="moveUp" ${isTop ? 'disabled' : ''} title="${t('btn_layer_up')}">▲</button>
                    <button type="button" data-action="moveDown" ${isBottom ? 'disabled' : ''} title="${t('btn_layer_down')}">▼</button>
                    <button type="button" data-action="remove" class="lyr-btn-remove" title="${t('btn_layer_remove')}">✕</button>
                </div>
            </div>
            <div class="lyr-row-controls">
                <label class="lyr-opacity-row">
                    <span data-i18n="label_layer_opacity">${t('label_layer_opacity')}</span>
                    <input type="range" min="0" max="100" value="${layer.opacity ?? 100}" data-action="opacity">
                    <span class="lyr-opacity-val">${layer.opacity ?? 100}%</span>
                </label>
                <label class="lyr-blend-row">
                    <span data-i18n="label_layer_blend">${t('label_layer_blend')}</span>
                    <select data-action="blendMode">${this.renderBlendOptions(layer.blendMode)}</select>
                </label>
            </div>
            ${layer.type === 'outline' ? this.renderOutlineSettings(layer, keepOpen) : ''}
        `;
        return li;
    }

    renderOutlineSettings(layer, keepOpen) {
        const p = layer.params || {};
        const lineWeightPercent = Math.round((p.lineWeight ?? 0.25) * 100);
        return `
            <details class="lyr-outline-settings" ${keepOpen ? 'open' : ''}>
                <summary data-i18n="label_outline_settings">${t('label_outline_settings')}</summary>
                <label class="lyr-outline-field">
                    <span data-i18n="label_outline_threshold">${t('label_outline_threshold')}</span>
                    <input type="range" min="0" max="255" value="${p.threshold ?? 96}" data-action="outlineThreshold">
                    <span class="lyr-val">${p.threshold ?? 96}</span>
                </label>
                <label class="lyr-outline-field">
                    <span data-i18n="label_outline_contrast">${t('label_outline_contrast')}</span>
                    <input type="range" min="-100" max="100" value="${p.contrast ?? 30}" data-action="outlineContrast">
                    <span class="lyr-val">${p.contrast ?? 30}</span>
                </label>
                <label class="lyr-outline-field">
                    <span data-i18n="label_outline_brightness">${t('label_outline_brightness')}</span>
                    <input type="range" min="-100" max="100" value="${p.brightness ?? 0}" data-action="outlineBrightness">
                    <span class="lyr-val">${p.brightness ?? 0}</span>
                </label>
                <label class="lyr-outline-field">
                    <span data-i18n="label_outline_line_weight">${t('label_outline_line_weight')}</span>
                    <input type="range" min="0.05" max="0.95" step="0.05" value="${p.lineWeight ?? 0.25}" data-action="outlineLineWeight">
                    <span class="lyr-val">${lineWeightPercent}%</span>
                </label>
                <label class="lyr-outline-field lyr-outline-field-color">
                    <span data-i18n="label_outline_ink_color">${t('label_outline_ink_color')}</span>
                    <input type="color" value="${p.inkHex || '#000000'}" data-action="outlineInkColor">
                </label>
            </details>
        `;
    }
}
