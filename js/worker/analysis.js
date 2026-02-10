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
    let validPixelCount = 0; // [New] 직접 카운팅할 변수

    // 전체 픽셀 스캔
    for (let i = 0; i < data.length; i += 4 * skip) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3]; // 불투명도 (Alpha)

        // [핵심 변경] "불투명도 100 이상인 픽셀만 카운트"
        if (a >= 100) {
            validPixelCount++;

            // 색상 통계 수집
            const key = rgbToHex(r, g, b);
            if (!colorStats.has(key)) {
                colorStats.set(key, { count: 0, rgb: [r, g, b] });
            }
            colorStats.get(key).count++;
        }
        // 100 미만인 픽셀은 아무것도 하지 않고 그냥 넘어감 (카운트 X)
    }

    // [결과 계산] 샘플링 보정 (전체 픽셀 수 추산)
    const totalValidPixels = validPixelCount * skip || 1;

    // --- 이하 추천 로직은 기존과 동일 ---
    const sortedColors = Array.from(colorStats.values()).sort((a, b) => b.count - a.count);
    const recommendations = [];
    const exclusionHexSet = new Set();

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
        if (recommendations.some(r => rgbToHex(r.rgb[0], r.rgb[1], r.rgb[2]) === hex)) return;
        
        const isTooClose = recommendations.some(r => colorDistSq(r.rgb, item.rgb) < 1000); 
        if (!forced && isTooClose) return;

        recommendations.push({
            rgb: item.rgb,
            count: item.count * skip, 
            ratio: ((item.count * skip) / totalValidPixels) * 100,
            tag: tag
        });
    };

    sortedColors.slice(0, 10).forEach(c => addRec(c, "tag_dominant"));

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

    // [전송 데이터 구성] 배열에 속성 추가 (호환성 유지)
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