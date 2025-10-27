// worker.js (수정 완료 - 고품질 계산 최적화 적용)

// --- 유틸리티 함수 ---
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// --- 색상 변환 유틸리티 (최적화) ---
const ColorConverter = {
    // 상수 미리 계산
    K_L: 1, K_C: 1, K_H: 1,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,

    srgbToLinear(c) { return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; },
    rgbToOklab(rgb) { const r = this.srgbToLinear(rgb[0] / 255); const g = this.srgbToLinear(rgb[1] / 255); const b = this.srgbToLinear(rgb[2] / 255); const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b; const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b; const l_ = Math.cbrt(l); const m_ = Math.cbrt(m); const s_ = Math.cbrt(s); return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_]; },
    
    deltaE2000(lab1, lab2) {
        const [L1, a1, b1] = lab1;
        const [L2, a2, b2] = lab2;

        const C1 = Math.sqrt(a1 * a1 + b1 * b1);
        const C2 = Math.sqrt(a2 * a2 + b2 * b2);
        const C_bar = (C1 + C2) * 0.5;

        const C_pow7 = Math.pow(C_bar, 7);
        const G = 0.5 * (1 - Math.sqrt(C_pow7 / (C_pow7 + 6103515625))); // 25^7

        const a1_prime = a1 * (1 + G);
        const a2_prime = a2 * (1 + G);

        const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
        const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);
        
        let h1_prime = Math.atan2(b1, a1_prime) * this.RAD_TO_DEG;
        if (h1_prime < 0) h1_prime += 360;
        let h2_prime = Math.atan2(b2, a2_prime) * this.RAD_TO_DEG;
        if (h2_prime < 0) h2_prime += 360;

        const delta_L_prime = L2 - L1;
        const delta_C_prime = C2_prime - C1_prime;

        let delta_h_prime;
        const C_prod_prime = C1_prime * C2_prime;
        if (C_prod_prime === 0) {
            delta_h_prime = 0;
        } else {
            let h_diff = h2_prime - h1_prime;
            if (Math.abs(h_diff) <= 180) {
                delta_h_prime = h_diff;
            } else if (h_diff > 180) {
                delta_h_prime = h_diff - 360;
            } else {
                delta_h_prime = h_diff + 360;
            }
        }
        
        const delta_H_prime = 2 * Math.sqrt(C_prod_prime) * Math.sin(delta_h_prime * this.DEG_TO_RAD * 0.5);

        const L_bar_prime = (L1 + L2) * 0.5;
        const C_bar_prime = (C1_prime + C2_prime) * 0.5;

        let h_bar_prime;
        if (C_prod_prime === 0) {
            h_bar_prime = h1_prime + h2_prime;
        } else {
            const h_sum = h1_prime + h2_prime;
            if (Math.abs(h1_prime - h2_prime) <= 180) {
                h_bar_prime = h_sum * 0.5;
            } else if (h_sum < 360) {
                h_bar_prime = (h_sum + 360) * 0.5;
            } else {
                h_bar_prime = (h_sum - 360) * 0.5;
            }
        }
        
        const T = 1 - 0.17 * Math.cos((h_bar_prime - 30) * this.DEG_TO_RAD) + 0.24 * Math.cos(2 * h_bar_prime * this.DEG_TO_RAD) + 0.32 * Math.cos((3 * h_bar_prime + 6) * this.DEG_TO_RAD) - 0.20 * Math.cos((4 * h_bar_prime - 63) * this.DEG_TO_RAD);
        
        const L_bar_minus_50_sq = (L_bar_prime - 50) * (L_bar_prime - 50);
        const S_L = 1 + (0.015 * L_bar_minus_50_sq) / Math.sqrt(20 + L_bar_minus_50_sq);
        const S_C = 1 + 0.045 * C_bar_prime;
        const S_H = 1 + 0.015 * C_bar_prime * T;

        const C_bar_prime_pow7 = Math.pow(C_bar_prime, 7);
        const R_T = -2 * Math.sqrt(C_bar_prime_pow7 / (C_bar_prime_pow7 + 6103515625)) * Math.sin(60 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2)) * this.DEG_TO_RAD);

        const L_term = delta_L_prime / (this.K_L * S_L);
        const C_term = delta_C_prime / (this.K_C * S_C);
        const H_term = delta_H_prime / (this.K_H * S_H);

        return Math.sqrt(L_term*L_term + C_term*C_term + H_term*H_term + R_T * C_term * H_term);
    },
};

