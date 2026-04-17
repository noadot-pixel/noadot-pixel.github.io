// js/worker/analysis.js

// 1. 유틸리티 함수
const rgbToHex = (r, g, b) => ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();

const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } 
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
};

const colorDistSq = (c1, c2) => (c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2;

// 2. 추천 알고리즘 메인 함수
export const calculateRecommendations = (imageData, currentPalette, options) => {
    const { data, width, height } = imageData;
    const totalRawPixels = width * height;
    
    // [설정] 이미지가 너무 크지 않으면 전수 조사 (정확도 우선)
    const skip = (totalRawPixels > 1000000) ? 4 : 1; 
    
    const colorStats = new Map();
    let validPixelCount = 0; 

    // 전체 픽셀 스캔
    for (let i = 0; i < data.length; i += 4 * skip) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3]; 

        if (a > 0) {
            validPixelCount++;
            const key = rgbToHex(r, g, b);
            if (!colorStats.has(key)) {
                colorStats.set(key, { count: 0, rgb: [r, g, b] });
            }
            colorStats.get(key).count++;
        }
    }

    const totalValidPixels = validPixelCount * skip || 1;

    // --- 추천 로직 시작 ---
    const sortedColors = Array.from(colorStats.values()).sort((a, b) => b.count - a.count);
    const recommendations = [];
    const exclusionHexSet = new Set();

    // 현재 팔레트에 있는 색상은 추천에서 제외 (이미 있으니까)
    currentPalette.forEach(p => {
        exclusionHexSet.add(rgbToHex(p[0], p[1], p[2]));
    });

    if (options.disabledHexes && Array.isArray(options.disabledHexes)) {
        options.disabledHexes.forEach(hex => {
            exclusionHexSet.add(hex);
        });
    }

    const addRec = (item, tag, forced = false) => {
        const hex = rgbToHex(item.rgb[0], item.rgb[1], item.rgb[2]);
        if (!forced && exclusionHexSet.has(hex)) return;
        
        // 이미 추천 목록에 있는 색상이면 패스
        if (recommendations.some(r => rgbToHex(r.rgb[0], r.rgb[1], r.rgb[2]) === hex)) return;
        
        // 추천 목록에 있는 다른 색상과 너무 비슷하면 패스
        const isTooClose = recommendations.some(r => colorDistSq(r.rgb, item.rgb) < 1000); 
        if (!forced && isTooClose) return;

        recommendations.push({
            rgb: item.rgb,
            count: item.count * skip, 
            ratio: ((item.count * skip) / totalValidPixels) * 100,
            tag: tag
        });
    };

    // 1. [기존] 비중이 가장 높은 우세 색상 추천
    sortedColors.slice(0, 5).forEach(c => addRec(c, "tag_dominant"));

    // 2. [🔥신규] 팔레트 공백 탐지 (Gap Detection)
    // 원본 이미지의 주요 색상(최대 100개)을 현재 팔레트와 비교하여 부족한 색상을 찾습니다.
    const gapCandidates = [];
    const searchPool = sortedColors.slice(0, 100);

    for (const c of searchPool) {
        let minDist = Infinity;
        
        // 이 픽셀이 현재 팔레트에서 제일 가까운 색상과 얼마나 차이나는지 계산
        for (const p of currentPalette) {
            const dist = colorDistSq(c.rgb, p);
            if (dist < minDist) minDist = dist;
        }

        // 거리가 1500 이상 차이난다면 현재 팔레트로 표현이 불가능한 '공백' 색상으로 간주
        if (minDist > 1500) {
            gapCandidates.push({
                item: c,
                // 스코어 = 칠해져야 할 픽셀 수 × 팔레트와의 거리 (이 색이 없어서 발생하는 시각적 손실량)
                score: c.count * minDist 
            });
        }
    }

    // 시각적 손실이 가장 큰(가장 시급하게 필요한) 색상순으로 정렬
    gapCandidates.sort((a, b) => b.score - a.score);

    // 가장 시급한 상위 3개의 색상을 '공백(Gap)' 태그로 추천
    gapCandidates.slice(0, 3).forEach(gap => {
        addRec(gap.item, "tag_gap"); 
    });

    // 3. [기존] 밝기/채도 기반 포인트 색상 추천
    let foundShadow = false, foundMid = false, foundHighlight = false;
    for (const c of sortedColors) {
        const [h, s, l] = rgbToHsl(c.rgb[0], c.rgb[1], c.rgb[2]);
        if (!foundShadow && l < 30) { addRec(c, "tag_shadow"); foundShadow = true; } 
        else if (!foundHighlight && l > 70) { addRec(c, "tag_light"); foundHighlight = true; } 
        else if (!foundMid && l >= 30 && l <= 70 && s > 20) { addRec(c, "tag_mid"); foundMid = true; }
        if (foundShadow && foundMid && foundHighlight) break;
    }

    const pointColors = sortedColors.filter(c => {
        const [h, s, l] = rgbToHsl(c.rgb[0], c.rgb[1], c.rgb[2]);
        return (c.count / (totalValidPixels / skip) < 0.05) && (s > 60);
    });
    pointColors.slice(0, 2).forEach(c => addRec(c, "tag_point")); 

    // 데이터 전송 준비
    recommendations.totalPixels = totalValidPixels;
    const pixelStatsObj = {};
    colorStats.forEach((val, key) => {
        pixelStatsObj[key] = val.count * skip;
    });
    recommendations.pixelStats = pixelStatsObj;

    return recommendations;
};

