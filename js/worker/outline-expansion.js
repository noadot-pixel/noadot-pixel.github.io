// js/worker/outline-expansion.js
// 픽셀 아트에 최적화된 스마트 외곽선 보강 (Smart Edge Erosion)
// - 새로운 색상(잡색)을 절대 창조하지 않고, 기존의 어두운 선 픽셀만 두껍게 복사합니다.

export function applyOutlineExpansion(imageData, patchSize = 3) {
    const { width, height, data } = imageData;
    const numPixels = width * height;
    const outputData = new Uint8ClampedArray(data.length);

    // 1. 빠른 명도(밝기) 계산을 위한 맵 생성
    const lumaMap = new Uint8Array(numPixels);
    for (let i = 0; i < numPixels; i++) {
        lumaMap[i] = data[i*4]*0.299 + data[i*4+1]*0.587 + data[i*4+2]*0.114;
    }

    const r = Math.floor(patchSize / 2);

    // 2. 픽셀 탐색 및 외곽선 두껍게 만들기
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            
            let minLuma = 256;
            let maxLuma = -1;
            let minIdx = idx; // 제일 어두운 픽셀의 위치 기억

            // 패치(주변) 탐색
            for (let ky = -r; ky <= r; ky++) {
                const ny = y + ky;
                if (ny < 0 || ny >= height) continue;

                for (let kx = -r; kx <= r; kx++) {
                    const nx = x + kx;
                    if (nx < 0 || nx >= width) continue;

                    const nIdx = ny * width + nx;
                    const luma = lumaMap[nIdx];

                    if (luma < minLuma) { 
                        minLuma = luma; 
                        minIdx = nIdx; 
                    }
                    if (luma > maxLuma) { 
                        maxLuma = luma; 
                    }
                }
            }

            const pBase = idx * 4;
            
            // [핵심] 해당 구역의 명도 차이(대비)가 30 이상 나면 외곽선 부근으로 간주!
            if (maxLuma - minLuma > 30) {
                // 새로운 색상을 섞어 만들지 않고, 100% 원본에 있던 제일 어두운 픽셀의 RGB를 그대로 덮어씌움
                const minBase = minIdx * 4;
                outputData[pBase]     = data[minBase];
                outputData[pBase + 1] = data[minBase + 1];
                outputData[pBase + 2] = data[minBase + 2];
                outputData[pBase + 3] = data[pBase + 3];
            } else {
                // 평탄한 면(피부, 배경 등)은 얌전히 원본 색상 유지
                outputData[pBase]     = data[pBase];
                outputData[pBase + 1] = data[pBase + 1];
                outputData[pBase + 2] = data[pBase + 2];
                outputData[pBase + 3] = data[pBase + 3];
            }
        }
    }

    return new ImageData(outputData, width, height);
}