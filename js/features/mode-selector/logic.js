// js/features/mode-selector/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../state.js'; // [수정] t 함수 임포트
import { ModeSelectorUI } from './ui.js';

export class ModeSelectorFeature {
    constructor() {
        this.ui = new ModeSelectorUI();
        this.conversionOptionSection = document.querySelector('h2[data-lang-key="section_options"]')?.closest('section');
        this.presetSections = document.querySelectorAll('#ai-preset-section');
        
        this.initEvents();

        setTimeout(() => {
            console.log("[ModeSelector] 앱 초기화 완료: 이미지 모드 강제 적용");
            this.setMode('image', true);
        }, 0);
    }

    initEvents() {
        const handleModeClick = (e, targetMode) => {
            if (state.appMode === targetMode) return;

            let confirmMsg = null;
            if (state.appMode === 'image' && state.originalImageData) {
                // [수정] 언어 파일 키 사용
                confirmMsg = t('confirm_mode_switch_to_text');
            } 
            else if (state.appMode === 'text') {
                if (state.textState.content && state.textState.content.trim() !== "") {
                    // [수정] 언어 파일 키 사용
                    confirmMsg = t('confirm_mode_switch_to_image');
                }
            }

            if (confirmMsg) {
                const isConfirmed = confirm(confirmMsg);
                if (!isConfirmed) {
                    e.preventDefault(); 
                    this.ui.updateDisplay(state.appMode); 
                    return;
                }
            }

            this.setMode(targetMode);
        };

        if (this.ui.imageRadio) {
            this.ui.imageRadio.addEventListener('click', (e) => handleModeClick(e, 'image'));
        }
        if (this.ui.textRadio) {
            this.ui.textRadio.addEventListener('click', (e) => handleModeClick(e, 'text'));
        }
    }

    setMode(mode, force = false) {
        if (!force && state.appMode === mode) return;

        console.log(`[ModeSelector] 모드 전환: ${mode} (Force: ${force})`);
        state.appMode = mode;
        
        this.ui.updateDisplay(mode);

        if (mode === 'text') {
            if (this.conversionOptionSection) this.conversionOptionSection.style.display = 'none';
            this.presetSections.forEach(el => el.style.display = 'none');

            state.colorMethodSelect = 'ciede2000';
            const methodSelect = document.getElementById('colorMethodSelect');
            if(methodSelect) methodSelect.value = 'ciede2000';

            this.resetImageState();
            eventBus.emit('TEXT_CONFIG_UPDATED');

        } else {
            if (this.conversionOptionSection) this.conversionOptionSection.style.display = 'block';
            this.presetSections.forEach(el => el.style.display = 'block');

            state.colorMethodSelect = 'oklab';
            const methodSelect = document.getElementById('colorMethodSelect');
            if(methodSelect) methodSelect.value = 'oklab';

            this.resetTextState();
            eventBus.emit('OPTION_CHANGED');
        }
        eventBus.emit('MODE_CHANGED', mode);
    }

    clearCanvas() {
        const canvas = document.getElementById('convertedCanvas');
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none'; 
        }
        
        const placeholder = document.getElementById('placeholder-ui');
        if(placeholder) placeholder.style.display = 'flex';
        
        const container = document.getElementById('convertedCanvasContainer');
        if(container) container.classList.remove('has-image');
    }

    resetImageState() {
        state.originalImageData = null;
        state.originalImageObject = null;
        state.uploadedImageObject = null; 
        
        state.resizeWidth = null;
        state.resizeHeight = null;
        state.aspectRatio = null;

        const fileInput = document.getElementById('imageUpload');
        if (fileInput) fileInput.value = '';

        this.clearCanvas(); 
    }

    resetTextState() {
        if (state.textState) {
            state.textState.content = ""; 
            state.textState.fontFamily = "Malgun Gothic"; 
        }
        
        const textarea = document.getElementById('editor-textarea') || document.getElementById('textInput');
        if (textarea) textarea.value = "";

        state.originalImageData = null;
        
        state.resizeWidth = null;
        state.resizeHeight = null;
        state.aspectRatio = null;

        this.clearCanvas(); 
    }
}