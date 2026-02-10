import { state, t } from '../../state.js';

export class ImageViewerUI {
    constructor() {
        this.container = document.getElementById('convertedCanvasContainer');
        this.canvas = document.getElementById('convertedCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.placeholder = document.getElementById('placeholder-ui');
        this.zoomDisplay = document.getElementById('zoomLevelDisplay');
        this.loadingIndicator = document.getElementById('loading-indicator');
        
        // 버튼 및 정보창 참조
        this.toolbar = null;
        this.resetBtn = null;
        this.eyedropperBtn = null;
        this.compareBtn = null;
        this.centerBtn = null;
        this.pixelInfoBox = null;

        this.lastConvertedData = null; 
        
        this.injectCanvasStyles();
        this.createToolbar();
        this.createPixelInfoBox();
    }

    createToolbar() {
        if (!this.container) return;

        this.toolbar = this.container.querySelector('#viewer-toolbar');
        if (!this.toolbar) {
            this.toolbar = document.createElement('div');
            this.toolbar.id = 'viewer-toolbar';
            this.container.appendChild(this.toolbar);
        }

        this.toolbar.addEventListener('click', (e) => e.stopPropagation());
        this.toolbar.addEventListener('mousedown', (e) => e.stopPropagation());
        this.toolbar.addEventListener('touchstart', (e) => e.stopPropagation());

        Object.assign(this.toolbar.style, {
            position: 'absolute',
            top: '15px',            
            right: '15px',
            display: 'none',       
            flexDirection: 'column', 
            gap: '10px',             
            zIndex: '10000',       
            pointerEvents: 'auto'  
        });

        this.resetBtn = this.createButton('resetBtn', '↻', 'tooltip_reset_all');
        this.eyedropperBtn = this.createButton('eyedropperBtn', '🖊', 'tooltip_eyedropper');
        this.compareBtn = this.createButton('compareBtn', '🖼️', 'tooltip_compare_hold');
        this.centerBtn = this.createButton('centerBtn', '🎯', 'tooltip_center_zoom');

        this.toolbar.appendChild(this.resetBtn);
        this.toolbar.appendChild(this.eyedropperBtn);
        this.toolbar.appendChild(this.compareBtn);
        this.toolbar.appendChild(this.centerBtn);
    }

    createButton(id, icon, langKey) {
        let btn = document.getElementById(id);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = id;
        }

        btn.innerHTML = icon;
        btn.title = t(langKey) || ""; 
        btn.setAttribute('data-lang-tooltip', langKey);
        
        Object.assign(btn.style, {
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #999',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            color: '#000',
            transition: 'all 0.1s',
            filter: 'grayscale(100%)',
            position: 'relative',
            
            // [해결 1] 아이콘이 글자처럼 선택(드래그)되는 현상 방지
            userSelect: 'none',
            webkitUserSelect: 'none',
            mozUserSelect: 'none',
            msUserSelect: 'none',
            
            top: 'auto', right: 'auto', left: 'auto', bottom: 'auto', margin: '0', transform: 'none'
        });

        btn.onmouseenter = () => {
            if (btn.id !== 'eyedropperBtn' || this.container.style.cursor !== 'crosshair') {
                btn.style.background = '#e7f1ff';
                btn.style.borderColor = '#007bff';
            }
        };
        btn.onmouseleave = () => {
            if (btn.id !== 'eyedropperBtn' || this.container.style.cursor !== 'crosshair') {
                btn.style.background = 'rgba(255, 255, 255, 0.95)';
                btn.style.borderColor = '#999';
            }
        };
        btn.onmousedown = (e) => {
            e.preventDefault(); // 클릭 시 포커스 잡히는 것 방지 (추가 안전장치)
            btn.style.transform = 'scale(0.95)';
        };
        btn.onmouseup = () => btn.style.transform = 'scale(1)';

        return btn;
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
        if (!show) {
            this.pixelInfoBox.style.display = 'none';
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

        // 1. 내부 해상도 (픽셀 수) 변경
        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;
        this.ctx.putImageData(imageData, 0, 0);

        // [해결 2] 캔버스의 '보이는 크기(Style Size)'를 원본 이미지 크기로 고정
        // 이렇게 하면 이미지가 작아져도(해상도 감소), 화면에서는 원본 크기 그대로 픽셀이 커져 보임
        if (state.originalImageData) {
            this.canvas.style.width = `${state.originalImageData.width}px`;
            this.canvas.style.height = `${state.originalImageData.height}px`;
        } else {
            // 원본이 없으면 자체 크기 따름
            this.canvas.style.width = `${imageData.width}px`;
            this.canvas.style.height = `${imageData.height}px`;
        }
        
        this.canvas.style.imageRendering = 'pixelated';
        this.showCanvas();
    }

    updateTransform(zoom, x, y) {
        // [복원] scaleCorrection 제거
        // 위 updateCanvas에서 style.width를 강제로 고정했으므로, 
        // 여기서 별도로 비율을 계산할 필요 없이 zoom 값 그대로 적용하면 됩니다.
        // 이것이 '이전 코드' 방식과 동일하여 깜빡임 없이 부드럽습니다.
        
        if (this.canvas) {
            this.canvas.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${zoom / 100})`;
        }
        if (this.zoomDisplay) {
            this.zoomDisplay.textContent = `${Math.round(zoom)}%`;
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
            this.ctx.putImageData(state.originalImageData, 0, 0);
            
            // 원본 볼 때도 크기 고정 유지
            this.canvas.style.width = `${state.originalImageData.width}px`;
            this.canvas.style.height = `${state.originalImageData.height}px`;
        }
    }

    showConvertedImage() {
        if (this.lastConvertedData) {
            this.canvas.width = this.lastConvertedData.width;
            this.canvas.height = this.lastConvertedData.height;
            this.ctx.putImageData(this.lastConvertedData, 0, 0);
            
            // 변환 이미지 볼 때도 원본 크기 틀 유지
            if (state.originalImageData) {
                this.canvas.style.width = `${state.originalImageData.width}px`;
                this.canvas.style.height = `${state.originalImageData.height}px`;
            }
        }
    }

    showCanvas() {
        this.canvas.style.display = 'block';
        if (this.placeholder) this.placeholder.style.display = 'none';
        if (this.container) this.container.style.cursor = 'grab';
        if (this.toolbar) this.toolbar.style.display = 'flex';
    }

    showPlaceholder() {
        this.canvas.style.display = 'none';
        if (this.placeholder) {
            this.placeholder.style.display = 'flex'; 
            this.placeholder.style.flexDirection = 'column';
            this.placeholder.style.alignItems = 'center';
            this.placeholder.style.justifyContent = 'center';
        }
        if (this.container) this.container.style.cursor = 'default';
        if (this.toolbar) this.toolbar.style.display = 'none';
        
        this.updatePixelInfo(false);
    }

    toggleLoading(show) {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = show ? 'block' : 'none';
            // 로딩바 위치 초기화 (Zoom 텍스트 옆으로)
            this.loadingIndicator.style.position = ''; 
            this.loadingIndicator.style.top = '';
            this.loadingIndicator.style.left = '';
            this.loadingIndicator.style.transform = '';
        }
        if (!show && (this.lastConvertedData || state.originalImageData)) {
            if (this.toolbar) this.toolbar.style.display = 'flex';
        }
    }
}