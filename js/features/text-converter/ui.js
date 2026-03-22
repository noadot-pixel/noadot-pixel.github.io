// js/features/text-converter/ui.js
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../../data/palettes.js';
import { state, rgbToHex, t } from '../../state.js';

export class TextConverterUI {
    constructor() {
        this.textarea = document.getElementById('editor-textarea') || document.getElementById('textInput');
        
        if (this.textarea) {
            this.textarea.style.width = '100%';
            this.textarea.style.minHeight = '150px';
            this.textarea.style.height = 'calc(100% - 10px)';
            this.textarea.style.resize = 'none';
            this.textarea.style.boxSizing = 'border-box';
            this.textarea.style.margin = '0';
        }

        this.fontSelect = document.getElementById('fontSelect');
        this.uploadBtn = document.getElementById('uploadFontBtn');
        this.fontInput = document.getElementById('fontUpload');
        this.algorithmSelect = document.getElementById('textAlgorithmSelect');
        
        this.sliders = {
            fontSize: document.getElementById('fontSizeSlider'),
            letterSpacing: document.getElementById('letterSpacingSlider'),
            textLineHeight: document.getElementById('textLineHeightSlider'),
            padding: document.getElementById('paddingSlider'),
            strokeWidth: document.getElementById('strokeWidthSlider')
        };

        this.colors = {
            text: document.getElementById('textColorSelect'),
            bg: document.getElementById('bgColorSelect'),
            stroke: document.getElementById('strokeColorSelect')
        };
        
        this.boldBtn = document.querySelector('button[data-style="bold"]');
        this.italicBtn = document.querySelector('button[data-style="italic"]');
        this.useWplaceCheckbox = document.getElementById('useWplaceInGeoMode');

        // [신규] 렌더링 모드 라디오 버튼 매핑
        this.renderModeRadios = document.getElementsByName('textRenderMode');

        this.initPaletteListener();
        this.updateColorSelects(); 
        this.applyDefaultColors(); 
        this.initSliderListeners();
    }

    initSliderListeners() {
        Object.values(this.sliders).forEach(slider => {
            if (slider) {
                this.updateValueDisplay(slider);
                slider.addEventListener('input', (e) => {
                    this.updateValueDisplay(e.target);
                });
            }
        });
    }

    updateValueDisplay(slider) {
        const id = slider.id;
        const val = slider.value;
        const targetId = id.replace('Slider', 'Value');
        let display = document.getElementById(targetId);
        if (display) {
            display.textContent = id === 'textLineHeightSlider' ? (val / 10).toFixed(1) : val;
        }
    }

    initPaletteListener() {
        const radios = document.getElementsByName('paletteMode');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateColorSelects();
                this.applyDefaultColors();
            });
        });
        if (this.useWplaceCheckbox) {
            this.useWplaceCheckbox.addEventListener('change', () => this.updateColorSelects());
        }
    }

    getCurrentPaletteMode() {
        const checked = document.querySelector('input[name="paletteMode"]:checked');
        return checked ? checked.value : 'geopixels';
    }

    updateColorSelects() {
        const mode = this.getCurrentPaletteMode();
        const useWplaceInGeo = this.useWplaceCheckbox ? this.useWplaceCheckbox.checked : false;

        const createOption = (hexCode, displayName, bgColor) => {
            const option = document.createElement('option');
            option.value = hexCode;
            option.textContent = displayName ? `${displayName} (${hexCode})` : hexCode;
            option.style.backgroundColor = bgColor;
            if (bgColor && bgColor.startsWith('#')) {
                const r = parseInt(bgColor.slice(1, 3), 16), g = parseInt(bgColor.slice(3, 5), 16), b = parseInt(bgColor.slice(5, 7), 16);
                option.style.color = (0.2126 * r + 0.7152 * g + 0.0722 * b) > 128 ? '#000' : '#fff';
            }
            return option;
        };

        let finalOptions = [];
        const transparentOpt = document.createElement('option');
        transparentOpt.value = 'transparent';
        transparentOpt.textContent = '투명 (Transparent)';
        finalOptions.push({ label: '기본 기능', items: [{ type: 'opt', el: transparentOpt }] });

        const palettes = { 'geopixels': geopixelsColors, 'uplace': uplaceColors };
        if (palettes[mode]) {
            const opts = palettes[mode].map(c => ({ type: 'opt', el: createOption(rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]), c.name, rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2])) }));
            finalOptions.push({ label: `${mode.toUpperCase()} 팔레트`, items: opts });
        }

        if (state.addedColors) {
            const userOpts = state.addedColors.map(c => {
                const hex = Array.isArray(c) ? rgbToHex(c[0], c[1], c[2]) : (c.hex || '#000000');
                return { type: 'opt', el: createOption(hex, t('label_user_color'), hex) };
            });
            if (userOpts.length > 0) finalOptions.push({ label: '사용자 추가', items: userOpts });
        }

        Object.values(this.colors).forEach(select => {
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = ''; 
            finalOptions.forEach(group => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = group.label;
                group.items.forEach(item => optgroup.appendChild(item.el.cloneNode(true)));
                select.appendChild(optgroup);
            });
            if (currentVal) select.value = currentVal;
        });
    }

    applyDefaultColors() {
        this.setSelectValue(this.colors.text, '#000000'); 
        this.setSelectValue(this.colors.bg, '#FFFFFF'); 
        this.setSelectValue(this.colors.stroke, '#000000'); 
    }

    setSelectValue(select, val) {
        if(select) {
            select.value = val;
            select.dispatchEvent(new Event('change')); 
        }
    }

    triggerFontUpload() { if(this.fontInput) this.fontInput.click(); }
}