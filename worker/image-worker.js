import { smartResize } from './smart-resizer.js';
import { PostProcessor } from './post-processing.js';
import { preprocessImageData, matchColorAndDither } from './quantization.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors, bplaceColors } from '../data/palettes.js'; // 🌟 bplaceColors 추가!
import { extractExactKMeansPalette } from './analysis.js';

function flattenAlpha(imageData, threshold = 128) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha === 0) continue; 
        
        if (alpha >= threshold) {
            data[i + 3] = 255; // 완전 불투명
        } else {
            // 완전 투명 및 색상 데이터 초기화 (색상 알고리즘 교란 방지)
            data[i + 3] = 0;   
            data[i] = 0;       
            data[i + 1] = 0;   
            data[i + 2] = 0;   
        }
    }
    return imageData;
}

function applyDitherDenoise(imageData, strength) {
    if (strength <= 0) return imageData;

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src.length);
    
    // 강도(0~100)에 따라 반경과 허용치 계산
    const radius = Math.ceil(strength / 30); 
    const colorSigma = strength * 1.5;       
    const spaceSigma = radius;               

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = src[i], g = src[i+1], b = src[i+2], a = src[i+3];

            if (a === 0) { dst[i+3] = 0; continue; }

            let sumR = 0, sumG = 0, sumB = 0, weightSum = 0;

            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx, ny = y + dy;
                    
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const ni = (ny * width + nx) * 4;
                        if (src[ni+3] === 0) continue;

                        const nr = src[ni], ng = src[ni+1], nb = src[ni+2];
                        const colorDist = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
                        const spaceDist = Math.abs(dx) + Math.abs(dy);

                        // 외곽선은 살리고, 노이즈만 섞는 마법의 가중치 공식!
                        const weight = Math.exp(-(colorDist * colorDist) / (2 * colorSigma * colorSigma)) *
                                       Math.exp(-(spaceDist * spaceDist) / (2 * spaceSigma * spaceSigma));

                        sumR += nr * weight;
                        sumG += ng * weight;
                        sumB += nb * weight;
                        weightSum += weight;
                    }
                }
            }

            dst[i] = sumR / weightSum;
            dst[i+1] = sumG / weightSum;
            dst[i+2] = sumB / weightSum;
            dst[i+3] = a;
        }
    }
    return new ImageData(dst, width, height);
}

function buildActivePalette(options) {
    const active = [];
    const disabled = new Set(options.disabledHexes || []);
    
    const addColor = (c) => {
        const rgb = c.rgb || c;
        if (!rgb || rgb.length < 3) return;
        const hex = '#' + rgb.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join('');
        if (!disabled.has(hex)) active.push(rgb);
    };

    // 🌟 2. 각 탭에 맞는 팔레트만 엄격하게 분리해서 담습니다!
    if (options.mode === 'geopixels') {
        if (typeof geopixelsColors !== 'undefined') geopixelsColors.forEach(addColor);
        
        // 🌟 타 플랫폼 병합 체크 여부 확인
        if (options.useWplaceInGeopixels) {
            if (typeof wplaceFreeColors !== 'undefined') wplaceFreeColors.forEach(addColor);
            if (typeof wplacePaidColors !== 'undefined') wplacePaidColors.forEach(addColor);
        }
        if (options.useUplaceInGeopixels) { // 🌟 Uplace 병합 추가
            if (typeof uplaceColors !== 'undefined') uplaceColors.forEach(addColor);
        }
        if (options.useBplaceInGeopixels) { // 🌟 Bplace 병합 추가
            if (typeof bplaceColors !== 'undefined') bplaceColors.forEach(addColor);
        }
        
    } else if (options.mode === 'wplace') {
        if (typeof wplaceFreeColors !== 'undefined') wplaceFreeColors.forEach(addColor);
        if (typeof wplacePaidColors !== 'undefined') wplacePaidColors.forEach(addColor);
    } else if (options.mode === 'uplace') {
        if (typeof uplaceColors !== 'undefined') uplaceColors.forEach(addColor);
    } else if (options.mode === 'bplace') { // 🌟 Bplace 단독 모드 추가!
        if (typeof bplaceColors !== 'undefined') bplaceColors.forEach(addColor);
    }

    // (참고) 커스텀 팔레트는 사용자가 추가한 거니까 어떤 모드든 무조건 섞어줍니다.
    if (options.palette && Array.isArray(options.palette)) {
        options.palette.forEach(addColor);
    }

    // 최후의 방어선 (비상용 흑백 물감)
    if (active.length === 0) active.push([0, 0, 0]);
    return active;
}

