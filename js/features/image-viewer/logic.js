import { eventBus } from '../../core/EventBus.js';
import { state, rgbToHex, t } from '../../state.js';
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
        this.hasDragged = false;

        this.initBusListeners();
        this.initInteractions();
        
        // 초기화 시점 상태 체크
        this.checkEyedropperStatus();
    }

    // [핵심 기능 1] 버튼 숨기기/보이기 제어 (로직에서 직접 UI 스타일 조작)
    checkEyedropperStatus() {
        // 조건: wplace 모드이거나, geopixels 모드이면서 wplace 팔레트 옵션을 켰을 때
        const isWplaceRelated = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
        // 버튼이 존재하면 display 속성 제어
        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.style.display = isWplaceRelated ? 'none' : 'flex';
        }

        // 숨겨야 하는 상황인데 스포이드 기능이 켜져있다면 -> 강제로 끄기
        if (isWplaceRelated && this.isEyedropperActive) {
            this.toggleEyedropper(false);
        }
    }

    initBusListeners() {
        eventBus.on('CONVERSION_START', () => this.ui.toggleLoading(true));
        
        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (data && data.imageData) {
                state.latestConversionData = data.imageData;
                if (!this.isEyedropperActive) {
                    this.ui.updateCanvas(data.imageData);
                    this.updateTransform();
                }
            }
            this.ui.toggleLoading(false);
        });

        // [핵심 기능 2] 이미지 로드 시 불투명도 전처리
        eventBus.on('IMAGE_LOADED', (source) => {
            const tempCanvas = document.createElement('canvas');
            
            if (source instanceof HTMLImageElement || source.tagName === 'IMG') {
                tempCanvas.width = source.width;
                tempCanvas.height = source.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.drawImage(source, 0, 0);
            } else if (source.data && source.width && source.height) { 
                tempCanvas.width = source.width;
                tempCanvas.height = source.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.putImageData(source, 0, 0);
            }

            const ctx = tempCanvas.getContext('2d');
            const rawData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = rawData.data;

            // 불투명도 255 미만은 모두 투명(0) 처리
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 255) {
                    data[i + 3] = 0; 
                }
            }

            ctx.putImageData(rawData, 0, 0);
            state.originalImageData = rawData;
            state.originalImageObject = new Image();
            state.originalImageObject.src = tempCanvas.toDataURL();

            this.resetView();
            this.ui.updateCanvas(state.originalImageData);
            this.ui.showCanvas();
            
            this.checkEyedropperStatus();
        });

        // 모드 변경 시 체크
        eventBus.on('MODE_CHANGED', (mode) => {
            this.checkEyedropperStatus();
        });
        
        // 옵션 변경 시 체크 (Wplace 팔레트 사용 체크박스 등)
        eventBus.on('OPTION_CHANGED', () => {
             this.checkEyedropperStatus();
        });

        // [추가] 팔레트 변경 시 체크 (확실한 업데이트를 위해 추가)
        eventBus.on('PALETTE_UPDATED', () => {
            this.checkEyedropperStatus();
        });
    }

    initInteractions() {
        const container = this.ui.container;
        if (!container) return;

        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEyedropper(!this.isEyedropperActive);
            });
        }

        container.addEventListener('click', (e) => {
            if (state.originalImageData) {
                const isControl = e.target.closest('button, input, select, a, label, .top-right-ui');
                if (isControl) return; 

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true });

        container.addEventListener('wheel', (e) => {
            if (!state.originalImageData) return;
            e.preventDefault();
            e.stopPropagation();

            const delta = -Math.sign(e.deltaY);
            const zoomSpeed = 0.1;

            let newZoom = state.currentZoom + (delta * zoomSpeed * state.currentZoom);
            newZoom = Math.max(10, Math.min(5000, newZoom)); 
            
            state.currentZoom = newZoom;
            this.updateTransform();
        }, { passive: false });

        container.addEventListener('mousedown', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return;

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

        window.addEventListener('mouseup', () => {
            if (state.isDragging) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });
        
        if (this.ui.centerBtn) {
            this.ui.centerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetView(); 
            });
        }

        if (this.ui.resetBtn) {
            this.ui.resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(t('confirm_reset_all_settings'))) {
                    eventBus.emit('REQUEST_RESET_ALL');
                }
            });
        }

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

    toggleEyedropper(active) {
        this.isEyedropperActive = active;
        this.ui.toggleEyedropperState(active);
        
        if (active) {
            this.ui.showOriginalImage();
        } else {
            this.ui.updatePixelInfo(false);
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