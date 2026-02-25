// js/features/export-utils/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, rgbToHex, t } from '../../state.js';
import { wplaceFreeColors, wplacePaidColors } from '../../../data/palettes.js';
import { ExportUI } from './ui.js';

// ==========================================
// [보안 메타데이터 생성 및 PNG 청크 조작 유틸리티]
// ==========================================
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[i] = c;
}

function crc32(buffer, offset, length) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < length; i++) {
        crc = crcTable[(crc ^ buffer[offset + i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createSecureStamp() {
    // [핵심 연동] PresetManager가 수집한 모든 현재 레시피(상태)를 긁어옵니다.
    const recipeData = typeof state.getCurrentPresetConfig === 'function' 
                       ? state.getCurrentPresetConfig("NoaDot Auto Export Preset") 
                       : {};

    const info = {
        engine: "Noadot-Pixel-Engine",
        version: "6.2",
        exportedAt: new Date().toISOString(),
        verified: true,
        recipe: recipeData // 캡슐화된 모든 설정값이 여기에 통째로 탑재됩니다!
    };
    
    const jsonStr = JSON.stringify(info);
    const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
    return `ND_STAMP:${encoded}`;
}
// ==========================================

// [Uplace Base64 암호 해독 배열]
const uplacePaletteOrder = [
    [0, 0, 0], [44, 12, 14], [39, 32, 19], [36, 36, 36], [26, 28, 44],
    [29, 20, 39], [51, 0, 51], [75, 0, 75], [102, 0, 102], [128, 0, 128],
    [160, 0, 160], [192, 0, 192], [224, 0, 224], [255, 0, 255], [222, 16, 127],
    [255, 56, 129], [255, 102, 107], [239, 125, 87], [220, 141, 95], [216, 157, 69],
    [168, 130, 54], [188, 111, 71], [159, 91, 80], [156, 84, 50], [119, 94, 40],
    [124, 63, 32], [92, 46, 26], [77, 43, 37], [91, 39, 49], [93, 39, 93],
    [73, 73, 73], [82, 77, 120], [109, 109, 109], [133, 132, 88], [129, 156, 45],
    [170, 216, 31], [126, 237, 86], [167, 240, 112], [255, 227, 85], [255, 214, 53],
    [255, 205, 117], [255, 173, 125], [252, 151, 131], [255, 153, 170], [255, 189, 182],
    [255, 209, 179], [252, 204, 218], [255, 224, 218], [255, 232, 231], [255, 255, 255],
    [255, 248, 184], [218, 218, 218], [216, 218, 234], [193, 246, 242], [191, 190, 225],
    [182, 182, 182], [200, 151, 139], [146, 146, 146], [137, 131, 174], [180, 74, 192],
    [106, 92, 255], [73, 58, 193], [36, 80, 164], [0, 117, 111], [0, 163, 104],
    [0, 204, 120], [56, 183, 100], [0, 158, 170], [0, 204, 192], [66, 240, 191],
    [81, 233, 244], [148, 179, 255], [228, 171, 255], [54, 144, 234], [0, 72, 68],
    [55, 84, 24], [0, 69, 0], [0, 41, 0], [61, 30, 12], [71, 0, 0],
    [105, 0, 0], [139, 0, 0], [172, 0, 0], [190, 0, 57], [207, 46, 46],
    [177, 62, 83], [163, 70, 3], [129, 30, 9], [36, 20, 98], [0, 102, 0],
    [0, 143, 0], [249, 128, 6], [255, 168, 0], [255, 69, 0], [255, 0, 0]
];

const uplaceIds = [
    1, 64, 65, 2, 57, 66, 41, 42, 43, 44, 45, 46, 47, 48, 22, 23,
    77, 60, 54, 83, 79, 53, 76, 52, 70, 51, 50, 67, 68, 58, 3,
    73, 4, 82, 78, 81, 31, 62, 84, 17, 61, 55, 88, 24, 89, 56,
    91, 93, 92, 8, 18, 7, 94, 95, 90, 6, 87, 5, 86, 20, 39, 38, 35,
    32, 29, 30, 63, 33, 34, 85, 37, 40, 21, 36, 72, 69, 26, 25,
    49, 9, 10, 11, 12, 13, 74, 59, 75, 19, 71, 27, 28, 80, 16, 15, 14
];

export class ExportFeature {
    constructor() {
        this.ui = new ExportUI(); 
        
        if (this.ui.downloadBtn) {
            this.ui.downloadBtn.disabled = true;
        }

        if (this.ui.chkUplace) {
            this.ui.chkUplace.disabled = false;
        }

        this.initEvents();
        this.initBusListeners();
    }

    initBusListeners() {
        eventBus.on('CONVERSION_START', () => {
            if (this.ui.downloadBtn) this.ui.downloadBtn.disabled = true;
        });

        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (data && data.imageData) {
                state.finalDownloadableData = data.imageData;
                if (this.ui.downloadBtn) this.ui.downloadBtn.disabled = false;
                this.updateSplitInputLimits();
            }
        });

        eventBus.on('PALETTE_MODE_CHANGED', (mode) => {
            this.updateUplaceOptionVisibility();
        });
    }

    updateUplaceOptionVisibility() {
        if (this.ui.uplaceWrapper) {
            if (state.currentMode === 'uplace') {
                this.ui.uplaceWrapper.style.display = 'block'; 
            } else {
                this.ui.uplaceWrapper.style.display = 'none';  
                if (this.ui.chkUplace) this.ui.chkUplace.checked = false; 
            }
        }
    }

    initEvents() {
        if (this.ui.downloadBtn) {
            this.ui.downloadBtn.addEventListener('click', () => {
                this.handleDownload();
            });
        }

        if (this.ui.chkSplit) {
            this.ui.chkSplit.addEventListener('change', (e) => {
                if (this.ui.splitOptions) {
                    this.ui.splitOptions.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        if (this.ui.splitCols && this.ui.splitRows) {
            const validateInput = (input) => {
                if (!state.finalDownloadableData) return;
                let val = parseInt(input.value) || 1;
                const max = input.id === 'splitCols' ? state.finalDownloadableData.width : state.finalDownloadableData.height;
                
                if (val < 1) val = 1;
                if (val > max) val = max;
                input.value = val;
            };

            this.ui.splitCols.addEventListener('change', (e) => validateInput(e.target));
            this.ui.splitRows.addEventListener('change', (e) => validateInput(e.target));
        }
    }

    updateSplitInputLimits() {
        if (!state.finalDownloadableData) return;
        if (this.ui.splitCols) this.ui.splitCols.max = state.finalDownloadableData.width;
        if (this.ui.splitRows) this.ui.splitRows.max = state.finalDownloadableData.height;
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

    injectMetadataToPng(buffer, key, value) {
        const view = new DataView(buffer);
        const chunks = [];
        let offset = 8; 

        while (offset < buffer.byteLength) {
            const length = view.getUint32(offset);
            const type = String.fromCharCode(
                view.getUint8(offset + 4), view.getUint8(offset + 5),
                view.getUint8(offset + 6), view.getUint8(offset + 7)
            );

            if (type === 'IEND') break; 
            chunks.push(buffer.slice(offset, offset + 12 + length));
            offset += 12 + length;
        }

        const textData = key + '\0' + value;
        const textBytes = new Uint8Array(textData.length);
        for (let i = 0; i < textData.length; i++) {
            textBytes[i] = textData.charCodeAt(i) & 0xFF;
        }

        const chunkLength = textBytes.length;
        const newChunk = new Uint8Array(12 + chunkLength);
        const newView = new DataView(newChunk.buffer);

        newView.setUint32(0, chunkLength);
        newChunk.set([116, 69, 88, 116], 4); 
        newChunk.set(textBytes, 8);
        
        const crc = crc32(newChunk, 4, 4 + chunkLength);
        newView.setUint32(8 + chunkLength, crc);

        const iendChunk = buffer.slice(offset, offset + 12);

        return new Blob([
            buffer.slice(0, 8), 
            ...chunks, 
            newChunk, 
            iendChunk
        ], { type: 'image/png' });
    }

    async handleDownload() {
        if (!state.finalDownloadableData) {
            alert(t('alert_no_data_to_download')); 
            return;
        }

        const imageData = state.finalDownloadableData;
        const isSeparated = this.ui.chkSeparated && this.ui.chkSeparated.checked;
        const isSplit = this.ui.chkSplit && this.ui.chkSplit.checked;
        
        const isUplaceMode = state.currentMode === 'uplace';
        const isYouFileRequested = isUplaceMode && this.ui.chkUplace && this.ui.chkUplace.checked;

        const timestamp = this.getTimestamp();

        if (!isSeparated && !isSplit) {
            if (isYouFileRequested) {
                const blob = this.createYouFileBlob(imageData, `NoaDot Export ${timestamp}`);
                saveAs(blob, `NOADOT_Uplace_${timestamp}.you`);
            } else {
                const fileName = `NOADOT_Export_${timestamp}.png`;
                await this.downloadCanvasAsPng(imageData, fileName);
            }
            return;
        }

        if (!window.JSZip) {
            alert(t('alert_jszip_missing'));
            return;
        }

        const zip = new JSZip();

        if (isSeparated) await this.addSeparatedColorsToZip(zip, imageData, isYouFileRequested);
        if (isSplit) await this.addSplitImagesToZip(zip, imageData, isYouFileRequested);

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `NOADOT_Export_${timestamp}.zip`);
    }

    async downloadCanvasAsPng(imageData, fileName) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        canvas.getContext('2d').putImageData(imageData, 0, 0);
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const arrayBuffer = await blob.arrayBuffer();
        const secureBlob = this.injectMetadataToPng(arrayBuffer, "Comment", createSecureStamp());
        
        saveAs(secureBlob, fileName);
    }

    createYouFileBlob(imageData, namePrefix) {
        const { width, height, data } = imageData;
        const pixels = new Uint8Array(width * height);
        
        const colorMap = new Map();
        uplacePaletteOrder.forEach((rgb, idx) => {
            const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
            colorMap.set(hex, uplaceIds[idx]);
        });

        const getNearestId = (r, g, b) => {
            let minDist = Infinity;
            let bestId = 0;
            for (let i = 0; i < uplacePaletteOrder.length; i++) {
                const c = uplacePaletteOrder[i];
                const d = (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2;
                if (d < minDist) {
                    minDist = d;
                    bestId = uplaceIds[i];
                }
            }
            return bestId;
        };

        let pIdx = 0;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a === 0) {
                pixels[pIdx++] = 0; 
            } else {
                const hex = rgbToHex(r, g, b);
                if (colorMap.has(hex)) {
                    pixels[pIdx++] = colorMap.get(hex);
                } else {
                    pixels[pIdx++] = getNearestId(r, g, b); 
                }
            }
        }

        let base64Pixels = '';
        const CHUNK_SIZE = 0x8000;
        for (let i = 0; i < pixels.length; i += CHUNK_SIZE) {
            const chunk = pixels.subarray(i, Math.min(i + CHUNK_SIZE, pixels.length));
            base64Pixels += String.fromCharCode.apply(null, chunk);
        }
        base64Pixels = window.btoa(base64Pixels);

        const uniqueId = Date.now().toString() + Math.floor(Math.random() * 1000);

        const payload = {
            "version": "2.0",
            "guide": {
                "id": uniqueId,
                "name": namePrefix,
                "pixels": base64Pixels,
                "originTileX": 0,
                "originTileY": 0,
                "originLocalX": 0,
                "originLocalY": 0,
                "width": width,
                "height": height,
                "createdAt": new Date().toISOString()
            },
            "exportedAt": new Date().toISOString()
        };

        return new Blob([JSON.stringify(payload, null, 2)], { type: "application/octet-stream" });
    }

    async addSplitImagesToZip(zip, imageData, isYouRequested) {
        const cols = parseInt(this.ui.splitCols.value) || 2;
        const rows = parseInt(this.ui.splitRows.value) || 2;
        const maintainSize = this.ui.chkMaintainSize.checked;

        const width = imageData.width;
        const height = imageData.height;

        const masterCanvas = document.createElement('canvas');
        masterCanvas.width = width;
        masterCanvas.height = height;
        masterCanvas.getContext('2d').putImageData(imageData, 0, 0);

        const folderName = isYouRequested ? "split_drafts_you" : "split_drafts";
        const folder = zip.folder(folderName);
        
        const segW = Math.floor(width / cols);
        const segH = Math.floor(height / rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * segW;
                const y = r * segH;
                const w = (c === cols - 1) ? width - x : segW;
                const h = (r === rows - 1) ? height - y : segH;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (maintainSize) {
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(masterCanvas, x, y, w, h, x, y, w, h);
                } else {
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(masterCanvas, x, y, w, h, 0, 0, w, h);
                }

                if (isYouRequested) {
                    const segmentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const fileName = `part_${r + 1}_${c + 1}.you`;
                    const blob = this.createYouFileBlob(segmentImageData, `Part ${r + 1}-${c + 1}`);
                    folder.file(fileName, blob);
                } else {
                    const fileName = `part_${r + 1}_${c + 1}.png`;
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    const arrayBuffer = await blob.arrayBuffer();
                    const secureBlob = this.injectMetadataToPng(arrayBuffer, "Comment", createSecureStamp());
                    folder.file(fileName, secureBlob);
                }
            }
        }
    }

    async addSeparatedColorsToZip(zip, imageData, isYouRequested) {
        const { width, height, data } = imageData;
        const colorLayers = {}; 
        
        const palette = [...wplaceFreeColors, ...wplacePaidColors];
        const isWplaceRelated = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
        const folderName = isYouRequested ? "separated_colors_you" : "separated_colors";
        const folder = zip.folder(folderName);

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
            const idx = i;
            layer.buffer[idx] = r;
            layer.buffer[idx+1] = g;
            layer.buffer[idx+2] = b;
            layer.buffer[idx+3] = a; 
            layer.count++;
        }

        const promises = Object.keys(colorLayers).map(hex => {
            return new Promise((resolve) => {
                const layerInfo = colorLayers[hex];
                const imgData = new ImageData(layerInfo.buffer, width, height);
                const safeName = layerInfo.name.replace(/[\/\\?%*:|"<>]/g, '_');

                if (isYouRequested) {
                    const fileName = `${safeName} - ${layerInfo.count}.you`;
                    const blob = this.createYouFileBlob(imgData, safeName);
                    folder.file(fileName, blob);
                    resolve();
                } else {
                    const layerCanvas = document.createElement('canvas');
                    layerCanvas.width = width;
                    layerCanvas.height = height;
                    const ctx = layerCanvas.getContext('2d');
                    
                    ctx.putImageData(imgData, 0, 0);

                    const fileName = `${safeName} - ${layerInfo.count}.png`;
                    layerCanvas.toBlob(async (blob) => {
                        const arrayBuffer = await blob.arrayBuffer();
                        const secureBlob = this.injectMetadataToPng(arrayBuffer, "Comment", createSecureStamp());
                        folder.file(fileName, secureBlob);
                        resolve();
                    }, 'image/png');
                }
            });
        });

        await Promise.all(promises);
    }
}