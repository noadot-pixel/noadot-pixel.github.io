import { WorkerBridge } from './core/WorkerBridge.js';
import { ModeSelectorFeature } from './features/mode-selector/logic.js';
import { ConversionOptionsFeature } from './features/conversion-options/logic.js';
import { ImageResizerFeature } from './features/image-resizer/logic.js';
import { eventBus } from './core/EventBus.js';
import { PresetManagerFeature } from './features/preset-manager/logic.js';
import { PaletteSelectorFeature } from './features/palette-selector/logic.js';
import { UserPaletteFeature } from './features/user-palette/logic.js';
import { TextConverterFeature } from './features/text-converter/logic.js';
import { ImageUploaderFeature } from './features/image-uploader/logic.js';
import { ImageViewerFeature } from './features/image-viewer/logic.js';
import { ExportFeature } from './features/export-utils/logic.js';

import { languageData } from '/data/languages.js';
import { state } from './state.js';

class App {
    constructor() {
        console.log("🚀 NoaDot v6.2 App Starting...");
        this.workerBridge = new WorkerBridge(); 
        
        this.initFeatures();
        this.initLanguage();
        this.initCoreListeners();
    }

    initFeatures() {
        this.modeSelector = new ModeSelectorFeature();
        this.conversionOptions = new ConversionOptionsFeature();
        this.imageResizer = new ImageResizerFeature();
        this.presetManager = new PresetManagerFeature();
        this.paletteSelector = new PaletteSelectorFeature();
        this.userPalette = new UserPaletteFeature();
        this.textConverter = new TextConverterFeature();
        this.imageUploader = new ImageUploaderFeature();
        this.imageViewer = new ImageViewerFeature();
        this.exportFeature = new ExportFeature();
    }

    initCoreListeners() {
        eventBus.on('OPTION_CHANGED', () => this.workerBridge.triggerConversion());
        
        eventBus.on('MODE_CHANGED', (mode) => {
             if (this.conversionOptions && this.conversionOptions.resetOptions) {
                 this.conversionOptions.resetOptions(); 
             }
             if (this.userPalette && this.userPalette.resetStats) {
                 this.userPalette.resetStats();
             }
             
             // 다운로드 옵션(Uplace 체크박스) 상태 업데이트 요청
             if (this.exportFeature && this.exportFeature.updateUplaceOptionVisibility) {
                 this.exportFeature.updateUplaceOptionVisibility();
             }

             eventBus.emit('IMAGE_ANALYZED', { pixelStats: {}, recommendations: [] });
             
             if(mode === 'image') this.workerBridge.triggerConversion();
        });

        eventBus.on('BATCH_OPTION_CHANGED', () => this.workerBridge.triggerConversion());
        
        eventBus.on('PALETTE_UPDATED', () => {
            this.workerBridge.triggerConversion();
            
            // 팔레트 변경 시에도 다운로드 옵션 상태 체크 (Wplace 모드 관련)
            if (this.exportFeature && this.exportFeature.updateUplaceOptionVisibility) {
                this.exportFeature.updateUplaceOptionVisibility();
            }
        });

        eventBus.on('LANGUAGE_CHANGED', (lang) => {
            this.updateDOMText(); 
        });

        eventBus.on('REQUEST_RESET_ALL', () => {
            if (this.conversionOptions && this.conversionOptions.resetOptions) {
                this.conversionOptions.resetOptions();
            }
            // 리사이저 리셋 (이전 요청사항 반영)
            if (this.imageResizer && this.imageResizer.resetSettings) {
                this.imageResizer.resetSettings();
            }
            
            state.addedColors = [];
            eventBus.emit('PALETTE_UPDATED');
            
            this.workerBridge.triggerConversion();
        });

        eventBus.on('REQUEST_ADD_COLOR', (rgb) => {
            if (this.userPalette) {
                this.userPalette.addColor(rgb);
            }
        });
    }

    initLanguage() {
        const langButtons = document.querySelectorAll('#language-switcher button[data-lang]');
        if (langButtons.length > 0) {
            langButtons.forEach(btn => {
                // state.language는 localStorage에서 불러온 값을 가짐
                if (btn.dataset.lang === state.language) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
                btn.addEventListener('click', () => {
                    const lang = btn.dataset.lang; 
                    this.setLanguage(lang);
                    langButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }
        this.updateDOMText();
    }

    setLanguage(lang) {
        if (state.language === lang) return;
        state.language = lang;
        
        // 언어 설정 저장 (새로고침 시 유지)
        localStorage.setItem('noadot_language', lang);
        
        this.updateDOMText();
        eventBus.emit('LANGUAGE_CHANGED', lang);
    }

    updateDOMText() {
        if (!languageData) return;
        const texts = languageData[state.language];
        if (!texts) return;

        // 1. 일반 텍스트 및 입력창 Placeholder
        const elements = document.querySelectorAll('[data-lang-key]');
        elements.forEach(el => {
            const key = el.getAttribute('data-lang-key');
            if (texts[key]) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = texts[key]; 
                } else {
                    el.innerHTML = texts[key]; 
                }
            }
        });
        
        // 2. 강제 Placeholder
        const placeholderElements = document.querySelectorAll('[data-lang-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            if (texts[key]) el.placeholder = texts[key];
        });

        // 3. 드롭다운 그룹(<optgroup>) 라벨 번역
        const labelElements = document.querySelectorAll('[data-lang-label]');
        labelElements.forEach(el => {
            const key = el.getAttribute('data-lang-label');
            if (texts[key]) el.label = texts[key];
        });

        // 4. 마우스 호버 툴팁 번역
        const tooltipElements = document.querySelectorAll('[data-lang-tooltip]');
        tooltipElements.forEach(el => {
            const key = el.getAttribute('data-lang-tooltip');
            if (texts[key]) el.title = texts[key];
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new App();
});