// worker.js (v4.3 - 투명도 그라데이션 기능 추가)

import { THRESHOLD_MAPS } from './threshold-maps.js';

// --- 유틸리티 함수 ---
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const colorDistanceSq = (c1, c2) => ((c1[0] - c2[0]) ** 2) + ((c1[1] - c2[1]) ** 2) + ((c1[2] - c2[2]) ** 2);

// --- 색상 변환 유틸리티 ---
const ColorConverter = {
    K_L: 1, K_C: 1, K_H: 1,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,
    srgbToLinear(c) { return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; },
    rgbToOklab(rgb) { const r = this.srgbToLinear(rgb[0] / 255); const g = this.srgbToLinear(rgb[1] / 255); const b = this.srgbToLinear(rgb[2] / 255); const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b; const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b; const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b; const l_ = Math.cbrt(l); const m_ = Math.cbrt(m); const s_ = Math.cbrt(s); return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_]; },
    deltaE2000(lab1, lab2) {
        const [L1, a1, b1] = lab1; const [L2, a2, b2] = lab2;
        const C1 = Math.sqrt(a1 * a1 + b1 * b1); const C2 = Math.sqrt(a2 * a2 + b2 * b2);
        const C_bar = (C1 + C2) * 0.5; const C_pow7 = Math.pow(C_bar, 7);
        const G = 0.5 * (1 - Math.sqrt(C_pow7 / (C_pow7 + 6103515625)));
        const a1_prime = a1 * (1 + G); const a2_prime = a2 * (1 + G);
        const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
        const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);
        let h1_prime = Math.atan2(b1, a1_prime) * this.RAD_TO_DEG; if (h1_prime < 0) h1_prime += 360;
        let h2_prime = Math.atan2(b2, a2_prime) * this.RAD_TO_DEG; if (h2_prime < 0) h2_prime += 360;
        const delta_L_prime = L2 - L1; const delta_C_prime = C2_prime - C1_prime;
        let delta_h_prime; const C_prod_prime = C1_prime * C2_prime;
        if (C_prod_prime === 0) { delta_h_prime = 0; } else { let h_diff = h2_prime - h1_prime; if (Math.abs(h_diff) <= 180) { delta_h_prime = h_diff; } else if (h_diff > 180) { delta_h_prime = h_diff - 360; } else { delta_h_prime = h_diff + 360; } }
        const delta_H_prime = 2 * Math.sqrt(C_prod_prime) * Math.sin(delta_h_prime * this.DEG_TO_RAD * 0.5);
        const L_bar_prime = (L1 + L2) * 0.5; const C_bar_prime = (C1_prime + C2_prime) * 0.5;
        let h_bar_prime;
        if (C_prod_prime === 0) { h_bar_prime = h1_prime + h2_prime; } else { const h_sum = h1_prime + h2_prime; if (Math.abs(h1_prime - h2_prime) <= 180) { h_bar_prime = h_sum * 0.5; } else if (h_sum < 360) { h_bar_prime = (h_sum + 360) * 0.5; } else { h_bar_prime = (h_sum - 360) * 0.5; } }
        const T = 1 - 0.17 * Math.cos((h_bar_prime - 30) * this.DEG_TO_RAD) + 0.24 * Math.cos(2 * h_bar_prime * this.DEG_TO_RAD) + 0.32 * Math.cos((3 * h_bar_prime + 6) * this.DEG_TO_RAD) - 0.20 * Math.cos((4 * h_bar_prime - 63) * this.DEG_TO_RAD);
        const L_bar_minus_50_sq = (L_bar_prime - 50) * (L_bar_prime - 50);
        const S_L = 1 + (0.015 * L_bar_minus_50_sq) / Math.sqrt(20 + L_bar_minus_50_sq);
        const S_C = 1 + 0.045 * C_bar_prime; const S_H = 1 + 0.015 * C_bar_prime * T;
        const C_bar_prime_pow7 = Math.pow(C_bar_prime, 7);
        const R_T = -2 * Math.sqrt(C_bar_prime_pow7 / (C_bar_prime_pow7 + 6103515625)) * Math.sin(60 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2)) * this.DEG_TO_RAD);
        const L_term = delta_L_prime / (this.K_L * S_L); const C_term = delta_C_prime / (this.K_C * S_C); const H_term = delta_H_prime / (this.K_H * S_H);
        return Math.sqrt(L_term*L_term + C_term*C_term + H_term*H_term + R_T * C_term * H_term);
    },
};

