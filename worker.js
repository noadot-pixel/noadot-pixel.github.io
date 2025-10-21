// NoaDot v4.1 - 워커 스크립트 (핵심 연산)
// 변경: v2.1의 findClosestColor 알고리즘으로 복귀, '자동 톤 보정' 로직 추가

// --- 색상 변환 유틸리티 ---
const ColorConverter = {
    srgbToLinear(c) { return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; },
    rgbToOklab(rgb) { const r = this.srgbToLinear(rgb[0] / 255); const g = this.srgbToLinear(rgb[1] / 255); const b = this.srgbToLinear(rgb[2] / 255); const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b; const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b; const l_ = Math.cbrt(l); const m_ = Math.cbrt(m); const s_ = Math.cbrt(s); return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_]; },
    deltaE2000(lab1, lab2) { const L1 = lab1[0], a1 = lab1[1], b1 = lab1[2]; const L2 = lab2[0], a2 = lab2[1], b2 = lab2[2]; const kL = 1, kC = 1, kH = 1; const C1 = Math.sqrt(a1 * a1 + b1 * b1); const C2 = Math.sqrt(a2 * a2 + b2 * b2); const C_bar = (C1 + C2) / 2; const G = 0.5 * (1 - Math.sqrt(Math.pow(C_bar, 7) / (Math.pow(C_bar, 7) + Math.pow(25, 7)))); const a1_prime = a1 * (1 + G); const a2_prime = a2 * (1 + G); const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1); const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2); const h1_prime = (Math.atan2(b1, a1_prime) * 180 / Math.PI + 360) % 360; const h2_prime = (Math.atan2(b2, a2_prime) * 180 / Math.PI + 360) % 360; const delta_L_prime = L2 - L1; const delta_C_prime = C2_prime - C1_prime; let delta_h_prime; if (C1_prime * C2_prime === 0) { delta_h_prime = 0; } else if (Math.abs(h2_prime - h1_prime) <= 180) { delta_h_prime = h2_prime - h1_prime; } else if (h2_prime - h1_prime > 180) { delta_h_prime = h2_prime - h1_prime - 360; } else { delta_h_prime = h2_prime - h1_prime + 360; } const delta_H_prime = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin((delta_h_prime * Math.PI / 180) / 2); const L_bar_prime = (L1 + L2) / 2; const C_bar_prime = (C1_prime + C2_prime) / 2; let h_bar_prime; if (C1_prime * C2_prime === 0) { h_bar_prime = h1_prime + h2_prime; } else if (Math.abs(h1_prime - h2_prime) <= 180) { h_bar_prime = (h1_prime + h2_prime) / 2; } else if (h1_prime + h2_prime < 360) { h_bar_prime = (h1_prime + h2_prime + 360) / 2; } else { h_bar_prime = (h1_prime + h2_prime - 360) / 2; } const T = 1 - 0.17 * Math.cos((h_bar_prime - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * h_bar_prime * Math.PI / 180) + 0.32 * Math.cos(3 * h_bar_prime * Math.PI / 180 + 6 * Math.PI / 180) - 0.20 * Math.cos(4 * h_bar_prime * Math.PI / 180 - 63 * Math.PI / 180); const S_L = 1 + (0.015 * Math.pow(L_bar_prime - 50, 2)) / Math.sqrt(20 + Math.pow(L_bar_prime - 50, 2)); const S_C = 1 + 0.045 * C_bar_prime; const S_H = 1 + 0.015 * C_bar_prime * T; const R_T = -2 * Math.sqrt(Math.pow(C_bar_prime, 7) / (Math.pow(C_bar_prime, 7) + Math.pow(25, 7))) * Math.sin(60 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2)) * Math.PI / 180); const L_term = delta_L_prime / (kL * S_L); const C_term = delta_C_prime / (kC * S_C); const H_term = delta_H_prime / (kH * S_H); return Math.sqrt(L_term * L_term + C_term * C_term + H_term * H_term + R_T * (C_term * H_term)); },
    rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0, l = (max + min) / 2; if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h /= 6; } return [h, s, l]; },
    hslToRgb(h, s, l) { let r, g, b; if (s === 0) { r = g = b = l; } else { const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; }; const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3); } return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]; }
};

// [v4.1 복원] v2.1의 findClosestColor 알고리즘
const findClosestColor = (r1, g1, b1, palette, paletteOklab, useHighQuality) => {
    let minDistance = Number.MAX_SAFE_INTEGER;
    let closestColor = palette[0];
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

// --- 신규 알고리즘 함수 ---

function preprocess(imageData, options) {
    const { saturation, brightness, contrast } = options;
    const sat = saturation / 100.0, bri = brightness, con = contrast;
    const factor = (259 * (con + 255)) / (255 * (259 - con));
    const data = new Uint8ClampedArray(imageData.data);
    const clamp = (value) => Math.max(0, Math.min(255, value));
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];
        if (bri !== 0) { r = clamp(r + bri); g = clamp(g + bri); b = clamp(b + bri); }
        if (con !== 0) { r = clamp(factor * (r - 128) + 128); g = clamp(factor * (g - 128) + 128); b = clamp(factor * (b - 128) + 128); }
        if (sat !== 1.0) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = clamp(gray + sat * (r - gray)); g = clamp(gray + sat * (g - gray)); b = clamp(gray + sat * (b - gray)); }
        data[i] = r; data[i+1] = g; data[i+2] = b;
    }
    return new ImageData(data, imageData.width, imageData.height);
}

