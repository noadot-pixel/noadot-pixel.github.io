// script.js (수정 완료 - HEX 코드 이름 표시 기능 추가)

const wplaceFreeColors = [{rgb:[0,0,0],name:"black"},{rgb:[60,60,60],name:"dark gray"},{rgb:[120,120,120],name:"gray"},{rgb:[210,210,210],name:"light gray"},{rgb:[255,255,255],name:"white"},{rgb:[96,0,24],name:"deep red"},{rgb:[237,28,36],name:"red"},{rgb:[255,127,39],name:"orange"},{rgb:[246,171,9],name:"gold"},{rgb:[249,221,59],name:"yellow"},{rgb:[255,250,188],name:"light yellow"},{rgb:[14,185,104],name:"dark green"},{rgb:[19,230,123],name:"green"},{rgb:[135,255,94],name:"light green"},{rgb:[12,129,110],name:"dark teal"},{rgb:[16,174,166],name:"teal"},{rgb:[19,225,190],name:"light teal"},{rgb:[96,247,242],name:"cyan"},{rgb:[40,80,158],name:"dark blue"},{rgb:[64,147,228],name:"blue"},{rgb:[107,80,246],name:"indigo"},{rgb:[153,177,251],name:"light indigo"},{rgb:[120,12,153],name:"dark purple"},{rgb:[170,56,185],name:"purple"},{rgb:[224,159,249],name:"light purple"},{rgb:[203,0,122],name:"dark pink"},{rgb:[236,31,128],name:"pink"},{rgb:[243,141,169],name:"light pink"},{rgb:[104,70,52],name:"dark brown"},{rgb:[149,104,42],name:"brown"},{rgb:[248,178,119],name:"beige"}];
const wplacePaidColors = [{rgb:[170,170,170],name:"medium gray"},{rgb:[165,14,30],name:"dark red"},{rgb:[250,128,114],name:"light red"},{rgb:[228,92,26],name:"dark orange"},{rgb:[156,132,49],name:"dark goldenrod"},{rgb:[197,173,49],name:"goldenrod"},{rgb:[232,212,95],name:"light goldenrod"},{rgb:[74,107,58],name:"dark olive"},{rgb:[90,148,74],name:"olive"},{rgb:[132,197,115],name:"light olive"},{rgb:[15,121,159],name:"dark cyan"},{rgb:[187,250,242],name:"light cyan"},{rgb:[125,199,255],name:"light blue"},{rgb:[77,49,184],name:"dark indigo"},{rgb:[74,66,132],name:"dark slate blue"},{rgb:[122,113,196],name:"slate blue"},{rgb:[181,174,241],name:"light slate blue"},{rgb:[155,82,73],name:"dark peach"},{rgb:[209,128,120],name:"peach"},{rgb:[250,182,164],name:"light peach"},{rgb:[219,164,99],name:"light brown"},{rgb:[123,99,82],name:"dark tan"},{rgb:[156,132,107],name:"tan"},{rgb:[214,181,148],name:"light tan"},{rgb:[209,128,81],name:"dark beige"},{rgb:[255,197,165],name:"light beige"},{rgb:[109,100,63],name:"dark stone"},{rgb:[148,140,107],name:"stone"},{rgb:[205,197,158],name:"light stone"},{rgb:[51,57,65],name:"dark slate"},{rgb:[109,117,141],name:"slate"},{rgb:[179,185,209],name:"light slate"}];
const geopixelsColors = [{rgb:[255,255,255],name:null},{rgb:[244,245,159],name:null},{rgb:[255,202,58],name:null},{rgb:[255,159,28],name:null},{rgb:[255,89,94],name:null},{rgb:[231,29,54],name:null},{rgb:[243,187,194],name:null},{rgb:[255,133,161],name:null},{rgb:[189,99,125],name:null},{rgb:[205,180,219],name:null},{rgb:[106,76,147],name:null},{rgb:[77,25,77],name:null},{rgb:[168,208,220],name:null},{rgb:[46,196,182],name:null},{rgb:[26,83,92],name:null},{rgb:[109,157,205],name:null},{rgb:[25,130,196],name:null},{rgb:[161,193,129],name:null},{rgb:[138,201,38],name:null},{rgb:[160,160,160],name:null},{rgb:[107,66,38],name:null},{rgb:[80,80,80],name:null},{rgb:[207,208,120],name:null},{rgb:[20,90,122],name:null},{rgb:[139,29,36],name:null},{rgb:[192,127,122],name:null},{rgb:[196,154,108],name:null},{rgb:[91,123,28],name:null},{rgb:[0,0,0],name:null}];

const PNGMetadata = { encode(keyword, content) { const keywordBytes = new TextEncoder().encode(keyword); const contentBytes = new TextEncoder().encode(content); const chunkType = new Uint8Array([116, 69, 88, 116]); const chunkData = new Uint8Array(keywordBytes.length + 1 + contentBytes.length); chunkData.set(keywordBytes); chunkData.set([0], keywordBytes.length); chunkData.set(contentBytes, keywordBytes.length + 1); const length = new Uint8Array(4); new DataView(length.buffer).setUint32(0, chunkData.length, false); const crcData = new Uint8Array(chunkType.length + chunkData.length); crcData.set(chunkType); crcData.set(chunkData, chunkType.length); const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, this.crc32(crcData), false); const chunk = new Uint8Array(length.length + chunkType.length + chunkData.length + crc.length); chunk.set(length); chunk.set(chunkType, 4); chunk.set(chunkData, 8); chunk.set(crc, 8 + chunkData.length); return chunk; }, embed(pngArrayBuffer, metadata) { const pngBytes = new Uint8Array(pngArrayBuffer); const keyword = 'NoaDotSettings'; const content = JSON.stringify(metadata); const metadataChunk = this.encode(keyword, content); const iendIndex = pngBytes.length - 12; const newPngBytes = new Uint8Array(pngBytes.length + metadataChunk.length); newPngBytes.set(pngBytes.subarray(0, iendIndex)); newPngBytes.set(metadataChunk, iendIndex); newPngBytes.set(pngBytes.subarray(iendIndex), iendIndex + metadataChunk.length); return newPngBytes.buffer; }, async extract(file) { const buffer = await file.arrayBuffer(); const bytes = new Uint8Array(buffer); const keyword = 'NoaDotSettings'; let offset = 8; while (offset < bytes.length) { const view = new DataView(bytes.buffer, offset); const length = view.getUint32(0); const type = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8)); if (type === 'tEXt') { const chunkData = bytes.subarray(offset + 8, offset + 8 + length); let separatorIndex = -1; for(let i=0; i<chunkData.length; i++) { if (chunkData[i] === 0) { separatorIndex = i; break; } } if (separatorIndex !== -1) { const currentKeyword = new TextDecoder().decode(chunkData.subarray(0, separatorIndex)); if (currentKeyword === keyword) { const content = new TextDecoder().decode(chunkData.subarray(separatorIndex + 1)); return JSON.parse(content); } } } offset += 12 + length; } return null; }, crcTable: (() => { let c; const crcTable = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) { c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)); } crcTable[n] = c; } return crcTable; })(), crc32(bytes) { let crc = 0 ^ (-1); for (let i = 0; i < bytes.length; i++) { crc = (crc >>> 8) ^ this.crcTable[(crc ^ bytes[i]) & 0xFF]; } return (crc ^ (-1)) >>> 0; } };

