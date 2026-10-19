import { smartResize } from './smart-resizer.js';
import { PostProcessor } from './post-processing.js';
import { preprocessImageData, matchColorAndDither, extractOutlineLayer } from './quantization.js';
import { extractExactKMeansPalette } from './analysis.js';
import { buildActivePalette } from './palette-utils.js';

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

// 🌟 [레이어 기능] buildActivePalette는 이제 worker/palette-utils.js로 옮겨짐
// (메인 스레드의 레이어 합성 "팔레트 스냅" 단계에서도 똑같은 함수가 필요해서 공용화)

// 🌟 [성능] 원본 이미지를 워커 안에 캐싱해서, 슬라이더를 움직일 때마다
// 전체 픽셀 버퍼를 메인 스레드->워커로 매번 구조적 복제하지 않도록 함.
// (WorkerBridge가 이미지가 실제로 바뀌었을 때만 imageData를 실어 보냄)
let cachedOriginal = null;

// 🌟 [정리] 'convert'와 (중복 색상 검사 팝업의) 'previewConvert'가 완전히 같은 파이프라인을
// 타므로, 중복 작성 대신 공용 함수로 뽑아서 재사용한다.
function runConversionPipeline(original, options) {
    // 캐시된 원본은 절대 직접 변형하지 않도록 매 변환마다 작업용 사본을 만든다.
    let currentImage = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);

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

    return { currentImage, stats };
}

self.onmessage = (e) => {
    try {
        const { type, imageData, options, cacheOriginal } = e.data;

        if (type === 'convert') {
            if (imageData && cacheOriginal !== false) {
                cachedOriginal = imageData;
            }
            const original = imageData || cachedOriginal;
            if (!original) throw new Error("이미지 데이터가 없습니다.");

            const { currentImage, stats } = runConversionPipeline(original, options);

            // 🌟 [성능] 결과 픽셀 버퍼는 워커가 다시 쓸 일이 없으므로 복제 대신 소유권을 이전(zero-copy)
            self.postMessage({ type: 'conversionDone', imageData: currentImage, stats: stats }, [currentImage.data.buffer]);
        }

        // 🌟 [신규] 중복 색상 검사 팝업 전용 미리보기 변환.
        // 실제 상태(state.disabledHexes 등)는 건드리지 않고, 팝업에서 임시로 켜고 끈 색상
        // 조합만 반영해서 결과를 그려주기 위한 용도라 conversionDone과는 별개 응답을 쓴다.
        // (같은 메시지 타입을 쓰면 메인 화면/팔레트 사용량 카운트가 미리보기 값으로 오염됨)
        if (type === 'previewConvert') {
            const original = imageData || cachedOriginal;
            if (!original) throw new Error("이미지 데이터가 없습니다.");

            const { currentImage, stats } = runConversionPipeline(original, options);

            // 🌟 [신규] 중복 색상 검사 팝업이 토글 결과에 따른 실시간 사용량(px)도 함께 보여줄 수 있도록 colorCounts 동봉
            self.postMessage({ type: 'previewConversionResult', imageData: currentImage, colorCounts: stats.colorCounts }, [currentImage.data.buffer]);
        }

        // 🌟 [레이어 기능] 외곽선(라인아트) 레이어 추출 - 기존 변환 파이프라인(runConversionPipeline)과는
        // 완전히 분리된 요청/응답이다. 팔레트/디더링과 무관해서(합성 시 팔레트 스냅 단계에서 처리) 슬라이더를
        // 움직일 때마다 돌 필요가 없고, "이 레이어 전용 설정을 바꿨을 때"나 "원본 이미지/리사이즈 크기가
        // 바뀌었을 때"만 K-means 추출 요청과 같은 방식(fire-and-forget, isWorkerBusy 안 건드림)으로 호출된다.
        if (type === 'extractOutline') {
            if (imageData && cacheOriginal !== false) {
                cachedOriginal = imageData;
            }
            const original = imageData || cachedOriginal;
            if (!original) throw new Error("이미지 데이터가 없습니다.");

            // 🚨 리사이즈를 먼저 하면 가는 선이 평균화(블러)되어 문턱값 아래로 사라질 수 있다.
            // 그래서 "원본 해상도에서 먼저 문턱값 판정 -> 그 다음 커버리지 비율로 다운샘플" 순서를 지킨다
            // (extractOutlineLayer 내부에서 처리). 여기서는 알파만 정리해서 넘긴다.
            let sourceImage = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
            sourceImage = flattenAlpha(sourceImage, 128);

            const targetW = options.scaleWidth || sourceImage.width;
            const targetH = options.scaleHeight || sourceImage.height;
            const outlineImage = extractOutlineLayer(sourceImage, options.outlineParams || {}, targetW, targetH);

            self.postMessage({
                type: 'outlineResult',
                requestId: e.data.requestId,
                layerId: e.data.layerId,
                imageData: outlineImage
            }, [outlineImage.data.buffer]);
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
        // 🌟 [레이어 기능] 어떤 요청이 실패했는지 표시해둬야 WorkerBridge가 "외곽선 추출 실패"를
        // "메인 변환 실패"로 오인해서 화면을 원본으로 되돌려버리는 사고를 막을 수 있다.
        self.postMessage({
            status: 'error',
            message: err.message || "알 수 없는 워커 오류",
            requestType: e.data?.type,
            requestId: e.data?.requestId,
            layerId: e.data?.layerId
        });
    }
};