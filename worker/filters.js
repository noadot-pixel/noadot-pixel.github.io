// js/worker/filters.js

// ==============================================================
// 1. 스마트 블러 (Smart Blur) - [복구됨]
// ==============================================================
export function applySmartBlur(imageData, radius = 2, threshold = 30) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);
    const thresholdSq = threshold * threshold;
    const r = Math.floor(radius);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            const r0 = data[idx], g0 = data[idx+1], b0 = data[idx+2];

            for (let ky = -r; ky <= r; ky++) {
                for (let kx = -r; kx <= r; kx++) {
                    const ny = y + ky;
                    const nx = x + kx;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nIdx = (ny * width + nx) * 4;
                        const nr = data[nIdx], ng = data[nIdx+1], nb = data[nIdx+2];
                        const dist = (r0-nr)*(r0-nr) + (g0-ng)*(g0-ng) + (b0-nb)*(b0-nb);
                        if (dist <= thresholdSq) {
                            rSum += nr; gSum += ng; bSum += nb;
                            count++;
                        }
                    }
                }
            }
            if (count > 0) {
                output[idx] = rSum / count;
                output[idx+1] = gSum / count;
                output[idx+2] = bSum / count;
                output[idx+3] = data[idx+3];
            }
        }
    }
    return new ImageData(output, width, height);
}

// ==============================================================
// 2. 쿠와하라 필터 (Kuwahara Filter)
// ==============================================================
export function applyKuwaharaFilter(imageData, radius = 2) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const meanR = [0,0,0,0], meanG = [0,0,0,0], meanB = [0,0,0,0];
            const varR  = [0,0,0,0], varG  = [0,0,0,0], varB  = [0,0,0,0];
            const counts = [0,0,0,0];
            
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const ny = y + ky;
                    const nx = x + kx;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nIdx = (ny * width + nx) * 4;
                        const r = data[nIdx], g = data[nIdx+1], b = data[nIdx+2];
                        const region = (ky > 0 ? 2 : 0) + (kx > 0 ? 1 : 0);
                        
                        // 사분면 데이터 누적
                        if (ky <= 0 && kx <= 0) { meanR[0]+=r; meanG[0]+=g; meanB[0]+=b; varR[0]+=r*r; varG[0]+=g*g; varB[0]+=b*b; counts[0]++; }
                        if (ky <= 0 && kx >= 0) { meanR[1]+=r; meanG[1]+=g; meanB[1]+=b; varR[1]+=r*r; varG[1]+=g*g; varB[1]+=b*b; counts[1]++; }
                        if (ky >= 0 && kx <= 0) { meanR[2]+=r; meanG[2]+=g; meanB[2]+=b; varR[2]+=r*r; varG[2]+=g*g; varB[2]+=b*b; counts[2]++; }
                        if (ky >= 0 && kx >= 0) { meanR[3]+=r; meanG[3]+=g; meanB[3]+=b; varR[3]+=r*r; varG[3]+=g*g; varB[3]+=b*b; counts[3]++; }
                    }
                }
            }
            
            let minVariance = Infinity;
            let bestRegion = 0;
            
            for (let i = 0; i < 4; i++) {
                if (counts[i] === 0) continue;
                const mR = meanR[i]/counts[i], mG = meanG[i]/counts[i], mB = meanB[i]/counts[i];
                const vR = (varR[i]/counts[i])-mR*mR, vG = (varG[i]/counts[i])-mG*mG, vB = (varB[i]/counts[i])-mB*mB;
                const totalVariance = vR + vG + vB;
                if (totalVariance < minVariance) { minVariance = totalVariance; bestRegion = i; }
                meanR[i] = mR; meanG[i] = mG; meanB[i] = mB;
            }
            
            output[idx] = meanR[bestRegion];
            output[idx+1] = meanG[bestRegion];
            output[idx+2] = meanB[bestRegion];
            output[idx+3] = data[idx+3];
        }
    }
    return new ImageData(output, width, height);
}

