// js/worker/image-worker.js

import { THRESHOLD_MAPS } from '../../data/patterns.js'; 
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';

import { clamp, ColorConverter, findClosestColor } from './color.js';
import { preprocessImageData } from './quantization.js';
import { calculateRecommendations } from './analysis.js'; 
import { upscaleEPX2x, upscaleEPX3x } from './upscale.js';
import { applyCelShadingFilter } from './outlining.js';

import { applySmartBlur, applyKuwaharaFilter, applyMedianFilter, applyColorSimplification, applyDespeckle } from './filters.js';
import { applyOutlineExpansion } from './outline-expansion.js';
import { smartResize } from './smart-resizer.js';

const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();

function removeTransparency(imageData) {
    return imageData; 
}

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
            processedData = removeTransparency(processedData);

            // [롤백 1] 외곽선 보강 옵션 원래대로 복구
            if (options.applyOutlineExpansion) {
                let patchSize = 3; 
                if (options.scaleWidth && options.scaleWidth < processedData.width) {
                    let ratio = Math.round(processedData.width / options.scaleWidth);
                    patchSize = ratio | 1; 
                    patchSize = Math.max(3, Math.min(patchSize, 11)); 
                }
                processedData = applyOutlineExpansion(processedData, patchSize);
            }

            if (options.scaleWidth && options.scaleHeight) {
                if (options.applySmartSampling) {
                    processedData = smartResize(processedData, options.scaleWidth, options.scaleHeight);
                } else {
                    processedData = resizeImageData(processedData, options.scaleWidth, options.scaleHeight);
                }
            }

            processedData = preprocessImageData(processedData, options);

            const sourceForAnalysis = new ImageData(
                new Uint8ClampedArray(processedData.data), 
                processedData.width, 
                processedData.height
            );

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
            } else if (mode === 'uplace') {
                activePalette = uplaceColors.map(c => c.rgb);
            }

            if (Array.isArray(userCustomColors) && userCustomColors.length > 0) {
                activePalette = [...activePalette, ...userCustomColors];
            }

            if (disabledHexes && disabledHexes.length > 0) {
                activePalette = activePalette.filter(rgb => !disabledHexes.includes(rgbToHex(rgb[0], rgb[1], rgb[2])));
            }

            if (activePalette.length === 0) activePalette = [[0, 0, 0]]; 

            if (options.celShading && options.celShading.apply) {
                processedData = applyCelShadingFilter(processedData, activePalette, options);
            } else {
                const ditheringType = options.dithering || 'none';
                const useAspireDither = ditheringType === 'aspire';
                const ditheringIntensity = (options.ditheringIntensity || 0) / 100;

                const applyRefinement = options.applyRefinement === true;
                const refinementStrength = options.refinementStrength || 0;

                // 🌟 2. 완벽하게 독립된 상호 배타적 구조 (If - Else If)
                if (applyRefinement && refinementStrength > 0) {
                    if (refinementStrength <= 40) {
                        processedData = applySmartBlur(processedData, refinementStrength > 20 ? 2 : 1, 10 + refinementStrength);
                    } else if (refinementStrength <= 80) {
                        processedData = applyKuwaharaFilter(processedData, refinementStrength > 60 ? 3 : 2);
                    } else {
                        processedData = applyMedianFilter(processedData, refinementStrength > 90 ? 2 : 1);
                    }
                    
                    if (refinementStrength > 50) {
                        const step = Math.floor((refinementStrength - 50) * 0.4);
                        if (step > 2) processedData = applyColorSimplification(processedData, step);
                    }
                }

                let paletteConverted = null;
                const isDotMode = options.applyDotSampling === true;
                const baseMethodForConv = isDotMode ? 'rgb' : ((options.colorMethod === 'wdot-plus') ? 'ciede2000' : options.colorMethod);
                
                if (baseMethodForConv === 'oklab') {
                    paletteConverted = activePalette.map(rgb => ColorConverter.rgbToOklab(rgb));
                } else if (baseMethodForConv === 'ciede2000-d65') {
                    paletteConverted = activePalette.map(rgb => ColorConverter.rgbToLabD65(rgb));
                } else if (baseMethodForConv === 'ciede2000') {
                    paletteConverted = activePalette.map(rgb => ColorConverter.rgbToLab(rgb));
                }

                const width = processedData.width;
                const height = processedData.height;
                const floatData = new Float32Array(processedData.data);
                
                const isPatternDither = ['bayer8x8', 'crosshatch', 'vertical', 'checkerboard', 'diagonal_right', 'diagonal_left', 'brick'].includes(ditheringType);
                const applyPattern = options.applyPattern || isPatternDither;
                const patternType = isPatternDither ? ditheringType : (options.patternType || 'bayer8x8');
                const patternMap = applyPattern ? THRESHOLD_MAPS[patternType] : null;
                const patternSize = options.patternSize || 4;
                
                const applyGradient = options.applyGradient;
                const gradientType = options.gradientType || 'bayer';
                const gradientDitherSize = options.gradientDitherSize || 1;
                let gradCos = 0, gradSin = 0, gradMin = 0, gradLen = 1, gradStrength = 0;
                let bayerMap = null;

                if (applyGradient) {
                    const angleRad = (options.gradientAngle || 0) * (Math.PI / 180);
                    gradStrength = (options.gradientStrength || 0) / 100;
                    gradCos = Math.cos(angleRad); gradSin = Math.sin(angleRad);
                    const p1 = 0, p2 = width * gradCos, p3 = height * gradSin, p4 = width * gradCos + height * gradSin;
                    gradMin = Math.min(p1, p2, p3, p4);
                    gradLen = Math.max(p1, p2, p3, p4) - gradMin || 1;
                    if (gradientType === 'bayer') bayerMap = THRESHOLD_MAPS['bayer8x8'];
                }

                const aspireBayer = [
                    [ 0, 32,  8, 40,  2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
                    [12, 44,  4, 36, 14, 46,  6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
                    [ 3, 35, 11, 43,  1, 33,  9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
                    [15, 47,  7, 39, 13, 45,  5, 37], [63, 31, 55, 23, 61, 29, 53, 21]
                ];

                const colorCache = new Map();
                const satWeight = (options.saturationWeight !== undefined) ? options.saturationWeight / 100 : 0.5;

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        
                        // 1. 원래 투명한 배경은 연산 패스
                        if (floatData[idx + 3] === 0) continue; 

                        // 3. 🌟 투명도 그라데이션 (펀치로 구멍 뚫기)
                        if (applyGradient) {
                            const proj = x * gradCos + y * gradSin;
                            const ratio = (proj - gradMin) / gradLen; 
                            const adjustedRatio = ratio * gradStrength + (1.0 - gradStrength);

                            let threshold = 0.5;
                            if (bayerMap) {
                                // 1. 베어링 맵 (패턴 기반)
                                const px = Math.floor(x / gradientDitherSize) % bayerMap[0].length;
                                const py = Math.floor(y / gradientDitherSize) % bayerMap.length;
                                threshold = bayerMap[py][px] / 255.0;
                            } else {
                                // 2. 랜덤 노이즈 (입자 묶음 기반)
                                if (gradientDitherSize > 1) {
                                    // 픽셀 좌표를 입자 크기로 나눠서 '블록 좌표'를 만듭니다.
                                    const blockX = Math.floor(x / gradientDitherSize);
                                    const blockY = Math.floor(y / gradientDitherSize);
                                    
                                    // 블록 좌표(blockX, blockY)를 고유한 숫자로 섞어버리는 수학 공식 (GLSL 셰이더 방식)
                                    // 같은 블록 안에 있는 픽셀들은 모두 이 똑같은 난수(threshold)를 얻게 됩니다.
                                    const seed = blockX * 12.9898 + blockY * 78.233;
                                    threshold = Math.abs(Math.sin(seed) * 43758.5453) % 1; 
                                } else {
                                    // 입자 크기가 1일 때는 기존처럼 픽셀마다 개별 주사위를 던집니다.
                                    threshold = Math.random();
                                }
                            }

                            // 패턴 임계값에 걸리면 픽셀을 투명하게(0) 날려버리고 다음 픽셀로 패스!
                            if (adjustedRatio < threshold) {
                                floatData[idx + 3] = 0; 
                                continue; 
                            }
                        }

                        // 4. 살아남은 픽셀의 원본 색상
                        let oldR = floatData[idx], oldG = floatData[idx+1], oldB = floatData[idx+2];
                        
                        // 5. (옵션) 흑백 패턴(질감) 조정
                        if (patternMap && ditheringIntensity > 0) {
                            const px = Math.floor(x / patternSize) % patternMap[0].length;
                            const py = Math.floor(y / patternSize) % patternMap.length;
                            
                            // 패턴 맵의 값(0~255)을 -0.5 ~ 0.5 로 변환
                            const mapValue = (patternMap[py][px] / 255.0) - 0.5;
                            
                            // 진폭(Amplitude) 계산: 슬라이더(0~1) 값에 따라 색상을 흔드는 폭을 결정
                            // 슬라이더가 100%일 때 최대 +-128까지 변동 (팔레트 색상을 넘나듦)
                            const amplitude = ditheringIntensity * 128; 
                            const adjustment = mapValue * amplitude;
                            
                            oldR = clamp(oldR + adjustment, 0, 255);
                            oldG = clamp(oldG + adjustment, 0, 255);
                            oldB = clamp(oldB + adjustment, 0, 255);
                        }

                        // 6. 🌟 [복구됨!] 가장 가까운 팔레트 색상 찾기 (캐시 최적화)
                        const matchR = Math.round(clamp(oldR, 0, 255));
                        const matchG = Math.round(clamp(oldG, 0, 255));
                        const matchB = Math.round(clamp(oldB, 0, 255));
                        const cacheKey = (matchR << 16) | (matchG << 8) | matchB;
                        
                        let bestColor;

                        if (useAspireDither && activePalette.length > 1) {
                            let cached = colorCache.get(cacheKey);
                            if (!cached || !cached.c1) {
                                let d1 = Infinity, idx1 = 0;
                                let d2 = Infinity, idx2 = 0;
                                for (let j = 0; j < activePalette.length; j++) {
                                    const pr = activePalette[j][0], pg = activePalette[j][1], pb = activePalette[j][2];
                                    const dist = (oldR-pr)*(oldR-pr) + (oldG-pg)*(oldG-pg) + (oldB-pb)*(oldB-pb);
                                    if (dist < d1) { d2 = d1; idx2 = idx1; d1 = dist; idx1 = j; } 
                                    else if (dist < d2) { d2 = dist; idx2 = j; }
                                }
                                cached = { c1: activePalette[idx1], c2: activePalette[idx2], d1, d2 };
                                colorCache.set(cacheKey, cached);
                            }
                            let ratio = 0;
                            if (cached.d1 + cached.d2 > 0) {
                                ratio = (cached.d1 / (cached.d1 + cached.d2)) * ditheringIntensity;
                            }
                            const threshold = aspireBayer[y % 8][x % 8] / 64.0;
                            bestColor = ratio > threshold ? cached.c2 : cached.c1;
                        } else {
                            bestColor = colorCache.get(cacheKey);
                            if (!bestColor || bestColor.c1) {
                                bestColor = findClosestColor(matchR, matchG, matchB, activePalette, paletteConverted, isDotMode ? 'rgb' : options.colorMethod, satWeight).color;
                                colorCache.set(cacheKey, bestColor);
                            }
                        }

                        // 7. 찾은 색상 칠하기
                        floatData[idx] = bestColor[0];
                        floatData[idx+1] = bestColor[1];
                        floatData[idx+2] = bestColor[2];

                        // 8. 오차 확산 (디더링 방파제 로직 포함)
                        const isErrorDiffusion = ['floyd', 'atkinson', 'sierra'].includes(ditheringType);
                        if (isErrorDiffusion && ditheringIntensity > 0) {
                            let errR = (oldR - bestColor[0]) * ditheringIntensity;
                            let errG = (oldG - bestColor[1]) * ditheringIntensity;
                            let errB = (oldB - bestColor[2]) * ditheringIntensity;

                            if (isDotMode) {
                                const tolerance = 15; // 노이즈 억제력 (이 수치보다 작은 오차는 버림)
                                if (Math.abs(errR) < tolerance) errR = 0;
                                if (Math.abs(errG) < tolerance) errG = 0;
                                if (Math.abs(errB) < tolerance) errB = 0;
                            }
                            
                            const maxErr = 32; 
                            errR = clamp(errR, -maxErr, maxErr);
                            errG = clamp(errG, -maxErr, maxErr);
                            errB = clamp(errB, -maxErr, maxErr);

                            const distribute = (dx, dy, f) => {
                                const nx = x + dx, ny = y + dy;
                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const nIdx = (ny * width + nx) * 4;
                                    if(floatData[nIdx + 3] > 0) {
                                        floatData[nIdx] += errR * f; floatData[nIdx+1] += errG * f; floatData[nIdx+2] += errB * f;
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

                if (refinementStrength > 0 && !useAspireDither) {
                    const iterations = refinementStrength > 60 ? 2 : 1;
                    processedData = applyDespeckle(processedData, iterations);
                }
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
                pixelStats: pixelCounts 
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