function findTwoClosestColors(r, g, b, palette, paletteOklab, useHighQuality) {
    if (palette.length < 2) { const color = palette[0] || [0, 0, 0]; return { darker: color, brighter: color }; }
    let firstMinDist = Infinity, firstIndex = -1; let secondMinDist = Infinity, secondIndex = -1;
    const targetOklab = useHighQuality ? ColorConverter.rgbToOklab([r, g, b]) : null;
    for (let i = 0; i < palette.length; i++) {
        const dist = useHighQuality ? ColorConverter.deltaE2000(targetOklab, paletteOklab[i]) : colorDistanceSq([r, g, b], palette[i]);
        if (dist < firstMinDist) {
            secondMinDist = firstMinDist; secondIndex = firstIndex;
            firstMinDist = dist; firstIndex = i;
        } else if (dist < secondMinDist) {
            secondMinDist = dist; secondIndex = i;
        }
    }
    const c1 = palette[firstIndex]; const c2 = palette[secondIndex];
    const lum1 = 0.299 * c1[0] + 0.587 * c1[1] + 0.114 * c1[2];
    const lum2 = 0.299 * c2[0] + 0.587 * c2[1] + 0.114 * c2[2];
    return lum1 < lum2 ? { darker: c1, brighter: c2 } : { darker: c2, brighter: c1 };
}

function applyPatternDithering(preprocessedImage, convertedImage, palette, options) {
    const { width, height } = preprocessedImage;
    const { data: preprocessedData } = preprocessedImage;
    const { data: convertedData } = convertedImage;
    const { patternType, highQualityMode, patternSize } = options;
    const resultImageData = new ImageData(width, height);
    const resultData = resultImageData.data;
    const map = THRESHOLD_MAPS[patternType] || THRESHOLD_MAPS.crosshatch;
    const mapHeight = map.length; const mapWidth = map[0].length;
    const paletteOklab = highQualityMode && palette.length > 0 ? palette.map(c => ColorConverter.rgbToOklab(c)) : null;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = preprocessedData[i], g = preprocessedData[i+1], b = preprocessedData[i+2];
            const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
            const c1 = [convertedData[i], convertedData[i+1], convertedData[i+2]];
            const { darker, brighter } = findTwoClosestColors(r, g, b, palette, paletteOklab, highQualityMode);
            const mapX = Math.floor(x / patternSize) % mapWidth;
            const mapY = Math.floor(y / patternSize) % mapHeight;
            const threshold = map[mapY][mapX];
            const c1Luminance = 0.299 * c1[0] + 0.587 * c1[1] + 0.114 * c1[2];
            const darkerLuminance = 0.299 * darker[0] + 0.587 * darker[1] + 0.114 * darker[2];
            const isC1Brighter = Math.abs(c1Luminance - darkerLuminance) > 1;
            const finalColor = (grayscale > threshold) ? (isC1Brighter ? c1 : brighter) : (isC1Brighter ? darker : c1);
            resultData[i] = finalColor[0]; resultData[i + 1] = finalColor[1]; resultData[i + 2] = finalColor[2]; resultData[i + 3] = 255;
        }
    }
    return resultImageData;
}

