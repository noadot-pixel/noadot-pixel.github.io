// js/worker/image-worker.js

import { THRESHOLD_MAPS } from '../../data/patterns.js'; 
import { clamp, ColorConverter, findClosestColor, findTwoClosestColors } from './color.js';
import { preprocessImageData } from './quantization.js';
import { analyzeImageFeatures, calculateRecommendations, getStyleRecipesByTags } from './analysis.js';
import { upscaleEPX2x, upscaleEPX3x } from './upscale.js';

// ========== 1. 내부 헬퍼 함수들 ==========

function resizeImageData(imageData, targetWidth) {
    const { width, height, data } = imageData;
    if (width <= targetWidth) return imageData;
    const ratio = targetWidth / width;
    const targetHeight = Math.round(height * ratio);
    const newData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const srcX = Math.floor(x / ratio);
            const srcY = Math.floor(y / ratio);
            const srcIdx = (srcY * width + srcX) * 4;
            const destIdx = (y * targetWidth + x) * 4;
            newData[destIdx] = data[srcIdx];
            newData[destIdx + 1] = data[srcIdx + 1];
            newData[destIdx + 2] = data[srcIdx + 2];
            newData[destIdx + 3] = data[srcIdx + 3];
        }
    }
    return new ImageData(newData, targetWidth, targetHeight);
}

// RGB -> Lab 변환 (Wdot 최적화용)
function rgbToLabRaw(r, g, b) {
    let rN = r / 255, gN = g / 255, bN = b / 255;
    rN = (rN > 0.04045) ? Math.pow((rN + 0.055) / 1.055, 2.4) : rN / 12.92;
    gN = (gN > 0.04045) ? Math.pow((gN + 0.055) / 1.055, 2.4) : gN / 12.92;
    bN = (bN > 0.04045) ? Math.pow((bN + 0.055) / 1.055, 2.4) : bN / 12.92;
    let X = rN * 0.4124 + gN * 0.3576 + bN * 0.1805;
    let Y = rN * 0.2126 + gN * 0.7152 + bN * 0.0722;
    let Z = rN * 0.0193 + gN * 0.1192 + bN * 0.9505;
    X /= 0.95047; Y /= 1.00000; Z /= 1.08883;
    X = (X > 0.008856) ? Math.pow(X, 1/3) : (7.787 * X) + 16/116;
    Y = (Y > 0.008856) ? Math.pow(Y, 1/3) : (7.787 * Y) + 16/116;
    Z = (Z > 0.008856) ? Math.pow(Z, 1/3) : (7.787 * Z) + 16/116;
    return { L: (116 * Y) - 16, a: 500 * (X - Y), b: 200 * (Y - Z) };
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
            const r = preprocessedData[i], g = preprocessedData[i + 1], b = preprocessedData[i + 2];
            const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
            const c1 = [convertedData[i], convertedData[i + 1], convertedData[i + 2]];
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

function applyGradientTransparency(imageData, options) {
    const { width, height, data } = imageData;
    const { gradientAngle, gradientStrength } = options;
    const strength = gradientStrength / 100.0;
    const bayerMatrix = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    const bayerFactor = 255 / 16;
    const rad = gradientAngle * Math.PI / 180; const cos = Math.cos(rad); const sin = Math.sin(rad);
    const centerX = width / 2; const centerY = height / 2;
    const corners = [(0 - centerX) * cos + (0 - centerY) * sin, (width - centerX) * cos + (0 - centerY) * sin, (0 - centerX) * cos + (height - centerY) * sin, (width - centerX) * cos + (height - centerY) * sin];
    const minProj = Math.min(...corners); const maxProj = Math.max(...corners);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] === 0) continue;
            const projected = (x - centerX) * cos + (y - centerY) * sin;
            let gradientValue = (projected - minProj) / (maxProj - minProj);
            gradientValue = gradientValue * strength;
            const bayerThreshold = bayerMatrix[y % 4][x % 4] * bayerFactor;
            if (bayerThreshold < gradientValue * 255) { data[i + 3] = 0; }
        }
    }
    return imageData;
}

