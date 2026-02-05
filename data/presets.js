// data/presets.js
export const systemPresets = [
    {
        id: "classic_default",
        name: "Classic (Default)",
        description: "모든 설정이 초기화된 기본 상태입니다.",
        isSystem: true,
        options: {
            saturation: 100, brightness: 0, contrast: 0,
            dithering: "none", ditheringIntensity: 0,
            applyPattern: false, patternType: "bayer8x8", patternSize: 4,
            applyGradient: false, gradientType: "bayer", gradientAngle: 0, gradientStrength: 100, gradientDitherSize: 1,
            colorMethod: "oklab", pixelatedScaling: false,
            celShading: {
                apply: false, levels: 8, colorSpace: "oklab",
                outline: false, outlineThreshold: 50, outlineColor: "#000000", randomSeed: 0
            },
            mode: "geopixels", useWplaceInGeoMode: false,
            disabledHexes: [], addedColors: [],
            resize: { scaleMode: "ratio", exportScale: 1, upscale: 1 }
        }
    }
];