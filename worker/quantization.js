import { clamp, colorDistanceSq, ColorConverter, findClosestColor, findClosestColorFusion } from './color.js';
import { DitheringEngine } from './dithering.js';

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

function applyPaletteToImage(imageData, palette, options) {
    const { width, height, data } = imageData;
    const posterizedData = new ImageData(width, height);
    const colorMethod = (options && options.colorMethod) || 'rgb';
    let paletteConverted = null;
    if (colorMethod === 'oklab') paletteConverted = palette.map(c => ColorConverter.rgbToOklab(c));
    else if (colorMethod === 'ciede2000' || colorMethod === 'ciede2000-d65') {
        const converter = (colorMethod === 'ciede2000-d65') ? ColorConverter.rgbToLabD65 : ColorConverter.rgbToLab;
        paletteConverted = palette.map(c => converter(c));
    }
    const colorCache = new Map();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const cacheKey = (r << 16) | (g << 8) | b;
            let bestColor = colorCache.get(cacheKey);
            if (!bestColor) {
                bestColor = findClosestColor(r, g, b, palette, paletteConverted, colorMethod).color;
                colorCache.set(cacheKey, bestColor);
            }
            posterizedData.data[i] = bestColor[0]; posterizedData.data[i + 1] = bestColor[1]; posterizedData.data[i + 2] = bestColor[2]; posterizedData.data[i + 3] = data[i + 3];
        } else posterizedData.data[i + 3] = 0;
    }
    return { centroids: palette, posterizedData };
}

function samplePixels(imageData, maxSamples = 4096) {
    const { data, width, height } = imageData;
    const step = Math.max(1, Math.floor((width * height) / maxSamples)) * 4;
    const samples = [];
    for (let i = 0; i < data.length; i += step) if (data[i + 3] > 128) samples.push([data[i], data[i + 1], data[i + 2]]);
    return samples;
}

export function quantizePopularity(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    const colorCounts = new Map();
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] === 0) continue;
        const rgb = (imageData.data[i] << 16) | (imageData.data[i + 1] << 8) | imageData.data[i + 2];
        colorCounts.set(rgb, (colorCounts.get(rgb) || 0) + 1);
    }
    const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
    const palette = sorted.map(([intColor]) => [(intColor >> 16) & 0xFF, (intColor >> 8) & 0xFF, intColor & 0xFF]);
    if (palette.length === 0) palette.push([0, 0, 0]);
    return applyPaletteToImage(imageData, palette, options);
}

