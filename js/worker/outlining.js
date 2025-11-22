// js/worker/outlining.js
import { ColorConverter, findClosestColor } from './color.js';
import { posterizeWithKMeans } from './quantization.js';

export function applyCelShadingFilter(imageData, palette, options) {
    const { celShading } = options;
    const { width, height } = imageData;
    
    // 1. 포스터화 (색상 단순화)
    const { centroids: posterColors, posterizedData } = posterizeWithKMeans(imageData, celShading);
    const finalImageData = new ImageData(width, height);
    const posterMap = new Map();
    
    // 2. 색상 매핑 (팔레트 색상으로 치환)
    const paletteOklab = options.highQualityMode && palette.length > 0 ? palette.map(c => ColorConverter.rgbToOklab(c)) : null;
    
    if (celShading.mappingMode === 'activePalette' && palette.length > 0) {
        for (const pColor of posterColors) {
            const { color: finalColor } = findClosestColor(pColor[0], pColor[1], pColor[2], palette, paletteOklab, options.highQualityMode);
            posterMap.set(pColor.join(','), finalColor);
        }
    } else {
        for (const pColor of posterColors) { posterMap.set(pColor.join(','), pColor); }
    }
    
    for (let i = 0; i < posterizedData.data.length; i += 4) {
        if (posterizedData.data[i + 3] > 0) {
            const key = [Math.round(posterizedData.data[i]), Math.round(posterizedData.data[i + 1]), Math.round(posterizedData.data[i + 2])].join(',');
            const finalColor = posterMap.get(key) || [0, 0, 0];
            finalImageData.data[i] = finalColor[0]; 
            finalImageData.data[i + 1] = finalColor[1]; 
            finalImageData.data[i + 2] = finalColor[2]; 
            finalImageData.data[i + 3] = 255;
        }
    }
    
    // 3. 외곽선 그리기 (Sobel Operator)
    if (celShading.outline) {
        const threshold = celShading.outlineThreshold || 50;
        // [수정됨] 사용자가 선택한 색상 받기 (없으면 검은색)
        const outlineRGB = celShading.outlineColor || [0, 0, 0];
        
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
        const edgeData = new Uint8ClampedArray(finalImageData.data); // 현재 그려진 이미지 기준
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;
                // 주변 3x3 픽셀 탐색
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        // 밝기(Luminance) 기준으로 경계 탐지
                        const luminance = edgeData[idx] * 0.299 + edgeData[idx + 1] * 0.587 + edgeData[idx + 2] * 0.114;
                        gx += luminance * sobelX[(ky + 1) * 3 + (kx + 1)];
                        gy += luminance * sobelY[(ky + 1) * 3 + (kx + 1)];
                    }
                }
                
                // 경계 강도가 임계값을 넘으면 외곽선 칠하기
                if (Math.sqrt(gx * gx + gy * gy) > threshold) {
                    const mainIdx = (y * width + x) * 4;
                    // [수정됨] 선택된 색상으로 칠하기
                    finalImageData.data[mainIdx] = outlineRGB[0]; 
                    finalImageData.data[mainIdx + 1] = outlineRGB[1]; 
                    finalImageData.data[mainIdx + 2] = outlineRGB[2]; 
                    finalImageData.data[mainIdx + 3] = 255; // 불투명
                }
            }
        }
    }
    return finalImageData;
}