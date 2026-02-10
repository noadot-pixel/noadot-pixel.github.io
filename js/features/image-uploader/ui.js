// js/features/image-uploader/ui.js
export class ImageUploaderUI {
    constructor() {
        this.fileInput = document.getElementById('imageUpload');
        
        // 실제 ID 연결
        this.triggerBtn = document.getElementById('placeholder-ui'); 
        this.container = document.getElementById('convertedCanvasContainer');

        this.dropZone = document.body;
        this.loadingOverlay = document.getElementById('loading-indicator');

        // [핵심] 모바일 레이아웃 붕괴 방지 스타일 주입
        this.injectMobileStyles();
    }

    triggerFileInput() {
        if (this.fileInput) this.fileInput.click();
    }

    toggleLoading(show) {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.toggle('visible', show);
        }
    }

    // [New] 모바일에서 화면이 실처럼 얇아지는 현상 방지
    injectMobileStyles() {
        if (document.getElementById('uploader-mobile-fix')) return;
        
        const style = document.createElement('style');
        style.id = 'uploader-mobile-fix';
        style.textContent = `
            /* 모바일 및 작은 화면 대응 */
            @media (max-width: 768px) {
                #convertedCanvasContainer, 
                #placeholder-ui {
                    min-height: 250px !important; /* 최소 높이 강제 보장 */
                    height: auto !important;
                    flex-shrink: 0 !important;    /* 플렉스 박스에서 찌그러짐 방지 */
                    display: flex !important;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                }
                
                /* 캔버스나 이미지가 있을 때도 공간 확보 */
                .image-editor-container {
                    min-height: 250px !important;
                    flex: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}