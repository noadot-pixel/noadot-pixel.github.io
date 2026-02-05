// js/core/features/image-resizer/algorithms.js
export class ResizeAlgorithms {
    // 높이 자동 계산 (너비 기준)
    calculateHeight(width, aspectRatio) {
        if (!aspectRatio || aspectRatio <= 0) return width;
        return Math.round(width * aspectRatio);
    }

    // 너비 자동 계산 (높이 기준)
    calculateWidth(height, aspectRatio) {
        if (!aspectRatio || aspectRatio <= 0) return height;
        return Math.round(height / aspectRatio);
    }

    // 비율로 크기 계산 (원본 대비 1/N)
    calculateDimensionsByRatio(originalWidth, originalHeight, ratio) {
        // [안전장치] 비율이 1보다 작거나 0이면 1로 처리
        const safeRatio = Math.max(1, ratio);
        return {
            width: Math.max(1, Math.round(originalWidth / safeRatio)),
            height: Math.max(1, Math.round(originalHeight / safeRatio))
        };
    }

    // 픽셀 감축량으로 계산
    calculateDimensionsByReduction(originalWidth, originalHeight, reductionAmount, aspectRatio) {
        let newWidth = originalWidth - reductionAmount;
        newWidth = Math.max(1, newWidth); // 최소 1px 보장
        
        const newHeight = Math.round(newWidth * aspectRatio);
        return { 
            width: newWidth, 
            height: Math.max(1, newHeight) 
        };
    }
}