// js/worker/quantization.js
import { clamp, colorDistanceSq, ColorConverter, findClosestColor } from './color.js';

// ==============================================================
// 1. 공통 유틸리티
// ==============================================================

// 전처리 함수 (밝기/대비/채도 조절)
export function preprocessImageData(sourceImageData, options) {
    const { saturation, brightness, contrast } = options;
    const sat = saturation / 100.0, bri = brightness, con = contrast;
    const factor = (259 * (con + 255)) / (255 * (259 - con));
    const data = new Uint8ClampedArray(sourceImageData.data);
    
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        if (bri !== 0) { r = clamp(r + bri, 0, 255); g = clamp(g + bri, 0, 255); b = clamp(b + bri, 0, 255); }
        if (con !== 0) { r = clamp(factor * (r - 128) + 128, 0, 255); g = clamp(factor * (g - 128) + 128, 0, 255); b = clamp(factor * (b - 128) + 128, 0, 255); }
        if (sat !== 1.0) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = clamp(gray + sat * (r - gray), 0, 255); g = clamp(gray + sat * (g - gray), 0, 255); b = clamp(gray + sat * (b - gray), 0, 255); }
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
    return new ImageData(data, sourceImageData.width, sourceImageData.height);
}

/**
 * [공통 함수] 생성된 팔레트를 사용하여 이미지를 매핑(Mapping)합니다.
 */
function applyPaletteToImage(imageData, palette, options) {
    const { width, height, data } = imageData;
    const posterizedData = new ImageData(width, height);
    const colorMethod = (options && options.colorMethod) || 'rgb';
    
    let paletteConverted = null;
    if (colorMethod === 'oklab') {
        paletteConverted = palette.map(c => ColorConverter.rgbToOklab(c));
    } else if (colorMethod === 'ciede2000' || colorMethod === 'ciede2000-d65') {
        const converter = (colorMethod === 'ciede2000-d65') ? ColorConverter.rgbToLabD65 : ColorConverter.rgbToLab;
        paletteConverted = palette.map(c => converter(c));
    }

    const colorCache = new Map();

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const cacheKey = (r << 16) | (g << 8) | b;
            
            let bestColor = colorCache.get(cacheKey);
            if (!bestColor) {
                const result = findClosestColor(r, g, b, palette, paletteConverted, colorMethod);
                bestColor = result.color;
                colorCache.set(cacheKey, bestColor);
            }

            posterizedData.data[i] = bestColor[0];
            posterizedData.data[i + 1] = bestColor[1];
            posterizedData.data[i + 2] = bestColor[2];
            posterizedData.data[i + 3] = 255;
        } else {
            posterizedData.data[i + 3] = 0;
        }
    }

    return { centroids: palette, posterizedData };
}

// [Helper] 이미지 샘플링
function samplePixels(imageData, maxSamples = 4096) {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    const step = Math.max(1, Math.floor(totalPixels / maxSamples)) * 4;
    const samples = [];
    
    for (let i = 0; i < data.length; i += step) {
        if (data[i + 3] > 128) {
            samples.push([data[i], data[i + 1], data[i + 2]]);
        }
    }
    return samples;
}

// ==============================================================
// 2. 알고리즘: Popularity (빈도수 기반)
// ==============================================================
export function quantizePopularity(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    const { data } = imageData;
    const colorCounts = new Map();

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        colorCounts.set(rgb, (colorCounts.get(rgb) || 0) + 1);
    }

    const sortedColors = [...colorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, k);

    const palette = sortedColors.map(([intColor]) => [
        (intColor >> 16) & 0xFF,
        (intColor >> 8) & 0xFF,
        intColor & 0xFF
    ]);

    if (palette.length === 0) palette.push([0, 0, 0]);

    return applyPaletteToImage(imageData, palette, options);
}

