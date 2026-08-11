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

        // 🌟 [신규] Youplace(.you)/Wplace(.wplace)/3place(.3place-blueprint) 파일 - MIME 타입이
        // image/*가 아니므로 확장자로 먼저 분기해서 각자의 방식으로 이미지를 복원한다.
        const lowerName = (file.name || '').toLowerCase();
        if (lowerName.endsWith('.you')) {
            this.handleYouFile(file);
            return;
        }
        if (lowerName.endsWith('.wplace')) {
            this.handleWplaceFile(file);
            return;
        }
        if (lowerName.endsWith('.3place-blueprint')) {
            this.handleThreeplaceFile(file);
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

    // 🌟 [신규] Wplace(.wplace) 파일 불러오기 - image.dataUrl에 완전한 PNG가 그대로 들어있어서
    // 팔레트 ID 복원 같은 과정 없이 일반 이미지처럼 디코딩만 하면 된다.
    handleWplaceFile(file) {
        this.ui.toggleLoading(true);
        state.originalFileName = file.name.replace(/\.wplace$/i, '');

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const payload = JSON.parse(e.target.result);
                const imgInfo = payload.image || {};
                if (!imgInfo.dataUrl || !imgInfo.width || !imgInfo.height) throw new Error('invalid .wplace structure');

                const img = new Image();
                img.onload = () => {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = imgInfo.width;
                    tempCanvas.height = imgInfo.height;
                    const ctx = tempCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, imgInfo.width, imgInfo.height);

                    state.aspectRatio = imgInfo.height / imgInfo.width;
                    state.originalImageObject = img;
                    state.originalImageData = imageData;

                    // 🌟 다른 팔레트를 쓰고 있었다면 .wplace 파일에 맞게 Wplace로 강제 전환
                    if (state.currentMode !== 'wplace') {
                        eventBus.emit('FORCE_PALETTE_MODE', 'wplace');
                    }

                    eventBus.emit('IMAGE_LOADED', { source: img, imageData: state.originalImageData });
                    this.ui.toggleLoading(false);
                };
                img.onerror = () => {
                    this.ui.toggleLoading(false);
                    alert(t('alert_invalid_wplace_file'));
                };
                img.src = imgInfo.dataUrl;
            } catch (err) {
                console.error('.wplace 파일 파싱 오류:', err);
                this.ui.toggleLoading(false);
                alert(t('alert_invalid_wplace_file'));
            }
        };

        reader.onerror = () => {
            this.ui.toggleLoading(false);
            alert(t('alert_invalid_wplace_file'));
        };

        reader.readAsText(file);
    }

    // 🌟 [신규] 3place(.3place-blueprint) 파일 불러오기 - 희소 voxel 배열([x,y,z,colorIndex])을
    // 다시 평면 이미지로 재구성한다. size[1]/size[2] 중 어느 쪽이 1(두께)인지로 눕혀서/세워서를
    // 자동 판별하고, 내보낼 때 위아래를 뒤집었던 것(flipped = height-1-py)을 그대로 역산해서 되돌린다.
    handleThreeplaceFile(file) {
        this.ui.toggleLoading(true);
        state.originalFileName = file.name.replace(/\.3place-blueprint$/i, '');

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const payload = JSON.parse(e.target.result);
                if (payload.format !== '3place-blueprint' || !Array.isArray(payload.palette) || !Array.isArray(payload.voxels) || !Array.isArray(payload.size)) {
                    throw new Error('invalid 3place-blueprint structure');
                }

                const [sx, sy, sz] = payload.size;
                const isStanding = sy === 1 && sz !== 1; // 세워서: Y=1(두께), 눕혀서: Z=1(두께)
                const width = sx;
                const height = isStanding ? sz : sy;
                if (!width || !height) throw new Error('invalid 3place-blueprint size');

                const imageData = new ImageData(width, height); // 기본 전체 투명, voxel이 있는 칸만 색을 채운다

                payload.voxels.forEach(([vx, vy, vz, colorIndex]) => {
                    const flipped = isStanding ? vz : vy;
                    const px = vx;
                    const py = height - 1 - flipped;
                    if (px < 0 || px >= width || py < 0 || py >= height) return;

                    const hex = payload.palette[colorIndex];
                    if (!hex) return;
                    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);

                    const i = (py * width + px) * 4;
                    imageData.data[i] = r; imageData.data[i + 1] = g; imageData.data[i + 2] = b; imageData.data[i + 3] = 255;
                });

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
                const img = new Image();
                img.src = tempCanvas.toDataURL();

                state.aspectRatio = height / width;
                state.originalImageObject = img;
                state.originalImageData = imageData;

                // 🌟 다른 팔레트를 쓰고 있었다면 .3place-blueprint 파일에 맞게 3Place로 강제 전환
                if (state.currentMode !== '3place') {
                    eventBus.emit('FORCE_PALETTE_MODE', '3place');
                }

                eventBus.emit('IMAGE_LOADED', { source: img, imageData: state.originalImageData });
                this.ui.toggleLoading(false);
            } catch (err) {
                console.error('.3place-blueprint 파일 파싱 오류:', err);
                this.ui.toggleLoading(false);
                alert(t('alert_invalid_3place_file'));
            }
        };

        reader.onerror = () => {
            this.ui.toggleLoading(false);
            alert(t('alert_invalid_3place_file'));
        };

        reader.readAsText(file);
    }
}