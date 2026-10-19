// worker/palette-utils.js
// 🌟 [레이어 기능] buildActivePalette가 원래 worker/image-worker.js 안에만 있어서
// 메인 스레드(뷰어의 레이어 합성 "스냅" 단계)에서는 쓸 수 없었음 -> 공용 모듈로 분리.
// 워커 쪽 변환 요청과 메인 스레드의 "합성 결과를 팔레트에 맞게 스냅"하는 로직이
// 반드시 같은 활성 팔레트를 봐야 해서, 팔레트 구성 로직 하나만 고치면 양쪽 다 맞게 유지된다.
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors, bplaceColors, threeplaceColors } from '../data/palettes.js';
import { ColorConverter, findClosestColorFusion } from './color.js';

export function buildActivePalette(options) {
    const active = [];
    const disabled = new Set(options.disabledHexes || []);

    const addColor = (c) => {
        const rgb = c.rgb || c;
        if (!rgb || rgb.length < 3) return;
        const hex = '#' + rgb.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join('');
        if (!disabled.has(hex)) active.push(rgb);
    };

    // 🌟 각 탭에 맞는 팔레트만 엄격하게 분리해서 담습니다!
    if (options.mode === 'geopixels') {
        if (typeof geopixelsColors !== 'undefined') geopixelsColors.forEach(addColor);

        // 🌟 타 플랫폼 병합 체크 여부 확인
        if (options.useWplaceInGeopixels) {
            if (typeof wplaceFreeColors !== 'undefined') wplaceFreeColors.forEach(addColor);
            if (typeof wplacePaidColors !== 'undefined') wplacePaidColors.forEach(addColor);
        }
        if (options.useUplaceInGeopixels) { // 🌟 Uplace 병합 추가
            if (typeof uplaceColors !== 'undefined') uplaceColors.forEach(addColor);
        }
        if (options.useBplaceInGeopixels) { // 🌟 Bplace 병합 추가
            if (typeof bplaceColors !== 'undefined') bplaceColors.forEach(addColor);
        }
        if (options.useThreeplaceInGeopixels) { // 🌟 3Place 병합 추가
            if (typeof threeplaceColors !== 'undefined') threeplaceColors.forEach(addColor);
        }

    } else if (options.mode === 'wplace') {
        if (typeof wplaceFreeColors !== 'undefined') wplaceFreeColors.forEach(addColor);
        if (typeof wplacePaidColors !== 'undefined') wplacePaidColors.forEach(addColor);
    } else if (options.mode === 'uplace') {
        if (typeof uplaceColors !== 'undefined') uplaceColors.forEach(addColor);
    } else if (options.mode === 'bplace') { // 🌟 Bplace 단독 모드 추가!
        if (typeof bplaceColors !== 'undefined') bplaceColors.forEach(addColor);
    } else if (options.mode === '3place') { // 🌟 3Place 단독 모드 추가!
        if (typeof threeplaceColors !== 'undefined') threeplaceColors.forEach(addColor);
    }

    // (참고) 커스텀 팔레트는 사용자가 추가한 거니까 어떤 모드든 무조건 섞어줍니다.
    if (options.palette && Array.isArray(options.palette)) {
        options.palette.forEach(addColor);
    }

    // 최후의 방어선 (비상용 흑백 물감)
    if (active.length === 0) active.push([0, 0, 0]);
    return active;
}

// 🌟 WorkerBridge.packOptions()가 변환 요청에 실어 보내는 팔레트 관련 필드들을
// 한 곳에서 뽑아내서, 워커로 보내는 것과 메인 스레드에서 스냅용으로 쓰는 것이 절대 어긋나지 않게 한다.
// 🚨 이 파일은 worker/image-worker.js(진짜 Worker 환경, document 없음)에서도 import되므로
// core/state.js의 supportsCustomColors를 그대로 가져다 쓸 수 없음(그 파일은 모듈 로드 시점에
// document.documentElement를 건드려서 Worker 안에서 즉시 에러가 남) - 같은 판정 로직을 그대로 복붙.
export function getPaletteOptionsFromState(state) {
    const supportsCustomColors = state.currentMode === 'geopixels' || state.currentMode === 'uplace';
    return {
        mode: state.currentMode || 'geopixels',
        useWplaceInGeopixels: state.useWplaceInGeopixels || false,
        useUplaceInGeopixels: state.useUplaceInGeopixels || false,
        useBplaceInGeopixels: state.useBplaceInGeopixels || false,
        useThreeplaceInGeopixels: state.useThreeplaceInGeopixels || false,
        palette: supportsCustomColors ? (state.addedColors || []) : [],
        disabledHexes: state.disabledHexes || [],
        fusionParams: (() => {
            const isSimple = state.algoTrack !== 'advanced';
            return {
                modelA: state.algoModelA || 'oklab',
                modelB: isSimple ? 'none' : (state.algoModelB || 'none'),
                weightM: isSimple ? 0 : (state.algoWeightM !== undefined ? state.algoWeightM : 0),
                chromaBoost: state.algoChromaBoost !== undefined ? state.algoChromaBoost : 10
            };
        })()
    };
}

// 🌟 [레이어 기능] 레이어 합성 후 "팔레트 밖 색상으로 번진" 픽셀을 다시 가장 가까운 활성 팔레트
// 색으로 되돌리는 "스냅" 단계에서 쓰는 함수. matchColorAndDither가 팔레트를 준비하는 방식과
// 완전히 동일하게 맞춰서, 본문 변환과 레이어 합성 스냅 사이에 색감 차이가 안 생기게 한다.
export function createPaletteSnapper(activePalette, fusionParams) {
    const preparedPalette = activePalette.map(p => {
        const rgb = p.rgb || p;
        return {
            rgb: rgb, oklab: ColorConverter.rgbToOklab(rgb),
            labD50: ColorConverter.rgbToLab(rgb), labD65: ColorConverter.rgbToLabD65(rgb)
        };
    });
    const params = fusionParams || { modelA: 'oklab', modelB: 'none', weightM: 0, chromaBoost: 0 };

    const cache = new Map();
    return (r, g, b) => {
        const key = (r << 16) | (g << 8) | b;
        let cached = cache.get(key);
        if (!cached) {
            cached = findClosestColorFusion(r, g, b, preparedPalette, params).color;
            cache.set(key, cached);
        }
        return cached;
    };
}
