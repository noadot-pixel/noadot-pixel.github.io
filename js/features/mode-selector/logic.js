// js/features/mode-selector/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../state.js'; 
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
            // 1. 이미지 -> 텍스트 전환 시 경고
            if (state.appMode === 'image' && state.originalImageData) {
                confirmMsg = t('confirm_mode_switch_to_text') || "모드를 변경하면 현재 작업 내역과 설정이 초기화됩니다. 계속하시겠습니까?";
            } 
            // 2. 텍스트 -> 이미지 전환 시 경고
            else if (state.appMode === 'text') {
                const textarea = document.getElementById('editor-textarea') || document.getElementById('textInput');
                if (textarea && textarea.value.trim() !== "") {
                    // 🌟 없는 번역 키 대신, 이미 잘 작동하는 키 하나로 통일!
                    confirmMsg = t('confirm_mode_switch_to_text') || "모드를 변경하면 현재 작업 내역과 설정이 초기화됩니다. 계속하시겠습니까?";
                }
            }

            // 경고창 띄우기 및 취소 시 방어
            if (confirmMsg && !confirm(confirmMsg)) {
                e.preventDefault();
                if (targetMode === 'text') this.ui.imageRadio.checked = true;
                else this.ui.textRadio.checked = true;
                return;
            }

            // 승인 시 모드 변경 진행
            this.setMode(targetMode);
        };

        if (this.ui.imageRadio) {
            this.ui.imageRadio.addEventListener('click', (e) => handleModeClick(e, 'image'));
        }
        if (this.ui.textRadio) {
            this.ui.textRadio.addEventListener('click', (e) => handleModeClick(e, 'text'));
        }
    }

    setMode(mode, isInitial = false) {
        state.appMode = mode;
        this.ui.updateUI(mode);

        if (!isInitial) {
            if (mode === 'image') {
                this.resetTextState();
                this.resetImageState(); 
            } else if (mode === 'text') {
                this.resetImageState();
                this.resetTextState(); 
            }
            eventBus.emit('MODE_CHANGED', mode);
            eventBus.emit('CONVERSION_COMPLETE', { imageData: null }); 
        }
    }

    clearCanvas() {
        const canvas = document.getElementById('convertedCanvas');
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none'; 
        }
        
        const placeholder = document.getElementById('placeholder-ui');
        if(placeholder) {
            placeholder.style.setProperty('display', 'flex', 'important');
            placeholder.style.flexDirection = 'column';
        }
        
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
        if (!state.textState) state.textState = {};
        state.textState.content = ""; 
        state.textState.fontFamily = "Malgun Gothic"; 
        
        const textarea = document.getElementById('editor-textarea') || document.getElementById('textInput');
        if (textarea) textarea.value = "";

        state.originalImageData = null;
        state.resizeWidth = null;
        state.resizeHeight = null;

        this.clearCanvas();
    }
}