// [신규] 투명도 그라데이션 적용 함수
function applyGradientTransparency(imageData, options) {
    const { width, height, data } = imageData;
    const { gradientAngle, gradientStrength } = options;

    const angle = gradientAngle;
    const strength = gradientStrength / 100.0;
    
    // 투명도 디더링에 사용할 간단한 4x4 베이어 행렬
    const bayerMatrix = [
        [ 0,  8,  2, 10],
        [12,  4, 14,  6],
        [ 3, 11,  1,  9],
        [15,  7, 13,  5]
    ];
    const bayerFactor = 255 / 16;

    // 그라데이션 계산을 위한 준비
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const centerX = width / 2;
    const centerY = height / 2;
    // 그라데이션의 최대/최소값 계산을 위한 사전 계산
    const corners = [
        (0 - centerX) * cos + (0 - centerY) * sin,
        (width - centerX) * cos + (0 - centerY) * sin,
        (0 - centerX) * cos + (height - centerY) * sin,
        (width - centerX) * cos + (height - centerY) * sin,
    ];
    const minProj = Math.min(...corners);
    const maxProj = Math.max(...corners);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i+3] === 0) continue; // 이미 투명한 픽셀은 건너뜀

            // 1. 픽셀의 그라데이션 값 계산 (0.0 ~ 1.0)
            const projected = (x - centerX) * cos + (y - centerY) * sin;
            let gradientValue = (projected - minProj) / (maxProj - minProj); // 0.0 ~ 1.0
            
            // 2. 강도 적용
            gradientValue = gradientValue * strength;

            // 3. 디더링으로 투명도 결정
            const bayerThreshold = bayerMatrix[y % 4][x % 4] * bayerFactor;
            const transparencyThreshold = gradientValue * 255;

            if (bayerThreshold < transparencyThreshold) {
                data[i + 3] = 0; // 픽셀을 투명하게 만듦
            }
        }
    }
    return imageData; // 원본 데이터를 직접 수정했으므로 그대로 반환
}

function posterizeWithKMeans(imageData, k) {
    const { data, width, height } = imageData; const pixels = [];
    for (let i = 0; i < data.length; i += 4) { if (data[i + 3] > 128) { pixels.push([data[i], data[i + 1], data[i + 2]]); } }
    if (pixels.length === 0) return { centroids: [], posterizedData: imageData };
    let centroids = []; const usedIndices = new Set();
    while (centroids.length < k && centroids.length < pixels.length) { const index = Math.floor(Math.random() * pixels.length); if (!usedIndices.has(index)) { centroids.push(pixels[index]); usedIndices.add(index); } }
    const assignments = new Array(pixels.length); let iterations = 0; let moved = true;
    while (moved && iterations < 20) {
        moved = false;
        for (let i = 0; i < pixels.length; i++) { let minDistance = Infinity; let bestCentroid = 0; for (let j = 0; j < centroids.length; j++) { const distance = colorDistanceSq(pixels[i], centroids[j]); if (distance < minDistance) { minDistance = distance; bestCentroid = j; } } if (assignments[i] !== bestCentroid) { assignments[i] = bestCentroid; moved = true; } }
        const newCentroids = new Array(k).fill(0).map(() => [0, 0, 0]); const counts = new Array(k).fill(0);
        for (let i = 0; i < pixels.length; i++) { const centroidIndex = assignments[i]; newCentroids[centroidIndex][0] += pixels[i][0]; newCentroids[centroidIndex][1] += pixels[i][1]; newCentroids[centroidIndex][2] += pixels[i][2]; counts[centroidIndex]++; }
        for (let i = 0; i < centroids.length; i++) { if (counts[i] > 0) { centroids[i] = [ newCentroids[i][0] / counts[i], newCentroids[i][1] / counts[i], newCentroids[i][2] / counts[i] ]; } }
        iterations++;
    }
    const posterizedData = new ImageData(width, height); let pixelIndex = 0;
    for (let i = 0; i < posterizedData.data.length; i += 4) { if (data[i + 3] > 128) { const centroid = centroids[assignments[pixelIndex++]]; posterizedData.data[i] = centroid[0]; posterizedData.data[i + 1] = centroid[1]; posterizedData.data[i + 2] = centroid[2]; posterizedData.data[i + 3] = 255; } else { posterizedData.data[i + 3] = 0; } }
    const finalCentroids = centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    return { centroids: finalCentroids, posterizedData };
}

