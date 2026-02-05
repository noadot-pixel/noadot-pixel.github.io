// js/features/image-viewer/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../state.js';
import { ImageViewerUI } from './ui.js';

export class ImageViewerFeature {
    constructor() {
        this.ui = new ImageViewerUI();
        
        // 상태 초기화
        state.currentZoom = 100;
        state.panX = 0;
        state.panY = 0;
        state.isDragging = false;
        
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
                this.ui.updateCanvas(data.imageData);
                this.updateTransform();
            }
            this.ui.toggleLoading(false);
        });

        // [중요] 이미지 로드 시 데이터 타입 변환 로직 (버퍼 에러 방지)
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

        // [강력한 클릭 차단] 업로드 창 팝업 방지
        container.addEventListener('click', (e) => {
            if (state.originalImageData) {
                const isControl = e.target.closest('button, input, select, a, label, .top-right-ui');
                if (isControl) return; 

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true });

        // [수정됨] 줌 감도 조절 (Wheel Event)
        container.addEventListener('wheel', (e) => {
            if (!state.originalImageData) return;
            e.preventDefault();
            e.stopPropagation();

            const delta = -Math.sign(e.deltaY);
            
            // [수정] 감도를 0.1 (10%)로 하향 조정하여 부드럽게 변경
            // 기존 0.25(25%)는 너무 급격했으므로 10%로 낮춤
            const zoomSpeed = 0.1;

            let newZoom = state.currentZoom + (delta * zoomSpeed * state.currentZoom);
            newZoom = Math.max(10, Math.min(500, newZoom)); // 최소 10% ~ 최대 500%
            
            state.currentZoom = newZoom;
            this.updateTransform();
        }, { passive: false });

        // 드래그 시작
        container.addEventListener('mousedown', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return;

            state.isDragging = true;
            this.hasDragged = false;
            this.startDragX = e.clientX - state.panX;
            this.startDragY = e.clientY - state.panY;
            this.ui.setGrabbing(true);
        });

        // 드래그 중
        window.addEventListener('mousemove', (e) => {
            if (!state.isDragging) return;
            e.preventDefault();

            const currentX = e.clientX - this.startDragX;
            const currentY = e.clientY - this.startDragY;

            if (Math.abs(currentX - state.panX) > 2 || Math.abs(currentY - state.panY) > 2) {
                this.hasDragged = true;
            }

            state.panX = currentX;
            state.panY = currentY;
            this.updateTransform();
        });

        // 드래그 종료
        window.addEventListener('mouseup', () => {
            if (state.isDragging) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });
        
        // 중앙 정렬 버튼
        if (this.ui.centerBtn) {
            this.ui.centerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetView();
            });
        }

        // 비교 버튼 (이벤트 전파 차단 포함)
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
}