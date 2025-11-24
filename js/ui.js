// js/ui.js (최종 수정본: [A] 버튼 복구 및 사용량 배지 해결)
import { state, CONFIG, rgbToHex, hexToRgb } from './state.js';

export const elements = {};

export const initElements = () => {
    // 1. ID와 변수명이 정확히 일치하는 것들
    console.log("1. [ui.js] initElements 시작"); // 디버깅 로그

    const ids = [
        'imageUpload', 'convertedCanvas', 'convertedCanvasContainer',
        'downloadBtn', 'originalDimensions', 'convertedDimensions',
        'scaleSlider', 'scaleValue', 'pixelScaleSlider', 'scaleWidth', 'scaleHeight', 'scaleControlsFieldset', 'scaleModeSelect',
        'saturationSlider', 'saturationValue', 'brightnessSlider', 'brightnessValue', 'contrastSlider', 'contrastValue',
        'ditheringAlgorithmSelect', 'ditheringSlider', 'ditheringValue',
        'applyPattern', 'patternTypeSelect', 'patternSizeSlider', 'patternSizeValue',
        'applyGradient', 'gradientAngleSlider', 'gradientAngleValue', 'gradientStrengthSlider', 'gradientStrengthValue',
        'colorMethodSelect', 'pixelatedScaling',
        'celShadingApply', 'celShadingLevelsSlider', 'celShadingLevelsValue',
        'celShadingColorSpaceSelect', 'celShadingRetryBtn', 
        'celShadingOutline', 'celShadingOutlineThresholdSlider', 'celShadingOutlineThresholdValue',
        'celShadingOutlineColorSelect', 
        'geopixelsMode', 'wplaceMode',
        'useWplaceInGeoMode', 
        // 'addedColorsContainer', <-- [삭제] 얘는 ID가 달라서 여기서 찾으면 안 됩니다.
        'addHex', 'addR', 'addG', 'addB', 'addColorBtn', 'resetAddedColorsBtn',
        'hexInputFeedback', 'rgbInputFeedback', 'exportPaletteBtn', 'importPaletteBtn', 'paletteUpload',
        'imageMode', 'textMode',
        'fontSelect', 'uploadFontBtn', 'fontUpload', 'fontSizeSlider', 'fontSizeValue',
        'letterSpacingSlider', 'letterSpacingValue', 'paddingSlider', 'paddingValue',
        'strokeWidthSlider', 'strokeWidthValue',
        'textColorSelect', 'bgColorSelect', 'strokeColorSelect',
        'getStyleRecommendationsBtn', 'highlightSensitivitySlider', 'highlightSensitivityValue',
        'analyzeColorsBtn', 'recommendedColorsPlaceholder',
        'convertedDimensionsLabel', 'centerBtn',
        'exportScaleSlider', 'exportScaleValue',
        'savePresetBtn', 'loadPresetBtn', 'presetUpload', 'myPresetsBtn', 
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            elements[id] = el;
        } else {
            // 없는 요소는 경고 로그 출력
            console.warn(`⚠️ [ui.js] 요소를 찾을 수 없음: #${id}`);
        }
    });
    
    
    
    // 2. [중요] ID가 달라서 수동으로 연결해야 하는 친구들 (여기가 문제였습니다!)
    elements.imageControls = document.getElementById('image-controls');
    elements.textControls = document.getElementById('text-controls');
    elements.textEditorPanel = document.getElementById('text-editor-panel');
    elements.editorTextarea = document.getElementById('editor-textarea');
    
    // ★ 에러 원인 해결: HTML id="addedColors"를 JS 변수 addedColorsContainer에 연결
    elements.addedColorsContainer = document.getElementById('addedColors'); 

    elements.appContainer = document.getElementById('app-container') || document.querySelector('.app-container');
    elements.placeholderUi = document.getElementById('placeholder-ui');
    elements.loadingIndicator = document.getElementById('loading-indicator');
    elements.metadataInfoDisplay = document.getElementById('metadata-info-display');
    
    elements.ditheringAlgorithmGroup = document.getElementById('dithering-algorithm-group');
    elements.ditheringStrengthGroup = document.getElementById('dithering-strength-group');
    elements.geopixelsControls = document.getElementById('geopixels-controls');
    elements.wplaceControls = document.getElementById('wplace-controls');
    elements.userPaletteSection = document.getElementById('user-palette-section');
    elements.aiPresetSection = document.getElementById('ai-preset-section');
    elements.recommendationReportContainer = document.getElementById('recommendation-report-container');
    elements.presetPopupContainer = document.getElementById('preset-popup-container');
    elements.closePresetPopupBtn = document.getElementById('close-preset-popup-btn');
    
    elements.leftPanel = document.querySelector('.left-panel');
    elements.rightPanel = document.querySelector('.right-panel');
    elements.mainHeader = document.querySelector('.main-header');

    elements.geoPixelColorsContainer = document.getElementById('geoPixelColors');
    elements.wplaceFreeColorsContainer = document.getElementById('wplaceFreeColors');
    elements.wplacePaidColorsContainer = document.getElementById('wplacePaidColors');
    elements.wplaceFreeColorsInGeo = document.getElementById('wplaceFreeColorsInGeo');
    elements.wplacePaidColorsInGeo = document.getElementById('wplacePaidColorsInGeo');
    
    elements.patternOptions = document.getElementById('pattern-options');
    elements.gradientOptions = document.getElementById('gradient-options');
    elements.celShadingOptions = document.getElementById('celShadingOptions');

    // 스케일 컨트롤 안전 장치
    elements.pixelScaleControls = document.getElementById('pixel-scale-controls');
    elements.ratioScaleControls = document.getElementById('ratio-scale-controls');
    if (!elements.ratioScaleControls) {
        // 혹시 ID가 그룹 div에 안 붙어있을 경우를 대비해 생성 (에러 방지)
        elements.ratioScaleControls = document.createElement('div');
    }
    
    console.log("2. [ui.js] initElements 완료. elements:", elements);
    if (!elements.pixelScaleControls) elements.pixelScaleControls = document.createElement('div');
    if (!elements.ratioScaleControls) elements.ratioScaleControls = document.createElement('div');
    
    // 디버깅: 이게 null이면 또 에러납니다.
    if (!elements.addedColorsContainer) console.error("🔥 Critical: 'addedColors' ID를 가진 요소를 HTML에서 못 찾았습니다!");

    document.getElementById('ratio-scale-controls-group');
    if (!elements.pixelScaleControls) elements.pixelScaleControls = document.createElement('div');
    if (!elements.ratioScaleControls) elements.ratioScaleControls = document.createElement('div');
    
    // 디버깅: 요소가 잘 잡혔는지 확인
    if (!elements.textEditorPanel) console.error("⚠️ 'text-editor-panel'을 찾지 못했습니다.");
    if (!elements.imageControls) console.error("⚠️ 'image-controls'를 찾지 못했습니다.");
};

