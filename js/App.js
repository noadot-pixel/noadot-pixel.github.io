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
        console.log("🚀 NoaDot v6.2 App Starting...");
        this.workerBridge = new WorkerBridge(); 
        
        this.initFeatures();
        this.initLanguage();
        this.initCoreListeners();
        this.initTheme();
        this.showMaintenanceModal();
    }

    showMaintenanceModal() {
        const modal = document.getElementById('maintenanceModal');
        const msgKo = document.getElementById('maintenanceMsgKo');
        const msgEn = document.getElementById('maintenanceMsgEn');
        const btnLeave = document.getElementById('btnLeaveSite');
        const btnContinue = document.getElementById('btnContinueSite');

        if (!modal) return;

        // 현재 언어 세팅 (한국어/영어)
        const currentLang = state.language || 'ko';
        if (currentLang === 'ko') {
            msgKo.style.display = 'block';
            msgEn.style.display = 'none';
            btnLeave.textContent = '돌아가기 (Wdot)';
            btnContinue.textContent = '동의 후 계속(Continue)';
        } else {
            msgKo.style.display = 'none';
            msgEn.style.display = 'block';
            btnLeave.textContent = 'Go to Wdot';
            btnContinue.textContent = 'I understand, Continue';
        }

        // 모달 띄우기
        modal.style.display = 'flex';

        // '돌아가기' 버튼 클릭 시 Wdot으로 이동
        btnLeave.addEventListener('click', () => {
            window.location.href = 'https://noipung.github.io/wdot/'; 
        });

        // '계속하기' 버튼 클릭 시 모달 닫기
        btnContinue.addEventListener('click', () => {
            modal.style.display = 'none';
            console.log("[Maintenance] 사용자가 불안정함을 인지하고 진입했습니다.");
        });
    }

    initTheme() {
        const darkModeBtn = document.getElementById('darkModeToggle');
        if (!darkModeBtn) return;

        // 1. 브라우저에 저장된 이전 테마 설정 불러오기 (새로고침 해도 유지)
        const savedTheme = localStorage.getItem('noadot_theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            darkModeBtn.textContent = '☀️ 라이트 모드';
        }

        // 2. 버튼 클릭 시 작동 로직
        darkModeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            
            if (isDark) {
                darkModeBtn.textContent = '☀️ 라이트 모드';
                localStorage.setItem('noadot_theme', 'dark'); // 다크모드 기억하기
            } else {
                darkModeBtn.textContent = '🌙 다크 모드';
                localStorage.setItem('noadot_theme', 'light'); // 라이트모드 기억하기
            }
        });
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
             // [핵심 해결] 모드 변환 시 이전 작업물과 메모리를 완벽히 초기화합니다.
             state.originalImageData = null;
             state.latestConversionData = null;

             if (this.conversionOptions && this.conversionOptions.resetOptions) {
                 this.conversionOptions.resetOptions(); 
             }
             if (this.userPalette && this.userPalette.resetStats) {
                 this.userPalette.resetStats();
             }
             if (this.imageResizer) {
                 if (this.imageResizer.resetSettings) this.imageResizer.resetSettings();
                 if (this.imageResizer.clearWorkspace) this.imageResizer.clearWorkspace();
             }
             
             if (this.exportFeature && this.exportFeature.updateUplaceOptionVisibility) {
                 this.exportFeature.updateUplaceOptionVisibility();
             }

             const compareBtn = document.getElementById('compareBtn');
             const eyedropperBtn = document.getElementById('eyedropperBtn');
             
             if (compareBtn) compareBtn.style.display = (mode === 'text') ? 'none' : 'flex';
             if (eyedropperBtn) eyedropperBtn.style.display = (mode === 'text') ? 'none' : 'flex';

             const scaleControls = document.getElementById('scaleControlsFieldset');
             const infoPanel = document.getElementById('imageInfoPanel');
             
             // 1. 크기 조절 옵션 잠금/해제
             if (scaleControls) scaleControls.disabled = (mode === 'text');
             
             // 2. 정보 패널 숨기기 (새 이미지가 로드되거나 텍스트를 치면 다시 켜짐)
             if (infoPanel) infoPanel.style.display = 'none';

             // 3. 캔버스 화면 초기화 (플레이스홀더 다시 노출)
             const canvas = document.getElementById('convertedCanvas');
             const placeholder = document.getElementById('placeholder-ui');
             if (canvas) canvas.style.display = 'none';
             if (placeholder) {
                 placeholder.style.display = 'flex';
                 placeholder.style.flexDirection = 'column';
             }

             // 4. 입력 폼 내용 비우기
             if (mode === 'text') {
                 const textarea = document.getElementById('editor-textarea') || document.getElementById('textInput');
                 if (textarea) textarea.value = '';
             } else {
                 const fileInput = document.getElementById('imageUpload');
                 if (fileInput) fileInput.value = '';
             }

             eventBus.emit('IMAGE_ANALYZED', { pixelStats: {}, recommendations: [] });
        });

        eventBus.on('BATCH_OPTION_CHANGED', () => this.workerBridge.triggerConversion());
        
        eventBus.on('PALETTE_UPDATED', () => {
            this.workerBridge.triggerConversion();
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
        localStorage.setItem('noadot_language', lang);
        
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

        const labelElements = document.querySelectorAll('[data-lang-label]');
        labelElements.forEach(el => {
            const key = el.getAttribute('data-lang-label');
            if (texts[key]) el.label = texts[key];
        });

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