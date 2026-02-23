import { eventBus } from '../../core/EventBus.js';
import { state, CONFIG, t, rgbToHex } from '../../state.js';
import { ConversionOptionsUI } from './ui.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors } from '../../../data/palettes.js';

export class ConversionOptionsFeature {
    constructor() {
        this.ui = new ConversionOptionsUI();
        
        const brightnessSlider = document.getElementById('brightnessSlider');
        if (brightnessSlider) {
            const section = brightnessSlider.closest('.option-section') || brightnessSlider.parentElement.parentElement;
            if (section) {
                this.ui.injectRGBSliders(section.id);
            }
        }

        if (!state.ditheringAlgorithmSelect || state.ditheringAlgorithmSelect === 'none') {
            state.ditheringAlgorithmSelect = 'Atkinson';
        }

        this.initEvents();
        this.initBusListeners();
        this.loadInitialState();
        
        this.updateOutlineDropdown();
    }

    initBusListeners() {
        eventBus.on('UPDATE_UI_ONLY', ({ key, value }) => {
            this.ui.updateDisplay(key, value);
            
            if (key === 'applyPattern') this.ui.toggleGroup(this.ui.patternControls, value);
            if (key === 'applyGradient') this.ui.toggleGroup(this.ui.gradientControls, value);
            if (key === 'celShadingApply') this.ui.toggleGroup(this.ui.celShadingControls, value);
            if (key === 'celShadingOutline') this.ui.toggleGroup(this.ui.celShadingOutlineSettings, value);
            if (key === 'applyRefinement') this.ui.toggleGroup(this.ui.refinementOptions, value);
        });

        eventBus.on('MODE_CHANGED', () => this.updateOutlineDropdown());
        eventBus.on('PALETTE_UPDATED', () => this.updateOutlineDropdown());
        
        eventBus.on('OPTION_CHANGED', () => {
            this.updateOutlineDropdown();
        });
    }