export const updateUpscaleButtonState = () => {
    const btn = elements.upscaleBtn;
    if (!btn) return;

    if (state.isUpscaled) {
        // 업스케일 된 상태 -> '되돌리기' 버튼으로 변경
        btn.textContent = "↩ 원본 크기로 복구";
        btn.style.backgroundColor = "#dc3545"; // 빨간색 (Danger)
    } else {
        // 원본 상태 -> '2x 확대' 버튼으로 변경
        btn.textContent = "✨ 2x 부드럽게 확대 (EPX)";
        btn.style.backgroundColor = "#6f42c1"; // 보라색
    }
};

// [신규] [A] 버튼(전체 토글) 생성 함수
export const createAllToggleButton = (container, callback) => {
    if (!container) return;
    // 중복 생성 방지
    if (container.querySelector('.all-toggle-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'all-toggle-btn';
    btn.textContent = 'A';
    btn.title = '전체 선택/해제 (Toggle All)';
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // 이벤트 버블링 방지

        const buttons = container.querySelectorAll('.color-button');
        
        // 현재 상태 파악: 하나라도 꺼져 있으면 -> 켜기 모드 / 다 켜져 있으면 -> 끄기 모드
        // (A 버튼 자기 자신은 제외해야 함)
        const colorButtons = Array.from(buttons).filter(b => !b.classList.contains('all-toggle-btn'));
        
        if (colorButtons.length === 0) return;

        const allOn = colorButtons.every(b => b.dataset.on === 'true');
        const newState = !allOn; // 반대 상태로 전환
        
        colorButtons.forEach(b => {
            b.dataset.on = newState.toString();
            b.classList.toggle('off', !newState);
        });
        
        // 드롭다운 갱신
        populateColorSelects();
        
        // [핵심 수정] 변환 트리거 실행!
        if (callback) callback();
    });
    
    container.prepend(btn);
};



// 색상 버튼 생성 함수 (수정됨: 마스터 버튼 제거, [A] 버튼 추가 로직 삽입)
export const createColorButton = (colorData, container, isToggleable, onClickCallback) => {
    if (!container) return;
    
    // [수정됨] A 버튼을 만들 때 onClickCallback(triggerConversion)을 넘겨줍니다.
    if (container.children.length === 0 && isToggleable) {
        createAllToggleButton(container, onClickCallback);
    }

    const btn = document.createElement('button');
    btn.className = 'color-button';
    btn.dataset.rgb = JSON.stringify(colorData.rgb);
    btn.dataset.name = colorData.name;
    btn.dataset.on = 'true';
    btn.title = `${colorData.name} (RGB: ${colorData.rgb.join(', ')})`;
    btn.style.backgroundColor = `rgb(${colorData.rgb.join(',')})`;
    
    // 밝기에 따라 글자색(숫자 배지 등 대비용) 조정 - 여기선 배지가 덮으므로 큰 의미 없지만 유지
    const brightness = (colorData.rgb[0]*299 + colorData.rgb[1]*587 + colorData.rgb[2]*114)/1000;
    btn.style.color = brightness > 128 ? 'black' : 'white';

    if (isToggleable) {
        btn.addEventListener('click', () => {
            const isOn = btn.dataset.on === 'true';
            btn.dataset.on = (!isOn).toString();
            btn.classList.toggle('off', isOn);
            if (onClickCallback) onClickCallback();
        });
    }
    container.appendChild(btn);
};

