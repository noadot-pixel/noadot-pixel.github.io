// js/worker/image-worker.js

import { THRESHOLD_MAPS } from '../../data/patterns.js'; 
import { clamp, ColorConverter, findClosestColor, findTwoClosestColors } from './color.js';
import { preprocessImageData } from './quantization.js';
import { applyCelShadingFilter } from './outlining.js';
import { analyzeImageFeatures, calculateRecommendations, getStyleRecipesByTags } from './analysis.js';

// ========== 1. 내부 헬퍼 함수들 ==========

// [최적화] 이미지 리사이징 함수 (프리셋 썸네일용)
function resizeImageData(imageData, targetWidth) {
    const { width, height, data } = imageData;
    if (width <= targetWidth) return imageData; // 이미 작으면 패스

    const ratio = targetWidth / width;
    const targetHeight = Math.round(height * ratio);
    const newData = new Uint8ClampedArray(targetWidth * targetHeight * 4);

    // Nearest Neighbor 리사이징 (속도 최적화)
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

function applyPatternDithering(preprocessedImage, convertedImage, palette, options) {
    const { width, height } = preprocessedImage;
    const { data: preprocessedData } = preprocessedImage;
    const { data: convertedData } = convertedImage;
    const { patternType, highQualityMode, patternSize } = options;
    
    const resultImageData = new ImageData(width, height);
    const resultData = resultImageData.data;
    
    const map = THRESHOLD_MAPS[patternType] || THRESHOLD_MAPS.crosshatch;
    const mapHeight = map.length; 
    const mapWidth = map[0].length;
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
            
            resultData[i] = finalColor[0]; 
            resultData[i + 1] = finalColor[1]; 
            resultData[i + 2] = finalColor[2]; 
            resultData[i + 3] = 255;
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
    
    const rad = gradientAngle * Math.PI / 180; 
    const cos = Math.cos(rad); 
    const sin = Math.sin(rad);
    const centerX = width / 2; 
    const centerY = height / 2;
    
    const corners = [
        (0 - centerX) * cos + (0 - centerY) * sin, 
        (width - centerX) * cos + (0 - centerY) * sin, 
        (0 - centerX) * cos + (height - centerY) * sin, 
        (width - centerX) * cos + (height - centerY) * sin
    ];
    const minProj = Math.min(...corners); 
    const maxProj = Math.max(...corners);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] === 0) continue;
            const projected = (x - centerX) * cos + (y - centerY) * sin;
            let gradientValue = (projected - minProj) / (maxProj - minProj);
            gradientValue = gradientValue * strength;
            const bayerThreshold = bayerMatrix[y % 4][x % 4] * bayerFactor;
            const transparencyThreshold = gradientValue * 255;
            if (bayerThreshold < transparencyThreshold) { data[i + 3] = 0; }
        }
    }
    return imageData;
}