function applyConversion(imageData, palette, options) {
    if (!palette) palette = []; 
    const { width, height } = imageData;
    if (palette.length === 0) return new ImageData(new Uint8ClampedArray(width * height * 4).fill(0), width, height);
    
    let paletteConverted = null;
    if (options.colorMethod === 'ciede2000' || options.colorMethod === 'wdot') {
        paletteConverted = palette.map(c => rgbToLabRaw(c[0], c[1], c[2]));
    } else if (options.colorMethod === 'oklab' || options.highQualityMode) {
        paletteConverted = palette.map(c => ColorConverter.rgbToOklab(c));
    }

    const newData = new ImageData(width, height);
    const ditherData = new Float32Array(imageData.data); 
    const ditherStr = options.dithering / 100.0;
    const algorithm = options.algorithm;
    
    const colorCache = new Map();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (ditherData[i + 3] < 128) { newData.data[i + 3] = 0; continue; }
            
            const rClamped = clamp(ditherData[i], 0, 255);
            const gClamped = clamp(ditherData[i + 1], 0, 255);
            const bClamped = clamp(ditherData[i + 2], 0, 255);
            
            const colorKey = (rClamped << 16) | (gClamped << 8) | bClamped;
            let newRgb;

            if (colorCache.has(colorKey)) {
                newRgb = colorCache.get(colorKey);
            } else {
                if ((options.colorMethod === 'ciede2000' || options.colorMethod === 'wdot') && paletteConverted) {
                     const inputLab = rgbToLabRaw(rClamped, gClamped, bClamped);
                     newRgb = findNearestWdot(inputLab, palette, paletteConverted);
                } else {
                     const { color } = findClosestColor(
                        rClamped, gClamped, bClamped, palette, paletteConverted, options.colorMethod 
                    );
                    newRgb = color;
                }
                colorCache.set(colorKey, newRgb);
            }
            
            newData.data[i] = newRgb[0]; newData.data[i+1] = newRgb[1]; newData.data[i+2] = newRgb[2]; newData.data[i+3] = 255; 
            
            if (ditherStr > 0 && algorithm !== 'none') {
                const errR = (ditherData[i] - newRgb[0]) * ditherStr;
                const errG = (ditherData[i + 1] - newRgb[1]) * ditherStr;
                const errB = (ditherData[i + 2] - newRgb[2]) * ditherStr;
                const distributeError = (idx, amount) => { ditherData[idx] += errR * amount; ditherData[idx + 1] += errG * amount; ditherData[idx + 2] += errB * amount; };
                if (algorithm === 'floyd') {
                    if (x < width - 1) distributeError(i + 4, 7 / 16);
                    if (y < height - 1) { if (x > 0) distributeError(i + width * 4 - 4, 3 / 16); distributeError(i + width * 4, 5 / 16); if (x < width - 1) distributeError(i + width * 4 + 4, 1 / 16); }
                } else if (algorithm === 'atkinson') {
                    const f = 1/8;
                    if (x < width - 1) distributeError(i + 4, f); if (x < width - 2) distributeError(i + 8, f);
                    if (y < height - 1) { if (x > 0) distributeError(i + width * 4 - 4, f); distributeError(i + width * 4, f); if (x < width - 1) distributeError(i + width * 4 + 4, f); }
                    if (y < height - 2) distributeError(i + width * 8, f);
                } else if (algorithm === 'sierra') {
                    if (x < width - 1) distributeError(i + 4, 2/4); if (y < height - 1) { if (x > 0) distributeError(i + width * 4 - 4, 1/4); distributeError(i + width * 4, 1/4); }
                }
            }
        }
    }
    colorCache.clear();
    return newData;
}

// ========== 2. 메인 이벤트 핸들러 ==========

