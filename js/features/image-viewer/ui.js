// js/features/image-viewer/ui.js
import { state } from '../../state.js';

export class ImageViewerUI {
    constructor() {
        this.container = document.getElementById('convertedCanvasContainer');
        this.canvas = document.getElementById('convertedCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.placeholder = document.getElementById('placeholder-ui');
        this.compareBtn = document.getElementById('compareBtn');
        this.zoomDisplay = document.getElementById('zoomLevelDisplay');
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.centerBtn = document.getElementById('centerBtn'); 

        this.lastConvertedData = null; 
        
        this.injectStyles();
    }

    injectStyles() {
        if (!this.container) return;
        
        // 1. 컨테이너: Absolute 자식들의 기준점
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden'; 
        this.container.style.cursor = 'grab';
        
        // [중요] 거대 이미지 레이아웃 깨짐 방지를 위해 display: block 유지
        this.container.style.display = 'block'; 
        this.container.style.minWidth = '0';
        this.container.style.minHeight = '0';

        // 2. 캔버스: 절대 위치로 중앙 정렬
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '50%';
        this.canvas.style.left = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)'; 
        this.canvas.style.transformOrigin = 'center center';
        this.canvas.style.transition = 'transform 0.1s ease-out';
        this.canvas.style.maxWidth = 'none';
        this.canvas.style.maxHeight = 'none';

        // [수정 1] 업로드 문구(Placeholder) 강제 중앙 정렬
        // 부모의 Flex 속성이 사라졌으므로 스스로 중앙을 찾아가도록 설정합니다.
        if (this.placeholder) {
            this.placeholder.style.position = 'absolute';
            this.placeholder.style.top = '50%';
            this.placeholder.style.left = '50%';
            this.placeholder.style.transform = 'translate(-50%, -50%)';
            this.placeholder.style.width = '100%'; // 클릭 영역 확보
            this.placeholder.style.textAlign = 'center';
            this.placeholder.style.pointerEvents = 'none'; // 클릭이 컨테이너로 전달되도록
        }
    }

    updateCanvas(imageData) {
        if (!imageData) return;
        this.lastConvertedData = imageData; 

        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;
        this.ctx.putImageData(imageData, 0, 0);

        if (state.originalImageData) {
            this.canvas.style.width = `${state.originalImageData.width}px`;
            this.canvas.style.height = `${state.originalImageData.height}px`;
        } else {
            this.canvas.style.width = `${imageData.width}px`;
            this.canvas.style.height = `${imageData.height}px`;
        }
        
        this.canvas.style.imageRendering = 'pixelated';
        this.showCanvas();
    }

    updateTransform(zoom, x, y) {
        if (this.canvas) {
            this.canvas.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${zoom / 100})`;
        }
        if (this.zoomDisplay) {
            this.zoomDisplay.textContent = `${Math.round(zoom)}%`;
        }
    }

    setGrabbing(isGrabbing) {
        if (this.container) {
            this.container.style.cursor = isGrabbing ? 'grabbing' : 'grab';
            this.canvas.style.transition = isGrabbing ? 'none' : 'transform 0.1s ease-out';
        }
    }

    showOriginalImage() {
        if (state.originalImageData) {
            this.canvas.width = state.originalImageData.width;
            this.canvas.height = state.originalImageData.height;
            this.ctx.putImageData(state.originalImageData, 0, 0);
        }
    }

    showConvertedImage() {
        if (this.lastConvertedData) {
            this.canvas.width = this.lastConvertedData.width;
            this.canvas.height = this.lastConvertedData.height;
            this.ctx.putImageData(this.lastConvertedData, 0, 0);
        }
    }

    showCanvas() {
        this.canvas.style.display = 'block';
        if (this.placeholder) this.placeholder.style.display = 'none';
        if (this.container) this.container.style.cursor = 'grab';
    }

    showPlaceholder() {
        this.canvas.style.display = 'none';
        if (this.placeholder) {
            // 내부 아이콘 정렬을 위해 Flex 사용
            this.placeholder.style.display = 'flex'; 
            this.placeholder.style.flexDirection = 'column';
            this.placeholder.style.alignItems = 'center';
            this.placeholder.style.justifyContent = 'center';
        }
        if (this.container) this.container.style.cursor = 'default';
    }

    // [수정 2] 로딩바 위치 복구
    toggleLoading(show) {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = show ? 'block' : 'none';
            
            // 아까 추가했던 강제 위치 이동 코드(absolute)를 제거하여
            // HTML 구조상 원래 위치(Zoom 텍스트 옆)로 돌아가게 합니다.
            this.loadingIndicator.style.position = ''; 
            this.loadingIndicator.style.top = '';
            this.loadingIndicator.style.left = '';
            this.loadingIndicator.style.transform = '';
        }
    }
}