export function quantizeMedianCut(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    let pixels = samplePixels(imageData, 8192);
    if (pixels.length === 0) return { centroids: [[0,0,0]], posterizedData: imageData };
    let buckets = [pixels];
    while (buckets.length < k) {
        let largestBucketIdx = -1, maxLen = -1;
        for(let i=0; i<buckets.length; i++) { if(buckets[i].length > maxLen) { maxLen = buckets[i].length; largestBucketIdx = i; } }
        if (largestBucketIdx === -1 || buckets[largestBucketIdx].length < 2) break;
        const bucket = buckets[largestBucketIdx];
        let minR=255, maxR=0, minG=255, maxG=0, minB=255, maxB=0;
        for(let p of bucket) {
            if(p[0]<minR) minR=p[0]; if(p[0]>maxR) maxR=p[0];
            if(p[1]<minG) minG=p[1]; if(p[1]>maxG) maxG=p[1];
            if(p[2]<minB) minB=p[2]; if(p[2]>maxB) maxB=p[2];
        }
        let axis = 0;
        const rRange = maxR - minR, gRange = maxG - minG, bRange = maxB - minB;
        if (gRange >= rRange && gRange >= bRange) axis = 1; else if (bRange >= rRange && bRange >= gRange) axis = 2;
        bucket.sort((a, b) => a[axis] - b[axis]);
        const mid = Math.floor(bucket.length / 2);
        buckets.splice(largestBucketIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
    }
    const palette = buckets.map(bucket => {
        let r=0, g=0, b=0;
        for(let p of bucket) { r+=p[0]; g+=p[1]; b+=p[2]; }
        return [Math.round(r/bucket.length), Math.round(g/bucket.length), Math.round(b/bucket.length)];
    });
    return applyPaletteToImage(imageData, palette, options);
}

export function quantizeOctree(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    let leafCount = 0; const reducibleNodes = Array.from({ length: 8 }, () => []);
    class OctreeNode { constructor(level) { this.r = 0; this.g = 0; this.b = 0; this.count = 0; this.level = level; this.children = new Array(8).fill(null); this.isLeaf = false; } }
    const root = new OctreeNode(0);
    function addColor(node, r, g, b, level) {
        if (node.isLeaf) { node.r += r; node.g += g; node.b += b; node.count++; return; }
        const index = ((r >> (7 - level) & 1) << 2) | ((g >> (7 - level) & 1) << 1) | (b >> (7 - level) & 1);
        if (!node.children[index]) {
            const child = new OctreeNode(level + 1); node.children[index] = child;
            if (level + 1 === 8) { child.isLeaf = true; leafCount++; } else reducibleNodes[level + 1].push(child);
        }
        addColor(node.children[index], r, g, b, level + 1);
    }
    function reduceTree() {
        let lvl = 7; while (lvl >= 0 && reducibleNodes[lvl].length === 0) lvl--;
        if (lvl < 0) return false;
        const node = reducibleNodes[lvl].pop(); let childrenCount = 0;
        for (let i = 0; i < 8; i++) {
            const child = node.children[i];
            if (child) { node.r += child.r; node.g += child.g; node.b += child.b; node.count += child.count; node.children[i] = null; childrenCount++; }
        }
        node.isLeaf = true; leafCount -= (childrenCount - 1); return true;
    }
    for (let i = 0; i < imageData.data.length; i += 16) {
        if (imageData.data[i + 3] < 128) continue;
        addColor(root, imageData.data[i], imageData.data[i+1], imageData.data[i+2], 0);
        while (leafCount > k) { if (!reduceTree()) break; }
    }
    const palette = [];
    function collectLeaves(node) {
        if (node.isLeaf) { if (node.count > 0) palette.push([Math.round(node.r / node.count), Math.round(node.g / node.count), Math.round(node.b / node.count)]); return; }
        for (let i = 0; i < 8; i++) if (node.children[i]) collectLeaves(node.children[i]);
    }
    collectLeaves(root);
    if (palette.length === 0) palette.push([0, 0, 0]);
    return applyPaletteToImage(imageData, palette, options);
}

export function quantizeWu(imageData, options) {
    const maxColors = (options && options.levels) ? clamp(options.levels, 2, 256) : 16;
    const size = 33, size3 = size * size * size;
    const vwt = new Float64Array(size3), vmr = new Float64Array(size3), vmg = new Float64Array(size3), vmb = new Float64Array(size3), m2 = new Float64Array(size3);
    for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] < 128) continue;
        const r = (imageData.data[i] >> 3) + 1, g = (imageData.data[i+1] >> 3) + 1, b = (imageData.data[i+2] >> 3) + 1;
        const idx = (r * size * size) + (g * size) + b;
        vwt[idx]++; vmr[idx] += imageData.data[i]; vmg[idx] += imageData.data[i+1]; vmb[idx] += imageData.data[i+2]; m2[idx] += (imageData.data[i]**2 + imageData.data[i+1]**2 + imageData.data[i+2]**2);
    }
    for (let r = 1; r < size; r++) {
        const area = [0,0,0,0,0], area_r = r * size * size;
        for (let g = 1; g < size; g++) {
            let line = [0,0,0,0,0]; const area_g = area_r + g * size;
            for (let b = 1; b < size; b++) {
                const idx = area_g + b, prev = ((r-1)*size*size) + (g*size) + b;
                line[0] += vwt[idx]; line[1] += vmr[idx]; line[2] += vmg[idx]; line[3] += vmb[idx]; line[4] += m2[idx];
                vwt[idx] = vwt[prev] + area[0] + line[0]; vmr[idx] = vmr[prev] + area[1] + line[1]; vmg[idx] = vmg[prev] + area[2] + line[2]; vmb[idx] = vmb[prev] + area[3] + line[3]; m2[idx] = m2[prev] + area[4] + line[4];
            }
            for(let k=0; k<5; k++) area[k] += line[k];
        }
    }
    function vol(c, m) {
        return m[(c.r1*size*size) + c.g1*size + c.b1] - m[(c.r1*size*size) + c.g1*size + c.b0] - m[(c.r1*size*size) + c.g0*size + c.b1] + m[(c.r1*size*size) + c.g0*size + c.b0]
             - m[(c.r0*size*size) + c.g1*size + c.b1] + m[(c.r0*size*size) + c.g1*size + c.b0] + m[(c.r0*size*size) + c.g0*size + c.b1] - m[(c.r0*size*size) + c.g0*size + c.b0];
    }
    class Box { constructor(r0, r1, g0, g1, b0, b1) { this.r0=r0; this.r1=r1; this.g0=g0; this.g1=g1; this.b0=b0; this.b1=b1; } }
    function variance(c) { const w = vol(c, vwt); if (w === 0) return 0; const r = vol(c, vmr), g = vol(c, vmg), b = vol(c, vmb), xx = vol(c, m2); return xx - (r*r + g*g + b*b) / w; }
    function cut(c) {
        const ranges = [c.r1 - c.r0, c.g1 - c.g0, c.b1 - c.b0];
        let dim = 0; if (ranges[1] >= ranges[0] && ranges[1] >= ranges[2]) dim = 1; if (ranges[2] >= ranges[0] && ranges[2] >= ranges[1]) dim = 2;
        let split = dim === 0 ? Math.floor((c.r0 + c.r1)/2) : dim === 1 ? Math.floor((c.g0 + c.g1)/2) : Math.floor((c.b0 + c.b1)/2);
        const c1 = new Box(c.r0, c.r1, c.g0, c.g1, c.b0, c.b1), c2 = new Box(c.r0, c.r1, c.g0, c.g1, c.b0, c.b1);
        if (dim === 0) { c1.r1 = split; c2.r0 = split; } else if (dim === 1) { c1.g1 = split; c2.g0 = split; } else { c1.b1 = split; c2.b0 = split; }
        return [c1, c2];
    }
    let cubes = [new Box(0, 32, 0, 32, 0, 32)];
    while (cubes.length < maxColors) {
        let bestIndex = -1, maxV = -1;
        for (let i = 0; i < cubes.length; i++) { const v = variance(cubes[i]); if (v > maxV) { maxV = v; bestIndex = i; } }
        if (bestIndex === -1 || maxV <= 0) break;
        const res = cut(cubes[bestIndex]); cubes.splice(bestIndex, 1, res[0], res[1]);
    }
    const palette = cubes.map(c => { const w = vol(c, vwt); return w === 0 ? [0,0,0] : [Math.round(vol(c, vmr)/w), Math.round(vol(c, vmg)/w), Math.round(vol(c, vmb)/w)]; });
    return applyPaletteToImage(imageData, palette, options);
}

