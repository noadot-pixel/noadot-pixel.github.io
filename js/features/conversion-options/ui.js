// js/features/conversion-options/ui.js

import { geopixelsColors, wplaceFreeColors, wplacePaidColors } from '../../../data/palettes.js';
import { rgbToHex, t } from '../../state.js'; // [수정] t 함수 임포트

export class ConversionOptionsUI {
    constructor() {
        // 1. 기본 색상 조정
        this.saturationSlider = document.getElementById('saturationSlider');
        this.saturationValue = document.getElementById('saturationValue');
        
        this.brightnessSlider = document.getElementById('brightnessSlider');
        this.brightnessValue = document.getElementById('brightnessValue');
        
        this.contrastSlider = document.getElementById('contrastSlider');
        this.contrastValue = document.getElementById('contrastValue');

        // 2. 디더링 설정
        this.ditheringAlgorithmSelect = document.getElementById('ditheringAlgorithmSelect');
        this.ditheringSlider = document.getElementById('ditheringSlider');
        this.ditheringValue = document.getElementById('ditheringValue');

        // 3. 패턴 오버레이
        this.applyPatternCheck = document.getElementById('applyPattern');
        this.patternControls = document.getElementById('pattern-options'); 
        this.patternTypeSelect = document.getElementById('patternTypeSelect');
        this.patternSizeSlider = document.getElementById('patternSizeSlider');
        this.patternSizeValue = document.getElementById('patternSizeValue');

        // 4. 그라디언트 맵
        this.applyGradientCheck = document.getElementById('applyGradient');
        this.gradientControls = document.getElementById('gradient-options'); 
        
        this.gradientTypeSelect = document.getElementById('gradientTypeSelect');
        this.gradientDitherSizeSlider = document.getElementById('gradientDitherSizeSlider');
        this.gradientDitherSizeValue = document.getElementById('gradientDitherSizeValue');

        this.gradientAngleSlider = document.getElementById('gradientAngleSlider');
        this.gradientAngleValue = document.getElementById('gradientAngleValue');
        this.gradientStrengthSlider = document.getElementById('gradientStrengthSlider');
        this.gradientStrengthValue = document.getElementById('gradientStrengthValue');

        // 5. 만화 효과
        this.celShadingApply = document.getElementById('celShadingApply');
        this.celShadingControls = document.getElementById('celShadingOptions'); 
        
        this.celShadingLevelsSlider = document.getElementById('celShadingLevelsSlider');
        this.celShadingLevelsValue = document.getElementById('celShadingLevelsValue');
        this.celShadingColorSpaceSelect = document.getElementById('celShadingColorSpaceSelect');
        this.celShadingRetryBtn = document.getElementById('celShadingRetryBtn'); 

        this.celShadingOutline = document.getElementById('celShadingOutline'); 
        this.celShadingOutlineSettings = document.getElementById('outline-sub-settings'); 
        
        this.celShadingOutlineThresholdSlider = document.getElementById('celShadingOutlineThresholdSlider');
        this.celShadingOutlineThresholdValue = document.getElementById('celShadingOutlineThresholdValue');
        
        // 외곽선 색상 선택 요소
        this.celShadingOutlineColorSelect = document.getElementById('celShadingOutlineColorSelect');

        // 6. 기타 설정
        this.colorMethodSelect = document.getElementById('colorMethodSelect');

        // 7. 리셋 버튼들
        this.resetBtn = document.getElementById('resetOptionsBtn'); 
        this.individualResetBtns = document.querySelectorAll('.reset-btn[data-target]');

        // 목록 채우기 실행
        this.populateOutlineColorList();
    }

    populateOutlineColorList() {
        // 요소가 없으면(HTML 로드 실패 등) 중단하여 에러 방지
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

        // [수정] 하드코딩된 문자열을 t() 함수로 교체하여 다국어 지원
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
        if (key === 'saturationSlider' && this.saturationValue) this.saturationValue.textContent = value;
        if (key === 'brightnessSlider' && this.brightnessValue) this.brightnessValue.textContent = value;
        if (key === 'contrastSlider' && this.contrastValue) this.contrastValue.textContent = value;
        if (key === 'ditheringSlider' && this.ditheringValue) this.ditheringValue.textContent = value;
        if (key === 'patternSizeSlider' && this.patternSizeValue) this.patternSizeValue.textContent = value;
        if (key === 'gradientDitherSizeSlider' && this.gradientDitherSizeValue) this.gradientDitherSizeValue.textContent = value;
        if (key === 'gradientAngleSlider' && this.gradientAngleValue) this.gradientAngleValue.textContent = value;
        if (key === 'gradientStrengthSlider' && this.gradientStrengthValue) this.gradientStrengthValue.textContent = value;
        
        if (key === 'celShadingLevelsSlider' && this.celShadingLevelsValue) this.celShadingLevelsValue.textContent = value;
        if (key === 'celShadingOutlineThresholdSlider' && this.celShadingOutlineThresholdValue) this.celShadingOutlineThresholdValue.textContent = value;

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