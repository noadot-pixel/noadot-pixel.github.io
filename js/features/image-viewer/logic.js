import { eventBus } from '../../core/EventBus.js';
import { state, rgbToHex } from '../../state.js';
import { ImageViewerUI } from './ui.js';

export class ImageViewerFeature {
    constructor() {
        this.ui = new ImageViewerUI();
        
        // 상태 초기화
        state.currentZoom = 100;
        state.panX = 0;
        state.panY = 0;
        state.isDragging = false;
        
        this.isEyedropperActive = false; // 스포이드 활성 상태

        this.startDragX = 0;
        this.startDragY = 0;
        this.hasDragged = false;

        this.initBusListeners();
        this.initInteractions();
    }

    initBusListeners() {
        eventBus.on('CONVERSION_START', () => this.ui.toggleLoading(true));
        
        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (data && data.imageData) {
                state.latestConversionData = data.imageData;
                // 스포이드 모드가 아닐 때만 결과물 갱신
                if (!this.isEyedropperActive) {
                    this.ui.updateCanvas(data.imageData);
                    this.updateTransform();
                }
            }
            this.ui.toggleLoading(false);
        });

        eventBus.on('IMAGE_LOADED', (source) => {
            if (source instanceof HTMLImageElement || source.tagName === 'IMG') {
                state.originalImageObject = source;
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = source.width;
                tempCanvas.height = source.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.drawImage(source, 0, 0);
                state.originalImageData = ctx.getImageData(0, 0, source.width, source.height);
                
                this.resetView();
                this.ui.updateCanvas(state.originalImageData);
                this.ui.showCanvas();
            }
            else if (source.data && source.width && source.height) {
                state.originalImageData = source;
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = source.width;
                tempCanvas.height = source.height;
                tempCanvas.getContext('2d').putImageData(source, 0, 0);
                state.originalImageObject = new Image();
                state.originalImageObject.src = tempCanvas.toDataURL();

                this.resetView();
                this.ui.updateCanvas(source);
                this.ui.showCanvas();
            }
        });
    }

    initInteractions() {
        const container = this.ui.container;
        if (!container) return;

        // 1. 스포이드 버튼 클릭 이벤트
        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEyedropper(!this.isEyedropperActive);
            });
        }

        // 클릭 차단
        container.addEventListener('click', (e) => {
            if (state.originalImageData) {
                const isControl = e.target.closest('button, input, select, a, label, .top-right-ui');
                if (isControl) return; 

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true });

        // 줌
        container.addEventListener('wheel', (e) => {
            if (!state.originalImageData) return;
            e.preventDefault();
            e.stopPropagation();

            const delta = -Math.sign(e.deltaY);
            const zoomSpeed = 0.1;

            let newZoom = state.currentZoom + (delta * zoomSpeed * state.currentZoom);
            newZoom = Math.max(10, Math.min(5000, newZoom)); // 최대 5000%
            
            state.currentZoom = newZoom;
            this.updateTransform();
        }, { passive: false });

        // 마우스 다운
        container.addEventListener('mousedown', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return;

            // [스포이드 모드]
            if (this.isEyedropperActive) {
                this.handleEyedropperPick(e);
                return;
            }

            state.isDragging = true;
            this.hasDragged = false;
            this.startDragX = e.clientX - state.panX;
            this.startDragY = e.clientY - state.panY;
            this.ui.setGrabbing(true);
        });

        // 마우스 이동
        window.addEventListener('mousemove', (e) => {
            if (this.isEyedropperActive) {
                this.handlePixelHover(e);
            } 
            else if (state.isDragging) {
                e.preventDefault();
                const currentX = e.clientX - this.startDragX;
                const currentY = e.clientY - this.startDragY;

                if (Math.abs(currentX - state.panX) > 2 || Math.abs(currentY - state.panY) > 2) {
                    this.hasDragged = true;
                }

                state.panX = currentX;
                state.panY = currentY;
                this.updateTransform();
            }
        });

        // 마우스 업
        window.addEventListener('mouseup', () => {
            if (state.isDragging) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });
        
        // 버튼 이벤트들
        if (this.ui.centerBtn) {
            this.ui.centerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetView();
            });
        }
        if (this.ui.resetBtn) this.ui.resetBtn.addEventListener('click', () => this.resetView());

        if (this.ui.compareBtn) {
            const showOriginal = (e) => {
                if(e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (!state.originalImageData) return;
                this.ui.showOriginalImage();
            };

            const showConverted = (e) => {
                if(e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (state.latestConversionData) {
                    this.ui.showConvertedImage();
                } else {
                    this.ui.showOriginalImage();
                }
            };

            this.ui.compareBtn.addEventListener('mousedown', showOriginal);
            this.ui.compareBtn.addEventListener('mouseup', showConverted);
            this.ui.compareBtn.addEventListener('mouseleave', showConverted);
            
            this.ui.compareBtn.addEventListener('touchstart', showOriginal, {passive: false});
            this.ui.compareBtn.addEventListener('touchend', showConverted, {passive: false});
            
            this.ui.compareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            });
        }
    }

    updateTransform() {
        this.ui.updateTransform(state.currentZoom, state.panX, state.panY);
    }

    resetView() {
        state.currentZoom = 100;
        state.panX = 0;
        state.panY = 0;
        this.updateTransform();
    }

    // [핵심 수정] 스포이드 토글 시 이미지 전환 로직 추가
    toggleEyedropper(active) {
        this.isEyedropperActive = active;
        this.ui.toggleEyedropperState(active);
        
        if (active) {
            // [ON] 원본 이미지 표시 (정확한 색상 추출을 위해)
            this.ui.showOriginalImage();
        } else {
            // [OFF] 정보창 숨기고, 변환 리프레시 (결과물 다시 보기)
            this.ui.updatePixelInfo(false);
            console.log("스포이드 해제 -> 변환 리프레시 요청");
            eventBus.emit('OPTION_CHANGED');
        }
    }

    handleEyedropperPick(e) {
        if (!state.originalImageData) return;
        
        const rect = this.ui.canvas.getBoundingClientRect();
        const scaleX = this.ui.canvas.width / rect.width;
        const scaleY = this.ui.canvas.height / rect.height;

        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (x < 0 || x >= this.ui.canvas.width || y < 0 || y >= this.ui.canvas.height) return;

        const ctx = this.ui.canvas.getContext('2d');
        const p = ctx.getImageData(x, y, 1, 1).data;
        const rgb = [p[0], p[1], p[2]];

        eventBus.emit('REQUEST_ADD_COLOR', rgb);
    }

    handlePixelHover(e) {
        const rect = this.ui.canvas.getBoundingClientRect();
        const scaleX = this.ui.canvas.width / rect.width;
        const scaleY = this.ui.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (x >= 0 && x < this.ui.canvas.width && y >= 0 && y < this.ui.canvas.height) {
            const ctx = this.ui.canvas.getContext('2d');
            const p = ctx.getImageData(x, y, 1, 1).data;
            const hex = rgbToHex(p[0], p[1], p[2]);
            this.ui.updatePixelInfo(true, x, y, { r: p[0], g: p[1], b: p[2], hex: hex }, e);
        } else {
            this.ui.updatePixelInfo(false);
        }
    }
}