// ==============================================================
// 3. 알고리즘: Median Cut (중간 절단)
// ==============================================================
export function quantizeMedianCut(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    let pixels = samplePixels(imageData, 8192);
    if (pixels.length === 0) return { centroids: [[0,0,0]], posterizedData: imageData };

    let buckets = [pixels];

    while (buckets.length < k) {
        let largestBucketIdx = -1;
        let maxLen = -1;
        for(let i=0; i<buckets.length; i++) {
            if(buckets[i].length > maxLen) {
                maxLen = buckets[i].length;
                largestBucketIdx = i;
            }
        }
        
        if (largestBucketIdx === -1 || buckets[largestBucketIdx].length < 2) break;

        const bucket = buckets[largestBucketIdx];
        
        let minR=255, maxR=0, minG=255, maxG=0, minB=255, maxB=0;
        for(let p of bucket) {
            if(p[0]<minR) minR=p[0]; if(p[0]>maxR) maxR=p[0];
            if(p[1]<minG) minG=p[1]; if(p[1]>maxG) maxG=p[1];
            if(p[2]<minB) minB=p[2]; if(p[2]>maxB) maxB=p[2];
        }
        
        const rRange = maxR - minR;
        const gRange = maxG - minG;
        const bRange = maxB - minB;
        
        let axis = 0;
        if (gRange >= rRange && gRange >= bRange) axis = 1;
        else if (bRange >= rRange && bRange >= gRange) axis = 2;

        bucket.sort((a, b) => a[axis] - b[axis]);

        const mid = Math.floor(bucket.length / 2);
        const bucket1 = bucket.slice(0, mid);
        const bucket2 = bucket.slice(mid);

        buckets.splice(largestBucketIdx, 1, bucket1, bucket2);
    }

    const palette = buckets.map(bucket => {
        let r=0, g=0, b=0;
        for(let p of bucket) { r+=p[0]; g+=p[1]; b+=p[2]; }
        const len = bucket.length;
        return [Math.round(r/len), Math.round(g/len), Math.round(b/len)];
    });

    return applyPaletteToImage(imageData, palette, options);
}

// ==============================================================
// 4. 알고리즘: Octree (옥트리) - [신규]
// ==============================================================
class OctreeNode {
    constructor(level = 0, parent = null) {
        this.redSum = 0;
        this.greenSum = 0;
        this.blueSum = 0;
        this.pixelCount = 0;
        this.children = new Array(8).fill(null);
        this.level = level;
        this.parent = parent;
        this.isLeaf = false;
    }

    addColor(r, g, b) {
        this.redSum += r;
        this.greenSum += g;
        this.blueSum += b;
        this.pixelCount++;
    }

    get color() {
        if (this.pixelCount === 0) return [0, 0, 0];
        return [
            Math.round(this.redSum / this.pixelCount),
            Math.round(this.greenSum / this.pixelCount),
            Math.round(this.blueSum / this.pixelCount)
        ];
    }
}

