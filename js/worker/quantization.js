// js/worker/quantization.js
import { clamp, colorDistanceSq, ColorConverter } from './color.js';

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

export function posterizeWithKMeans(imageData, options) {
    // 옵션 기본값 처리 (options가 undefined일 경우 대비)
    const k = (options && options.levels) || 8;
    const quantMethod = (options && options.quantMethod) || 'kmeans++';
    const colorSpace = (options && options.colorSpace) || 'rgb';
    
    const { data, width, height } = imageData;
    const useOklab = colorSpace === 'oklab';
    const pixels = [];
    const oklabPixels = useOklab ? [] : null;
    
    // 유효 픽셀 수집
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) { // 투명하지 않은 픽셀만
            const rgb = [data[i], data[i + 1], data[i + 2]];
            pixels.push(rgb);
            if (useOklab) { oklabPixels.push(ColorConverter.rgbToOklab(rgb)); }
        }
    }
    
    // [수정됨] 유효한 픽셀이 하나도 없으면 원본 그대로 반환 (에러 방지)
    if (pixels.length === 0) {
        return { centroids: [[0,0,0]], posterizedData: imageData };
    }
    
    // 픽셀 수가 K보다 적으면 그냥 있는 색상 그대로 씀
    if (k >= pixels.length) {
        // 중복 제거해서 centroids로 반환
        const uniquePixels = Array.from(new Set(pixels.map(p => p.join(',')))).map(s => s.split(',').map(Number));
        return { centroids: uniquePixels, posterizedData: imageData };
    }
    
    const centroids = [];
    const centroidIndices = new Set();
    
    // 초기 중심점 선택 (K-Means++ 등)
    if (quantMethod === 'kmeans++' || quantMethod === 'deterministic') {
        const distances = new Array(pixels.length).fill(Infinity);
        let firstIndex = (quantMethod === 'deterministic') ? 0 : Math.floor(Math.random() * pixels.length);
        centroids.push(pixels[firstIndex]);
        centroidIndices.add(firstIndex);
        
        for (let i = 1; i < k; i++) {
            let sum = 0;
            const lastCentroid = useOklab ? ColorConverter.rgbToOklab(centroids[i - 1]) : centroids[i - 1];
            for (let j = 0; j < pixels.length; j++) {
                const p = useOklab ? oklabPixels[j] : pixels[j];
                const d = useOklab ? ColorConverter.deltaE2000(p, lastCentroid) : colorDistanceSq(p, lastCentroid);
                if (d < distances[j]) distances[j] = d;
                sum += distances[j];
            }
            
            // [안전장치] 모든 거리가 0이면(모든 픽셀이 같은 색) 중단
            if (sum === 0) break;

            const rand = Math.random() * sum;
            let partialSum = 0;
            for (let j = 0; j < pixels.length; j++) {
                partialSum += distances[j];
                if (partialSum >= rand) {
                    if (!centroidIndices.has(j)) { centroids.push(pixels[j]); centroidIndices.add(j); } else { i--; }
                    break;
                }
            }
        }
    } else {
        // Random 방식
        while (centroids.length < k) {
            const index = Math.floor(Math.random() * pixels.length);
            if (!centroidIndices.has(index)) { centroids.push(pixels[index]); centroidIndices.add(index); }
        }
    }
    
    // K-Means 반복 (Clustering)
    const assignments = new Array(pixels.length);
    let iterations = 0;
    let moved = true;
    while (moved && iterations < 20) { // 최대 20회 반복
        moved = false;
        const centroidColors = useOklab ? centroids.map(c => ColorConverter.rgbToOklab(c)) : centroids;
        for (let i = 0; i < pixels.length; i++) {
            let minDistance = Infinity; let bestCentroid = 0;
            const p = useOklab ? oklabPixels[i] : pixels[i];
            for (let j = 0; j < centroids.length; j++) {
                const distance = useOklab ? ColorConverter.deltaE2000(p, centroidColors[j]) : colorDistanceSq(p, centroidColors[j]);
                if (distance < minDistance) { minDistance = distance; bestCentroid = j; }
            }
            if (assignments[i] !== bestCentroid) { assignments[i] = bestCentroid; moved = true; }
        }
        const newCentroids = new Array(centroids.length).fill(0).map(() => [0, 0, 0]);
        const counts = new Array(centroids.length).fill(0);
        for (let i = 0; i < pixels.length; i++) {
            const centroidIndex = assignments[i];
            newCentroids[centroidIndex][0] += pixels[i][0]; newCentroids[centroidIndex][1] += pixels[i][1]; newCentroids[centroidIndex][2] += pixels[i][2];
            counts[centroidIndex]++;
        }
        for (let i = 0; i < centroids.length; i++) {
            if (counts[i] > 0) {
                centroids[i] = [newCentroids[i][0] / counts[i], newCentroids[i][1] / counts[i], newCentroids[i][2] / counts[i]];
            }
        }
        iterations++;
    }
    
    // 결과 생성
    const posterizedData = new ImageData(width, height);
    let pixelIndex = 0;
    for (let i = 0; i < posterizedData.data.length; i += 4) {
        if (data[i + 3] > 128) {
            const centroid = centroids[assignments[pixelIndex++]];
            // [안전장치] centroid가 undefined일 경우 대비 (검은색 처리)
            if (centroid) {
                posterizedData.data[i] = centroid[0]; posterizedData.data[i + 1] = centroid[1]; posterizedData.data[i + 2] = centroid[2]; posterizedData.data[i + 3] = 255;
            } else {
                posterizedData.data[i] = 0; posterizedData.data[i + 1] = 0; posterizedData.data[i + 2] = 0; posterizedData.data[i + 3] = 255;
            }
        }
    }
    const finalCentroids = centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    return { centroids: finalCentroids, posterizedData };
}