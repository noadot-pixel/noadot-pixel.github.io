// presets.js

export const PRESET_RECIPES = [
    {
        name: '기본값',
        tags: ['isColorful', 'isSimple'], // 이 프리셋이 어울릴만한 이미지 특징
        
        // requiredPaletteMode: 'wplace', // 특정 팔레트 모드가 필요할 때만 주석 해제

        preset: {
            // ----------------------------------------
            // 1. 일반 설정
            // ----------------------------------------
            saturation: 100,
            brightness: 0,
            contrast: 0,
            dithering: 0,
            algorithm: 'atkinson',
            applyPattern: false,
            highQualityMode: false,
            pixelatedScaling: true,
            
            // ----------------------------------------
            // 2. 만화 필터 스튜디오 (필요할 때만 apply: true)
            // ----------------------------------------
            celShading: {
                apply: false,
                levels: 8,
                quantMethod: 'kmeans++', 
                colorSpace: 'oklab',
                mappingMode: 'none',
                outline: false,
                outlineThreshold: 50
            },

            // ----------------------------------------
            // 3. 팔레트 제어 (아래 셋 중 하나만 사용 권장)
            // ----------------------------------------
            
            // 3-1. 모든 색상 켜기
            enableAllPalettes: true,
            
            // 3-2. 모든 색상 끄고, 특정 색상만 켜기
            // disableAllPalettes: true,
            // enablePaletteColors: {
            //     geopixels: ['#...'],
            //     wplace: ['color_name', ...]
            // },

            // 3-3. 사용자 팔레트 덮어쓰기 (최고 우선순위)
            // overwriteUserPalette: ['#...', '#...', '#...'],

            ranking: false,
        }
    },
    
];