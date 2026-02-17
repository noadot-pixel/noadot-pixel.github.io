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
        
        this.lastTouchDistance = 0;

        this.initBusListeners();
        this.initInteractions();
        
        this.checkEyedropperStatus();
    }

    checkEyedropperStatus() {
        const isWplaceRelated = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.style.display = isWplaceRelated ? 'none' : 'flex';
        }

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

        eventBus.on('MODE_CHANGED', (mode) => {
            this.checkEyedropperStatus();
        });
        
        eventBus.on('OPTION_CHANGED', () => {
             this.checkEyedropperStatus();
        });

        eventBus.on('PALETTE_UPDATED', () => {
            this.checkEyedropperStatus();
        });
    }

    initInteractions() {
        const container = this.ui.container;
        if (!container) return;

        // [신규] 선명한 리사이징 체크박스 이벤트
        if (this.ui.chkSharpResizing) {
            this.ui.chkSharpResizing.addEventListener('change', (e) => {
                // 체크됨(true) -> Sharp(선명하게) -> smoothing false
                // 체크해제(false) -> Smooth(부드럽게) -> smoothing true
                this.ui.toggleImageSmoothing(e.target.checked);
            });
        }

        // 줌 버튼 이벤트
        if (this.ui.zoomInBtn) {
            this.ui.zoomInBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.adjustZoom(10);
            });
        }
        if (this.ui.zoomOutBtn) {
            this.ui.zoomOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.adjustZoom(-10);
            });
        }

        // 스포이드 버튼
        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEyedropper(!this.isEyedropperActive);
            });
        }

        // 컨테이너 클릭
        container.addEventListener('click', (e) => {
            if (state.originalImageData) {
                const isControl = e.target.closest('button, input, select, a, label, .top-right-ui');
                if (isControl) return; 

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true });

        // 휠 줌
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

        // 마우스 드래그
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

        // 모바일 터치 이벤트
        container.addEventListener('touchstart', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return;

            // 핀치 줌
            if (e.touches.length === 2) {
                e.preventDefault();
                state.isDragging = false;
                this.lastTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                return;
            }

            // 스포이드
            if (this.isEyedropperActive) {
                if (e.touches.length > 0) {
                    const touch = e.touches[0];
                    this.handleEyedropperPick({ 
                        clientX: touch.clientX, 
                        clientY: touch.clientY 
                    });
                }
                return;
            }

            // 드래그
            if (e.touches.length === 1) {
                state.isDragging = true;
                this.hasDragged = false;
                const touch = e.touches[0];
                this.startDragX = touch.clientX - state.panX;
                this.startDragY = touch.clientY - state.panY;
                this.ui.setGrabbing(true);
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            // 핀치 줌
            if (e.touches.length === 2 && this.lastTouchDistance > 0) {
                e.preventDefault();
                
                const currentDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );

                const delta = currentDist - this.lastTouchDistance;
                const zoomFactor = 1.5; 
                
                let newZoom = state.currentZoom + (delta * zoomFactor);
                newZoom = Math.max(10, Math.min(5000, newZoom));
                
                state.currentZoom = newZoom;
                this.updateTransform();
                
                this.lastTouchDistance = currentDist;
                return;
            }

            // 드래그
            if (state.isDragging && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                const currentX = touch.clientX - this.startDragX;
                const currentY = touch.clientY - this.startDragY;

                state.panX = currentX;
                state.panY = currentY;
                this.updateTransform();
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this.lastTouchDistance = 0; 
            }
            if (state.isDragging && e.touches.length === 0) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });
        
        // 기존 버튼 이벤트
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
            });
        }
    }

    adjustZoom(amount) {
        if (!state.originalImageData) return;
        let newZoom = state.currentZoom + amount;
        newZoom = Math.max(10, Math.min(5000, newZoom));
        state.currentZoom = newZoom;
        this.updateTransform();
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