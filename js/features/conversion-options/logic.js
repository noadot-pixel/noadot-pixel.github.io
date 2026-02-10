import { eventBus } from '../../core/EventBus.js';
import { state, CONFIG, t } from '../../state.js';
import { ConversionOptionsUI } from './ui.js';

export class ConversionOptionsFeature {
    constructor() {
        this.ui = new ConversionOptionsUI();
        
        // [New] UI에 RGB 슬라이더가 없다면 동적 주입 (밝기/대비 섹션 찾아서)
        const brightnessSlider = document.getElementById('brightnessSlider');
        if (brightnessSlider && brightnessSlider.closest('.option-section')) {
            // 상위 섹션의 ID를 전달
            this.ui.injectRGBSliders(brightnessSlider.closest('.option-section').id);
        }

        this.initEvents();
        this.initBusListeners();
        this.loadInitialState();
    }

    initBusListeners() {
        eventBus.on('UPDATE_UI_ONLY', ({ key, value }) => {
            this.ui.updateDisplay(key, value);
            
            if (key === 'applyPattern') this.ui.toggleGroup(this.ui.patternControls, value);
            if (key === 'applyGradient') this.ui.toggleGroup(this.ui.gradientControls, value);
            if (key === 'celShadingApply') this.ui.toggleGroup(this.ui.celShadingControls, value);
            if (key === 'celShadingOutline') this.ui.toggleGroup(this.ui.celShadingOutlineSettings, value);
        });
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
                    
                    // 디바운스 적용
                    if (state.timeoutId) clearTimeout(state.timeoutId);
                    state.timeoutId = setTimeout(() => {
                        eventBus.emit('OPTION_CHANGED');
                    }, CONFIG.DEBOUNCE_DELAY);
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

        // --- 기능 연결 ---
        bindInput(this.ui.saturationInput, 'saturationSlider'); // saturationInput으로 이름 맞춤
        bindInput(this.ui.brightnessInput, 'brightnessSlider');
        bindInput(this.ui.contrastInput, 'contrastSlider');
        
        // [New] RGB 가중치 연결
        bindInput(this.ui.rgbRInput, 'rgbWeightR');
        bindInput(this.ui.rgbGInput, 'rgbWeightG');
        bindInput(this.ui.rgbBInput, 'rgbWeightB');

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

        if (this.ui.resetBtn) {
            this.ui.resetBtn.addEventListener('click', () => {
                if (confirm(t('alert_reset_confirm'))) {
                    this.resetOptions();
                }
            });
        }

        if (this.ui.individualResetBtns) {
            this.ui.individualResetBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = btn.dataset.target;
                    if (targetId) this.resetIndividualOption(targetId);
                });
            });
        }
    }

    loadInitialState() {
        const keys = [
            'saturationSlider', 'brightnessSlider', 'contrastSlider',
            'rgbWeightR', 'rgbWeightG', 'rgbWeightB', // [New]
            'ditheringAlgorithmSelect', 'ditheringSlider',
            'applyPattern', 'patternTypeSelect', 'patternSizeSlider',
            'applyGradient', 'gradientTypeSelect', 'gradientDitherSizeSlider', 'gradientAngleSlider', 'gradientStrengthSlider',
            'celShadingApply', 'celShadingLevelsSlider', 'celShadingColorSpaceSelect',
            'celShadingOutline', 'celShadingOutlineThresholdSlider', 'celShadingOutlineColorSelect',
            'colorMethodSelect'
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
    }

    resetIndividualOption(targetId) {
        let defaultValue = 0;
        // ... (기존 switch case 유지) ...
        switch(targetId) {
            case 'saturationSlider': defaultValue = 100; break;
            case 'patternSizeSlider': defaultValue = 4; break;
            case 'gradientDitherSizeSlider': defaultValue = 1; break;
            case 'gradientStrengthSlider': defaultValue = 100; break;
            case 'celShadingLevelsSlider': defaultValue = 8; break;
            case 'celShadingOutlineThresholdSlider': defaultValue = 50; break;
            // [New] RGB 기본값 0
            case 'rgbWeightR': case 'rgbWeightG': case 'rgbWeightB': defaultValue = 0; break;
            default: defaultValue = 0;
        }

        state[targetId] = defaultValue;
        this.ui.updateDisplay(targetId, defaultValue);
        eventBus.emit('OPTION_CHANGED');
    }

    resetOptions() {
        // [New] RGB 포함 리셋
        state.rgbWeightR = CONFIG.DEFAULTS.rgbWeightR;
        state.rgbWeightG = CONFIG.DEFAULTS.rgbWeightG;
        state.rgbWeightB = CONFIG.DEFAULTS.rgbWeightB;

        const defaults = {
            saturationSlider: 100,
            brightnessSlider: 0,
            contrastSlider: 0,
            ditheringAlgorithmSelect: 'none',
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
            celShadingLevelsSlider: 8,
            celShadingColorSpaceSelect: 'oklab',
            celShadingOutline: false,
            celShadingOutlineThresholdSlider: 50,
            celShadingOutlineColorSelect: '#000000',
            celShadingRandomSeed: 0
        };

        Object.keys(defaults).forEach(key => {
            state[key] = defaults[key];
            this.ui.updateDisplay(key, defaults[key]);
        });
        
        // RGB 디스플레이 업데이트
        this.ui.updateDisplay('rgbWeightR', 0);
        this.ui.updateDisplay('rgbWeightG', 0);
        this.ui.updateDisplay('rgbWeightB', 0);

        this.ui.resetUI();
        eventBus.emit('OPTION_CHANGED');
    }
}