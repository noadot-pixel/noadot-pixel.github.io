// js/worker/image-worker.js

import { THRESHOLD_MAPS } from '../../data/patterns.js'; 
import { geopixelsColors, wplaceFreeColors, wplacePaidColors } from '../../data/palettes.js';

import { clamp, ColorConverter, findClosestColor } from './color.js';
import { preprocessImageData } from './quantization.js';
import { calculateRecommendations } from './analysis.js'; 
import { upscaleEPX2x, upscaleEPX3x } from './upscale.js';
import { applyCelShadingFilter } from './outlining.js';

const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

function resizeImageData(imageData, targetWidth, targetHeight) {
    if (!targetWidth || !targetHeight) return imageData;
    const { width, height, data } = imageData;
    if (width === targetWidth && height === targetHeight) return imageData;
    const newData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    const xRatio = width / targetWidth;
    const yRatio = height / targetHeight;
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const srcX = Math.floor(x * xRatio);
            const srcY = Math.floor(y * yRatio);
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

self.onmessage = (e) => {
    try {
        const { type, imageData, options } = e.data;

        if (type === 'convert') {
            if (!imageData) throw new Error("이미지 데이터가 없습니다.");

            let processedData = imageData;
            
            // 1. 리사이징
            if (options.scaleWidth && options.scaleHeight) {
                processedData = resizeImageData(imageData, options.scaleWidth, options.scaleHeight);
            }

            // 2. 전처리
            processedData = preprocessImageData(processedData, options);

            // [분석용 원본 저장]
            const sourceForAnalysis = new ImageData(
                new Uint8ClampedArray(processedData.data), 
                processedData.width, 
                processedData.height
            );

            // 3. 팔레트 구성
            let activePalette = [];
            const { mode, palette: userCustomColors, useWplaceInGeoMode, disabledHexes } = options;

            if (mode === 'geopixels') {
                activePalette = geopixelsColors.map(c => c.rgb);
                if (useWplaceInGeoMode) {
                    const wplaceAll = [...wplaceFreeColors, ...wplacePaidColors].map(c => c.rgb);
                    activePalette = [...activePalette, ...wplaceAll];
                }
            } else if (mode === 'wplace') {
                activePalette = [...wplaceFreeColors, ...wplacePaidColors].map(c => c.rgb);
            }

            if (Array.isArray(userCustomColors) && userCustomColors.length > 0) {
                activePalette = [...activePalette, ...userCustomColors];
            }

            if (disabledHexes && disabledHexes.length > 0) {
                activePalette = activePalette.filter(rgb => !disabledHexes.includes(rgbToHex(rgb[0], rgb[1], rgb[2])));
            }

            if (activePalette.length === 0) activePalette = [[0, 0, 0]]; 

            // 4. 변환 실행
            if (options.celShading && options.celShading.apply) {
                processedData = applyCelShadingFilter(processedData, activePalette, options);
            } else {
                let paletteConverted = null;
                if (options.colorMethod === 'oklab') {
                    paletteConverted = activePalette.map(rgb => ColorConverter.rgbToOklab(rgb));
                } else if (options.colorMethod === 'ciede2000') {
                    paletteConverted = activePalette.map(rgb => ColorConverter.rgbToLab(rgb));
                }

                const width = processedData.width;
                const height = processedData.height;
                const floatData = new Float32Array(processedData.data);
                
                // 옵션 변수
                const ditheringType = options.dithering;
                const ditheringIntensity = (options.ditheringIntensity || 0) / 100;
                const applyPattern = options.applyPattern;
                const patternMap = applyPattern ? THRESHOLD_MAPS[options.patternType] : null;
                const patternSize = options.patternSize || 4;
                const patternStrength = 0.3;
                const applyGradient = options.applyGradient;
                const gradientType = options.gradientType || 'bayer';
                const gradientDitherSize = options.gradientDitherSize || 1;
                let gradCos = 0, gradSin = 0, gradMin = 0, gradLen = 1, gradStrength = 0;
                let bayerMap = null;

                // [New] RGB 가중치 계산 (0 -> 1.0, 50 -> 1.5, -50 -> 0.5)
                const wR = 1 + (options.rgbWeightR || 0) / 100;
                const wG = 1 + (options.rgbWeightG || 0) / 100;
                const wB = 1 + (options.rgbWeightB || 0) / 100;

                if (applyGradient) {
                    const angleRad = (options.gradientAngle || 0) * (Math.PI / 180);
                    gradStrength = (options.gradientStrength || 0) / 100;
                    gradCos = Math.cos(angleRad);
                    gradSin = Math.sin(angleRad);
                    const p1 = 0, p2 = width * gradCos, p3 = height * gradSin, p4 = width * gradCos + height * gradSin;
                    gradMin = Math.min(p1, p2, p3, p4);
                    gradLen = Math.max(p1, p2, p3, p4) - gradMin || 1;
                    if (gradientType === 'bayer') bayerMap = THRESHOLD_MAPS['bayer8x8'];
                }

                const colorCache = new Map();

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        if (floatData[idx + 3] === 0) continue;

                        let currentAlpha = floatData[idx + 3] / 255;

                        // 그라데이션
                        if (applyGradient && gradStrength > 0) {
                            const projection = x * gradCos + y * gradSin;
                            let t = (projection - gradMin) / gradLen;
                            t = clamp(t, 0, 1);
                            const targetOpacity = 1.0 - (t * gradStrength);
                            const idealAlpha = currentAlpha * targetOpacity;
                            let finalAlphaBinary = 255;

                            if (gradientType === 'bayer' && bayerMap) {
                                const mapH = bayerMap.length, mapW = bayerMap[0].length;
                                const px = Math.floor(x / gradientDitherSize) % mapW;
                                const py = Math.floor(y / gradientDitherSize) % mapH;
                                const threshold = bayerMap[py][px] / 255;
                                finalAlphaBinary = (idealAlpha > threshold) ? 255 : 0;
                            } else {
                                finalAlphaBinary = (idealAlpha > 0.5) ? 255 : 0;
                                const error = idealAlpha - (finalAlphaBinary / 255);
                                const distributeAlpha = (dx, dy, f) => {
                                    const nx = x + dx, ny = y + dy;
                                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                        floatData[(ny * width + nx) * 4 + 3] += error * f * 255;
                                    }
                                };
                                distributeAlpha(1, 0, 7/16); distributeAlpha(-1, 1, 3/16); 
                                distributeAlpha(0, 1, 5/16); distributeAlpha(1, 1, 1/16);
                            }
                            floatData[idx + 3] = clamp(finalAlphaBinary, 0, 255);
                            if (floatData[idx + 3] === 0) continue;
                        }

                        let oldR = floatData[idx], oldG = floatData[idx+1], oldB = floatData[idx+2];

                        // 패턴
                        if (patternMap) {
                            const mapH = patternMap.length;
                            const mapW = patternMap[0].length;
                            const py = Math.floor(y / patternSize) % mapH;
                            const px = Math.floor(x / patternSize) % mapW;
                            const mapValue = patternMap[py][px];
                            const adjustment = (mapValue - 128) * patternStrength;
                            oldR = clamp(oldR + adjustment, 0, 255);
                            oldG = clamp(oldG + adjustment, 0, 255);
                            oldB = clamp(oldB + adjustment, 0, 255);
                        }

                        // [핵심] RGB 가중치 적용: 소스 색상을 왜곡시켜 매칭 유도
                        const weightedR = clamp(oldR * wR, 0, 255);
                        const weightedG = clamp(oldG * wG, 0, 255);
                        const weightedB = clamp(oldB * wB, 0, 255);

                        const rKey = Math.round(weightedR), gKey = Math.round(weightedG), bKey = Math.round(weightedB);
                        const cacheKey = (rKey << 16) | (gKey << 8) | bKey;
                        
                        let bestColor = colorCache.get(cacheKey);
                        if (!bestColor) {
                            // 왜곡된 색상(weighted)을 기준으로 가장 가까운 팔레트 색상 탐색
                            bestColor = findClosestColor(weightedR, weightedG, weightedB, activePalette, paletteConverted, options.colorMethod).color;
                            colorCache.set(cacheKey, bestColor);
                        }
                        
                        // 결과는 팔레트 색상 그대로 적용
                        floatData[idx] = bestColor[0];
                        floatData[idx+1] = bestColor[1];
                        floatData[idx+2] = bestColor[2];

                        // 디더링 (원본 - 변환색 오차 확산)
                        if (ditheringType !== 'none' && ditheringIntensity > 0) {
                            const errR = (oldR - bestColor[0]) * ditheringIntensity;
                            const errG = (oldG - bestColor[1]) * ditheringIntensity;
                            const errB = (oldB - bestColor[2]) * ditheringIntensity;

                            const distribute = (dx, dy, f) => {
                                const nx = x + dx, ny = y + dy;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const nIdx = (ny * width + nx) * 4;
                                    if(floatData[nIdx + 3] > 0) {
                                        floatData[nIdx] += errR * f; 
                                        floatData[nIdx+1] += errG * f; 
                                        floatData[nIdx+2] += errB * f;
                                    }
                                }
                            };

                            if (ditheringType === 'floyd') {
                                distribute(1, 0, 7/16); distribute(-1, 1, 3/16); distribute(0, 1, 5/16); distribute(1, 1, 1/16);
                            } else if (ditheringType === 'atkinson') {
                                distribute(1, 0, 1/8); distribute(2, 0, 1/8); distribute(-1, 1, 1/8); distribute(0, 1, 1/8); distribute(1, 1, 1/8); distribute(0, 2, 1/8);
                            } else if (ditheringType === 'sierra') {
                                distribute(1, 0, 2/4); distribute(-1, 1, 1/4); distribute(0, 1, 1/4);
                            }
                        }
                    }
                }
                for (let i = 0; i < processedData.data.length; i++) processedData.data[i] = floatData[i];
            }

            const recommendations = calculateRecommendations(sourceForAnalysis, activePalette, options);
            
            const pixelCounts = {};
            const pData = processedData.data;
            for(let i=0; i<pData.length; i+=4) {
                if(pData[i+3] === 0) continue; 
                const hex = rgbToHex(pData[i], pData[i+1], pData[i+2]);
                pixelCounts[hex] = (pixelCounts[hex] || 0) + 1;
            }

            self.postMessage({ 
                type: 'recommendationResult', 
                recommendations: recommendations,
                pixelStats: pixelCounts,
                totalPixels: recommendations.totalPixels || 0 
            });

            self.postMessage({ type: 'conversionDone', imageData: processedData, processId: options.processId });

        } else if (type === 'upscale') {
            const { scaleFactor } = options;
            let upscaledData = (scaleFactor === 2) ? upscaleEPX2x(imageData) : (scaleFactor === 3 ? upscaleEPX3x(imageData) : imageData);
            self.postMessage({ type: 'upscaleResult', imageData: upscaledData });
        }
    } catch (err) {
        self.postMessage({ status: 'error', message: err.message || "워커 오류" });
    }
};