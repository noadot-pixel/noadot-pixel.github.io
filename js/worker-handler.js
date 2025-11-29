// js/worker-handler.js

import { state, CONFIG } from './state.js';
import { 
    // [핵심] 아까 만든 텍스트 업데이트 함수를 가져옵니다.
    updateOutputDimensionsDisplay, 
    elements, 
    getOptions, 
    updateColorRecommendations, 
    updatePaletteUsage, 
    updateTransform, 
    showLoading, 
    displayRecommendedPresetsInPopup,
    updateTotalPixelCount, 
} from './ui.js';

// 1. 워커 생성 (경로 안전성 강화)
export const conversionWorker = new Worker(
    new URL('./worker/image-worker.js', import.meta.url), 
    { type: 'module' }
);

// 2. 에러 핸들러 (파일 못 찾음 등)
conversionWorker.onerror = (err) => {
    console.error("❌ [Worker Error] 워커 파일 로드 실패 또는 내부 문법 오류:", err);
    showLoading(false);
};

// 3. 워커 메시지 수신 핸들러 (여기가 제일 중요합니다!)
conversionWorker.onmessage = (e) => {
    const { status, type, processId, message } = e.data;

    // 에러 처리
    if (status === 'error') {
        console.error(`❌ [Worker Logic Error] ${message}`);
        alert(`작업 중 오류 발생: ${message}`);
        showLoading(false);
        if (type === 'recommendationError' && elements.getStyleRecommendationsBtn) {
            elements.getStyleRecommendationsBtn.disabled = false;
        }
        return;
    }

    // [A] 업스케일 완료 (EPX 2x, 3x 등)
    if (type === 'upscaleResult') {
        const { imageData, scale } = e.data;
        
        // 1. 데이터 저장 (다운로드용)
        state.finalDownloadableData = imageData;
        state.currentUpscaleFactor = scale;
        state.isUpscaled = true;
        state.latestConversionData = imageData; 
        // 2. 캔버스 그리기
        const canvas = elements.convertedCanvas;
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        // 3. [핵심 수정] 수동으로 텍스트를 바꾸지 않고, 전용 함수를 호출합니다.
        // 알아서 보라색/빨간색 네온을 계산해서 붙여줍니다.
        updateOutputDimensionsDisplay();
        let pixelCount = 0;
        const data = imageData.data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] >= 128) pixelCount++;
        }
        // 업스케일된 상태가 '기본(base)'이 되므로 lastBasePixelCount 갱신
        state.lastBasePixelCount = pixelCount;
        
        // UI 업데이트 (이제 upscaleFactor는 이미 이미지에 반영됐으니 1로 계산됨? 
        // 아니요, updateTotalPixelCount 함수가 upscaleFactor를 또 곱해버리면 중복됩니다.
        // 해결책: updateTotalPixelCount에 'true' 같은 플래그를 줘서 "이미지 자체가 커진 거니까 배율 곱하지 마"라고 하거나,
        // 더 간단하게는: 이미 커진 이미지를 셌으니까, ui.js 함수가 'exportScale'만 곱하게 해야 합니다.)
        
        updateTotalPixelCount(pixelCount);
        // 4. 로딩 끄기
        showLoading(false);
    }

    // [B] 프리셋 추천 완료
    else if (type === 'recommendationResult') {
        if (processId !== state.processId) return;
        const { fixed, recommended, others } = e.data.results;
        const allPresets = [...fixed, ...recommended, ...others];
        if (window.applyPreset) {
            displayRecommendedPresetsInPopup(allPresets, window.applyPreset);
        }
        showLoading(false);
        if (elements.getStyleRecommendationsBtn) elements.getStyleRecommendationsBtn.disabled = false;
    }

    // [C] 일반 이미지 변환 완료 (가장 많이 실행됨)
    else if (type === 'conversionResult') {
        if (processId !== state.processId) return;
        
        const { imageData, recommendations, usageMap } = e.data;
        let pixelCount = 0;
        const data = imageData.data;
        
        // 픽셀 데이터(RGBA)를 4칸씩 건너뛰며 알파값(A)만 확인
        for (let i = 3; i < data.length; i += 4) {
            // 투명도가 128(약 50%) 이상인 픽셀만 '보이는 픽셀'로 카운트
            if (data[i] >= 128) { 
                pixelCount++;
            }
        }
        state.lastBasePixelCount = pixelCount;
        // UI 업데이트 함수 호출 (1,234 형식으로 표기됨)
        updateTotalPixelCount(pixelCount);
        // 1. 데이터 백업
        state.latestConversionData = imageData; 
        state.originalConvertedData = imageData; 
        if (recommendations) {
            state.latestRecommendations = recommendations;
        }
        // 2. 재변환했으므로 업스케일 상태 초기화 (1x로 리셋)
        const radio1x = document.getElementById('upscale1x');
        if (radio1x) radio1x.checked = true;
        state.currentUpscaleFactor = 1;

        // 3. 다운로드 데이터도 현재 변환본으로 설정
        state.finalDownloadableData = imageData;
        
        // 4. 캔버스 그리기 (화면 표시용 리사이징 포함)
        const canvas = elements.convertedCanvas || document.getElementById('convertedCanvas');
        const container = elements.convertedCanvasContainer || document.getElementById('convertedCanvasContainer');
        
        if (container) container.classList.add('has-image');
        
        const displayWidth = (state.appMode === 'image' && state.originalImageObject) 
            ? state.originalImageObject.width : imageData.width;
        const displayHeight = (state.appMode === 'image' && state.originalImageObject) 
            ? state.originalImageObject.height : imageData.height;
            
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
        
        const cCtx = canvas.getContext('2d');
        const opts = getOptions ? getOptions() : { pixelatedScaling: true };
        cCtx.imageSmoothingEnabled = !opts.pixelatedScaling;
        cCtx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
        
        // 5. UI 업데이트
        if (elements.downloadBtn) elements.downloadBtn.disabled = false;

        // [핵심 수정] 여기서도 수동 조작을 빼고 전용 함수를 부릅니다.
        // 출력 배율(exportScale)이 설정되어 있으면 알아서 금색 네온이 뜹니다.
        updateOutputDimensionsDisplay();
        
        updateTransform();
        if (recommendations) updateColorRecommendations(recommendations, triggerConversion);
        if (usageMap) updatePaletteUsage(usageMap);
        
        showLoading(false);
    }
};

