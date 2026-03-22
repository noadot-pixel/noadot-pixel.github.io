// js/worker/smart-resizer.js
/**
 * NoaDot Smart Resizer (Contrast-Aware Downsampling)
 * 평균 픽셀을 내어 뭉개는 대신, 구역 내에서 가장 대비가 강한 픽셀(선명한 디테일)을 그대로 추출합니다.
 */

export function smartResize(imageData, targetWidth, targetHeight) {
    const { width: srcW, height: srcH, data: srcData } = imageData;
    const dstData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    
    const xRatio = srcW / targetWidth;
    const yRatio = srcH / targetHeight;

    const lumaMap = new Uint8Array(srcW * srcH);
    for (let i = 0; i < srcW * srcH; i++) {
        lumaMap[i] = srcData[i*4]*0.299 + srcData[i*4+1]*0.587 + srcData[i*4+2]*0.114;
    }

    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            
            const srcXStart = Math.floor(x * xRatio);
            const srcYStart = Math.floor(y * yRatio);
            const srcXEnd = Math.floor((x + 1) * xRatio);
            const srcYEnd = Math.floor((y + 1) * yRatio);

            let minLuma = 256, maxLuma = -1, sumLuma = 0, count = 0;
            let minIdx = -1, maxIdx = -1;

            for (let sy = srcYStart; sy < srcYEnd && sy < srcH; sy++) {
                for (let sx = srcXStart; sx < srcXEnd && sx < srcW; sx++) {
                    const sIdx = sy * srcW + sx;
                    const luma = lumaMap[sIdx];
                    
                    sumLuma += luma;
                    count++;
                    
                    if (luma < minLuma) { minLuma = luma; minIdx = sIdx; }
                    if (luma > maxLuma) { maxLuma = luma; maxIdx = sIdx; }
                }
            }

            const avgLuma = sumLuma / count;
            
            // [핵심] 평균을 내지 않고, 구역 내에서 더 눈에 띄는 극단적인 픽셀 하나를 고릅니다.
            let finalSrcIdx = (avgLuma < (minLuma + maxLuma) / 2) ? minIdx : maxIdx;

            const dstIdx = (y * targetWidth + x) * 4;
            const sBase = finalSrcIdx * 4;
            
            // 선택된 픽셀의 원본 색상을 그대로 복사 (섞이지 않음 = 잔티 제거)
            dstData[dstIdx]   = srcData[sBase];
            dstData[dstIdx+1] = srcData[sBase+1];
            dstData[dstIdx+2] = srcData[sBase+2];
            dstData[dstIdx+3] = srcData[sBase+3];
        }
    }
    
    return new ImageData(dstData, targetWidth, targetHeight);
}