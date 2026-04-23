// js/worker/kmeans-worker.js

// 🚀 초고속 K-Means 색상 추출 엔진
self.onmessage = function(e) {
    const { imageData, colorCount } = e.data;
    
    if (!imageData) {
        self.postMessage({ status: 'error', message: '이미지 데이터가 없습니다.' });
        return;
    }

    try {
        const pixels = imageData.data;
        const pixelCount = pixels.length / 4;
        const uniqueColors = new Map();

        // 1. 중복 색상 제거 및 가중치(빈도수) 계산 (엄청난 속도 향상!)
        for (let i = 0; i < pixels.length; i += 4) {
            // 투명한 픽셀은 무시
            if (pixels[i + 3] === 0) continue; 
            
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            // RGB를 하나의 숫자로 묶어서 키(key)로 사용
            const key = (r << 16) | (g << 8) | b;
            
            uniqueColors.set(key, (uniqueColors.get(key) || 0) + 1);
        }

        const colorArray = Array.from(uniqueColors.keys());
        const maxColors = Math.min(colorCount, colorArray.length);

        // 색상이 요청한 것보다 적으면 그냥 다 반환
        if (colorArray.length <= maxColors) {
            const result = colorArray.map(key => [
                (key >> 16) & 255, 
                (key >> 8) & 255, 
                key & 255
            ]);
            self.postMessage({ status: 'success', colors: result });
            return;
        }

        // 2. K-Means++ 초기 중심점 설정 (더 똑똑한 색상 선별)
        let centroids = [];
        centroids.push(colorArray[Math.floor(Math.random() * colorArray.length)]);

        for (let i = 1; i < maxColors; i++) {
            let maxDist = -1;
            let bestColor = colorArray[0];

            for (let j = 0; j < colorArray.length; j++) {
                const color = colorArray[j];
                const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
                
                let minDist = Infinity;
                for (let k = 0; k < centroids.length; k++) {
                    const cr = (centroids[k] >> 16) & 255;
                    const cg = (centroids[k] >> 8) & 255;
                    const cb = centroids[k] & 255;
                    // RGB 거리 계산
                    const dist = (r - cr)**2 + (g - cg)**2 + (b - cb)**2;
                    if (dist < minDist) minDist = dist;
                }

                if (minDist > maxDist) {
                    maxDist = minDist;
                    bestColor = color;
                }
            }
            centroids.push(bestColor);
        }

        // 3. K-Means 클러스터링 반복 (Lloyd's 알고리즘)
        let rgbCentroids = centroids.map(c => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
        let iterations = 0;
        let hasChanged = true;

        while (hasChanged && iterations < 10) { // 최대 10번만 반복 (속도 타협점)
            hasChanged = false;
            let clusters = Array.from({ length: maxColors }, () => ({ r: 0, g: 0, b: 0, count: 0 }));

            // 픽셀들을 가장 가까운 중심점에 할당
            for (const [color, count] of uniqueColors.entries()) {
                const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
                
                let minDist = Infinity;
                let bestIdx = 0;

                for (let i = 0; i < maxColors; i++) {
                    const cr = rgbCentroids[i][0], cg = rgbCentroids[i][1], cb = rgbCentroids[i][2];
                    const dist = (r - cr)**2 + (g - cg)**2 + (b - cb)**2;
                    if (dist < minDist) {
                        minDist = dist;
                        bestIdx = i;
                    }
                }

                clusters[bestIdx].r += r * count;
                clusters[bestIdx].g += g * count;
                clusters[bestIdx].b += b * count;
                clusters[bestIdx].count += count;
            }

            // 중심점 재계산
            for (let i = 0; i < maxColors; i++) {
                if (clusters[i].count > 0) {
                    const newR = Math.round(clusters[i].r / clusters[i].count);
                    const newG = Math.round(clusters[i].g / clusters[i].count);
                    const newB = Math.round(clusters[i].b / clusters[i].count);

                    if (newR !== rgbCentroids[i][0] || newG !== rgbCentroids[i][1] || newB !== rgbCentroids[i][2]) {
                        rgbCentroids[i] = [newR, newG, newB];
                        hasChanged = true;
                    }
                }
            }
            iterations++;
        }

        // 📍 [배송] 추출 완료된 색상 배열 반환
        self.postMessage({ status: 'success', colors: rgbCentroids });

    } catch (err) {
        self.postMessage({ status: 'error', message: err.message });
    }
};