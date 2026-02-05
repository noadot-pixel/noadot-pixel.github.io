// js/features/preset-manager/ui.js
import { t } from '../../state.js';

export class PresetManagerUI {
    constructor() {
        this.ensureModalExists();
        this.injectStyles(); 

        this.saveBtn = document.getElementById('savePresetBtn');
        this.loadBtn = document.getElementById('loadPresetBtn');
        this.myPresetsBtn = document.getElementById('myPresetsBtn');
        
        this.recommendBtn = document.getElementById('getStyleRecommendationsBtn') 
                         || document.getElementById('btn_get_recommendations')
                         || document.querySelector('[data-lang-key="btn_get_recommendations"]');
        
        this.fileInput = document.getElementById('presetUpload');

        this.saveChoiceModal = document.getElementById('preset-save-choice-modal');
        this.nameInputModal = document.getElementById('preset-name-input-modal');
        this.presetListModal = document.getElementById('preset-popup-container');
        
        this.listTitle = this.presetListModal ? this.presetListModal.querySelector('h3') : null;
        this.presetListContainer = this.presetListModal ? this.presetListModal.querySelector('.preset-scroll-wrapper') : null;

        this.closePresetListBtn = document.getElementById('close-preset-popup-btn');
        this.btnCloseSaveChoice = document.getElementById('btn-close-save-modal');
        this.btnCancelSaveName = document.getElementById('btn-cancel-save-file');
        this.btnSaveToFile = document.getElementById('btn-save-to-file');
        this.btnSaveToSession = document.getElementById('btn-save-to-session');
        this.btnConfirmSave = document.getElementById('btn-confirm-save-file');
        this.nameInput = document.getElementById('preset-name-input');
    }

