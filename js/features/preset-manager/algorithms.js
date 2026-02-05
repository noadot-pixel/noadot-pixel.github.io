// [중요] presets.js 파일의 실제 위치에 맞춰 경로를 수정해야 합니다.
// 만약 presets.js가 같은 폴더(js/features/preset-manager/)에 있다면 './presets.js' 입니다.
// 만약 presets.js가 js/data/ 폴더에 있다면 '../../../data/presets.js' 입니다.
import { PRESET_RECIPES } from '../../../data/presets.js'; 

export class PresetAlgorithms {
    // 1. 매칭 점수 계산
    calculateMatchScore(imageTags, presetTags) {
        if (!imageTags || !presetTags) return 0;
        return presetTags.filter(tag => imageTags.includes(tag)).length;
    }

    // 2. 프리셋 정렬
    getSortedPresets(imageTags) {
        if (!PRESET_RECIPES) {
            console.error("❌ 프리셋 레시피를 불러오지 못했습니다. presets.js 경로를 확인하세요.");
            return [];
        }

        return PRESET_RECIPES.map(recipe => {
            const score = this.calculateMatchScore(imageTags, recipe.tags);
            return { ...recipe, score };
        }).sort((a, b) => {
            if (a.ranking === 'fixed') return -1;
            if (b.ranking === 'fixed') return 1;
            
            if (b.score !== a.score) return b.score - a.score;
            if (a.ranking === 'high' && b.ranking !== 'high') return -1;
            if (b.ranking === 'high' && a.ranking !== 'high') return 1;
            
            return 0;
        });
    }
}