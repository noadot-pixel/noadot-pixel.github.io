// js/features/image-viewer/ui.js
import { state, t } from '../../core/state.js';

export class ImageViewerUI {
    constructor() {
        // 🌟 2. 새 HTML 뼈대(viewer.html)에 맞춰 ID 이름표 갱신!
        this.container = document.getElementById('canvas-container'); // 옛날: convertedCanvasContainer
        this.canvas = document.getElementById('main-canvas');         // 옛날: convertedCanvas
        
        // 캔버스를 무사히 찾았을 때만 붓(ctx)을 쥐어줍니다.
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            this.ctx.imageSmoothingEnabled = false;
        }

        this.chkSharpResizing = document.getElementById('chkSharpResizing');
        this.placeholder = document.getElementById('placeholder-ui');
        this.zoomDisplay = document.getElementById('zoomLevelDisplay');
        this.loadingIndicator = document.getElementById('loading-indicator');
        
        this.toolbar = null;
        this.resetBtn = null;
        this.eyedropperBtn = null;
        this.compareBtn = null;
        this.centerBtn = null;
        this.pixelInfoBox = null;

        this.zoomTextSpan = null;
        this.zoomInBtn = null;
        this.zoomOutBtn = null;

        this.lastConvertedData = null; 
        
        this.injectCanvasStyles();
        this.createPixelInfoBox();