function applyAutoToneCorrection(imageData, palette, paletteOklab) {
    // 1. 지배 색상 분석
    const colorCounts = new Map();
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] > 128) {
            const key = `${imageData.data[i]},${imageData.data[i+1]},${imageData.data[i+2]}`;
            colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
        }
    }
    if (colorCounts.size === 0) return imageData;
    let dominantColorStr = ''; let maxCount = 0;
    for (const [color, count] of colorCounts.entries()) {
        if (count > maxCount) { maxCount = count; dominantColorStr = color; }
    }
    const dominantColor = dominantColorStr.split(',').map(Number);
    
    // 2. 매칭 품질 진단
    const { color: closestPaletteColor } = findClosestColor(dominantColor[0], dominantColor[1], dominantColor[2], palette, paletteOklab, true);
    const diff = ColorConverter.deltaE2000(ColorConverter.rgbToOklab(dominantColor), ColorConverter.rgbToOklab(closestPaletteColor));
    const CORRECTION_THRESHOLD = 15;
    if (diff < CORRECTION_THRESHOLD) return imageData;

    // 3. 보정값 계산
    const dominantHSL = ColorConverter.rgbToHsl(...dominantColor);
    const targetHSL = ColorConverter.rgbToHsl(...closestPaletteColor);
    const deltaS = targetHSL[1] - dominantHSL[1];
    const deltaL = targetHSL[2] - dominantHSL[2];
    
    // 4. 전체 이미지에 보정 적용
    const correctedData = new Uint8ClampedArray(imageData.data);
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    for (let i = 0; i < correctedData.length; i += 4) {
        const [h, s, l] = ColorConverter.rgbToHsl(correctedData[i], correctedData[i+1], correctedData[i+2]);
        const newS = clamp(s + deltaS, 0, 1);
        const newL = clamp(l + deltaL, 0, 1);
        const [r, g, b] = ColorConverter.hslToRgb(h, newS, newL);
        correctedData[i] = r; correctedData[i+1] = g; correctedData[i+2] = b;
    }
    return new ImageData(correctedData, imageData.width, imageData.height);
}

// --- 핵심 변환 함수 ---
function applyConversion(imageData, palette, options) {
    const paletteOklab = options.highQualityMode ? palette.map(c => ColorConverter.rgbToOklab(c)) : null;
    const { width, height } = imageData;
    const newData = new ImageData(width, height);
    const ditherData = new Float32Array(imageData.data);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (ditherData[i + 3] === 0) { newData.data[i + 3] = 0; continue; }
            const [oldR, oldG, oldB] = [ditherData[i], ditherData[i + 1], ditherData[i + 2]];
            const { color: newRgb, distance } = findClosestColor(oldR, oldG, oldB, palette, paletteOklab, options.highQualityMode);
            [newData.data[i], newData.data[i+1], newData.data[i+2], newData.data[i+3]] = [...newRgb, 255];
            if (options.ditheringStrength > 0 && options.ditheringAlgorithm !== 'none') {
                const errR = (oldR - newRgb[0]) * (options.ditheringStrength / 100.0);
                const errG = (oldG - newRgb[1]) * (options.ditheringStrength / 100.0);
                const errB = (oldB - newRgb[2]) * (options.ditheringStrength / 100.0);
                // 디더링 로직 (생략 - 기존과 동일)
                switch(options.ditheringAlgorithm) {
                    case 'floyd': if (x < width - 1) { ditherData[i + 4] += errR * 7/16; ditherData[i + 5] += errG * 7/16; ditherData[i + 6] += errB * 7/16; } if (y < height - 1) { if (x > 0) { ditherData[i + width*4 - 4] += errR * 3/16; ditherData[i + width*4 - 3] += errG * 3/16; ditherData[i + width*4 - 2] += errB * 3/16; } ditherData[i + width*4] += errR * 5/16; ditherData[i + width*4 + 1] += errG * 5/16; ditherData[i + width*4 + 2] += errB * 5/16; if (x < width - 1) { ditherData[i + width*4 + 4] += errR * 1/16; ditherData[i + width*4 + 5] += errG * 1/16; ditherData[i + width*4 + 6] += errB * 1/16; } } break;
                    /* 다른 디더링 알고리즘... */
                }
            }
        }
    }
    return newData;
}

// --- 워커의 메인 로직 ---
self.onmessage = (e) => {
    const { imageData, palette, options } = e.data;
    try {
        let dataToProcess = imageData;
        const paletteOklab = options.highQualityMode ? palette.map(c => ColorConverter.rgbToOklab(c)) : null;

        // 알고리즘 파이프라인
        // TODO: Region Merging (미구현)
        // TODO: Structure Preservation (미구현)
        
        // 자동 톤 보정 (신규)
        if (options.autoToneCorrection && options.ditheringAlgorithm === 'none') {
            dataToProcess = applyAutoToneCorrection(dataToProcess, palette, paletteOklab);
        }

        // 수동 톤 보정 (복원)
        dataToProcess = preprocess(dataToProcess, options);
        
        const finalImageData = applyConversion(dataToProcess, palette, options);
        self.postMessage({ status: 'success', imageData: finalImageData });
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message });
    }
};