export function quantizeOctree(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    const { data } = imageData;
    
    // 트리 구축 (최대 깊이 8)
    const root = new OctreeNode(0);
    // 성능을 위해 전체 픽셀을 순회하되, 너무 크면 스텝을 둠
    const step = 4;

    for (let i = 0; i < data.length; i += step * 4) {
        if (data[i + 3] < 128) continue;
        
        const r = data[i], g = data[i+1], b = data[i+2];
        let node = root;
        
        for (let level = 0; level < 8; level++) {
            const index = ((r >> (7 - level) & 1) << 2) | 
                          ((g >> (7 - level) & 1) << 1) | 
                          ((b >> (7 - level) & 1));
            
            if (!node.children[index]) {
                node.children[index] = new OctreeNode(level + 1, node);
            }
            node = node.children[index];
        }
        node.isLeaf = true;
        node.addColor(r, g, b);
    }

    // 잎 노드 수집
    let leaves = [];
    function collectLeaves(node) {
        if (node.isLeaf) {
            leaves.push(node);
            return;
        }
        for (const child of node.children) {
            if (child) collectLeaves(child);
        }
    }
    collectLeaves(root);

    // 노드 병합 (Reduction)
    // 잎 노드가 k개보다 많으면, 가장 적은 픽셀을 가진 노드부터 병합
    while (leaves.length > k) {
        let minPixelCount = Infinity;
        let targetIndex = -1;

        // 병합 대상 찾기 (최소 픽셀 수)
        for (let i = 0; i < leaves.length; i++) {
            if (leaves[i].pixelCount < minPixelCount && leaves[i].parent) {
                minPixelCount = leaves[i].pixelCount;
                targetIndex = i;
            }
        }

        if (targetIndex === -1) break;

        const targetNode = leaves[targetIndex];
        const parent = targetNode.parent;
        
        // 부모를 잎으로 변환하며 자식들의 통계를 합침
        parent.isLeaf = true;
        parent.redSum = 0; parent.greenSum = 0; parent.blueSum = 0; parent.pixelCount = 0;

        for (let i = 0; i < 8; i++) {
            const child = parent.children[i];
            if (child) {
                parent.redSum += child.redSum;
                parent.greenSum += child.greenSum;
                parent.blueSum += child.blueSum;
                parent.pixelCount += child.pixelCount;
                
                // 리스트에서 자식 제거
                const idx = leaves.indexOf(child);
                if (idx > -1) leaves.splice(idx, 1);
                
                parent.children[i] = null;
            }
        }
        leaves.push(parent);
    }

    const palette = leaves.map(node => node.color);
    return applyPaletteToImage(imageData, palette, options);
}