function applyCelShadingFilter(imageData, palette, options) {
    const { width, height } = imageData; const { posterizeLevels, showOutline, highQualityMode } = options; const paletteOklab = highQualityMode && palette.length > 0 ? palette.map(c => ColorConverter.rgbToOklab(c)) : null;
    const { centroids: posterColors, posterizedData } = posterizeWithKMeans(imageData, posterizeLevels);
    const finalImageData = new ImageData(width, height); const posterMap = new Map();
    if (palette.length > 0) { for (const pColor of posterColors) { const { color: finalColor } = findClosestColor(pColor[0], pColor[1], pColor[2], palette, paletteOklab, highQualityMode); posterMap.set(pColor.join(','), finalColor); } } else { for (const pColor of posterColors) { posterMap.set(pColor.join(','), pColor); } }
    for (let i = 0; i < posterizedData.data.length; i += 4) { if (posterizedData.data[i + 3] > 0) { const key = [Math.round(posterizedData.data[i]), Math.round(posterizedData.data[i+1]), Math.round(posterizedData.data[i+2])].join(','); const finalColor = posterMap.get(key) || [0,0,0]; finalImageData.data[i] = finalColor[0]; finalImageData.data[i + 1] = finalColor[1]; finalImageData.data[i + 2] = finalColor[2]; finalImageData.data[i + 3] = 255; } else { finalImageData.data[i + 3] = 0; } }
    if (showOutline) {
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1]; const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1]; const edgeData = new Uint8ClampedArray(finalImageData.data);
        for (let y = 1; y < height - 1; y++) { for (let x = 1; x < width - 1; x++) { let gx = 0, gy = 0; for (let ky = -1; ky <= 1; ky++) { for (let kx = -1; kx <= 1; kx++) { const idx = ((y + ky) * width + (x + kx)) * 4; const luminance = edgeData[idx] * 0.299 + edgeData[idx+1] * 0.587 + edgeData[idx+2] * 0.114; gx += luminance * sobelX[(ky + 1) * 3 + (kx + 1)]; gy += luminance * sobelY[(ky + 1) * 3 + (kx + 1)]; } }
            const magnitude = Math.sqrt(gx * gx + gy * gy); if (magnitude > 50) { const mainIdx = (y * width + x) * 4; finalImageData.data[mainIdx] = 0; finalImageData.data[mainIdx + 1] = 0; finalImageData.data[mainIdx + 2] = 0; } } }
    }
    return finalImageData;
}

const findClosestColor = (r1, g1, b1, palette, paletteOklab, useHighQuality) => {
    let minDistance = Infinity; let closestIndex = 0;
    if (useHighQuality && paletteOklab && paletteOklab.length > 0) { const targetOklab = ColorConverter.rgbToOklab([r1, g1, b1]); for (let i = 0; i < paletteOklab.length; i++) { const distance = ColorConverter.deltaE2000(targetOklab, paletteOklab[i]); if (distance < minDistance) { minDistance = distance; closestIndex = i; } if (minDistance < 0.001) return { color: palette[closestIndex], distance: minDistance }; } } else { for (let i = 0; i < palette.length; i++) { const [r2, g2, b2] = palette[i]; const rMean = (r1 + r2) * 0.5; const r = r1 - r2; const g = g1 - g2; const b = b1 - b2; const distance = ((512 + rMean) * r * r) / 256 + 4 * g * g + ((767 - rMean) * b * b) / 256; if (distance < minDistance) { minDistance = distance; closestIndex = i; } if (minDistance < 1) return { color: palette[closestIndex], distance: minDistance }; } }
    return { color: palette[closestIndex] || [0,0,0], distance: minDistance };
};

function preprocessImageData(sourceImageData, options) {
    const { saturation, brightness, contrast } = options; const sat = saturation / 100.0, bri = brightness, con = contrast; const factor = (259 * (con + 255)) / (255 * (259 - con)); const data = new Uint8ClampedArray(sourceImageData.data);
    for (let i = 0; i < data.length; i += 4) { let r = data[i], g = data[i+1], b = data[i+2]; if (bri !== 0) { r = clamp(r + bri, 0, 255); g = clamp(g + bri, 0, 255); b = clamp(b + bri, 0, 255); } if (con !== 0) { r = clamp(factor * (r - 128) + 128, 0, 255); g = clamp(factor * (g - 128) + 128, 0, 255); b = clamp(factor * (b - 128) + 128, 0, 255); } if (sat !== 1.0) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = clamp(gray + sat * (r - gray), 0, 255); g = clamp(gray + sat * (g - gray), 0, 255); b = clamp(gray + sat * (b - gray), 0, 255); } data[i] = r; data[i+1] = g; data[i+2] = b; }
    return new ImageData(data, sourceImageData.width, sourceImageData.height);
}

