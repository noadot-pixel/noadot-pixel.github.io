// js/worker/analysis.js

// 1. 헬퍼 함수들
const rgbToHsv = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) h = 0;
    else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, v * 100];
};

// 이미지 리사이징 (분석 속도 향상용)
const resizeForAnalysis = (imageData, targetWidth = 128) => {
    const { width, height, data } = imageData;
    if (width <= targetWidth) return imageData;
    const ratio = targetWidth / width;
    const targetHeight = Math.round(height * ratio);
    const newData = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
            const sx = Math.floor(x / ratio); const sy = Math.floor(y / ratio);
            const si = (sy * width + sx) * 4; const di = (y * targetWidth + x) * 4;
            newData[di] = data[si]; newData[di+1] = data[si+1]; newData[di+2] = data[si+2]; newData[di+3] = data[si+3];
        }
    }
    return { data: newData, width: targetWidth, height: targetHeight };
};

// 2. 핵심: 공간 분할 및 분석 (Segmentation)
export const analyzeImageFeatures = (originalImageData) => {
    // A. 속도를 위해 이미지 축소 (128px 너비)
    const img = resizeForAnalysis(originalImageData, 128);
    const { width, height, data } = img;
    
    // B. 엣지(외곽선) 맵 생성
    const isEdge = new Uint8Array(width * height); // 1: 벽, 0: 빈공간
    const threshold = 30; // 색상 차이 임계값 (이보다 크면 벽으로 인식)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i+3] < 128) { isEdge[y*width+x] = 1; continue; } // 투명은 벽 취급

            // 오른쪽 픽셀과 비교
            if (x < width - 1) {
                const ni = i + 4;
                const diff = Math.abs(data[i]-data[ni]) + Math.abs(data[i+1]-data[ni+1]) + Math.abs(data[i+2]-data[ni+2]);
                if (diff > threshold) isEdge[y*width+x] = 1;
            }
            // 아래쪽 픽셀과 비교
            if (y < height - 1) {
                const di = i + width * 4;
                const diff = Math.abs(data[i]-data[di]) + Math.abs(data[i+1]-data[di+1]) + Math.abs(data[i+2]-data[di+2]);
                if (diff > threshold) isEdge[y*width+x] = 1;
            }
        }
    }

    // C. 영역 채우기 (Connected Component Labeling)
    // 벽으로 막힌 공간마다 번호(ID)를 붙입니다.
    const labels = new Int32Array(width * height).fill(-1);
    const regions = []; // { id, count, r, g, b }
    let currentLabel = 0;

    // 스택 기반 Flood Fill
    const stack = [];
    
    for (let idx = 0; idx < width * height; idx++) {
        // 이미 방문했거나 벽이면 패스
        if (labels[idx] !== -1 || isEdge[idx] === 1) continue;

        // 새로운 방 발견!
        labels[idx] = currentLabel;
        const region = { id: currentLabel, count: 0, r: 0, g: 0, b: 0 };
        stack.push(idx);

        while (stack.length > 0) {
            const curr = stack.pop();
            const cx = curr % width;
            const cy = Math.floor(curr / width);
            
            // 색상 누적
            const pi = curr * 4;
            region.r += data[pi];
            region.g += data[pi+1];
            region.b += data[pi+2];
            region.count++;

            // 4방향 탐색
            const neighbors = [
                curr - 1, curr + 1, curr - width, curr + width
            ];
            
            // 상하좌우 유효성 체크 및 연결
            if (cx > 0 && labels[curr-1] === -1 && isEdge[curr-1] === 0) { labels[curr-1]=currentLabel; stack.push(curr-1); }
            if (cx < width-1 && labels[curr+1] === -1 && isEdge[curr+1] === 0) { labels[curr+1]=currentLabel; stack.push(curr+1); }
            if (cy > 0 && labels[curr-width] === -1 && isEdge[curr-width] === 0) { labels[curr-width]=currentLabel; stack.push(curr-width); }
            if (cy < height-1 && labels[curr+width] === -1 && isEdge[curr+width] === 0) { labels[curr+width]=currentLabel; stack.push(curr+width); }
        }

        // 방이 완성되면 평균색 계산
        region.r = Math.round(region.r / region.count);
        region.g = Math.round(region.g / region.count);
        region.b = Math.round(region.b / region.count);
        regions.push(region);
        currentLabel++;
    }

    // D. [예외 처리] 노이즈 제거
    // 전체 픽셀의 0.5%도 안 되는 아주 작은 방(자투리 그라데이션 등)은 버립니다.
    const minPixelCount = (width * height) * 0.005; 
    const validRegions = regions.filter(r => r.count > minPixelCount);

    // E. 정렬 (크기순) -> 고비율 색상
    validRegions.sort((a, b) => b.count - a.count);

    return { validRegions };
};

// 3. 추천 로직 (UI 연결)
export const calculateRecommendations = (imageData, currentPalette, options) => {
    // 공간 분석 실행
    const { validRegions } = analyzeImageFeatures(imageData);
    
    const recommendations = [];
    const usedHexSet = new Set(currentPalette.map(p => ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1)));

    const addRec = (rgb, type) => {
        const hex = ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1);
        if (!usedHexSet.has(hex)) {
            recommendations.push({ rgb, type });
            usedHexSet.add(hex);
        }
    };

    // A. [공간 기반] 주요 오브젝트 색상 (가장 큰 덩어리 5개)
    // 픽셀 수만 많은 게 아니라, '하나의 큰 덩어리'를 이루는 색입니다.
    validRegions.slice(0, 5).forEach(r => {
        addRec([r.r, r.g, r.b], "고비율 색상"); // UI 매핑에 맞춰 이름 유지
    });

    // B. [공간 기반] 포인트/하이라이트 색상 (작지만 강렬한 방)
    // 크기는 작지만(전체의 20% 미만), 채도나 명도가 뚜렷한 방을 찾습니다.
    const pointRegions = validRegions.filter(r => {
        // 너무 크면 포인트 아님
        if (r.count > (validRegions[0].count * 0.5)) return false;
        
        const [h, s, v] = rgbToHsv(r.r, r.g, r.b);
        // 채도가 높거나(Vivid) 아주 밝거나(Highlight)
        return (s > 60) || (v > 90);
    });

    // 포인트 중에서도 가장 뚜렷한 것 2개 추천
    pointRegions.slice(0, 2).forEach(r => {
        const [h, s, v] = rgbToHsv(r.r, r.g, r.b);
        const type = (v > 90) ? "밝은 톤" : "어두운 톤"; // 임시 매핑 (새 태그 만들기 전까지)
        addRec([r.r, r.g, r.b], type);
    });

    // C. [백업] 만약 포인트 색상을 못 찾았으면 기존 방식(절대값)으로 찾음
    if (recommendations.length < 6) {
        // 어두운 색 찾기
        const dark = validRegions.find(r => {
            const [h, s, v] = rgbToHsv(r.r, r.g, r.b);
            return v < 40;
        });
        if (dark) addRec([dark.r, dark.g, dark.b], "어두운 톤");
    }

    return recommendations;
};

export const getStyleRecipesByTags = () => ({ fixed: [], recommended: [], others: [] });