function applyConversion(imageData, palette, options) {
    // [안전장치] 팔레트가 없으면 빈 배열로 처리
    if (!palette) palette = []; 

    const paletteOklab = options.highQualityMode && palette.length > 0 ? palette.map(c => ColorConverter.rgbToOklab(c)) : null;
    const { width, height } = imageData;
    
    // 팔레트가 비었으면 검은색(혹은 투명) 이미지 반환
    if (palette.length === 0) {
        const blackData = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < blackData.length; i += 4) { 
            blackData[i + 3] = 255; // Alpha = 255 (Black)
        }
        return new ImageData(blackData, width, height);
    }
    
    const newData = new ImageData(width, height);
    const ditherData = new Float32Array(imageData.data);
    const ditherStr = options.dithering / 100.0;
    const algorithm = options.algorithm;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (ditherData[i + 3] < 128) { newData.data[i + 3] = 0; continue; }
            
            const rClamped = clamp(ditherData[i], 0, 255);
            const gClamped = clamp(ditherData[i + 1], 0, 255);
            const bClamped = clamp(ditherData[i + 2], 0, 255);
            const { color: newRgb } = findClosestColor(rClamped, gClamped, bClamped, palette, paletteOklab, options.highQualityMode);
            
            newData.data[i] = newRgb[0];
            newData.data[i+1] = newRgb[1];
            newData.data[i+2] = newRgb[2];
            newData.data[i+3] = ditherData[i + 3];
            
            if (ditherStr > 0 && algorithm !== 'none') {
                const errR = (ditherData[i] - newRgb[0]) * ditherStr;
                const errG = (ditherData[i + 1] - newRgb[1]) * ditherStr;
                const errB = (ditherData[i + 2] - newRgb[2]) * ditherStr;
                const distributeError = (idx, amount) => {
                    ditherData[idx] += errR * amount; 
                    ditherData[idx + 1] += errG * amount; 
                    ditherData[idx + 2] += errB * amount;
                };
                
                if (algorithm === 'floyd') {
                    if (x < width - 1) distributeError(i + 4, 7 / 16);
                    if (y < height - 1) {
                        if (x > 0) distributeError(i + width * 4 - 4, 3 / 16);
                        distributeError(i + width * 4, 5 / 16);
                        if (x < width - 1) distributeError(i + width * 4 + 4, 1 / 16);
                    }
                } else if (algorithm === 'sierra') {
                    if (x < width - 1) distributeError(i + 4, 2 / 4);
                    if (y < height - 1) {
                        if (x > 0) distributeError(i + width * 4 - 4, 1 / 4);
                        distributeError(i + width * 4, 1 / 4);
                    }
                } else if (algorithm === 'atkinson') {
                    const factor = 1 / 8;
                    if (x < width - 1) distributeError(i + 4, factor);
                    if (x < width - 2) distributeError(i + 8, factor);
                    if (y < height - 1) {
                        if (x > 0) distributeError(i + width * 4 - 4, factor);
                        distributeError(i + width * 4, factor);
                        if (x < width - 1) distributeError(i + width * 4 + 4, factor);
                    }
                    if (y < height - 2) distributeError(i + width * 8, factor);
                }
            }
        }
    }
    return newData;
}

// ========== 2. 메인 이벤트 핸들러 ==========

