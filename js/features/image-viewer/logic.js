import { eventBus } from '../../core/EventBus.js';
import { state, rgbToHex } from '../../state.js';
import { ImageViewerUI } from './ui.js';

export class ImageViewerFeature {
    constructor() {
        this.ui = new ImageViewerUI();
        
        state.currentZoom = 100;
        state.panX = 0;
        state.panY = 0;
        state.isDragging = false;
        
        this.isEyedropperActive = false;
        
        this.startDragX = 0;
        this.startDragY = 0;
        
        this.initBusListeners();
        this.initInteractions();
    }

    initBusListeners() {
        eventBus.on('CONVERSION_START', () => this.ui.toggleLoading(true));
        
        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (data && data.imageData) {
                state.latestConversionData = data.imageData;
                if (!this.isEyedropperActive) {
                    this.ui.updateCanvas(data.imageData);
                }
                this.updateTransform();
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
            this.toggleEyedropper(false);
        });
    }

    initInteractions() {
        const container = this.ui.container;
        if (!container) return;

        // [마우스 이동]
        container.addEventListener('mousemove', (e) => {
            if (this.isEyedropperActive) {
                if (e.target.closest('#viewer-toolbar') || e.target.closest('button')) {
                    this.ui.updatePixelInfo(false);
                    return;
                }
                if (state.originalImageData) {
                    this.handleEyedropperHover(e);
                }
            } else if (state.isDragging) {
                this.handleDragMove(e);
            }
        });

        // [클릭] 통합 핸들러
        container.addEventListener('click', (e) => {
            if (e.target.closest('#viewer-toolbar') || e.target.closest('button')) {
                return; 
            }

            if (state.originalImageData) {
                if (this.isEyedropperActive) {
                    this.handleEyedropperClick(e);
                }
                
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true });

        // [리셋 버튼] - 수정됨: 이미지는 유지하고 설정만 초기화
        if (this.ui.resetBtn) {
            this.ui.resetBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                if (confirm("이미지를 제외한 모든 설정(색상, 옵션)을 초기화하시겠습니까?")) {
                    // window.location.reload(); // 삭제됨 (새로고침 방지)
                    
                    eventBus.emit('REQUEST_RESET_ALL'); // App.js에 초기화 요청
                    
                    this.resetView(); // 뷰어 줌/이동 초기화
                    this.toggleEyedropper(false); // 스포이드 모드 해제
                }
            });
        }

        // [스포이드 버튼]
        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.toggleEyedropper(!this.isEyedropperActive);
            });
        }

        // [중앙 이동 버튼]
        if (this.ui.centerBtn) {
            this.ui.centerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetView();
            });
        }

        // [비교 버튼]
        if (this.ui.compareBtn) {
            const showOriginal = (e) => {
                if (this.isEyedropperActive) return;
                e.stopPropagation();
                if (state.originalImageData) this.ui.showOriginalImage();
            };
            const showConverted = (e) => {
                if (this.isEyedropperActive) return;
                e.stopPropagation();
                if (state.latestConversionData) this.ui.showConvertedImage();
                else this.ui.showOriginalImage();
            };

            this.ui.compareBtn.addEventListener('mousedown', showOriginal);
            this.ui.compareBtn.addEventListener('mouseup', showConverted);
            this.ui.compareBtn.addEventListener('mouseleave', showConverted);
            
            this.ui.compareBtn.addEventListener('touchstart', showOriginal, {passive: false});
            this.ui.compareBtn.addEventListener('touchend', showConverted, {passive: false});
            
            this.ui.compareBtn.addEventListener('click', (e) => e.stopPropagation());
        }

        // 줌 (Wheel)
        container.addEventListener('wheel', (e) => {
            if (!state.originalImageData) return;
            e.preventDefault();
            
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            const delta = -Math.sign(e.deltaY);
            const zoomSpeed = 0.1;

            let newZoom = state.currentZoom + (delta * zoomSpeed * state.currentZoom);
            newZoom = Math.max(10, Math.min(500, newZoom));

            const scaleRatio = newZoom / state.currentZoom;
            state.panX = mouseX - (mouseX - state.panX) * scaleRatio;
            state.panY = mouseY - (mouseY - state.panY) * scaleRatio;
            
            state.currentZoom = newZoom;
            this.updateTransform();
        }, { passive: false });

        // 드래그 시작
        container.addEventListener('mousedown', (e) => {
            if (!state.originalImageData || this.isEyedropperActive) return; 
            if (e.target.closest('button')) return;

            state.isDragging = true;
            this.startDragX = e.clientX - state.panX;
            this.startDragY = e.clientY - state.panY;
            this.ui.setGrabbing(true);
        });

        // 드래그 종료
        window.addEventListener('mouseup', () => {
            if (state.isDragging) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });
    }

    handleDragMove(e) {
        e.preventDefault();
        const currentX = e.clientX - this.startDragX;
        const currentY = e.clientY - this.startDragY;
        state.panX = currentX;
        state.panY = currentY;
        this.updateTransform();
    }

    toggleEyedropper(active) {
        this.isEyedropperActive = active;
        this.ui.toggleEyedropperState(active);

        if (active) {
            if (state.originalImageData) {
                this.ui.showOriginalImage();
            }
        } else {
            this.ui.updatePixelInfo(false);
            if (state.latestConversionData) {
                this.ui.showConvertedImage();
            } else {
                this.ui.showOriginalImage();
            }
        }
    }

    handleEyedropperHover(e) {
        if (!state.originalImageData) return;

        const rect = this.ui.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        const scale = state.currentZoom / 100;
        const x = Math.floor(clientX / scale);
        const y = Math.floor(clientY / scale);

        const width = state.originalImageData.width;
        const height = state.originalImageData.height;

        if (x >= 0 && x < width && y >= 0 && y < height) {
            const index = (y * width + x) * 4;
            const data = state.originalImageData.data;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const hex = rgbToHex(r, g, b);

            this.ui.updatePixelInfo(true, x, y, { r, g, b, hex }, e);
        } else {
            this.ui.updatePixelInfo(false);
        }
    }

    handleEyedropperClick(e) {
        if (!state.originalImageData) return;
        
        const rect = this.ui.canvas.getBoundingClientRect();
        const scale = state.currentZoom / 100;
        const x = Math.floor((e.clientX - rect.left) / scale);
        const y = Math.floor((e.clientY - rect.top) / scale);

        const width = state.originalImageData.width;
        const height = state.originalImageData.height;

        if (x >= 0 && x < width && y >= 0 && y < height) {
            const index = (y * width + x) * 4;
            const data = state.originalImageData.data;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            
            eventBus.emit('REQUEST_ADD_COLOR', [r, g, b]);
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
}