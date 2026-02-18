// js/worker/outlining.js
import { ColorConverter, findClosestColor } from './color.js';
import { posterizeWithKMeans, quantizePopularity, quantizeMedianCut, quantizeOctree, quantizeWu } from './quantization.js';

export function applyCelShadingFilter(imageData, palette, options) {
    const { celShading, colorMethod } = options;
    const { width, height } = imageData;
    
    // 1. 알고리즘 선택 및 포스터화 실행
    const algorithm = celShading.algorithm || 'kmeans'; 
    let quantizationResult;

    switch (algorithm) {
        case 'popularity':
            quantizationResult = quantizePopularity(imageData, celShading);
            break;
        case 'mediancut':
            quantizationResult = quantizeMedianCut(imageData, celShading);
            break;
        case 'octree':
            quantizationResult = quantizeOctree(imageData, celShading);
            break;
        case 'wu':
            quantizationResult = quantizeWu(imageData, celShading);
            break;
        case 'kmeans':
        default:
            quantizationResult = posterizeWithKMeans(imageData, celShading);
            break;
    }

    const { centroids: posterColors, posterizedData } = quantizationResult;
    
    const finalImageData = new ImageData(width, height);
    const posterMap = new Map();
    
    // 2. 팔레트 매핑 (이전과 동일)
    let paletteConverted = null;
    if (colorMethod === 'oklab') {
        paletteConverted = palette.map(c => ColorConverter.rgbToOklab(c));
    } else if (colorMethod === 'ciede2000' || colorMethod === 'ciede2000-d65') {
        const converter = (colorMethod === 'ciede2000-d65') ? ColorConverter.rgbToLabD65 : ColorConverter.rgbToLab;
        paletteConverted = palette.map(c => converter(c));
    }

    for (const pColor of posterColors) {
        if (palette && palette.length > 0) {
            const { color: finalColor } = findClosestColor(
                pColor[0], pColor[1], pColor[2], 
                palette, paletteConverted, colorMethod
            );
            posterMap.set(pColor.join(','), finalColor);
        } else {
            posterMap.set(pColor.join(','), pColor);
        }
    }
    
    // 픽셀 데이터 재구성
    for (let i = 0; i < posterizedData.data.length; i += 4) {
        if (posterizedData.data[i + 3] > 0) {
            const key = [
                Math.round(posterizedData.data[i]), 
                Math.round(posterizedData.data[i + 1]), 
                Math.round(posterizedData.data[i + 2])
            ].join(',');
            
            const finalColor = posterMap.get(key) || [0, 0, 0];
            finalImageData.data[i] = finalColor[0]; 
            finalImageData.data[i + 1] = finalColor[1]; 
            finalImageData.data[i + 2] = finalColor[2]; 
            finalImageData.data[i + 3] = 255;
        }
    }
    
    // 3. 외곽선 그리기
    if (celShading && celShading.outline) {
        const threshold = celShading.outlineThreshold || 50;
        let outlineRGB = celShading.outlineColor || [0, 0, 0];
        
        if (typeof outlineRGB === 'string') {
            const r = parseInt(outlineRGB.slice(1, 3), 16);
            const g = parseInt(outlineRGB.slice(3, 5), 16);
            const b = parseInt(outlineRGB.slice(5, 7), 16);
            outlineRGB = [r, g, b];
        }

        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
        const edgeData = new Uint8ClampedArray(finalImageData.data);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const luminance = edgeData[idx] * 0.299 + edgeData[idx + 1] * 0.587 + edgeData[idx + 2] * 0.114;
                        gx += luminance * sobelX[(ky + 1) * 3 + (kx + 1)];
                        gy += luminance * sobelY[(ky + 1) * 3 + (kx + 1)];
                    }
                }
                
                if (Math.sqrt(gx * gx + gy * gy) > threshold) {
                    const mainIdx = (y * width + x) * 4;
                    finalImageData.data[mainIdx] = outlineRGB[0]; 
                    finalImageData.data[mainIdx + 1] = outlineRGB[1]; 
                    finalImageData.data[mainIdx + 2] = outlineRGB[2]; 
                    finalImageData.data[mainIdx + 3] = 255;
                }
            }
        }
    }
    return finalImageData;
}