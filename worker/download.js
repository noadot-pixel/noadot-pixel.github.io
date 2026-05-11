// js/worker/download.js
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

// =======================================================
// [Uplace 전용 팔레트 데이터] RGB 값을 Uplace 고유 ID로 매핑
// =======================================================
const uplacePaletteOrder = [
    [0, 0, 0], [44, 12, 14], [39, 32, 19], [36, 36, 36], [26, 28, 44], [29, 20, 39], [51, 0, 51], [75, 0, 75], 
    [102, 0, 102], [128, 0, 128], [160, 0, 160], [192, 0, 192], [224, 0, 224], [255, 0, 255], [222, 16, 127],
    [255, 56, 129], [255, 102, 107], [239, 125, 87], [220, 141, 95], [216, 157, 69], [168, 130, 54], [188, 111, 71], 
    [159, 91, 80], [156, 84, 50], [119, 94, 40], [124, 63, 32], [92, 46, 26], [77, 43, 37], [91, 39, 49], [93, 39, 93],
    [73, 73, 73], [82, 77, 120], [109, 109, 109], [133, 132, 88], [129, 156, 45], [170, 216, 31], [126, 237, 86], 
    [167, 240, 112], [255, 227, 85], [255, 214, 53], [255, 205, 117], [255, 173, 125], [252, 151, 131], [255, 153, 170], 
    [255, 189, 182], [255, 209, 179], [252, 204, 218], [255, 224, 218], [255, 232, 231], [255, 255, 255], [255, 248, 184], 
    [218, 218, 218], [216, 218, 234], [193, 246, 242], [191, 190, 225], [182, 182, 182], [200, 151, 139], [146, 146, 146], 
    [137, 131, 174], [180, 74, 192], [106, 92, 255], [73, 58, 193], [36, 80, 164], [0, 117, 111], [0, 163, 104],
    [0, 204, 120], [56, 183, 100], [0, 158, 170], [0, 204, 192], [66, 240, 191], [81, 233, 244], [148, 179, 255], 
    [228, 171, 255], [54, 144, 234], [0, 72, 68], [55, 84, 24], [0, 69, 0], [0, 41, 0], [61, 30, 12], [71, 0, 0],
    [105, 0, 0], [139, 0, 0], [172, 0, 0], [190, 0, 57], [207, 46, 46], [177, 62, 83], [163, 70, 3], [129, 30, 9], 
    [36, 20, 98], [0, 102, 0], [0, 143, 0], [249, 128, 6], [255, 168, 0], [255, 69, 0], [255, 0, 0]
];
const uplaceIds = [
    1, 64, 65, 2, 57, 66, 41, 42, 43, 44, 45, 46, 47, 48, 22, 23, 77, 60, 54, 83, 79, 53, 76, 52, 70, 51, 50, 67, 
    68, 58, 3, 73, 4, 82, 78, 81, 31, 62, 84, 17, 61, 55, 88, 24, 89, 56, 91, 93, 92, 8, 18, 7, 94, 95, 90, 6, 87, 
    5, 86, 20, 39, 38, 35, 32, 29, 30, 63, 33, 34, 85, 37, 40, 21, 36, 72, 69, 26, 25, 49, 9, 10, 11, 12, 13, 74, 
    59, 75, 19, 71, 27, 28, 80, 16, 15, 14
];

const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

function scaleImageData(imgData, scale) {
    if (!scale || scale <= 1) return imgData;

    const targetW = imgData.width * scale;
    const targetH = imgData.height * scale;

    const srcCanvas = new OffscreenCanvas(imgData.width, imgData.height);
    srcCanvas.getContext('2d').putImageData(imgData, 0, 0);

    const dstCanvas = new OffscreenCanvas(targetW, targetH);
    const ctx = dstCanvas.getContext('2d');
    
    // 🌟 픽셀 아트 확대의 핵심: 테두리가 흐려지지 않도록 안티앨리어싱 끄기
    ctx.imageSmoothingEnabled = false; 
    ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);

    return ctx.getImageData(0, 0, targetW, targetH);
}

