// js/features/image-uploader/ui.js
export class ImageUploaderUI {
    constructor() {
        this.fileInput = document.getElementById('imageUpload');
        
        this.triggerBtn = document.getElementById('placeholder-ui'); 
        this.container = document.getElementById('canvas-container'); // 🌟 최신 뷰어 ID로 업데이트

        this.reuploadBtn = document.getElementById('reuploadBtn');
        this.dropZone = document.body;
        this.loadingOverlay = document.getElementById('loading-indicator');

        // 🌟 [수정 완료] ui.js에서 강제로 스타일을 주입하던 injectMobileStyles() 함수는 
        // uploader.css로 안전하게 이관되어 완전히 삭제되었습니다.
    }

    triggerFileInput() {
        if (this.fileInput) this.fileInput.click();
    }

    toggleLoading(show) {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = show ? 'block' : 'none';
        }
    }
}