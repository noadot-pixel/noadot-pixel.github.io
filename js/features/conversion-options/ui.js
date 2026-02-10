// js/features/conversion-options/ui.js

import { geopixelsColors, wplaceFreeColors, wplacePaidColors } from '../../../data/palettes.js';
import { rgbToHex, t } from '../../state.js'; 

export class ConversionOptionsUI {
    constructor() {
        // 1. 기본 색상 조정
        this.saturationInput = document.getElementById('saturationSlider'); // saturationValue는 logic에서 처리
        this.brightnessInput = document.getElementById('brightnessSlider');
        this.contrastInput = document.getElementById('contrastSlider');
        
        // [New] RGB 가중치 슬라이더 참조 (HTML에 없을 경우 동적 생성 후 참조됨)
        this.rgbRInput = null;
        this.rgbGInput = null;
        this.rgbBInput = null;

        // 2. 디더링 설정
        this.ditheringSelect = document.getElementById('ditheringAlgorithmSelect');
        this.ditheringIntensity = document.getElementById('ditheringSlider'); // ditheringValue

        // 3. 패턴 오버레이
        this.applyPatternCheck = document.getElementById('applyPattern');
        this.patternControls = document.getElementById('pattern-options'); 
        this.patternTypeSelect = document.getElementById('patternTypeSelect');
        this.patternSizeSlider = document.getElementById('patternSizeSlider'); // patternSizeValue

        // 4. 그라디언트 맵
        this.applyGradientCheck = document.getElementById('applyGradient');
        this.gradientControls = document.getElementById('gradient-options'); 
        this.gradientTypeSelect = document.getElementById('gradientTypeSelect');
        this.gradientDitherSizeSlider = document.getElementById('gradientDitherSizeSlider');
        this.gradientAngleSlider = document.getElementById('gradientAngleSlider');
        this.gradientStrengthSlider = document.getElementById('gradientStrengthSlider');

        // 5. 만화 효과
        this.celShadingApply = document.getElementById('celShadingApply');
        this.celShadingControls = document.getElementById('celShadingOptions'); 
        this.celShadingLevelsSlider = document.getElementById('celShadingLevelsSlider');
        this.celShadingColorSpaceSelect = document.getElementById('celShadingColorSpaceSelect');
        this.celShadingRetryBtn = document.getElementById('celShadingRetryBtn'); 
        this.celShadingOutline = document.getElementById('celShadingOutline'); 
        this.celShadingOutlineSettings = document.getElementById('outline-sub-settings'); 
        this.celShadingOutlineThresholdSlider = document.getElementById('celShadingOutlineThresholdSlider');
        this.celShadingOutlineColorSelect = document.getElementById('celShadingOutlineColorSelect');

        // 6. 기타 설정
        this.colorMethodSelect = document.getElementById('colorMethodSelect');

        // 7. 리셋 버튼들
        this.resetBtn = document.getElementById('resetOptionsBtn'); 
        this.individualResetBtns = document.querySelectorAll('.reset-btn[data-target]');

        // 초기화 실행
        this.populateOutlineColorList();
    }

