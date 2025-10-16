const ColorConverter = {
    srgbToLinear(c) {
        return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
    },
    rgbToOklab(rgb) {
        const r = this.srgbToLinear(rgb[0] / 255);
        const g = this.srgbToLinear(rgb[1] / 255);
        const b = this.srgbToLinear(rgb[2] / 255);

        const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

        const l_ = Math.cbrt(l);
        const m_ = Math.cbrt(m);
        const s_ = Math.cbrt(s);

        return [
            0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
        ];
    },
    deltaE2000(lab1, lab2) {
        const L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
        const L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];
        const kL = 1, kC = 1, kH = 1;
        const C1 = Math.sqrt(a1 * a1 + b1 * b1);
        const C2 = Math.sqrt(a2 * a2 + b2 * b2);
        const C_bar = (C1 + C2) / 2;
        const G = 0.5 * (1 - Math.sqrt(Math.pow(C_bar, 7) / (Math.pow(C_bar, 7) + Math.pow(25, 7))));
        const a1_prime = a1 * (1 + G);
        const a2_prime = a2 * (1 + G);
        const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
        const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);
        const h1_prime = (Math.atan2(b1, a1_prime) * 180 / Math.PI + 360) % 360;
        const h2_prime = (Math.atan2(b2, a2_prime) * 180 / Math.PI + 360) % 360;
        const delta_L_prime = L2 - L1;
        const delta_C_prime = C2_prime - C1_prime;
        let delta_h_prime;
        if (C1_prime * C2_prime === 0) {
            delta_h_prime = 0;
        } else if (Math.abs(h2_prime - h1_prime) <= 180) {
            delta_h_prime = h2_prime - h1_prime;
        } else if (h2_prime - h1_prime > 180) {
            delta_h_prime = h2_prime - h1_prime - 360;
        } else {
            delta_h_prime = h2_prime - h1_prime + 360;
        }
        const delta_H_prime = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin((delta_h_prime * Math.PI / 180) / 2);
        const L_bar_prime = (L1 + L2) / 2;
        const C_bar_prime = (C1_prime + C2_prime) / 2;
        let h_bar_prime;
        if (C1_prime * C2_prime === 0) {
            h_bar_prime = h1_prime + h2_prime;
        } else if (Math.abs(h1_prime - h2_prime) <= 180) {
            h_bar_prime = (h1_prime + h2_prime) / 2;
        } else if (h1_prime + h2_prime < 360) {
            h_bar_prime = (h1_prime + h2_prime + 360) / 2;
        } else {
            h_bar_prime = (h1_prime + h2_prime - 360) / 2;
        }
        const T = 1 - 0.17 * Math.cos((h_bar_prime - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * h_bar_prime * Math.PI / 180) +
                  0.32 * Math.cos(3 * h_bar_prime * Math.PI / 180 + 6 * Math.PI / 180) - 0.20 * Math.cos(4 * h_bar_prime * Math.PI / 180 - 63 * Math.PI / 180);
        const S_L = 1 + (0.015 * Math.pow(L_bar_prime - 50, 2)) / Math.sqrt(20 + Math.pow(L_bar_prime - 50, 2));
        const S_C = 1 + 0.045 * C_bar_prime;
        const S_H = 1 + 0.015 * C_bar_prime * T;
        const R_T = -2 * Math.sqrt(Math.pow(C_bar_prime, 7) / (Math.pow(C_bar_prime, 7) + Math.pow(25, 7))) * Math.sin(60 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2)) * Math.PI / 180);
        const L_term = delta_L_prime / (kL * S_L);
        const C_term = delta_C_prime / (kC * S_C);
        const H_term = delta_H_prime / (kH * S_H);
        return Math.sqrt(L_term * L_term + C_term * C_term + H_term * H_term + R_T * (C_term * H_term));
    }
};

