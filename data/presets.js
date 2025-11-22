// data/presets.js

export const PRESET_RECIPES = [
    // 1. [고정] 기본 스타일 (누구에게나 무난함)
    {
        name: { ko: "기본 스타일 (선명함)", en: "Basic Style (Sharp)" },
        ranking: "fixed", // 고정 상단 노출
        preset: {
            saturationSlider: 110,
            contrastSlider: 10,
            ditheringAlgorithmSelect: "atkinson",
            ditheringSlider: 30,
            pixelatedScaling: true,
            highQualityMode: false,
            enableAllPalettes: true
        }
    },
    // 2. [추천] 흑백 신문 (어두운 이미지에 적합)
    {
        name: { ko: "흑백 신문 (디더링)", en: "B&W Newspaper" },
        tags: ["isDark", "isMonochromatic", "isHighResolution"], // 이 태그가 있으면 추천 점수 상승
        ranking: "high", // 조건 맞으면 강력 추천
        preset: {
            saturationSlider: 0,
            contrastSlider: 40,
            brightnessSlider: 10,
            ditheringAlgorithmSelect: "floyd",
            ditheringSlider: 100,
            // 흑백 팔레트 강제 적용
            enablePaletteColors: {
                geopixels: ['#000000', '#FFFFFF'],
                wplace: ['#000000', '#FFFFFF']
            }
        }
    },
    // 3. [추천] 레트로 게임 (화려한 이미지에 적합)
    {
        name: { ko: "레트로 게임 (비비드)", en: "Retro Game (Vivid)" },
        tags: ["isColorful", "isLowResolution"],
        ranking: "high",
        preset: {
            saturationSlider: 150,
            contrastSlider: 20,
            ditheringAlgorithmSelect: "none", // 깔끔하게
            pixelatedScaling: true,
            enableAllPalettes: true
        }
    },
    // 4. [일반] 만화 효과
    {
        name: { ko: "만화 효과 (Cel Shading)", en: "Cartoon Effect" },
        tags: ["isComplex"],
        ranking: "normal",
        preset: {
            celShading: {
                apply: true,
                levels: 6,
                outline: true,
                outlineThreshold: 40,
                outlineColor: [0, 0, 0],
                mappingMode: 'activePalette',
                quantMethod: 'kmeans++'
            },
            ditheringAlgorithmSelect: "none",
            enableAllPalettes: true
        }
    },
    // 5. [일반] 패턴 배경
    {
        name: { ko: "패턴 (Crosshatch)", en: "Pattern Style" },
        tags: ["isLowContrast"],
        ranking: "normal",
        preset: {
            applyPattern: true,
            patternTypeSelect: "crosshatch",
            patternSizeSlider: 4,
            ditheringAlgorithmSelect: "none",
            enableAllPalettes: true
        }
    }
];