// 🌟 [신규] 중복(거의 동일한) 색상 검사 - 완전연결(complete-linkage) 계층적 클러스터링
// 단일연결(single-linkage) 방식은 A-B-C-...처럼 사슬로 계속 이어져서 전혀 안 비슷한 색까지
// 한 그룹으로 묶여버리는 문제가 있어서, "구역 안의 모든 색상 쌍이 반드시 임계값 이내"인
// 완전연결 방식을 사용한다.
import { ColorConverter } from '../../worker/color.js';

// ΔE2000 기준 임계값. 2~3은 인간이 나란히 놓고 봐도 거의 구분 못 하는 수준(JND),
// 여기서는 픽셀아트 팔레트 정리 용도로 살짝 여유를 둔 값을 기본으로 사용한다.
export const DEFAULT_DUPLICATE_THRESHOLD = 4;

/**
 * @param {{hex:string, rgb:number[], count:number}[]} entries 검사 대상 색상 목록 (현재 활성화된 팔레트)
 * @param {number} thresholdDeltaE 이 값보다 가까운(작은) 색상들만 같은 구역으로 묶음
 * @returns {{id:number, colors:{hex:string, rgb:number[], count:number}[]}[]} 2개 이상 모인 구역만 반환
 */
export function findDuplicateZones(entries, thresholdDeltaE = DEFAULT_DUPLICATE_THRESHOLD) {
    const n = entries.length;
    if (n < 2) return [];

    const labs = entries.map(e => ColorConverter.rgbToLab(e.rgb));

    // 모든 쌍의 ΔE2000을 한 번만 미리 계산해서 n*n 평면 배열에 저장 (재계산/해시 오버헤드 방지)
    const distMatrix = new Float32Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const d = ColorConverter.deltaE2000(labs[i], labs[j]);
            distMatrix[i * n + j] = d;
            distMatrix[j * n + i] = d;
        }
    }

    let clusters = entries.map((_, i) => [i]);

    while (clusters.length > 1) {
        let bestA = -1, bestB = -1, bestDist = Infinity;

        for (let a = 0; a < clusters.length; a++) {
            for (let b = a + 1; b < clusters.length; b++) {
                // 완전연결: 두 구역을 합쳤을 때 구역 내 "가장 먼" 쌍의 거리가 기준
                let maxD = 0;
                for (const ci of clusters[a]) {
                    for (const cj of clusters[b]) {
                        const d = distMatrix[ci * n + cj];
                        if (d > maxD) maxD = d;
                    }
                }
                if (maxD < bestDist) { bestDist = maxD; bestA = a; bestB = b; }
            }
        }

        if (bestA === -1 || bestDist >= thresholdDeltaE) break;
        clusters[bestA] = clusters[bestA].concat(clusters[bestB]);
        clusters.splice(bestB, 1);
    }

    return clusters
        .filter(c => c.length >= 2)
        .map((c, idx) => ({ id: idx, colors: c.map(i => entries[i]) }));
}