// ==============================================================
// 3. 미디언 필터 (Median Filter)
// ==============================================================
export function applyMedianFilter(imageData, radius = 1) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);
    const r = Math.floor(radius);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const rVals = [], gVals = [], bVals = [];

            for (let ky = -r; ky <= r; ky++) {
                for (let kx = -r; kx <= r; kx++) {
                    const ny = y + ky;
                    const nx = x + kx;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nIdx = (ny * width + nx) * 4;
                        rVals.push(data[nIdx]);
                        gVals.push(data[nIdx+1]);
                        bVals.push(data[nIdx+2]);
                    }
                }
            }
            rVals.sort((a,b)=>a-b); gVals.sort((a,b)=>a-b); bVals.sort((a,b)=>a-b);
            const mid = Math.floor(rVals.length/2);
            
            output[idx] = rVals[mid];
            output[idx+1] = gVals[mid];
            output[idx+2] = bVals[mid];
            output[idx+3] = data[idx+3];
        }
    }
    return new ImageData(output, width, height);
}

// ==============================================================
// 4. 색상 단순화 (Posterization)
// ==============================================================
export function applyColorSimplification(imageData, step = 10) {
    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        output[i] = Math.round(data[i]/step)*step;
        output[i+1] = Math.round(data[i+1]/step)*step;
        output[i+2] = Math.round(data[i+2]/step)*step;
        output[i+3] = data[i+3];
    }
    return new ImageData(output, width, height);
}

// ==============================================================
// 5. 노이즈 제거 (Despeckle)
// ==============================================================
export function applyDespeckle(imageData, iterations = 1) {
    let { width, height, data } = imageData;
    let currentData = new Uint8ClampedArray(data);
    let nextData = new Uint8ClampedArray(data);

    for (let it = 0; it < iterations; it++) {
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                if (currentData[idx+3] === 0) continue;

                const colorCounts = {};
                let maxCount = 0;
                let majorityKey = null;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const nIdx = ((y + ky) * width + (x + kx)) * 4;
                        if (currentData[nIdx+3] === 0) continue;
                        const key = `${currentData[nIdx]},${currentData[nIdx+1]},${currentData[nIdx+2]}`;
                        colorCounts[key] = (colorCounts[key] || 0) + 1;
                        if (colorCounts[key] > maxCount) { maxCount = colorCounts[key]; majorityKey = key; }
                    }
                }
                
                const currentKey = `${currentData[idx]},${currentData[idx+1]},${currentData[idx+2]}`;
                // 과반수 이상이면 교체
                if (majorityKey && majorityKey !== currentKey && maxCount >= 5) {
                    const [r, g, b] = majorityKey.split(',').map(Number);
                    nextData[idx] = r; nextData[idx+1] = g; nextData[idx+2] = b;
                }
            }
        }
        currentData.set(nextData);
    }
    return new ImageData(nextData, width, height);
}

// ==============================================================
// 6. 외곽선 마스크
// ==============================================================
export function getEdgeMask(imageData, threshold = 50) {
    const { width, height, data } = imageData;
    const mask = new Uint8Array(width * height);
    const gray = new Float32Array(width * height);
    for(let i=0; i<width*height; i++) gray[i] = data[i*4]*0.299 + data[i*4+1]*0.587 + data[i*4+2]*0.114;
    
    const sobelX = [-1,0,1,-2,0,2,-1,0,1], sobelY = [-1,-2,-1,0,0,0,1,2,1];
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx=0, gy=0;
            for(let ky=-1; ky<=1; ky++) {
                for(let kx=-1; kx<=1; kx++) {
                    const val = gray[(y+ky)*width+(x+kx)];
                    gx += val * sobelX[(ky+1)*3+(kx+1)];
                    gy += val * sobelY[(ky+1)*3+(kx+1)];
                }
            }
            if (Math.sqrt(gx*gx + gy*gy) > threshold) mask[y*width+x] = 1;
        }
    }
    return mask;
}