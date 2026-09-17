// js/worker/download.js
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';
// 🌟 [정리] Youplace(.you) 인코딩 로직을 공용 모듈로 분리 (업로드 쪽 디코딩과 공유)
// 🌟 [2026-09] Youplace 1.1.0 업데이트로 .you 포맷이 버전 2.1(픽셀당 RGB 3바이트, 고정 팔레트 없음)로
// 바뀌어서 더 이상 여기서 팔레트 최근접 매칭을 할 필요가 없어졌다. encodeYouPixelsV2 하나로 대체.
import { encodeYouPixelsV2 } from '../data/uplace-file-format.js';
import { threeplaceBlueprintPalette } from '../data/palettes.js';

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
    const base64Pixels = encodeYouPixelsV2(width, height, data);

    const payload = {
        "version": "2.1",
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

// 🌟 [공용화] 원래 is3place 블록 안에 인라인으로만 있던 로직을 분할(split) 조각에도 재사용할 수 있도록
// generateUplaceBlob/generateWplaceBlob와 같은 스타일의 독립 함수로 뺐다.
function generateThreeplaceBlueprintBlob(width, height, data, options, timestamp, originX, originY, nameSuffix = "") {
    // 🌟 실제로 사이트에서 뽑은 blueprint 파일 두 개(용도가 다른 모델)를 직접 비교해서 알아낸 사실:
    // palette 배열은 "실제로 쓰인 색만 골라 압축"하면 안 되고, 항상 이 고정 64색 전체를 이 순서 그대로
    // 담아야 함 (한쪽은 64색 중 12색만, 다른쪽은 23색만 실제로 썼는데도 palette는 둘 다 64개 전체였음).
    // 이걸 어기면 사이트가 "palette does not match the current world palette" 에러로 거부함.
    const colorIndexMap = new Map(threeplaceBlueprintPalette.map((hex, idx) => [hex, idx]));

    // 팔레트에 정확히 없는 색(예: 다른 모드에서 섞여 들어온 색)을 위한 방어적 최근접 매칭
    const findNearestIndex = (r, g, b) => {
        let bestIdx = 0, bestDist = Infinity;
        for (let idx = 0; idx < threeplaceBlueprintPalette.length; idx++) {
            const hex = threeplaceBlueprintPalette[idx];
            const pr = parseInt(hex.slice(1, 3), 16), pg = parseInt(hex.slice(3, 5), 16), pb = parseInt(hex.slice(5, 7), 16);
            const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
            if (d < bestDist) { bestDist = d; bestIdx = idx; }
        }
        return bestIdx;
    };
    const nearestCache = new Map();

    // 🌟 "눕혀서(바닥 모자이크)" vs "세워서(벽면)" - 어느 축이 두께(항상 0)이고
    // 어느 축이 이미지의 세로(row)를 받는지만 다르고, 그 외 로직은 동일하다.
    const isStanding = options.place3Orientation === 'standing';

    const voxels = [];
    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const i = (py * width + px) * 4;
            if (data[i + 3] === 0) continue; // 투명 픽셀은 voxel로 만들지 않음 (희소 배열 유지)

            const r = data[i], g = data[i + 1], b = data[i + 2];
            const hexLower = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
            let colorIndex = colorIndexMap.get(hexLower);
            if (colorIndex === undefined) {
                if (nearestCache.has(hexLower)) colorIndex = nearestCache.get(hexLower);
                else { colorIndex = findNearestIndex(r, g, b); nearestCache.set(hexLower, colorIndex); }
            }

            // 이미지의 맨 위(row 0)가 "위쪽"이 되도록 뒤집는다 (세워서: Z가 위쪽 / 눕혀서: Y가 발자국 안쪽)
            const flipped = height - 1 - py;

            if (isStanding) {
                // 🖼️ 세워서(벽면): Z축이 높이. Y(깊이)는 항상 0 (벽처럼 얇게 서있음).
                voxels.push([px, 0, flipped, colorIndex]);
            } else {
                // 🟫 눕혀서(바닥 모자이크): Y축이 발자국의 나머지 한 변. Z(두께)는 항상 0 (바닥에 딱 붙음).
                voxels.push([px, flipped, 0, colorIndex]);
            }
        }
    }

    const blueprintJson = {
        format: "3place-blueprint",
        version: 1,
        name: `NOADOT_${timestamp}${nameSuffix}`,
        palette: threeplaceBlueprintPalette,
        // 눕혀서: [가로, 세로, 두께=1] / 세워서: [가로, 두께=1, 높이]
        size: isStanding ? [width, 1, height] : [width, height, 1],
        placement: {
            // 사이트 업로드 후 "Place template" 창에서 좌표를 다시 지정할 수 있으므로, 입력 안 하면 원점(0,0,0)
            origin: [originX, originY, 0],
            basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            // 참조 파일들의 "세워진(두께) 축은 0, 나머지 두 축은 중앙" 패턴을 그대로 따름
            pivot: isStanding
                ? [Math.floor((width - 1) / 2), 0, 0]
                : [Math.floor((width - 1) / 2), Math.floor((height - 1) / 2), 0]
        },
        voxels: voxels
    };

    return new Blob([JSON.stringify(blueprintJson)], { type: 'application/octet-stream' });
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
                const layerName = (options.colorNameMap && options.colorNameMap[hex]) ? options.colorNameMap[hex] : hex;
                const safeLayerName = layerName.replace(/[\/\\?%*:|"<>]/g, '_'); // 특수문자가 폴더를 망가뜨리지 않게 치환

                zip.file(`layers/layer_${safeLayerName}.png`, blob);

                if (options.isUplace) {
                    const uBlob = generateUplaceBlob(width, height, layerData.data, timestamp, `_layer_${safeLayerName}`);
                    zip.file(`layers/layer_${safeLayerName}.you`, uBlob);
                }
                if (options.isWplace) {
                    const reader = new FileReaderSync();
                    const dataUrl = reader.readAsDataURL(blob);
                    const gX = (options.wplaceTX * 1000) + options.wplacePX;
                    const gY = (options.wplaceTY * 1000) + options.wplacePY;
                    const wBlob = generateWplaceBlob(width, height, dataUrl, gX, gY, timestamp, `_layer_${safeLayerName}`);
                    zip.file(`layers/layer_${safeLayerName}.wplace`, wBlob);
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
                    if (options.isUplace || options.isWplace || options.is3place) {
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
                        if (options.is3place) {
                            // 조각의 origin도 원본 이미지 기준 픽셀 오프셋(sx, sy)만큼 더해서, 나중에 조각들을
                            // 그대로 이어붙이면 원본 배치가 재현되도록 한다 (wplace의 trueGX/trueGY와 동일한 발상).
                            const originX = (options.place3X || 0) + sx;
                            const originY = (options.place3Y || 0) + sy;
                            const bpBlob = generateThreeplaceBlueprintBlob(exportW, exportH, tileImageData.data, options, timestamp, originX, originY, suffix);
                            zip.file(`splits/split_${r + 1}x${c + 1}.3place-blueprint`, bpBlob);
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
            const base64Pixels = encodeYouPixelsV2(width, height, data);

            const payload = {
                "version": "2.1",
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

        if (options.isBplace) {
            // 1. 순수 캔버스 이미지를 Base64 텍스트로 변환
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext('2d').putImageData(imageData, 0, 0);
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            const arrayBuffer = await blob.arrayBuffer();
            
            let binary = '';
            const bytes = new Uint8Array(arrayBuffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = 'data:image/png;base64,' + btoa(binary); // 마법의 압축 문자열 완성!
            
            // 2. 고정된 JSON 템플릿에 좌표값과 함께 탑재
            const nowIso = new Date().toISOString();
            const bplaceJson = {
                "version": 1,
                "exportedAt": nowIso,
                "template": {
                    "name": `NOADOT_${timestamp}`,
                    "imageData": base64Data,
                    "opacity": 1,
                    "position": { 
                        "x": options.bplaceX || 0, 
                        "y": options.bplaceY || 0 
                    },
                    "scale": 1,
                    "rotation": 0,
                    "visible": true,
                    "width": width,
                    "height": height,
                    "displayMode": "pixel",
                    "renderAbovePixels": true,
                    "canvasType": "world",
                    "excludeSpecialColors": false,
                    "pendingUpload": false,
                    "updatedAt": nowIso,
                    "pixelAlgorithm": "v2",
                    "boundingWidth": width,
                    "boundingHeight": height,
                    "pixelCount": width * height,
                    "_version": 110111011011111 
                }
            };
            
            const bBlob = new Blob([JSON.stringify(bplaceJson, null, 2)], { type: 'application/octet-stream' });
            
            if (useZip) {
                zip.file(`NOADOT_${timestamp}.bplace`, bBlob);
            } else {
                self.postMessage({ status: 'success', blob: bBlob, fileName: `NOADOT_${timestamp}.bplace` });
                // 다른 포맷이 안 켜져 있으면 여기서 바로 종료!
                if (!options.isSeparated && !options.isSplit && !options.isWplace && !options.isUplace) return;
            }
        }

        if (options.is3place) {
            const bpBlob = generateThreeplaceBlueprintBlob(width, height, data, options, timestamp, options.place3X || 0, options.place3Y || 0);

            if (useZip) {
                zip.file(`NOADOT_${timestamp}.3place-blueprint`, bpBlob);
            } else {
                self.postMessage({ status: 'success', blob: bpBlob, fileName: `NOADOT_${timestamp}.3place-blueprint` });
                // 다른 포맷이 안 켜져 있으면 여기서 바로 종료!
                if (!options.isSeparated && !options.isSplit && !options.isWplace && !options.isUplace && !options.isBplace) return;
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