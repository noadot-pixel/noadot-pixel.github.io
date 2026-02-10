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
        this.imageResizer = new ImageResizerFeature(); // 여기서 생성됨
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
             eventBus.emit('IMAGE_ANALYZED', { pixelStats: {}, recommendations: [] });
             if(mode === 'image') this.workerBridge.triggerConversion();
        });
        eventBus.on('BATCH_OPTION_CHANGED', () => this.workerBridge.triggerConversion());
        eventBus.on('PALETTE_UPDATED', () => this.workerBridge.triggerConversion());
        eventBus.on('LANGUAGE_CHANGED', (lang) => {
            this.updateDOMText(); 
        });

        // [수정] 리셋 요청 처리: 모든 기능의 초기화 메서드를 호출
        eventBus.on('REQUEST_RESET_ALL', () => {
            // 1. 변환 옵션 초기화 (밝기, 대비 등)
            if (this.conversionOptions && this.conversionOptions.resetOptions) {
                this.conversionOptions.resetOptions();
            }
            
            // 2. [New] 리사이저 초기화 (크기, 배율 등) - 여기가 핵심!
            if (this.imageResizer && this.imageResizer.resetSettings) {
                this.imageResizer.resetSettings();
            }

            // 3. 사용자 팔레트 및 색상 초기화 (이미 UserPaletteFeature 내부 로직으로도 처리됨)
            state.addedColors = []; 
            eventBus.emit('PALETTE_UPDATED');

            // 4. 변환 다시 실행 (원본 상태로)
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
        if (!languageData) return;
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
        
        const placeholderElements = document.querySelectorAll('[data-lang-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            if (texts[key]) el.placeholder = texts[key];
        });
        
        const tooltipElements = document.querySelectorAll('[data-lang-tooltip]');
        tooltipElements.forEach(el => {
            const key = el.getAttribute('data-lang-tooltip');
            if (texts[key]) {
                el.title = texts[key];
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new App();
});