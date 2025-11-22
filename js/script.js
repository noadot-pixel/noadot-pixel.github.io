// js/script.js

// ==========================================================================
// 1. 데이터 파일 Import (루트 경로 사용)
// ==========================================================================
// 주의: 만약 로컬에서 실행 시 /data 경로를 못 찾으면 ../data 로 수정 필요
import { languageData } from '/data/languages.js?v=1'; 
import { wplaceFreeColors, wplacePaidColors, geopixelsColors } from '/data/palettes.js?v=1';

// 2. 전역 객체(window)에 데이터 할당
window.languageData = languageData;
window.geopixelsColors = geopixelsColors;
window.wplaceFreeColors = wplaceFreeColors;
window.wplacePaidColors = wplacePaidColors;

// ==========================================================================
// 3. 모듈 Import
// ==========================================================================
import { state, CONFIG, hexToRgb, rgbToHex } from '/js/state.js';
import { 
    elements, initElements, setLanguage, updateZoom, updateTransform, 
    updatePaletteStatus, populateColorSelects, createColorButton, createAddedColorItem,
    createMasterToggleButton, PNGMetadata, updateColorRecommendations, updateScaleUIVisibility,
    getOptions, createTooltip, showLoading, isColorAlreadyAdded, updatePaletteUsage
} from '/js/ui.js';
import { triggerConversion, processImage, getActivePaletteData } from '/js/worker-handler.js';
import { setupEventListeners } from '/js/events.js';

// ==========================================================================
// 비즈니스 로직
// ==========================================================================

const triggerControlChange = (key, value) => {
    const slider = elements[`${key}Slider`];
    const checkbox = elements[key];
    const select = elements[`${key}Select`];

    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });

    if (slider && slider.value !== String(value)) {
        slider.value = value;
        slider.dispatchEvent(inputEvent);
    } else if (checkbox && checkbox.checked !== value) {
        checkbox.checked = value;
        checkbox.dispatchEvent(changeEvent);
    } else if (select && select.value !== value) {
        select.value = value;
        select.dispatchEvent(changeEvent);
    }
};

const setPaletteMode = (mode) => {
    if (state.currentMode === mode && !state.isApplyingPreset) return;
    
    state.currentMode = mode;
    elements.geopixelsMode.checked = (mode === 'geopixels');
    elements.wplaceMode.checked = (mode === 'wplace');

    elements.geopixelsControls.style.display = (mode === 'geopixels') ? 'block' : 'none';
    elements.wplaceControls.style.display = (mode === 'geopixels') ? 'none' : 'block';
    elements.userPaletteSection.style.display = (mode === 'geopixels') ? 'block' : 'none';

    updatePaletteStatus(); 
    populateColorSelects();
    
    if (!state.isApplyingPreset) {
        // 모드 변경 시 추천 목록 초기화
        updateColorRecommendations([], triggerConversion); 
        triggerConversion();
    }
};

const resetAddedColors = (force = false) => {
    if (force || confirm(window.languageData[state.language].confirm_reset_colors)) {
        elements.addedColorsContainer.innerHTML = '';
        // Placeholder 복구
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'placeholder-section';
        placeholderDiv.dataset.langKey = 'placeholder_add_color';
        placeholderDiv.innerHTML = window.languageData[state.language].placeholder_add_color;
        elements.addedColorsContainer.appendChild(placeholderDiv);
        updatePaletteStatus();
        triggerConversion();
    }
};

