// js/App.js
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
        console.log("🚀 NoaDot v6.1 App Starting...");
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
        eventBus.on('OPTION_CHANGED', () => {
            this.workerBridge.triggerConversion(); 
        });

        // [수정] 모드 변경 시 초기화 로직 강화
        eventBus.on('MODE_CHANGED', (mode) => {
             // 1. 변환 옵션(그라데이션, 패턴 등) 초기화
             if (this.conversionOptions && this.conversionOptions.resetOptions) {
                 this.conversionOptions.resetOptions(); 
             }
             
             // 2. [핵심] 모든 팔레트(시스템/유저)의 사용량 통계 초기화
             // '빈 결과'를 강제로 방송하여 모든 UI의 숫자를 지웁니다.
             eventBus.emit('IMAGE_ANALYZED', { 
                 pixelStats: {}, 
                 recommendations: [] 
             });

             if(mode === 'image') this.workerBridge.triggerConversion();
        });

        eventBus.on('BATCH_OPTION_CHANGED', () => {
             this.workerBridge.triggerConversion();
        });

        eventBus.on('PALETTE_UPDATED', () => {
            this.workerBridge.triggerConversion(); 
        });
        
        eventBus.on('LANGUAGE_CHANGED', (lang) => {
            console.log(`[App] Language switched to: ${lang}`);
            this.updateDOMText(); 
        });
    }

    initLanguage() {
        const langButtons = document.querySelectorAll('#language-switcher button[data-lang]');
        
        if (langButtons.length > 0) {
            langButtons.forEach(btn => {
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
        
        this.updateDOMText();
        eventBus.emit('LANGUAGE_CHANGED', lang);
    }

    updateDOMText() {
        if (!languageData) {
            console.warn("Language data not loaded");
            return;
        }

        const texts = languageData[state.language];
        if (!texts) return;

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

        // 플레이스홀더 번역 적용
        const placeholderElements = document.querySelectorAll('[data-lang-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            if (texts[key]) {
                el.placeholder = texts[key];
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new App();
});