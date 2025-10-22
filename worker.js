// worker.js (수정 완료 - 색상추천 복구, 디더링 버그 수정)

// --- 유틸리티 함수 ---
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// --- 색상 변환 유틸리티 ---
const ColorConverter = {
    srgbToLinear(c) { return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; },
    rgbToOklab(rgb) { const r = this.srgbToLinear(rgb[0] / 255); const g = this.srgbToLinear(rgb[1] / 255); const b = this.srgbToLinear(rgb[2] / 255); const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b; const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b; const l_ = Math.cbrt(l); const m_ = Math.cbrt(m); const s_ = Math.cbrt(s); return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_]; },
    deltaE2000(lab1, lab2) { const L1 = lab1[0], a1 = lab1[1], b1 = lab1[2]; const L2 = lab2[0], a2 = lab2[1], b2 = lab2[2]; const kL = 1, kC = 1, kH = 1; const C1 = Math.sqrt(a1 * a1 + b1 * b1); const C2 = Math.sqrt(a2 * a2 + b2 * b2); const C_bar = (C1 + C2) / 2; const G = 0.5 * (1 - Math.sqrt(Math.pow(C_bar, 7) / (Math.pow(C_bar, 7) + Math.pow(25, 7)))); const a1_prime = a1 * (1 + G); const a2_prime = a2 * (1 + G); const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1); const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2); const h1_prime = (Math.atan2(b1, a1_prime) * 180 / Math.PI + 360) % 360; const h2_prime = (Math.atan2(b2, a2_prime) * 180 / Math.PI + 360) % 360; const delta_L_prime = L2 - L1; const delta_C_prime = C2_prime - C1_prime; let delta_h_prime; if (C1_prime * C2_prime === 0) { delta_h_prime = 0; } else if (Math.abs(h2_prime - h1_prime) <= 180) { delta_h_prime = h2_prime - h1_prime; } else if (h2_prime - h1_prime > 180) { delta_h_prime = h2_prime - h1_prime - 360; } else { delta_h_prime = h2_prime - h1_prime + 360; } const delta_H_prime = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin((delta_h_prime * Math.PI / 180) / 2); const L_bar_prime = (L1 + L2) / 2; const C_bar_prime = (C1_prime + C2_prime) / 2; let h_bar_prime; if (C1_prime * C2_prime === 0) { h_bar_prime = h1_prime + h2_prime; } else if (Math.abs(h1_prime - h2_prime) <= 180) { h_bar_prime = (h1_prime + h2_prime) / 2; } else if (h1_prime + h2_prime < 360) { h_bar_prime = (h1_prime + h2_prime + 360) / 2; } else { h_bar_prime = (h1_prime + h2_prime - 360) / 2; } const T = 1 - 0.17 * Math.cos((h_bar_prime - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * h_bar_prime * Math.PI / 180) + 0.32 * Math.cos(3 * h_bar_prime * Math.PI / 180 + 6 * Math.PI / 180) - 0.20 * Math.cos(4 * h_bar_prime * Math.PI / 180 - 63 * Math.PI / 180); const S_L = 1 + (0.015 * Math.pow(L_bar_prime - 50, 2)) / Math.sqrt(20 + Math.pow(L_bar_prime - 50, 2)); const S_C = 1 + 0.045 * C_bar_prime; const S_H = 1 + 0.015 * C_bar_prime * T; const R_T = -2 * Math.sqrt(Math.pow(C_bar_prime, 7) / (Math.pow(C_bar_prime, 7) + Math.pow(25, 7))) * Math.sin(60 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2)) * Math.PI / 180); const L_term = delta_L_prime / (kL * S_L); const C_term = delta_C_prime / (kC * S_C); const H_term = delta_H_prime / (kH * S_H); return Math.sqrt(L_term * L_term + C_term * C_term + H_term * H_term + R_T * (C_term * H_term)); },
};

