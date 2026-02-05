// js/features/conversion-options/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../state.js'; // [수정] t 함수 임포트
import { ConversionOptionsUI } from './ui.js';

export class ConversionOptionsFeature {
    constructor() {
        this.ui = new ConversionOptionsUI();
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
                    eventBus.emit('OPTION_CHANGED');
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
            } else {
                element.addEventListener('input', (e) => {
                    state[stateKey] = e.target.value;
                    eventBus.emit('OPTION_CHANGED');
                });
            }
        };

        // --- 기능 연결 ---
        bindInput(this.ui.saturationSlider, 'saturationSlider');
        bindInput(this.ui.brightnessSlider, 'brightnessSlider');
        bindInput(this.ui.contrastSlider, 'contrastSlider');
        
        bindInput(this.ui.ditheringAlgorithmSelect, 'ditheringAlgorithmSelect'); 
        bindInput(this.ui.ditheringSlider, 'ditheringSlider');

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

        // [수정] 초기화 버튼 클릭 시 다국어 메시지로 확인 창 띄우기
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
        switch(targetId) {
            case 'saturationSlider': defaultValue = 100; break;
            case 'brightnessSlider': defaultValue = 0;   break;
            case 'contrastSlider':   defaultValue = 0;   break;
            case 'ditheringSlider':  defaultValue = 0;   break;
            case 'patternSizeSlider': defaultValue = 4;  break;
            case 'gradientDitherSizeSlider': defaultValue = 1; break;
            case 'gradientAngleSlider': defaultValue = 0; break;
            case 'gradientStrengthSlider': defaultValue = 100; break;
            case 'celShadingLevelsSlider': defaultValue = 8; break;
            case 'celShadingOutlineThresholdSlider': defaultValue = 50; break;
            default: defaultValue = 0;
        }

        state[targetId] = defaultValue;
        this.ui.updateDisplay(targetId, defaultValue);
        eventBus.emit('OPTION_CHANGED');
    }

    resetOptions() {
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
            const val = defaults[key];
            state[key] = val;
            this.ui.updateDisplay(key, val);
        });

        this.ui.resetUI();
        eventBus.emit('OPTION_CHANGED');
    }
}