    // [New] RGB 슬라이더가 HTML에 없을 경우 동적으로 생성하는 메서드
    injectRGBSliders(containerId) {
        // 이미 생성되었거나 컨테이너가 없으면 중단
        const container = document.getElementById(containerId);
        if (!container || document.getElementById('rgbWeightR')) {
            // 이미 있으면 참조만 연결
            this.rgbRInput = document.getElementById('rgbWeightR');
            this.rgbGInput = document.getElementById('rgbWeightG');
            this.rgbBInput = document.getElementById('rgbWeightB');
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'sub-options';
        wrapper.style.display = 'block';
        wrapper.style.borderLeft = 'none';
        wrapper.style.paddingLeft = '0';
        wrapper.style.marginTop = '15px';
        wrapper.style.borderTop = '1px solid #eee';
        wrapper.style.paddingTop = '10px';

        const createSlider = (id, label, color) => {
            const div = document.createElement('div');
            div.className = 'control-group';
            div.style.marginBottom = '5px';
            div.innerHTML = `
                <label for="${id}" style="font-size:13px; color:${color}; display:flex; justify-content:space-between;">
                    <span>${label} 가중치</span> <span id="${id}Value">0</span>
                </label>
                <input type="range" id="${id}" min="-100" max="100" value="0" step="5">
            `;
            return div;
        };

        wrapper.appendChild(createSlider('rgbWeightR', 'Red', '#e74c3c'));
        wrapper.appendChild(createSlider('rgbWeightG', 'Green', '#2ecc71'));
        wrapper.appendChild(createSlider('rgbWeightB', 'Blue', '#3498db'));

        // 밝기/대비 슬라이더 뒤에 추가
        container.appendChild(wrapper);

        // 참조 업데이트
        this.rgbRInput = document.getElementById('rgbWeightR');
        this.rgbGInput = document.getElementById('rgbWeightG');
        this.rgbBInput = document.getElementById('rgbWeightB');
    }

    populateOutlineColorList() {
        if (!this.celShadingOutlineColorSelect) return;
        this.celShadingOutlineColorSelect.innerHTML = ''; 

        const addGroup = (label, colors) => {
            const group = document.createElement('optgroup');
            group.label = label;
            colors.forEach(c => {
                const hex = rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]);
                const name = c.name || hex;
                const option = document.createElement('option');
                option.value = hex; 
                option.textContent = name;
                option.style.backgroundColor = hex;
                const brightness = (c.rgb[0]*299 + c.rgb[1]*587 + c.rgb[2]*114) / 1000;
                option.style.color = brightness > 128 ? 'black' : 'white';
                group.appendChild(option);
            });
            this.celShadingOutlineColorSelect.appendChild(group);
        };

        addGroup(t('palette_geopixels_default'), geopixelsColors);
        addGroup(t('palette_wplace_free'), wplaceFreeColors);
        addGroup(t('palette_wplace_paid'), wplacePaidColors);
    }

    toggleGroup(element, isVisible) {
        if (element) {
            element.style.display = isVisible ? 'block' : 'none';
        }
    }

    updateDisplay(key, value) {
        // Helper to update text content if element exists
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        if (key === 'saturationSlider') updateText('saturationValue', value);
        if (key === 'brightnessSlider') updateText('brightnessValue', value);
        if (key === 'contrastSlider') updateText('contrastValue', value);
        
        // [New] RGB 값 업데이트
        if (key === 'rgbWeightR') {
            if(this.rgbRInput) this.rgbRInput.value = value;
            updateText('rgbWeightRValue', value > 0 ? `+${value}` : value);
        }
        if (key === 'rgbWeightG') {
            if(this.rgbGInput) this.rgbGInput.value = value;
            updateText('rgbWeightGValue', value > 0 ? `+${value}` : value);
        }
        if (key === 'rgbWeightB') {
            if(this.rgbBInput) this.rgbBInput.value = value;
            updateText('rgbWeightBValue', value > 0 ? `+${value}` : value);
        }

        if (key === 'ditheringSlider') updateText('ditheringValue', value);
        if (key === 'patternSizeSlider') updateText('patternSizeValue', value);
        if (key === 'gradientDitherSizeSlider') updateText('gradientDitherSizeValue', value);
        if (key === 'gradientAngleSlider') updateText('gradientAngleValue', value);
        if (key === 'gradientStrengthSlider') updateText('gradientStrengthValue', value);
        
        if (key === 'celShadingLevelsSlider') updateText('celShadingLevelsValue', value);
        if (key === 'celShadingOutlineThresholdSlider') updateText('celShadingOutlineThresholdValue', value);

        // Input element value update
        if (this[key] && this[key].type) {
            if (this[key].type === 'checkbox') {
                this[key].checked = value;
            } else {
                this[key].value = value;
            }
        }
    }

    resetUI() {
        this.toggleGroup(this.patternControls, false);
        this.toggleGroup(this.gradientControls, false);
        this.toggleGroup(this.celShadingControls, false);
        this.toggleGroup(this.celShadingOutlineSettings, false);
    }
}