export function posterizeWithKMeans(imageData, options) {
    const k = (options && options.levels) ? clamp(options.levels, 2, 64) : 8;
    const quantMethod = (options && options.quantMethod) || 'kmeans++';
    const colorSpace = (options && options.colorSpace) || 'rgb';
    const useOklab = colorSpace === 'oklab';
    const samples = samplePixels(imageData, 4096);
    if (samples.length === 0) return { centroids: [[0,0,0]], posterizedData: imageData };

    let finalCentroids = [];
    if (k >= samples.length) {
        const uniqueSet = new Set(samples.map(p => p.join(',')));
        finalCentroids = Array.from(uniqueSet).map(s => s.split(',').map(Number));
    } else {
        const centroids = []; const centroidIndices = new Set(); const distances = new Array(samples.length).fill(Infinity);
        let firstIndex = (quantMethod === 'deterministic') ? 0 : Math.floor(Math.random() * samples.length);
        centroids.push(samples[firstIndex]); centroidIndices.add(firstIndex);
        
        for (let i = 1; i < k; i++) {
            let sum = 0; const lastCentroid = useOklab ? ColorConverter.rgbToOklab(centroids[i - 1]) : centroids[i - 1];
            for (let j = 0; j < samples.length; j++) {
                const p = useOklab ? ColorConverter.rgbToOklab(samples[j]) : samples[j];
                const d = useOklab ? ColorConverter.deltaE2000(p, lastCentroid) : colorDistanceSq(p, lastCentroid);
                if (d < distances[j]) distances[j] = d;
                sum += distances[j];
            }
            if (sum === 0) break;
            const rand = Math.random() * sum; let partialSum = 0;
            for (let j = 0; j < samples.length; j++) {
                partialSum += distances[j];
                if (partialSum >= rand) {
                    if (!centroidIndices.has(j)) { centroids.push(samples[j]); centroidIndices.add(j); } else { i--; }
                    break;
                }
            }
        }
        
        let iterations = 0, moved = true;
        let centroidColors = useOklab ? centroids.map(c => ColorConverter.rgbToOklab(c)) : centroids;
        const assignments = new Array(samples.length);

        while (moved && iterations < 20) {
            moved = false;
            for (let i = 0; i < samples.length; i++) {
                let minDistance = Infinity, bestCentroid = 0;
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
                newCentroids[cid][0] += samples[i][0]; newCentroids[cid][1] += samples[i][1]; newCentroids[cid][2] += samples[i][2];
                counts[cid]++;
            }
            for (let i = 0; i < centroids.length; i++) {
                if (counts[i] > 0) centroids[i] = [newCentroids[i][0] / counts[i], newCentroids[i][1] / counts[i], newCentroids[i][2] / counts[i]];
            }
            if (useOklab) centroidColors = centroids.map(c => ColorConverter.rgbToOklab(c));
            iterations++;
        }
        finalCentroids = centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    }
    return applyPaletteToImage(imageData, finalCentroids, options);
}

