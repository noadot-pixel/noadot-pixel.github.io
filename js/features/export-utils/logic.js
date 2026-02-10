import { eventBus } from '../../core/EventBus.js';
import { state, rgbToHex, t } from '../../state.js';
import { wplaceFreeColors, wplacePaidColors } from '../../../data/palettes.js';

export class ExportFeature {
    constructor() {
        this.downloadBtn = document.getElementById('downloadBtn');
        this.chkUplace = document.getElementById('chkDownloadUplace');
        this.chkSeparated = document.getElementById('chkDownloadSeparated');
        
        if (this.downloadBtn) this.downloadBtn.disabled = true;

        this.initEvents();
        this.initBusListeners();
        this.updateUplaceOptionVisibility();
    }

    initBusListeners() {
        eventBus.on('CONVERSION_START', () => {
            if (this.downloadBtn) this.downloadBtn.disabled = true;
        });

        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (data && data.imageData) {
                state.finalDownloadableData = data.imageData;
                if (this.downloadBtn) this.downloadBtn.disabled = false;
            }
        });
        
        eventBus.on('MODE_CHANGED', () => this.updateUplaceOptionVisibility());
        eventBus.on('PALETTE_UPDATED', () => this.updateUplaceOptionVisibility());
    }

    initEvents() {
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => {
                this.handleDownload();
            });
        }

        document.addEventListener('click', () => this.updateUplaceOptionVisibility());
    }

    updateUplaceOptionVisibility() {
        if (!this.chkUplace) return;
        
        const isWplaceRelated = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
        if (isWplaceRelated) {
            this.chkUplace.disabled = false;
            if(this.chkUplace.nextElementSibling) this.chkUplace.nextElementSibling.style.color = '#555';
        } else {
            this.chkUplace.disabled = true;
            this.chkUplace.checked = false;
            if(this.chkUplace.nextElementSibling) this.chkUplace.nextElementSibling.style.color = '#ccc';
        }
    }

    getTimestamp() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${y}${m}${d}_${h}${min}`;
    }

    async handleDownload() {
        if (!state.finalDownloadableData) {
            alert(t('alert_no_data_to_download')); 
            return;
        }

        const imageData = state.finalDownloadableData;
        const isUplace = this.chkUplace && this.chkUplace.checked;
        const isSeparated = this.chkSeparated && this.chkSeparated.checked;
        const timestamp = this.getTimestamp();

        // 1. 아무 옵션도 없으면 기본 PNG 다운로드
        if (!isUplace && !isSeparated) {
            const fileName = `NOADOT_Export_${timestamp}.png`;
            this.downloadCanvasAsPng(imageData, fileName);
            return;
        }

        // 2. Uplace (.you) 다운로드 -> [수정] 제작 중 알림 처리
        if (isUplace) {
            // await this.generateAndDownloadUplace(imageData); // 기존 로직 주석 처리
            alert(t('alert_uplace_wip')); // "제작 중" 메시지 출력
        }

        // 3. 색상별 분리 다운로드 (.zip)
        if (isSeparated) {
            await this.generateAndDownloadZip(imageData, timestamp);
        }
    }

    downloadCanvasAsPng(imageData, fileName) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => {
            saveAs(blob, fileName);
        });
    }

    // (참고: generateAndDownloadUplace 메서드는 나중을 위해 남겨두거나 삭제하셔도 됩니다.)

    async generateAndDownloadZip(imageData, timestamp) {
        if (!window.JSZip) {
            alert(t('alert_jszip_missing')); 
            return;
        }

        const zip = new JSZip();
        const { width, height, data } = imageData;
        const colorLayers = {}; 
        
        const palette = [...wplaceFreeColors, ...wplacePaidColors];
        const isWplaceRelated = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a === 0) continue; 

            const hex = rgbToHex(r, g, b);
            
            if (!colorLayers[hex]) {
                colorLayers[hex] = {
                    buffer: new Uint8ClampedArray(width * height * 4),
                    count: 0,
                    name: null 
                };

                if (isWplaceRelated) {
                    const matched = palette.find(c => 
                        c.rgb[0] === r && c.rgb[1] === g && c.rgb[2] === b
                    );
                    colorLayers[hex].name = matched && matched.name ? matched.name : hex;
                } else {
                    colorLayers[hex].name = hex;
                }
            }

            const layer = colorLayers[hex];
            layer.buffer[i] = r;
            layer.buffer[i+1] = g;
            layer.buffer[i+2] = b;
            layer.buffer[i+3] = a; 
            layer.count++;
        }

        const promises = Object.keys(colorLayers).map(hex => {
            return new Promise((resolve) => {
                const layerInfo = colorLayers[hex];
                const layerCanvas = document.createElement('canvas');
                layerCanvas.width = width;
                layerCanvas.height = height;
                const ctx = layerCanvas.getContext('2d');
                
                const imgData = new ImageData(layerInfo.buffer, width, height);
                ctx.putImageData(imgData, 0, 0);

                // 파일명 규칙 적용
                // 특수문자 제거 후 파일명 생성
                const safeName = layerInfo.name.replace(/[\/\\?%*:|"<>]/g, '_');
                const fileName = `${safeName} - ${layerInfo.count}.png`;

                layerCanvas.toBlob((blob) => {
                    zip.file(fileName, blob);
                    resolve();
                });
            });
        });

        await Promise.all(promises);

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `NOADOT_Export_${timestamp}.zip`);
    }
}