self.onmessage = async (e) => {
    const { type, imageData, palette, allPaletteColors, options, processId, extraPresets, onlyCustom } = e.data;

    if (type === 'upscaleImage') {
        try {
            const { scale } = e.data;
            let upscaledData;
            if (scale === 3) upscaledData = upscaleEPX3x(imageData);
            else upscaledData = upscaleEPX2x(imageData);
            self.postMessage({ status: 'success', type: 'upscaleResult', imageData: upscaledData, processId: processId, scale: scale }, [upscaledData.data.buffer]);
        } catch (error) { self.postMessage({ status: 'error', message: '업스케일 오류: ' + error.message }); }
        return;
    }

    if (type === 'getStyleRecommendations') {
        try {
            const { extraPresets, onlyCustom } = e.data; 
            let categorizedRecipes;
            if (onlyCustom) {
                categorizedRecipes = { fixed: extraPresets || [], recommended: [], others: [] };
            } else {
                // 200만 픽셀 대신 4000개 샘플로 분석
                const imageFeatures = analyzeImageFeaturesOptimized(imageData);
                categorizedRecipes = getStyleRecipesByTags(imageFeatures);
                if (extraPresets && Array.isArray(extraPresets)) { categorizedRecipes.fixed = [...extraPresets, ...categorizedRecipes.fixed]; }
            }
            
            const smallImage = resizeImageData(imageData, 150);
            const recommendationResults = { fixed: [], recommended: [], others: [] };
            const generateThumbnails = async (recipes, category) => {
                for (const recipe of recipes) {
                    const thumbImageData = new ImageData(new Uint8ClampedArray(smallImage.data), smallImage.width, smallImage.height);
                    const baseOptions = JSON.parse(JSON.stringify(options));
                    baseOptions.celShading = { apply: false, levels: 8, outline: false }; 
                    baseOptions.applyPattern = false; baseOptions.applyGradient = false; baseOptions.dithering = 0; 
                    baseOptions.algorithm = 'atkinson'; baseOptions.saturation = 100; baseOptions.brightness = 0; baseOptions.contrast = 0;
                    
                    const presetValues = recipe.preset;
                    const applyMap = (pkey, lkey) => { if (typeof presetValues[pkey] !== 'undefined') baseOptions[lkey] = presetValues[pkey]; };
                    applyMap('saturationSlider', 'saturation'); applyMap('brightnessSlider', 'brightness'); applyMap('contrastSlider', 'contrast');
                    applyMap('ditheringSlider', 'dithering'); applyMap('ditheringAlgorithmSelect', 'algorithm');
                    applyMap('applyPattern', 'applyPattern'); applyMap('patternTypeSelect', 'patternType'); applyMap('patternSizeSlider', 'patternSize');
                    applyMap('applyGradient', 'applyGradient'); applyMap('gradientAngleSlider', 'gradientAngle'); applyMap('gradientStrengthSlider', 'gradientStrength');
                    if (typeof presetValues.highQualityMode !== 'undefined') baseOptions.highQualityMode = presetValues.highQualityMode;
                    if (typeof presetValues.pixelatedScaling !== 'undefined') baseOptions.pixelatedScaling = presetValues.pixelatedScaling;
                    if (presetValues.celShading) {
                        baseOptions.celShading = { ...baseOptions.celShading, ...presetValues.celShading };
                        if (typeof baseOptions.celShading.outlineColor === 'string') {
                            const hex = baseOptions.celShading.outlineColor.replace('#', '');
                            const bigint = parseInt(hex, 16);
                            baseOptions.celShading.outlineColor = [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
                        }
                    }

                    let usePalette = [];
                    if (presetValues.enablePaletteColors) {
                        const currentMode = baseOptions.currentMode || 'geopixels';
                        const targetColors = presetValues.enablePaletteColors[currentMode];
                        if (targetColors && Array.isArray(targetColors)) {
                            usePalette = targetColors.map(hex => {
                                const h = hex.replace('#', ''); const i = parseInt(h, 16);
                                return [(i >> 16) & 255, (i >> 8) & 255, i & 255];
                            });
                        }
                    }
                    if (usePalette.length === 0) {
                        if (palette && palette.length > 0) usePalette = palette;
                        else usePalette = [[0,0,0], [255,255,255], [128,128,128]];
                    }

                    let finalThumb;
                    const processedThumb = preprocessImageData(thumbImageData, baseOptions);
                    if (baseOptions.celShading && baseOptions.celShading.apply) {
                        // 썸네일 생성 시에도 팔레트 우선 적용 함수 사용
                        finalThumb = applyCelShadingFilterOptimized(processedThumb, usePalette, baseOptions);
                    } else {
                        finalThumb = applyConversion(processedThumb, usePalette, baseOptions);
                        if (baseOptions.applyPattern) finalThumb = applyPatternDithering(processedThumb, finalThumb, usePalette, baseOptions);
                    }
                    recommendationResults[category].push({ thumbnailData: finalThumb, name: recipe.name, preset: recipe.preset, ranking: recipe.ranking, tags: recipe.tags, displayTag: recipe.displayTag });
                }
            };
            await generateThumbnails(categorizedRecipes.fixed, 'fixed');
            await generateThumbnails(categorizedRecipes.recommended, 'recommended');
            await generateThumbnails(categorizedRecipes.others, 'others');
            self.postMessage({ status: 'success', type: 'recommendationResult', results: recommendationResults, processId: processId });
        } catch (error) { self.postMessage({ status: 'error', message: `스타일 추천 생성 중 오류: ${error.message}`, type: 'recommendationError', processId: processId }); }
        return;
    }

    try {
        let finalImageData;
        if (!palette || palette.length === 0) {
            const emptyData = new Uint8ClampedArray(imageData.width * imageData.height * 4);
            for (let i = 0; i < emptyData.length; i += 4) { emptyData[i + 3] = 255; } 
            finalImageData = new ImageData(emptyData, imageData.width, imageData.height);
        } else {
            const preprocessedData = preprocessImageData(imageData, options);
            
            if (options.celShading && options.celShading.apply) {
                // [핵심] 팔레트가 있으면 팔레트 사용, 없으면 추출 (수정됨)
                finalImageData = applyCelShadingFilterOptimized(preprocessedData, palette, options);
            } else {
                const convertedImage = applyConversion(preprocessedData, palette, options);
                if (options.applyPattern) finalImageData = applyPatternDithering(preprocessedData, convertedImage, palette, options); 
                else finalImageData = convertedImage; 
            }
            if (options.applyGradient && options.gradientStrength > 0) finalImageData = applyGradientTransparency(finalImageData, options);
        }

        const recommendations = (options.currentMode === 'geopixels') ? calculateRecommendations(imageData, palette || [], options) : [];
        
        const usageMap = new Map();
        if (allPaletteColors && palette && palette.length > 0) {
            allPaletteColors.forEach(colorStr => usageMap.set(colorStr, 0));
            const finalData = finalImageData.data;
            for (let i = 0; i < finalData.length; i += 4) { 
                if (finalData[i + 3] > 128) { 
                    const key = `${finalData[i]},${finalData[i + 1]},${finalData[i + 2]}`; 
                    if (usageMap.has(key)) { usageMap.set(key, usageMap.get(key) + 1); } 
                } 
            }
        }
        self.postMessage({ status: 'success', type: 'conversionResult', imageData: finalImageData, recommendations, usageMap: Object.fromEntries(usageMap), processId: processId }, [finalImageData.data.buffer]);
    } catch (error) { self.postMessage({ status: 'error', message: error.message + ' at ' + error.stack, processId: processId }); }
};


// ============================================================
// 3. Wdot(CIEDE2000) & 만화 필터 최적화 로직 (내부 내장)
// ============================================================

function applyCelShadingFilterOptimized(imageData, palette, options) {
    const { levels, outline, outlineThreshold, outlineColor, randomSeed } = options.celShading;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    let clusterColors;

    // [수정] 1. 팔레트가 있으면 우선 사용! (GeoPixels/Wplace 모드)
    if (palette && palette.length > 0) {
        clusterColors = palette;
    } else {
        // 2. 없으면 자체 추출 (Hybrid Wu + K-Means)
        clusterColors = runHybridQuantization(imageData, levels || 8, randomSeed);
    }

    const quantizedData = new Uint8ClampedArray(data.length);
    const colorCache = new Map(); 
    
    for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] < 128) { quantizedData[i+3] = 0; continue; }
        
        const r = data[i], g = data[i+1], b = data[i+2];
        const key = (r << 16) | (g << 8) | b;
        
        let bestColor;
        if (colorCache.has(key)) {
            bestColor = colorCache.get(key);
        } else {
            let minDist = Infinity;
            for (let c = 0; c < clusterColors.length; c++) {
                const cc = clusterColors[c];
                const dist = (r - cc[0])**2 + (g - cc[1])**2 + (b - cc[2])**2;
                if (dist < minDist) { minDist = dist; bestColor = cc; }
            }
            colorCache.set(key, bestColor);
        }
        
        quantizedData[i] = bestColor[0];
        quantizedData[i+1] = bestColor[1];
        quantizedData[i+2] = bestColor[2];
        quantizedData[i+3] = 255;
    }
    
    if (outline) {
        const outR = outlineColor ? outlineColor[0] : 0;
        const outG = outlineColor ? outlineColor[1] : 0;
        const outB = outlineColor ? outlineColor[2] : 0;
        const thresholdSq = outlineThreshold * outlineThreshold;
        const tempBuffer = new Uint8ClampedArray(quantizedData);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                if (tempBuffer[i+3] === 0) continue;
                let isEdge = false;
                if (x < width - 1) {
                    const next = i + 4;
                    const dist = (tempBuffer[i] - tempBuffer[next])**2 + (tempBuffer[i+1] - tempBuffer[next+1])**2 + (tempBuffer[i+2] - tempBuffer[next+2])**2;
                    if (dist > thresholdSq) isEdge = true;
                }
                if (!isEdge && y < height - 1) {
                    const down = i + width * 4;
                    const dist = (tempBuffer[i] - tempBuffer[down])**2 + (tempBuffer[i+1] - tempBuffer[down+1])**2 + (tempBuffer[i+2] - tempBuffer[down+2])**2;
                    if (dist > thresholdSq) isEdge = true;
                }
                if (isEdge) { quantizedData[i] = outR; quantizedData[i+1] = outG; quantizedData[i+2] = outB; }
            }
        }
    }
    return new ImageData(quantizedData, width, height);
}