const findClosestColor = (r1, g1, b1, palette, paletteOklab, useHighQuality) => {
    let minDistance = Number.MAX_SAFE_INTEGER;
    let closestIndex = 0;
    if (useHighQuality && paletteOklab) {
        const targetOklab = ColorConverter.rgbToOklab([r1, g1, b1]);
        for (let i = 0; i < paletteOklab.length; i++) {
            const distance = ColorConverter.deltaE2000(targetOklab, paletteOklab[i]);
            if (distance < minDistance) { minDistance = distance; closestIndex = i; }
            if (minDistance === 0) break;
        }
    } else {
        for (let i = 0; i < palette.length; i++) {
            const pColor = palette[i];
            const [r2, g2, b2] = pColor;
            const rMean = (r1 + r2) / 2;
            const r = r1 - r2; const g = g1 - g2; const b = b1 - b2;
            const distance = Math.floor(((512 + rMean) * r * r) / 256) + 4 * g * g + Math.floor(((767 - rMean) * b * b) / 256);
            if (distance < minDistance) { minDistance = distance; closestIndex = i; }
            if (minDistance === 0) break;
        }
    }
    return { color: palette[closestIndex], distance: minDistance };
};

function preprocessImageData(sourceImageData, options) {
    const { saturation, brightness, contrast } = options;
    const sat = saturation / 100.0, bri = brightness, con = contrast;
    const factor = (259 * (con + 255)) / (255 * (259 - con));
    const data = new Uint8ClampedArray(sourceImageData.data);
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];
        if (bri !== 0) { r = clamp(r + bri, 0, 255); g = clamp(g + bri, 0, 255); b = clamp(b + bri, 0, 255); }
        if (con !== 0) { r = clamp(factor * (r - 128) + 128, 0, 255); g = clamp(factor * (g - 128) + 128, 0, 255); b = clamp(factor * (b - 128) + 128, 0, 255); }
        if (sat !== 1.0) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = clamp(gray + sat * (r - gray), 0, 255); g = clamp(gray + sat * (g - gray), 0, 255); b = clamp(gray + sat * (b - gray), 0, 255); }
        data[i] = r; data[i+1] = g; data[i+2] = b;
    }
    return new ImageData(data, sourceImageData.width, sourceImageData.height);
}

// [수정] 색상 추천 로직 (워커 내부에서 실행)
function calculateRecommendations(imageData, activePalette) {
    if (activePalette.length === 0) return [];
    
    // 1. 이미지 색상 분석
    const colorCounts = new Map();
    let totalPixels = 0;
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            const key = `${data[i]},${data[i+1]},${data[i+2]}`;
            colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
            totalPixels++;
        }
    }
    if (totalPixels === 0) return [];

    // 2. 후보군 선정
    const allExistingColors = new Set(activePalette.map(rgb => rgb.join(',')));
    const candidates = [];
    const minCountThreshold = totalPixels * 0.01; // 1% 이상 차지하는 색상만 후보

    for (const [rgbStr, count] of colorCounts.entries()) {
        if (allExistingColors.has(rgbStr)) continue;
        if (count < minCountThreshold) continue;
        
        const originalRgb = JSON.parse(`[${rgbStr}]`);
        const { distance } = findClosestColor(originalRgb[0], originalRgb[1], originalRgb[2], activePalette, null, false);
        
        if (distance > 0) {
            const score = distance * count; // 거리와 빈도를 모두 고려한 점수
            candidates.push({ rgb: originalRgb, score, count, totalPixels });
        }
    }

    // 3. 최종 추천 목록 생성
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 10); // 상위 10개 추천
}


