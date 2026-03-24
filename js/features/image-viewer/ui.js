// js/features/image-viewer/ui.js
import { state, t } from '../../state.js';

export class ImageViewerUI {
    constructor() {
        this.container = document.getElementById('convertedCanvasContainer');
        this.canvas = document.getElementById('convertedCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
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
        this.createToolbar();       
        this.createPixelInfoBox();
        this.setupZoomControls();   
    }

    createToolbar() {
        if (!this.container) return;

        const existingToolbar = this.container.querySelector('#viewer-toolbar');
        if (existingToolbar) existingToolbar.remove();

        this.toolbar = document.createElement('div');
        this.toolbar.id = 'viewer-toolbar';
        this.container.appendChild(this.toolbar);

        ['click', 'mousedown', 'touchstart'].forEach(evt => {
            this.toolbar.addEventListener(evt, (e) => e.stopPropagation());
        });

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
        this.centerBtn = this.createButton('centerBtn', '✜', 'tooltip_center_zoom');

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
            userSelect: 'none',
            webkitUserSelect: 'none',
            mozUserSelect: 'none',
            msUserSelect: 'none',
            top: 'auto', right: 'auto', left: 'auto', bottom: 'auto', margin: '0', transform: 'none'
        });

        ['click', 'mousedown', 'touchstart'].forEach(evt => {
            btn.addEventListener(evt, (e) => e.stopPropagation());
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
            e.preventDefault(); 
            btn.style.transform = 'scale(0.95)';
        };
        btn.onmouseup = () => btn.style.transform = 'scale(1)';

        return btn;
    }

    setupZoomControls() {
        if (!this.zoomDisplay) return;

        Object.assign(this.zoomDisplay.style, {
            userSelect: 'none',
            webkitUserSelect: 'none',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column', 
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',              
            pointerEvents: 'none',   
            zIndex: '1000',
            background: 'transparent', 
            padding: '0',
            borderRadius: '0'
        });

        this.zoomDisplay.innerHTML = '';

        this.zoomTextSpan = document.createElement('span');
        this.zoomTextSpan.textContent = '100%';
        Object.assign(this.zoomTextSpan.style, {
            background: 'rgba(0, 0, 0, 0.6)', 
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '12px', 
            fontSize: '13px',
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            pointerEvents: 'none' 
        });
        
        this.zoomDisplay.appendChild(this.zoomTextSpan);

        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, {
            display: 'flex',
            gap: '8px',             
            pointerEvents: 'auto',   
            marginTop: '0'
        });

        this.zoomOutBtn = this.createMiniZoomBtn('-');
        this.zoomInBtn = this.createMiniZoomBtn('+');

        btnContainer.appendChild(this.zoomOutBtn);
        btnContainer.appendChild(this.zoomInBtn);
        
        this.zoomDisplay.appendChild(btnContainer);
    }

    createMiniZoomBtn(text) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            width: '28px',
            height: '28px',
            fontSize: '18px',
            fontWeight: 'bold',
            lineHeight: '1',
            background: '#ffffff',       
            border: '2px solid #333',    
            borderRadius: '6px',         
            color: '#333',               
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)' 
        });

        ['mousedown', 'touchstart', 'click'].forEach(evt => {
            btn.addEventListener(evt, (e) => e.stopPropagation());
        });
        
        btn.onmousedown = () => { btn.style.transform = 'scale(0.95)'; btn.style.background = '#f0f0f0'; };
        btn.onmouseup = () => { btn.style.transform = 'scale(1)'; btn.style.background = '#ffffff'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.background = '#ffffff'; };

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