function runHybridQuantization(imageData, k, seed) {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    const maxSamples = 4000;
    const step = Math.max(1, Math.floor(totalPixels / maxSamples));
    const samples = [];
    for (let i = 0; i < totalPixels; i += step) {
        const idx = i * 4;
        if (data[idx+3] > 128) {
            samples.push([data[idx], data[idx+1], data[idx+2]]);
        }
    }
    if (samples.length <= k) return samples;

    // Wu 알고리즘으로 초기화
    let initialCentroids = runSimpleWu(samples, k);

    // 랜덤 시드 적용 (Jitter)
    if (seed && seed > 0) {
        let currentSeed = seed;
        const customRandom = () => {
            currentSeed = (currentSeed * 9301 + 49297) % 233280;
            return (currentSeed / 233280) - 0.5;
        };
        initialCentroids = initialCentroids.map(c => {
            const r = clamp(c[0] + customRandom() * 60, 0, 255);
            const g = clamp(c[1] + customRandom() * 60, 0, 255);
            const b = clamp(c[2] + customRandom() * 60, 0, 255);
            return [r, g, b];
        });
    }

    // K-Means 보정
    let clusters = initialCentroids;
    const maxIter = 3; 
    for (let iter = 0; iter < maxIter; iter++) {
        const sums = Array(k).fill(0).map(() => [0, 0, 0]);
        const counts = Array(k).fill(0);
        for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            let minDist = Infinity;
            let bestCluster = 0;
            for (let c = 0; c < k; c++) {
                const dist = (s[0]-clusters[c][0])**2 + (s[1]-clusters[c][1])**2 + (s[2]-clusters[c][2])**2;
                if (dist < minDist) { minDist = dist; bestCluster = c; }
            }
            sums[bestCluster][0] += s[0]; sums[bestCluster][1] += s[1]; sums[bestCluster][2] += s[2];
            counts[bestCluster]++;
        }
        let changed = false;
        for (let c = 0; c < k; c++) {
            if (counts[c] === 0) continue;
            const newR = sums[c][0] / counts[c]; const newG = sums[c][1] / counts[c]; const newB = sums[c][2] / counts[c];
            if (Math.abs(newR - clusters[c][0]) > 1 || Math.abs(newG - clusters[c][1]) > 1) changed = true;
            clusters[c] = [newR, newG, newB];
        }
        if (!changed) break;
    }
    return clusters.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
}