document.addEventListener('DOMContentLoaded', () => {

    const CONFIG = {
        DEBOUNCE_DELAY: 150,
        SCALE_FACTOR: 4.0,
        DEFAULTS: { 
            saturationSlider: 100, brightnessSlider: 0, contrastSlider: 0,
            ditheringSlider: 0
        }
    };

    const state = {
        appMode: 'image',
        isConverting: false, processId: null, originalImageData: null, 
        originalImageObject: null, originalFileName: 'image', currentZoom: 100,
        isDragging: false, panX: 0, panY: 0, startPanX: 0, startPanY: 0,
        startDragX: 0, startDragY: 0, finalDownloadableData: null,
        colorAnalysis: { counts: new Map(), totalPixels: 0 },
        currentMode: 'geopixels', useWplaceInGeoMode: false,
        highQualityMode: false,
        scaleMode: 'pixel',
        aspectRatio: 1,
        textState: {
            content: '', fontFamily: 'Malgun Gothic', fontSize: 15,
            isBold: false, isItalic: false, isUnderline: false,
            isStrike: false, isShadow: false, letterSpacing: 0,
            padding: 10, 
            textColor: '0,0,0', bgColor: '255,255,255', strokeColor: '0,0,0', strokeWidth: 0,
        }
    };

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
        ditheringAlgorithmSelect: document.getElementById('ditheringAlgorithmSelect'),
        ditheringSlider: document.getElementById('ditheringSlider'), ditheringValue: document.getElementById('ditheringValue'),
        scaleControlsFieldset: document.getElementById('scaleControlsFieldset'),
        scaleModeSelect: document.getElementById('scaleModeSelect'),
        ratioScaleControls: document.getElementById('ratio-scale-controls'),
        pixelScaleControls: document.getElementById('pixel-scale-controls'),
        scaleSlider: document.getElementById('scaleSlider'),
        scaleValue: document.getElementById('scaleValue'),
        scaleWidth: document.getElementById('scaleWidth'),
        scaleHeight: document.getElementById('scaleHeight'),
        pixelScaleSlider: document.getElementById('pixelScaleSlider'),
        recommendationSection: document.getElementById('recommendation-section'),
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
        uploadFontBtn: document.getElementById('uploadFontBtn'),
        fontUpload: document.getElementById('fontUpload'),
        textColorSelect: document.getElementById('textColorSelect'),
        bgColorSelect: document.getElementById('bgColorSelect'),
        strokeColorSelect: document.getElementById('strokeColorSelect'),
        strokeWidthSlider: document.getElementById('strokeWidthSlider'), strokeWidthValue: document.getElementById('strokeWidthValue'),
    };
    const cCtx = elements.convertedCanvas.getContext('2d');
    
    const showLoading = (visible) => { elements.loadingIndicator.classList.toggle('visible', visible); };
    const hexToRgb = (hex) => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : null; };
    const updateTransform = () => { const scale = state.currentZoom / 100; elements.convertedCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${scale})`; elements.zoomLevelDisplay.textContent = `${state.currentZoom}%`; };
    const updateZoom = (newZoom) => { state.currentZoom = Math.max(25, Math.min(500, newZoom)); updateTransform(); };
    
    const findClosestColor = (r1, g1, b1, palette, paletteOklab) => {
        let minDistance = Number.MAX_SAFE_INTEGER;
        let closestColor = palette[0];
        let closestIndex = 0;

        if (state.highQualityMode && paletteOklab) {
            const targetOklab = ColorConverter.rgbToOklab([r1, g1, b1]);
            for (let i = 0; i < paletteOklab.length; i++) {
                const distance = ColorConverter.deltaE2000(targetOklab, paletteOklab[i]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                }
                if (minDistance === 0) break;
            }
            closestColor = palette[closestIndex];
        } else {
            for (let i = 0; i < palette.length; i++) {
                const pColor = palette[i];
                const [r2, g2, b2] = pColor;
                const rMean = (r1 + r2) / 2;
                const r = r1 - r2;
                const g = g1 - g2;
                const b = b1 - b2;
                const distance = Math.floor(((512 + rMean) * r * r) / 256) + 4 * g * g + Math.floor(((767 - rMean) * b * b) / 256);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                }
                if (minDistance === 0) break;
            }
            closestColor = palette[closestIndex];
        }
        return { color: closestColor, distance: minDistance };
    };
    
    const getTextColorForBg = (rgb) => { const [r, g, b] = rgb; const luminance = (0.299 * r + 0.587 * g + 0.114 * b); return luminance > 128 ? '#000000' : '#FFFFFF'; };
    
    const updateColorRecommendations = () => { elements.recommendedColorsContainer.innerHTML = ''; if (state.currentMode !== 'geopixels' || state.colorAnalysis.totalPixels === 0) return; const activeSelectors = ['#geoPixelColors .color-button[data-on="true"]', '#addedColors .added-color-item[data-on="true"]']; if (state.useWplaceInGeoMode) { activeSelectors.push('#wplace-palette-in-geo .color-button[data-on="true"]'); } const activePalette = Array.from(document.querySelectorAll(activeSelectors.join(','))).map(b => JSON.parse(b.dataset.rgb)); if (activePalette.length === 0) return; const allExistingSelectors = ['#geoPixelColors .color-button', '#addedColors .added-color-item', '#wplace-palette-in-geo .color-button']; const allExistingColors = new Set(); document.querySelectorAll(allExistingSelectors.join(',')).forEach(btn => { allExistingColors.add(JSON.parse(btn.dataset.rgb).join(',')); }); const candidates = []; const minCountThreshold = state.colorAnalysis.totalPixels * 0.01; for (const [rgbStr, count] of state.colorAnalysis.counts.entries()) { if (allExistingColors.has(rgbStr)) continue; if (count < minCountThreshold) continue; const originalRgb = JSON.parse(`[${rgbStr}]`); const { distance } = findClosestColor(originalRgb[0], originalRgb[1], originalRgb[2], activePalette, null); if (distance > 0) { const score = distance * count; candidates.push({ rgb: originalRgb, score, count }); } } candidates.sort((a, b) => b.score - a.score); const finalRecommendations = candidates.slice(0, 10); finalRecommendations.forEach(rec => { const item = document.createElement('div'); item.className = 'recommendation-item'; const swatch = document.createElement('div'); swatch.className = 'recommendation-swatch'; swatch.style.backgroundColor = `rgb(${rec.rgb.join(',')})`; const info = document.createElement('div'); info.className = 'recommendation-info'; const rgbLabel = document.createElement('span'); rgbLabel.textContent = `(${rec.rgb.join(',')})`; const percentLabel = document.createElement('span'); percentLabel.textContent = `(${(rec.count / state.colorAnalysis.totalPixels * 100).toFixed(1)}%)`; info.appendChild(rgbLabel); info.appendChild(percentLabel); const addBtn = document.createElement('button'); addBtn.className = 'recommendation-add-btn'; addBtn.textContent = '+'; addBtn.title = '이 색상 추가하기'; addBtn.onclick = () => { createAddedColorItem({ rgb: rec.rgb }); updatePaletteStatus(); triggerConversion(); }; item.appendChild(swatch); item.appendChild(info); item.appendChild(addBtn); elements.recommendedColorsContainer.appendChild(item); }); };
    
    const updatePaletteStatus = () => { document.querySelectorAll('.palette-status-icon').forEach(icon => { const targetIds = icon.dataset.target.split(','); let isActive = false; for (const id of targetIds) { const container = document.getElementById(id); if (container && (container.querySelector('.color-button[data-on="true"]') || container.querySelector('.added-color-item[data-on="true"]'))) { isActive = true; break; } } icon.classList.toggle('active', isActive); }); updateColorRecommendations(); };
    const createColorButton = (colorData, container, startOn = true) => { const ctn = document.createElement('div'); ctn.className = 'color-container'; const btn = document.createElement('div'); btn.className = 'color-button'; btn.style.backgroundColor = `rgb(${colorData.rgb.join(',')})`; btn.dataset.rgb = JSON.stringify(colorData.rgb); btn.dataset.on = startOn.toString(); if (!startOn) { btn.classList.add('off'); } btn.title = colorData.name || `rgb(${colorData.rgb.join(',')})`; btn.addEventListener('click', () => { btn.classList.toggle('off'); btn.dataset.on = btn.dataset.on === 'true' ? 'false' : 'true'; triggerConversion(); updatePaletteStatus(); }); ctn.appendChild(btn); if (colorData.name) { const lbl = document.createElement('div'); lbl.className = 'color-name'; lbl.textContent = colorData.name; ctn.appendChild(lbl); } container.appendChild(ctn); };
    const createAddedColorItem = (colorData, startOn = true) => { if (isColorAlreadyAdded(colorData.rgb)) return; const item = document.createElement('div'); item.className = 'added-color-item'; item.dataset.rgb = JSON.stringify(colorData.rgb); item.dataset.on = startOn.toString(); if (!startOn) item.classList.add('off'); const swatch = document.createElement('div'); swatch.className = 'added-color-swatch'; swatch.style.backgroundColor = `rgb(${colorData.rgb.join(',')})`; swatch.addEventListener('click', () => { item.classList.toggle('off'); item.dataset.on = item.dataset.on === 'true' ? 'false' : 'true'; triggerConversion(); updatePaletteStatus(); }); const info = document.createElement('div'); info.className = 'added-color-info'; info.textContent = colorData.name || `(${colorData.rgb.join(',')})`; const deleteBtn = document.createElement('button'); deleteBtn.className = 'delete-color-btn'; deleteBtn.textContent = '−'; deleteBtn.title = '이 색상 삭제'; deleteBtn.onclick = () => { item.remove(); updatePaletteStatus(); triggerConversion(); }; item.appendChild(swatch); item.appendChild(info); item.appendChild(deleteBtn); elements.addedColorsContainer.appendChild(item); };
    const createMasterToggleButton = (targetId, container) => { const btn = document.createElement('button'); btn.className = 'toggle-all toggle-all-palette'; btn.dataset.target = targetId; btn.title = '전체 선택/해제'; btn.textContent = 'A'; container.prepend(btn); };
    const preprocessImageData = (sourceImageData) => { const sat = parseFloat(elements.saturationSlider.value) / 100.0, bri = parseInt(elements.brightnessSlider.value), con = parseFloat(elements.contrastSlider.value); const factor = (259 * (con + 255)) / (255 * (259 - con)); const data = new Uint8ClampedArray(sourceImageData.data); for (let i = 0; i < data.length; i += 4) { let r = data[i], g = data[i + 1], b = data[i + 2]; r += bri; g += bri; b += bri; r = factor * (r - 128) + 128; g = factor * (g - 128) + 128; b = factor * (b - 128) + 128; if (sat !== 1.0) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = gray + sat * (r - gray); g = gray + sat * (g - gray); b = gray + sat * (b - gray); } data[i] = Math.max(0, Math.min(255, r)); data[i + 1] = Math.max(0, Math.min(255, g)); data[i + 2] = Math.max(0, Math.min(255, b)); } return new ImageData(data, sourceImageData.width, sourceImageData.height); };
    const applyConversion = async (imageDataToProcess, activePalette, options) => {
        if (!imageDataToProcess) return;
        state.isConverting = true;
        showLoading(true);

        const activePaletteOklab = state.highQualityMode ? activePalette.map(c => ColorConverter.rgbToOklab(c)) : null;

        const preprocessed = preprocessImageData(imageDataToProcess);
        const { width, height } = preprocessed;
        let finalPixelData;

        if (activePalette.length === 0) {
            const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height; const tempCtx = tempCanvas.getContext('2d'); tempCtx.fillStyle = 'black'; tempCtx.fillRect(0, 0, width, height); finalPixelData = tempCtx.getImageData(0, 0, width, height);
        } else {
            const newData = new ImageData(width, height);
            const ditherData = new Float32Array(preprocessed.data);
            const ditherStr = options.dithering / 100.0;
            const algorithm = options.algorithm;

            for (let y = 0; y < height; y++) {
                if (y % 10 === 0) { await new Promise(r => setTimeout(r, 0)); if (!state.isConverting) { showLoading(false); return; } }
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    if (ditherData[i + 3] === 0) { newData.data[i + 3] = 0; continue; }
                    const [oldR, oldG, oldB] = [ditherData[i], ditherData[i + 1], ditherData[i + 2]];
                    
                    const { color: newRgb } = findClosestColor(oldR, oldG, oldB, activePalette, activePaletteOklab);
                    
                    [newData.data[i], newData.data[i+1], newData.data[i+2], newData.data[i+3]] = [...newRgb, ditherData[i+3]];
                    
                    if (ditherStr > 0 && algorithm !== 'none') {
                        const errR = (oldR - newRgb[0]) * ditherStr;
                        const errG = (oldG - newRgb[1]) * ditherStr;
                        const errB = (oldB - newRgb[2]) * ditherStr;
                        switch(algorithm) {
                            case 'floyd': if (x < width - 1) { ditherData[i + 4] += errR * 7/16; ditherData[i + 5] += errG * 7/16; ditherData[i + 6] += errB * 7/16; } if (y < height - 1) { if (x > 0) { ditherData[i + width*4 - 4] += errR * 3/16; ditherData[i + width*4 - 3] += errG * 3/16; ditherData[i + width*4 - 2] += errB * 3/16; } ditherData[i + width*4] += errR * 5/16; ditherData[i + width*4 + 1] += errG * 5/16; ditherData[i + width*4 + 2] += errB * 5/16; if (x < width - 1) { ditherData[i + width*4 + 4] += errR * 1/16; ditherData[i + width*4 + 5] += errG * 1/16; ditherData[i + width*4 + 6] += errB * 1/16; } } break;
                            case 'sierra': if (x < width - 1) { ditherData[i + 4] += errR * 2/4; ditherData[i + 5] += errG * 2/4; ditherData[i + 6] += errB * 2/4; } if (y < height - 1) { if (x > 0) { ditherData[i + width*4 - 4] += errR * 1/4; ditherData[i + width*4 - 3] += errG * 1/4; ditherData[i + width*4 - 2] += errB * 1/4; } ditherData[i + width*4] += errR * 1/4; ditherData[i + width*4 + 1] += errG * 1/4; ditherData[i + width*4 + 2] += errB * 1/4; } break;
                            case 'atkinson': const factor = 1/8; if (x < width - 1) { ditherData[i + 4] += errR * factor; ditherData[i + 5] += errG * factor; ditherData[i + 6] += errB * factor; } if (x < width - 2) { ditherData[i + 8] += errR * factor; ditherData[i + 9] += errG * factor; ditherData[i + 10] += errB * factor; } if (y < height - 1) { if (x > 0) { ditherData[i + width*4 - 4] += errR * factor; ditherData[i + width*4 - 3] += errG * factor; ditherData[i + width*4 - 2] += errB * factor; } ditherData[i + width*4] += errR * factor; ditherData[i + width*4 + 1] += errG * factor; ditherData[i + width*4 + 2] += errB * factor; if (x < width - 1) { ditherData[i + width*4 + 4] += errR * factor; ditherData[i + width*4 + 5] += errG * factor; ditherData[i + width*4 + 6] += errB * factor; } } if (y < height - 2) { ditherData[i + width*8] += errR * factor; ditherData[i + width*8 + 1] += errG * factor; ditherData[i + width*8 + 2] += errB * factor; } break;
                        }
                    }
                }
            }
            finalPixelData = newData;
        }
        
        state.finalDownloadableData = finalPixelData;
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = finalPixelData.width; tempCanvas.height = finalPixelData.height; tempCanvas.getContext('2d').putImageData(finalPixelData, 0, 0);
        const displayWidth = (state.appMode === 'image' && state.originalImageObject) ? state.originalImageObject.width : finalPixelData.width;
        const displayHeight = (state.appMode === 'image' && state.originalImageObject) ? state.originalImageObject.height : finalPixelData.height;
        elements.convertedCanvas.width = displayWidth; elements.convertedCanvas.height = displayHeight; cCtx.imageSmoothingEnabled = false; cCtx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
        state.isConverting = false; elements.downloadBtn.disabled = false; updateTransform(); showLoading(false);
    };

    const analyzeColors = (imageData) => { const counts = new Map(); let totalPixels = 0; for (let i = 0; i < imageData.data.length; i += 4) { if (imageData.data[i + 3] > 128) { const key = `${imageData.data[i]},${imageData.data[i+1]},${imageData.data[i+2]}`; counts.set(key, (counts.get(key) || 0) + 1); totalPixels++; } } state.colorAnalysis = { counts, totalPixels }; updateColorRecommendations(); };
    const processImage = () => {
        if (!state.originalImageObject) return;
        
        let newWidth, newHeight;
        if (state.scaleMode === 'ratio') {
            const scaleFactor = parseFloat(elements.scaleSlider.value) / CONFIG.SCALE_FACTOR;
            newWidth = Math.max(1, Math.round(state.originalImageObject.width / scaleFactor));
            newHeight = Math.max(1, Math.round(state.originalImageObject.height / scaleFactor));
        } else { // pixel mode
            newWidth = Math.max(1, parseInt(elements.scaleWidth.value, 10) || state.originalImageObject.width);
            newHeight = Math.max(1, parseInt(elements.scaleHeight.value, 10) || state.originalImageObject.height);
        }

        elements.convertedDimensions.textContent = `${newWidth} x ${newHeight} px`;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = newWidth; tempCanvas.height = newHeight;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.drawImage(state.originalImageObject, 0, 0, newWidth, newHeight);
        state.originalImageData = tempCtx.getImageData(0, 0, newWidth, newHeight);
        analyzeColors(state.originalImageData);
        let paletteSelectors = [];
        if (state.currentMode === 'geopixels') {
            paletteSelectors.push('#geopixels-controls #geoPixelColors .color-button[data-on="true"]', '#geopixels-controls .added-color-item[data-on="true"]');
            if (state.useWplaceInGeoMode) {
                paletteSelectors.push('#geopixels-controls #wplace-palette-in-geo .color-button[data-on="true"]');
            }
        } else {
            paletteSelectors.push('#wplace-controls .color-button[data-on="true"]');
        }
        const palette = Array.from(document.querySelectorAll(paletteSelectors.join(','))).map(b => JSON.parse(b.dataset.rgb));
        const opts = { dithering: parseFloat(elements.ditheringSlider.value), algorithm: elements.ditheringAlgorithmSelect.value };
        applyConversion(state.originalImageData, palette, opts);
    };
    const processText = () => { const { content, fontFamily, fontSize, isBold, isItalic, letterSpacing, padding, textColor, bgColor, strokeColor, strokeWidth } = state.textState; if (!content) { elements.convertedCanvasContainer.classList.remove('has-image'); return; } const tempCtx = document.createElement('canvas').getContext('2d'); let fontStyle = ''; if (isItalic) fontStyle += 'italic '; if (isBold) fontStyle += 'bold '; tempCtx.font = `${fontStyle} ${fontSize * 2}px "${fontFamily}"`; tempCtx.letterSpacing = `${letterSpacing}px`; const lines = content.split('\n'); let maxWidth = 0; let totalHeight = 0; const lineMetrics = lines.map(line => { const metrics = tempCtx.measureText(line || ' '); maxWidth = Math.max(maxWidth, metrics.width); totalHeight += (metrics.actualBoundingBoxAscent || fontSize * 2) + (metrics.actualBoundingBoxDescent || 0); return metrics; }); const canvasWidth = Math.ceil(maxWidth + padding * 2); const canvasHeight = Math.ceil(totalHeight + padding * 2); elements.convertedDimensions.textContent = `${canvasWidth} x ${canvasHeight} px`; const textCanvas = document.createElement('canvas'); textCanvas.width = canvasWidth; textCanvas.height = canvasHeight; const ctx = textCanvas.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = `rgb(${bgColor})`; ctx.fillRect(0, 0, canvasWidth, canvasHeight); ctx.font = tempCtx.font; ctx.letterSpacing = tempCtx.letterSpacing; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; let currentY = padding; lines.forEach((line, index) => { if (strokeWidth > 0) { ctx.strokeStyle = `rgb(${strokeColor})`; ctx.lineWidth = strokeWidth; ctx.strokeText(line, padding, currentY); } ctx.fillStyle = `rgb(${textColor})`; ctx.fillText(line, padding, currentY); currentY += (lineMetrics[index].actualBoundingBoxAscent || fontSize * 2) + (lineMetrics[index].actualBoundingBoxDescent || 0); }); const textImageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight); state.originalImageData = textImageData; state.originalImageObject = textCanvas; analyzeColors(textImageData); let paletteSelectors = []; if (state.currentMode === 'geopixels') { paletteSelectors.push('#geopixels-controls #geoPixelColors .color-button[data-on="true"]', '#geopixels-controls .added-color-item[data-on="true"]'); if (state.useWplaceInGeoMode) { paletteSelectors.push('#geopixels-controls #wplace-palette-in-geo .color-button[data-on="true"]'); } } else { paletteSelectors.push('#wplace-controls .color-button[data-on="true"]'); } const palette = Array.from(document.querySelectorAll(paletteSelectors.join(','))).map(b => JSON.parse(b.dataset.rgb)); const opts = { dithering: parseFloat(elements.ditheringSlider.value), algorithm: elements.ditheringAlgorithmSelect.value }; elements.convertedCanvasContainer.classList.add('has-image'); applyConversion(state.originalImageData, palette, opts); };

    const triggerConversion = () => { if (state.isConverting) { state.isConverting = false; } clearTimeout(state.processId); state.processId = setTimeout(() => { if (state.appMode === 'image') { if (state.originalImageObject) processImage(); } else { processText(); } }, CONFIG.DEBOUNCE_DELAY); };
    const handleFile = (file) => { if (!file || !file.type.startsWith('image/')) return; state.originalFileName = file.name; const img = new Image(); img.onload = () => { state.originalImageObject = img; state.aspectRatio = img.height / img.width; elements.scaleWidth.value = img.width; elements.scaleHeight.value = img.height; elements.pixelScaleSlider.max = img.width > 1 ? img.width - 1 : 1; elements.pixelScaleSlider.value = 0; elements.scaleControlsFieldset.disabled = false; elements.appContainer.classList.add('image-loaded'); elements.originalDimensions.textContent = `${img.width} x ${img.height} px`; elements.convertedCanvasContainer.classList.add('has-image'); state.panX = 0; state.panY = 0; updateZoom(100); triggerConversion(); }; img.src = URL.createObjectURL(file); };
    
    const resetAll = () => { state.originalImageObject = null; state.originalImageData = null; state.textState.content = ''; elements.editorTextarea.value = ''; elements.appContainer.classList.remove('image-loaded'); elements.convertedCanvasContainer.classList.remove('has-image'); cCtx.clearRect(0,0, elements.convertedCanvas.width, elements.convertedCanvas.height); document.querySelectorAll('.reset-btn').forEach(btn => btn.click()); elements.scaleControlsFieldset.disabled = true; elements.scaleWidth.value = ''; elements.scaleHeight.value = ''; };
    const setAppMode = (mode) => { if (state.appMode === mode) return; if (state.appMode === 'image' && state.originalImageObject && mode === 'text') { if (!confirm("모드를 전환하시면 업로드한 이미지 내용은 초기화됩니다. 계속하시겠습니까?")) { elements.imageModeBtn.checked = true; return; } } else if (state.appMode === 'text' && state.textState.content && mode === 'image') { if (!confirm("모드를 전환하시면 작성하신 텍스트 내용은 초기화됩니다. 계속하시겠습니까?")) { elements.textModeBtn.checked = true; return; } } resetAll(); state.appMode = mode; elements.appContainer.classList.toggle('text-mode', mode === 'text'); elements.imageControls.style.display = mode === 'image' ? 'grid' : 'none'; elements.textControls.style.display = mode === 'text' ? 'block' : 'none'; elements.recommendationSection.style.display = 'block'; const placeholderText = elements.placeholderUi.querySelector('p'); if (mode === 'image') { placeholderText.textContent = "창 클릭 혹은 이미지를 화면으로 드래그"; elements.convertedDimensionsLabel.textContent = '변환 크기: '; } else { placeholderText.textContent = "왼쪽에서 텍스트를 입력하면 여기에 미리보기가 표시됩니다."; elements.convertedDimensionsLabel.textContent = '생성 크기: '; triggerConversion(); } };
    const setPaletteMode = (mode) => { state.currentMode = mode; if (mode === 'geopixels') { elements.geopixelsControls.style.display = 'block'; elements.wplaceControls.style.display = 'none'; } else { elements.geopixelsControls.style.display = 'none'; elements.wplaceControls.style.display = 'block'; document.querySelectorAll('#wplaceFreeColors .color-button.off').forEach(btn => btn.click()); document.querySelectorAll('#wplacePaidColors .color-button[data-on="true"]').forEach(btn => btn.click()); } updatePaletteStatus(); triggerConversion(); };
    const isColorAlreadyAdded = (rgbArray) => { const rgbStr = JSON.stringify(rgbArray); const existingItems = elements.addedColorsContainer.querySelectorAll('.added-color-item'); for (const item of existingItems) { if (item.dataset.rgb === rgbStr) return true; } return false; };

    const resetAddedColors = () => { if (!elements.addedColorsContainer.querySelector('.added-color-item')) { alert('초기화할 색상이 없습니다.'); return; } if (confirm('정말로 추가한 모든 색상을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) { elements.addedColorsContainer.innerHTML = ''; updatePaletteStatus(); triggerConversion(); } };
    const handleFontUpload = (file) => { if (!file) return; showLoading(true); const reader = new FileReader(); reader.onload = async (e) => { const fontName = file.name.split('.').slice(0, -1).join('.'); try { const fontFace = new FontFace(fontName, e.target.result); await fontFace.load(); document.fonts.add(fontFace); const option = new Option(fontName, fontName); elements.fontSelect.add(option); option.selected = true; state.textState.fontFamily = fontName; triggerConversion(); } catch (err) { console.error("Font loading failed:", err); alert("지원하지 않거나 손상된 폰트 파일입니다."); } finally { showLoading(false); } }; reader.onerror = () => { alert("폰트 파일을 읽는 데 실패했습니다."); showLoading(false); }; reader.readAsArrayBuffer(file); };
    
    const populateColorSelects = () => { const selects = [elements.textColorSelect, elements.bgColorSelect, elements.strokeColorSelect]; selects.forEach(select => select.innerHTML = ''); const palettes = []; if (state.currentMode === 'geopixels') { palettes.push({ groupName: 'GeoPixels', data: geoPixelHexCodes.map(hex => ({ rgb: hexToRgb(hex), name: hex })) }); } else { palettes.push({ groupName: 'Wplace 무료', data: wplaceFreeColorsData }); palettes.push({ groupName: 'Wplace 유료', data: wplacePaidColorsData }); } selects.forEach(select => { palettes.forEach(palette => { const optgroup = document.createElement('optgroup'); optgroup.label = palette.groupName; palette.data.forEach(color => { const option = document.createElement('option'); option.value = color.rgb.join(','); option.textContent = color.name || `rgb(${color.rgb.join(',')})`; option.style.backgroundColor = `rgb(${color.rgb.join(',')})`; option.style.color = getTextColorForBg(color.rgb); optgroup.appendChild(option); }); select.appendChild(optgroup); }); }); elements.textColorSelect.value = state.textState.textColor; elements.bgColorSelect.value = state.textState.bgColor; elements.strokeColorSelect.value = state.textState.strokeColor; };

    const updateScaleUIVisibility = () => {
        const isRatio = state.scaleMode === 'ratio';
        elements.ratioScaleControls.classList.toggle('hidden', !isRatio);
        elements.pixelScaleControls.classList.toggle('hidden', isRatio);
    };

    const switchToPixelMode = () => {
        if (!state.originalImageObject) return;
        const scaleFactor = parseFloat(elements.scaleSlider.value) / CONFIG.SCALE_FACTOR;
        const newWidth = Math.max(1, Math.round(state.originalImageObject.width / scaleFactor));
        elements.scaleWidth.value = newWidth;
        elements.scaleHeight.value = Math.round(newWidth * state.aspectRatio);
        elements.pixelScaleSlider.value = state.originalImageObject.width - newWidth;
    };

    const switchToRatioMode = () => {
        if (!state.originalImageObject) return;
        const currentWidth = parseInt(elements.scaleWidth.value, 10);
        const ratio = state.originalImageObject.width / currentWidth;
        const newSliderValue = Math.round(ratio * CONFIG.SCALE_FACTOR);
        const clampedValue = Math.max(parseInt(elements.scaleSlider.min, 10), Math.min(parseInt(elements.scaleSlider.max, 10), newSliderValue));
        elements.scaleSlider.value = clampedValue;
        elements.scaleValue.textContent = (clampedValue / CONFIG.SCALE_FACTOR).toFixed(2);
    };

    const setupEventListeners = () => {
        elements.imageModeBtn.addEventListener('change', () => setAppMode('image')); elements.textModeBtn.addEventListener('change', () => setAppMode('text'));
        elements.geopixelsModeBtn.addEventListener('change', () => { setPaletteMode('geopixels'); populateColorSelects(); }); 
        elements.wplaceModeBtn.addEventListener('change', () => { setPaletteMode('wplace'); populateColorSelects(); });
        elements.useWplaceInGeoMode.addEventListener('change', (e) => { state.useWplaceInGeoMode = e.target.checked; elements.wplacePaletteInGeo.style.display = e.target.checked ? 'block' : 'none'; updatePaletteStatus(); triggerConversion(); });
        elements.highQualityMode.addEventListener('change', (e) => { state.highQualityMode = e.target.checked; triggerConversion(); });
        elements.ditheringAlgorithmSelect.addEventListener('change', () => { elements.ditheringSlider.disabled = elements.ditheringAlgorithmSelect.value === 'none'; triggerConversion(); });
        const cont = elements.convertedCanvasContainer;
        cont.addEventListener('wheel', e => { e.preventDefault(); const step = 25; if (e.deltaY < 0) { updateZoom(state.currentZoom + step); } else { updateZoom(state.currentZoom - step); } });
        cont.addEventListener('mousedown', e => { if ((state.appMode === 'image' && !state.originalImageObject) || (state.appMode === 'text' && !state.textState.content)) return; state.isDragging = true; state.startDragX = e.pageX; state.startDragY = e.pageY; state.startPanX = state.panX; state.startPanY = state.panY; });
        cont.addEventListener('mouseleave', () => { state.isDragging = false; }); cont.addEventListener('mouseup', () => { state.isDragging = false; });
        cont.addEventListener('mousemove', e => { if (!state.isDragging) return; e.preventDefault(); const dx = e.pageX - state.startDragX; const dy = e.pageY - state.startDragY; state.panX = state.startPanX + dx; state.panY = state.startPanY + dy; updateTransform(); });
        elements.centerBtn.addEventListener('click', () => { state.panX = 0; state.panY = 0; updateZoom(100); });
        cont.addEventListener('click', () => { if (state.appMode === 'image' && !state.originalImageObject) elements.imageUpload.click(); });
        cont.addEventListener('dragover', e => { e.preventDefault(); if (state.appMode === 'image') cont.classList.add('drag-over'); });
        cont.addEventListener('dragleave', () => { cont.classList.remove('drag-over'); });
        cont.addEventListener('drop', e => { e.preventDefault(); cont.classList.remove('drag-over'); if (state.appMode === 'image' && e.dataTransfer.files.length > 0) { handleFile(e.dataTransfer.files[0]); } });
        elements.imageUpload.addEventListener('change', e => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });
        
        ['saturation', 'brightness', 'contrast', 'dithering'].forEach(t => { const s = elements[`${t}Slider`], v = elements[`${t}Value`]; if(s && v) { s.addEventListener('input', () => { v.textContent = s.value; triggerConversion(); }); } });
        document.querySelectorAll('.reset-btn').forEach(btn => { const targetId = btn.dataset.target; if (elements[targetId]) { btn.addEventListener('click', () => { const slider = elements[targetId]; const valueDisplay = elements[`${targetId.replace('Slider', '')}Value`]; const defaultValue = CONFIG.DEFAULTS[targetId]; slider.value = defaultValue; valueDisplay.textContent = defaultValue; triggerConversion(); }); } });

        elements.scaleModeSelect.addEventListener('change', e => {
            const newMode = e.target.value;
            if (newMode === state.scaleMode) return;
            if (state.originalImageObject) {
                if (newMode === 'pixel') switchToPixelMode();
                else switchToRatioMode();
            }
            state.scaleMode = newMode;
            updateScaleUIVisibility();
            triggerConversion();
        });

        elements.scaleSlider.addEventListener('input', () => { elements.scaleValue.textContent = (elements.scaleSlider.value / CONFIG.SCALE_FACTOR).toFixed(2); triggerConversion(); });
        
        let isUpdatingScale = false;
        const updatePixelInputs = (source) => {
            if (isUpdatingScale || !state.originalImageObject) return;
            isUpdatingScale = true;
            
            let width, height;
            if (source === 'width') {
                width = parseInt(elements.scaleWidth.value, 10) || 0;
                if (width > state.originalImageObject.width) width = state.originalImageObject.width;
                width = Math.max(1, width);
                height = Math.round(width * state.aspectRatio);
                elements.scaleWidth.value = width;
                elements.scaleHeight.value = height;
            } else if (source === 'height') {
                height = parseInt(elements.scaleHeight.value, 10) || 0;
                if (height > state.originalImageObject.height) height = state.originalImageObject.height;
                height = Math.max(1, height);
                width = Math.round(height / state.aspectRatio);
                elements.scaleWidth.value = width;
                elements.scaleHeight.value = height;
            } else { // from slider
                const sliderValue = parseInt(elements.pixelScaleSlider.value, 10);
                width = state.originalImageObject.width - sliderValue;
                width = Math.max(1, width);
                height = Math.round(width * state.aspectRatio);
                elements.scaleWidth.value = width;
                elements.scaleHeight.value = height;
            }
            elements.pixelScaleSlider.value = state.originalImageObject.width - width;
            
            triggerConversion();
            isUpdatingScale = false;
        };
        
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

        const handlePaste = (e) => { e.preventDefault(); const pastedText = e.clipboardData.getData('text'); let rgb = []; const numbers = pastedText.match(/\d+/g); if (numbers && numbers.length === 3) { rgb = numbers.map(numStr => parseInt(numStr, 10)); } else { const cleanText = pastedText.replace(/\D/g, ''); if (cleanText.length === 9) { rgb = [ parseInt(cleanText.substring(0, 3), 10), parseInt(cleanText.substring(3, 6), 10), parseInt(cleanText.substring(6, 9), 10) ]; } } if (rgb.length === 3 && rgb.every(num => num >= 0 && num <= 255)) { elements.addR.value = rgb[0]; elements.addG.value = rgb[1]; elements.addB.value = rgb[2]; elements.addColorBtn.click(); } };
        [elements.addR, elements.addG, elements.addB].forEach(input => { input.addEventListener('paste', handlePaste); });
        
        elements.addColorBtn.addEventListener('click', () => { const r = parseInt(elements.addR.value), g = parseInt(elements.addG.value), b = parseInt(elements.addB.value); if (isNaN(r) || r < 0 || r > 255 || isNaN(g) || g < 0 || g > 255 || isNaN(b) || b < 0 || b > 255) { alert("0~255 사이의 올바른 RGB 값을 입력해주세요."); return; } const rgb = [r, g, b]; if (isColorAlreadyAdded(rgb)) { alert("이미 추가된 색상입니다."); return; } createAddedColorItem({ rgb }); updatePaletteStatus(); triggerConversion(); });
        
        elements.resetAddedColorsBtn.addEventListener('click', resetAddedColors);
        elements.importColorsBtn.addEventListener('click', () => { const code = elements.colorCodeInput.value.trim(); if (code === '') { alert('적용할 코드를 입력해주세요.'); return; } try { const colors = JSON.parse(atob(code)); if (!Array.isArray(colors)) throw new Error(); let addedCount = 0; colors.forEach(rgb => { if (Array.isArray(rgb) && rgb.length === 3 && !isColorAlreadyAdded(rgb)) { createAddedColorItem({ rgb }); addedCount++; } }); if (addedCount > 0) { elements.colorCodeInput.value = ''; updatePaletteStatus(); triggerConversion(); } else { alert("새롭게 추가된 색상이 없습니다. (중복 제외)"); } } catch (err) { alert('유효하지 않은 코드입니다. 다시 확인해주세요.'); } });

        document.querySelectorAll('.toggle-all').forEach(btn => {
            btn.addEventListener('click', e => {
                const targetIds = e.currentTarget.dataset.target.split(',');
                let allItems = [];
                targetIds.forEach(id => { const container = document.getElementById(id); if (container) { allItems.push(...container.querySelectorAll('.color-button, .added-color-item')); } });
                if (allItems.length === 0) return;
                const onItemsCount = allItems.filter(b => b.dataset.on === 'true').length;
                const turnOn = onItemsCount < allItems.length;
                allItems.forEach(item => { const isOn = item.dataset.on === 'true'; if ((turnOn && !isOn) || (!turnOn && isOn)) { const clickable = item.classList.contains('added-color-item') ? item.querySelector('.added-color-swatch') : item; clickable.click(); } });
            });
        });
        
        elements.downloadBtn.addEventListener('click', () => { if (!state.finalDownloadableData) { alert('다운로드할 이미지가 없습니다.'); return; } const now = new Date(); const ts = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`; const baseName = state.originalFileName.substring(0, state.originalFileName.lastIndexOf('.')) || state.originalFileName; const newName = `${baseName}_NoaDot_${ts}_converted.png`; const link = document.createElement('a'); link.download = newName; const { width, height } = state.finalDownloadableData; const temp = document.createElement('canvas'); temp.width = width; temp.height = height; temp.getContext('2d').putImageData(state.finalDownloadableData, 0, 0); link.href = temp.toDataURL(); link.click(); });
    };

    const initialize = () => {
        geoPixelHexCodes.map(hex => ({ rgb: hexToRgb(hex) })).forEach(c => createColorButton(c, elements.geoPixelColorsContainer, true));
        wplaceFreeColorsData.forEach(c => createColorButton(c, elements.wplaceFreeColorsContainer, false));
        wplacePaidColorsData.forEach(c => createColorButton(c, elements.wplacePaidColorsContainer, false));
        wplaceFreeColorsData.forEach(c => createColorButton(c, elements.wplaceFreeColorsInGeo, false));
        wplacePaidColorsData.forEach(c => createColorButton(c, elements.wplacePaidColorsInGeo, false));
        
        createMasterToggleButton('geoPixelColors', elements.geoPixelColorsContainer);
        createMasterToggleButton('wplaceFreeColors', elements.wplaceFreeColorsContainer);
        createMasterToggleButton('wplacePaidColors', elements.wplacePaidColorsContainer);
        createMasterToggleButton('wplaceFreeColorsInGeo', elements.wplaceFreeColorsInGeo);
        createMasterToggleButton('wplacePaidColorsInGeo', elements.wplacePaidColorsInGeo);

        setupEventListeners();
        updateScaleUIVisibility();
        setAppMode('image');
        setPaletteMode('geopixels'); 
        populateColorSelects();
    };
    initialize();
});