export const triggerConversion = () => {
    if (state.isApplyingPreset) return;

    // 재변환 시 업스케일 풀기
    if (state.isUpscaled) {
        state.isUpscaled = false;
        if (typeof window.updateUpscaleButtonState === 'function') {
            window.updateUpscaleButtonState();
        }
    }

    clearTimeout(state.timeoutId);
    state.timeoutId = setTimeout(() => {
        if (state.appMode === 'image' && state.originalImageObject) processImage();
        else if (state.appMode === 'text') processText();
    }, CONFIG.DEBOUNCE_DELAY);
};

export const getActivePaletteData = () => {
    let paletteSelectors = [];
    
    if (state.currentMode === 'geopixels') {
        paletteSelectors.push('#geoPixelColors .color-button[data-on="true"]');
        paletteSelectors.push('#user-palette-section .added-color-item[data-on="true"]');
        
        const wplaceCheckbox = document.getElementById('useWplaceInGeoMode');
        if (wplaceCheckbox && wplaceCheckbox.checked) {
            paletteSelectors.push('#wplace-palette-in-geo .color-button[data-on="true"]');
        }
    } else {
        paletteSelectors.push('#wplace-controls .color-button[data-on="true"]');
    }

    const buttons = document.querySelectorAll(paletteSelectors.join(','));
    if(buttons.length === 0) return []; 
    
    return Array.from(buttons).map(b => JSON.parse(b.dataset.rgb));
};

const applyConversion = (imageDataToProcess, palette, options) => {
    if (!imageDataToProcess) return;
    state.isConverting = true;
    showLoading(true);
    
    const allBtns = document.querySelectorAll('.palette-buttons .color-button, .palette-buttons .added-color-item');
    const allPaletteColors = Array.from(allBtns).map(btn => JSON.parse(btn.dataset.rgb).join(','));
    
    // 워커에게 작업 지시
    conversionWorker.postMessage({
        type: 'conversionResult',
        imageData: imageDataToProcess,
        palette,
        allPaletteColors,
        options,
        processId: ++state.processId
    }, [imageDataToProcess.data.buffer]);
};