function runSimpleWu(pixels, maxColors) {
    let boxes = [{ pixels: pixels }];
    while (boxes.length < maxColors) {
        let maxScore = -1;
        let splitIdx = -1;
        for (let i = 0; i < boxes.length; i++) {
            if (boxes[i].pixels.length <= 1) continue;
            if (boxes[i].pixels.length > maxScore) { maxScore = boxes[i].pixels.length; splitIdx = i; }
        }
        if (splitIdx === -1) break;
        const pix = boxes[splitIdx].pixels;
        let minR=255, maxR=0, minG=255, maxG=0, minB=255, maxB=0;
        for(let p of pix) {
            if(p[0]<minR) minR=p[0]; if(p[0]>maxR) maxR=p[0];
            if(p[1]<minG) minG=p[1]; if(p[1]>maxG) maxG=p[1];
            if(p[2]<minB) minB=p[2]; if(p[2]>maxB) maxB=p[2];
        }
        const dr = maxR-minR, dg = maxG-minG, db = maxB-minB;
        const maxDim = Math.max(dr, dg, db);
        const sortDim = (maxDim === dr) ? 0 : (maxDim === dg) ? 1 : 2;
        pix.sort((a, b) => a[sortDim] - b[sortDim]);
        const mid = Math.floor(pix.length / 2);
        boxes.splice(splitIdx, 1, { pixels: pix.slice(0, mid) }, { pixels: pix.slice(mid) });
    }
    return boxes.map(box => {
        let r=0, g=0, b=0;
        for(let p of box.pixels) { r+=p[0]; g+=p[1]; b+=p[2]; }
        const n = box.pixels.length;
        return [r/n, g/n, b/n];
    });
}

