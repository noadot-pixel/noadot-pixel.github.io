document.addEventListener('DOMContentLoaded', () => {

    const state = {
        isConverting: false,
        processId: null,
        originalImageData: null, 
        originalImageObject: null, 
        originalFileName: 'image',
        currentZoom: 100,
        isDragging: false,
        panX: 0, panY: 0,
        startPanX: 0, startPanY: 0,
        startDragX: 0, startDragY: 0,
        finalDownloadableData: null,
        colorAnalysis: { counts: new Map(), totalPixels: 0 },
        currentMode: 'geopixels', // ## 핵심 변경 ##: 현재 모드 상태 추가
    };

    const elements = {
        imageUpload: document.getElementById('imageUpload'),
        downloadBtn: document.getElementById('downloadBtn'),
        convertedCanvas: document.getElementById('convertedCanvas'),
        convertedCanvasContainer: document.getElementById('convertedCanvasContainer'),
        centerBtn: document.getElementById('centerBtn'),
        zoomLevelDisplay: document.getElementById('zoomLevelDisplay'),
        saturationSlider: document.getElementById('saturationSlider'), saturationValue: document.getElementById('saturationValue'),
        brightnessSlider: document.getElementById('brightnessSlider'), brightnessValue: document.getElementById('brightnessValue'),
        contrastSlider: document.getElementById('contrastSlider'), contrastValue: document.getElementById('contrastValue'),
        ditheringSlider: document.getElementById('ditheringSlider'), ditheringValue: document.getElementById('ditheringValue'),
        scaleSlider: document.getElementById('scaleSlider'), scaleValue: document.getElementById('scaleValue'),
        recommendedColorsContainer: document.getElementById('recommendedColors'),
        wplaceFreeColorsContainer: document.getElementById('wplaceFreeColors'),
        wplacePaidColorsContainer: document.getElementById('wplacePaidColors'),
        geoPixelColorsContainer: document.getElementById('geoPixelColors'),
        addedColorsContainer: document.getElementById('addedColors'),
        addColorBtn: document.getElementById('addColorBtn'),
        addR: document.getElementById('addR'), addG: document.getElementById('addG'), addB: document.getElementById('addB'),
        exportColorsBtn: document.getElementById('exportColorsBtn'),
        importColorsBtn: document.getElementById('importColorsBtn'),
        colorCodeInput: document.getElementById('colorCodeInput'),
        geopixelsModeBtn: document.getElementById('geopixelsMode'),
        wplaceModeBtn: document.getElementById('wplaceMode'),
        geopixelsControls: document.getElementById('geopixels-controls'),
        wplaceControls: document.getElementById('wplace-controls'),
    };
    const cCtx = elements.convertedCanvas.getContext('2d');

    const hexToRgb = (hex) => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : null; };
    const updateTransform = () => { const scale = state.currentZoom / 100; elements.convertedCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${scale})`; elements.zoomLevelDisplay.textContent = `${state.currentZoom}%`; };
    const updateZoom = (newZoom) => { state.currentZoom = Math.max(25, Math.min(500, newZoom)); updateTransform(); };
    const findClosestColor = (r, g, b, palette) => {
        let minDistance = Infinity; let closestColor = palette[0];
        for (const pColor of palette) { const distance = (r - pColor[0]) ** 2 + (g - pColor[1]) ** 2 + (b - pColor[2]) ** 2; if (distance < minDistance) { minDistance = distance; closestColor = pColor; } if (minDistance === 0) break; }
        return { color: closestColor, distance: minDistance };
    };
    
    // ## 핵심 변경 ##: 추천 로직이 모드를 확인하도록 수정
    const updateColorRecommendations = () => {
        elements.recommendedColorsContainer.innerHTML = '';
        if (state.currentMode !== 'geopixels' || state.colorAnalysis.totalPixels === 0) return;

        const activePalette = Array.from(document.querySelectorAll('#geoPixelColors .color-button[data-on="true"], #addedColors .color-button[data-on="true"]')).map(b => JSON.parse(b.dataset.rgb));
        const allExistingColors = new Set();
        document.querySelectorAll('#geoPixelColors .color-button, #addedColors .color-button').forEach(btn => {
            allExistingColors.add(JSON.parse(btn.dataset.rgb).join(','));
        });
        
        if (activePalette.length === 0) return;
        
        const candidates = [];
        const minCountThreshold = state.colorAnalysis.totalPixels * 0.01;
        for (const [rgbStr, count] of state.colorAnalysis.counts.entries()) {
            if (allExistingColors.has(rgbStr)) continue;
            if (count < minCountThreshold) continue;
            const originalRgb = JSON.parse(`[${rgbStr}]`);
            const { distance } = findClosestColor(originalRgb[0], originalRgb[1], originalRgb[2], activePalette);
            if (distance > 0) {
                const score = distance * count;
                candidates.push({ rgb: originalRgb, score, count });
            }
        }

        candidates.sort((a, b) => b.score - a.score);
        const finalRecommendations = candidates.slice(0, 10);
        finalRecommendations.forEach(rec => {
            const item = document.createElement('div'); item.className = 'recommendation-item';
            const swatch = document.createElement('div'); swatch.className = 'recommendation-swatch'; swatch.style.backgroundColor = `rgb(${rec.rgb.join(',')})`;
            const info = document.createElement('div'); info.className = 'recommendation-info';
            const rgbLabel = document.createElement('span'); rgbLabel.textContent = `(${rec.rgb.join(',')})`;
            const percentLabel = document.createElement('span'); percentLabel.textContent = `(${(rec.count / state.colorAnalysis.totalPixels * 100).toFixed(1)}%)`;
            info.appendChild(rgbLabel); info.appendChild(percentLabel);
            const addBtn = document.createElement('button'); addBtn.className = 'recommendation-add-btn'; addBtn.textContent = '+'; addBtn.title = '이 색상 추가하기';
            addBtn.onclick = () => { createColorButton({ rgb: rec.rgb }, elements.addedColorsContainer); updatePaletteStatus(); triggerConversion(); };
            item.appendChild(swatch); item.appendChild(info); item.appendChild(addBtn);
            elements.recommendedColorsContainer.appendChild(item);
        });
    };
    
    const updatePaletteStatus = () => { document.querySelectorAll('.palette-status-icon').forEach(icon => { const targetIds = icon.dataset.target.split(','); let isActive = false; for (const id of targetIds) { const container = document.getElementById(id); if (container && container.querySelector('.color-button[data-on="true"]')) { isActive = true; break; } } icon.classList.toggle('active', isActive); }); updateColorRecommendations(); };
    const createColorButton = (colorData, container, startOn = true) => { const ctn = document.createElement('div'); ctn.className = 'color-container'; const btn = document.createElement('div'); btn.className = 'color-button'; btn.style.backgroundColor = `rgb(${colorData.rgb.join(',')})`; btn.dataset.rgb = JSON.stringify(colorData.rgb); btn.dataset.on = startOn.toString(); if (!startOn) { btn.classList.add('off'); } btn.title = colorData.name || `rgb(${colorData.rgb.join(',')})`; btn.addEventListener('click', () => { btn.classList.toggle('off'); btn.dataset.on = btn.dataset.on === 'true' ? 'false' : 'true'; triggerConversion(); updatePaletteStatus(); }); ctn.appendChild(btn); if (colorData.name) { const lbl = document.createElement('div'); lbl.className = 'color-name'; lbl.textContent = colorData.name; ctn.appendChild(lbl); } container.appendChild(ctn); };
    const createMasterToggleButton = (targetId, container) => { const btn = document.createElement('button'); btn.className = 'toggle-all toggle-all-palette'; btn.dataset.target = targetId; btn.title = '전체 선택/해제'; btn.textContent = 'A'; container.prepend(btn); };
    const preprocessImageData = (sourceImageData) => { const sat = parseFloat(elements.saturationSlider.value) / 100.0, bri = parseInt(elements.brightnessSlider.value), con = parseFloat(elements.contrastSlider.value); const factor = (259 * (con + 255)) / (255 * (259 - con)); const data = new Uint8ClampedArray(sourceImageData.data); for (let i = 0; i < data.length; i += 4) { let r = data[i], g = data[i + 1], b = data[i + 2]; r += bri; g += bri; b += bri; r = factor * (r - 128) + 128; g = factor * (g - 128) + 128; b = factor * (b - 128) + 128; if (sat !== 1.0) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray); } data[i] = Math.max(0, Math.min(255, r)); data[i + 1] = Math.max(0, Math.min(255, g)); data[i + 2] = Math.max(0, Math.min(255, b)); } return new ImageData(data, sourceImageData.width, sourceImageData.height); };
    const applyConversion = async (imageDataToProcess, activePalette, options) => { if (!imageDataToProcess) return; state.isConverting = true; const preprocessed = preprocessImageData(imageDataToProcess); const { width, height } = preprocessed; let finalPixelData; if (activePalette.length === 0) { const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height; const tempCtx = tempCanvas.getContext('2d'); tempCtx.fillStyle = 'black'; tempCtx.fillRect(0, 0, width, height); finalPixelData = tempCtx.getImageData(0, 0, width, height); } else { const newData = new ImageData(width, height); const ditherData = new Float32Array(preprocessed.data); for (let y = 0; y < height; y++) { if (y % 10 === 0) { await new Promise(r => setTimeout(r, 0)); if (!state.isConverting) return; } for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; const oldA = ditherData[i + 3]; if (oldA === 0) { newData.data[i + 3] = 0; continue; } const [oldR, oldG, oldB] = [ditherData[i], ditherData[i + 1], ditherData[i + 2]]; const { color: newRgb } = findClosestColor(oldR, oldG, oldB, activePalette); newData.data[i] = newRgb[0]; newData.data[i + 1] = newRgb[1]; newData.data[i + 2] = newRgb[2]; newData.data[i + 3] = oldA; const ditherStr = options.dithering / 100.0; if (ditherStr > 0) { const errR = (oldR - newRgb[0]) * ditherStr, errG = (oldG - newRgb[1]) * ditherStr, errB = (oldB - newRgb[2]) * ditherStr; const p1 = i + 4, p2 = i + (width - 1) * 4, p3 = i + width * 4, p4 = i + (width + 1) * 4; if (x < width - 1) { ditherData[p1] += errR * 7 / 16; ditherData[p1 + 1] += errG * 7 / 16; ditherData[p1 + 2] += errB * 7 / 16; } if (y < height - 1) { if (x > 0) { ditherData[p2] += errR * 3 / 16; ditherData[p2 + 1] += errG * 3 / 16; ditherData[p2 + 2] += errB * 3 / 16; } ditherData[p3] += errR * 5 / 16; ditherData[p3 + 1] += errG * 5 / 16; ditherData[p3 + 2] += errB * 5 / 16; if (x < width - 1) { ditherData[p4] += errR * 1 / 16; ditherData[p4 + 1] += errG * 1 / 16; ditherData[p4 + 2] += errB * 1 / 16; } } } } } finalPixelData = newData; } state.finalDownloadableData = finalPixelData; const tempCanvas = document.createElement('canvas'); tempCanvas.width = finalPixelData.width; tempCanvas.height = finalPixelData.height; tempCanvas.getContext('2d').putImageData(finalPixelData, 0, 0); elements.convertedCanvas.width = state.originalImageObject.width; elements.convertedCanvas.height = state.originalImageObject.height; cCtx.imageSmoothingEnabled = false; cCtx.drawImage(tempCanvas, 0, 0, elements.convertedCanvas.width, elements.convertedCanvas.height); state.isConverting = false; elements.downloadBtn.disabled = false; updateTransform(); };
    const analyzeColors = (imageData) => { const counts = new Map(); let totalPixels = 0; for (let i = 0; i < imageData.data.length; i += 4) { if (imageData.data[i + 3] > 128) { const key = `${imageData.data[i]},${imageData.data[i+1]},${imageData.data[i+2]}`; counts.set(key, (counts.get(key) || 0) + 1); totalPixels++; } } state.colorAnalysis = { counts, totalPixels }; updateColorRecommendations(); };
    const processImage = () => { if (!state.originalImageObject) return; const scaleFactor = parseInt(elements.scaleSlider.value, 10); const newWidth = Math.max(1, Math.round(state.originalImageObject.width / scaleFactor)); const newHeight = Math.max(1, Math.round(state.originalImageObject.height / scaleFactor)); const tempCanvas = document.createElement('canvas'); tempCanvas.width = newWidth; tempCanvas.height = newHeight; const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); tempCtx.drawImage(state.originalImageObject, 0, 0, newWidth, newHeight); state.originalImageData = tempCtx.getImageData(0, 0, newWidth, newHeight); analyzeColors(state.originalImageData); const palette = Array.from(document.querySelectorAll('.color-button[data-on="true"]')).map(b => JSON.parse(b.dataset.rgb)); const opts = { dithering: parseFloat(elements.ditheringSlider.value) }; applyConversion(state.originalImageData, palette, opts); };
    const triggerConversion = () => { if (state.isConverting) { state.isConverting = false; } clearTimeout(state.processId); state.processId = setTimeout(processImage, 150); };
    const handleFile = (file) => { if (!file || !file.type.startsWith('image/')) return; state.originalFileName = file.name; const img = new Image(); img.onload = () => { state.originalImageObject = img; elements.convertedCanvasContainer.classList.add('has-image'); state.panX = 0; state.panY = 0; updateZoom(100); triggerConversion(); }; img.src = URL.createObjectURL(file); };
    
    // ## 핵심 변경 ##: 모드 전환 로직
    const setPaletteMode = (mode) => {
        state.currentMode = mode;
        if (mode === 'geopixels') {
            elements.geopixelsControls.style.display = 'block';
            elements.wplaceControls.style.display = 'none';
            // 지오픽셀 팔레트는 켜고, Wplace 팔레트는 끈다
            document.querySelectorAll('#geoPixelColors .color-button.off').forEach(btn => btn.click());
            document.querySelectorAll('#wplaceFreeColors .color-button[data-on="true"], #wplacePaidColors .color-button[data-on="true"]').forEach(btn => btn.click());
        } else { // wplace
            elements.geopixelsControls.style.display = 'none';
            elements.wplaceControls.style.display = 'block';
            // Wplace 팔레트는 켜고, 지오픽셀 및 추가된 색상은 끈다
            document.querySelectorAll('#wplaceFreeColors .color-button.off, #wplacePaidColors .color-button.off').forEach(btn => btn.click());
            document.querySelectorAll('#geoPixelColors .color-button[data-on="true"], #addedColors .color-button[data-on="true"]').forEach(btn => btn.click());
        }
        updatePaletteStatus();
        triggerConversion();
    };

    const setupEventListeners = () => {
        // 모드 전환 이벤트
        elements.geopixelsModeBtn.addEventListener('change', () => setPaletteMode('geopixels'));
        elements.wplaceModeBtn.addEventListener('change', () => setPaletteMode('wplace'));

        const cont = elements.convertedCanvasContainer;
        cont.addEventListener('wheel', e => { e.preventDefault(); const step = 25; if (e.deltaY < 0) { updateZoom(state.currentZoom + step); } else { updateZoom(state.currentZoom - step); } });
        cont.addEventListener('mousedown', e => { if (!state.originalImageObject) return; state.isDragging = true; state.startDragX = e.pageX; state.startDragY = e.pageY; state.startPanX = state.panX; state.startPanY = state.panY; });
        cont.addEventListener('mouseleave', () => { state.isDragging = false; }); cont.addEventListener('mouseup', () => { state.isDragging = false; });
        cont.addEventListener('mousemove', e => { if (!state.isDragging) return; e.preventDefault(); const dx = e.pageX - state.startDragX; const dy = e.pageY - state.startDragY; state.panX = state.startPanX + dx; state.panY = state.startPanY + dy; updateTransform(); });
        elements.centerBtn.addEventListener('click', () => { state.panX = 0; state.panY = 0; updateZoom(100); });
        cont.addEventListener('click', () => { if (!state.originalImageObject) elements.imageUpload.click(); });
        cont.addEventListener('dragover', e => { e.preventDefault(); cont.classList.add('drag-over'); });
        cont.addEventListener('dragleave', () => { cont.classList.remove('drag-over'); });
        cont.addEventListener('drop', e => { e.preventDefault(); cont.classList.remove('drag-over'); if (e.dataTransfer.files.length > 0) { handleFile(e.dataTransfer.files[0]); } });
        elements.imageUpload.addEventListener('change', e => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });
        ['saturation', 'brightness', 'contrast', 'dithering', 'scale'].forEach(t => { const s = elements[`${t}Slider`], v = elements[`${t}Value`]; s.addEventListener('input', () => { v.textContent = s.value; triggerConversion(); }); });
        const handlePaste = (e) => { e.preventDefault(); const pastedText = e.clipboardData.getData('text'); let rgb = []; const numbers = pastedText.match(/\d+/g); if (numbers && numbers.length === 3) { rgb = numbers.map(numStr => parseInt(numStr, 10)); } else { const cleanText = pastedText.replace(/\D/g, ''); if (cleanText.length === 9) { rgb = [ parseInt(cleanText.substring(0, 3), 10), parseInt(cleanText.substring(3, 6), 10), parseInt(cleanText.substring(6, 9), 10) ]; } } if (rgb.length === 3 && rgb.every(num => num >= 0 && num <= 255)) { elements.addR.value = rgb[0]; elements.addG.value = rgb[1]; elements.addB.value = rgb[2]; elements.addColorBtn.click(); } };
        [elements.addR, elements.addG, elements.addB].forEach(input => { input.addEventListener('paste', handlePaste); });
        elements.addColorBtn.addEventListener('click', () => { const r = parseInt(elements.addR.value), g = parseInt(elements.addG.value), b = parseInt(elements.addB.value); if (isNaN(r) || r < 0 || r > 255 || isNaN(g) || g < 0 || g > 255 || isNaN(b) || b < 0 || b > 255) { alert("0~255 사이의 올바른 RGB 값을 입력해주세요."); return; } createColorButton({ rgb: [r, g, b], name: `(${r},${g},${b})` }, elements.addedColorsContainer); updatePaletteStatus(); triggerConversion(); });
        elements.exportColorsBtn.addEventListener('click', () => { const btns = elements.addedColorsContainer.querySelectorAll('.color-button'); if (btns.length === 0) { alert('추출할 색상이 없습니다.'); return; } const colors = Array.from(btns).map(b => JSON.parse(b.dataset.rgb)); const code = btoa(JSON.stringify(colors)); prompt('아래 코드를 복사하여 보관하세요:', code); });
        elements.importColorsBtn.addEventListener('click', () => { const code = elements.colorCodeInput.value.trim(); if (code === '') { alert('적용할 코드를 입력해주세요.'); return; } try { const colors = JSON.parse(atob(code)); if (!Array.isArray(colors)) throw new Error(); colors.forEach(rgb => { if (Array.isArray(rgb) && rgb.length === 3) { createColorButton({ rgb, name: `(${rgb.join(',')})` }, elements.addedColorsContainer); } }); elements.colorCodeInput.value = ''; updatePaletteStatus(); triggerConversion(); } catch (err) { alert('유효하지 않은 코드입니다. 다시 확인해주세요.'); } });
        document.querySelectorAll('.toggle-all').forEach(btn => { btn.addEventListener('click', e => { const targetIds = e.target.dataset.target.split(','); let allButtons = []; targetIds.forEach(id => { const container = document.getElementById(id); if (container) { allButtons.push(...container.querySelectorAll('.color-button')); } }); if (allButtons.length === 0) return; const onButtonsCount = allButtons.filter(b => b.dataset.on === 'true').length; const turnOn = onButtonsCount < allButtons.length; allButtons.forEach(b => { const isOn = b.dataset.on === 'true'; if ((turnOn && !isOn) || (!turnOn && isOn)) { b.click(); } }); setTimeout(updatePaletteStatus, 50); }); });
        elements.downloadBtn.addEventListener('click', () => { if (!state.finalDownloadableData) { alert('다운로드할 이미지가 없습니다.'); return; } const now = new Date(); const ts = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`; const baseName = state.originalFileName.substring(0, state.originalFileName.lastIndexOf('.')) || state.originalFileName; const newName = `${baseName}_NoaDot_${ts}_converted.png`; const link = document.createElement('a'); link.download = newName; const { width, height } = state.finalDownloadableData; const temp = document.createElement('canvas'); temp.width = width; temp.height = height; temp.getContext('2d').putImageData(state.finalDownloadableData, 0, 0); link.href = temp.toDataURL(); link.click(); });
    };

    const initialize = () => {
        geoPixelHexCodes.map(hex => ({ rgb: hexToRgb(hex) })).forEach(c => createColorButton(c, elements.geoPixelColorsContainer, true));
        wplaceFreeColorsData.forEach(c => createColorButton(c, elements.wplaceFreeColorsContainer, true)); // Wplace도 기본적으로 켜두자
        wplacePaidColorsData.forEach(c => createColorButton(c, elements.wplacePaidColorsContainer, true)); // Wplace도 기본적으로 켜두자
        createMasterToggleButton('geoPixelColors', elements.geoPixelColorsContainer);
        createMasterToggleButton('wplaceFreeColors', elements.wplaceFreeColorsContainer);
        createMasterToggleButton('wplacePaidColors', elements.wplacePaidColorsContainer);
        setupEventListeners();
        setPaletteMode('geopixels'); // 초기 모드 설정
    };
    initialize();
});