self.onmessage = (e) => {
    try {
        const { type, imageData, options } = e.data;

        if (type === 'convert') {
            if (!imageData) throw new Error("이미지 데이터가 없습니다.");
            let currentImage = imageData;

            if (options.scaleWidth && options.scaleHeight) {
                const resizeMode = options.resizeMode || 'center';
                currentImage = smartResize(currentImage, options.scaleWidth, options.scaleHeight, resizeMode);
            }

            // 🌟 [Step 2] 투명도 컷오프 (핵심!): 리사이징으로 형태가 잡힌 직후 찌꺼기를 날려버립니다.
            currentImage = flattenAlpha(currentImage, 128);

            const pureColorCounts = {};
            const pData = currentImage.data;
            for (let i = 0; i < pData.length; i += 4) {
                if (pData[i+3] > 0) {
                    const hex = ('#' + pData[i].toString(16).padStart(2,'0') + 
                                       pData[i+1].toString(16).padStart(2,'0') + 
                                       pData[i+2].toString(16).padStart(2,'0')).toUpperCase();
                    pureColorCounts[hex] = (pureColorCounts[hex] || 0) + 1;
                }
            }

            if (options.useDitherDenoise && options.ditherDenoiseStrength > 0) {
                currentImage = applyDitherDenoise(currentImage, options.ditherDenoiseStrength);
            }

            currentImage = preprocessImageData(currentImage, options);

            const activePalette = buildActivePalette(options);
            // 🌟 주석 처리되어 있던 대망의 디더링 매칭 코어 부활!
            currentImage = matchColorAndDither(currentImage, activePalette, options);

            let activePixelCount = 0;
            const colorCounts = {}; // 🌟 색상별 사용량 장부 추가!
            const finalData = currentImage.data;
            
            for (let i = 0; i < finalData.length; i += 4) {
                if (finalData[i + 3] > 0) {
                    activePixelCount++;
                    // RGB를 HEX로 변환해서 몇 번 쓰였는지 카운트
                    const r = finalData[i].toString(16).padStart(2, '0');
                    const g = finalData[i+1].toString(16).padStart(2, '0');
                    const b = finalData[i+2].toString(16).padStart(2, '0');
                    const hex = ('#' + r + g + b).toUpperCase();
                    colorCounts[hex] = (colorCounts[hex] || 0) + 1;
                }
            }

            const stats = {
                width: currentImage.width,
                height: currentImage.height,
                activePixels: activePixelCount,
                colorCounts: colorCounts, 
                pureColorCounts: pureColorCounts // 🌟 영수증에 첨부 완료!
            };

            if (options.useSmoothing || options.useOrganicNoise || options.usePixelioe || options.useAlphaGradient) {
                currentImage = PostProcessor.apply(currentImage, options, options.scaleWidth, options.scaleHeight);
            }

            self.postMessage({ type: 'conversionDone', imageData: currentImage, stats: stats });
        }

        if (type === 'extractKMeans') {
            if (!imageData) throw new Error("이미지 데이터가 없습니다.");
            
            let currentImage = imageData;

            // 🌟 1. 리사이징 수행 (1번 원본 -> 2번 순수 축소본으로 변신!)
            if (options.scaleWidth && options.scaleHeight) {
                const resizeMode = options.resizeMode || 'center';
                currentImage = smartResize(currentImage, options.scaleWidth, options.scaleHeight, resizeMode);
            }
            
            // 2. 투명도 찌꺼기 제거
            currentImage = flattenAlpha(currentImage, 128);
            
            // 3. 2번 이미지를 바탕으로 K-Means++ 가동!
            const extractedColors = extractExactKMeansPalette(currentImage, options.colorCount, options);
            
            // 4. 브릿지로 추출된 순수 색상 배달
            self.postMessage({ type: 'kmeansExtractionResult', colors: extractedColors });
        }
        
    } catch (err) {
        console.error("🚨 [Worker 내부 에러]:", err);
        self.postMessage({ status: 'error', message: err.message || "알 수 없는 워커 오류" });
    }
};