// [중요] 마스터 토글 버튼 함수는 더 이상 사용하지 않으므로 삭제하거나 비워둡니다.
export const createMasterToggleButton = (targetId, container) => {
    // Deprecated: [A] 버튼으로 대체됨.
};

// 나머지 함수들은 기존 유지 (PNGMetadata, clearAndResetInputFields 등)
export class PNGMetadata {
    static async extract(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const arrayBuffer = event.target.result;
                const dataView = new DataView(arrayBuffer);
                if (dataView.getUint32(0) !== 0x89504E47) { resolve(null); return; }
                let offset = 8;
                while (offset < arrayBuffer.byteLength) {
                    const length = dataView.getUint32(offset);
                    const type = String.fromCharCode(dataView.getUint8(offset + 4), dataView.getUint8(offset + 5), dataView.getUint8(offset + 6), dataView.getUint8(offset + 7));
                    if (type === 'tEXt') {
                        const textData = new Uint8Array(arrayBuffer, offset + 8, length);
                        let text = '';
                        for (let i = 0; i < length; i++) text += String.fromCharCode(textData[i]);
                        const separatorIndex = text.indexOf('\0');
                        const keyword = text.substring(0, separatorIndex);
                        const value = text.substring(separatorIndex + 1);
                        if (keyword === 'noadot_settings') { try { resolve(JSON.parse(value)); return; } catch (e) {} }
                    }
                    offset += 12 + length;
                }
                resolve(null);
            };
            reader.readAsArrayBuffer(file);
        });
    }
}

export const clearAndResetInputFields = () => {
    if (elements.addHex) elements.addHex.value = '';
    if (elements.addR) elements.addR.value = '';
    if (elements.addG) elements.addG.value = '';
    if (elements.addB) elements.addB.value = '';
    if (elements.hexInputFeedback) elements.hexInputFeedback.textContent = '\u00A0';
    if (elements.rgbInputFeedback) elements.rgbInputFeedback.textContent = '\u00A0';
};

// js/ui.js 내부

export const setLanguage = (lang) => {
    // 1. 언어 데이터가 없으면 중단 (안전장치)
    if (!window.languageData || !window.languageData[lang]) return;
    
    // 2. 현재 언어 상태 저장 (새로고침 해도 기억하도록)
    state.language = lang;
    localStorage.setItem('userLanguage', lang);

    // 3. [텍스트] data-lang-key 속성을 가진 요소들 내용 교체
    document.querySelectorAll('[data-lang-key]').forEach(elem => {
        const key = elem.getAttribute('data-lang-key');
        if (window.languageData[lang][key]) {
            elem.innerHTML = window.languageData[lang][key];
        }
    });

    // 4. [입력창 힌트] data-lang-placeholder 속성을 가진 요소들 교체
    document.querySelectorAll('[data-lang-placeholder]').forEach(elem => {
        const key = elem.getAttribute('data-lang-placeholder');
        if (window.languageData[lang][key]) {
            elem.placeholder = window.languageData[lang][key];
        }
    });

    // 5. [툴팁] data-tooltip-key 속성을 가진 요소들 교체
    // (우리가 만든 커스텀 툴팁용 속성 'data-tooltip-text'에 넣어줌)
    document.querySelectorAll('[data-tooltip-key]').forEach(elem => {
        const key = elem.getAttribute('data-tooltip-key');
        if (window.languageData[lang][key]) {
            elem.setAttribute('data-tooltip-text', window.languageData[lang][key]);
        }
    });

    // 6. [버튼 UI] 현재 선택된 언어 버튼만 파랗게 만들기
    const buttons = document.querySelectorAll('#language-switcher button');
    buttons.forEach(btn => {
        // 만약 버튼의 언어 코드(ko/en)가 지금 설정하려는 언어와 같다면?
        if (btn.dataset.lang === lang) {
            btn.classList.add('active'); // 파란색 켜기!
        } else {
            btn.classList.remove('active'); // 아니면 끄기
        }
    });
};

export const updateZoom = (newLevel) => {
    state.zoomLevel = Math.max(10, Math.min(2000, newLevel));
    const display = document.getElementById('zoomLevelDisplay');
    if (display) display.textContent = `${Math.round(state.zoomLevel)}%`;
    updateTransform();
};