        this.resetBtn = document.getElementById('btnResetAll');
        this.eyedropperBtn = document.getElementById('btnEyedropper');
        this.compareBtn = document.getElementById('btnViewOriginal');
        this.centerBtn = document.getElementById('btnRecenter');
        this.downloadBtn = document.getElementById('btnDownload');
    }

    createPixelInfoBox() {
        if (this.pixelInfoBox) return;
        this.pixelInfoBox = document.createElement('div');
        this.pixelInfoBox.id = 'pixel-info-box';
        Object.assign(this.pixelInfoBox.style, {
            position: 'fixed',
            background: 'rgba(30, 30, 30, 0.9)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'Consolas, monospace',
            pointerEvents: 'none', 
            zIndex: '10001',
            display: 'none',
            whiteSpace: 'pre',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            border: '1px solid #555',
            lineHeight: '1.5'
        });
        document.body.appendChild(this.pixelInfoBox);
    }

    toggleImageSmoothing(isSharp) {
        if (!this.canvas) return;

        this.canvas.style.imageRendering = isSharp ? 'pixelated' : 'auto';

        this.ctx.imageSmoothingEnabled = !isSharp; 
        this.ctx.mozImageSmoothingEnabled = !isSharp;
        this.ctx.webkitImageSmoothingEnabled = !isSharp;
        this.ctx.msImageSmoothingEnabled = !isSharp;
    }

    toggleEyedropperState(isActive) {
        if (!this.eyedropperBtn) return;
        if (isActive) {
            this.eyedropperBtn.style.background = '#007bff';
            this.eyedropperBtn.style.color = '#fff';
            this.eyedropperBtn.style.borderColor = '#007bff';
            this.eyedropperBtn.style.filter = 'none';
            this.container.style.cursor = 'crosshair';
        } else {
            this.eyedropperBtn.style.background = 'rgba(255, 255, 255, 0.95)';
            this.eyedropperBtn.style.color = '#000';
            this.eyedropperBtn.style.borderColor = '#999';
            this.eyedropperBtn.style.filter = 'grayscale(100%)';
            this.container.style.cursor = 'grab';
        }
    }

    updatePixelInfo(show, x, y, colorData = null, event = null) {
        if (!show || !this.pixelInfoBox) {
            if(this.pixelInfoBox) this.pixelInfoBox.style.display = 'none';
            return;
        }
        if (colorData && event) {
            const { r, g, b, hex } = colorData;
            const colorCircle = `<span style="display:inline-block; width:10px; height:10px; background:${hex}; border-radius:50%; border:1px solid #fff; margin-right:5px;"></span>`;
            this.pixelInfoBox.innerHTML = `${colorCircle} <b>${hex}</b>\nRGB: ${r}, ${g}, ${b}\nPOS: ${x}, ${y}`;
            this.pixelInfoBox.style.display = 'block';
            this.pixelInfoBox.style.left = (event.clientX + 20) + 'px';
            this.pixelInfoBox.style.top = (event.clientY + 20) + 'px';
        }
    }

    injectCanvasStyles() {
        if (!this.container) return;
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden'; 
        this.container.style.cursor = 'grab';
        
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '50%';
        this.canvas.style.left = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)'; 
        this.canvas.style.transformOrigin = 'center center';
        this.canvas.style.transition = 'transform 0.1s ease-out';
        this.canvas.style.maxWidth = 'none';
        this.canvas.style.maxHeight = 'none';

        if (this.placeholder) {
            this.placeholder.style.position = 'absolute';
            this.placeholder.style.top = '50%';
            this.placeholder.style.left = '50%';
            this.placeholder.style.transform = 'translate(-50%, -50%)';
            this.placeholder.style.width = '100%'; 
            this.placeholder.style.textAlign = 'center';
            this.placeholder.style.pointerEvents = 'none'; 
        }
    }

    updateCanvas(imageData) {
        if (!imageData) return;
        this.lastConvertedData = imageData; 

        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;

        if (this.chkSharpResizing) {
            this.toggleImageSmoothing(this.chkSharpResizing.checked);
        }

        this.ctx.putImageData(imageData, 0, 0);

        if (state.originalImageData) {
            this.canvas.style.width = `${state.originalImageData.width}px`;
            this.canvas.style.height = `${state.originalImageData.height}px`;
        } else {
            this.canvas.style.width = `${imageData.width}px`;
            this.canvas.style.height = `${imageData.height}px`;
        }
        
        if (this.chkSharpResizing) {
            this.canvas.style.imageRendering = this.chkSharpResizing.checked ? 'pixelated' : 'auto';
        }
        
        this.showCanvas();
    }

    updateTransform(zoom, x, y) {
        if (this.canvas) {
            this.canvas.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${zoom / 100})`;
        }
        
        if (this.zoomTextSpan) {
            this.zoomTextSpan.textContent = `${Math.round(zoom)}%`;
        }
    }

    setGrabbing(isGrabbing) {
        if (this.container.style.cursor === 'crosshair') return;
        if (this.container) {
            this.container.style.cursor = isGrabbing ? 'grabbing' : 'grab';
            this.canvas.style.transition = isGrabbing ? 'none' : 'transform 0.1s ease-out';
        }
    }

    showOriginalImage() {
        if (state.originalImageData) {
            this.canvas.width = state.originalImageData.width;
            this.canvas.height = state.originalImageData.height;
            
            // [방어 코드] 원본 이미지를 보여줄 때도 Smoothing 설정을 적용하여 뭉개짐 방지
            if (this.chkSharpResizing) {
                this.toggleImageSmoothing(this.chkSharpResizing.checked);
            }

            this.ctx.putImageData(state.originalImageData, 0, 0);
            this.canvas.style.width = `${state.originalImageData.width}px`;
            this.canvas.style.height = `${state.originalImageData.height}px`;
        }
    }

    showConvertedImage() {
        // [버그 수정] 로컬 변수보다 전역 변수(최신 렌더링 값)를 우선적으로 꺼내오도록 수정
        const targetData = state.latestConversionData || this.lastConvertedData;
        
        if (targetData) {
            this.canvas.width = targetData.width;
            this.canvas.height = targetData.height;
            this.lastConvertedData = targetData; // 최신화
            
            // [방어 코드] 캔버스 사이즈가 바뀌면 초기화되는 Smoothing 설정을 다시 잡아줌
            if (this.chkSharpResizing) {
                this.toggleImageSmoothing(this.chkSharpResizing.checked);
            }

            this.ctx.putImageData(targetData, 0, 0);
            if (state.originalImageData) {
                this.canvas.style.width = `${state.originalImageData.width}px`;
                this.canvas.style.height = `${state.originalImageData.height}px`;
            }
        }
    }

    showCanvas() {
        this.canvas.style.display = 'block';
        
        // [핵심 해결] 안내 문구를 !important로 강제 삭제하고 상태 클래스 부여
        if (this.placeholder) {
            this.placeholder.style.setProperty('display', 'none', 'important');
        }
        if (this.container) {
            this.container.style.cursor = 'grab';
            this.container.classList.add('has-image'); 
        }
        
        if (this.toolbar) this.toolbar.style.display = 'flex';
        if (this.zoomDisplay) this.zoomDisplay.style.display = 'flex';
    }

    showPlaceholder() {
        this.canvas.style.display = 'none';
        
        // [핵심 해결] 이미지가 지워지면 안내 문구를 강제로 다시 노출
        if (this.placeholder) {
            this.placeholder.style.setProperty('display', 'flex', 'important'); 
            this.placeholder.style.flexDirection = 'column';
            this.placeholder.style.alignItems = 'center';
            this.placeholder.style.justifyContent = 'center';
        }
        if (this.container) {
            this.container.style.cursor = 'default';
            this.container.classList.remove('has-image');
        }
        
        if (this.toolbar) this.toolbar.style.display = 'none';
        if (this.zoomDisplay) this.zoomDisplay.style.display = 'none';
        
        this.updatePixelInfo(false);
    }

    toggleLoading(show) {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = show ? 'block' : 'none';
        }
        if (!show && (this.lastConvertedData || state.originalImageData)) {
            if (this.toolbar) this.toolbar.style.display = 'flex';
        }
    }
}