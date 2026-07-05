// js/worker/gradient-detection.js
// 🌟 픽셀별 "주변과 색이 얼마나 다른가"를 재는 지역 분산(로컬 그래디언트) 맵.
// 값이 작을수록 매끄러운 그라데이션 구간, 클수록 경계/디테일 구간입니다.
// matchColorAndDither(적응형 디더링)와 K-Means 그라데이션 전용 추출이 이 값을 공유해서 씁니다.
export function computeLocalVariance(data, width, height) {
    const variance = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const i = idx * 4;

            if (data[i + 3] === 0) { variance[idx] = Infinity; continue; }

            const r = data[i], g = data[i + 1], b = data[i + 2];
            let diffSum = 0, sampleCount = 0;

            const addNeighborDiff = (ni) => {
                if (data[ni + 3] === 0) return;
                diffSum += Math.abs(r - data[ni]) + Math.abs(g - data[ni + 1]) + Math.abs(b - data[ni + 2]);
                sampleCount++;
            };

            if (x + 1 < width) addNeighborDiff(i + 4);
            if (x - 1 >= 0) addNeighborDiff(i - 4);
            if (y + 1 < height) addNeighborDiff(i + width * 4);
            if (y - 1 >= 0) addNeighborDiff(i - width * 4);

            variance[idx] = sampleCount > 0 ? diffSum / sampleCount : 0;
        }
    }

    return variance;
}

// diff 값을 0(완전히 매끄러움 = 그라데이션) ~ 1(경계/디테일) 사이 계수로 변환
export function smoothnessFactor(diff, low, high) {
    if (diff <= low) return 0;
    if (diff >= high) return 1;
    return (diff - low) / (high - low);
}

// UI의 "그라데이션 감지 강도"(0~100) 슬라이더 값을 실제 임계값(low, high) 쌍으로 변환
export function resolveGradientThresholds(strength = 50) {
    const s = (strength ?? 50) / 100;
    const high = 8 + s * 55;   // 강도가 높을수록 더 넓은 범위를 "그라데이션"으로 판정
    const low = high * 0.25;
    return { low, high };
}