const applyPreset = (presetObject) => {
    state.isApplyingPreset = true;
    const { preset: presetValues, requiredPaletteMode } = presetObject;

    if (requiredPaletteMode && state.currentMode !== requiredPaletteMode) {
        if (confirm(`이 프리셋은 '${requiredPaletteMode}' 모드에 최적화되어 있습니다. 모드를 전환하시겠습니까?`)) {
            setPaletteMode(requiredPaletteMode);
        } else {
            state.isApplyingPreset = false;
            return;
        }
    }
    
    Object.keys(presetValues).forEach(key => {
        if (['celShading', 'overwriteUserPalette', 'disableAllPalettes', 'enablePaletteColors', 'enableAllPalettes'].includes(key)) return;
        triggerControlChange(key, presetValues[key]);
    });
    
    if (presetValues.celShading) {
        Object.keys(presetValues.celShading).forEach(key => {
            const fullKey = `celShading${key.charAt(0).toUpperCase() + key.slice(1)}`;
            // outlineColor 같은 특수 필드는 별도 처리 필요할 수 있음 (여기선 생략)
            triggerControlChange(fullKey, presetValues.celShading[key]);
        });
        triggerControlChange('celShadingApply', true);
    } else {
        triggerControlChange('celShadingApply', false);
    }

    // 팔레트 설정 적용
    if (presetValues.enableAllPalettes) {
        // 모든 버튼 켜기
        document.querySelectorAll('.color-button[data-on="false"]').forEach(btn => btn.click());
    }

    if (presetValues.overwriteUserPalette && Array.isArray(presetValues.overwriteUserPalette)) {
        if (state.currentMode !== 'geopixels') { setPaletteMode('geopixels'); }
        resetAddedColors(true);
        presetValues.overwriteUserPalette.forEach(hex => {
            const rgb = hexToRgb(hex);
            if (rgb) { createAddedColorItem({ rgb: [rgb.r, rgb.g, rgb.b] }, true, triggerConversion); }
        });
        // 기본 팔레트는 끔? (기획에 따라 다름, 여기선 켬)
        document.querySelectorAll('#geopixels-controls .color-button[data-on="false"]').forEach(btn => btn.click());
    } 
    else if (presetValues.enablePaletteColors) {
        // 특정 색상만 켜기 로직
        const rules = presetValues.enablePaletteColors[state.currentMode];
        if (rules && Array.isArray(rules)) {
            // 1. 일단 다 끄고 시작? or 유지? (여기선 다 끄고 시작한다고 가정)
            // document.querySelectorAll('.color-button[data-on="true"]').forEach(btn => btn.click());

            const allPaletteData = (state.currentMode === 'geopixels') ? geopixelsColors : [...wplaceFreeColors, ...wplacePaidColors];
            const buttons = (state.currentMode === 'geopixels')
                ? [...document.querySelectorAll('#geopixels-controls .color-button'), ...document.querySelectorAll('#user-palette-section .added-color-item')]
                : [...document.querySelectorAll('#wplace-controls .color-button')];

            const targetRgbStrings = rules.map(nameOrHex => {
                if (String(nameOrHex).startsWith('#')) {
                    const rgb = hexToRgb(nameOrHex);
                    return rgb ? JSON.stringify([rgb.r, rgb.g, rgb.b]) : null;
                } else {
                    const colorData = allPaletteData.find(c => c.name === nameOrHex);
                    return colorData ? JSON.stringify(colorData.rgb) : null;
                }
            }).filter(Boolean);

            buttons.forEach(item => {
                const shouldBeOn = targetRgbStrings.includes(item.dataset.rgb);
                const isCurrentlyOn = item.dataset.on === 'true';
                // 목표 상태와 다르면 클릭하여 토글
                if (shouldBeOn !== isCurrentlyOn) {
                    const clickable = item.classList.contains('color-button') ? item : item.querySelector('.added-color-swatch');
                    if(clickable) clickable.click();
                }
            });
        }
    }
    
    state.isApplyingPreset = false;
    triggerConversion();
};

window.applyPreset = applyPreset;

const gatherSettingsData = () => {
    if (state.currentMode === 'geopixels') {
        return { 
            version: '3.2', 
            type: 'colors', 
            data: Array.from(elements.addedColorsContainer.querySelectorAll('.added-color-item')).map(item => JSON.parse(item.dataset.rgb)) 
        };
    } else { 
        return { version: '3.2', type: 'marker' }; 
    }
};

