// js/worker/analysis.js

// ... (상단 유틸리티 함수 그대로 유지) ...
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
    const totalPixels = width * height;
    const skip = 4; 
    
    const colorStats = new Map();

    // 전체 스캔
    for (let i = 0; i < data.length; i += 4 * skip) {
        if (data[i + 3] < 128) continue; 

        const r = data[i], g = data[i+1], b = data[i+2];
        const simpleR = r & 0xF0; 
        const simpleG = g & 0xF0; 
        const simpleB = b & 0xF0;
        const key = rgbToHex(simpleR, simpleG, simpleB);

        if (!colorStats.has(key)) {
            colorStats.set(key, { count: 0, rgb: [r, g, b] });
        }
        colorStats.get(key).count++;
    }

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
            ratio: (item.count * skip / totalPixels) * 100,
            tag: tag
        });
    };

    // [수정] 한글 텍스트 대신 '언어 키'를 전달하도록 변경
    
    // 1. [사용 비중]
    sortedColors.slice(0, 10).forEach(c => {
        if (recommendations.length < 3) {
            addRec(c, "tag_dominant"); // "고비율 색상" -> tag_dominant
        }
    });

    // 2. [색상 톤]
    let foundShadow = false, foundMid = false, foundHighlight = false;
    
    for (const c of sortedColors) {
        const [h, s, l] = rgbToHsl(c.rgb[0], c.rgb[1], c.rgb[2]);
        
        if (!foundShadow && l < 30) {
            addRec(c, "tag_shadow"); // "어두운 톤" -> tag_shadow
            foundShadow = true;
        } else if (!foundHighlight && l > 70) {
            addRec(c, "tag_light"); // "밝은 톤" -> tag_light (기존 languages.js 키 활용)
            foundHighlight = true;
        } else if (!foundMid && l >= 30 && l <= 70 && s > 20) { 
            addRec(c, "tag_mid"); // "중간 톤" -> tag_mid
            foundMid = true;
        }
        if (foundShadow && foundMid && foundHighlight) break;
    }

    // 3. [영역 색상]
    const pointColors = sortedColors.filter(c => {
        const [h, s, l] = rgbToHsl(c.rgb[0], c.rgb[1], c.rgb[2]);
        return (c.count / (totalPixels / skip) < 0.05) && (s > 60);
    });
    
    pointColors.slice(0, 2).forEach(c => {
        addRec(c, "tag_point"); // "포인트" -> tag_point (언어 파일에 추가 필요)
    });

    return recommendations;
};

export const analyzeImageFeatures = (img) => ({ validRegions: [] });
export const getStyleRecipesByTags = () => ({});