function calculateRecommendations(imageData, activePalette, options) {
    const { highlightSensitivity = 0 } = options; if (activePalette.length === 0) return []; const { data, width, height } = imageData; const colorData = new Map(); let totalPixels = 0;
    for (let y = 0; y < height; y++) { for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; if (data[i + 3] < 128) continue; totalPixels++; const r1 = data[i], g1 = data[i+1], b1 = data[i+2]; const key = `${r1},${g1},${b1}`; let volatility = 0; if (highlightSensitivity > 0) { for (let dy = -highlightSensitivity; dy <= highlightSensitivity; dy++) { for (let dx = -highlightSensitivity; dx <= highlightSensitivity; dx++) { if (dx === 0 && dy === 0) continue; if (Math.abs(dx) + Math.abs(dy) > highlightSensitivity) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < width && ny >= 0 && ny < height) { const ni = (ny * width + nx) * 4; const r2 = data[ni], g2 = data[ni+1], b2 = data[ni+2]; volatility += (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2; } } } } if (!colorData.has(key)) { colorData.set(key, { count: 0, maxVolatility: 0 }); } const entry = colorData.get(key); entry.count++; if (volatility > entry.maxVolatility) entry.maxVolatility = volatility; } }
    if (totalPixels === 0) return []; const allExistingColors = new Set(activePalette.map(rgb => rgb.join(','))); const candidates = [];
    for (const [rgbStr, stats] of colorData.entries()) { if (allExistingColors.has(rgbStr)) continue; const originalRgb = JSON.parse(`[${rgbStr}]`); const usage = stats.count / totalPixels; if (usage > 0.01) { candidates.push({ rgb: originalRgb, usage, type: '사용량 높은 색상', score: usage }); continue; } const volatilityScore = Math.sqrt(stats.maxVolatility); if (highlightSensitivity > 0 && volatilityScore > 1000) { candidates.push({ rgb: originalRgb, usage, type: '하이라이트 색상', score: volatilityScore }); } }
    const highUsage = candidates.filter(c => c.type === '사용량 높은 색상').sort((a,b) => b.score - a.score); const highlights = candidates.filter(c => c.type === '하이라이트 색상').sort((a,b) => b.score - a.score);
    return [...highUsage.slice(0, 5), ...highlights.slice(0, 5)];
}

