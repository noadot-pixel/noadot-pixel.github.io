// js/core/features/image-uploader/ui.js
export class ImageUploaderUI {
    constructor() {
        this.fileInput = document.getElementById('imageUpload');
        
        // [수정] index.html의 실제 ID인 'placeholder-ui'를 찾아야 합니다.
        // 추가로 캔버스 컨테이너 전체를 클릭해도 업로드되게 하면 더 좋습니다.
        this.triggerBtn = document.getElementById('placeholder-ui'); 
        this.container = document.getElementById('convertedCanvasContainer');

        this.dropZone = document.body;
        this.loadingOverlay = document.getElementById('loading-indicator'); // 로딩 ID도 확인
    }

    triggerFileInput() {
        if (this.fileInput) this.fileInput.click();
    }

    toggleLoading(show) {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.toggle('visible', show);
        }
    }
}