// js/worker/analysis.js

// [중요] 데이터 파일 경로: presets.js (s 붙음)
import { PRESET_RECIPES } from '../../data/presets.js'; 

export function analyzeImageFeatures(imageData) {
    // ... (내용은 이전 코드와 동일, 그대로 두시면 됩니다)
    // 여기에 로직 코드가 있어야 합니다!
    // (분량상 생략합니다. 이전 답변의 analysis.js 코드를 그대로 쓰세요)
    const { data, width, height } = imageData;
    const tags = new Set();
    let totalLuminance = 0; let totalSaturation = 0; let monochromaticPixels = 0; let edgePixels = 0;
    const totalPixels = width * height;
    const lumThresholds = { dark: 85, bright: 170 };
    let darkCount = 0, midCount = 0, brightCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const max = Math.max(r, g, b); const min = Math.min(r, g, b);
            const luminance = (max + min) / 2;
            let saturation = 0;
            if (max !== min) { saturation = luminance > 128 ? (max - min) / (510 - max - min) : (max - min) / (max + min); }
            totalLuminance += luminance; totalSaturation += saturation;
            if (saturation < 0.15) monochromaticPixels++;
            if (luminance < lumThresholds.dark) darkCount++; else if (luminance < lumThresholds.bright) midCount++; else brightCount++;
            
            const getLum = (dx, dy) => { const ni = ((y + dy) * width + (x + dx)) * 4; return data[ni] * 0.299 + data[ni + 1] * 0.587 + data[ni + 2] * 0.114; };
            const gx = getLum(1, 0) - getLum(-1, 0); const gy = getLum(0, 1) - getLum(0, -1);
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            if (magnitude > 50) edgePixels++;
        }
    }
    if (monochromaticPixels / totalPixels > 0.9) tags.add('isMonochromatic');
    if (totalSaturation / totalPixels > 0.3) tags.add('isColorful');
    const avgLuminance = totalLuminance / totalPixels;
    if (avgLuminance < 85) tags.add('isDark');
    if (avgLuminance > 170) tags.add('isBright');
    if (darkCount / totalPixels > 0.2 && brightCount / totalPixels > 0.2) tags.add('isContrasting');
    if (midCount / totalPixels > 0.7) tags.add('isLowContrast');
    if (width < 256 || height < 256) tags.add('isLowResolution');
    if (width > 1024 || height > 1024) tags.add('isHighResolution');
    if (edgePixels / totalPixels < 0.1) tags.add('isSimple');
    if (edgePixels / totalPixels > 0.25) tags.add('isComplex');
    return tags;
}

export function calculateRecommendations(imageData, activePalette, options) {
    // (이전 코드 그대로)
    const { highlightSensitivity = 0 } = options;
    const { data, width, height } = imageData;
    const allExistingColors = new Set(activePalette.map(rgb => rgb.join(',')));
    const colorStats = new Map();
    let totalPixels = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i + 3] < 128) continue;
            totalPixels++;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const key = `${r},${g},${b}`;
            if (allExistingColors.has(key)) continue;
            if (!colorStats.has(key)) {
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                colorStats.set(key, { rgb: [r, g, b], count: 0, luminance, maxVolatility: 0 });
            }
            const entry = colorStats.get(key);
            entry.count++;
            if (highlightSensitivity > 0) {
                let volatility = 0;
                for (let dy = -highlightSensitivity; dy <= highlightSensitivity; dy++) {
                    for (let dx = -highlightSensitivity; dx <= highlightSensitivity; dx++) {
                        if ((dx === 0 && dy === 0) || (Math.abs(dx) + Math.abs(dy) > highlightSensitivity)) continue;
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const ni = (ny * width + nx) * 4;
                            volatility += (r - data[ni]) ** 2 + (g - data[ni + 1]) ** 2 + (b - data[ni + 2]) ** 2;
                        }
                    }
                }
                if (volatility > entry.maxVolatility) entry.maxVolatility = volatility;
            }
        }
    }
    if (totalPixels === 0 || colorStats.size === 0) return [];
    const candidates = Array.from(colorStats.values());
    const highUsage = []; const highlights = [];
    candidates.forEach(stats => {
        const usage = stats.count / totalPixels;
        if (usage > 0.01) { highUsage.push({ ...stats, type: '고비율 색상', score: usage }); }
        const volatilityScore = Math.sqrt(stats.maxVolatility);
        if (highlightSensitivity > 0 && volatilityScore > 1000) { highlights.push({ ...stats, type: '하이라이트 색상', score: volatilityScore }); }
    });
    const shadows = candidates.filter(c => c.luminance < 85);
    const midtones = candidates.filter(c => c.luminance >= 85 && c.luminance < 170);
    const highlightsRange = candidates.filter(c => c.luminance >= 170);
    const getMostUsed = (group) => group.sort((a, b) => b.count - a.count)[0];
    const smhRecommendations = [];
    const shadowRep = getMostUsed(shadows);
    const midtoneRep = getMostUsed(midtones);
    const highlightRep = getMostUsed(highlightsRange);
    if (shadowRep) smhRecommendations.push({ ...shadowRep, type: '명암 대표색', subType: '어두운 영역' });
    if (midtoneRep) smhRecommendations.push({ ...midtoneRep, type: '명암 대표색', subType: '중간 영역' });
    if (highlightRep) smhRecommendations.push({ ...highlightRep, type: '명암 대표색', subType: '밝은 영역' });
    const finalSmh = smhRecommendations.filter((v, i, a) => a.findIndex(t => (t.rgb.join(',') === v.rgb.join(','))) === i);
    return [ ...highUsage.sort((a, b) => b.score - a.score).slice(0, 5), ...highlights.sort((a, b) => b.score - a.score).slice(0, 5), ...finalSmh ];
}

export function getStyleRecipesByTags(imageFeatures) {
    if (!PRESET_RECIPES || PRESET_RECIPES.length === 0) { return { fixed: [], recommended: [], others: [] }; }
    const fixedRecipes = PRESET_RECIPES.filter(r => r.ranking === false);
    const rankableRecipes = PRESET_RECIPES.filter(r => r.ranking !== false);
    const scoredRecipes = rankableRecipes.map(recipe => {
        let score = 0;
        if (recipe.tags && recipe.tags.length > 0) { recipe.tags.forEach(tag => { if (imageFeatures.has(tag)) { score++; } }); }
        return { ...recipe, score };
    });
    const recommendedRecipes = scoredRecipes.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    const otherRecipes = scoredRecipes.filter(r => r.score === 0);
    return { fixed: fixedRecipes, recommended: recommendedRecipes, others: otherRecipes };
}