const findClosestColor = (r1, g1, b1, palette, paletteOklab, useHighQuality) => {
    let minDistance = Infinity; // MAX_SAFE_INTEGER 대신 Infinity 사용
    let closestIndex = 0;
    if (useHighQuality && paletteOklab) {
        const targetOklab = ColorConverter.rgbToOklab([r1, g1, b1]);
        for (let i = 0; i < paletteOklab.length; i++) {
            const distance = ColorConverter.deltaE2000(targetOklab, paletteOklab[i]);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
            if (minDistance < 0.001) return { color: palette[closestIndex], distance: minDistance }; // 거의 0에 가까우면 조기 종료
        }
    } else {
        for (let i = 0; i < palette.length; i++) {
            const [r2, g2, b2] = palette[i];
            const rMean = (r1 + r2) * 0.5;
            const r = r1 - r2; const g = g1 - g2; const b = b1 - b2;
            const distance = ((512 + rMean) * r * r) / 256 + 4 * g * g + ((767 - rMean) * b * b) / 256;
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
            if (minDistance < 1) return { color: palette[closestIndex], distance: minDistance }; // 정수 연산이므로 1보다 작으면 거의 0
        }
    }
    return { color: palette[closestIndex], distance: minDistance };
};

// 이하 코드는 이전과 동일...
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

function calculateRecommendations(imageData, activePalette, options) {
    const { highlightSensitivity = 0 } = options;
    if (activePalette.length === 0) return [];
    const { data, width, height } = imageData;
    const colorData = new Map();
    let totalPixels = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] < 128) continue;
            totalPixels++;
            const r1 = data[i], g1 = data[i+1], b1 = data[i+2];
            const key = `${r1},${g1},${b1}`;
            let volatility = 0;
            if (highlightSensitivity > 0) {
                for (let dy = -highlightSensitivity; dy <= highlightSensitivity; dy++) {
                    for (let dx = -highlightSensitivity; dx <= highlightSensitivity; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (Math.abs(dx) + Math.abs(dy) > highlightSensitivity) continue;
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const ni = (ny * width + nx) * 4;
                            const r2 = data[ni], g2 = data[ni+1], b2 = data[ni+2];
                            volatility += (r1 - r2) * (r1 - r2) + (g1 - g2) * (g1 - g2) + (b1 - b2) * (b1 - b2);
                        }
                    }
                }
            }
            if (!colorData.has(key)) {
                colorData.set(key, { count: 0, maxVolatility: 0 });
            }
            const entry = colorData.get(key);
            entry.count++;
            if (volatility > entry.maxVolatility) entry.maxVolatility = volatility;
        }
    }
    if (totalPixels === 0) return [];
    const allExistingColors = new Set(activePalette.map(rgb => rgb.join(',')));
    const candidates = [];
    for (const [rgbStr, stats] of colorData.entries()) {
        if (allExistingColors.has(rgbStr)) continue;
        const originalRgb = JSON.parse(`[${rgbStr}]`);
        const usage = stats.count / totalPixels;
        if (usage > 0.01) {
             candidates.push({ rgb: originalRgb, usage, type: '사용량 높은 색상', score: usage });
             continue;
        }
        const volatilityScore = Math.sqrt(stats.maxVolatility);
        if (highlightSensitivity > 0 && volatilityScore > 1000) {
            candidates.push({ rgb: originalRgb, usage, type: '하이라이트 색상', score: volatilityScore });
        }
    }
    const highUsage = candidates.filter(c => c.type === '사용량 높은 색상').sort((a,b) => b.score - a.score);
    const highlights = candidates.filter(c => c.type === '하이라이트 색상').sort((a,b) => b.score - a.score);
    return [...highUsage.slice(0, 5), ...highlights.slice(0, 5)];
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
            const rClamped = clamp(ditherData[i], 0, 255);
            const gClamped = clamp(ditherData[i+1], 0, 255);
            const bClamped = clamp(ditherData[i+2], 0, 255);
            const { color: newRgb } = findClosestColor(rClamped, gClamped, bClamped, palette, paletteOklab, options.highQualityMode);
            [newData.data[i], newData.data[i+1], newData.data[i+2], newData.data[i+3]] = [...newRgb, ditherData[i+3]];
            if (ditherStr > 0 && algorithm !== 'none') {
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
        const recommendations = (options.currentMode === 'geopixels')
            ? calculateRecommendations(imageData, palette, options)
            : [];
        
        const finalImageData = applyConversion(imageData, palette, options);
        
        self.postMessage({ status: 'success', imageData: finalImageData, recommendations: recommendations, processId: processId });
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message + ' at ' + error.stack, processId: processId });
    }
};