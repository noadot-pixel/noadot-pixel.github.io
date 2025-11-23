// js/worker-handler.js
import { state, CONFIG } from './state.js';
import { elements, getOptions, updateColorRecommendations, updatePaletteUsage, updateTransform, showLoading, displayRecommendedPresetsInPopup } from './ui.js';

// 1. 워커 생성 (경로 안전성 강화)
export const conversionWorker = new Worker(
    new URL('./worker/image-worker.js', import.meta.url), 
    { type: 'module' }
);

// [수정됨] 2. 진짜 에러 원인을 잡는 핸들러 추가
conversionWorker.onerror = (err) => {
    console.error("❌ [Worker Error] 워커 파일 로드 실패 또는 내부 문법 오류:", err);
    console.log("힌트: 로컬 서버(Live Server)를 사용 중인지, 파일 경로(js/worker/image-worker.js)가 정확한지 확인하세요.");
    
    // 사용자에게 알림 (선택 사항)
    // alert("이미지 처리 엔진을 불러오지 못했습니다. 페이지를 새로고침 해보세요.");
    showLoading(false);
};

// 3. 워커 메시지 수신 핸들러
conversionWorker.onmessage = (e) => {
    const { status, type, processId, message } = e.data;

    if (status === 'error') {
        console.error(`❌ [Worker Logic Error] ${message}`);
        alert(`작업 중 오류 발생: ${message}`);
        showLoading(false);
        if (type === 'recommendationError' && elements.getStyleRecommendationsBtn) {
            elements.getStyleRecommendationsBtn.disabled = false;
        }
        return;
    }

    // 프리셋 추천 결과
    if (type === 'recommendationResult') {
        if (processId !== state.processId) return;
        const { fixed, recommended, others } = e.data.results;
        const allPresets = [...fixed, ...recommended, ...others];
        if (window.applyPreset) {
            displayRecommendedPresetsInPopup(allPresets, window.applyPreset);
        }
        showLoading(false);
        if (elements.getStyleRecommendationsBtn) elements.getStyleRecommendationsBtn.disabled = false;

    // [중요] 이미지 변환 결과 처리
    } else if (type === 'conversionResult') {
        if (processId !== state.processId) return;
        
        const { imageData, recommendations, usageMap } = e.data;
        state.finalDownloadableData = imageData;
        
        const canvas = elements.convertedCanvas || document.getElementById('convertedCanvas');
        const container = elements.convertedCanvasContainer || document.getElementById('convertedCanvasContainer');

        if (!canvas) {
            console.error("❌ 캔버스 요소를 찾을 수 없습니다.");
            return;
        }

        // [수정됨] 핵심: 여기서 CSS 클래스를 강제로 붙여야 이미지가 보입니다!
        if (container) {
            container.classList.add('has-image');
        }

        // 캔버스 크기 및 그리기
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
        
        const displayWidth = (state.appMode === 'image' && state.originalImageObject) 
            ? state.originalImageObject.width : imageData.width;
        const displayHeight = (state.appMode === 'image' && state.originalImageObject) 
            ? state.originalImageObject.height : imageData.height;
        
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        
        const cCtx = canvas.getContext('2d');
        const opts = getOptions ? getOptions() : { pixelatedScaling: true };
        cCtx.imageSmoothingEnabled = !opts.pixelatedScaling;
        cCtx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
        
        // UI 업데이트
        if (elements.downloadBtn) elements.downloadBtn.disabled = false;
        updateTransform();
        if (recommendations) updateColorRecommendations(recommendations, triggerConversion);
        if (usageMap) updatePaletteUsage(usageMap);
        
        showLoading(false);
    }
};

export const triggerConversion = () => {
    if (state.isApplyingPreset) return;
    clearTimeout(state.timeoutId);
    state.timeoutId = setTimeout(() => {
        if (state.appMode === 'image' && state.originalImageObject) processImage();
        else if (state.appMode === 'text') processText();
    }, CONFIG.DEBOUNCE_DELAY);
};

