import { translations } from '../data/languages.js';
import { eventBus } from './EventBus.js';

export let currentLang = localStorage.getItem('noadot-lang') || 'ko';
document.documentElement.setAttribute('data-lang', currentLang);

// 🌟 1. 자바스크립트에서 텍스트를 부를 때 사용하는 함수 t()
export function t(key, params = {}) {
    let text = translations[currentLang]?.[key] || translations['ko']?.[key] || key;
    
    // {변수} 형태로 들어온 값을 치환해주는 로직 포함
    Object.keys(params).forEach(paramKey => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), params[paramKey]);
    });
    return text;
}
window.t = t;

// 🌟 2. 언어 변경 시 실행되는 함수
export function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('noadot-lang', lang);
    document.documentElement.setAttribute('data-lang', lang);
    
    updateDOMTranslations(); // HTML 텍스트 즉시 교체
    eventBus.emit('LANGUAGE_CHANGED', lang); // 컴포넌트들에게 언어 바뀌었다고 방송!
}

// 🌟 3. HTML에 있는 글자들을 싹 다 찾아내서 바꿔주는 마법
export function updateDOMTranslations() {
    // 텍스트 내용 바꾸기 (예: <span data-i18n="btn_download">다운로드</span>)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        // 아이콘 등을 보존하기 위해 textContent 대신 innerHTML을 쓸 수도 있습니다.
        el.innerHTML = t(key); 
    });

    // 마우스 올렸을 때 뜨는 설명(title) 바꾸기
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
}

export const CONFIG = {
    DEBOUNCE_DELAY: 150,
    // 🌟 [정리] 리셋 기준값의 단일 진실 공급원(Single Source of Truth).
    // 05-color-engine/logic.js의 resetOptions()/resetIndividualOption()이
    // 이 값들을 각자 따로 하드코딩하고 있어서 서로 다른 값으로 드리프트되어 있었음 -> 여기로 통합.
    DEFAULTS: {
        saturationSlider: 100,
        brightnessSlider: 0,
        contrastSlider: 0,
        ditheringSlider: 0,
        rgbWeightR: 0,
        rgbWeightG: 0,
        rgbWeightB: 0,

        ditheringAlgorithmSelect: 'none',
        useMicroDither: false,
        useMacroPattern: false,
        basicDitherType: 'bayer',

        applyPattern: false,
        patternTypeSelect: 'grid',
        patternSizeSlider: 4,
        patternStrengthSlider: 10,
        applyGradient: false,
        gradientTypeSelect: 'bayer',
        gradientDitherSizeSlider: 1,
        gradientAngleSlider: 0,
        gradientStrengthSlider: 100,
        colorMethodSelect: 'oklab',
        pixelatedScaling: false,

        useAdvancedAlgo: false,
        algoTrack: 'simple',
        algoModelA: 'oklab',
        algoModelB: 'none',
        algoWeightM: 0,
        algoChromaBoost: 10,

        applyOutlineExpansion: false,
        applySmartSampling: false,
        applyRefinement: false,
        refinementSlider: 50,
        applyUpscale: false,
        upscaleMode: 1,

        useDitherDenoise: false,
        ditherDenoiseStrength: 50,
        useOrganicNoise: false,
        organicNoiseStrength: 50,
        usePixelioe: false,
        pixelioeStrength: 50,
        useSmoothing: false,
        smoothingLevel: 0,
        useAlphaGradient: false,
        alphaGradientType: 'bayer',
        alphaGradientAngle: 0,
        alphaGradientSize: 1,
        alphaGradientStrength: 50,

        celShadingApply: false,
        celShadingAlgorithmSelect: 'kmeans',
        celShadingLevelsSlider: 8,
        celShadingColorSpaceSelect: 'oklab',
        celShadingOutline: false,
        celShadingOutlineThresholdSlider: 50,
        celShadingOutlineColorSelect: '#000000',
        celShadingRandomSeed: 0
    }
};

export const state = {
    sessionPresets: [], 
    exportScale: 1, 
    isApplyingPreset: false,
    
    language: localStorage.getItem('noadot_language') || 'ko',
    
    appMode: 'image',
    isConverting: false,
    processId: 0,
    originalImageData: null,
    originalImageObject: null,
    originalFileName: 'image',
    currentZoom: 100,
    latestRecommendations: [], 
    isDragging: false,
    isUpscaled: false,
    latestConversionData: null, 
    currentUpscaleFactor: 1,
    lastBasePixelCount: 0,
    panX: 0,
    panY: 0,
    startPanX: 0,
    startPanY: 0,
    startDragX: 0,
    startDragY: 0,
    finalDownloadableData: null,
    currentMode: 'geopixels',
    useWplaceInGeoMode: false,
    highQualityMode: false,
    scaleMode: 'pixel',
    aspectRatio: 1,
    validPixelRatio: 1,

    // DEFAULTS 값을 복사하여 초기 상태 설정
    ...CONFIG.DEFAULTS,

    disabledHexes: [],
    paletteSortMode: 'default',
    addedColors: [],

    textState: {
        content: '',
        fontFamily: 'Malgun Gothic',
        fontSize: 15,
        isBold: false,
        isItalic: false,
        letterSpacing: 0,
        textLineHeight: 1.5,
        padding: 10,
        textColor: '#000000',
        bgColor: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 0
    },
    recommendedColors: [],
    timeoutId: null
};

// 🌟 [2026-09] Youplace가 고정 팔레트를 없애고 전체 RGB를 지원하게 되어, GeoPixels처럼 임의의
// 커스텀 색상을 자유롭게 추가할 수 있는 모드를 여기 한 곳에서 정의. (커스텀 색상 추가/스포이드/
// K-means 추출 등 여러 곳에서 "이 모드가 커스텀 색상을 지원하는가"를 매번 mode==='geopixels'로만
// 체크하던 걸 공용화 - 나중에 다른 사이트도 팔레트 제한이 풀리면 여기만 고치면 됨)
export const supportsCustomColors = (mode) => mode === 'geopixels' || mode === 'uplace';

export const hexToRgb = (hex) => {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const shorthandResult = shorthandRegex.exec(hex);
        if (shorthandResult) {
            result = [
                shorthandResult[0],
                shorthandResult[1] + shorthandResult[1],
                shorthandResult[2] + shorthandResult[2],
                shorthandResult[3] + shorthandResult[3]
            ];
        }
    }
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
};

export const rgbToHex = (r, g, b) => {
    const toHex = (c) => {
        const hex = (c || 0).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return ('#' + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
};

export const getTextColorForBg = (rgb) => {
    if (!rgb) return '#000000';
    const [r, g, b] = rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance > 128 ? '#000000' : '#FFFFFF';
};