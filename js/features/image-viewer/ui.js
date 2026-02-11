import { state, t } from '../../state.js';

export class ImageViewerUI {
    constructor() {
        this.container = document.getElementById('convertedCanvasContainer');
        this.canvas = document.getElementById('convertedCanvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.placeholder = document.getElementById('placeholder-ui');
        this.zoomDisplay = document.getElementById('zoomLevelDisplay');
        this.loadingIndicator = document.getElementById('loading-indicator');
        
        // 버튼 참조 변수
        this.toolbar = null;
        this.resetBtn = null;
        this.eyedropperBtn = null;
        this.compareBtn = null;
        this.centerBtn = null;
        this.pixelInfoBox = null;

        // 줌 제어용 변수
        this.zoomTextSpan = null;
        this.zoomInBtn = null;
        this.zoomOutBtn = null;

        this.lastConvertedData = null; 
        
        this.injectCanvasStyles();
        this.createToolbar();       // 4개 버튼 툴바 생성 (유령 버튼 제거 포함)
        this.createPixelInfoBox();
        this.setupZoomControls();   // [New] 줌 버튼 생성
    }

    createToolbar() {
        if (!this.container) return;

        // 1. 기존 툴바가 있다면 삭제 (중복 생성 방지)
        const existingToolbar = this.container.querySelector('#viewer-toolbar');
        if (existingToolbar) existingToolbar.remove();

        // 2. 새 툴바 생성
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'viewer-toolbar';
        this.container.appendChild(this.toolbar);

        // 툴바 클릭 시 업로드 창 뜨는 것 방지
        ['click', 'mousedown', 'touchstart'].forEach(evt => {
            this.toolbar.addEventListener(evt, (e) => e.stopPropagation());
        });

        // 툴바 스타일
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

        // 3. 버튼 생성 및 HTML 기존 버튼 가져오기 (핵심: 흩어진 버튼을 모음)
        this.resetBtn = this.createButton('resetBtn', '↻', 'tooltip_reset_all');
        this.eyedropperBtn = this.createButton('eyedropperBtn', '🖊', 'tooltip_eyedropper');
        
        // HTML에 이미 있는 compareBtn, centerBtn도 가져와서 스타일 입히고 툴바에 넣음
        this.compareBtn = this.createButton('compareBtn', '🖼️', 'tooltip_compare_hold');
        this.centerBtn = this.createButton('centerBtn', '🎯', 'tooltip_center_zoom');

        // 4. 툴바에 순서대로 추가 (HTML에 있던 버튼도 여기로 이동됨)
        this.toolbar.appendChild(this.resetBtn);
        this.toolbar.appendChild(this.eyedropperBtn);
        this.toolbar.appendChild(this.compareBtn);
        this.toolbar.appendChild(this.centerBtn);
    }

    createButton(id, icon, langKey) {
        // HTML에 이미 존재하는 버튼이 있으면 가져오고, 없으면 새로 만듬
        let btn = document.getElementById(id);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = id;
        }

        // 내용 및 툴팁 설정
        btn.innerHTML = icon;
        btn.title = t(langKey) || ""; 
        btn.setAttribute('data-lang-tooltip', langKey);
        
        // 스타일 강제 초기화 (기존 클래스 영향 제거)
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
            position: 'relative', // static 대신 relative
            
            // 드래그 방지
            userSelect: 'none',
            webkitUserSelect: 'none',
            mozUserSelect: 'none',
            msUserSelect: 'none',
            
            // 위치 초기화 (HTML CSS 간섭 방지)
            top: 'auto', right: 'auto', left: 'auto', bottom: 'auto', margin: '0', transform: 'none'
        });

        // 버튼 클릭 이벤트 전파 차단 (업로드 방지)
        ['click', 'mousedown', 'touchstart'].forEach(evt => {
            btn.addEventListener(evt, (e) => e.stopPropagation());
        });

        // 호버 효과
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

    // [New] 줌 컨트롤 설정 (텍스트 + 버튼 분리)
    setupZoomControls() {
        if (!this.zoomDisplay) return;

        // 1. 메인 컨테이너 (위치 잡기용 투명 래퍼)
        Object.assign(this.zoomDisplay.style, {
            userSelect: 'none',
            webkitUserSelect: 'none',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column', // 위아래 배치
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',              // 텍스트와 버튼 사이 간격 벌리기
            pointerEvents: 'none',   // 빈 공간 클릭 통과
            zIndex: '1000',
            background: 'transparent', // 배경 투명화 (중요)
            padding: '0',
            borderRadius: '0'
        });

        // 기존 내용 초기화
        this.zoomDisplay.innerHTML = '';

        // 2. 상단: 텍스트 Span (어두운 배경의 알약 모양)
        this.zoomTextSpan = document.createElement('span');
        this.zoomTextSpan.textContent = '100%';
        Object.assign(this.zoomTextSpan.style, {
            background: 'rgba(0, 0, 0, 0.6)', // 어두운 반투명 배경
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '12px', // 둥근 알약 모양
            fontSize: '13px',
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            pointerEvents: 'none' // 텍스트 위 드래그 방지
        });
        
        this.zoomDisplay.appendChild(this.zoomTextSpan);

        // 3. 하단: 버튼 컨테이너 (가로 배치)
        const btnContainer = document.createElement('div');
        Object.assign(btnContainer.style, {
            display: 'flex',
            gap: '8px',             // 버튼 사이 간격
            pointerEvents: 'auto',   // 버튼 클릭 활성화
            marginTop: '0'
        });

        // 4. 버튼 생성 및 추가
        this.zoomOutBtn = this.createMiniZoomBtn('-');
        this.zoomInBtn = this.createMiniZoomBtn('+');

        btnContainer.appendChild(this.zoomOutBtn);
        btnContainer.appendChild(this.zoomInBtn);
        
        this.zoomDisplay.appendChild(btnContainer);
    }

    // [수정됨] 버튼 스타일 변경 (흰색 배경 + 검은 테두리)
    createMiniZoomBtn(text) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            width: '28px',
            height: '28px',
            fontSize: '18px',
            fontWeight: 'bold',
            lineHeight: '1',
            
            // 두 번째 이미지 스타일 적용
            background: '#ffffff',       // 흰색 배경
            border: '2px solid #333',    // 진한 테두리
            borderRadius: '6px',         // 살짝 둥근 모서리
            color: '#333',               // 검은 글씨
            
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)' // 약간의 그림자
        });

        // 이벤트 전파 차단
        ['mousedown', 'touchstart', 'click'].forEach(evt => {
            btn.addEventListener(evt, (e) => e.stopPropagation());
        });
        
        // 눌렀을 때 효과
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
        
        // 캔버스 스타일
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
        
        // 텍스트만 업데이트 (버튼 삭제 방지)
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
            this.ctx.putImageData(state.originalImageData, 0, 0);
            this.canvas.style.width = `${state.originalImageData.width}px`;
            this.canvas.style.height = `${state.originalImageData.height}px`;
        }
    }

    showConvertedImage() {
        if (this.lastConvertedData) {
            this.canvas.width = this.lastConvertedData.width;
            this.canvas.height = this.lastConvertedData.height;
            this.ctx.putImageData(this.lastConvertedData, 0, 0);
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
        
        // 툴바 보이기
        if (this.toolbar) this.toolbar.style.display = 'flex';
        // 줌 컨트롤 보이기
        if (this.zoomDisplay) this.zoomDisplay.style.display = 'flex';
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
        
        // 툴바 숨기기
        if (this.toolbar) this.toolbar.style.display = 'none';
        // 줌 컨트롤 숨기기
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