const applySettingsData = (settings) => {
    if (!settings || settings.type !== 'colors' || !Array.isArray(settings.data)) return;
    if (confirm(window.languageData[state.language].confirm_load_palette_from_png)) {
        elements.addedColorsContainer.innerHTML = '';
        settings.data.forEach(rgb => createAddedColorItem({ rgb }, true, triggerConversion));
        updatePaletteStatus();
        triggerConversion();
    }
};

const resetAll = () => {
    state.originalImageObject = null;
    state.originalImageData = null;
    state.textState.content = '';
    if(elements.editorTextarea) elements.editorTextarea.value = '';
    elements.appContainer.classList.remove('image-loaded');
    elements.convertedCanvasContainer.classList.remove('has-image');
    
    const cCtx = elements.convertedCanvas.getContext('2d');
    cCtx.clearRect(0, 0, elements.convertedCanvas.width, elements.convertedCanvas.height);
    
    elements.aiPresetSection.style.display = 'none';
    updateColorRecommendations([], triggerConversion);
    elements.analyzeColorsBtn.disabled = true;
    elements.recommendationReportContainer.style.display = 'none';
    elements.recommendedColorsPlaceholder.style.display = 'block';
    
    document.querySelectorAll('.reset-btn').forEach(btn => btn.click());
    
    elements.scaleControlsFieldset.disabled = true;
    elements.scaleWidth.value = '';
    elements.scaleHeight.value = '';
    elements.metadataInfoDisplay.classList.remove('visible');
    elements.imageUpload.value = '';
    
    elements.presetPopupContainer.classList.add('hidden');

    if (elements.highQualityMode) elements.highQualityMode.checked = false;
    if (elements.pixelatedScaling) elements.pixelatedScaling.checked = true;
    if (elements.useWplaceInGeoMode) elements.useWplaceInGeoMode.checked = false;
    if (elements.applyPattern) elements.applyPattern.checked = false;
    if (elements.applyGradient) elements.applyGradient.checked = false;
    if (elements.celShadingApply) elements.celShadingApply.checked = false;
    
    document.querySelectorAll('.sub-options').forEach(el => el.style.display = 'none');
    
    // 배지 초기화
    updatePaletteUsage({});
};

const setAppMode = (mode) => {
    if (state.appMode === mode) return;
    
    // ... (confirmSwitch 로직은 그대로 유지) ...
    const confirmSwitch = () => {
        if (state.appMode === 'image' && state.originalImageObject && mode === 'text') {
            return confirm(window.languageData[state.language].confirm_mode_switch_to_text);
        } else if (state.appMode === 'text' && state.textState.content && mode === 'image') {
            return confirm(window.languageData[state.language].confirm_mode_switch_to_image);
        }
        return true;
    };

    if (!confirmSwitch()) {
        elements.imageMode.checked = state.appMode === 'image';
        elements.textMode.checked = state.appMode === 'text';
        return;
    }

    // ============================================================
    // [핵심] 공통 초기화 (어느 모드로 가든 무조건 실행)
    // ============================================================
    
    // 1. 데이터 리셋
    state.originalImageObject = null;
    state.originalImageData = null;
    state.finalDownloadableData = null;
    
    // 2. 화면(캔버스) 깨끗하게 지우기
    const cCtx = elements.convertedCanvas.getContext('2d');
    cCtx.clearRect(0, 0, elements.convertedCanvas.width, elements.convertedCanvas.height);
    elements.convertedCanvasContainer.classList.remove('has-image');
    elements.appContainer.classList.remove('image-loaded');
    
    // 3. ★ 팔레트 배지 & 추천 색상 초기화 (이미지 -> 텍스트 갈 때 잔재 제거)
    updateColorRecommendations([], triggerConversion);
    updatePaletteUsage({}); 

    // 4. 입력창 초기화
    if(elements.editorTextarea) elements.editorTextarea.value = '';
    if(elements.imageUpload) elements.imageUpload.value = '';

    // ============================================================
    
    // 5. 모드 변경 및 UI 토글
    state.appMode = mode;
    elements.appContainer.classList.toggle('text-mode', mode === 'text');

    const isImageMode = mode === 'image';
    
    if(elements.imageControls) elements.imageControls.style.display = isImageMode ? 'grid' : 'none';
    if(elements.textControls) elements.textControls.style.display = isImageMode ? 'none' : 'block';
    if(elements.textEditorPanel) elements.textEditorPanel.style.display = isImageMode ? 'none' : 'flex';
    
    const imageOnlyControls = [
        elements.ditheringAlgorithmGroup,
        elements.ditheringStrengthGroup,
        elements.celShadingOptions ? elements.celShadingOptions.parentElement : null
    ];
    imageOnlyControls.forEach(el => {
        if (el) {
            const parent = el.closest('.control-group') || el;
            parent.style.display = isImageMode ? 'block' : 'none';
        }
    });
    
    // 6. 텍스트 모드 진입 시 즉시 변환 (빈 텍스트라도 실행하여 배경색 등 표시)
    if (!isImageMode) {
        triggerConversion();
    }
};

