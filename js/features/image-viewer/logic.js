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

        // 스포이드 버튼 이벤트
        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEyedropper(!this.isEyedropperActive);
            });
        }

        // 클릭 이벤트 (드래그가 아닐 때만 처리 등)
        container.addEventListener('click', (e) => {
            if (state.originalImageData) {
                const isControl = e.target.closest('button, input, select, a, label, .top-right-ui');
                if (isControl) return; 

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true });

        // 휠 줌 이벤트
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

        // ==========================================
        // [1] 마우스 드래그 이벤트 (기존 유지)
        // ==========================================
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

        // ==========================================
        // [2] 터치 이벤트 추가 (모바일/태블릿 지원)
        // ==========================================
        
        // 터치 시작
        container.addEventListener('touchstart', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return; // 버튼 터치 시 드래그 방지

            // 스포이드 모드일 때는 터치로 색상 추출
            if (this.isEyedropperActive) {
                // 터치 좌표로 색상 추출 처리 (첫 번째 터치 포인트 사용)
                if (e.touches.length > 0) {
                    const touch = e.touches[0];
                    // 마우스 이벤트 형식으로 변환하여 호출
                    this.handleEyedropperPick({ 
                        clientX: touch.clientX, 
                        clientY: touch.clientY 
                    });
                }
                return;
            }

            // 일반 드래그 (손가락 1개일 때만)
            if (e.touches.length === 1) {
                state.isDragging = true;
                this.hasDragged = false;
                const touch = e.touches[0];
                
                // 현재 터치 위치 - 현재 Pan 위치 = 시작 오프셋
                this.startDragX = touch.clientX - state.panX;
                this.startDragY = touch.clientY - state.panY;
                this.ui.setGrabbing(true);
            }
        }, { passive: false }); // passive: false여야 preventDefault 사용 가능

        // 터치 이동
        window.addEventListener('touchmove', (e) => {
            if (state.isDragging && e.touches.length === 1) {
                // 브라우저 기본 스크롤 동작 방지 (이미지만 움직이도록)
                e.preventDefault(); 
                
                const touch = e.touches[0];
                const currentX = touch.clientX - this.startDragX;
                const currentY = touch.clientY - this.startDragY;

                state.panX = currentX;
                state.panY = currentY;
                this.updateTransform();
            }
        }, { passive: false });

        // 터치 종료
        window.addEventListener('touchend', () => {
            if (state.isDragging) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });
        
        // ==========================================
        // 기타 UI 버튼 이벤트
        // ==========================================
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

            // 마우스
            this.ui.compareBtn.addEventListener('mousedown', showOriginal);
            this.ui.compareBtn.addEventListener('mouseup', showConverted);
            this.ui.compareBtn.addEventListener('mouseleave', showConverted);
            
            // 터치 (모바일 대응)
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