function findNearestWdot(inputLab, originalPalette, paletteConverted) {
    let minDist = Infinity;
    let nearest = originalPalette[0];
    for (let i = 0; i < paletteConverted.length; i++) {
        const targetLab = paletteConverted[i];
        const dist = ciede2000Internal(inputLab, targetLab);
        if (dist < minDist) { minDist = dist; nearest = originalPalette[i]; }
    }
    return nearest;
}

function ciede2000Internal(lab1, lab2) {
    const radian = Math.PI / 180;
    const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
    const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;
    const Cab1 = Math.sqrt(a1 * a1 + b1 * b1);
    const Cab2 = Math.sqrt(a2 * a2 + b2 * b2);
    const meanCab = (Cab1 + Cab2) / 2;
    const meanCab7 = Math.pow(meanCab, 7);
    const G = 0.5 * (1 - Math.sqrt(meanCab7 / (meanCab7 + Math.pow(25, 7))));
    const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
    const Cp1 = Math.sqrt(ap1 * ap1 + b1 * b1), Cp2 = Math.sqrt(ap2 * ap2 + b2 * b2);
    const hp1 = (ap1 === 0 && b1 === 0) ? 0 : Math.atan2(b1, ap1) * (180 / Math.PI);
    const hp1_pos = hp1 >= 0 ? hp1 : hp1 + 360;
    const hp2 = (ap2 === 0 && b2 === 0) ? 0 : Math.atan2(b2, ap2) * (180 / Math.PI);
    const hp2_pos = hp2 >= 0 ? hp2 : hp2 + 360;
    const dL = L2 - L1, dC = Cp2 - Cp1;
    let dhp = 0;
    if (Cp1 * Cp2 === 0) dhp = 0;
    else {
        const diff = hp2_pos - hp1_pos;
        if (Math.abs(diff) <= 180) dhp = diff;
        else if (diff > 180) dhp = diff - 360;
        else if (diff < -180) dhp = diff + 360;
    }
    const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp / 2) * radian);
    const meanL = (L1 + L2) / 2, meanCp = (Cp1 + Cp2) / 2;
    let meanhp = 0;
    if (Cp1 * Cp2 === 0) meanhp = hp1_pos + hp2_pos;
    else {
        const sum = hp1_pos + hp2_pos;
        if (Math.abs(hp1_pos - hp2_pos) <= 180) meanhp = sum / 2;
        else if (sum < 360) meanhp = (sum + 360) / 2;
        else meanhp = (sum - 360) / 2;
    }
    const T = 1 - 0.17 * Math.cos((meanhp - 30) * radian) + 0.24 * Math.cos((2 * meanhp) * radian) + 0.32 * Math.cos((3 * meanhp + 6) * radian) - 0.20 * Math.cos((4 * meanhp - 63) * radian);
    const dTheta = 30 * Math.exp(-Math.pow((meanhp - 275) / 25, 2));
    const Rc = 2 * Math.sqrt(Math.pow(meanCp, 7) / (Math.pow(meanCp, 7) + Math.pow(25, 7)));
    const Sl = 1 + (0.015 * Math.pow(meanL - 50, 2)) / Math.sqrt(20 + Math.pow(meanL - 50, 2));
    const Sc = 1 + 0.045 * meanCp, Sh = 1 + 0.015 * meanCp * T;
    const Rt = -Math.sin(2 * dTheta * radian) * Rc;
    return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
}

function analyzeImageFeaturesOptimized(imageData) {
    return analyzeImageFeatures(imageData);
}