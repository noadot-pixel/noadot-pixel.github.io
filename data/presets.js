// data/presets.js

/**
 * [NoaDot 프리셋 레시피 가이드 v5.10]
 * 
 * 이 파일에 프리셋 객체를 추가하면 팝업에 자동으로 나타납니다.
 * 설정하지 않은 값은 기본값을 따릅니다.
 */

export const PRESET_RECIPES = [

    // =================================================================
    // [기본 예제] 가장 단순한 형태 (복사해서 사용하세요)
    // =================================================================
    {
        // 1. 이름 (다국어 지원)
        name: { ko: "기본 프리셋", en: "Default Preset" },
        
        // 2. 순서 및 추천 로직
        // - ranking: 'fixed' (맨 앞 고정), 'high' (추천), 'normal' (일반)
        ranking: "fixed",
        
        // - tags: 이미지 분석 결과와 매칭될 태그들
        // (isDark, isBright, isColorful, isMonochromatic, isComplex, isSimple 등)
        tags: [], 

        // 3. 변환 설정값 (Preset Options)
        preset: {
            // === 색상 조절 ===
            saturationSlider: 100,   // 채도 (0 ~ 200, 기본 100)
            brightnessSlider: 0,     // 밝기 (-100 ~ 100, 기본 0)
            contrastSlider: 0,       // 대비 (-100 ~ 100, 기본 0)

            // === 디더링 (점묘화 효과) ===
            // 옵션: 'none', 'floyd', 'atkinson', 'sierra'
            ditheringAlgorithmSelect: "atkinson", 
            ditheringSlider: 30,     // 강도 (0 ~ 100)

            // === 품질 & 크기 ===
            pixelatedScaling: true,  // 픽셀 아트처럼 선명하게 (true/false)
            highQualityMode: false,  // 고품질 색상 계산 (느림)

            /* 
            // === [고급] 만화 스타일 필터 (Cel Shading) ===
            celShading: {
                apply: true,             // 적용 여부
                levels: 6,               // 색상 단순화 레벨 (2 ~ 32)
                outline: true,           // 외곽선 표시
                outlineThreshold: 50,    // 민감도 (낮을수록 민감)
                outlineColor: "#000000"  // 외곽선 색상 (HEX)
            },
            */

            /*
            // === [고급] 패턴 & 그라데이션 ===
            applyPattern: true,
            patternTypeSelect: "crosshatch", // bayer8x8, vertical, brick 등
            patternSizeSlider: 4,
            
            applyGradient: true,
            gradientAngleSlider: 45,
            gradientStrengthSlider: 80,
            */

            // === [중요] 팔레트 설정 ===
            // 방법 A: 모든 색상 켜기 (가장 무난함)
            enableAllPalettes: true,

            /*
            // 방법 B: 특정 모드에서 특정 색상만 켜기 (흑백, 세피아 등)
            enablePaletteColors: {
                geopixels: ['#000000', '#FFFFFF'], // GeoPixels 모드용 색상
                wplace: ['#000000', '#FFFFFF']     // Wplace 모드용 색상
            }
            */
        }
    },

    // =================================================================
    // [실전 예제] 흑백 신문 스타일
    // =================================================================
    {
        name: { ko: "흑백 신문", en: "B&W Newspaper" },
        tags: ["isMonochromatic", "isDark"], // 흑백이거나 어두운 이미지에 추천
        ranking: "high",
        preset: {
            saturationSlider: 0,       // 흑백 처리
            contrastSlider: 20,        // 대비 강조
            ditheringAlgorithmSelect: "floyd", // 거친 디더링
            ditheringSlider: 100,
            
            // 검은색과 흰색만 사용하도록 강제
            enablePaletteColors: {
                geopixels: ['#000000', '#FFFFFF'],
                wplace: ['#000000', '#FFFFFF']
            }
        }
    },

    // =================================================================
    // [실전 예제] 레트로 게임 (비비드)
    // =================================================================
    {
        name: { ko: "레트로 게임", en: "Retro Game" },
        tags: ["isColorful", "isLowResolution"],
        ranking: "high",
        preset: {
            saturationSlider: 140,     // 색감 강조
            contrastSlider: 10,
            ditheringAlgorithmSelect: "none", // 깔끔하게 (디더링 끔)
            pixelatedScaling: true,
            enableAllPalettes: true    // 모든 색상 사용
        }
    },

    // =================================================================
    // [실전 예제] 만화 효과
    // =================================================================
    {
        name: { ko: "만화 효과", en: "Cartoon Effect" },
        tags: ["isComplex"],
        ranking: "normal",
        preset: {
            ditheringAlgorithmSelect: "none",
            celShading: {
                apply: true,
                levels: 8,
                outline: true,
                outlineThreshold: 40,
                outlineColor: "#000000"
            },
            enableAllPalettes: true
        }
    }
];