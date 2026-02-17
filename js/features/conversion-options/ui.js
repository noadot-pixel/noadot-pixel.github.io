import { t } from '../../state.js'; 

export class ConversionOptionsUI {
    constructor() {
        // ... (기존 변수 참조 유지) ...
        this.saturationInput = document.getElementById('saturationSlider');
        this.brightnessInput = document.getElementById('brightnessSlider');
        this.contrastInput = document.getElementById('contrastSlider');
        this.individualResetBtns = document.querySelectorAll('.reset-btn[data-target]');
        this.rgbRInput = null;
        this.rgbGInput = null;
        this.rgbBInput = null;
        this.ditheringSelect = document.getElementById('ditheringAlgorithmSelect');
        this.ditheringIntensity = document.getElementById('ditheringSlider');
        this.applyPatternCheck = document.getElementById('applyPattern');
        this.patternControls = document.getElementById('pattern-options'); 
        this.patternTypeSelect = document.getElementById('patternTypeSelect');
        this.patternSizeSlider = document.getElementById('patternSizeSlider');
        this.applyGradientCheck = document.getElementById('applyGradient');
        this.gradientControls = document.getElementById('gradient-options');
        this.gradientTypeSelect = document.getElementById('gradientTypeSelect');
        this.gradientDitherSizeSlider = document.getElementById('gradientDitherSizeSlider');
        this.gradientAngleSlider = document.getElementById('gradientAngleSlider');
        this.gradientStrengthSlider = document.getElementById('gradientStrengthSlider');
        this.celShadingApply = document.getElementById('celShadingApply');
        this.celShadingControls = document.getElementById('celShadingOptions'); 
        this.celShadingLevelsSlider = document.getElementById('celShadingLevelsSlider');
        this.celShadingColorSpaceSelect = document.getElementById('celShadingColorSpaceSelect');
        this.celShadingOutline = document.getElementById('celShadingOutline');
        this.celShadingOutlineSettings = document.getElementById('outline-sub-settings');
        this.celShadingOutlineThresholdSlider = document.getElementById('celShadingOutlineThresholdSlider');
        
        // [중요] 외곽선 색상 선택 드롭다운 참조
        this.celShadingOutlineColorSelect = document.getElementById('celShadingOutlineColorSelect');
        
        this.celShadingRetryBtn = document.getElementById('celShadingRetryBtn');
        this.colorMethodSelect = document.getElementById('colorMethodSelect');
        this.resetAllBtn = document.getElementById('resetAllOptionsBtn'); 

        this.initLang();
    }

    // ... (initLang, injectRGBSliders, updateRGBReferences, toggleGroup, updateDisplay 메서드 기존 유지) ...

    initLang() {
        const labels = document.querySelectorAll('#conversion-options-container label[data-lang-key]');
        labels.forEach(label => {
            const key = label.getAttribute('data-lang-key');
            if(key) label.textContent = t(key);
        });
    }

    injectRGBSliders(targetSectionId) {
        if (document.getElementById('rgbWeightR')) {
            this.updateRGBReferences();
            return; 
        }
        const targetSection = document.getElementById(targetSectionId);
        if (!targetSection) return;
        const rgbContainer = document.createElement('div');
        rgbContainer.className = 'option-group';
        rgbContainer.style.marginTop = '15px';
        rgbContainer.style.paddingTop = '10px';
        rgbContainer.style.borderTop = '1px dashed #eee';
        rgbContainer.innerHTML = `
            <label style="display:block; margin-bottom:8px; font-weight:600;">RGB Weight Corrections</label>
            <div class="control-group">
                <label for="rgbWeightR" style="font-size:12px;">Red: <span id="rgbWeightRValue">0</span></label>
                <input type="range" id="rgbWeightR" min="-100" max="100" value="0">
            </div>
            <div class="control-group">
                <label for="rgbWeightG" style="font-size:12px;">Green: <span id="rgbWeightGValue">0</span></label>
                <input type="range" id="rgbWeightG" min="-100" max="100" value="0">
            </div>
            <div class="control-group">
                <label for="rgbWeightB" style="font-size:12px;">Blue: <span id="rgbWeightBValue">0</span></label>
                <input type="range" id="rgbWeightB" min="-100" max="100" value="0">
            </div>
        `;
        targetSection.appendChild(rgbContainer);
        this.updateRGBReferences();
    }

    updateRGBReferences() {
        this.rgbRInput = document.getElementById('rgbWeightR');
        this.rgbGInput = document.getElementById('rgbWeightG');
        this.rgbBInput = document.getElementById('rgbWeightB');
    }

    toggleGroup(element, show) {
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    }

    updateDisplay(key, value) {
        let displayId = key.replace('Slider', '') + 'Value';
        let display = document.getElementById(displayId);
        if (!display) display = document.getElementById(key + 'Value');
        if (!display) display = document.getElementById(key + 'Val');
        
        if (display) {
            if (key.startsWith('rgbWeight') && value > 0) {
                display.textContent = `+${value}`;
            } else {
                display.textContent = value;
            }
        }
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else {
                element.value = value;
            }
        }
    }

    resetUI() {
        this.toggleGroup(this.patternControls, false);
        this.toggleGroup(this.gradientControls, false);
        this.toggleGroup(this.celShadingControls, false);
        this.toggleGroup(this.celShadingOutlineSettings, false);
    }

    // [신규] 외곽선 색상 드롭다운 업데이트 메서드
    updateOutlineColorList(groups) {
        const select = this.celShadingOutlineColorSelect;
        if (!select) return;

        // 현재 선택된 값 저장 (리스트 갱신 후 복구용)
        const currentValue = select.value;

        select.innerHTML = '';

        // 1. 기본 검정색 추가
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '#000000';
        defaultOpt.textContent = 'Black (#000000)';
        defaultOpt.style.background = '#000000';
        defaultOpt.style.color = '#ffffff';
        select.appendChild(defaultOpt);

        // 2. 그룹별 색상 추가
        groups.forEach(group => {
            if (!group.colors || group.colors.length === 0) return;

            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label;

            group.colors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.hex; // ex: #FF0000
                opt.textContent = `${c.name} (${c.hex})`;
                
                // 배경색을 해당 색상으로 설정하여 시인성 확보
                opt.style.background = c.hex;
                // 밝기에 따라 글자색 반전 (간단한 로직)
                const r = parseInt(c.hex.slice(1, 3), 16);
                const g = parseInt(c.hex.slice(3, 5), 16);
                const b = parseInt(c.hex.slice(5, 7), 16);
                const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                opt.style.color = luma > 128 ? '#000' : '#fff';

                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        });

        // 이전에 선택했던 값이 유효하면 복구, 아니면 기본값
        if (currentValue) {
            select.value = currentValue;
        }
    }
}