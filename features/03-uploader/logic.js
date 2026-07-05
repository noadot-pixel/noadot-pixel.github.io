// js/features/image-uploader/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../core/state.js';
import { ImageUploaderUI } from './ui.js';

export class ImageUploaderFeature {
    constructor() {
        this.ui = new ImageUploaderUI();
        this.initEvents();
    }

    initEvents() {
        // 1. 업로드 트리거
        const openUpload = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (this.ui.fileInput && e.target !== this.ui.fileInput) {
                this.ui.triggerFileInput();
            }
        };

        if (this.ui.triggerBtn) {
            this.ui.triggerBtn.addEventListener('click', openUpload);
        }

        if (this.ui.reuploadBtn) {
            this.ui.reuploadBtn.addEventListener('click', openUpload);
        }
        
        if (this.ui.container) {
            this.ui.container.addEventListener('click', (e) => {
                if (!this.ui.container.classList.contains('has-image')) {
                    openUpload(e);
                }
            });
        }

        // 2. 파일 선택 시
        if (this.ui.fileInput) {
            this.ui.fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) this.handleFile(file);
                e.target.value = ''; 
            });
            this.ui.fileInput.addEventListener('click', (e) => e.stopPropagation());
        }

        // 3. 드래그 앤 드롭
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.ui.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 🌟 드롭(끌어다 놓기) 업로드 처리
        this.ui.dropZone.addEventListener('drop', (e) => {
            // [추가된 방어벽] 캔버스에 이미지가 있다면 업로드 취소!
            if (this.ui.container && this.ui.container.classList.contains('has-image')) {
                return; // 이미지가 이미 있으면 드롭 업로드로 덮어쓰지 않음
            }

            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file);
        });

        // 4. 붙여넣기 (Ctrl + V) 처리
        window.addEventListener('paste', (e) => {
            // 🌟 [추가된 방어벽] 붙여넣기로 강제 덮어씌워지는 것도 차단!
            if (this.ui.container && this.ui.container.classList.contains('has-image')) {
                return; // 이미지가 이미 있으면 붙여넣기로 덮어쓰지 않음
            }

            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile();
                    this.handleFile(file);
                    break;
                }
            }
        });
    }

    handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            // [수정] 언어 파일의 텍스트 호출
            alert(t('alert_image_only'));
            return;
        }

        this.ui.toggleLoading(true);
        state.originalFileName = file.name.split('.')[0];

        // 🌟 [성능] base64(readAsDataURL)로 통째로 문자열화하는 대신 objectURL로 가볍게 디코딩
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(objectUrl); // 디코딩 끝나면 바로 해제 (메모리 누수 방지)

            state.originalImageObject = img;
            state.aspectRatio = img.height / img.width;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            state.originalImageData = ctx.getImageData(0, 0, img.width, img.height);

            // 🌟 뷰어가 다시 디코딩하지 않도록 이미 계산된 ImageData를 함께 전달
            eventBus.emit('IMAGE_LOADED', { source: img, imageData: state.originalImageData });
            this.ui.toggleLoading(false);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            this.ui.toggleLoading(false);
            alert(t('alert_image_only'));
        };

        img.src = objectUrl;
    }
}