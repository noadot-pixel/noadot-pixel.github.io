// js/features/preset-manager/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../state.js'; // [수정] t 함수 임포트
import { PresetManagerUI } from './ui.js';
import { systemPresets } from '../../../data/presets.js'; 

export class PresetManagerFeature {
    constructor() {
        console.log("%c[PresetManager] 초기화 시작...", "color: cyan; font-weight: bold;");
        
        this.ui = new PresetManagerUI();
        this.systemPresets = [...systemPresets];
        this.userPresets = [];
        this.currentView = 'user'; 

        this.previewWorker = new Worker('js/worker/image-worker.js', { type: "module" });
        this.initWorkerListener();

        console.log(`[PresetManager] 시스템 프리셋 로드됨: ${this.systemPresets.length}개`);
        this.initEvents();
        setTimeout(() => this.debugFindButtons(), 500);
    }

    initWorkerListener() {
        this.previewWorker.onmessage = (e) => {
            const { type, imageData, processId } = e.data;
            if (type === 'conversionDone' && processId) {
                this.drawThumbnail(processId, imageData);
            }
        };
    }

    drawThumbnail(canvasId, imageData) {
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(imageData, 0, 0);
        }
    }

    generateThumbnails(presets) {
        if (!state.originalImageObject) return;

        const tinyImage = this.createTinyImageData(state.originalImageObject);
        
        presets.forEach(preset => {
            const canvasId = `preset-canvas-${preset.id}`;
            const options = JSON.parse(JSON.stringify(preset.options));
            options.processId = canvasId; 
            
            this.previewWorker.postMessage({
                type: 'convert',
                imageData: tinyImage,
                options: options
            });
        });
    }

    createTinyImageData(img) {
        const maxDim = 100;
        let w = img.width;
        let h = img.height;

        if (w > h) {
            if (w > maxDim) {
                h = Math.round(h * (maxDim / w));
                w = maxDim;
            }
        } else {
            if (h > maxDim) {
                w = Math.round(w * (maxDim / h));
                h = maxDim;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        
        return ctx.getImageData(0, 0, w, h);
    }

    debugFindButtons() {
        let recBtn = document.getElementById('getStyleRecommendationsBtn') || 
                     document.getElementById('btn_get_recommendations') ||
                     document.querySelector('[data-lang-key="btn_get_recommendations"]');

        if (!recBtn) {
            const allBtns = document.querySelectorAll('button');
            for (let btn of allBtns) {
                if (btn.tagName === 'BUTTON' && 
                   (btn.innerText.includes('프리셋 추천') || btn.innerText.includes('Get Presets'))) {
                    recBtn = btn;
                    break;
                }
            }
        }

        if (recBtn) {
            recBtn.disabled = false; 
            recBtn.classList.remove('disabled'); 
            recBtn.style.pointerEvents = 'auto';
            recBtn.style.opacity = '1';
            recBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                this.openSystemPresets();
            };
        }
    }

    initEvents() {
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            
            if (this.isRecommendBtn(target)) {
                e.preventDefault(); 
                this.openSystemPresets();
                return;
            }
            if (target.id === 'myPresetsBtn' || target.closest('#myPresetsBtn')) {
                this.openUserPresets();
                return;
            }
            if (target.id === 'savePresetBtn' || target.closest('#savePresetBtn')) {
                this.ui.showModal(this.ui.saveChoiceModal);
                return;
            }
            if (target.id === 'loadPresetBtn' || target.closest('#loadPresetBtn')) {
                if(this.ui.fileInput) this.ui.fileInput.click();
                return;
            }
        });

        if(this.ui.fileInput) this.ui.fileInput.addEventListener('change', (e) => this.handleFileLoad(e));

        const bindClick = (id, handler) => { const el = document.getElementById(id); if (el) el.addEventListener('click', handler); };
        
        bindClick('btn-save-to-file', () => {
            this.ui.hideModal(this.ui.saveChoiceModal);
            this.ui.showModal(this.ui.nameInputModal);
            this.pendingSaveType = 'file';
        });
        bindClick('btn-save-to-session', () => {
            this.ui.hideModal(this.ui.saveChoiceModal);
            this.ui.showModal(this.ui.nameInputModal);
            this.pendingSaveType = 'session';
        });
        bindClick('btn-confirm-save-file', () => {
            const name = this.ui.nameInput.value.trim() || "My Preset";
            const presetData = this.collectCurrentState(name);
            if(this.pendingSaveType === 'file') this.downloadPresetFile(presetData);
            else { 
                this.userPresets.push(presetData); 
                // [수정] 다국어
                alert(t('alert_save_session')); 
            }
            this.ui.hideModal(this.ui.nameInputModal);
            this.ui.nameInput.value = '';
        });

        const closeModals = () => {
            this.ui.hideModal(this.ui.saveChoiceModal);
            this.ui.hideModal(this.ui.nameInputModal);
            this.ui.hideModal(this.ui.presetListModal);
        };
        bindClick('btn-close-save-modal', closeModals);
        bindClick('btn-cancel-save-file', closeModals);
        bindClick('close-preset-popup-btn', closeModals);
    }

    isRecommendBtn(target) {
        if (target.id === 'getStyleRecommendationsBtn' || target.id === 'btn_get_recommendations') return true;
        if (target.getAttribute && target.getAttribute('data-lang-key') === 'btn_get_recommendations') return true;
        const parentBtn = target.closest('button');
        if (parentBtn) {
            if (parentBtn.id === 'getStyleRecommendationsBtn' || parentBtn.id === 'btn_get_recommendations') return true;
            if (parentBtn.getAttribute('data-lang-key') === 'btn_get_recommendations') return true;
        }
        return false;
    }

    openSystemPresets() {
        this.currentView = 'system';
        // [수정] 다국어
        this.ui.setListTitle(t('preset_category_recommended')); 
        this.updatePresetList(); 
        this.ui.showModal(this.ui.presetListModal);
        
        setTimeout(() => this.generateThumbnails(this.systemPresets), 100);
    }

    openUserPresets() {
        this.currentView = 'user';
        // [수정] 다국어
        this.ui.setListTitle(t('preset_storage'));
        this.updatePresetList();
        this.ui.showModal(this.ui.presetListModal);
        
        setTimeout(() => this.generateThumbnails(this.userPresets), 100);
    }

    updatePresetList() {
        const targetList = this.currentView === 'system' ? this.systemPresets : this.userPresets;
        this.ui.renderPresetList(
            targetList,
            (preset) => this.applyPreset(preset),
            (id) => { 
                // [수정] 다국어
                if (this.currentView === 'user' && confirm(t('confirm_delete_preset'))) {
                    this.userPresets = this.userPresets.filter(p => p.id !== id);
                    this.updatePresetList();
                    setTimeout(() => this.generateThumbnails(this.userPresets), 100);
                }
            },
            (preset) => this.downloadPresetFile(preset)
        );
    }

    collectCurrentState(name) {
        return {
            id: Date.now().toString(), name: name, createdAt: new Date().toISOString(), isSystem: false,
            options: {
                saturation: parseInt(document.getElementById('saturationSlider').value),
                brightness: parseInt(document.getElementById('brightnessSlider').value),
                contrast: parseInt(document.getElementById('contrastSlider').value),
                dithering: document.getElementById('ditheringAlgorithmSelect').value,
                ditheringIntensity: parseInt(document.getElementById('ditheringSlider').value),
                applyPattern: document.getElementById('applyPattern').checked,
                patternType: document.getElementById('patternTypeSelect').value,
                patternSize: parseInt(document.getElementById('patternSizeSlider').value),
                applyGradient: document.getElementById('applyGradient').checked,
                gradientType: document.getElementById('gradientTypeSelect').value,
                gradientAngle: parseInt(document.getElementById('gradientAngleSlider').value),
                gradientStrength: parseInt(document.getElementById('gradientStrengthSlider').value),
                gradientDitherSize: parseInt(document.getElementById('gradientDitherSizeSlider').value),
                colorMethod: document.getElementById('colorMethodSelect').value,
                celShading: {
                    apply: document.getElementById('celShadingApply').checked,
                    levels: parseInt(document.getElementById('celShadingLevelsSlider').value),
                    colorSpace: document.getElementById('celShadingColorSpaceSelect').value,
                    outline: document.getElementById('celShadingOutline').checked,
                    outlineThreshold: parseInt(document.getElementById('celShadingOutlineThresholdSlider').value),
                    outlineColor: state.celShadingOutlineColorSelect || '#000000',
                    randomSeed: state.celShadingRandomSeed || 0
                },
                mode: state.currentMode,
                useWplaceInGeoMode: state.useWplaceInGeoMode,
                disabledHexes: [...state.disabledHexes],
                addedColors: [...state.addedColors], 
                resize: { scaleMode: state.scaleMode, exportScale: state.exportScale, upscale: state.currentUpscaleFactor }
            }
        };
    }

    applyPreset(preset) {
        if(!preset || !preset.options) return;
        const opts = preset.options;
        state.saturationSlider = opts.saturation; state.brightnessSlider = opts.brightness; state.contrastSlider = opts.contrast;
        state.ditheringAlgorithmSelect = opts.dithering; state.ditheringSlider = opts.ditheringIntensity;
        state.applyPattern = opts.applyPattern; state.patternTypeSelect = opts.patternType; state.patternSizeSlider = opts.patternSize;
        state.applyGradient = opts.applyGradient; state.gradientTypeSelect = opts.gradientType; 
        state.gradientAngleSlider = opts.gradientAngle; state.gradientStrengthSlider = opts.gradientStrength; state.gradientDitherSizeSlider = opts.gradientDitherSize;
        state.colorMethodSelect = opts.colorMethod;
        if(opts.celShading) {
            state.celShadingApply = opts.celShading.apply; state.celShadingLevelsSlider = opts.celShading.levels;
            state.celShadingColorSpaceSelect = opts.celShading.colorSpace; state.celShadingOutline = opts.celShading.outline;
            state.celShadingOutlineThresholdSlider = opts.celShading.outlineThreshold;
        }
        state.currentMode = opts.mode; state.useWplaceInGeoMode = opts.useWplaceInGeoMode;
        state.disabledHexes = opts.disabledHexes || []; state.addedColors = opts.addedColors || [];
        state.scaleMode = opts.resize?.scaleMode || 'ratio'; state.exportScale = opts.resize?.exportScale || 1; state.currentUpscaleFactor = opts.resize?.upscale || 1;

        this.ui.syncDOM('saturationSlider', opts.saturation); this.ui.syncDOM('brightnessSlider', opts.brightness); this.ui.syncDOM('contrastSlider', opts.contrast);
        this.ui.syncDOM('ditheringAlgorithmSelect', opts.dithering); this.ui.syncDOM('ditheringSlider', opts.ditheringIntensity);
        this.ui.syncDOM('applyPattern', opts.applyPattern, 'checkbox'); this.ui.syncDOM('patternTypeSelect', opts.patternType); this.ui.syncDOM('patternSizeSlider', opts.patternSize);
        this.ui.syncDOM('applyGradient', opts.applyGradient, 'checkbox'); this.ui.syncDOM('gradientTypeSelect', opts.gradientType);
        this.ui.syncDOM('gradientAngleSlider', opts.gradientAngle); this.ui.syncDOM('gradientStrengthSlider', opts.gradientStrength); this.ui.syncDOM('gradientDitherSizeSlider', opts.gradientDitherSize);
        this.ui.syncDOM('colorMethodSelect', opts.colorMethod);
        if(opts.celShading) {
            this.ui.syncDOM('celShadingApply', opts.celShading.apply, 'checkbox'); this.ui.syncDOM('celShadingLevelsSlider', opts.celShading.levels);
            this.ui.syncDOM('celShadingColorSpaceSelect', opts.celShading.colorSpace); this.ui.syncDOM('celShadingOutline', opts.celShading.outline, 'checkbox');
            this.ui.syncDOM('celShadingOutlineThresholdSlider', opts.celShading.outlineThreshold);
        }
        if(opts.mode === 'geopixels') {
            const geoRadio = document.getElementById('geopixelsMode');
            if(geoRadio) geoRadio.checked = true;
        } else {
            const wplaceRadio = document.getElementById('wplaceMode');
            if(wplaceRadio) wplaceRadio.checked = true;
        }
        this.ui.syncDOM('useWplaceInGeoMode', opts.useWplaceInGeoMode, 'checkbox');
        const upscaleRadio = document.querySelector(`input[name="upscaleMode"][value="${opts.resize?.upscale || 1}"]`);
        if(upscaleRadio) upscaleRadio.checked = true;
        this.ui.syncDOM('exportScaleSlider', opts.resize?.exportScale || 1);

        eventBus.emit('BATCH_OPTION_CHANGED');
        eventBus.emit('PALETTE_UPDATED'); 
        eventBus.emit('UPSCALE_REQUEST', state.currentUpscaleFactor);
        
        // [수정] 다국어 (이름 치환)
        alert(t('alert_preset_applied_name', { name: preset.name }));
    }

    handleFileLoad(e) { 
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const preset = JSON.parse(evt.target.result);
                if(preset.options) this.applyPreset(preset);
                // [수정] 다국어
                else alert(t('alert_preset_error'));
            } catch(err) { 
                // [수정] 다국어
                alert(t('alert_error_general')); 
            }
            this.ui.fileInput.value = ''; 
        };
        reader.readAsText(file);
    }
    
    downloadPresetFile(presetData) {
        const dataStr = JSON.stringify(presetData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${presetData.name.replace(/\s+/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}