const _getMap = (arr) => {
    let m = 0;
    arr.forEach(row => row.forEach(v => { if (v > m) m = v; }));
    return { data: arr, max: m + 1 };
};

const DitherMaps = {
    bayer2: _getMap([[0, 2], [3, 1]]),
    bayer4: _getMap([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]),
    bayer8: _getMap([
        [ 0, 32,  8, 40,  2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44,  4, 36, 14, 46,  6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
        [ 3, 35, 11, 43,  1, 33,  9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47,  7, 39, 13, 45,  5, 37], [63, 31, 55, 23, 61, 29, 53, 21]
    ]),
    grid: _getMap([[0, 2], [2, 1]]),
    vertical: _getMap([[0, 2, 1, 3]]),
    checkerboard: _getMap([[0, 1], [1, 0]]),
    diagonal_r: _getMap([[0,3,2,1],[1,0,3,2],[2,1,0,3],[3,2,1,0]]),
    diagonal_l: _getMap([[1,2,3,0],[2,3,0,1],[3,0,1,2],[0,1,2,3]]),
    brick: _getMap([ [0, 2, 0, 2], [3, 3, 3, 3], [0, 2, 0, 2], [1, 1, 1, 1] ]),
    crt: _getMap([ [0, 6, 3], [5, 2, 8], [4, 7, 1] ]),
    maze: _getMap([
        [ 1, 14, 10,  2, 11, 15,  3,  8], [ 5,  9,  6, 13,  7,  1, 12,  4],
        [15,  2, 11,  3, 14, 10,  5,  9], [ 8, 12,  4, 16,  6,  2, 13,  1],
        [ 3,  7, 15,  9,  1, 11,  8, 14], [10,  1,  5, 12,  4, 16,  2,  6],
        [13, 11,  8,  2, 15,  7, 10,  3], [ 4,  6, 14, 10,  5,  9, 12,  1]
    ])
};

const ErrorDiffusion = {
    floyd: [ {x:1, y:0, w:7/16}, {x:-1, y:1, w:3/16}, {x:0, y:1, w:5/16}, {x:1, y:1, w:1/16} ],
    sierra: [
        {x:1, y:0, w:4/16}, {x:2, y:0, w:3/16},
        {x:-2, y:1, w:1/16}, {x:-1, y:1, w:2/16}, {x:0, y:1, w:3/16}, {x:1, y:1, w:2/16}, {x:2, y:1, w:1/16}
    ],
    atkinson: [
        {x:1, y:0, w:1/8}, {x:2, y:0, w:1/8},
        {x:-1, y:1, w:1/8}, {x:0, y:1, w:1/8}, {x:1, y:1, w:1/8},
        {x:0, y:2, w:1/8}
    ]
};

// 🌟 2. 수학 엔진 객체 생성
const ditherEngine = new DitheringEngine();

export function matchColorAndDither(imageData, activePalette, options) {
    // 🚨 여기서 가로세로 크기를 가져옵니다! (이게 지워져서 에러가 났던 것입니다)
    const { width, height, data } = imageData; 
    const result = new Uint8ClampedArray(data);
    
    // 오차 확산을 정밀하게 기록하기 위한 소수점(Float) 도화지
    const fData = new Float32Array(data); 

    const fusionParams = options.fusionParams || { modelA: 'oklab', modelB: 'none', weightM: 0, chromaBoost: 0 };
    
    // 팔레트 변환 캐싱
    const preparedPalette = activePalette.map(p => {
        const rgb = p.rgb || p; 
        return {
            rgb: rgb, oklab: ColorConverter.rgbToOklab(rgb),
            labD50: ColorConverter.rgbToLab(rgb), labD65: ColorConverter.rgbToLabD65(rgb)
        };
    });

    const colorCache = new Map();
    const getMatchedColor = (r, g, b) => {
        const key = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b); 
        let cached = colorCache.get(key);
        if (!cached) {
            cached = findClosestColorFusion(r, g, b, preparedPalette, fusionParams).color;
            colorCache.set(key, cached);
        }
        return cached;
    };

    // 기본 패턴 실시간 번역
    let activePatternMatrix = null;
    if (options.useMacroPattern) {
        if (options.patternType === 'custom' && options.patternMatrix) {
            activePatternMatrix = options.patternMatrix;
        } else if (DitherMaps[options.patternType]) {
            const map = DitherMaps[options.patternType];
            const m = map.max - 1; 
            activePatternMatrix = map.data.map(row => row.map(val => (val / m) * 2));
        }
    }

    console.log("🛠️ [Worker] 패턴 및 디더링 렌더링 상태:", {
        패턴사용: options.useMacroPattern,
        패턴타입: options.patternType,
        패턴크기: options.patternSize,
        패턴강도: options.patternStrength,
        매트릭스: activePatternMatrix ? "정상 장전됨" : "비어있음",
        미세디더링: options.useMicroDither,
        디더방식: options.basicDitherType
    });

    const isBayer = options.useMicroDither && options.basicDitherType === 'bayer';
    const isErrorDiffusion = options.useMicroDither && ErrorDiffusion[options.basicDitherType];
    const diffMap = isErrorDiffusion ? ErrorDiffusion[options.basicDitherType] : null;
    const safeDitherMultiplier = ((options.ditheringIntensity || 50) / 100) * 0.85;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] === 0) continue; 

            // fData에서 오차가 누적된 값을 가져옵니다.
            let r = fData[i], g = fData[i+1], b = fData[i+2];

            // 🌟 1차 방어막: 이전 픽셀들로부터 오차를 너무 많이 받아 폭주했다면 여기서 잘라냅니다.
            r = Math.max(0, Math.min(255, r));
            g = Math.max(0, Math.min(255, g));
            b = Math.max(0, Math.min(255, b));

            let shiftedR = r, shiftedG = g, shiftedB = b;
            
            // 1. 패턴 & 베이어 변조
            if (activePatternMatrix || isBayer) {
                const shifted = ditherEngine.applySuperposition(r, g, b, x, y, {
                    useBayer: isBayer,
                    ditherStrength: options.ditheringIntensity,
                    bayerSize: options.bayerSize || 1, 
                    patternMatrix: activePatternMatrix,
                    patternStrength: options.patternStrength,
                    patternSize: options.patternSize || 2 
                });
                shiftedR = shifted.r; shiftedG = shifted.g; shiftedB = shifted.b;
            }

            // 🌟 2차 방어막: 엔진이 흔들어놓은 값도 Oklab에 넣기 전에 안전하게 가둬버립니다!
            const safeR = Math.max(0, Math.min(255, shiftedR));
            const safeG = Math.max(0, Math.min(255, shiftedG));
            const safeB = Math.max(0, Math.min(255, shiftedB));

            // 안전하게 매칭 수행
            const color = getMatchedColor(safeR, safeG, safeB);
            result[i] = color[0]; result[i+1] = color[1]; result[i+2] = color[2];

            // 3. 오차 확산 (Floyd, Sierra, Atkinson) 적용
            if (isErrorDiffusion) {
                // 오차 계산은 방어막을 거친 1차 안전값(r, g, b) 기준으로 계산해야 폭주하지 않습니다!
                const errR = r - color[0];
                const errG = g - color[1];
                const errB = b - color[2];

                for (let d of diffMap) {
                    const nx = x + d.x;
                    const ny = y + d.y;
                    if (nx >= 0 && nx < width && ny < height) {
                        const ni = (ny * width + nx) * 4;
                        if (data[ni + 3] > 0) { 
                            fData[ni] += errR * d.w * safeDitherMultiplier;
                            fData[ni+1] += errG * d.w * safeDitherMultiplier;
                            fData[ni+2] += errB * d.w * safeDitherMultiplier;
                        }
                    }
                }
            }
        }
    }
    return new ImageData(result, width, height);
}