function applyConversion(imageData, palette, options) {
    const paletteOklab = options.highQualityMode && palette.length > 0 ? palette.map(c => ColorConverter.rgbToOklab(c)) : null; if (palette.length === 0) { const { width, height } = imageData; const blackData = new Uint8ClampedArray(width * height * 4); for (let i = 0; i < blackData.length; i+=4) { blackData[i+3] = 255; } return new ImageData(blackData, width, height); }
    const { width, height } = imageData; const newData = new ImageData(width, height); const ditherData = new Float32Array(imageData.data); const ditherStr = options.dithering / 100.0; const algorithm = options.algorithm;
    for (let y = 0; y < height; y++) { for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; if (ditherData[i + 3] < 128) { newData.data[i + 3] = 0; continue; }
            const rClamped = clamp(ditherData[i], 0, 255); const gClamped = clamp(ditherData[i+1], 0, 255); const bClamped = clamp(ditherData[i+2], 0, 255);
            const { color: newRgb } = findClosestColor(rClamped, gClamped, bClamped, palette, paletteOklab, options.highQualityMode);
            [newData.data[i], newData.data[i+1], newData.data[i+2], newData.data[i+3]] = [...newRgb, ditherData[i+3]];
            if (ditherStr > 0 && algorithm !== 'none') { const errR = (ditherData[i] - newRgb[0]) * ditherStr; const errG = (ditherData[i+1] - newRgb[1]) * ditherStr; const errB = (ditherData[i+2] - newRgb[2]) * ditherStr;
                switch(algorithm) {
                    case 'floyd': if (x < width - 1) { ditherData[i + 4] += errR * 7/16; ditherData[i + 5] += errG * 7/16; ditherData[i + 6] += errB * 7/16; } if (y < height - 1) { if (x > 0) { ditherData[i + width*4 - 4] += errR * 3/16; ditherData[i + width*4 - 3] += errG * 3/16; ditherData[i + width*4 - 2] += errB * 3/16; } ditherData[i + width*4] += errR * 5/16; ditherData[i + width*4 + 1] += errG * 5/16; ditherData[i + width*4 + 2] += errB * 5/16; if (x < width - 1) { ditherData[i + width*4 + 4] += errR * 1/16; ditherData[i + width*4 + 5] += errG * 1/16; ditherData[i + width*4 + 6] += errB * 1/16; } } break;
                    case 'sierra': if (x < width - 1) { ditherData[i + 4] += errR * 2/4; ditherData[i + 5] += errG * 2/4; ditherData[i + 6] += errB * 2/4; } if (y < height - 1) { if (x > 0) { ditherData[i + width*4 - 4] += errR * 1/4; ditherData[i + width*4 - 3] += errG * 1/4; ditherData[i + width*4 - 2] += errB * 1/4; } ditherData[i + width*4] += errR * 1/4; ditherData[i + width*4 + 1] += errG * 1/4; ditherData[i + width*4 + 2] += errB * 1/4; } break;
                    case 'atkinson': const factor = 1/8; if (x < width - 1) { ditherData[i + 4] += errR * factor; ditherData[i + 5] += errG * factor; ditherData[i + 6] += errB * factor; } if (x < width - 2) { ditherData[i + 8] += errR * factor; ditherData[i + 9] += errG * factor; ditherData[i + 10] += errB * factor; } if (y < height - 1) { if (x > 0) { ditherData[i + width*4 - 4] += errR * factor; ditherData[i + width*4 - 3] += errG * factor; ditherData[i + width*4 - 2] += errB * factor; } ditherData[i + width*4] += errR * factor; ditherData[i + width*4 + 1] += errG * factor; ditherData[i + width*4 + 2] += errB * factor; if (x < width - 1) { ditherData[i + width*4 + 4] += errR * factor; ditherData[i + width*4 + 5] += errG * factor; ditherData[i + width*4 + 6] += errB * factor; } } if (y < height - 2) { ditherData[i + width*8] += errR * factor; ditherData[i + width*8 + 1] += errG * factor; ditherData[i + width*8 + 2] += errB * factor; } break;
                }
            }
        }
    }
    return newData;
}

self.onmessage = (e) => {
    const { imageData, palette, options, processId } = e.data;
    try {
        let finalImageData;
        const preprocessedData = preprocessImageData(imageData, options);
        if (options.edgeCleanup) {
            finalImageData = applyCelShadingFilter(preprocessedData, palette, options);
        } else {
            // 1. 먼저 일반 변환(디더링 포함)을 수행
            const convertedImage = applyConversion(preprocessedData, palette, options);

            // 2. 사용자가 패턴 적용을 원하면, 그 위에 패턴 디더링을 한 번 더 적용
            if (options.applyPattern) {
                // 패턴 디더링은 '원본 명도'를 사용해야 하므로 preprocessedData를,
                // 색상 선택의 기준이 될 이미지는 convertedImage를 전달
                finalImageData = applyPatternDithering(preprocessedData, convertedImage, palette, options);
            } else {
                finalImageData = convertedImage;
            }
        }
        
        // [신규] 모든 작업이 끝난 후, 그라데이션 투명도를 마지막으로 적용
        if (options.applyGradient && options.gradientStrength > 0) {
            finalImageData = applyGradientTransparency(finalImageData, options);
        }

        const recommendations = (options.currentMode === 'geopixels') ? calculateRecommendations(imageData, palette, options) : [];
        self.postMessage({ status: 'success', imageData: finalImageData, recommendations: recommendations, processId: processId }, [finalImageData.data.buffer]);
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message + ' at ' + error.stack, processId: processId });
    }
};