    updateOutlineDropdown() {
        const groups = [];
        const currentMode = state.currentMode || 'geopixels';

        const formatList = (list) => {
            if (!Array.isArray(list)) return [];
            return list.map(c => ({
                name: c.name || 'Unknown',
                hex: c.hex || (c.rgb ? rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]) : '#000000')
            }));
        };

        const userColors = state.addedColors || state.customColors || [];
        
        if (userColors.length > 0) {
            const customGroup = {
                label: t('palette_user') || 'User Added',
                colors: userColors.map(c => {
                    let r, g, b;
                    if (Array.isArray(c)) {
                        [r, g, b] = c;
                    } else if (c.rgb && Array.isArray(c.rgb)) {
                        [r, g, b] = c.rgb;
                    } else {
                        r = 0; g = 0; b = 0;
                    }
                    
                    return {
                        hex: rgbToHex(r, g, b),
                        name: 'User Color'
                    };
                })
            };
            groups.push(customGroup);
        }

        if (currentMode === 'geopixels') {
            groups.push({
                label: 'GeoPixels Default',
                colors: formatList(geopixelsColors)
            });

            if (state.useWplaceInGeoMode) {
                groups.push({
                    label: 'Wplace Free',
                    colors: formatList(wplaceFreeColors)
                });
                groups.push({
                    label: 'Wplace Paid',
                    colors: formatList(wplacePaidColors)
                });
            }
        } else if (currentMode === 'wplace') {
            groups.push({
                label: 'Wplace Free',
                colors: formatList(wplaceFreeColors)
            });
            groups.push({
                label: 'Wplace Paid',
                colors: formatList(wplacePaidColors)
            });
        }

        this.ui.updateOutlineColorList(groups);
    }

    initEvents() {
        const bindInput = (element, stateKey, isGroupToggle = false, groupElement = null) => {
            if (!element) return;
            
            if (element.type === 'range') {
                element.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value, 10);
                    this.ui.updateDisplay(stateKey, val); 
                });
                element.addEventListener('change', (e) => {
                    const val = parseInt(e.target.value, 10);
                    state[stateKey] = val;
                    if (isGroupToggle && groupElement) this.ui.toggleGroup(groupElement, val);
                    this.triggerDebouncedUpdate();
                });
            } else if (element.type === 'checkbox') {
                element.addEventListener('change', (e) => {
                    const val = element.checked;
                    state[stateKey] = val;
                    this.ui.updateDisplay(stateKey, val);
                    if (isGroupToggle && groupElement) this.ui.toggleGroup(groupElement, val);
                    eventBus.emit('OPTION_CHANGED');
                });
            } else if (element.tagName === 'SELECT') {
                element.addEventListener('change', (e) => {
                    const val = e.target.value;
                    state[stateKey] = val;
                    eventBus.emit('OPTION_CHANGED');
                });
            }
        };

        bindInput(this.ui.applyAspireDither, 'applyAspireDither');
        bindInput(this.ui.applyRefinement, 'applyRefinement', true, this.ui.refinementOptions);
        bindInput(this.ui.refinementSlider, 'refinementSlider');

        bindInput(this.ui.refinementSlider, 'refinementSlider');
        bindInput(this.ui.aspireDitherCheck, 'aspireDitherCheck');

        bindInput(this.ui.celShadingRefinementSlider, 'celShadingRefinementSlider');
        bindInput(this.ui.refinementSlider, 'refinementSlider');
        bindInput(this.ui.aspireDitherCheck, 'aspireDitherCheck');

        bindInput(this.ui.saturationInput, 'saturationSlider');
        bindInput(this.ui.brightnessInput, 'brightnessSlider');
        bindInput(this.ui.contrastInput, 'contrastSlider');
        
        bindInput(this.ui.rgbRInput, 'rgbWeightR');
        bindInput(this.ui.rgbGInput, 'rgbWeightG');
        bindInput(this.ui.rgbBInput, 'rgbWeightB');

        bindInput(this.ui.celShadingAspireDither, 'celShadingAspireDither');

        bindInput(this.ui.ditheringSelect, 'ditheringAlgorithmSelect'); 
        bindInput(this.ui.ditheringIntensity, 'ditheringSlider');

        bindInput(this.ui.applyPatternCheck, 'applyPattern', true, this.ui.patternControls);
        bindInput(this.ui.patternTypeSelect, 'patternTypeSelect');
        bindInput(this.ui.patternSizeSlider, 'patternSizeSlider');

        bindInput(this.ui.applyGradientCheck, 'applyGradient', true, this.ui.gradientControls);
        bindInput(this.ui.gradientTypeSelect, 'gradientTypeSelect');
        bindInput(this.ui.gradientDitherSizeSlider, 'gradientDitherSizeSlider');
        bindInput(this.ui.gradientAngleSlider, 'gradientAngleSlider');
        bindInput(this.ui.gradientStrengthSlider, 'gradientStrengthSlider');

        if (this.ui.celShadingApply) {
            this.ui.celShadingApply.addEventListener('change', (e) => {
                state.celShadingApply = e.target.checked;
                this.ui.toggleGroup(this.ui.celShadingControls, e.target.checked);
                eventBus.emit('OPTION_CHANGED');
            });
        }
        
        // [신규] 알고리즘 선택 드롭다운 연결
        bindInput(this.ui.celShadingAlgorithmSelect, 'celShadingAlgorithmSelect');

        bindInput(this.ui.celShadingLevelsSlider, 'celShadingLevelsSlider');
        bindInput(this.ui.celShadingColorSpaceSelect, 'celShadingColorSpaceSelect');
        bindInput(this.ui.celShadingOutline, 'celShadingOutline', true, this.ui.celShadingOutlineSettings);
        bindInput(this.ui.celShadingOutlineThresholdSlider, 'celShadingOutlineThresholdSlider');
        bindInput(this.ui.celShadingOutlineColorSelect, 'celShadingOutlineColorSelect');

        if (this.ui.celShadingRetryBtn) {
            this.ui.celShadingRetryBtn.addEventListener('click', () => {
                state.celShadingRandomSeed = Math.floor(Math.random() * 9999);
                eventBus.emit('OPTION_CHANGED');
            });
        }

        bindInput(this.ui.colorMethodSelect, 'colorMethodSelect');

        if (this.ui.resetAllBtn) {
            this.ui.resetAllBtn.addEventListener('click', () => {
                if (confirm(t('confirm_reset_all_settings'))) {
                    this.resetOptions();
                }
            });
        }

        if (this.ui.individualResetBtns) {
            this.ui.individualResetBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = btn.getAttribute('data-target');
                    if (targetId) {
                        this.resetIndividualOption(targetId);
                    }
                });
            });
        }
    }

    triggerDebouncedUpdate() {
        if (state.timeoutId) clearTimeout(state.timeoutId);
        state.timeoutId = setTimeout(() => {
            eventBus.emit('OPTION_CHANGED');
        }, CONFIG.DEBOUNCE_DELAY);
    }

    loadInitialState() {
        const keys = [
            'saturationSlider', 'brightnessSlider', 'contrastSlider', 'celShadingRefinementSlider', 'celShadingAspireDither',
            'rgbWeightR', 'rgbWeightG', 'rgbWeightB', 
            'ditheringAlgorithmSelect', 'ditheringSlider',
            'applyPattern', 'patternTypeSelect', 'patternSizeSlider',
            'applyGradient', 'gradientTypeSelect', 'gradientDitherSizeSlider', 'gradientAngleSlider', 'gradientStrengthSlider',
            'celShadingApply', 'celShadingAlgorithmSelect', 'celShadingLevelsSlider', 'celShadingColorSpaceSelect', // [신규] algorithm 추가
            'celShadingOutline', 'celShadingOutlineThresholdSlider', 'celShadingOutlineColorSelect',
            'colorMethodSelect', 'refinementSlider', 'aspireDitherCheck','refinementSlider', 'aspireDitherCheck', 'celShadingApply',
        ];

        keys.forEach(key => {
            if (state[key] !== undefined) {
                this.ui.updateDisplay(key, state[key]);
            }
        });

        this.ui.toggleGroup(this.ui.patternControls, state.applyPattern);
        this.ui.toggleGroup(this.ui.gradientControls, state.applyGradient);
        this.ui.toggleGroup(this.ui.celShadingControls, state.celShadingApply);
        this.ui.toggleGroup(this.ui.celShadingOutlineSettings, state.celShadingOutline);
        
        this.updateOutlineDropdown();
        if (state.celShadingOutlineColorSelect) {
            this.ui.celShadingOutlineColorSelect.value = state.celShadingOutlineColorSelect;
        }
    }

    resetIndividualOption(targetId) {
        let defaultValue = 0;
        
        switch(targetId) {
            case 'saturationSlider': defaultValue = 100; break;
            case 'brightnessSlider': defaultValue = 0; break;
            case 'contrastSlider': defaultValue = 0; break;
            case 'patternSizeSlider': defaultValue = 4; break;
            case 'gradientDitherSizeSlider': defaultValue = 1; break;
            case 'gradientStrengthSlider': defaultValue = 100; break;
            case 'celShadingLevelsSlider': defaultValue = 8; break;
            case 'celShadingOutlineThresholdSlider': defaultValue = 50; break;
            case 'rgbWeightR': case 'rgbWeightG': case 'rgbWeightB': defaultValue = 0; break;
            default: defaultValue = 0;
        }

        state[targetId] = defaultValue;
        this.ui.updateDisplay(targetId, defaultValue);
        this.triggerDebouncedUpdate();
    }

    resetOptions() {
        state.rgbWeightR = CONFIG.DEFAULTS.rgbWeightR;
        state.rgbWeightG = CONFIG.DEFAULTS.rgbWeightG;
        state.rgbWeightB = CONFIG.DEFAULTS.rgbWeightB;

        const defaults = {
            celShadingOutlineColorSelect: '#000000',
            celShadingAspireDither: false,
            saturationSlider: 100,
            brightnessSlider: 0,
            contrastSlider: 0,
            ditheringAlgorithmSelect: 'atkinson', 
            ditheringSlider: 0,
            applyPattern: false,
            patternTypeSelect: 'bayer8x8',
            patternSizeSlider: 4,
            applyGradient: false,
            gradientTypeSelect: 'bayer',
            gradientDitherSizeSlider: 1, 
            gradientAngleSlider: 0,
            gradientStrengthSlider: 100,
            colorMethodSelect: 'oklab',
            celShadingApply: false,
            celShadingAlgorithmSelect: 'kmeans', // [신규] 기본값 K-Means
            celShadingLevelsSlider: 8,
            celShadingColorSpaceSelect: 'oklab',
            celShadingOutline: false,
            celShadingOutlineThresholdSlider: 50,
            celShadingOutlineColorSelect: '#000000',
            celShadingRandomSeed: 0,
            refinementSlider: 0,
            aspireDitherCheck: false,
            refinementSlider: 0,
            aspireDitherCheck: false,
            celShadingApply: false,
        };

        Object.keys(defaults).forEach(key => {
            state[key] = defaults[key];
            this.ui.updateDisplay(key, defaults[key]);
        });
        
        this.ui.updateDisplay('rgbWeightR', 0);
        this.ui.updateDisplay('rgbWeightG', 0);
        this.ui.updateDisplay('rgbWeightB', 0);

        this.ui.resetUI();
        this.updateOutlineDropdown(); 
        eventBus.emit('OPTION_CHANGED');
    }
}