// ==============================================================
// 5. 알고리즘: Wu's Algorithm (Wu 양자화) - [신규]
// ==============================================================
export function quantizeWu(imageData, options) {
    const maxColors = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    const { data } = imageData;

    // Wu 알고리즘용 33x33x33 모멘트 히스토그램 (JS 성능 최적화)
    const size = 33;
    const size3 = size * size * size;
    const vwt = new Float64Array(size3);
    const vmr = new Float64Array(size3);
    const vmg = new Float64Array(size3);
    const vmb = new Float64Array(size3);
    const m2 = new Float64Array(size3);

    // 1. 히스토그램 구축
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        const r = (data[i] >> 3) + 1; // 5비트 축소 (0~31) + 1
        const g = (data[i+1] >> 3) + 1;
        const b = (data[i+2] >> 3) + 1;
        const index = (r * size * size) + (g * size) + b;
        
        vwt[index]++;
        vmr[index] += data[i];
        vmg[index] += data[i+1];
        vmb[index] += data[i+2];
        m2[index] += (data[i]*data[i] + data[i+1]*data[i+1] + data[i+2]*data[i+2]);
    }

    // 2. 누적 합(Moments) 계산
    for (let r = 1; r < size; r++) {
        const area = [0,0,0,0,0];
        const area_r = r * size * size;
        for (let g = 1; g < size; g++) {
            let line = [0,0,0,0,0];
            const area_g = area_r + g * size;
            for (let b = 1; b < size; b++) {
                const idx = area_g + b;
                const prev = idx - 1; // b-1
                
                line[0] += vwt[idx]; line[1] += vmr[idx];
                line[2] += vmg[idx]; line[3] += vmb[idx];
                line[4] += m2[idx];
                
                const prevPlane = ((r-1) * size * size) + (g * size) + b;
                
                vwt[idx] = vwt[prevPlane] + area[0] + line[0];
                vmr[idx] = vmr[prevPlane] + area[1] + line[1];
                vmg[idx] = vmg[prevPlane] + area[2] + line[2];
                vmb[idx] = vmb[prevPlane] + area[3] + line[3];
                m2[idx]  = m2[prevPlane]  + area[4] + line[4];
            }
            for(let k=0; k<5; k++) area[k] += line[k];
        }
    }

    // 3차원 볼륨 계산 헬퍼
    function vol(cube, moment) {
        return moment[((cube.r1)*size*size) + (cube.g1)*size + cube.b1]
             - moment[((cube.r1)*size*size) + (cube.g1)*size + cube.b0]
             - moment[((cube.r1)*size*size) + (cube.g0)*size + cube.b1]
             + moment[((cube.r1)*size*size) + (cube.g0)*size + cube.b0]
             - moment[((cube.r0)*size*size) + (cube.g1)*size + cube.b1]
             + moment[((cube.r0)*size*size) + (cube.g1)*size + cube.b0]
             + moment[((cube.r0)*size*size) + (cube.g0)*size + cube.b1]
             - moment[((cube.r0)*size*size) + (cube.g0)*size + cube.b0];
    }

    // 박스 구조체
    class Box {
        constructor(r0, r1, g0, g1, b0, b1) {
            this.r0 = r0; this.r1 = r1;
            this.g0 = g0; this.g1 = g1;
            this.b0 = b0; this.b1 = b1;
        }
    }

    // 분산 계산
    function variance(cube) {
        const w = vol(cube, vwt);
        if (w === 0) return 0;
        const r = vol(cube, vmr);
        const g = vol(cube, vmg);
        const b = vol(cube, vmb);
        const xx = vol(cube, m2);
        return xx - (r*r + g*g + b*b) / w;
    }

    // 큐브 자르기 (Maximize Variance)
    function cut(cube) {
        let maxVar = -1;
        let bestDim = -1;
        let bestCut = -1;
        
        // RGB 축 각각에 대해 최적 절단면 탐색
        // (간소화를 위해 각 축의 중간 지점을 기준으로 평가)
        const ranges = [cube.r1 - cube.r0, cube.g1 - cube.g0, cube.b1 - cube.b0];
        // 가장 긴 축을 찾아서 그 축을 기준으로 절단
        let dim = 0;
        if (ranges[1] >= ranges[0] && ranges[1] >= ranges[2]) dim = 1;
        if (ranges[2] >= ranges[0] && ranges[2] >= ranges[1]) dim = 2;

        // 단순 중앙 분할 대신, 실제로는 각 분할점의 Variance를 계산해야 Wu 알고리즘의 진가 발휘
        // 하지만 JS 성능상 여기서는 가중치(pixel count)가 절반이 되는 지점을 찾거나 중앙을 사용
        let split = 0;
        if (dim === 0) split = Math.floor((cube.r0 + cube.r1) / 2);
        else if (dim === 1) split = Math.floor((cube.g0 + cube.g1) / 2);
        else split = Math.floor((cube.b0 + cube.b1) / 2);

        const c1 = new Box(cube.r0, cube.r1, cube.g0, cube.g1, cube.b0, cube.b1);
        const c2 = new Box(cube.r0, cube.r1, cube.g0, cube.g1, cube.b0, cube.b1);

        if (dim === 0) { c1.r1 = split; c2.r0 = split; }
        else if (dim === 1) { c1.g1 = split; c2.g0 = split; }
        else { c1.b1 = split; c2.b0 = split; }

        return [c1, c2];
    }

    let cubes = [new Box(0, 32, 0, 32, 0, 32)];
    
    while (cubes.length < maxColors) {
        let bestIndex = -1;
        let maxV = -1;
        
        // 분산이 가장 큰 큐브 선택
        for (let i = 0; i < cubes.length; i++) {
            const v = variance(cubes[i]);
            if (v > maxV) { maxV = v; bestIndex = i; }
        }
        
        if (bestIndex === -1 || maxV <= 0) break;
        
        const res = cut(cubes[bestIndex]);
        cubes.splice(bestIndex, 1, res[0], res[1]);
    }

    // 팔레트 추출
    const palette = cubes.map(c => {
        const w = vol(c, vwt);
        if (w === 0) return [0,0,0];
        return [
            Math.round(vol(c, vmr) / w),
            Math.round(vol(c, vmg) / w),
            Math.round(vol(c, vmb) / w)
        ];
    });

    return applyPaletteToImage(imageData, palette, options);
}

