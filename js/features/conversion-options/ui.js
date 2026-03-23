// js/features/conversion-options/ui.js
import { t } from '../../state.js'; 

export class ConversionOptionsUI {
    constructor() {
        this.saturationInput = document.getElementById('saturationSlider');
        this.brightnessInput = document.getElementById('brightnessSlider');
        this.contrastInput = document.getElementById('contrastSlider');
        this.celShadingRefinementSlider = document.getElementById('celShadingRefinementSlider');
        this.individualResetBtns = document.querySelectorAll('.reset-btn[data-target]');
        this.rgbRInput = null;
        this.rgbGInput = null;
        this.rgbBInput = null;

        

        this.ditheringSelect = document.getElementById('ditheringAlgorithmSelect');
        this.ditheringIntensity = document.getElementById('ditheringSlider');
        this.applyPatternCheck = document.getElementById('applyPattern');
        this.patternControls = document.getElementById('patternOptions');
        this.patternTypeSelect = document.getElementById('patternTypeSelect');
        this.patternSizeSlider = document.getElementById('patternSizeSlider');
        this.applyGradientCheck = document.getElementById('applyGradient');
        this.gradientControls = document.getElementById('gradientOptions');
        this.gradientTypeSelect = document.getElementById('gradientTypeSelect');
        this.gradientDitherSizeSlider = document.getElementById('gradientDitherSizeSlider');
        this.gradientAngleSlider = document.getElementById('gradientAngleSlider');
        this.gradientStrengthSlider = document.getElementById('gradientStrengthSlider');

        this.celShadingApply = document.getElementById('celShadingApply');
        this.celShadingControls = document.getElementById('celShadingOptions'); 
        this.refinementSlider = document.getElementById('refinementSlider');
        
        this.celShadingAspireDither = document.getElementById('celShadingAspireDither');
        this.celShadingAlgorithmSelect = document.getElementById('celShadingAlgorithmSelect');
        this.celShadingLevelsSlider = document.getElementById('celShadingLevelsSlider');
        this.celShadingColorSpaceSelect = document.getElementById('celShadingColorSpaceSelect');
        
        this.celShadingOutline = document.getElementById('celShadingOutline');
        this.celShadingOutlineSettings = document.getElementById('celShadingOutlineOptions');        
        this.celShadingOutlineThresholdSlider = document.getElementById('celShadingOutlineThresholdSlider');
        this.celShadingOutlineColorSelect = document.getElementById('celShadingOutlineColorSelect');
        
        this.celShadingRetryBtn = document.getElementById('celShadingRetryBtn');
        this.colorMethodSelect = document.getElementById('colorMethodSelect');
        
        this.resetAllBtn = document.getElementById('resetAllOptionsBtn'); 
        this.applyAspireDither = document.getElementById('applyAspireDither');
        this.applyRefinement = document.getElementById('applyRefinement');
        this.refinementOptions = document.getElementById('refinementOptions');

        this.applyOutlineExpansionCheck = document.getElementById('applyOutlineExpansion');
        this.applySmartSamplingCheck = document.getElementById('applySmartSampling');
        
        // [복구 완료] 채도 보정 슬라이더 연결!
        this.saturationWeightInput = document.getElementById('saturationWeight');

        this.initLang();
        this.initUniversalSliderListeners();
    }

    initUniversalSliderListeners() {
        const allSliders = document.querySelectorAll('#conversion-options-container input[type="range"]');
        allSliders.forEach(slider => {
            this.updateSliderText(slider);
            slider.addEventListener('input', (e) => {
                this.updateSliderText(e.target);
            });
        });
    }

    updateSliderText(slider) {
        const val = slider.value;
        const id = slider.id;
        if (!id) return;

        let display = document.getElementById(id.replace('Slider', 'Value')) || 
                      document.getElementById(id.replace('Slider', 'Val')) || 
                      document.getElementById(id + 'Value') || 
                      document.getElementById(id + 'Val');

        if (!display) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) display = label.querySelector('span');
        }
        if (!display && slider.parentElement) {
            display = slider.parentElement.querySelector('span');
        }

        if (!display) {
            display = document.createElement('span');
            display.id = id + 'Value';
            display.style.marginLeft = '10px';
            display.style.fontWeight = 'bold';
            display.style.color = '#007bff';
            
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) {
                label.appendChild(display);
            } else {
                slider.parentElement.insertBefore(display, slider);
            }
        }

        if (display) {
            if (id.startsWith('rgbWeight') && val > 0) {
                display.textContent = `+${val}`;
            } else if (id === 'saturationWeight') {
                display.textContent = `${val}%`; // 퍼센트 기호 추가
            } else {
                display.textContent = val;
            }
        }
    }

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
        
        ['rgbWeightR', 'rgbWeightG', 'rgbWeightB'].forEach(id => {
            const slider = document.getElementById(id);
            if(slider) {
                this.updateSliderText(slider);
                slider.addEventListener('input', (e) => this.updateSliderText(e.target));
            }
        });
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
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else {
                element.value = value;
                if (element.type === 'range') {
                    this.updateSliderText(element);
                }
            }
        }
    }

    resetUI() {
        this.toggleGroup(this.patternControls, false);
        this.toggleGroup(this.gradientControls, false);
        this.toggleGroup(this.celShadingControls, false);
        this.toggleGroup(this.celShadingOutlineSettings, false);
    }

    updateOutlineColorList(groups) {
        const select = this.celShadingOutlineColorSelect;
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '';

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '#000000';
        defaultOpt.textContent = 'Black (#000000)';
        defaultOpt.style.background = '#000000';
        defaultOpt.style.color = '#ffffff';
        select.appendChild(defaultOpt);

        groups.forEach(group => {
            if (!group.colors || group.colors.length === 0) return;

            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label;

            group.colors.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.hex; 
                opt.textContent = `${c.name} (${c.hex})`;
                
                opt.style.background = c.hex;
                const r = parseInt(c.hex.slice(1, 3), 16);
                const g = parseInt(c.hex.slice(3, 5), 16);
                const b = parseInt(c.hex.slice(5, 7), 16);
                const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                opt.style.color = luma > 128 ? '#000' : '#fff';

                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    }
}