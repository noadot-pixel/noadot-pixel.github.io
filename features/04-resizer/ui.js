import { state } from '../../core/state.js';

export class ImageResizerUI {
    constructor() {}

    // 원본 해상도 전광판 업데이트
    updateOriginalStats(width, height) {
        const target = document.getElementById('v7-orig-dims');
        if (target) {
            target.textContent = `${width} × ${height} px`;
        }
    }

    // 변환된 정보(해상도, 픽셀 수) 전광판 업데이트
    updateStatsDisplay(stats) {
        if (!stats) return;

        const convDims = document.getElementById('v7-conv-dims');
        const pixelCount = document.getElementById('v7-pixel-count');

        if (convDims) {
            convDims.textContent = `${stats.width} × ${stats.height} px`;
        }

        if (pixelCount) {
            pixelCount.textContent = stats.activePixels.toLocaleString() + ' 개';
        }
    }
}