// ==============================================================
// 6. 알고리즘: K-Means (기존 유지)
// ==============================================================
export function posterizeWithKMeans(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 64) : 8;
    const quantMethod = (options && options.quantMethod) || 'kmeans++';
    const colorSpace = (options && options.colorSpace) || 'rgb';
    const useOklab = colorSpace === 'oklab';
    
    // 샘플링
    const samples = samplePixels(imageData, 4096);
    if (samples.length === 0) return { centroids: [[0,0,0]], posterizedData: imageData };

    let finalCentroids = [];
    if (k >= samples.length) {
        const uniqueSet = new Set(samples.map(p => p.join(',')));
        finalCentroids = Array.from(uniqueSet).map(s => s.split(',').map(Number));
    } else {
        const centroids = [];
        const centroidIndices = new Set();
        // 초기화 (K-Means++)
        const distances = new Array(samples.length).fill(Infinity);
        let firstIndex = (quantMethod === 'deterministic') ? 0 : Math.floor(Math.random() * samples.length);
        centroids.push(samples[firstIndex]);
        centroidIndices.add(firstIndex);
        
        for (let i = 1; i < k; i++) {
            let sum = 0;
            const lastCentroid = useOklab ? ColorConverter.rgbToOklab(centroids[i - 1]) : centroids[i - 1];
            for (let j = 0; j < samples.length; j++) {
                const p = useOklab ? ColorConverter.rgbToOklab(samples[j]) : samples[j];
                const d = useOklab ? ColorConverter.deltaE2000(p, lastCentroid) : colorDistanceSq(p, lastCentroid);
                if (d < distances[j]) distances[j] = d;
                sum += distances[j];
            }
            if (sum === 0) break;
            const rand = Math.random() * sum;
            let partialSum = 0;
            for (let j = 0; j < samples.length; j++) {
                partialSum += distances[j];
                if (partialSum >= rand) {
                    if (!centroidIndices.has(j)) { centroids.push(samples[j]); centroidIndices.add(j); } 
                    else { i--; }
                    break;
                }
            }
        }
        
        // 반복
        let iterations = 0;
        let moved = true;
        let centroidColors = useOklab ? centroids.map(c => ColorConverter.rgbToOklab(c)) : centroids;
        const assignments = new Array(samples.length);

        while (moved && iterations < 20) {
            moved = false;
            for (let i = 0; i < samples.length; i++) {
                let minDistance = Infinity; 
                let bestCentroid = 0;
                const p = useOklab ? ColorConverter.rgbToOklab(samples[i]) : samples[i];
                for (let j = 0; j < centroids.length; j++) {
                    const dist = useOklab ? ColorConverter.deltaE2000(p, centroidColors[j]) : colorDistanceSq(p, centroidColors[j]);
                    if (dist < minDistance) { minDistance = dist; bestCentroid = j; }
                }
                if (assignments[i] !== bestCentroid) { assignments[i] = bestCentroid; moved = true; }
            }
            const newCentroids = new Array(centroids.length).fill(0).map(() => [0, 0, 0]);
            const counts = new Array(centroids.length).fill(0);
            for (let i = 0; i < samples.length; i++) {
                const cid = assignments[i];
                newCentroids[cid][0] += samples[i][0]; 
                newCentroids[cid][1] += samples[i][1]; 
                newCentroids[cid][2] += samples[i][2];
                counts[cid]++;
            }
            for (let i = 0; i < centroids.length; i++) {
                if (counts[i] > 0) {
                    centroids[i] = [newCentroids[i][0] / counts[i], newCentroids[i][1] / counts[i], newCentroids[i][2] / counts[i]];
                }
            }
            if (useOklab) centroidColors = centroids.map(c => ColorConverter.rgbToOklab(c));
            iterations++;
        }
        finalCentroids = centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    }

    return applyPaletteToImage(imageData, finalCentroids, options);
}