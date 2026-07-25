import { ColorConverter, colorDistanceSq } from './color.js';

// 🌟 [K-Means 궁극기] 3가지 옵션을 지원하는 색상 추출 알고리즘
export function extractExactKMeansPalette(imageData, colorCount, options = {}) {
    const data = imageData.data;
    const pixels = [];
    
    // [옵션 수신] 유저가 UI에서 껐다 켤 수 있도록 준비
    const useOklab = options.kmeansUseOklab ?? false;
    const chromaBoost = options.kmeansChromaBoost ?? 0; // 0이면 가중치 없음, 높을수록 채도 우대

    // 1. 유효한 픽셀만 수집 (투명한 찌꺼기는 이미 flattenAlpha로 날아간 상태!)
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; 
        
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let point = [r, g, b];
        let weight = 1.0;

        // 🌟 [토글 A & B] Oklab 변환 및 채도 가중치 계산
        if (useOklab || chromaBoost > 0) {
            const oklab = ColorConverter.rgbToOklab([r, g, b]);
            if (useOklab) point = oklab; // 작업 공간을 Oklab으로 이전
            
            if (chromaBoost > 0) {
                // 채도(Chroma) = a와 b의 벡터 길이. 채도가 높을수록 투표권(Weight)을 막대하게 줍니다!
                const chroma = Math.sqrt(oklab[1] ** 2 + oklab[2] ** 2);
                weight = 1.0 + (chroma * chromaBoost);
            }
        }
        pixels.push({ pos: point, weight: weight, origRgb: [r, g, b] });
    }

    if (pixels.length === 0) return [[0,0,0]];
    if (pixels.length <= colorCount) return Array.from(new Set(pixels.map(p => p.origRgb)));

    // 2. 🌟 [밑반찬] K-Means++ 초기점 설정 (가장 멀리 떨어진 색들을 우선 선발)
    const centroids = [];
    // 첫 번째 색상은 무작위로 선택
    const firstCentroid = pixels[Math.floor(Math.random() * pixels.length)].pos;
    centroids.push(firstCentroid);

    const distToCentroid = (pos, centroid) => useOklab
        ? Math.pow(pos[0] - centroid[0], 2) + Math.pow(pos[1] - centroid[1], 2) + Math.pow(pos[2] - centroid[2], 2)
        : colorDistanceSq(pos, centroid);

    // 🌟 [성능] 예전엔 라운드마다 모든 기존 중심점과 다시 거리를 재서 O(K^2 * N)이었음.
    // "각 픽셀의 가장 가까운 중심점까지 거리"를 유지하며 새로 뽑힌 중심점 1개와만 비교하도록 바꿔서 O(K * N)으로 축소.
    // (addSlider의 256 상한을 없애면서 K가 수백~수천까지 커질 수 있어 이 최적화가 필수가 됨)
    const minDistSq = new Float32Array(pixels.length);
    for (let j = 0; j < pixels.length; j++) minDistSq[j] = distToCentroid(pixels[j].pos, firstCentroid);

    for (let i = 1; i < colorCount; i++) {
        let sumDistSq = 0;
        for (let j = 0; j < pixels.length; j++) sumDistSq += minDistSq[j];

        // 거리가 멀수록(기존 색과 다를수록) 다음 중심으로 뽑힐 확률이 높아집니다!
        let target = Math.random() * sumDistSq;
        let cumulative = 0;
        let chosenPos = null;
        for (let j = 0; j < pixels.length; j++) {
            cumulative += minDistSq[j];
            if (cumulative >= target) {
                chosenPos = pixels[j].pos;
                break;
            }
        }
        // 부동소수점 오차로 못 골랐을 때의 방어 (마지막 픽셀로 폴백)
        if (!chosenPos) chosenPos = pixels[pixels.length - 1].pos;

        centroids.push(chosenPos);

        // 새로 뽑힌 중심점 기준으로만 "가장 가까운 거리"를 갱신 (기존 중심점들과는 다시 비교할 필요 없음)
        for (let j = 0; j < pixels.length; j++) {
            const d = distToCentroid(pixels[j].pos, chosenPos);
            if (d < minDistSq[j]) minDistSq[j] = d;
        }
    }

    // 3. 군집화 (클러스터링) 시작 - 최대 15번만 반복 (속도 최적화)
    const maxIterations = 15;
    const assignments = new Int32Array(pixels.length);

    for (let iter = 0; iter < maxIterations; iter++) {
        let changed = false;
        const newSums = Array(colorCount).fill(0).map(() => [0, 0, 0]);
        const newWeights = Array(colorCount).fill(0);

        // 픽셀들을 가장 가까운 중심점(색상)에 배정
        for (let j = 0; j < pixels.length; j++) {
            let minDistSq = Infinity;
            let bestIndex = 0;
            for (let c = 0; c < colorCount; c++) {
                const distSq = useOklab
                    ? Math.pow(pixels[j].pos[0]-centroids[c][0], 2) + Math.pow(pixels[j].pos[1]-centroids[c][1], 2) + Math.pow(pixels[j].pos[2]-centroids[c][2], 2)
                    : colorDistanceSq(pixels[j].pos, centroids[c]);
                if (distSq < minDistSq) { minDistSq = distSq; bestIndex = c; }
            }
            
            if (assignments[j] !== bestIndex) {
                assignments[j] = bestIndex;
                changed = true;
            }

            // 🌟 [투표 반영] 가중치가 적용된 합산! 쨍한 색이 표를 싹쓸이합니다.
            const w = pixels[j].weight;
            newSums[bestIndex][0] += pixels[j].pos[0] * w;
            newSums[bestIndex][1] += pixels[j].pos[1] * w;
            newSums[bestIndex][2] += pixels[j].pos[2] * w;
            newWeights[bestIndex] += w;
        }

        if (!changed) break; // 더 이상 픽셀 이동이 없으면 조기 종료

        // 중심점 위치 재조정 (평균 내기)
        for (let c = 0; c < colorCount; c++) {
            if (newWeights[c] > 0) {
                centroids[c][0] = newSums[c][0] / newWeights[c];
                centroids[c][1] = newSums[c][1] / newWeights[c];
                centroids[c][2] = newSums[c][2] / newWeights[c];
            }
        }
    }

    // 4. 결과물을 다시 RGB 팔레트로 변환해서 리턴
    return centroids.map(c => {
        if (useOklab) {
            const rgb = ColorConverter.oklabToRgb(c);
            return [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2])];
        } else {
            return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
        }
    });
}