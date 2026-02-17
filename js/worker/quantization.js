// js/worker/quantization.js
import { clamp, colorDistanceSq, ColorConverter } from './color.js';

// 1. 전처리 함수 (기존 유지)
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

// 2. K-Means 포스터화
export function posterizeWithKMeans(imageData, options) {
    // [안전장치] options가 없거나 levels가 없으면 기본값 8 사용
    const k = (options && options.levels) ? clamp(options.levels, 2, 64) : 8;
    const quantMethod = (options && options.quantMethod) || 'kmeans++';
    const colorSpace = (options && options.colorSpace) || 'rgb';
    
    const { data, width, height } = imageData;
    const useOklab = colorSpace === 'oklab';
    
    // [최적화 1] 샘플링
    const MAX_SAMPLES = 4096;
    const totalPixels = width * height;
    const step = Math.max(1, Math.floor(totalPixels / MAX_SAMPLES)) * 4;
    
    const samples = [];
    const samplesOklab = useOklab ? [] : null;

    for (let i = 0; i < data.length; i += step) {
        if (data[i + 3] > 128) {
            const rgb = [data[i], data[i + 1], data[i + 2]];
            samples.push(rgb);
            if (useOklab) { samplesOklab.push(ColorConverter.rgbToOklab(rgb)); }
        }
    }

    // 샘플 데이터가 극도로 적을 경우 처리
    if (samples.length === 0) {
        // 이미지가 투명하거나 데이터가 없음 -> 검은색 1개 반환
        return { centroids: [[0,0,0]], posterizedData: imageData };
    }

    let finalCentroids = [];

    // [핵심 수정] 샘플이 요청한 k보다 적을 경우, 원본을 반환하지 않고
    // 존재하는 색상들만으로 구성된 '유효 센트로이드'를 만듭니다.
    if (k >= samples.length) {
        const uniqueSet = new Set(samples.map(p => p.join(',')));
        finalCentroids = Array.from(uniqueSet).map(s => s.split(',').map(Number));
    } else {
        // --- K-Means 학습 시작 ---
        const centroids = [];
        const centroidIndices = new Set();

        // 초기화 (K-Means++)
        if (quantMethod === 'kmeans++' || quantMethod === 'deterministic') {
            const distances = new Array(samples.length).fill(Infinity);
            let firstIndex = (quantMethod === 'deterministic') ? 0 : Math.floor(Math.random() * samples.length);
            centroids.push(samples[firstIndex]);
            centroidIndices.add(firstIndex);
            
            for (let i = 1; i < k; i++) {
                let sum = 0;
                const lastCentroid = useOklab ? ColorConverter.rgbToOklab(centroids[i - 1]) : centroids[i - 1];
                
                for (let j = 0; j < samples.length; j++) {
                    const p = useOklab ? samplesOklab[j] : samples[j];
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
        } else {
            // Random Init
            while (centroids.length < k) {
                const index = Math.floor(Math.random() * samples.length);
                if (!centroidIndices.has(index)) { centroids.push(samples[index]); centroidIndices.add(index); }
            }
        }

        // 반복 학습
        const assignments = new Array(samples.length);
        let iterations = 0;
        let moved = true;
        
        let centroidColors = useOklab ? centroids.map(c => ColorConverter.rgbToOklab(c)) : centroids;

        while (moved && iterations < 20) {
            moved = false;
            
            // 할당
            for (let i = 0; i < samples.length; i++) {
                let minDistance = Infinity; 
                let bestCentroid = 0;
                const p = useOklab ? samplesOklab[i] : samples[i];
                
                for (let j = 0; j < centroids.length; j++) {
                    const dist = useOklab ? ColorConverter.deltaE2000(p, centroidColors[j]) : colorDistanceSq(p, centroidColors[j]);
                    if (dist < minDistance) { minDistance = dist; bestCentroid = j; }
                }
                if (assignments[i] !== bestCentroid) { assignments[i] = bestCentroid; moved = true; }
            }

            // 업데이트
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
                    centroids[i] = [
                        newCentroids[i][0] / counts[i], 
                        newCentroids[i][1] / counts[i], 
                        newCentroids[i][2] / counts[i]
                    ];
                }
            }
            if (useOklab) centroidColors = centroids.map(c => ColorConverter.rgbToOklab(c));
            
            iterations++;
        }
        finalCentroids = centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    }

    // --- [최적화 2] 결과 적용 (전체 픽셀에 학습된 센트로이드 적용) ---
    // 여기서 원본 imageData를 반환하지 않고, 반드시 Quantize된 새 이미지를 생성해 반환합니다.
    const posterizedData = new ImageData(width, height);
    const finalCentroidsConv = useOklab ? finalCentroids.map(c => ColorConverter.rgbToOklab(c)) : finalCentroids;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const p = useOklab ? ColorConverter.rgbToOklab([r,g,b]) : [r,g,b];

            let minDistance = Infinity;
            let bestIndex = 0;
            
            for (let j = 0; j < finalCentroids.length; j++) {
                const dist = useOklab ? ColorConverter.deltaE2000(p, finalCentroidsConv[j]) : colorDistanceSq(p, finalCentroidsConv[j]);
                if (dist < minDistance) { minDistance = dist; bestIndex = j; }
            }
            
            const bestColor = finalCentroids[bestIndex];
            posterizedData.data[i] = bestColor[0];
            posterizedData.data[i + 1] = bestColor[1];
            posterizedData.data[i + 2] = bestColor[2];
            posterizedData.data[i + 3] = 255;
        } else {
            posterizedData.data[i + 3] = 0;
        }
    }

    return { centroids: finalCentroids, posterizedData };
}