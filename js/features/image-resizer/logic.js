// js/features/image-resizer/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../state.js';
import { ImageResizerUI } from './ui.js';
import { ResizeAlgorithms } from './algorithms.js';

export class ImageResizerFeature {
    constructor() {
        this.ui = new ImageResizerUI();
        this.algorithms = new ResizeAlgorithms();
        
        this.initBusListeners();
        this.initEvents();
    }

    updateControlVisibility(mode) {
        if (mode === 'ratio') {
            if (this.ui.ratioControls) {
                this.ui.ratioControls.classList.remove('hidden');
                this.ui.ratioControls.style.display = 'block';
            }
            if (this.ui.pixelControls) {
                this.ui.pixelControls.classList.add('hidden');
                this.ui.pixelControls.style.display = 'none';
            }
        } else {
            if (this.ui.ratioControls) {
                this.ui.ratioControls.classList.add('hidden');
                this.ui.ratioControls.style.display = 'none';
            }
            if (this.ui.pixelControls) {
                this.ui.pixelControls.classList.remove('hidden');
                this.ui.pixelControls.style.display = 'block';
            }
        }
    }

    initBusListeners() {
        eventBus.on('IMAGE_LOADED', (imgObject) => {
            this.ui.toggleControls(true);
            this.ui.toggleInfoPanel(true);
            
            state.resizeWidth = imgObject.width;
            state.resizeHeight = imgObject.height;
            state.aspectRatio = imgObject.height / imgObject.width;
            state.exportScale = 1; 
            state.currentUpscaleFactor = 1;
            
            // [수정] 슬라이더 초기값 1 (1:1 비율)
            if(this.ui.scaleSlider) {
                this.ui.scaleSlider.value = 1;
                // UI 텍스트도 초기화
                this.ui.updateInputs(1, imgObject.width, imgObject.height);
            }

            if(this.ui.pixelScaleSlider) {
                this.ui.pixelScaleSlider.max = Math.max(1, imgObject.width - 1);
                this.ui.pixelScaleSlider.value = 0;
            }
            if(this.ui.exportScaleSlider) this.ui.exportScaleSlider.value = 1;
            if(this.ui.upscaleRadios) {
                this.ui.upscaleRadios.forEach(r => {
                    if (r.value === "1") r.checked = true;
                });
            }

            this.ui.updateExportScaleLabel(1);
            this.updateControlVisibility(state.scaleMode || 'pixel');
            this.calculateDimensions(); 
        });

        eventBus.on('UPSCALE_REQUEST', (factor) => {
            state.currentUpscaleFactor = factor;
            this.calculateDimensions();
        });
    }

    initEvents() {
        // [수정] 슬라이더 속성: 1 ~ 16, 단위 1
        if (this.ui.scaleSlider) {
            this.ui.scaleSlider.min = "1";
            this.ui.scaleSlider.max = "16";
            this.ui.scaleSlider.step = "1";
        }

        if(this.ui.scaleModeSelect) {
            this.ui.scaleModeSelect.addEventListener('change', (e) => {
                state.scaleMode = e.target.value;
                this.updateControlVisibility(state.scaleMode);
                if (state.originalImageData) {
                    this.ui.syncSliders(state.resizeWidth, state.originalImageData.width);
                }
                this.calculateDimensions();
            });
        }

        // [수정] 1. 비율 슬라이더 조작 (1:n 방식)
        if(this.ui.scaleSlider) {
            this.ui.scaleSlider.addEventListener('input', (e) => {
                if (!state.originalImageData) return;
                
                // val = 1 (1:1), 2 (1:2), ... 16 (1:16)
                const val = parseInt(e.target.value, 10);
                
                // 비율 계산: 1 / n
                const ratio = 1 / val; 
                
                const w = Math.max(1, Math.round(state.originalImageData.width * ratio));
                const h = Math.max(1, Math.round(state.originalImageData.height * ratio));
                
                // updateInputs에 현재 단계(val)를 넘김
                this.ui.updateInputs(val, w, h);
                state.resizeWidth = w;
                state.resizeHeight = h;
                this.calculateDimensions();
            });

            this.ui.scaleSlider.addEventListener('change', () => {
                eventBus.emit('OPTION_CHANGED');
            });
        }

        // 2. 픽셀 슬라이더 조작
        if(this.ui.pixelScaleSlider) {
            this.ui.pixelScaleSlider.addEventListener('input', (e) => {
                if (!state.originalImageData) return;
                const reduction = parseInt(e.target.value, 10);
                const w = Math.max(1, state.originalImageData.width - reduction);
                const h = Math.max(1, Math.round(w * state.aspectRatio));
                
                this.ui.updateInputs(null, w, h);
                state.resizeWidth = w;
                state.resizeHeight = h;
                this.calculateDimensions();
            });

            this.ui.pixelScaleSlider.addEventListener('change', () => {
                eventBus.emit('OPTION_CHANGED');
            });
        }

        // 3. 수동 숫자 입력 핸들러
        const handleManualInput = (type) => {
            if (!state.originalImageData) return;
            let w = parseInt(this.ui.widthInput.value, 10) || 1;
            let h = parseInt(this.ui.heightInput.value, 10) || 1;

            if (type === 'width') {
                h = Math.max(1, Math.round(w * state.aspectRatio));
                this.ui.heightInput.value = h;
            } else {
                w = Math.max(1, Math.round(h / state.aspectRatio));
                this.ui.widthInput.value = w;
            }
            
            state.resizeWidth = w;
            state.resizeHeight = h;

            this.ui.syncSliders(w, state.originalImageData.width);

            this.calculateDimensions();
            eventBus.emit('OPTION_CHANGED');
        };

        if(this.ui.widthInput) this.ui.widthInput.addEventListener('change', () => handleManualInput('width'));
        if(this.ui.heightInput) this.ui.heightInput.addEventListener('change', () => handleManualInput('height'));

        // 4. 출력 배율 슬라이더
        if(this.ui.exportScaleSlider) {
            this.ui.exportScaleSlider.addEventListener('input', (e) => {
                state.exportScale = parseInt(e.target.value, 10);
                this.ui.updateExportScaleLabel(state.exportScale);
                this.calculateDimensions();
            });
        }
        
        // 5. +, - 버튼 조작
        document.querySelectorAll('.scale-mod-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!state.originalImageData) return;
                const targetId = e.target.dataset.target; 
                const amount = parseInt(e.target.dataset.amount, 10);
                
                if (targetId === 'scaleWidth') {
                    let newW = (parseInt(this.ui.widthInput.value) || 0) + amount;
                    if(newW < 1) newW = 1;
                    this.ui.widthInput.value = newW;
                    handleManualInput('width');
                } else {
                    let newH = (parseInt(this.ui.heightInput.value) || 0) + amount;
                    if(newH < 1) newH = 1;
                    this.ui.heightInput.value = newH;
                    handleManualInput('height');
                }
            });
        });

        // 6. 업스케일 라디오 버튼
        if (this.ui.upscaleRadios) {
            this.ui.upscaleRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const factor = parseInt(e.target.value, 10);
                    eventBus.emit('UPSCALE_REQUEST', factor);
                });
            });
        }
    }

    calculateDimensions() {
        if (!state.originalImageData) return;

        this.ui.updateInfo(
            state.originalImageData.width,
            state.originalImageData.height,
            state.resizeWidth,
            state.resizeHeight,
            state.exportScale || 1,
            state.currentUpscaleFactor || 1
        );
    }
}