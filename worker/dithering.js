// js/core/dithering.js (또는 js/workers/dithering.js)

export class DitheringEngine {
    constructor() {
        // 4x4 베이어 매트릭스 (기본)
        this.bayer4x4 = [
            [ 0,  8,  2, 10],
            [12,  4, 14,  6],
            [ 3, 11,  1,  9],
            [15,  7, 13,  5]
        ];
        
        // 연산 속도를 위해 미리 -0.5 ~ 0.5 범위로 정규화해 둡니다.
        this.normalizedBayer = this.bayer4x4.map(row => 
            row.map(val => (val / 16) - 0.5)
        );
    }

    /**
     * 픽셀의 원본 RGB에 패턴과 디더링을 중첩하여 명도를 변조(Shift)합니다.
     * 이 함수를 거친 RGB 값을 '최단거리 색상 매칭(K-Means)'에 던져주면 됩니다!
     * * @param {number} r, g, b - 원본 픽셀의 RGB 값
     * @param {number} x, y - 픽셀의 이미지 내 좌표
     * @param {object} options - UI에서 설정한 강도 및 패턴 데이터
     * @param {number} colorStep - 팔레트 색상 간의 평균 거리 (디더링 진폭 제한용)
     */
    applySuperposition(r, g, b, x, y, options) {
        const { 
            patternMatrix = null, 
            patternStrength = 0, 
            patternSize = 1,
            useBayer = false, 
            ditherStrength = 0,
            bayerSize = 1
        } = options;

        let pShift = 0;
        let dShift = 0;

        // 1. 매크로 텍스처 (패턴)
        if (patternMatrix && patternMatrix.length > 0) {
            const sizeY = patternMatrix.length;
            const sizeX = patternMatrix[0].length;
            const px = Math.floor(x / Math.max(1, patternSize));
            const py = Math.floor(y / Math.max(1, patternSize));
            const state = patternMatrix[py % sizeY][px % sizeX];
            
            pShift = (state - 1) * patternStrength * 1.5;
        }

        // 2. 마이크로 텍스처 (Bayer)
        if (useBayer) {
            const bx = Math.floor(x / Math.max(1, bayerSize));
            const by = Math.floor(y / Math.max(1, bayerSize));
            const bVal = this.normalizedBayer[by % 4][bx % 4];
            
            // 🌟 [수정됨] 불필요한 제한을 풀고 슬라이더 값에 비례하여 부드럽게 증폭시킵니다!
            // 강도 100일 때 최대 ±64 정도의 밝기를 흔들도록 세팅.
            const maxAmplitude = ditherStrength * 1.28; 
            dShift = bVal * maxAmplitude;
        }

        return {
            r: r + pShift + dShift,
            g: g + pShift + dShift,
            b: b + pShift + dShift
        };
    }
}