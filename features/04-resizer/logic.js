import { eventBus } from '../../core/EventBus.js';
import { state } from '../../core/state.js';
import { ImageResizerUI } from './ui.js';

export class ImageResizerFeature {
    constructor() {
        this.ui = new ImageResizerUI();
        
        // UI 요소 연결
        this.algoRadios = document.querySelectorAll('input[name="resizeAlgo"]');
        this.modeSelect = document.getElementById('scaleModeSelect');
        this.pixelControls = document.getElementById('pixel-scale-controls');
        this.ratioControls = document.getElementById('ratio-scale-controls');
        
        this.pixelSlider = document.getElementById('pixelWidthSlider');
        this.pixelSliderVal = document.getElementById('pixelSliderValue');
        this.widthInput = document.getElementById('scaleWidth');
        this.heightInput = document.getElementById('scaleHeight');
        
        this.ratioSlider = document.getElementById('scaleSlider');
        this.ratioValue = document.getElementById('scaleValue');
        
        this.exportSlider = document.getElementById('exportScaleSlider');
        this.exportValue = document.getElementById('exportScaleValue');

        this.initEvents();
        this.initBusListeners();

        // 초기 실행 시 데이터가 이미 있다면 표시
        if (state.originalImageData) {
            this.resetToImage(state.originalImageData);
        }
    }

    // 🌟 이미지를 새로 읽었을 때 모든 수치를 리셋하는 핵심 함수
    resetToImage(imgData) {
        const { width, height } = imgData;
        
        // 1. 픽셀 슬라이더 리셋
        if (this.pixelSlider) {
            this.pixelSlider.max = width; 
            this.pixelSlider.value = width; 
            this.pixelSliderVal.textContent = `${width}px`;
        }

        // 2. 비율 슬라이더 리셋 (1:1 상태로)
        if (this.ratioSlider) {
            this.ratioSlider.value = 1;
            if (this.ratioValue) this.ratioValue.textContent = '1:1 비율';
        }

        // 3. 숫자 입력 칸 리셋
        if (this.widthInput) this.widthInput.value = width;
        if (this.heightInput) this.heightInput.value = height;

        this.ui.updateOriginalStats(width, height);
        this.updateStateAndConvert();
    }

    initEvents() {
        // 1. 알고리즘 선택 이벤트
        this.algoRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    state.resizeMode = e.target.value;
                    this.updateStateAndConvert();
                }
            });
        });

        // 🌟 [복구 1] 조절 방식 드롭다운 이벤트 (픽셀 vs 비율 화면 전환)
        if (this.modeSelect) {
            this.modeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'pixel') {
                    this.pixelControls.style.display = 'block';
                    this.ratioControls.style.display = 'none';
                } else {
                    this.pixelControls.style.display = 'none';
                    this.ratioControls.style.display = 'block';
                }
            });
        }

        // 3. 픽셀 슬라이더 조절 이벤트
        this.pixelSlider.addEventListener('input', (e) => {
            const newWidth = parseInt(e.target.value, 10);
            this.pixelSliderVal.textContent = `${newWidth}px`;
            this.widthInput.value = newWidth;
            
            if (state.originalImageData) {
                const ratio = state.originalImageData.height / state.originalImageData.width;
                this.heightInput.value = Math.floor(newWidth * ratio);
                this.updateStateAndConvert();
            }
        });

        // 4. 숫자 직접 입력 이벤트
        this.widthInput.addEventListener('change', () => {
            let val = parseInt(this.widthInput.value, 10);
            if (state.originalImageData && val > state.originalImageData.width) {
                val = state.originalImageData.width; // 원본보다 크게 입력 방지
            }
            this.widthInput.value = val;
            this.pixelSlider.value = val;
            this.pixelSliderVal.textContent = `${val}px`;
            
            if (state.originalImageData) {
                const ratio = state.originalImageData.height / state.originalImageData.width;
                this.heightInput.value = Math.floor(val * ratio);
            }
            this.updateStateAndConvert();
        });

        // 비율 단위 슬라이더 이벤트 1:N 방식
        if (this.ratioSlider) {
            this.ratioSlider.addEventListener('input', (e) => {
                const divisor = parseInt(e.target.value, 10);
                
                // 표기 변경: "1:N 비율"
                if (this.ratioValue) {
                    this.ratioValue.textContent = `1:${divisor} 비율`;
                }

                if (state.originalImageData) {
                    // 1:N 비율로 이미지 축소 계산 (최소값 1 보장)
                    const newWidth = Math.max(1, Math.floor(state.originalImageData.width / divisor));
                    const newHeight = Math.max(1, Math.floor(state.originalImageData.height / divisor));
                    
                    this.widthInput.value = newWidth;
                    this.heightInput.value = newHeight;
                    
                    // 🌟 픽셀 슬라이더에도 해당 크기를 전달하여 동기화!
                    if (this.pixelSlider) {
                        this.pixelSlider.value = newWidth;
                        this.pixelSliderVal.textContent = `${newWidth}px`;
                    }
                    
                    this.updateStateAndConvert();
                }
            });
        }

        if (this.exportSlider) {
            this.exportSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                this.exportValue.textContent = `${val}x`;
                state.exportScale = val; 
            });
        }
    }

    initBusListeners() {
        // 🌟 이미지가 새로 업로드되면 리셋 함수 실행!
        eventBus.on('IMAGE_LOADED', () => {
            if (state.originalImageData) {
                this.resetToImage(state.originalImageData);
            }
        });

        // 변환 완료 시 전광판 업데이트
        eventBus.on('CONVERSION_COMPLETE', (payload) => {
            if (payload.stats) {
                this.ui.updateStatsDisplay(payload.stats);
            }
        });
    }

    updateStateAndConvert() {
        state.resizeWidth = parseInt(this.widthInput.value, 10) || 120;
        state.resizeHeight = parseInt(this.heightInput.value, 10) || 120;
        const checkedRadio = document.querySelector('input[name="resizeAlgo"]:checked');
        state.resizeMode = checkedRadio ? checkedRadio.value : 'average';
        
        eventBus.emit('OPTION_CHANGED');
    }
}