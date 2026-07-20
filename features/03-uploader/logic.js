// js/features/image-uploader/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../core/state.js';
import { ImageUploaderUI } from './ui.js';
import { decodeYouPixels } from '../../data/uplace-file-format.js';

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
        if (!file) return;

        // 🌟 [신규] Youplace(.you) 파일 - MIME 타입이 image/*가 아니므로 확장자로 먼저 분기
        if (file.name && file.name.toLowerCase().endsWith('.you')) {
            this.handleYouFile(file);
            return;
        }

        if (!file.type.startsWith('image/')) {
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

    // 🌟 [신규] Youplace(.you) 파일 불러오기 - base64 픽셀 ID 배열을 실제 이미지로 복원
    handleYouFile(file) {
        this.ui.toggleLoading(true);
        state.originalFileName = file.name.replace(/\.you$/i, '');

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const payload = JSON.parse(e.target.result);
                const guide = payload.guide || {};
                const { width, height, pixels: base64Pixels } = guide;
                if (!width || !height || !base64Pixels) throw new Error('invalid .you structure');

                const rgba = decodeYouPixels(base64Pixels, width, height);
                const imageData = new ImageData(rgba, width, height);

                // 다른 기능들과의 일관성을 위해 표시/재사용 가능한 Image 오브젝트도 함께 준비
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
                const img = new Image();
                img.src = tempCanvas.toDataURL();

                state.aspectRatio = height / width;
                state.originalImageObject = img;
                state.originalImageData = imageData;

                // 🌟 다른 팔레트를 쓰고 있었다면 .you 파일에 맞게 Youplace(uplace)로 강제 전환
                if (state.currentMode !== 'uplace') {
                    eventBus.emit('FORCE_PALETTE_MODE', 'uplace');
                }

                eventBus.emit('IMAGE_LOADED', { source: img, imageData: state.originalImageData });
                this.ui.toggleLoading(false);
            } catch (err) {
                console.error('.you 파일 파싱 오류:', err);
                this.ui.toggleLoading(false);
                alert(t('alert_invalid_you_file'));
            }
        };

        reader.onerror = () => {
            this.ui.toggleLoading(false);
            alert(t('alert_invalid_you_file'));
        };

        reader.readAsText(file);
    }
}