function generateUplaceBlob(width, height, data, timestamp, nameSuffix = "") {
    const pixels = new Uint8Array(width * height);
    const colorMap = new Map();
    uplacePaletteOrder.forEach((rgb, idx) => colorMap.set(rgbToHex(rgb[0], rgb[1], rgb[2]), uplaceIds[idx]));

    const getNearestId = (r, g, b) => {
        let minDist = Infinity; let bestId = 0;
        for (let i = 0; i < uplacePaletteOrder.length; i++) {
            const c = uplacePaletteOrder[i];
            const d = (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2;
            if (d < minDist) { minDist = d; bestId = uplaceIds[i]; }
        }
        return bestId;
    };

    let pIdx = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a === 0) pixels[pIdx++] = 0;
        else {
            const hex = rgbToHex(r, g, b);
            pixels[pIdx++] = colorMap.has(hex) ? colorMap.get(hex) : getNearestId(r, g, b);
        }
    }

    let base64Pixels = '';
    const CHUNK_SIZE = 0x8000;
    for (let i = 0; i < pixels.length; i += CHUNK_SIZE) {
        const chunk = pixels.subarray(i, Math.min(i + CHUNK_SIZE, pixels.length));
        base64Pixels += String.fromCharCode.apply(null, chunk);
    }
    base64Pixels = btoa(base64Pixels);

    const payload = {
        "version": "2.0",
        "guide": {
            "id": `id-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            "name": `NOADOT_${timestamp}${nameSuffix}`,
            "pixels": base64Pixels,
            "originTileX": 0, "originTileY": 0, "originLocalX": 0, "originLocalY": 0,
            "width": width, "height": height, "createdAt": new Date().toISOString()
        },
        "exportedAt": new Date().toISOString()
    };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/octet-stream' });
}

function generateWplaceBlob(width, height, dataUrl, gStartX, gStartY, timestamp, nameSuffix = "") {
    const globalEndX = gStartX + width;
    const globalEndY = gStartY + height;
    const MAP_SIZE = 2048000;
    const pixelToLng = (x) => (x / MAP_SIZE) * 360 - 180;
    const pixelToLat = (y) => {
        const n = Math.PI - (2 * Math.PI * y) / MAP_SIZE;
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    };

    const wplaceData = {
        id: `id-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        schemaVersion: "1",
        name: `NOADOT_${timestamp}${nameSuffix}.png`,
        opacity: 1,
        image: { dataUrl, width, height },
        bounds: {
            north: pixelToLat(gStartY),
            south: pixelToLat(globalEndY),
            west: pixelToLng(gStartX),
            east: pixelToLng(globalEndX)
        },
        colorMetric: "lab", dithering: false, order: 0, locked: false, hasPlaced: true, visible: true
    };
    return new Blob([JSON.stringify(wplaceData, null, 2)], { type: 'application/octet-stream' });
}

