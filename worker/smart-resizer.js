// js/worker/smart-resizer.js

export function smartResize(imageData, targetWidth, targetHeight, mode = 'center') {
    if (!targetWidth || !targetHeight) return imageData;
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;
    if (srcWidth === targetWidth && srcHeight === targetHeight) return imageData;

    const srcData = imageData.data;
    const dstData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    
    const ratioX = srcWidth / targetWidth;
    const ratioY = srcHeight / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const dstIdx = (y * targetWidth + x) * 4;

            if (mode === 'center') {
                // 🎯 1. Center (정중앙 저격 - AI 복원용)
                const srcX = Math.floor((x + 0.5) * ratioX);
                const srcY = Math.floor((y + 0.5) * ratioY);
                const srcIdx = (srcY * srcWidth + srcX) * 4;
                dstData[dstIdx] = srcData[srcIdx];
                dstData[dstIdx + 1] = srcData[srcIdx + 1];
                dstData[dstIdx + 2] = srcData[srcIdx + 2];
                dstData[dstIdx + 3] = srcData[srcIdx + 3];

            } else if (mode === 'average') {
                // 🌫️ 2. Average (평균화 - 일러스트/사진용)
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                const startX = Math.floor(x * ratioX), startY = Math.floor(y * ratioY);
                const endX = Math.min(srcWidth, Math.floor((x + 1) * ratioX));
                const endY = Math.min(srcHeight, Math.floor((y + 1) * ratioY));

                for (let sy = startY; sy < endY; sy++) {
                    for (let sx = startX; sx < endX; sx++) {
                        const srcIdx = (sy * srcWidth + sx) * 4;
                        r += srcData[srcIdx]; g += srcData[srcIdx + 1];
                        b += srcData[srcIdx + 2]; a += srcData[srcIdx + 3];
                        count++;
                    }
                }
                if (count > 0) {
                    dstData[dstIdx] = r / count; dstData[dstIdx + 1] = g / count;
                    dstData[dstIdx + 2] = b / count; dstData[dstIdx + 3] = a / count;
                }
            } else {
                // 🧱 3. Nearest (기본 - 왼쪽 위 픽셀 뜯어오기)
                const srcX = Math.floor(x * ratioX);
                const srcY = Math.floor(y * ratioY);
                const srcIdx = (srcY * srcWidth + srcX) * 4;
                dstData[dstIdx] = srcData[srcIdx];
                dstData[dstIdx + 1] = srcData[srcIdx + 1];
                dstData[dstIdx + 2] = srcData[srcIdx + 2];
                dstData[dstIdx + 3] = srcData[srcIdx + 3];
            }
        }
    }
    return new ImageData(dstData, targetWidth, targetHeight);
}