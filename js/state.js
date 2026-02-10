// js/state.js
import { languageData } from '/data/languages.js';

export const CONFIG = {
    DEBOUNCE_DELAY: 150,
    DEFAULTS: {
        saturationSlider: 100,
        brightnessSlider: 0,
        contrastSlider: 0,
        ditheringSlider: 0,
        rgbWeightR: 0,
        rgbWeightG: 0,
        rgbWeightB: 0
    }
};

export const state = {
    sessionPresets: [], 
    exportScale: 1, 
    isApplyingPreset: false,
    
    // [핵심 수정] 저장된 언어가 있으면 불러오고, 없으면 'ko'를 기본값으로 사용
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

    saturationSlider: 100,
    brightnessSlider: 0,
    contrastSlider: 0,
    
    rgbWeightR: 0,
    rgbWeightG: 0,
    rgbWeightB: 0,

    ditheringAlgorithmSelect: 'Atkinson', 
    ditheringSlider: 0,
    applyPattern: false,
    patternTypeSelect: 'bayer8x8',
    patternSizeSlider: 4,
    applyGradient: false,
    gradientTypeSelect: 'bayer',
    gradientDitherSizeSlider: 1, 
    gradientAngleSlider: 0,
    gradientStrengthSlider: 100,
    colorMethodSelect: 'oklab',
    pixelatedScaling: false,

    celShadingApply: false,
    celShadingLevelsSlider: 8,
    celShadingColorSpaceSelect: 'oklab',
    celShadingOutline: false,
    celShadingOutlineThresholdSlider: 50,
    celShadingOutlineColorSelect: '#000000',
    celShadingRandomSeed: 0,

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

// --- 다국어 텍스트 반환 헬퍼 함수 ---
export const t = (key, params = {}) => {
    const lang = state.language || 'ko';
    const dict = languageData ? languageData[lang] : null;
    
    let text = key;
    if (dict && dict[key]) {
        text = dict[key];
    }

    Object.keys(params).forEach(paramKey => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), params[paramKey]);
    });

    return text;
};

window.t = t;

// --- 순수 유틸리티 함수 ---
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