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

// 2. K-Means 포스터화 (성능 최적화: 샘플링 적용)
export function posterizeWithKMeans(imageData, options) {
    const k = (options && options.levels) || 8;
    const quantMethod = (options && options.quantMethod) || 'kmeans++';
    const colorSpace = (options && options.colorSpace) || 'rgb';
    
    const { data, width, height } = imageData;
    const useOklab = colorSpace === 'oklab';
    
    // [최적화 1] 샘플링 (전체 픽셀 대신 일부만 추출하여 클러스터링 학습)
    const MAX_SAMPLES = 4096; // 4096개면 색상 추출에 충분함
    const totalPixels = width * height;
    // 몇 칸씩 건너뛸지 결정 (전체 픽셀 / 최대 샘플 수)
    const step = Math.max(1, Math.floor(totalPixels / MAX_SAMPLES)) * 4;
    
    const samples = [];
    const samplesOklab = useOklab ? [] : null;

    for (let i = 0; i < data.length; i += step) {
        if (data[i + 3] > 128) { // 불투명 픽셀만
            const rgb = [data[i], data[i + 1], data[i + 2]];
            samples.push(rgb);
            if (useOklab) { samplesOklab.push(ColorConverter.rgbToOklab(rgb)); }
        }
    }

    // 데이터가 너무 적으면 원본 반환
    if (samples.length === 0) return { centroids: [[0,0,0]], posterizedData: imageData };
    if (k >= samples.length) {
        // 샘플이 K보다 적으면 중복 제거 후 반환
        const unique = Array.from(new Set(samples.map(p => p.join(',')))).map(s => s.split(',').map(Number));
        return { centroids: unique, posterizedData: imageData };
    }

    // --- K-Means 학습 시작 (샘플 데이터만 사용) ---
    const centroids = [];
    const centroidIndices = new Set();

    // 초기 중심점 선택 (K-Means++)
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
                    else { i--; } // 중복이면 재시도
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

    // 클러스터링 반복 (샘플 데이터 대상)
    // 샘플이 적으므로(4096개) 반복 횟수를 20회 유지해도 매우 빠름
    const assignments = new Array(samples.length);
    let iterations = 0;
    let moved = true;
    
    // 미리 변환된 센트로이드 배열 (루프 밖으로 뺌)
    let centroidColors = useOklab ? centroids.map(c => ColorConverter.rgbToOklab(c)) : centroids;

    while (moved && iterations < 20) {
        moved = false;
        
        // 1. 할당 단계
        for (let i = 0; i < samples.length; i++) {
            let minDistance = Infinity; 
            let bestCentroid = 0;
            const p = useOklab ? samplesOklab[i] : samples[i];
            
            for (let j = 0; j < centroids.length; j++) {
                // 거리 계산 (유클리드 or CIEDE2000)
                const dist = useOklab ? ColorConverter.deltaE2000(p, centroidColors[j]) : colorDistanceSq(p, centroidColors[j]);
                if (dist < minDistance) { minDistance = dist; bestCentroid = j; }
            }
            if (assignments[i] !== bestCentroid) { assignments[i] = bestCentroid; moved = true; }
        }

        // 2. 업데이트 단계 (평균값 이동)
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
        // 센트로이드 색상 갱신
        if (useOklab) centroidColors = centroids.map(c => ColorConverter.rgbToOklab(c));
        else centroidColors = centroids; // 참조 업데이트

        iterations++;
    }

    // --- [최적화 2] 결과 적용 (전체 픽셀에 학습된 센트로이드 적용) ---
    const posterizedData = new ImageData(width, height);
    const finalCentroids = centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    
    // Oklab 모드일 경우 최종 센트로이드도 변환해둠 (매 픽셀 변환 방지)
    const finalCentroidsConv = useOklab ? finalCentroids.map(c => ColorConverter.rgbToOklab(c)) : finalCentroids;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            // 현재 픽셀 색상
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const p = useOklab ? ColorConverter.rgbToOklab([r,g,b]) : [r,g,b];

            // 가장 가까운 센트로이드 찾기 (단순 탐색)
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
            // 투명 픽셀 유지
            posterizedData.data[i + 3] = 0;
        }
    }

    return { centroids: finalCentroids, posterizedData };
}