export const analyzeImageFeatures = (img) => ({ validRegions: [] });
export const getStyleRecipesByTags = () => ({});

export const extractExactKMeansPalette = (imageData, k) => {
    const data = imageData.data;
    const pixels = [];

    // 🌟 [핵심 최적화] 렉을 없애기 위해 수백만 개의 픽셀 중 최대 5000개만 균일하게 뽑아서 검사합니다. (결과물은 동일)
    const maxSamples = 5000; 
    const totalPixels = data.length / 4;
    const step = Math.max(1, Math.floor(totalPixels / maxSamples));

    for (let i = 0; i < data.length; i += 4 * step) {
        if (data[i + 3] > 0) {
            pixels.push([data[i], data[i+1], data[i+2]]);
        }
    }

    if (pixels.length === 0) return [];
    if (k >= pixels.length) return pixels;

    const centroids = [pixels[Math.floor(Math.random() * pixels.length)]];
    for (let i = 1; i < k; i++) {
        let maxDistSq = -1;
        let nextCentroid = pixels[0];
        const sampleSize = Math.min(pixels.length, 500); // 연산량 대폭 감소
        
        for (let j = 0; j < sampleSize; j++) {
            const p = pixels[Math.floor(Math.random() * pixels.length)];
            let minDistSq = Infinity;
            for (const c of centroids) {
                const dist = colorDistSq(p, c);
                if (dist < minDistSq) minDistSq = dist;
            }
            if (minDistSq > maxDistSq) {
                maxDistSq = minDistSq;
                nextCentroid = p;
            }
        }
        centroids.push(nextCentroid);
    }

    for (let iter = 0; iter < 10; iter++) {
        const sums = Array.from({length: k}, () => [0, 0, 0]);
        const counts = new Array(k).fill(0);

        for (let i = 0; i < pixels.length; i++) {
            const p = pixels[i];
            let minDist = Infinity;
            let bestK = 0;
            for (let j = 0; j < k; j++) {
                const dist = colorDistSq(p, centroids[j]);
                if (dist < minDist) {
                    minDist = dist;
                    bestK = j;
                }
            }
            sums[bestK][0] += p[0];
            sums[bestK][1] += p[1];
            sums[bestK][2] += p[2];
            counts[bestK]++;
        }

        let changed = false;
        for (let j = 0; j < k; j++) {
            if (counts[j] > 0) {
                const newR = Math.round(sums[j][0] / counts[j]);
                const newG = Math.round(sums[j][1] / counts[j]);
                const newB = Math.round(sums[j][2] / counts[j]);
                if (centroids[j][0] !== newR || centroids[j][1] !== newG || centroids[j][2] !== newB) {
                    centroids[j] = [newR, newG, newB];
                    changed = true;
                }
            }
        }
        if (!changed) break;
    }

    const uniqueHexes = new Set();
    const finalPalette = [];
    centroids.forEach(rgb => {
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        if (!uniqueHexes.has(hex)) {
            uniqueHexes.add(hex);
            finalPalette.push(rgb);
        }
    });

    return finalPalette;
};