    syncDOM(id, value, type = 'value') {
        const el = document.getElementById(id);
        if (!el) return;
        if (type === 'checkbox') {
            el.checked = !!value;
        } else {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    ensureModalExists() {
        if (!document.getElementById('preset-popup-container')) {
            const div = document.createElement('div');
            // [수정] data-lang-key 대신 data-lang-placeholder 사용
            div.innerHTML = `
                <div id="preset-popup-container" class="modal-overlay hidden">
                    <div class="modal-box" style="width: 600px; max-width: 90%; max-height: 85vh;">
                        <h3 style="margin: 0 0 15px 0; font-size: 18px;">${t('modal_preset_list_title')}</h3>
                        <div class="preset-scroll-wrapper"></div>
                        <div style="text-align: right; margin-top: 15px;">
                            <button id="close-preset-popup-btn" class="modal-close-btn">${t('btn_close')}</button>
                        </div>
                    </div>
                </div>
                <div id="preset-save-choice-modal" class="modal-overlay hidden">
                    <div class="modal-box">
                        <h3>${t('modal_preset_save_title')}</h3>
                        <p>${t('modal_preset_save_desc')}</p>
                        <div style="display:flex; gap:10px; margin-top:15px;">
                            <button id="btn-save-to-file" style="flex:1; padding:10px;">${t('btn_save_file')}</button>
                            <button id="btn-save-to-session" style="flex:1; padding:10px;">${t('btn_save_session')}</button>
                        </div>
                        <button id="btn-close-save-modal" style="margin-top:10px; width:100%; padding:8px;">${t('btn_close')}</button>
                    </div>
                </div>
                <div id="preset-name-input-modal" class="modal-overlay hidden">
                    <div class="modal-box">
                        <h3>${t('modal_preset_name_title')}</h3>
                        
                        <input type="text" id="preset-name-input" 
                               placeholder="${t('placeholder_preset_name')}" 
                               data-lang-placeholder="placeholder_preset_name"
                               style="width:100%; padding:8px; margin:10px 0; box-sizing:border-box;">
                               
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                            <button id="btn-cancel-save-file">${t('btn_cancel')}</button>
                            <button id="btn-confirm-save-file" style="background:#333; color:white;">${t('btn_confirm_save')}</button>
                        </div>
                    </div>
                </div>
                <input type="file" id="presetUpload" accept=".json" style="display: none;" />
            `;
            document.body.appendChild(div);
        }
    }

    injectStyles() {
        if (document.getElementById('preset-manager-styles')) return;
        const style = document.createElement('style');
        style.id = 'preset-manager-styles';
        style.textContent = `
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; }
            .modal-overlay.hidden { display: none !important; }
            .modal-box { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 25px rgba(0,0,0,0.25); display: flex; flex-direction: column; box-sizing: border-box; }
            .modal-close-btn { padding: 8px 16px; background: #eee; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
            .modal-close-btn:hover { background: #ddd; }
            .preset-scroll-wrapper { 
                flex-grow: 1; overflow-y: auto; margin: 0; 
                border: 1px solid #eee; border-radius: 8px; padding: 15px; 
                background: #f8f9fa; min-height: 300px;
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 15px;
                align-content: start;
            }
            .preset-card {
                background: white; border: 1px solid #ddd; border-radius: 8px;
                display: flex; flex-direction: column; align-items: center;
                padding: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                transition: transform 0.2s, box-shadow 0.2s;
                position: relative;
                overflow: hidden;
            }
            .preset-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); border-color: #bbb; }
            .preset-badge {
                position: absolute; top: 8px; left: 8px;
                background: #ff595e; color: white; font-size: 10px; font-weight: bold;
                padding: 2px 6px; border-radius: 4px; z-index: 10;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }
            .preset-preview-box {
                width: 100%; aspect-ratio: 1/1.2;
                background: #eee; border-radius: 4px;
                margin-bottom: 8px; overflow: hidden;
                display: flex; align-items: center; justify-content: center;
                border: 1px solid #eee;
            }
            .preset-preview-canvas {
                image-rendering: pixelated;
                max-width: 100%; max-height: 100%;
                object-fit: contain;
            }
            .preset-name { font-weight: bold; font-size: 13px; color: #333; margin-bottom: 8px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
            .preset-btn-group { display: flex; gap: 5px; width: 100%; justify-content: center; }
            .preset-action-btn {
                flex: 1; padding: 6px 0; border: 1px solid #ddd; background: white;
                border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.1s;
            }
            .preset-action-btn:hover { background: #f0f0f0; border-color: #999; }
            .btn-apply { color: #333; border-color: #333; }
            .btn-apply:hover { background: #333; color: white; }
            .btn-save { color: #007bff; }
            .btn-delete { color: #dc3545; }
        `;
        document.head.appendChild(style);
    }

    showModal(modal) { if(modal) modal.classList.remove('hidden'); }
    hideModal(modal) { if(modal) modal.classList.add('hidden'); }
    setListTitle(title) { if (this.listTitle) this.listTitle.textContent = title; }

    renderPresetList(presets, onApply, onDelete, onDownload) {
        if (!this.presetListContainer) return;
        this.presetListContainer.innerHTML = '';

        if (presets.length === 0) {
            this.presetListContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px; color:#999;">${t('msg_empty_list')}</div>`;
            return;
        }

        presets.forEach(preset => {
            const card = document.createElement('div');
            card.className = 'preset-card';

            if (!preset.isSystem) {
                const badge = document.createElement('span');
                badge.className = 'preset-badge';
                badge.textContent = t('badge_my_custom');
                card.appendChild(badge);
            }

            const previewBox = document.createElement('div');
            previewBox.className = 'preset-preview-box';
            
            const canvas = document.createElement('canvas');
            canvas.className = 'preset-preview-canvas';
            canvas.id = `preset-canvas-${preset.id}`;
            canvas.width = 100; canvas.height = 100; 
            
            previewBox.appendChild(canvas);
            card.appendChild(previewBox);

            const name = document.createElement('div');
            name.className = 'preset-name';
            name.textContent = preset.name;
            name.title = preset.description || preset.name;
            card.appendChild(name);

            const btnGroup = document.createElement('div');
            btnGroup.className = 'preset-btn-group';

            const applyBtn = document.createElement('button');
            applyBtn.className = 'preset-action-btn btn-apply';
            applyBtn.textContent = t('btn_apply');
            applyBtn.onclick = () => onApply(preset);
            btnGroup.appendChild(applyBtn);

            const saveBtn = document.createElement('button');
            saveBtn.className = 'preset-action-btn btn-save';
            saveBtn.textContent = '💾';
            saveBtn.title = t('btn_save_file');
            saveBtn.onclick = () => onDownload(preset);
            btnGroup.appendChild(saveBtn);

            if (!preset.isSystem) {
                const delBtn = document.createElement('button');
                delBtn.className = 'preset-action-btn btn-delete';
                delBtn.textContent = '🗑️';
                delBtn.title = t('COMMENT_ACTION_DELETE');
                delBtn.onclick = () => onDelete(preset.id);
                btnGroup.appendChild(delBtn);
            }

            card.appendChild(btnGroup);
            this.presetListContainer.appendChild(card);
        });
    }
}