self.onmessage = async (e) => {
    const { type, imageData, palette, allPaletteColors, options, processId } = e.data;

    // [프리셋 추천 로직]
    if (type === 'getStyleRecommendations') {
        try {
            // 1. 이미지 분석
            const imageFeatures = analyzeImageFeatures(imageData);
            const categorizedRecipes = getStyleRecipesByTags(imageFeatures);
            
            // 2. [최적화] 썸네일 생성용 이미지 축소 (너비 150px)
            // 속도 향상을 위해 작은 이미지로 프리셋을 적용합니다.
            const smallImage = resizeImageData(imageData, 150);

            const recommendationResults = { fixed: [], recommended: [], others: [] };

            const generateThumbnails = async (recipes, category) => {
                for (const recipe of recipes) {
                    // 1. 축소된 이미지 데이터 복사 (원본 보존)
                    const thumbImageData = new ImageData(
                        new Uint8ClampedArray(smallImage.data), 
                        smallImage.width, 
                        smallImage.height
                    );
                    
                    // 2. 옵션 병합 (Deep Copy)
                    const baseOptions = JSON.parse(JSON.stringify(options));
                    const presetValues = recipe.preset;
                    
                    Object.assign(baseOptions, presetValues);
                    if (presetValues.celShading) {
                        baseOptions.celShading = { 
                            ...baseOptions.celShading, 
                            ...presetValues.celShading 
                        };
                        
                        // 외곽선 색상 변환 (HEX 문자열 -> RGB 배열)
                        if (presetValues.celShading.outlineColor && typeof presetValues.celShading.outlineColor === 'string') {
                            const hex = presetValues.celShading.outlineColor.replace('#', '');
                            const bigint = parseInt(hex, 16);
                            const r = (bigint >> 16) & 255;
                            const g = (bigint >> 8) & 255;
                            const b = bigint & 255;
                            baseOptions.celShading.outlineColor = [r, g, b];
                        }
                    }

                    // 3. 팔레트 결정 로직 (모드별 팔레트 or 기본 팔레트)
                    let usePalette = [];
                    
                    if (presetValues.enablePaletteColors) {
                        const currentMode = baseOptions.currentMode || 'geopixels';
                        const targetColors = presetValues.enablePaletteColors[currentMode];
                        
                        if (targetColors && Array.isArray(targetColors)) {
                            usePalette = targetColors.map(hex => {
                                const h = hex.replace('#', '');
                                const i = parseInt(h, 16);
                                return [(i >> 16) & 255, (i >> 8) & 255, i & 255];
                            });
                        }
                    }
                    
                    // 지정된 팔레트가 없으면 메인 스레드에서 받은 현재 팔레트 사용
                    if (usePalette.length === 0) {
                        if (palette && palette.length > 0) {
                            usePalette = palette;
                        } else {
                            // 비상용 (흑백)
                            usePalette = [[0,0,0], [255,255,255], [128,128,128]];
                        }
                    }

                    // 4. 이미지 처리 및 변환 수행
                    let finalThumb;
                    const processedThumb = preprocessImageData(thumbImageData, baseOptions);
                    
                    if (baseOptions.celShading && baseOptions.celShading.apply) {
                        finalThumb = applyCelShadingFilter(processedThumb, usePalette, baseOptions);
                    } else {
                        finalThumb = applyConversion(processedThumb, usePalette, baseOptions);
                    }
                    
                    // 5. 결과 저장
                    recommendationResults[category].push({ 
                        thumbnailData: finalThumb, 
                        name: recipe.name, 
                        preset: recipe.preset, 
                        ranking: recipe.ranking, 
                        tags: recipe.tags,
                        displayTag: recipe.displayTag 
                    });
                }
            };

            await generateThumbnails(categorizedRecipes.fixed, 'fixed');
            await generateThumbnails(categorizedRecipes.recommended, 'recommended');
            await generateThumbnails(categorizedRecipes.others, 'others');
            
            self.postMessage({ 
                status: 'success', 
                type: 'recommendationResult', 
                results: recommendationResults, 
                processId: processId 
            });
            
        } catch (error) {
             self.postMessage({ status: 'error', message: `스타일 추천 생성 중 오류: ${error.message}\n${error.stack}`, type: 'recommendationError', processId: processId });
        }
        return;
    }

    // [메인 변환 로직]
    try {
        let finalImageData;
        
        // [안전장치] 팔레트가 없으면 즉시 검은색 반환 (무한로딩 방지)
        if (!palette || palette.length === 0) {
            const emptyData = new Uint8ClampedArray(imageData.width * imageData.height * 4);
            for (let i = 0; i < emptyData.length; i += 4) { emptyData[i + 3] = 255; } // Black
            finalImageData = new ImageData(emptyData, imageData.width, imageData.height);
        } else {
            // 정상 처리
            const preprocessedData = preprocessImageData(imageData, options);
            
            if (options.celShading && options.celShading.apply) {
                finalImageData = applyCelShadingFilter(preprocessedData, palette, options);
            } else {
                const convertedImage = applyConversion(preprocessedData, palette, options);
                if (options.applyPattern) { 
                    finalImageData = applyPatternDithering(preprocessedData, convertedImage, palette, options); 
                } else { 
                    finalImageData = convertedImage; 
                }
            }
            
            if (options.applyGradient && options.gradientStrength > 0) {
                finalImageData = applyGradientTransparency(finalImageData, options);
            }
        }

        // 추천 색상 계산
        const recommendations = (options.currentMode === 'geopixels') ? calculateRecommendations(imageData, palette || [], options) : [];
        
        // 사용량 맵 계산
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
        
        self.postMessage({ 
            status: 'success', 
            type: 'conversionResult', 
            imageData: finalImageData, 
            recommendations, 
            usageMap: Object.fromEntries(usageMap), 
            processId: processId 
        }, [finalImageData.data.buffer]);
        
    } catch (error) {
        self.postMessage({ status: 'error', message: error.message + ' at ' + error.stack, processId: processId });
    }
};