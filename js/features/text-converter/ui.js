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
            
            const parent = this.textarea.parentElement;
            if (parent) {
                parent.style.flex = '1';
                parent.style.display = 'flex';
                parent.style.flexDirection = 'column';
                parent.style.height = '100%';
                parent.style.padding = '0';
            }
        }

        this.fontSelect = document.getElementById('fontSelect');
        this.uploadBtn = document.getElementById('uploadFontBtn');
        this.fontInput = document.getElementById('fontUpload');
        
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

        this.initPaletteListener();
        this.updateColorSelects(); 
        
        // [수정] 화면에 처음 로드될 때 '기본값(글자 검정, 배경 흰색)'을 강제로 적용시킵니다.
        this.applyDefaultColors(); 
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
            this.useWplaceCheckbox.addEventListener('change', () => {
                this.updateColorSelects();
            });
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
            
            if (bgColor && bgColor.startsWith('#') && bgColor.length === 7) {
                const r = parseInt(bgColor.slice(1, 3), 16);
                const g = parseInt(bgColor.slice(3, 5), 16);
                const b = parseInt(bgColor.slice(5, 7), 16);
                const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                option.style.color = luma > 128 ? '#000' : '#fff';
            } else {
                option.style.color = '#000';
            }
            return option;
        };

        let finalOptions = [];

        // 1. GeoPixels
        if (mode === 'geopixels') {
            const geoOpts = (geopixelsColors || []).map(c => {
                const hex = rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]);
                return { type: 'opt', el: createOption(hex, c.name || 'GeoPixels', hex) };
            });
            finalOptions.push({ label: 'GeoPixels 팔레트', items: geoOpts });

            if (useWplaceInGeo) {
                const allWplace = [...(wplaceFreeColors||[]), ...(wplacePaidColors||[])];
                const wplaceOpts = allWplace.map(c => {
                    const hex = rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]);
                    return { type: 'opt', el: createOption(hex, c.name, hex) };
                });
                finalOptions.push({ label: 'Wplace 팔레트 (확장)', items: wplaceOpts });
            }
        } 
        // 2. Uplace [신규 추가] Uplace 모드일 때 Uplace 팔레트 95색을 불러옵니다.
        else if (mode === 'uplace') {
            const uplaceOpts = (uplaceColors || []).map(c => {
                const hex = rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]);
                return { type: 'opt', el: createOption(hex, c.name || 'Uplace', hex) };
            });
            finalOptions.push({ label: 'Uplace 팔레트', items: uplaceOpts });
        }
        // 3. Wplace
        else {
            const allWplace = [...(wplaceFreeColors||[]), ...(wplacePaidColors||[])];
            const wplaceOpts = allWplace.map(c => {
                const hex = rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]);
                return { type: 'opt', el: createOption(hex, c.name, hex) };
            });
            finalOptions.push({ label: 'Wplace 팔레트', items: wplaceOpts });
        }

        // 4. User Custom
        const userOpts = (state.addedColors || []).map(c => {
            try {
                let hex = null;
                if (typeof c === 'string') hex = c.startsWith('#') ? c : '#' + c;
                else if (c && c.hex) hex = c.hex;
                else if (c && Array.isArray(c.rgb) && c.rgb.length >= 3) {
                    const r = parseInt(c.rgb[0], 10);
                    const g = parseInt(c.rgb[1], 10);
                    const b = parseInt(c.rgb[2], 10);
                    if (!isNaN(r)) hex = rgbToHex(r, g, b);
                }
                else if (Array.isArray(c) && c.length >= 3) {
                    const r = parseInt(c[0], 10);
                    const g = parseInt(c[1], 10);
                    const b = parseInt(c[2], 10);
                    if (!isNaN(r)) hex = rgbToHex(r, g, b);
                }
                else if (c && c.r !== undefined) {
                    const r = parseInt(c.r, 10);
                    const g = parseInt(c.g, 10);
                    const b = parseInt(c.b, 10);
                    if (!isNaN(r)) hex = rgbToHex(r, g, b);
                }

                if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return null;

                return { type: 'opt', el: createOption(hex, t('label_user_color'), hex) };
            } catch (err) { return null; }
        }).filter(item => item !== null);

        if (userOpts.length > 0) {
            finalOptions.push({ label: '사용자 추가', items: userOpts });
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
            if (currentVal) {
                const exists = Array.from(select.options).some(o => o.value === currentVal);
                if(exists) select.value = currentVal;
            }
        });
    }

    applyDefaultColors() {
        const mode = this.getCurrentPaletteMode();
        this.setSelectValue(this.colors.text, '#000000'); // 기본 텍스트 색상: 검정
        this.setSelectValue(this.colors.bg, '#FFFFFF');   // 기본 배경 색상: 흰색
        this.setSelectValue(this.colors.stroke, '#000000'); // 기본 테두리 색상: 검정
    }

    setSelectValue(select, val) {
        if(select) {
            select.value = val;
            if (select.selectedIndex === -1 && select.options.length > 0) {
                select.selectedIndex = 0;
            }
            select.dispatchEvent(new Event('change')); 
        }
    }

    updateValueDisplay(id, value) {
        const targetId = id.replace('Slider', 'Value');
        const display = document.getElementById(targetId);
        if (display) display.textContent = value;
    }

    triggerFontUpload() {
        if(this.fontInput) this.fontInput.click();
    }
}