export const updateTransform = () => {
    if (!elements.convertedCanvas) return;
    elements.convertedCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomLevel / 100})`;
};

export const updatePaletteStatus = () => {
    const updateIcon = (targetId, isActive) => {
        const icon = document.querySelector(`.palette-status-icon[data-target*="${targetId}"]`);
        if (icon) icon.className = `palette-status-icon ${isActive ? 'active' : 'inactive'}`;
    };
    const isGeo = state.currentMode === 'geopixels';
    const isWplace = state.currentMode === 'wplace';
    const useWplaceInGeo = elements.useWplaceInGeoMode && elements.useWplaceInGeoMode.checked;
    if (isGeo) {
        updateIcon('geoPixelColors', true); updateIcon('wplaceFreeColorsInGeo', useWplaceInGeo); updateIcon('addedColors', true); updateIcon('wplaceFreeColors', false);
    } else if (isWplace) {
        updateIcon('geoPixelColors', false); updateIcon('wplaceFreeColorsInGeo', false); updateIcon('addedColors', false); updateIcon('wplaceFreeColors', true); updateIcon('wplacePaidColors', true);
    }
    populateColorSelects();
};

export const createAddedColorItem = (colorData, isToggleable, onClickCallback) => {
    const rgb = Array.isArray(colorData.rgb) ? colorData.rgb : colorData;
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]); // hex 변환 (state.js import 확인 필요)
    
    const div = document.createElement('div');
    div.className = 'added-color-item';
    div.dataset.rgb = JSON.stringify(rgb);
    div.dataset.on = 'true';
    
    // 1. 색상 박스
    const swatch = document.createElement('div');
    swatch.className = 'added-color-swatch';
    swatch.style.backgroundColor = `rgb(${rgb.join(',')})`;
    swatch.title = '클릭하여 켜기/끄기';
    
    // 2. 정보 텍스트 (HEX + RGB)
    const info = document.createElement('div');
    info.className = 'added-color-info';
    info.innerHTML = `
        <span class="color-hex">${hex.toUpperCase()}</span>
        <span class="color-rgb">(${rgb.join(',')})</span>
    `;
    
    // 3. 삭제 버튼 [-]
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-color-btn';
    removeBtn.innerHTML = '-'; // 스크린샷처럼 - 표시
    removeBtn.title = '삭제';
    
    // 토글 이벤트
    if (isToggleable) {
        swatch.addEventListener('click', () => {
            const isOn = div.dataset.on === 'true';
            div.dataset.on = (!isOn).toString();
            // 텍스트도 흐리게 할지 여부 결정 (여기선 스와치만)
            swatch.style.opacity = isOn ? '0.2' : '1';
            if (onClickCallback) onClickCallback();
        });
    }
    
    // 삭제 이벤트
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        div.remove();
        if (elements.addedColorsContainer.querySelectorAll('.added-color-item').length === 0) {
            // 플레이스홀더 복구 등...
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'placeholder-section';
            placeholderDiv.innerHTML = "아래에서 직접 색상을 추가하세요.";
            elements.addedColorsContainer.appendChild(placeholderDiv);
        }
        updatePaletteStatus(); // ui.js 내부 함수 호출
        if (onClickCallback) onClickCallback();
    });

    div.appendChild(swatch);
    div.appendChild(info);
    // 배지는 나중에 updatePaletteUsage에서 info와 removeBtn 사이에 꽂힘
    div.appendChild(removeBtn);
    
    // 플레이스홀더 제거
    const placeholder = elements.addedColorsContainer.querySelector('.placeholder-section');
    if (placeholder) placeholder.remove();
    
    elements.addedColorsContainer.appendChild(div);
    return true;
};


export const isColorAlreadyAdded = (rgb) => {
    const items = elements.addedColorsContainer.querySelectorAll('.added-color-item');
    for (let item of items) {
        const itemRgb = JSON.parse(item.dataset.rgb);
        if (itemRgb[0] === rgb[0] && itemRgb[1] === rgb[1] && itemRgb[2] === rgb[2]) return true;
    }
    return false;
};

export const populateColorSelects = () => {
    // 1. 기본 팔레트 버튼 수집
    let basicSelectors = [];
    if (state.currentMode === 'geopixels') {
        basicSelectors.push('#geoPixelColors .color-button[data-on="true"]');
        if (elements.useWplaceInGeoMode && elements.useWplaceInGeoMode.checked) {
            basicSelectors.push('#wplace-palette-in-geo .color-button[data-on="true"]');
        }
    } else {
        basicSelectors.push('#wplace-controls .color-button[data-on="true"]');
    }
    
    const basicButtons = document.querySelectorAll(basicSelectors.join(','));
    const basicColors = Array.from(basicButtons)
        .filter(btn => !btn.classList.contains('all-toggle-btn')) // A버튼 제외
        .map(btn => {
            const rgb = JSON.parse(btn.dataset.rgb);
            return { rgb: rgb, hex: rgbToHex(rgb[0], rgb[1], rgb[2]), name: btn.dataset.name || 'Color' };
        });

    // 2. 사용자 추가 색상 수집
    const userButtons = document.querySelectorAll('#addedColors .added-color-item[data-on="true"]');
    const userColors = Array.from(userButtons).map(item => {
        const rgb = JSON.parse(item.dataset.rgb);
        return { rgb: rgb, hex: rgbToHex(rgb[0], rgb[1], rgb[2]), name: 'User Color' };
    });

    // 중복 제거 유틸리티
    const getUnique = (arr) => {
        const unique = [];
        const seen = new Set();
        arr.forEach(c => { if (!seen.has(c.hex)) { seen.add(c.hex); unique.push(c); } });
        return unique;
    };

    const uniqueBasic = getUnique(basicColors);
    const uniqueUser = getUnique(userColors);

    // 기본 검은색/흰색은 어디에도 없으면 기본값으로 추가 (보통 외곽선용)
    const defaults = [
        { rgb: [0,0,0], hex: '#000000', name: 'Black' },
        { rgb: [255,255,255], hex: '#FFFFFF', name: 'White' }
    ];

    // 3. 드롭다운 채우기
    const targetSelects = [
        elements.textColorSelect, 
        elements.bgColorSelect, 
        elements.strokeColorSelect,
        elements.celShadingOutlineColorSelect
    ];

    targetSelects.forEach(select => {
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';

        // (1) 기본 색상 그룹
        if (uniqueBasic.length > 0 || defaults.length > 0) {
            const group1 = document.createElement('optgroup');
            group1.label = "기본 팔레트";
            
            // 기본값(검/흰) + 기본 팔레트 합치기
            const combinedBasic = [...defaults, ...uniqueBasic];
            // 다시 중복 제거 (defaults와 겹칠 수 있음)
            const finalBasic = [];
            const seen = new Set();
            combinedBasic.forEach(c => { if(!seen.has(c.hex)){ seen.add(c.hex); finalBasic.push(c); }});

            finalBasic.forEach(c => {
                const option = document.createElement('option');
                option.value = c.hex;
                option.textContent = `${c.name} (${c.hex})`;
                option.style.backgroundColor = c.hex;
                const brightness = (c.rgb[0]*299 + c.rgb[1]*587 + c.rgb[2]*114)/1000;
                option.style.color = brightness > 128 ? 'black' : 'white';
                group1.appendChild(option);
            });
            select.appendChild(group1);
        }

        // (2) 사용자 추가 그룹
        if (uniqueUser.length > 0) {
            const group2 = document.createElement('optgroup');
            group2.label = "사용자 추가 색상";
            uniqueUser.forEach(c => {
                const option = document.createElement('option');
                option.value = c.hex;
                option.textContent = `${c.hex}`; // 사용자 색상은 이름이 없으므로 Hex만
                option.style.backgroundColor = c.hex;
                const brightness = (c.rgb[0]*299 + c.rgb[1]*587 + c.rgb[2]*114)/1000;
                option.style.color = brightness > 128 ? 'black' : 'white';
                group2.appendChild(option);
            });
            select.appendChild(group2);
        }

        // 값 복원
        if (currentVal) {
            // 현재 값이 목록에 있는지 확인
            const exists = Array.from(select.options).some(opt => opt.value === currentVal);
            if (exists) select.value = currentVal;
            else select.value = (select === elements.bgColorSelect) ? '#FFFFFF' : '#000000';
        } else {
            select.value = (select === elements.bgColorSelect) ? '#FFFFFF' : '#000000';
        }
    });
};

export const createTooltip = () => {
    // 1. 기존 스타일(.tooltip-box)을 사용하는 요소 생성
    let tooltip = document.getElementById('custom-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'custom-tooltip';
        // ▼ [수정] 기존 CSS 클래스 적용
        tooltip.className = 'tooltip-box'; 
        document.body.appendChild(tooltip);
    }

    let isVisible = false;

    document.addEventListener('mousemove', (e) => {
        const target = e.target.closest('[data-tooltip-text]');

        if (target) {
            const text = target.getAttribute('data-tooltip-text');
            if (text) {
                // 내용 업데이트
                tooltip.textContent = text;

                // 위치 계산 (화면 밖으로 나감 방지)
                let top = e.clientY + 15;
                let left = e.clientX + 15;

                // 툴팁이 오른쪽 화면 밖으로 나가면 왼쪽으로
                if (left + tooltip.offsetWidth > window.innerWidth) {
                    left = e.clientX - tooltip.offsetWidth - 10;
                }
                // 툴팁이 아래쪽 화면 밖으로 나가면 위쪽으로
                if (top + tooltip.offsetHeight > window.innerHeight) {
                    top = e.clientY - tooltip.offsetHeight - 10;
                }

                tooltip.style.top = top + 'px';
                tooltip.style.left = left + 'px';

                // 보여주기 (애니메이션 효과)
                if (!isVisible) {
                    tooltip.classList.add('visible');
                    isVisible = true;
                }
                return;
            }
        }

        // 타겟이 없으면 숨기기
        if (isVisible) {
            tooltip.classList.remove('visible');
            isVisible = false;
        }
    });
};

export const showLoading = (isLoading) => {
    if (elements.loadingIndicator) elements.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    if (elements.convertedCanvasContainer) elements.convertedCanvasContainer.classList.toggle('loading', isLoading);
};

export const getOptions = () => {
    // [수정됨] 안전한 HEX -> RGB 변환 헬퍼 함수 (내장)
    const safeHexToRgb = (hex) => {
        if (!hex || typeof hex !== 'string') return [0, 0, 0];
        // # 제거 및 공백 제거
        hex = hex.trim().replace(/^#/, '');
        // 3자리(#F00) -> 6자리(#FF0000) 변환
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        // 유효성 검사
        if (!/^[0-9a-fA-F]{6}$/.test(hex)) return [0, 0, 0];
        
        const bigint = parseInt(hex, 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    // 외곽선 색상값 가져오기
    let outlineColor = [0, 0, 0]; // 기본 검은색
    if (elements.celShadingOutlineColorSelect && elements.celShadingOutlineColorSelect.value) {
        outlineColor = safeHexToRgb(elements.celShadingOutlineColorSelect.value);
    }

    const opts = {
        scaleMode: state.scaleMode,
        saturation: parseInt(elements.saturationSlider.value, 10),
        brightness: parseInt(elements.brightnessSlider.value, 10),
        contrast: parseInt(elements.contrastSlider.value, 10),
        dithering: parseInt(elements.ditheringSlider.value, 10),
        algorithm: elements.ditheringAlgorithmSelect.value,
        
        applyPattern: elements.applyPattern.checked,
        patternType: elements.patternTypeSelect.value,
        patternSize: parseInt(elements.patternSizeSlider.value, 10),
        
        applyGradient: elements.applyGradient.checked,
        gradientAngle: parseInt(elements.gradientAngleSlider.value, 10),
        gradientStrength: parseInt(elements.gradientStrengthSlider.value, 10),
        
        colorMethod: elements.colorMethodSelect ? elements.colorMethodSelect.value : 'rgb',
        pixelatedScaling: elements.pixelatedScaling.checked,
        currentMode: state.currentMode,
        
        celShading: {
            apply: elements.celShadingApply.checked,
            levels: parseInt(elements.celShadingLevelsSlider.value, 10),
            mappingMode: 'activePalette', 
            quantMethod: 'kmeans++', 
            colorSpace: elements.celShadingColorSpaceSelect.value,
            outline: elements.celShadingOutline.checked,
            outlineThreshold: parseInt(elements.celShadingOutlineThresholdSlider.value, 10),
            outlineColor: outlineColor, // [수정됨] 안전하게 변환된 값 사용
            randomSeed: state.celShadingSeed || 0 
        },
        highlightSensitivity: parseInt(elements.highlightSensitivitySlider.value, 10)
    };
    return opts;
};

export const updateColorRecommendations = (recommendations, callback) => {
    if (!elements.recommendationReportContainer) return;
    elements.recommendationReportContainer.innerHTML = '';
    
    if (!recommendations || recommendations.length === 0) {
        elements.recommendationReportContainer.style.display = 'none';
        elements.recommendedColorsPlaceholder.style.display = 'block';
        return;
    }
    
    elements.recommendationReportContainer.style.display = 'grid';
    elements.recommendedColorsPlaceholder.style.display = 'none';
    
    recommendations.forEach(rec => {
        const btn = document.createElement('button'); 
        btn.className = 'recommendation-item';
        
        const hex = rgbToHex(rec.rgb[0], rec.rgb[1], rec.rgb[2]);
        const colorBox = document.createElement('div'); 
        colorBox.className = 'rec-color-box'; 
        colorBox.style.backgroundColor = `rgb(${rec.rgb.join(',')})`;
        
        // ▼▼▼ [핵심 수정] 태그 텍스트 다국어 처리 ▼▼▼
        // 워커가 보내준 rec.type 값에 따라 언어 데이터에서 텍스트를 찾습니다.
        // 만약 워커가 한글("고비율 색상")을 그대로 보내고 있다면, 그걸 키로 매핑하거나
        // 워커를 수정해서 영어 키("dominant")를 보내게 해야 합니다.
        // 여기서는 워커 수정 없이 UI에서 처리하는 매핑 테이블을 사용합니다.
        
        const tagMap = {
            // 워커가 보낼 수 있는 모든 한글/영어 케이스 등록
            "고비율 색상": "tag_dominant",
            "Dominant": "tag_dominant",
            
            "명암 대표색": "tag_shadow",
            "Shadow": "tag_shadow",
            "어두운 톤": "tag_shadow",
            
            "하이라이트": "tag_highlight", // [추가]
            "Highlight": "tag_highlight",
            "밝은 톤": "tag_highlight",

            "주요 군집": "tag_kmean",
            "K-Means": "tag_kmean"
        };

        // 1. 매핑 키 찾기 (없으면 undefined)
        let langKey = tagMap[rec.type];

        // 2. 만약 매핑된 키가 없으면, 혹시 rec.type 자체가 "하이라이트" 같은 문자열일 수 있으니
        //    부분 일치라도 검사 (안전장치)
        if (!langKey) {
            if (rec.type.includes("하이라이트") || rec.type.includes("Highlight")) langKey = "tag_highlight";
            else if (rec.type.includes("명암") || rec.type.includes("Shadow")) langKey = "tag_shadow";
            else if (rec.type.includes("고비율") || rec.type.includes("Dominant")) langKey = "tag_dominant";
        }

        // 3. 언어 데이터 가져오기 (최종)
        const currentLang = state.language || 'ko';
        // langKey가 있으면 번역하고, 없으면 원래 텍스트(rec.type) 그대로 사용
        let displayType = (langKey && window.languageData[currentLang][langKey]) 
                          ? window.languageData[currentLang][langKey] 
                          : rec.type;
        
        // 3. 만약 언어 데이터에 없으면 원래 텍스트 그대로 출력 (안전장치)
        if (!displayType) displayType = rec.type;
        
        const textInfo = document.createElement('div'); 
        textInfo.className = 'rec-text-info'; 
        textInfo.innerHTML = `<span class="rec-hex">${hex}</span><span class="rec-desc">${displayType}</span>`;
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        const addBtn = document.createElement('span'); 
        addBtn.className = 'rec-add-icon'; 
        addBtn.textContent = '+';
        
        if (isColorAlreadyAdded(rec.rgb)) { 
            btn.classList.add('added'); 
            addBtn.textContent = '✔'; 
        }
        
        btn.onclick = () => {
            if (isColorAlreadyAdded(rec.rgb)) return;
            if (createAddedColorItem(rec, true, callback)) { 
                btn.classList.add('added'); 
                addBtn.textContent = '✔'; 
                updatePaletteStatus(); 
                if (callback) callback(); 
            }
        };
        
        btn.appendChild(colorBox); 
        btn.appendChild(textInfo); 
        btn.appendChild(addBtn); 
        elements.recommendationReportContainer.appendChild(btn);
    });
};

// js/ui.js 의 updatePaletteUsage 함수 수정

export const updatePaletteUsage = (usageMap) => {
    // A. 기본 팔레트 (Grid 형태) 처리
    document.querySelectorAll('.color-button').forEach(btn => {
        if (btn.classList.contains('all-toggle-btn')) return;
        const rgb = JSON.parse(btn.dataset.rgb);
        const key = rgb.join(',');
        const count = usageMap[key] || 0;
        const oldBadge = btn.querySelector('.usage-badge');
        if (oldBadge) oldBadge.remove();

        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'usage-badge'; // CSS에서 absolute로 처리됨
            if (count >= 1000000) badge.textContent = (count / 1000000).toFixed(1) + 'M';
            else if (count >= 1000) badge.textContent = (count / 1000).toFixed(1) + 'k';
            else badge.textContent = count;
            btn.appendChild(badge);
            btn.classList.add('used');
        } else {
            btn.classList.remove('used');
        }
    });

    // B. 사용자 추가 색상 (List 형태) 처리
    document.querySelectorAll('.added-color-item').forEach(item => {
        const rgb = JSON.parse(item.dataset.rgb);
        const key = rgb.join(',');
        const count = usageMap[key] || 0;
        const removeBtn = item.querySelector('.remove-color-btn');
        
        // 기존 배지 제거
        const oldBadge = item.querySelector('.usage-badge');
        if (oldBadge) oldBadge.remove();

        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'usage-badge'; // CSS에서 static으로 처리됨
            if (count >= 1000000) badge.textContent = (count / 1000000).toFixed(1) + 'M';
            else if (count >= 1000) badge.textContent = (count / 1000).toFixed(1) + 'k';
            else badge.textContent = count;
            
            // [중요] 삭제 버튼 앞에 삽입
            if (removeBtn) {
                item.insertBefore(badge, removeBtn);
            } else {
                item.appendChild(badge);
            }
        }
    });
};

export const updateScaleUIVisibility = () => {
    if (!elements.pixelScaleControls || !elements.ratioScaleControls) return;
    if (state.scaleMode === 'pixel') {
        elements.pixelScaleControls.style.display = 'block';
        elements.ratioScaleControls.classList.add('hidden');
    } else {
        elements.pixelScaleControls.style.display = 'none';
        elements.ratioScaleControls.classList.remove('hidden');
    }
};

export const displayRecommendedPresetsInPopup = (presets, applyCallback) => {
    const container = elements.presetPopupContainer.querySelector('.preset-scroll-wrapper');
    container.innerHTML = '';
    
    // 프리셋이 없을 경우 처리
    if (!presets || presets.length === 0) {
        container.innerHTML = '<div class="no-presets">추천할 프리셋이 없습니다.</div>';
        elements.presetPopupContainer.classList.remove('hidden');
        return;
    }

    presets.forEach(p => {
        const card = document.createElement('div');
        card.className = 'preset-card';
        
        // 1. 썸네일 영역
        const thumbWrapper = document.createElement('div');
        thumbWrapper.className = 'preset-thumb-wrapper';
        
        // [수정] 캔버스 크기를 데이터 크기에 맞춤 (비율 유지)
        const canvas = document.createElement('canvas');
        canvas.width = p.thumbnailData.width;   // 데이터 원본 너비
        canvas.height = p.thumbnailData.height; // 데이터 원본 높이
        
        const ctx = canvas.getContext('2d');
        
        // ImageData 바로 그리기 (리사이징 불필요)
        ctx.putImageData(p.thumbnailData, 0, 0);
        
        thumbWrapper.appendChild(canvas);

        // [핵심] 태그 배지 ('고정' 또는 '추천')
        // displayTag가 있을 때만 배지 표시
        if (p.displayTag) {
            const badge = document.createElement('span');
            badge.className = `preset-badge ${p.displayTag === '고정' ? 'fixed' : 'recommended'}`;
            badge.textContent = p.displayTag;
            thumbWrapper.appendChild(badge);
        }

        // 2. 이름 영역
        const title = document.createElement('h4');
        // 다국어 객체 처리 ({ko:..., en:...})
        const currentLang = state.language || 'ko';
        let nameText = p.name;
        if (typeof p.name === 'object') {
            nameText = p.name[currentLang] || p.name['ko'] || Object.values(p.name)[0];
        }
        title.textContent = nameText;
        
        // 클릭 이벤트
        card.onclick = () => {
            if (applyCallback) applyCallback(p);
            elements.presetPopupContainer.classList.add('hidden');
        };
        
        card.appendChild(thumbWrapper);
        card.appendChild(title);
        container.appendChild(card);
    });
    
    elements.presetPopupContainer.classList.remove('hidden');
};

export const downloadImageWithScale = (originalName) => {
    if (!state.finalDownloadableData) return;

    // 1. 현재 설정된 배율 가져오기 (없으면 1배)
    const scale = state.exportScale || 1;
    const width = state.finalDownloadableData.width;
    const height = state.finalDownloadableData.height;

    // 2. 확대된 크기의 캔버스 생성
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = width * scale;
    finalCanvas.height = height * scale;
    const ctx = finalCanvas.getContext('2d');

    // 3. [핵심] 픽셀 아트가 뭉개지지 않게 '선명하게' 설정 (Nearest Neighbor)
    ctx.imageSmoothingEnabled = false;

    // 4. 원본 데이터를 임시 캔버스에 그리기
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCanvas.getContext('2d').putImageData(state.finalDownloadableData, 0, 0);

    // 5. 임시 캔버스를 확대해서 그리기
    // (작은 그림을 큰 캔버스에 꽉 차게 그림 -> 픽셀이 커짐)
    ctx.drawImage(tempCanvas, 0, 0, finalCanvas.width, finalCanvas.height);

    // 6. 다운로드 실행
    const link = document.createElement('a');
    const name = originalName || 'noadot-image';
    // 파일명에 배율 표시 (예: image_x4.png)
    link.download = `${name}_x${scale}.png`;
    link.href = finalCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const updateOutputDimensionsDisplay = () => {
    const el = document.getElementById('convertedDimensions');
    
    // 데이터가 없으면 N/A 처리하고 종료
    if (!el || !state.latestConversionData) {
        if (el) {
            el.textContent = 'N/A';
            el.classList.remove('neon-gold', 'neon-purple-light', 'neon-purple-dark', 'neon-red');
        }
        return;
    }

    // 1. 현재 캔버스의 크기와 설정값 가져오기
    const currentW = state.latestConversionData.width;
    const currentH = state.latestConversionData.height;
    
    const exportScale = state.exportScale || 1;           // 출력 배율 (슬라이더 값)
    const upscaleFactor = state.currentUpscaleFactor || 1; // 업스케일 배율 (1, 2, 3)
    
    // 최종 파일로 저장될 크기 계산 (현재 크기 * 출력 배율)
    const finalW = currentW * exportScale;
    const finalH = currentH * exportScale;

    // 2. 어떤 상태인지 확인 (조건 판별)
    const isExportScaled = exportScale > 1;
    const isUpscaled = upscaleFactor > 1;

    // 3. 기존 네온 스타일 싹 지우기 (초기화)
    el.classList.remove('neon-gold', 'neon-purple-light', 'neon-purple-dark', 'neon-red');
    
    let suffixText = "";

    // [IF 03] 둘 다 적용됨 (가장 강력한 상태) -> 빨간색 네온
    if (isUpscaled && isExportScaled) {
        el.classList.add('neon-red');
        suffixText = ` (${upscaleFactor}x EPX * ${exportScale}배)`;
    }
    // [IF 02] 업스케일만 적용됨 -> 보라색 네온
    else if (isUpscaled) {
        if (upscaleFactor === 2) {
            el.classList.add('neon-purple-light');
            suffixText = " (2x EPX)";
        } else if (upscaleFactor >= 3) {
            el.classList.add('neon-purple-dark');
            suffixText = ` (${upscaleFactor}x EPX)`;
        }
    }
    // [IF 01] 출력 배율만 높임 -> 금색 네온
    else if (isExportScaled) {
        el.classList.add('neon-gold');
        suffixText = ` (${exportScale}배)`;
    }
    // [Default] 아무것도 안 함 -> 기본 흰색/검은색
    else {
        // 아무 클래스도 추가하지 않음
    }

    // 4. 화면에 글자 업데이트
    el.textContent = `${finalW} x ${finalH} px${suffixText}`;
};