self.onmessage = async (e) => {
    let { imageData, options, timestamp } = e.data;

    // 🚨 [핵심 방어 코드] 워커로 넘어오면서 ImageData 껍데기가 벗겨진 경우, 진짜 객체로 심폐소생!
    if (!(imageData instanceof ImageData)) {
        imageData = new ImageData(
            new Uint8ClampedArray(imageData.data), 
            imageData.width, 
            imageData.height
        );
    }

    // 🌟 작업 시작 전, 배율이 있다면 원본 이미지를 먼저 뻥튀기합니다!
    const scale = parseInt(options.exportScale, 10) || 1;
    if (scale > 1) {
        imageData = scaleImageData(imageData, scale);
    }

    // 이제 뻥튀기되고 안전해진 이미지 데이터가 아래 로직들로 흘러갑니다.
    const { width, height, data } = imageData;
    const zip = new JSZip();
    let useZip = false;

    try {
        // ==========================================
        // 1. 색상별 레이어 분리
        // ==========================================
        if (options.isSeparated) {
            useZip = true;
            const colors = new Map();
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                const hex = rgbToHex(data[i], data[i+1], data[i+2]);
                if (!colors.has(hex)) colors.set(hex, []);
                colors.get(hex).push(i);
            }

            for (const [hex, indices] of colors.entries()) {
                const canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext('2d');
                const layerData = new ImageData(width, height);
                for (const idx of indices) {
                    layerData.data[idx] = data[idx];
                    layerData.data[idx+1] = data[idx+1];
                    layerData.data[idx+2] = data[idx+2];
                    layerData.data[idx+3] = data[idx+3];
                }
                ctx.putImageData(layerData, 0, 0);
                const blob = await canvas.convertToBlob({ type: 'image/png' });
                zip.file(`layers/layer_${hex}.png`, blob);

                // 🌟 [추가] 옵션이 켜져있다면, 현재 색상 레이어도 해당 확장자로 변환해서 ZIP에 쏙!
                if (options.isUplace) {
                    const uBlob = generateUplaceBlob(width, height, layerData.data, timestamp, `_layer_${hex}`);
                    zip.file(`layers/layer_${hex}.you`, uBlob);
                }
                if (options.isWplace) {
                    const reader = new FileReaderSync();
                    const dataUrl = reader.readAsDataURL(blob);
                    const gX = (options.wplaceTX * 1000) + options.wplacePX;
                    const gY = (options.wplaceTY * 1000) + options.wplacePY;
                    const wBlob = generateWplaceBlob(width, height, dataUrl, gX, gY, timestamp, `_layer_${hex}`);
                    zip.file(`layers/layer_${hex}.wplace`, wBlob);
                }
            }
        }

        // ==========================================
        // 2. 도안 분할 (특수 포맷 & 좌표계 계산 포함)
        // ==========================================
        if (options.isSplit) {
            useZip = true;
            const { splitCols, splitRows, maintainSize } = options;
            const tileW = Math.ceil(width / splitCols);
            const tileH = Math.ceil(height / splitRows);

            const sourceCanvas = new OffscreenCanvas(width, height);
            sourceCanvas.getContext('2d').putImageData(imageData, 0, 0);

            for (let r = 0; r < splitRows; r++) {
                for (let c = 0; c < splitCols; c++) {
                    const sx = c * tileW;
                    const sy = r * tileH;
                    const sw = Math.min(tileW, width - sx);
                    const sh = Math.min(tileH, height - sy);

                    if (sw <= 0 || sh <= 0) continue;

                    const exportW = maintainSize ? width : sw;
                    const exportH = maintainSize ? height : sh;
                    const dx = maintainSize ? sx : 0;
                    const dy = maintainSize ? sy : 0;

                    const tileCanvas = new OffscreenCanvas(exportW, exportH);
                    tileCanvas.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, dx, dy, sw, sh);
                    const blob = await tileCanvas.convertToBlob({ type: 'image/png' });
                    zip.file(`splits/split_${r + 1}x${c + 1}.png`, blob);

                    // 🌟 [추가] 분할된 각 조각들도 특수 포맷으로 변환!
                    if (options.isUplace || options.isWplace) {
                        const tileImageData = tileCanvas.getContext('2d').getImageData(0, 0, exportW, exportH);
                        const suffix = `_split_${r + 1}x${c + 1}`;
                        
                        if (options.isUplace) {
                            const uBlob = generateUplaceBlob(exportW, exportH, tileImageData.data, timestamp, suffix);
                            zip.file(`splits/split_${r + 1}x${c + 1}.you`, uBlob);
                        }
                        if (options.isWplace) {
                            const reader = new FileReaderSync();
                            const dataUrl = reader.readAsDataURL(blob);
                            // 분할된 조각의 좌표계를 원래 이미지 기준 절대 좌표로 계산!
                            const trueGX = (options.wplaceTX * 1000) + options.wplacePX + sx;
                            const trueGY = (options.wplaceTY * 1000) + options.wplacePY + sy;
                            const wBlob = generateWplaceBlob(exportW, exportH, dataUrl, trueGX, trueGY, timestamp, suffix);
                            zip.file(`splits/split_${r + 1}x${c + 1}.wplace`, wBlob);
                        }
                    }
                }
            }
        }

        // ==========================================
        // 3. Wplace (.wplace) 완벽 인코딩 (좌표계 변환 탑재)
        // ==========================================
        if (options.isWplace) {
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext('2d').putImageData(imageData, 0, 0);
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            const reader = new FileReaderSync();
            const dataUrl = reader.readAsDataURL(blob);

            // 🌟 유저가 입력한 2중 좌표계를 글로벌 절대 좌표로 계산!
            const globalStartX = (options.wplaceTX * 1000) + options.wplacePX;
            const globalStartY = (options.wplaceTY * 1000) + options.wplacePY;
            const globalEndX = globalStartX + width;
            const globalEndY = globalStartY + height;

            // 🌟 Wplace 서버가 요구하는 Mercator 좌표 변환 공식!
            const MAP_SIZE = 2048000;
            const pixelToLng = (x) => (x / MAP_SIZE) * 360 - 180;
            const pixelToLat = (y) => {
                const n = Math.PI - (2 * Math.PI * y) / MAP_SIZE;
                return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
            };

            const wplaceData = {
                id: `id-${Date.now()}`,
                schemaVersion: "1",
                name: `NOADOT_Export_${timestamp}.png`,
                opacity: 1,
                image: { dataUrl, width, height },
                bounds: {
                    north: pixelToLat(globalStartY),
                    south: pixelToLat(globalEndY),
                    west: pixelToLng(globalStartX),
                    east: pixelToLng(globalEndX)
                },
                colorMetric: "lab", dithering: false, order: 0, locked: false, hasPlaced: true, visible: true
            };

            const wBlob = new Blob([JSON.stringify(wplaceData, null, 2)], { type: 'application/octet-stream' });
            if (useZip) zip.file(`NOADOT_${timestamp}.wplace`, wBlob);
            else {
                self.postMessage({ status: 'success', blob: wBlob, fileName: `NOADOT_${timestamp}.wplace` });
                if (!options.isSeparated && !options.isSplit) return;
            }
        }

        // ==========================================
        // 4. Uplace (.you) 완벽 인코딩 (색상 매핑 알고리즘 탑재)
        // ==========================================
        if (options.isUplace) {
            const pixels = new Uint8Array(width * height);
            
            // 🌟 RGB 값을 Uplace 고유 ID로 초고속 매핑
            const colorMap = new Map();
            uplacePaletteOrder.forEach((rgb, idx) => colorMap.set(rgbToHex(rgb[0], rgb[1], rgb[2]), uplaceIds[idx]));

            const getNearestId = (r, g, b) => {
                let minDist = Infinity; let bestId = 0;
                for (let i = 0; i < uplacePaletteOrder.length; i++) {
                    const c = uplacePaletteOrder[i];
                    const d = (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2;
                    if (d < minDist) { minDist = d; bestId = uplaceIds[i]; }
                }
                return bestId;
            };

            let pIdx = 0;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
                if (a === 0) {
                    pixels[pIdx++] = 0; // 투명
                } else {
                    const hex = rgbToHex(r, g, b);
                    pixels[pIdx++] = colorMap.has(hex) ? colorMap.get(hex) : getNearestId(r, g, b);
                }
            }

            // 🌟 Base64 인코딩 시 메모리 초과를 막기 위한 청크(Chunk) 분할 로직
            let base64Pixels = '';
            const CHUNK_SIZE = 0x8000; // 32768
            for (let i = 0; i < pixels.length; i += CHUNK_SIZE) {
                const chunk = pixels.subarray(i, Math.min(i + CHUNK_SIZE, pixels.length));
                base64Pixels += String.fromCharCode.apply(null, chunk);
            }
            base64Pixels = btoa(base64Pixels);

            const payload = {
                "version": "2.0",
                "guide": {
                    "id": Date.now().toString(),
                    "name": `NOADOT_Uplace_${timestamp}`,
                    "pixels": base64Pixels,
                    "originTileX": 0, "originTileY": 0, "originLocalX": 0, "originLocalY": 0,
                    "width": width, "height": height, "createdAt": new Date().toISOString()
                },
                "exportedAt": new Date().toISOString()
            };

            const uBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/octet-stream' });
            if (useZip) zip.file(`NOADOT_${timestamp}.you`, uBlob);
            else {
                self.postMessage({ status: 'success', blob: uBlob, fileName: `NOADOT_${timestamp}.you` });
                if (!options.isSeparated && !options.isSplit) return;
            }
        }

        // ==========================================
        // 5. ZIP 압축 또는 기본 PNG 처리
        // ==========================================
        if (useZip) {
            // 원본 파일도 ZIP 안에 포함
            const mainCanvas = new OffscreenCanvas(width, height);
            mainCanvas.getContext('2d').putImageData(imageData, 0, 0);
            const mainBlob = await mainCanvas.convertToBlob({ type: 'image/png' });
            zip.file(`NOADOT_${timestamp}_Original.png`, mainBlob);

            const content = await zip.generateAsync({ type: 'blob' });
            self.postMessage({ status: 'success', blob: content, fileName: `NOADOT_${timestamp}.zip` });
        } else if (!options.isWplace && !options.isUplace) {
            // 아무 고급 옵션도 선택하지 않았을 때 (기본 PNG)
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext('2d').putImageData(imageData, 0, 0);
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            self.postMessage({ status: 'success', blob: blob, fileName: `NOADOT_${timestamp}.png` });
        }

    } catch (err) {
        self.postMessage({ status: 'error', message: err.message });
    }
};