const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    
    elements.aiPresetSection.style.display = 'block';
    elements.getStyleRecommendationsBtn.disabled = false;
    elements.metadataInfoDisplay.classList.remove('visible');
    elements.recommendedColorsPlaceholder.style.display = 'block';
    elements.recommendationReportContainer.style.display = 'none';
    elements.analyzeColorsBtn.disabled = true;
    updateColorRecommendations([], triggerConversion);
    updatePaletteUsage({}); // 새 파일 로드 시 배지 초기화
    
    try {
        const settings = await PNGMetadata.extract(file);
        if (settings) {
            if (settings.type === 'colors') { 
                applySettingsData(settings); 
            } else if (settings.type === 'marker') {
                elements.metadataInfoDisplay.textContent = window.languageData[state.language].alert_png_metadata_info;
                elements.metadataInfoDisplay.classList.add('visible');
            }
        }
    } catch (error) { 
        console.error("메타데이터 읽기 오류:", error); 
    } 
    
    state.originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    
    const img = new Image();
    img.onload = () => {
        state.originalImageObject = img;
        state.aspectRatio = img.height / img.width;
        
        elements.scaleWidth.value = img.width;
        elements.scaleHeight.value = img.height;
        elements.pixelScaleSlider.max = img.width > 1 ? img.width - 1 : 1;
        elements.pixelScaleSlider.value = 0;
        elements.scaleControlsFieldset.disabled = false;
        
        elements.appContainer.classList.add('image-loaded');
        elements.originalDimensions.textContent = `${img.width} x ${img.height} px`;
        elements.convertedCanvasContainer.classList.add('has-image');
        
        state.panX = 0; 
        state.panY = 0;
        updateZoom(100);
        triggerConversion();
        elements.analyzeColorsBtn.disabled = false;
    };
    img.src = URL.createObjectURL(file);
};

const handleFontUpload = (file) => {
    if (!file) return;
    showLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
        const fontName = file.name.split('.').slice(0, -1).join('.');
        try {
            const fontFace = new FontFace(fontName, e.target.result);
            await fontFace.load();
            document.fonts.add(fontFace);
            const option = new Option(fontName, fontName);
            elements.fontSelect.add(option);
            option.selected = true;
            state.textState.fontFamily = fontName;
            triggerConversion();
        } catch (err) {
            console.error("Font loading failed:", err);
            alert("지원하지 않거나 손상된 폰트 파일입니다.");
        } finally {
            showLoading(false);
        }
    };
    reader.onerror = () => {
        alert("폰트 파일을 읽는 데 실패했습니다.");
        showLoading(false);
    };
    reader.readAsArrayBuffer(file);
};

