// js/worker/outlining.js
import { ColorConverter, findClosestColor } from './color.js';
import { posterizeWithKMeans } from './quantization.js';

export function applyCelShadingFilter(imageData, palette, options) {
    const { celShading, colorMethod } = options; // colorMethod 추가
    const { width, height } = imageData;
    
    // 1. 포스터화 (색상 단순화)
    const { centroids: posterColors, posterizedData } = posterizeWithKMeans(imageData, celShading);
    const finalImageData = new ImageData(width, height);
    const posterMap = new Map();
    
    // 2. [핵심 수정] 팔레트 색상으로 치환 (무조건 실행되도록 변경)
    // 6.2 버전에서는 mappingMode를 체크했지만, 6.5에서는 팔레트가 있으면 무조건 매핑합니다.
    let paletteConverted = null;
    if (colorMethod === 'oklab') {
        paletteConverted = palette.map(c => ColorConverter.rgbToOklab(c));
    } else if (colorMethod === 'ciede2000') {
        paletteConverted = palette.map(c => ColorConverter.rgbToLab(c));
    }

    // 포스터화된 각 중심 색상을 가장 가까운 팔레트 색상으로 미리 매핑
    for (const pColor of posterColors) {
        if (palette.length > 0) {
            // findClosestColor 호출 시 colorMethod를 전달하여 일관성 유지
            const { color: finalColor } = findClosestColor(
                pColor[0], pColor[1], pColor[2], 
                palette, paletteConverted, colorMethod
            );
            posterMap.set(pColor.join(','), finalColor);
        } else {
            // 팔레트가 없을 경우에만 예외적으로 원본 색상 사용
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
    
    // 3. 외곽선 그리기 (Sobel Operator)
    if (celShading.outline) {
        const threshold = celShading.outlineThreshold || 50;
        // 색상 선택 처리 (HEX 문자열일 경우 RGB 배열로 변환하는 안전장치 필요 시 추가)
        let outlineRGB = celShading.outlineColor || [0, 0, 0];
        
        // 만약 outlineColor가 문자열("#000000")로 들어올 경우를 대비한 처리
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