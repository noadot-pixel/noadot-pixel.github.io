// js/worker/post-processing.js

export class PostProcessor {
    /**
     * 옵션에 따라 모든 후처리 효과를 순서대로 적용합니다.
     */
    static apply(imageData, options, width, height) {
        let pixels = new Uint8ClampedArray(imageData.data);

        // 1. 면 평탄화
        if (options.useSmoothing && options.smoothingLevel > 0) {
            pixels = this.applySmoothing(pixels, width, height, options.smoothingLevel);
        }

        // 🌟 2. 유기적 노이즈 (The Happy Accident)
        if (options.useOrganicNoise) {
            pixels = this.applyOrganicNoise(pixels, width, height, options.organicNoiseStrength);
        }

        // 3. Pixelioe (V6 코드가 오기 전까지는 얌전히 대기!)
        if (options.usePixelioe) {
            pixels = this.applyPixelioe(pixels, width, height, options.pixelioeStrength);
        }

        // 4. 투명도 그라데이션
        if (options.useAlphaGradient) {
            pixels = this.applyAlphaGradient(pixels, width, height, options.alphaGradientAngle, options.alphaGradientSize, options.alphaGradientStrength, options.alphaGradientType);
        }

        imageData.data.set(pixels);
        return imageData;
    }

    // ==========================================
    // 1. 면 평탄화 (최빈값 필터 - 픽셀아트 스타일 뭉개기)
    // ==========================================
    static applySmoothing(pixels, width, height, level) {
        const result = new Uint8ClampedArray(pixels);
        const radius = Math.min(3, Math.ceil(level / 3)); // 레벨에 따라 탐색 반경 증가

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (pixels[idx + 3] === 0) continue; // 투명 픽셀 무시

                // 주변 픽셀 색상 수집
                const colorCounts = new Map();
                let maxCount = 0;
                let dominantColor = null;

                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const ny = y + dy, nx = x + dx;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = (ny * width + nx) * 4;
                            if (pixels[nIdx + 3] === 0) continue;

                            const r = pixels[nIdx], g = pixels[nIdx+1], b = pixels[nIdx+2];
                            const key = `${r},${g},${b}`;
                            const count = (colorCounts.get(key) || 0) + 1;
                            colorCounts.set(key, count);

                            if (count > maxCount) {
                                maxCount = count;
                                dominantColor = [r, g, b];
                            }
                        }
                    }
                }

                // 가장 많이 등장한 색으로 현재 픽셀 덮어쓰기 (평탄화)
                if (dominantColor) {
                    result[idx] = dominantColor[0];
                    result[idx + 1] = dominantColor[1];
                    result[idx + 2] = dominantColor[2];
                }
            }
        }
        return result;
    }

    static applyOrganicNoise(pixels, width, height, strength) {
        if (strength <= 0) return pixels;

        let result = new Uint8ClampedArray(pixels);
        const getIdx = (x, y) => (y * width + x) * 4;

        // 🚀 패스 횟수와 오차 허용치를 극단적으로 올립니다.
        const passes = Math.ceil(strength / 7);      // 최대 15번 화면을 긁어냅니다.
        const tolerance = Math.floor(strength / 2);  // 오차 허용 (최대 50: 색이 달라도 뭉개버림)

        const isSimilar = (buf, i1, i2) => {
            if (buf[i1+3] === 0 || buf[i2+3] === 0) return false;
            return Math.abs(buf[i1] - buf[i2]) <= tolerance &&
                   Math.abs(buf[i1+1] - buf[i2+1]) <= tolerance &&
                   Math.abs(buf[i1+2] - buf[i2+2]) <= tolerance;
        };

        for (let pass = 0; pass < passes; pass++) {
            const temp = new Uint8ClampedArray(result);
            
            // 🌟 박살 난 노이즈의 핵심: 긁는 방향을 매 패스마다 위아래로 번갈아 교차!
            const reverse = pass % 2 !== 0;
            const startY = reverse ? height - 3 : 2;
            const endY = reverse ? 1 : height - 2;
            const stepY = reverse ? -1 : 1;

            for (let y = startY; y !== endY; y += stepY) {
                for (let x = 2; x < width - 2; x++) {
                    const idx = getIdx(x, y);
                    if (temp[idx + 3] === 0) continue; 

                    // 기본 인접 픽셀
                    const up = getIdx(x, y - 1);
                    const down = getIdx(x, y + 1);
                    const left = getIdx(x - 1, y);
                    const right = getIdx(x + 1, y);
                    
                    // 타겟 풀(Pool) 구성
                    const targets = [up, left, down, right];
                    
                    // 강도가 40 이상이면 대각선 방향으로도 색을 찢어버림
                    if (strength > 40) {
                        targets.push(getIdx(x - 1, y - 1), getIdx(x + 1, y + 1)); 
                    }
                    // 🌟 강도가 80 이상이면 2칸 거리의 픽셀을 강제로 끌어와서 뭉텅이로 박살냄
                    if (strength > 80) {
                        targets.push(getIdx(x, y - 2), getIdx(x - 2, y));
                    }

                    const randomTarget = targets[Math.floor(Math.random() * targets.length)];

                    // 🌟 글리치(Glitch) 효과: 강도가 85 이상이면 25% 확률로 색상 무시하고 무지성 덮어쓰기!
                    const forceSmear = (strength > 85 && Math.random() < 0.25); 

                    if (temp[randomTarget + 3] > 0 && (forceSmear || isSimilar(temp, idx, randomTarget))) {
                        result[idx] = temp[randomTarget]; 
                        result[idx+1] = temp[randomTarget+1];
                        result[idx+2] = temp[randomTarget+2]; 
                        result[idx+3] = temp[randomTarget+3];
                    }
                }
            }
        }
        return result;
    }

    // ==========================================
    // 2. Pixelioe (고립 픽셀 제거 및 라인 최적화)
    // ==========================================
    static applyPixelioe(pixels, width, height, strength) {
        if (strength <= 0) return pixels;

        // 슬라이더 강도(0~100)에 따른 알고리즘 튜닝
        // 강도 1~50: 얇게 보강 (반경 1), 강도 51~100: 두껍게 보강 (반경 2)
        const r = strength > 50 ? 2 : 1; 
        
        // 강도가 높을수록 더 작은 명암 차이도 외곽선으로 민감하게 잡아냄 (대비 임계값)
        const threshold = 60 - Math.floor(strength / 2); // 10 ~ 60

        let result = new Uint8ClampedArray(pixels);
        const numPixels = width * height;
        const lumaMap = new Uint8Array(numPixels);

        // 1. 빠른 명도(밝기) 계산을 위한 Luma 맵 생성
        for (let i = 0; i < numPixels; i++) {
            lumaMap[i] = pixels[i*4]*0.299 + pixels[i*4+1]*0.587 + pixels[i*4+2]*0.114;
        }

        // 2. 픽셀 탐색 및 외곽선 두껍게 만들기
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                let minLuma = 256;
                let maxLuma = -1;
                let minIdx = idx; // 제일 어두운 픽셀의 위치 기억

                // 주변 패치 탐색
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
                
                // [핵심] 해당 구역의 명도 차이(대비)가 임계값 이상 나면 외곽선 부근으로 간주!
                if (maxLuma - minLuma > threshold) {
                    // 새로운 색상을 섞지 않고, 원본에 있던 제일 어두운 픽셀의 RGB를 그대로 덮어씌움
                    const minBase = minIdx * 4;
                    result[pBase]     = pixels[minBase];
                    result[pBase + 1] = pixels[minBase + 1];
                    result[pBase + 2] = pixels[minBase + 2];
                    result[pBase + 3] = pixels[pBase + 3];
                }
            }
        }
        return result;
    }

    // ==========================================
    // 3. 투명도 그라데이션
    // ==========================================
    static applyAlphaGradient(pixels, width, height, angle, size, strength, type) {
        const rad = angle * (Math.PI / 180);
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const p1 = 0;
        const p2 = width * cosA;
        const p3 = height * sinA;
        const p4 = width * cosA + height * sinA;
        const minProj = Math.min(p1, p2, p3, p4);
        const maxProj = Math.max(p1, p2, p3, p4);
        const range = maxProj - minProj || 1;
        const fadeFactor = strength / 100;

        // [A] Bayer (규칙적인 패턴) 모드 - 기존과 동일 (수학적으로 즉시 덩어리 계산 가능)
        if (type === 'bayer') {
            const bayer = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if (pixels[idx + 3] === 0) continue;

                    const proj = x * cosA + y * sinA;
                    const ratio = (proj - minProj) / range;
                    const bayerX = Math.floor(x / size) % 4;
                    const bayerY = Math.floor(y / size) % 4;
                    const threshold = (bayer[bayerY][bayerX] + 0.5) / 16;
                    
                    const visibility = 1.0 - (ratio * fadeFactor * 2); 
                    if (visibility < threshold) pixels[idx + 3] = 0;
                }
            }
            return pixels;
        }

        // [B] Error Diffusion (Floyd, Sierra, Atkinson) 모드
        // 🌟 유저님 아이디어 탑재: 입자 크기(size)가 적용된 "가상 그리드(Virtual Buffer)" 생성!
        const bw = Math.ceil(width / size);
        const bh = Math.ceil(height / size);
        const alphaBuffer = new Float32Array(bw * bh);
        
        // 1. 가상 그리드의 각 칸(블록)에 투명도(0~255) 할당
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                // 가상 블록의 '중심점'을 기준으로 그라데이션 비율 계산
                const cx = bx * size + size / 2;
                const cy = by * size + size / 2;
                const proj = cx * cosA + cy * sinA;
                const ratio = (proj - minProj) / range;
                
                const visibility = Math.max(0, 1.0 - (ratio * fadeFactor * 2));
                alphaBuffer[by * bw + bx] = visibility * 255;
            }
        }

        // 2. 축소된 가상 그리드 상에서 오차 확산(Error Diffusion) 디더링 연쇄 반응!
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                const i = by * bw + bx;
                const oldA = alphaBuffer[i];
                
                // 128을 기준으로 완전 투명(0) 또는 완전 불투명(255)으로 이진화
                const newA = oldA >= 128 ? 255 : 0; 
                alphaBuffer[i] = newA;

                const err = oldA - newA;
                if (err === 0) continue;

                // 인접한 '가상 블록'에 오차 흩뿌리기
                if (type === 'floyd') {
                    if (bx + 1 < bw) alphaBuffer[i + 1] += err * 7/16;
                    if (by + 1 < bh) {
                        if (bx - 1 >= 0) alphaBuffer[i + bw - 1] += err * 3/16;
                        alphaBuffer[i + bw] += err * 5/16;
                        if (bx + 1 < bw) alphaBuffer[i + bw + 1] += err * 1/16;
                    }
                } else if (type === 'sierra') { // Sierra Lite
                    if (bx + 1 < bw) alphaBuffer[i + 1] += err * 2/4;
                    if (by + 1 < bh) {
                        if (bx - 1 >= 0) alphaBuffer[i + bw - 1] += err * 1/4;
                        alphaBuffer[i + bw] += err * 1/4;
                    }
                } else if (type === 'atkinson') {
                    const e = err / 8;
                    if (bx + 1 < bw) alphaBuffer[i + 1] += e;
                    if (bx + 2 < bw) alphaBuffer[i + 2] += e;
                    if (by + 1 < bh) {
                        if (bx - 1 >= 0) alphaBuffer[i + bw - 1] += e;
                        alphaBuffer[i + bw] += e;
                        if (bx + 1 < bw) alphaBuffer[i + bw + 1] += e;
                    }
                    if (by + 2 < bh) alphaBuffer[i + bw * 2] += e;
                }
            }
        }

        // 3. 완성된 가상 그리드 결과를 실제 원본 픽셀로 뻥튀기 매핑 (덩어리 적용)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pIdx = (y * width + x) * 4;
                if (pixels[pIdx + 3] === 0) continue;

                // 현재 픽셀이 속한 가상 블록의 좌표를 찾아냄
                const bx = Math.floor(x / size);
                const by = Math.floor(y / size);
                const blockAlpha = alphaBuffer[by * bw + bx];

                // 가상 블록이 투명해졌다면, 해당 블록 안의 실제 픽셀들도 한꺼번에 뚫어버림!
                if (blockAlpha === 0) {
                    pixels[pIdx + 3] = 0;
                }
            }
        }

        return pixels;
    }
}