export const getActivePaletteData = () => {
    let paletteSelectors = [];
    
    if (state.currentMode === 'geopixels') {
        // [수정됨] 부모 ID(#geopixels-controls) 대신 자식 ID(#geoPixelColors)를 콕 집어서 지정
        // 이렇게 해야 뒤에 있는 Wplace 색상들이 딸려오지 않습니다.
        paletteSelectors.push('#geoPixelColors .color-button[data-on="true"]');
        
        // 사용자 추가 색상 포함
        paletteSelectors.push('#user-palette-section .added-color-item[data-on="true"]');
        
        // [중요] 체크박스가 실제로 체크되어 있을 때만 Wplace 팔레트 추가
        // state 변수보다 DOM 상태를 직접 확인하는 것이 더 확실합니다.
        const wplaceCheckbox = document.getElementById('useWplaceInGeoMode');
        if (wplaceCheckbox && wplaceCheckbox.checked) {
            paletteSelectors.push('#wplace-palette-in-geo .color-button[data-on="true"]');
        }
    } else {
        // Wplace 모드일 때
        paletteSelectors.push('#wplace-controls .color-button[data-on="true"]');
    }

    // 선택된 버튼들 찾기
    const buttons = document.querySelectorAll(paletteSelectors.join(','));
    
    // 팔레트가 비었을 때 빈 배열 반환 (검은색/투명 출력의 원인이 됨 -> 정상 동작)
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
    // [수정됨] UI 안전 참조 (elements 객체 사용 우선)
    const scaleSlider = elements.scaleSlider || document.getElementById('scaleSlider');
    const scaleWidth = elements.scaleWidth || document.getElementById('scaleWidth');
    const scaleHeight = elements.scaleHeight || document.getElementById('scaleHeight');
    const convertedDimensions = elements.convertedDimensions || document.getElementById('convertedDimensions');
    const container = elements.convertedCanvasContainer || document.getElementById('convertedCanvasContainer');

    // [수정됨] 이미지가 처리되기 시작할 때 미리 클래스를 붙여둡니다.
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

    if (convertedDimensions) {
        const baseText = `${newWidth} x ${newHeight} px`;
        const scale = state.exportScale || 1;
        
        if (scale > 1) {
            const finalW = newWidth * scale;
            const finalH = newHeight * scale;
            convertedDimensions.textContent = `${baseText} ➜ ${finalW} x ${finalH} px (${scale}배)`;
            convertedDimensions.classList.add('neon-gold');
        } else {
            convertedDimensions.textContent = baseText;
            convertedDimensions.classList.remove('neon-gold');
        }
    }

};

export const processText = () => {
    const { content, fontFamily, fontSize, isBold, isItalic, letterSpacing, padding, textColor, bgColor, strokeColor, strokeWidth } = state.textState;
    const canvas = elements.convertedCanvas || document.getElementById('convertedCanvas');
    const container = elements.convertedCanvasContainer || document.getElementById('convertedCanvasContainer');
    const dims = elements.convertedDimensions || document.getElementById('convertedDimensions');

    if (!content) {
        if (container) container.classList.remove('has-image');
        const cCtx = canvas.getContext('2d');
        cCtx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

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

    const textCanvas = document.createElement('canvas');
    textCanvas.width = canvasWidth;
    textCanvas.height = canvasHeight;
    const ctx = textCanvas.getContext('2d', { willReadFrequently: true });

    ctx.fillStyle = `rgb(${bgColor})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.font = tempCtx.font;
    ctx.letterSpacing = tempCtx.letterSpacing;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let currentY = padding;
    lines.forEach((line, index) => {
        if (strokeWidth > 0) {
            ctx.strokeStyle = `rgb(${strokeColor})`;
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(line, padding, currentY);
        }
        ctx.fillStyle = `rgb(${textColor})`;
        ctx.fillText(line, padding, currentY);
        currentY += (lineMetrics[index].actualBoundingBoxAscent || fontSize * 2) + (lineMetrics[index].actualBoundingBoxDescent || 0);
    });

    const textImageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const palette = getActivePaletteData();
    const options = getOptions();
    options.celShading.apply = false;
    options.applyPattern = false;
    options.applyGradient = false;

    if (container) container.classList.add('has-image');
    applyConversion(textImageData, palette, options);
};