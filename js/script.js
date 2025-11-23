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
import { downloadImageWithScale } from '/js/ui.js'; // [중요] 맨 위 import에 이거 추가!


// ==========================================================================
// 비즈니스 로직
// ==========================================================================

const triggerControlChange = (key, value) => {
    // 1. ID 매핑 규칙 보강
    let targetId = key;
    
    // 저장된 키가 'dithering'처럼 순수 이름이면 'Slider'나 'Select'를 붙여서 찾음
    if (!elements[targetId]) {
        if (elements[`${key}Slider`]) targetId = `${key}Slider`;
        else if (elements[`${key}Select`]) targetId = `${key}Select`;
    }
    
    // 요소 찾기
    const targetEl = elements[targetId];
    if (!targetEl) return;

    // 2. 값 변경 및 이벤트 발생
    if (targetEl.type === 'checkbox') {
        const boolValue = (value === true || value === 'true');
        if (targetEl.checked !== boolValue) {
            targetEl.checked = boolValue;
            targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    } else {
        // 값 비교 (문자열/숫자 타입 차이 고려하여 != 사용)
        if (targetEl.value != value) {
            targetEl.value = value;
            
            // 3. [중요] Slider 옆의 숫자(Span) 업데이트를 위해 'input' 이벤트를 반드시 발생
            targetEl.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 일부 로직은 change에서 동작할 수 있으므로 둘 다 발생
            targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
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

    // 1. 모드 강제 전환 (필요시)
    if (requiredPaletteMode && state.currentMode !== requiredPaletteMode) {
        if (confirm(window.languageData[state.language].confirm_force_palette_mode(requiredPaletteMode))) {
            setPaletteMode(requiredPaletteMode);
        } else {
            state.isApplyingPreset = false;
            return;
        }
    }
    
    // 2. [강제 적용] 일반 슬라이더/체크박스/셀렉트 값
    // 저장된 JSON 키와 UI ID 매핑을 확실하게 처리합니다.
    Object.keys(presetValues).forEach(key => {
        // 특수 처리 키 건너뛰기
        if (['celShading', 'overwriteUserPalette', 'disableAllPalettes', 'enablePaletteColors', 'enableAllPalettes', 'customColors'].includes(key)) return;
        
        // [수정] 키 이름 보정 (Slider, Select 접미사가 누락된 경우 자동 매칭)
        let targetKey = key;
        
        // 만약 UI 요소가 없으면 접미사를 붙여서 찾아봄
        if (!elements[key] && !elements[`${key}Slider`] && !elements[`${key}Select`]) {
             // key가 'saturation'이면 -> 'saturationSlider'로 매핑 시도
             if (elements[`${key}Slider`]) targetKey = `${key}Slider`;
             else if (elements[`${key}Select`]) targetKey = `${key}Select`;
        }
        
        // 반대로 저장된 키에 이미 접미사가 있는데 UI는 없을 수도 있음 (드문 경우)
        // 그래도 안 되면 원래 키 사용
        
        triggerControlChange(targetKey, presetValues[key]);
    });
    
    // 3. [강제 적용] 만화 필터 (Cel Shading)
    if (presetValues.celShading) {
        const cs = presetValues.celShading;
        
        // 3-1. 세부 옵션 적용
        if (typeof cs.levels !== 'undefined') triggerControlChange('celShadingLevelsSlider', cs.levels);
        if (cs.colorSpace) triggerControlChange('celShadingColorSpaceSelect', cs.colorSpace);
        if (typeof cs.outline !== 'undefined') triggerControlChange('celShadingOutline', cs.outline);
        if (typeof cs.outlineThreshold !== 'undefined') triggerControlChange('celShadingOutlineThresholdSlider', cs.outlineThreshold);

        // 3-2. [핵심] 외곽선 색상 (RGB 배열 -> HEX 변환)
        if (cs.outlineColor) {
            let hexValue = cs.outlineColor;
            // 만약 배열([0,0,0])로 저장되어 있다면 HEX 문자열(#000000)로 변환
            if (Array.isArray(cs.outlineColor)) {
                hexValue = rgbToHex(cs.outlineColor[0], cs.outlineColor[1], cs.outlineColor[2]);
            }
            // Select 요소에 값 설정 (목록에 없으면 기본값 될 수 있음 -> populateColorSelects가 선행되어야 함)
            // 사용자 정의 색상이 먼저 로드되어야 선택 가능함 (순서 중요)
            triggerControlChange('celShadingOutlineColorSelect', hexValue);
        }

        // 3-3. 적용 여부 (반드시 마지막에)
        // 명시적으로 false면 끄고, true면 켭니다. undefined면 끕니다.
        const shouldApply = cs.apply === true;
        triggerControlChange('celShadingApply', shouldApply);
        
    } else {
        triggerControlChange('celShadingApply', false);
    }

    // 4. 사용자 정의 색상 복구 (순서 중요: 색상 선택 UI보다 먼저 해야 함)
    if (presetObject.customColors && Array.isArray(presetObject.customColors)) {
        presetObject.customColors.forEach(rgb => {
            // isColorAlreadyAdded 체크는 ui.js 함수 활용
            // 여기선 직접 추가 함수 호출
            if (typeof isColorAlreadyAdded === 'function' && !isColorAlreadyAdded(rgb)) {
                createAddedColorItem({ rgb: rgb }, true, null); 
            }
        });
        updatePaletteStatus(); // 배지 업데이트
        populateColorSelects(); // [중요] 드롭다운 목록 갱신 (그래야 외곽선 색상 선택 가능)
    }

    // 5. 팔레트 버튼 켜기/끄기 강제 적용 (기존 로직 유지)
    // ... (이전 코드와 동일하므로 생략 가능하나, 안전을 위해 아래 전체 포함)
    if (presetValues.enableAllPalettes) {
        document.querySelectorAll('.color-button[data-on="false"]').forEach(btn => btn.click());
    }
    else if (presetValues.enablePaletteColors) {
        const rules = presetValues.enablePaletteColors[state.currentMode];
        if (rules && Array.isArray(rules)) {
            const allButtons = document.querySelectorAll(
                state.currentMode === 'geopixels' 
                ? '#geopixels-controls .color-button, #user-palette-section .added-color-item'
                : '#wplace-controls .color-button'
            );

            const targetSet = new Set(rules.map(val => {
                if (typeof val === 'string' && val.startsWith('#')) {
                    const rgb = hexToRgb(val);
                    return rgb ? JSON.stringify([rgb.r, rgb.g, rgb.b]) : null;
                }
                return null;
            }).filter(Boolean));

            allButtons.forEach(btn => {
                const btnRgb = btn.dataset.rgb;
                const shouldBeOn = targetSet.has(btnRgb);
                const isOn = btn.dataset.on === 'true';
                if (shouldBeOn !== isOn) {
                    const clickable = btn.classList.contains('color-button') ? btn : btn.querySelector('.added-color-swatch');
                    if (clickable) clickable.click();
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
        downloadImageWithScale, 
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