function applyConversion(imageData, palette, options) {
    const paletteOklab = options.highQualityMode ? palette.map(c => ColorConverter.rgbToOklab(c)) : null;
    if (palette.length === 0) {
        const { width, height } = imageData;
        const blackData = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < blackData.length; i+=4) { blackData[i+3] = 255; }
        return new ImageData(blackData, width, height);
    }
    
    const preprocessed = preprocessImageData(imageData, options);
    const { width, height } = preprocessed;
    const newData = new ImageData(width, height);
    const ditherData = new Float32Array(preprocessed.data);
    const ditherStr = options.dithering / 100.0;
    const algorithm = options.algorithm;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (ditherData[i + 3] === 0) { newData.data[i + 3] = 0; continue; }
            
            // [수정] 디더링 버그 해결: findClosestColor에 넣기 전에 값을 0-255로 제한
            const rClamped = clamp(ditherData[i], 0, 255);
            const gClamped = clamp(ditherData[i+1], 0, 255);
            const bClamped = clamp(ditherData[i+2], 0, 255);

            const { color: newRgb } = findClosestColor(rClamped, gClamped, bClamped, palette, paletteOklab, options.highQualityMode);
            [newData.data[i], newData.data[i+1], newData.data[i+2], newData.data[i+3]] = [...newRgb, ditherData[i+3]];
            
            if (ditherStr > 0 && algorithm !== 'none') {
                // 오차 계산은 제한하지 않은 원본 값으로 수행
                const errR = (ditherData[i] - newRgb[0]) * ditherStr;
                const errG = (ditherData[i+1] - newRgb[1]) * ditherStr;
                const errB = (ditherData[i+2] - newRgb[2]) * ditherStr;

                switch(algorithm) {
                    case 'floyd':
                        if (x < width - 1) { ditherData[i + 4] += errR * 7/16; ditherData[i + 5] += errG * 7/16; ditherData[i + 6] += errB * 7/16; }
                        if (y < height - 1) {
                            if (x > 0) { ditherData[i + width*4 - 4] += errR * 3/16; ditherData[i + width*4 - 3] += errG * 3/16; ditherData[i + width*4 - 2] += errB * 3/16; }
                            ditherData[i + width*4] += errR * 5/16; ditherData[i + width*4 + 1] += errG * 5/16; ditherData[i + width*4 + 2] += errB * 5/16;
                            if (x < width - 1) { ditherData[i + width*4 + 4] += errR * 1/16; ditherData[i + width*4 + 5] += errG * 1/16; ditherData[i + width*4 + 6] += errB * 1/16; }
                        }
                        break;
                    case 'sierra':
                        if (x < width - 1) { ditherData[i + 4] += errR * 2/4; ditherData[i + 5] += errG * 2/4; ditherData[i + 6] += errB * 2/4; }
                        if (y < height - 1) {
                            if (x > 0) { ditherData[i + width*4 - 4] += errR * 1/4; ditherData[i + width*4 - 3] += errG * 1/4; ditherData[i + width*4 - 2] += errB * 1/4; }
                            ditherData[i + width*4] += errR * 1/4; ditherData[i + width*4 + 1] += errG * 1/4; ditherData[i + width*4 + 2] += errB * 1/4;
                        }
                        break;
                    case 'atkinson':
                        const factor = 1/8;
                        if (x < width - 1) { ditherData[i + 4] += errR * factor; ditherData[i + 5] += errG * factor; ditherData[i + 6] += errB * factor; }
                        if (x < width - 2) { ditherData[i + 8] += errR * factor; ditherData[i + 9] += errG * factor; ditherData[i + 10] += errB * factor; }
                        if (y < height - 1) {
                            if (x > 0) { ditherData[i + width*4 - 4] += errR * factor; ditherData[i + width*4 - 3] += errG * factor; ditherData[i + width*4 - 2] += errB * factor; }
                            ditherData[i + width*4] += errR * factor; ditherData[i + width*4 + 1] += errG * factor; ditherData[i + width*4 + 2] += errB * factor;
                            if (x < width - 1) { ditherData[i + width*4 + 4] += errR * factor; ditherData[i + width*4 + 5] += errG * factor; ditherData[i + width*4 + 6] += errB * factor; }
                        }
                        if (y < height - 2) { ditherData[i + width*8] += errR * factor; ditherData[i + width*8 + 1] += errG * factor; ditherData[i + width*8 + 2] += errB * factor; }
                        break;
                }
            }
        }
    }
    return newData;
}


self.onmessage = (e) => {
    const { imageData, palette, options, processId } = e.data;
    try {
        // [수정] 색상 추천 계산
        const recommendations = (options.currentMode === 'geopixels')
            ? calculateRecommendations(imageData, palette)
            : [];
        
        const finalImageData = applyConversion(imageData, palette, options);
        
        self.postMessage({ status: 'success', imageData: finalImageData, recommendations: recommendations, processId: processId });
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message, processId: processId });
    }
};