const handleScaleModeChange = (newMode) => {
    if (state.originalImageObject) {
        if (newMode === 'pixel') {
            const sliderValue = parseInt(elements.scaleSlider.value, 10);
            const scaleFactor = 1.0 + (sliderValue * 0.25);
            const newWidth = Math.max(1, Math.round(state.originalImageObject.width / scaleFactor));
            
            elements.scaleWidth.value = newWidth;
            elements.scaleHeight.value = Math.max(1, Math.round(newWidth * state.aspectRatio));
            elements.pixelScaleSlider.value = state.originalImageObject.width - newWidth;
        } else {
            const currentWidth = parseInt(elements.scaleWidth.value, 10);
            const targetRatio = state.originalImageObject.width / currentWidth;
            const newSliderValue = Math.round((targetRatio - 1.0) / 0.25);
            const clampedValue = Math.max(0, Math.min(parseInt(elements.scaleSlider.max, 10), newSliderValue));
            
            elements.scaleSlider.value = clampedValue;
            const displayFactor = 1.0 + (clampedValue * 0.25);
            elements.scaleValue.textContent = `${displayFactor.toFixed(2)}x`;
        }
    }
    state.scaleMode = newMode;
    updateScaleUIVisibility();
    triggerConversion();
};

const tryAddColor = (rgb, name = null) => {
    if (!rgb) return false;
    if (createAddedColorItem({ rgb, name }, true, triggerConversion)) {
        updatePaletteStatus();
        triggerConversion();
        return true;
    }
    return false;
};

const clearAndResetInputFields = () => {
    elements.addHex.value = '';
    elements.addR.value = '';
    elements.addG.value = '';
    elements.addB.value = '';
    if(elements.hexInputFeedback) elements.hexInputFeedback.textContent = '\u00A0';
    if(elements.rgbInputFeedback) elements.rgbInputFeedback.textContent = '\u00A0';
};

document.addEventListener('DOMContentLoaded', () => {
    initElements();
    createTooltip();

    elements.ditheringAlgorithmSelect.value = 'atkinson';
    if (elements.celShadingApply) elements.celShadingApply.checked = false;
    
    const gpColors = window.geopixelsColors || [];
    const freeColors = window.wplaceFreeColors || [];
    const paidColors = window.wplacePaidColors || [];
    
    gpColors.forEach(c => createColorButton(c, elements.geoPixelColorsContainer, true, triggerConversion));
    freeColors.forEach(c => createColorButton(c, elements.wplaceFreeColorsContainer, true, triggerConversion));
    paidColors.forEach(c => createColorButton(c, elements.wplacePaidColorsContainer, true, triggerConversion));
    freeColors.forEach(c => createColorButton(c, elements.wplaceFreeColorsInGeo, true, triggerConversion));
    paidColors.forEach(c => createColorButton(c, elements.wplacePaidColorsInGeo, true, triggerConversion));

    // A버튼이 자동으로 생성되므로 별도의 마스터 버튼 함수 호출 불필요
    // createMasterToggleButton(...); // 삭제

    setupEventListeners({
        handleFile, setAppMode, setPaletteMode, getOptions, getActivePaletteData,
        resetAll, resetAddedColors, gatherSettingsData, applySettingsData, 
        tryAddColor, clearAndResetInputFields, handleFontUpload, handleScaleModeChange,
        updateZoom, // [중요] events.js에 전달
        updatePixelInputs: (source) => { 
            let isUpdatingScale = false; 
            if (!state.originalImageObject) return;
            
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
            } else {
                const sliderValue = parseInt(elements.pixelScaleSlider.value, 10);
                width = state.originalImageObject.width - sliderValue;
                width = Math.max(1, width);
                height = Math.round(width * state.aspectRatio);
                elements.scaleWidth.value = width;
                elements.scaleHeight.value = height;
            }
            elements.pixelScaleSlider.value = state.originalImageObject.width - width;
            triggerConversion();
        },
        setLanguage // 언어 설정 함수 전달
    });
    
    updateScaleUIVisibility();
    
    const savedLang = localStorage.getItem('userLanguage');
    const browserLang = navigator.language.split('-')[0];
    const initialLang = savedLang || (window.languageData[browserLang] ? browserLang : 'en');
    setLanguage(initialLang);
    
    setAppMode('image');
    setPaletteMode('geopixels'); 
    populateColorSelects();
});