document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = { DEBOUNCE_DELAY: 150, SCALE_FACTOR: 4.0, DEFAULTS: { saturationSlider: 100, brightnessSlider: 0, contrastSlider: 0, ditheringSlider: 0 } };
    const state = { appMode: 'image', isConverting: false, processId: 0, originalImageData: null, originalImageObject: null, originalFileName: 'image', currentZoom: 100, isDragging: false, panX: 0, panY: 0, startPanX: 0, startPanY: 0, startDragX: 0, startDragY: 0, finalDownloadableData: null, currentMode: 'geopixels', useWplaceInGeoMode: false, highQualityMode: false, edgeCleanup: false, scaleMode: 'pixel', aspectRatio: 1, textState: { content: '', fontFamily: 'Malgun Gothic', fontSize: 15, isBold: false, isItalic: false, letterSpacing: 0, padding: 10, textColor: '0,0,0', bgColor: '255,255,255', strokeColor: '0,0,0', strokeWidth: 0, } };
    const elements = {
        loadingIndicator: document.getElementById('loading-indicator'),
        appContainer: document.querySelector('.app-container'),
        imageModeBtn: document.getElementById('imageMode'), textModeBtn: document.getElementById('textMode'),
        imageControls: document.getElementById('image-controls'), textControls: document.getElementById('text-controls'),
        textEditorPanel: document.getElementById('text-editor-panel'),
        imageUpload: document.getElementById('imageUpload'),
        downloadBtn: document.getElementById('downloadBtn'),
        convertedCanvas: document.getElementById('convertedCanvas'),
        convertedCanvasContainer: document.getElementById('convertedCanvasContainer'),
        centerBtn: document.getElementById('centerBtn'), zoomLevelDisplay: document.getElementById('zoomLevelDisplay'),
        imageDimensionsDisplay: document.getElementById('imageDimensionsDisplay'),
        originalDimensions: document.getElementById('originalDimensions'),
        convertedDimensions: document.getElementById('convertedDimensions'),
        convertedDimensionsLabel: document.getElementById('convertedDimensionsLabel'),
        saturationSlider: document.getElementById('saturationSlider'), saturationValue: document.getElementById('saturationValue'),
        brightnessSlider: document.getElementById('brightnessSlider'), brightnessValue: document.getElementById('brightnessValue'),
        contrastSlider: document.getElementById('contrastSlider'), contrastValue: document.getElementById('contrastValue'),
        highQualityMode: document.getElementById('highQualityMode'),
        edgeCleanup: document.getElementById('edgeCleanup'),
        ditheringAlgorithmSelect: document.getElementById('ditheringAlgorithmSelect'),
        ditheringSlider: document.getElementById('ditheringSlider'), ditheringValue: document.getElementById('ditheringValue'),
        ditheringAlgorithmGroup: document.getElementById('dithering-algorithm-group'),
        ditheringStrengthGroup: document.getElementById('dithering-strength-group'),
        scaleControlsFieldset: document.getElementById('scaleControlsFieldset'),
        scaleModeSelect: document.getElementById('scaleModeSelect'),
        ratioScaleControls: document.getElementById('ratio-scale-controls'),
        pixelScaleControls: document.getElementById('pixel-scale-controls'),
        scaleSlider: document.getElementById('scaleSlider'), scaleValue: document.getElementById('scaleValue'),
        scaleWidth: document.getElementById('scaleWidth'), scaleHeight: document.getElementById('scaleHeight'),
        pixelScaleSlider: document.getElementById('pixelScaleSlider'),
        recommendationSection: document.getElementById('recommendation-section'),
        recommendedColorsContainer: document.getElementById('recommendedColors'),
        wplaceFreeColorsContainer: document.getElementById('wplaceFreeColors'),
        wplacePaidColorsContainer: document.getElementById('wplacePaidColors'),
        geoPixelColorsContainer: document.getElementById('geoPixelColors'),
        addedColorsContainer: document.getElementById('addedColors'),
        addColorBtn: document.getElementById('addColorBtn'),
        addHex: document.getElementById('addHex'),
        addR: document.getElementById('addR'), addG: document.getElementById('addG'), addB: document.getElementById('addB'),
        hexInputFeedback: document.getElementById('hexInputFeedback'),
        rgbInputFeedback: document.getElementById('rgbInputFeedback'),
        exportPaletteBtn: document.getElementById('exportPaletteBtn'),
        importPaletteBtn: document.getElementById('importPaletteBtn'),
        paletteUpload: document.getElementById('paletteUpload'),
        resetAddedColorsBtn: document.getElementById('resetAddedColorsBtn'),
        geopixelsModeBtn: document.getElementById('geopixelsMode'),
        wplaceModeBtn: document.getElementById('wplaceMode'),
        geopixelsControls: document.getElementById('geopixels-controls'),
        wplaceControls: document.getElementById('wplace-controls'),
        useWplaceInGeoMode: document.getElementById('useWplaceInGeoMode'),
        wplacePaletteInGeo: document.getElementById('wplace-palette-in-geo'),
        wplaceFreeColorsInGeo: document.getElementById('wplaceFreeColorsInGeo'),
        wplacePaidColorsInGeo: document.getElementById('wplacePaidColorsInGeo'),
        placeholderUi: document.getElementById('placeholder-ui'),
        editorTextarea: document.getElementById('editor-textarea'),
        fontSelect: document.getElementById('fontSelect'),
        fontSizeSlider: document.getElementById('fontSizeSlider'), fontSizeValue: document.getElementById('fontSizeValue'),
        letterSpacingSlider: document.getElementById('letterSpacingSlider'), letterSpacingValue: document.getElementById('letterSpacingValue'),
        paddingSlider: document.getElementById('paddingSlider'), paddingValue: document.getElementById('paddingValue'),
        uploadFontBtn: document.getElementById('uploadFontBtn'), fontUpload: document.getElementById('fontUpload'),
        textColorSelect: document.getElementById('textColorSelect'), bgColorSelect: document.getElementById('bgColorSelect'), strokeColorSelect: document.getElementById('strokeColorSelect'),
        strokeWidthSlider: document.getElementById('strokeWidthSlider'), strokeWidthValue: document.getElementById('strokeWidthValue'),
        metadataInfoDisplay: document.getElementById('metadata-info-display'),
        userPaletteSection: document.getElementById('user-palette-section'),
    };
    const cCtx = elements.convertedCanvas.getContext('2d');
    const conversionWorker = new Worker('worker.js');

    const showLoading = (visible) => { elements.loadingIndicator.classList.toggle('visible', visible); };
    const getTextColorForBg = (rgb) => { const [r, g, b] = rgb; const luminance = (0.299 * r + 0.587 * g + 0.114 * b); return luminance > 128 ? '#000000' : '#FFFFFF'; };
    const updateTransform = () => { const scale = state.currentZoom / 100; elements.convertedCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${scale})`; elements.zoomLevelDisplay.textContent = `${state.currentZoom}%`; };
    const updateZoom = (newZoom) => { state.currentZoom = Math.max(25, Math.min(500, newZoom)); updateTransform(); };
    const gatherSettingsData = () => { if (state.currentMode === 'geopixels') { return { version: '2.10', type: 'colors', data: Array.from(elements.addedColorsContainer.querySelectorAll('.added-color-item')).map(item => JSON.parse(item.dataset.rgb)) }; } else { return { version: '2.10', type: 'marker' }; } };
    const applySettingsData = (settings) => { if (!settings || settings.type !== 'colors' || !Array.isArray(settings.data)) return; elements.addedColorsContainer.innerHTML = ''; settings.data.forEach(rgb => createAddedColorItem({ rgb }, true)); updatePaletteStatus(); triggerConversion(); };

    const hexToRgb = (hex) => {
        let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) {
            const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            const shorthandResult = shorthandRegex.exec(hex);
            if (shorthandResult) {
                result = [
                    shorthandResult[0],
                    shorthandResult[1] + shorthandResult[1],
                    shorthandResult[2] + shorthandResult[2],
                    shorthandResult[3] + shorthandResult[3]
                ];
            }
        }
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    
    const parseRgbString = (str) => {
        const numbers = str.match(/\d+/g);
        if (numbers && numbers.length === 3) {
            const rgb = numbers.map(numStr => parseInt(numStr, 10));
            if (rgb.every(num => num >= 0 && num <= 255)) {
                return rgb;
            }
        }
        return null;
    };

    const updateColorRecommendations = (recommendations = []) => {
        elements.recommendedColorsContainer.innerHTML = '';
        if (recommendations.length === 0) {
            elements.recommendedColorsContainer.innerHTML = '<div class="placeholder-section">이미지를 업로드하면<br>추천 색상이 표시됩니다.</div>';
            return;
        }
        recommendations.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'recommendation-item';
            const swatch = document.createElement('div');
            swatch.className = 'recommendation-swatch';
            swatch.style.backgroundColor = `rgb(${rec.rgb.join(',')})`;
            const info = document.createElement('div');
            info.className = 'recommendation-info';
            const rgbLabel = document.createElement('span');
            rgbLabel.textContent = `(${rec.rgb.join(',')})`;
            const percentLabel = document.createElement('span');
            percentLabel.textContent = `(${(rec.count / rec.totalPixels * 100).toFixed(1)}%)`;
            info.appendChild(rgbLabel);
            info.appendChild(percentLabel);
            const addBtn = document.createElement('button');
            addBtn.className = 'recommendation-add-btn';
            addBtn.textContent = '+';
            addBtn.title = '이 색상 추가하기';
            addBtn.onclick = () => {
                createAddedColorItem({ rgb: rec.rgb });
                item.remove();
                updatePaletteStatus();
                triggerConversion();
            };
            item.appendChild(swatch);
            item.appendChild(info);
            item.appendChild(addBtn);
            elements.recommendedColorsContainer.appendChild(item);
        });
    };

    const updatePaletteStatus = () => { document.querySelectorAll('.palette-status-icon').forEach(icon => { const targetIds = icon.dataset.target.split(','); let isActive = false; for (const id of targetIds) { const container = document.getElementById(id); if (container && (container.querySelector('.color-button[data-on="true"]') || container.querySelector('.added-color-item[data-on="true"]'))) { isActive = true; break; } } icon.classList.toggle('active', isActive); }); };
    const createColorButton = (colorData, container, startOn = true) => { if (!colorData.rgb) return; const ctn = document.createElement('div'); ctn.className = 'color-container'; const btn = document.createElement('div'); btn.className = 'color-button'; btn.style.backgroundColor = `rgb(${colorData.rgb.join(',')})`; btn.dataset.rgb = JSON.stringify(colorData.rgb); btn.dataset.on = startOn.toString(); if (!startOn) { btn.classList.add('off'); } btn.title = colorData.name || `rgb(${colorData.rgb.join(',')})`; btn.addEventListener('click', () => { btn.classList.toggle('off'); btn.dataset.on = btn.dataset.on === 'true' ? 'false' : 'true'; triggerConversion(); updatePaletteStatus(); }); ctn.appendChild(btn); if (colorData.name) { const lbl = document.createElement('div'); lbl.className = 'color-name'; lbl.textContent = colorData.name; ctn.appendChild(lbl); } container.appendChild(ctn); };
    
    // [수정] createAddedColorItem 함수는 colorData.name을 우선적으로 사용하도록 이미 잘 되어있음.
    const createAddedColorItem = (colorData, startOn = true) => {
        if (isColorAlreadyAdded(colorData.rgb)) return false;
        const item = document.createElement('div');
        item.className = 'added-color-item';
        item.dataset.rgb = JSON.stringify(colorData.rgb);
        item.dataset.on = startOn.toString();
        if (!startOn) item.classList.add('off');
        const swatch = document.createElement('div');
        swatch.className = 'added-color-swatch';
        swatch.style.backgroundColor = `rgb(${colorData.rgb.join(',')})`;
        swatch.addEventListener('click', () => {
            item.classList.toggle('off');
            item.dataset.on = item.dataset.on === 'true' ? 'false' : 'true';
            triggerConversion();
            updatePaletteStatus();
        });
        const info = document.createElement('div');
        info.className = 'added-color-info';
        // 이 로직이 핵심: colorData.name이 있으면 그것을, 없으면 (R,G,B) 문자열을 사용
        info.textContent = colorData.name || `(${colorData.rgb.join(',')})`;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-color-btn';
        deleteBtn.textContent = '−';
        deleteBtn.title = '이 색상 삭제';
        deleteBtn.onclick = () => {
            item.remove();
            updatePaletteStatus();
            triggerConversion();
        };
        item.appendChild(swatch);
        item.appendChild(info);
        item.appendChild(deleteBtn);
        elements.addedColorsContainer.appendChild(item);
        return true;
    };
    const createMasterToggleButton = (targetId, container) => { const btn = document.createElement('button'); btn.className = 'toggle-all toggle-all-palette'; btn.dataset.target = targetId; btn.title = '전체 선택/해제'; btn.textContent = 'A'; container.prepend(btn); };

    const applyConversion = (imageDataToProcess, activePalette, options) => {
        if (!imageDataToProcess) return;
        state.isConverting = true;
        showLoading(true);
        state.processId++;
        conversionWorker.postMessage({ imageData: imageDataToProcess, palette: activePalette, options: options, processId: state.processId }, [imageDataToProcess.data.buffer]);
    };
    
    conversionWorker.onmessage = (e) => {
        const { status, imageData, recommendations, processId, message } = e.data;
        if (processId !== state.processId) return;
        if (status === 'success') {
            state.finalDownloadableData = imageData;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageData.width; tempCanvas.height = imageData.height;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
            const displayWidth = (state.appMode === 'image' && state.originalImageObject) ? state.originalImageObject.width : imageData.width;
            const displayHeight = (state.appMode === 'image' && state.originalImageObject) ? state.originalImageObject.height : imageData.height;
            elements.convertedCanvas.width = displayWidth; elements.convertedCanvas.height = displayHeight;
            cCtx.imageSmoothingEnabled = false;
            cCtx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
            elements.downloadBtn.disabled = false;
            updateTransform();
            if (recommendations) {
                updateColorRecommendations(recommendations);
            }
        } else {
            console.error("워커 오류:", message); alert("이미지 변환 중 오류가 발생했습니다.");
        }
        state.isConverting = false; showLoading(false);
    };

    conversionWorker.onerror = (e) => { console.error('워커에서 에러 발생:', e); showLoading(false); state.isConverting = false; alert('변환 엔진(워커)을 시작하는 데 실패했습니다. 페이지를 새로고침 해주세요.'); };
    
    const getActivePaletteAndOptions = () => {
        let paletteSelectors = [];
        if (state.currentMode === 'geopixels') {
            paletteSelectors.push(
                '#geopixels-controls #geoPixelColors .color-button[data-on="true"]',
                '#user-palette-section .added-color-item[data-on="true"]'
            );
            if (state.useWplaceInGeoMode) {
                paletteSelectors.push('#geopixels-controls #wplace-palette-in-geo .color-button[data-on="true"]');
            }
        } else {
            paletteSelectors.push('#wplace-controls .color-button[data-on="true"]');
        }
        
        const palette = Array.from(document.querySelectorAll(paletteSelectors.join(',')))
                             .map(b => JSON.parse(b.dataset.rgb));
        
        const options = {
            saturation: parseInt(elements.saturationSlider.value),
            brightness: parseInt(elements.brightnessSlider.value),
            contrast: parseInt(elements.contrastSlider.value),
            dithering: parseFloat(elements.ditheringSlider.value),
            algorithm: elements.ditheringAlgorithmSelect.value,
            highQualityMode: elements.highQualityMode.checked,
            currentMode: state.currentMode
        };

        return { palette, options };
    };
    
    const processImage = () => {
        if (!state.originalImageObject) return;
        let newWidth, newHeight;
        if (state.scaleMode === 'ratio') { const scaleFactor = parseFloat(elements.scaleSlider.value) / CONFIG.SCALE_FACTOR; newWidth = Math.max(1, Math.round(state.originalImageObject.width / scaleFactor)); newHeight = Math.max(1, Math.round(state.originalImageObject.height / scaleFactor)); } else { newWidth = Math.max(1, parseInt(elements.scaleWidth.value, 10) || state.originalImageObject.width); newHeight = Math.max(1, parseInt(elements.scaleHeight.value, 10) || state.originalImageObject.height); }
        elements.convertedDimensions.textContent = `${newWidth} x ${newHeight} px`;
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = newWidth; tempCanvas.height = newHeight;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.imageSmoothingEnabled = !state.edgeCleanup; tempCtx.drawImage(state.originalImageObject, 0, 0, newWidth, newHeight);
        const imageDataForWorker = tempCtx.getImageData(0, 0, newWidth, newHeight);
        
        const { palette, options } = getActivePaletteAndOptions();
        applyConversion(imageDataForWorker, palette, options);
    };

    const processText = () => {
        const { content, fontFamily, fontSize, isBold, isItalic, letterSpacing, padding, textColor, bgColor, strokeColor, strokeWidth } = state.textState;
        if (!content) { elements.convertedCanvasContainer.classList.remove('has-image'); return; }
        const tempCtx = document.createElement('canvas').getContext('2d');
        let fontStyle = ''; if (isItalic) fontStyle += 'italic '; if (isBold) fontStyle += 'bold '; tempCtx.font = `${fontStyle} ${fontSize * 2}px "${fontFamily}"`; tempCtx.letterSpacing = `${letterSpacing}px`;
        const lines = content.split('\n'); let maxWidth = 0; let totalHeight = 0;
        const lineMetrics = lines.map(line => { const metrics = tempCtx.measureText(line || ' '); maxWidth = Math.max(maxWidth, metrics.width); totalHeight += (metrics.actualBoundingBoxAscent || fontSize * 2) + (metrics.actualBoundingBoxDescent || 0); return metrics; });
        const canvasWidth = Math.ceil(maxWidth + padding * 2); const canvasHeight = Math.ceil(totalHeight + padding * 2); elements.convertedDimensions.textContent = `${canvasWidth} x ${canvasHeight} px`;
        const textCanvas = document.createElement('canvas'); textCanvas.width = canvasWidth; textCanvas.height = canvasHeight; const ctx = textCanvas.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = `rgb(${bgColor})`; ctx.fillRect(0, 0, canvasWidth, canvasHeight); ctx.font = tempCtx.font; ctx.letterSpacing = tempCtx.letterSpacing; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        let currentY = padding; lines.forEach((line, index) => { if (strokeWidth > 0) { ctx.strokeStyle = `rgb(${strokeColor})`; ctx.lineWidth = strokeWidth; ctx.strokeText(line, padding, currentY); } ctx.fillStyle = `rgb(${textColor})`; ctx.fillText(line, padding, currentY); currentY += (lineMetrics[index].actualBoundingBoxAscent || fontSize * 2) + (lineMetrics[index].actualBoundingBoxDescent || 0); });
        const textImageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        
        const { palette, options } = getActivePaletteAndOptions();
        options.dithering = 0; options.algorithm = 'none';

        elements.convertedCanvasContainer.classList.add('has-image');
        applyConversion(textImageData, palette, options);
    };

    const triggerConversion = () => { clearTimeout(state.timeoutId); state.timeoutId = setTimeout(() => { if (state.appMode === 'image') { if (state.originalImageObject) processImage(); } else { processText(); } }, CONFIG.DEBOUNCE_DELAY); };
    const handleFile = async (file) => { if (!file || !file.type.startsWith('image/')) return; elements.metadataInfoDisplay.classList.remove('visible'); updateColorRecommendations([]); try { const settings = await PNGMetadata.extract(file); if (settings) { if (settings.type === 'colors') { if (confirm("이미지에서 '추가한 색상' 목록을 발견했습니다. 현재 목록을 덮어쓰고 불러오시겠습니까?")) { applySettingsData(settings); } } else if (settings.type === 'marker') { elements.metadataInfoDisplay.textContent = "해당 이미지는 NoaDot을 통해 변환된 기록이 있습니다."; elements.metadataInfoDisplay.classList.add('visible'); } } } catch (error) { console.error("메타데이터 읽기 오류:", error); } state.originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name; const img = new Image(); img.onload = () => { state.originalImageObject = img; state.aspectRatio = img.height / img.width; elements.scaleWidth.value = img.width; elements.scaleHeight.value = img.height; elements.pixelScaleSlider.max = img.width > 1 ? img.width - 1 : 1; elements.pixelScaleSlider.value = 0; elements.scaleControlsFieldset.disabled = false; elements.appContainer.classList.add('image-loaded'); elements.originalDimensions.textContent = `${img.width} x ${img.height} px`; elements.convertedCanvasContainer.classList.add('has-image'); state.panX = 0; state.panY = 0; updateZoom(100); triggerConversion(); }; img.src = URL.createObjectURL(file); };
    const resetAll = () => { state.originalImageObject = null; state.originalImageData = null; state.textState.content = ''; elements.editorTextarea.value = ''; elements.appContainer.classList.remove('image-loaded'); elements.convertedCanvasContainer.classList.remove('has-image'); cCtx.clearRect(0,0, elements.convertedCanvas.width, elements.convertedCanvas.height); updateColorRecommendations([]); document.querySelectorAll('.reset-btn').forEach(btn => btn.click()); elements.scaleControlsFieldset.disabled = true; elements.scaleWidth.value = ''; elements.scaleHeight.value = ''; elements.metadataInfoDisplay.classList.remove('visible'); };
    
    const setAppMode = (mode) => {
        if (state.appMode === mode) return;
        if (state.appMode === 'image' && state.originalImageObject && mode === 'text') { if (!confirm("모드를 전환하시면 업로드한 이미지 내용은 초기화됩니다. 계속하시겠습니까?")) { elements.imageModeBtn.checked = true; return; } } else if (state.appMode === 'text' && state.textState.content && mode === 'image') { if (!confirm("모드를 전환하시면 작성하신 텍스트 내용은 초기화됩니다. 계속하시겠습니까?")) { elements.textModeBtn.checked = true; return; } }
        resetAll();
        state.appMode = mode;
        elements.appContainer.classList.toggle('text-mode', mode === 'text');
        elements.imageControls.style.display = mode === 'image' ? 'grid' : 'none';
        elements.textControls.style.display = mode === 'text' ? 'block' : 'none';
        
        const isImageMode = mode === 'image';
        elements.ditheringAlgorithmGroup.style.display = isImageMode ? 'flex' : 'none';
        elements.ditheringStrengthGroup.style.display = isImageMode ? 'flex' : 'none';

        const placeholderText = elements.placeholderUi.querySelector('p');
        if (isImageMode) {
            placeholderText.textContent = "창 클릭 혹은 이미지를 화면으로 드래그";
            elements.convertedDimensionsLabel.textContent = '변환 크기: ';
        } else {
            placeholderText.textContent = "왼쪽에서 텍스트를 입력하면 여기에 미리보기가 표시됩니다.";
            elements.convertedDimensionsLabel.textContent = '생성 크기: ';
            triggerConversion();
        }
    };

    const setPaletteMode = (mode) => { state.currentMode = mode; if (mode === 'geopixels') { elements.geopixelsControls.style.display = 'block'; elements.wplaceControls.style.display = 'none'; elements.userPaletteSection.style.display = 'block'; } else { elements.geopixelsControls.style.display = 'none'; elements.wplaceControls.style.display = 'block'; elements.userPaletteSection.style.display = 'none'; document.querySelectorAll('#wplaceFreeColors .color-button.off').forEach(btn => btn.click()); document.querySelectorAll('#wplacePaidColors .color-button[data-on="true"]').forEach(btn => btn.click()); } updatePaletteStatus(); updateColorRecommendations([]); triggerConversion(); };
    const isColorAlreadyAdded = (rgbArray) => { const rgbStr = JSON.stringify(rgbArray); const existingItems = elements.addedColorsContainer.querySelectorAll('.added-color-item'); for (const item of existingItems) { if (item.dataset.rgb === rgbStr) return true; } return false; };
    const resetAddedColors = () => { if (!elements.addedColorsContainer.querySelector('.added-color-item')) { alert('초기화할 색상이 없습니다.'); return; } if (confirm('정말로 추가한 모든 색상을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) { elements.addedColorsContainer.innerHTML = ''; updatePaletteStatus(); triggerConversion(); } };
    const handleFontUpload = (file) => { if (!file) return; showLoading(true); const reader = new FileReader(); reader.onload = async (e) => { const fontName = file.name.split('.').slice(0, -1).join('.'); try { const fontFace = new FontFace(fontName, e.target.result); await fontFace.load(); document.fonts.add(fontFace); const option = new Option(fontName, fontName); elements.fontSelect.add(option); option.selected = true; state.textState.fontFamily = fontName; triggerConversion(); } catch (err) { console.error("Font loading failed:", err); alert("지원하지 않거나 손상된 폰트 파일입니다."); } finally { showLoading(false); } }; reader.onerror = () => { alert("폰트 파일을 읽는 데 실패했습니다."); showLoading(false); }; reader.readAsArrayBuffer(file); };
    const populateColorSelects = () => { const selects = [elements.textColorSelect, elements.bgColorSelect, elements.strokeColorSelect]; selects.forEach(select => select.innerHTML = ''); const palettes = []; if (state.currentMode === 'geopixels') { palettes.push({ groupName: 'GeoPixels', data: geopixelsColors }); } else { palettes.push({ groupName: 'Wplace 무료', data: wplaceFreeColors }); palettes.push({ groupName: 'Wplace 유료', data: wplacePaidColors }); } selects.forEach(select => { palettes.forEach(palette => { const optgroup = document.createElement('optgroup'); optgroup.label = palette.groupName; palette.data.forEach(color => { if (!color.rgb) return; const option = document.createElement('option'); option.value = color.rgb.join(','); option.textContent = color.name || `rgb(${color.rgb.join(',')})`; option.style.backgroundColor = `rgb(${color.rgb.join(',')})`; option.style.color = getTextColorForBg(color.rgb); optgroup.appendChild(option); }); select.appendChild(optgroup); }); }); elements.textColorSelect.value = state.textState.textColor; elements.bgColorSelect.value = state.textState.bgColor; elements.strokeColorSelect.value = state.textState.strokeColor; };
    const updateScaleUIVisibility = () => { const isRatio = state.scaleMode === 'ratio'; elements.ratioScaleControls.classList.toggle('hidden', !isRatio); elements.pixelScaleControls.classList.toggle('hidden', isRatio); };
    const switchToPixelMode = () => { if (!state.originalImageObject) return; const scaleFactor = parseFloat(elements.scaleSlider.value) / CONFIG.SCALE_FACTOR; const newWidth = Math.max(1, Math.round(state.originalImageObject.width / scaleFactor)); elements.scaleWidth.value = newWidth; elements.scaleHeight.value = Math.round(newWidth * state.aspectRatio); elements.pixelScaleSlider.value = state.originalImageObject.width - newWidth; };
    const switchToRatioMode = () => { if (!state.originalImageObject) return; const currentWidth = parseInt(elements.scaleWidth.value, 10); const ratio = state.originalImageObject.width / currentWidth; const newSliderValue = Math.round(ratio * CONFIG.SCALE_FACTOR); const clampedValue = Math.max(parseInt(elements.scaleSlider.min, 10), Math.min(parseInt(elements.scaleSlider.max, 10), newSliderValue)); elements.scaleSlider.value = clampedValue; elements.scaleValue.textContent = (clampedValue / CONFIG.SCALE_FACTOR).toFixed(2); };
    const setupEventListeners = () => {
        elements.imageModeBtn.addEventListener('change', () => setAppMode('image'));
        elements.textModeBtn.addEventListener('change', () => setAppMode('text'));
        elements.geopixelsModeBtn.addEventListener('change', () => { setPaletteMode('geopixels'); populateColorSelects(); });
        elements.wplaceModeBtn.addEventListener('change', () => { setPaletteMode('wplace'); populateColorSelects(); });
        elements.useWplaceInGeoMode.addEventListener('change', (e) => { state.useWplaceInGeoMode = e.target.checked; elements.wplacePaletteInGeo.style.display = e.target.checked ? 'block' : 'none'; updatePaletteStatus(); triggerConversion(); });
        elements.highQualityMode.addEventListener('change', (e) => { state.highQualityMode = e.target.checked; triggerConversion(); });
        elements.edgeCleanup.addEventListener('change', (e) => { state.edgeCleanup = e.target.checked; triggerConversion(); });
        elements.ditheringAlgorithmSelect.addEventListener('change', () => { elements.ditheringSlider.disabled = elements.ditheringAlgorithmSelect.value === 'none'; triggerConversion(); });
        const cont = elements.convertedCanvasContainer; cont.addEventListener('wheel', e => { e.preventDefault(); const step = 25; if (e.deltaY < 0) { updateZoom(state.currentZoom + step); } else { updateZoom(state.currentZoom - step); } }); cont.addEventListener('mousedown', e => { if ((state.appMode === 'image' && !state.originalImageObject) || (state.appMode === 'text' && !state.textState.content)) return; state.isDragging = true; state.startDragX = e.pageX; state.startDragY = e.pageY; state.startPanX = state.panX; state.startPanY = state.panY; }); cont.addEventListener('mouseleave', () => { state.isDragging = false; }); cont.addEventListener('mouseup', () => { state.isDragging = false; }); cont.addEventListener('mousemove', e => { if (!state.isDragging) return; e.preventDefault(); const dx = e.pageX - state.startDragX; const dy = e.pageY - state.startDragY; state.panX = state.startPanX + dx; state.panY = state.startPanY + dy; updateTransform(); });
        elements.centerBtn.addEventListener('click', () => { state.panX = 0; state.panY = 0; updateZoom(100); });
        cont.addEventListener('click', () => { if (state.appMode === 'image' && !state.originalImageObject) elements.imageUpload.click(); });
        cont.addEventListener('dragover', e => { e.preventDefault(); if (state.appMode === 'image') cont.classList.add('drag-over'); });
        cont.addEventListener('dragleave', () => { cont.classList.remove('drag-over'); });
        cont.addEventListener('drop', e => { e.preventDefault(); cont.classList.remove('drag-over'); if (state.appMode === 'image' && e.dataTransfer.files.length > 0) { handleFile(e.dataTransfer.files[0]); } });
        elements.imageUpload.addEventListener('change', e => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });
        ['saturation', 'brightness', 'contrast', 'dithering'].forEach(t => { const s = elements[`${t}Slider`], v = elements[`${t}Value`]; if(s && v) { s.addEventListener('input', () => { v.textContent = s.value; triggerConversion(); }); } });
        document.querySelectorAll('.reset-btn').forEach(btn => { const targetId = btn.dataset.target; if (elements[targetId]) { btn.addEventListener('click', () => { const slider = elements[targetId]; const valueDisplay = elements[`${targetId.replace('Slider', '')}Value`]; const defaultValue = CONFIG.DEFAULTS[targetId]; slider.value = defaultValue; if (valueDisplay) valueDisplay.textContent = defaultValue; triggerConversion(); }); } });
        elements.scaleModeSelect.addEventListener('change', e => { const newMode = e.target.value; if (newMode === state.scaleMode) return; if (state.originalImageObject) { if (newMode === 'pixel') switchToPixelMode(); else switchToRatioMode(); } state.scaleMode = newMode; updateScaleUIVisibility(); triggerConversion(); });
        elements.scaleSlider.addEventListener('input', () => { elements.scaleValue.textContent = (elements.scaleSlider.value / CONFIG.SCALE_FACTOR).toFixed(2); triggerConversion(); });
        let isUpdatingScale = false; const updatePixelInputs = (source) => { if (isUpdatingScale || !state.originalImageObject) return; isUpdatingScale = true; let width, height; if (source === 'width') { width = parseInt(elements.scaleWidth.value, 10) || 0; if (width > state.originalImageObject.width) width = state.originalImageObject.width; width = Math.max(1, width); height = Math.round(width * state.aspectRatio); elements.scaleWidth.value = width; elements.scaleHeight.value = height; } else if (source === 'height') { height = parseInt(elements.scaleHeight.value, 10) || 0; if (height > state.originalImageObject.height) height = state.originalImageObject.height; height = Math.max(1, height); width = Math.round(height / state.aspectRatio); elements.scaleWidth.value = width; elements.scaleHeight.value = height; } else { const sliderValue = parseInt(elements.pixelScaleSlider.value, 10); width = state.originalImageObject.width - sliderValue; width = Math.max(1, width); height = Math.round(width * state.aspectRatio); elements.scaleWidth.value = width; elements.scaleHeight.value = height; } elements.pixelScaleSlider.value = state.originalImageObject.width - width; triggerConversion(); isUpdatingScale = false; };
        elements.scaleWidth.addEventListener('input', () => updatePixelInputs('width'));
        elements.scaleHeight.addEventListener('input', () => updatePixelInputs('height'));
        elements.pixelScaleSlider.addEventListener('input', () => updatePixelInputs('slider'));
        document.querySelectorAll('.scale-mod-btn').forEach(btn => { btn.addEventListener('click', () => { if (!state.originalImageObject) return; const targetInput = elements[btn.dataset.target]; const amount = parseInt(btn.dataset.amount, 10); const oldValue = parseInt(targetInput.value, 10); targetInput.value = Math.max(1, oldValue + amount); targetInput.dispatchEvent(new Event('input', { bubbles: true })); }); });
        elements.editorTextarea.addEventListener('input', e => { state.textState.content = e.target.value; triggerConversion(); });
        elements.fontSelect.addEventListener('change', e => { state.textState.fontFamily = e.target.value; triggerConversion(); });
        elements.fontSizeSlider.addEventListener('input', e => { state.textState.fontSize = parseInt(e.target.value, 10); elements.fontSizeValue.textContent = e.target.value; triggerConversion(); });
        elements.letterSpacingSlider.addEventListener('input', e => { state.textState.letterSpacing = parseInt(e.target.value, 10); elements.letterSpacingValue.textContent = e.target.value; triggerConversion(); });
        elements.paddingSlider.addEventListener('input', e => { state.textState.padding = parseInt(e.target.value, 10); elements.paddingValue.textContent = e.target.value; triggerConversion(); });
        elements.textColorSelect.addEventListener('change', e => { state.textState.textColor = e.target.value; triggerConversion(); });
        elements.bgColorSelect.addEventListener('change', e => { state.textState.bgColor = e.target.value; triggerConversion(); });
        elements.strokeColorSelect.addEventListener('change', e => { state.textState.strokeColor = e.target.value; triggerConversion(); });
        elements.strokeWidthSlider.addEventListener('input', e => { state.textState.strokeWidth = parseInt(e.target.value, 10); elements.strokeWidthValue.textContent = e.target.value; triggerConversion(); });
        document.querySelectorAll('.style-btn').forEach(btn => btn.addEventListener('click', e => { const style = e.currentTarget.dataset.style; state.textState[`is${style.charAt(0).toUpperCase() + style.slice(1)}`] = !state.textState[`is${style.charAt(0).toUpperCase() + style.slice(1)}`]; e.currentTarget.classList.toggle('active'); triggerConversion(); }));
        elements.uploadFontBtn.addEventListener('click', () => elements.fontUpload.click());
        elements.fontUpload.addEventListener('change', (e) => { if(e.target.files.length > 0) handleFontUpload(e.target.files[0]) });

        // [수정] 색상 추가 로직 및 이벤트 핸들러 전체
        const clearAndResetInputFields = () => {
            elements.addHex.value = '';
            elements.addR.value = '';
            elements.addG.value = '';
            elements.addB.value = '';
            elements.hexInputFeedback.textContent = '\u00A0';
            elements.rgbInputFeedback.textContent = '\u00A0';
        };

        const tryAddColor = (rgb, name = null) => {
            if (!rgb) return;
            // createAddedColorItem은 성공 시 true, 중복 시 false 반환
            if (createAddedColorItem({ rgb, name })) {
                updatePaletteStatus();
                triggerConversion();
                clearAndResetInputFields();
            } else {
                alert("이미 추가된 색상입니다.");
            }
        };

        elements.addColorBtn.addEventListener('click', () => {
            const hexValue = elements.addHex.value.trim();
            const rVal = elements.addR.value.trim(), gVal = elements.addG.value.trim(), bVal = elements.addB.value.trim();
            
            if (hexValue) {
                const rgbFromHex = hexToRgb(hexValue);
                if (rgbFromHex) {
                    tryAddColor([rgbFromHex.r, rgbFromHex.g, rgbFromHex.b], hexValue.toUpperCase());
                } else {
                    elements.hexInputFeedback.textContent = '유효하지 않은 HEX 코드입니다.';
                }
            } else if (rVal || gVal || bVal) {
                const r = parseInt(rVal), g = parseInt(gVal), b = parseInt(bVal);
                if ([r,g,b].every(v => !isNaN(v) && v >= 0 && v <= 255)) {
                    tryAddColor([r, g, b]); // 이름은 null로 전달됨
                } else {
                    elements.rgbInputFeedback.textContent = 'RGB 값은 0-255 사이의 숫자여야 합니다.';
                }
            } else {
                alert('추가할 색상 값을 입력해주세요.');
            }
        });

        const handlePaste = (e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text').trim();
            const rgbFromHex = hexToRgb(pastedText);
            const rgbFromString = parseRgbString(pastedText);

            if (rgbFromHex) {
                tryAddColor([rgbFromHex.r, rgbFromHex.g, rgbFromHex.b], pastedText.toUpperCase());
            } else if (rgbFromString) {
                tryAddColor(rgbFromString);
            } else {
                alert('붙여넣은 텍스트에서 유효한 색상 코드(HEX 또는 RGB)를 찾을 수 없습니다.');
            }
        };

        [elements.addHex, elements.addR, elements.addG, elements.addB].forEach(input => {
            input.addEventListener('paste', handlePaste);
            input.addEventListener('input', () => {
                elements.hexInputFeedback.textContent = '\u00A0';
                elements.rgbInputFeedback.textContent = '\u00A0';
            });
        });
        
        elements.addHex.addEventListener('input', () => {
            if(parseRgbString(elements.addHex.value)) {
                elements.hexInputFeedback.textContent = 'RGB 값은 아래 입력란을 사용해주세요.';
            }
        });

        [elements.addR, elements.addG, elements.addB].forEach(input => {
            input.addEventListener('input', () => {
                if(hexToRgb(input.value)) {
                    elements.rgbInputFeedback.textContent = 'HEX 코드는 위 입력란을 사용해주세요.';
                }
            });
        });
        
        elements.resetAddedColorsBtn.addEventListener('click', resetAddedColors);

        elements.exportPaletteBtn.addEventListener('click', () => {
            const colors = Array.from(elements.addedColorsContainer.querySelectorAll('.added-color-item')).map(item => JSON.parse(item.dataset.rgb));
            if (colors.length === 0) { alert('내보낼 색상이 없습니다.'); return; }
            const jsonString = JSON.stringify(colors, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'noadot_palette.json';
            link.click();
            URL.revokeObjectURL(url);
        });

        elements.importPaletteBtn.addEventListener('click', () => {
            elements.paletteUpload.click();
        });

        elements.paletteUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const colors = JSON.parse(event.target.result);
                    if (!Array.isArray(colors)) throw new Error('파일 형식이 올바르지 않습니다.');
                    if (confirm("'추가한 색상' 목록에 불러온 팔레트를 추가하시겠습니까? (기존 목록은 유지됩니다)")) {
                        let addedCount = 0;
                        colors.forEach(rgb => {
                            if (Array.isArray(rgb) && rgb.length === 3 && rgb.every(c => typeof c === 'number' && c >= 0 && c <= 255)) {
                                if (!isColorAlreadyAdded(rgb)) {
                                    createAddedColorItem({ rgb }); // 파일에서 불러온 것은 이름이 없으므로 RGB로 표시
                                    addedCount++;
                                }
                            }
                        });
                        if (addedCount > 0) {
                            updatePaletteStatus();
                            triggerConversion();
                            alert(`${addedCount}개의 새로운 색상을 불러왔습니다.`);
                        } else {
                            alert("새롭게 추가된 색상이 없습니다. (중복 또는 유효하지 않은 색상 제외)");
                        }
                    }
                } catch (err) {
                    alert('유효하지 않은 팔레트 파일입니다. JSON 형식을 확인해주세요.');
                    console.error("팔레트 불러오기 오류:", err);
                } finally {
                    e.target.value = '';
                }
            };
            reader.readAsText(file);
        });

        document.querySelectorAll('.toggle-all').forEach(btn => { btn.addEventListener('click', e => { const targetIds = e.currentTarget.dataset.target.split(','); let allItems = []; targetIds.forEach(id => { const container = document.getElementById(id); if (container) { allItems.push(...container.querySelectorAll('.color-button, .added-color-item')); } }); if (allItems.length === 0) return; const onItemsCount = allItems.filter(b => b.dataset.on === 'true').length; const turnOn = onItemsCount < allItems.length; allItems.forEach(item => { const isOn = item.dataset.on === 'true'; if ((turnOn && !isOn) || (!turnOn && isOn)) { const clickable = item.classList.contains('added-color-item') ? item.querySelector('.added-color-swatch') : item; clickable.click(); } }); }); });
        
        elements.downloadBtn.addEventListener('click', async () => { if (!state.finalDownloadableData) { alert('다운로드할 이미지가 없습니다.'); return; } showLoading(true); try { const tempCanvas = document.createElement('canvas'); tempCanvas.width = state.finalDownloadableData.width; tempCanvas.height = state.finalDownloadableData.height; tempCanvas.getContext('2d').putImageData(state.finalDownloadableData, 0, 0); const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png')); const arrayBuffer = await blob.arrayBuffer(); const settingsData = gatherSettingsData(); const newPngBuffer = PNGMetadata.embed(arrayBuffer, settingsData); const newBlob = new Blob([newPngBuffer], { type: 'image/png' }); const url = URL.createObjectURL(newBlob); const now = new Date(); const ts = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`; const newName = `${state.originalFileName}_NoaDot_${ts}${state.currentMode === 'geopixels' ? '_colors.png' : '_converted.png'}`; const link = document.createElement('a'); link.download = newName; link.href = url; link.click(); URL.revokeObjectURL(url); } catch (error) { console.error("다운로드 중 오류 발생:", error); alert("메타데이터를 포함하여 다운로드하는 중 오류가 발생했습니다."); } finally { showLoading(false); } });
    };
    const initialize = () => {
        elements.ditheringAlgorithmSelect.value = 'atkinson';
        geopixelsColors.forEach(c => createColorButton(c, elements.geoPixelColorsContainer, true)); wplaceFreeColors.forEach(c => createColorButton(c, elements.wplaceFreeColorsContainer, false)); wplacePaidColors.forEach(c => createColorButton(c, elements.wplacePaidColorsContainer, false)); wplaceFreeColors.forEach(c => createColorButton(c, elements.wplaceFreeColorsInGeo, false)); wplacePaidColors.forEach(c => createColorButton(c, elements.wplacePaidColorsInGeo, false)); createMasterToggleButton('geoPixelColors', elements.geoPixelColorsContainer); createMasterToggleButton('wplaceFreeColors', elements.wplaceFreeColorsContainer); createMasterToggleButton('wplacePaidColors', elements.wplacePaidColorsContainer); createMasterToggleButton('wplaceFreeColorsInGeo', elements.wplaceFreeColorsInGeo); createMasterToggleButton('wplacePaidColorsInGeo', elements.wplacePaidColorsInGeo); setupEventListeners(); updateScaleUIVisibility(); setAppMode('image'); setPaletteMode('geopixels'); populateColorSelects();
    };
    
    initialize();
});