export const processImage = () => {
    if (!state.originalImageObject) return;
    
    const options = getOptions();
    const scaleSlider = elements.scaleSlider || document.getElementById('scaleSlider');
    const scaleWidth = elements.scaleWidth || document.getElementById('scaleWidth');
    const scaleHeight = elements.scaleHeight || document.getElementById('scaleHeight');
    const convertedDimensions = elements.convertedDimensions || document.getElementById('convertedDimensions');
    const container = elements.convertedCanvasContainer || document.getElementById('convertedCanvasContainer');

    if (container) container.classList.add('has-image');

    let newWidth, newHeight;

    if (state.scaleMode === 'ratio') {
        const sliderValue = parseInt(scaleSlider.value, 10);
        const scaleFactor = 1.0 + (sliderValue * 0.25);
        newWidth = Math.max(1, Math.round(state.originalImageObject.width / scaleFactor));
        newHeight = Math.max(1, Math.round(state.originalImageObject.height / scaleFactor));
    } else {
        newWidth = Math.max(1, parseInt(scaleWidth.value, 10) || state.originalImageObject.width);
        newHeight = Math.max(1, parseInt(scaleHeight.value, 10) || state.originalImageObject.height);
    }
    
    // 처리 전 임시 텍스트 표시 (네온 없음)
    if (convertedDimensions) convertedDimensions.textContent = `${newWidth} x ${newHeight} px`;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.imageSmoothingEnabled = !options.pixelatedScaling;
    tempCtx.drawImage(state.originalImageObject, 0, 0, newWidth, newHeight);
    
    const imageDataForWorker = tempCtx.getImageData(0, 0, newWidth, newHeight);
    const palette = getActivePaletteData();
    
    applyConversion(imageDataForWorker, palette, options);
    
    // [수정됨] 이전에 있던 "여기서 텍스트 업데이트하는 코드"를 삭제했습니다.
    // 왜냐하면 워커가 작업이 끝나면 'conversionResult' 메시지를 보내고,
    // 거기서 updateOutputDimensionsDisplay()가 호출되어 정확한 텍스트를 띄워줄 것이기 때문입니다.
};

// js/worker-handler.js 내부

export const processText = () => {
    const { content, fontFamily, fontSize, isBold, isItalic, letterSpacing, padding, textColor, bgColor, strokeColor, strokeWidth } = state.textState;
    const canvas = elements.convertedCanvas || document.getElementById('convertedCanvas');
    const container = elements.convertedCanvasContainer || document.getElementById('convertedCanvasContainer');
    const dims = elements.convertedDimensions || document.getElementById('convertedDimensions');

    // 1. 텍스트가 없으면 화면 지우고 종료
    if (!content) {
        if (container) container.classList.remove('has-image');
        const cCtx = canvas.getContext('2d');
        cCtx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // 2. 폰트 및 크기 계산용 임시 컨텍스트
    const tempCtx = document.createElement('canvas').getContext('2d');
    let fontStyle = '';
    if (isItalic) fontStyle += 'italic ';
    if (isBold) fontStyle += 'bold ';
    tempCtx.font = `${fontStyle} ${fontSize * 2}px "${fontFamily}"`;
    tempCtx.letterSpacing = `${letterSpacing}px`;

    const lines = content.split('\n');
    let maxWidth = 0;
    let totalHeight = 0;
    const lineMetrics = lines.map(line => {
        const metrics = tempCtx.measureText(line || ' ');
        maxWidth = Math.max(maxWidth, metrics.width);
        totalHeight += (metrics.actualBoundingBoxAscent || fontSize * 2) + (metrics.actualBoundingBoxDescent || 0);
        return metrics;
    });

    const canvasWidth = Math.ceil(maxWidth + padding * 2);
    const canvasHeight = Math.ceil(totalHeight + padding * 2);
    
    if(dims) dims.textContent = `${canvasWidth} x ${canvasHeight} px`;

    // 3. 실제 그리기용 캔버스 생성
    const textCanvas = document.createElement('canvas');
    textCanvas.width = canvasWidth;
    textCanvas.height = canvasHeight;
    const ctx = textCanvas.getContext('2d', { willReadFrequently: true });

    // ▼▼▼ [핵심] 색상 포맷 자동 변환 함수 ▼▼▼
    const toCssColor = (val) => {
        if (!val) return '#000000'; // 값이 없으면 검은색
        if (typeof val === 'string' && val.startsWith('#')) return val; // #FFFFFF면 그대로
        return `rgb(${val})`; // 255,255,255면 rgb()로 감싸기
    };

    // 배경색 칠하기
    ctx.fillStyle = toCssColor(bgColor);
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 텍스트 설정
    ctx.font = tempCtx.font;
    ctx.letterSpacing = tempCtx.letterSpacing;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let currentY = padding;
    lines.forEach((line, index) => {
        // 윤곽선 그리기
        if (strokeWidth > 0) {
            ctx.strokeStyle = toCssColor(strokeColor);
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(line, padding, currentY);
        }
        // 글자 채우기
        ctx.fillStyle = toCssColor(textColor);
        ctx.fillText(line, padding, currentY);
        
        currentY += (lineMetrics[index].actualBoundingBoxAscent || fontSize * 2) + (lineMetrics[index].actualBoundingBoxDescent || 0);
    });

    // 4. 이미지 데이터 추출 및 변환 준비
    const textImageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const palette = getActivePaletteData();
    const options = getOptions();
    
    // 텍스트 모드에서는 불필요한 필터 끄기
    options.celShading.apply = false;
    options.applyPattern = false;
    options.applyGradient = false;

    if (container) container.classList.add('has-image');
    
    // 5. 변환 실행 (이 파일 하단에 정의된 함수 호출)
    applyConversion(textImageData, palette, options);
};