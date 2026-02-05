// js/features/text-converter/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../state.js'; // [수정] t 함수 임포트
import { TextConverterUI } from './ui.js';
import { TextRenderer } from './renderer.js';

export class TextConverterFeature {
    constructor() {
        this.ui = new TextConverterUI();
        this.renderer = new TextRenderer();
        
        if (!state.textState) {
            state.textState = {
                content: "",
                fontFamily: "Malgun Gothic",
                fontSize: 15,
                letterSpacing: 0,
                textLineHeight: 1.5,
                padding: 10,
                textColor: "#000000",
                bgColor: "#FFFFFF",
                strokeColor: "#000000",
                strokeWidth: 0,
                isBold: false,
                isItalic: false
            };
        }

        this.initEvents();
        this.initBusListeners();
        
        this.ui.applyDefaultColors();
    }

    initBusListeners() {
        eventBus.on('TEXT_CONFIG_UPDATED', () => this.generateAndEmit());
        
        eventBus.on('MODE_CHANGED', (mode) => {
            if (mode === 'text') {
                this.ui.updateColorSelects(); 
                this.ui.applyDefaultColors(); 
                this.generateAndEmit();
            }
        });

        eventBus.on('PALETTE_UPDATED', () => {
            this.ui.updateColorSelects();
        });
    }

    initEvents() {
        if (this.ui.textarea) {
            this.ui.textarea.addEventListener('input', (e) => {
                state.textState.content = e.target.value;
                this.generateAndEmit();
            });
        }
        
        Object.entries(this.ui.sliders).forEach(([key, input]) => {
            if (!input) return;
            input.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                
                if (key === 'textLineHeight') val /= 10; 
                
                state.textState[key] = val;
                this.ui.updateValueDisplay(input.id, val);
                this.generateAndEmit();
            });
        });

        Object.entries(this.ui.colors).forEach(([key, input]) => {
            if (!input) return;
            input.addEventListener('change', (e) => {
                const propMap = { text: 'textColor', bg: 'bgColor', stroke: 'strokeColor' };
                state.textState[propMap[key]] = e.target.value;
                this.generateAndEmit();
            });
        });

        if (this.ui.fontSelect) {
            this.ui.fontSelect.addEventListener('change', (e) => {
                state.textState.fontFamily = e.target.value;
                this.generateAndEmit();
            });
        }

        if (this.ui.uploadBtn) {
            this.ui.uploadBtn.addEventListener('click', () => this.ui.triggerFontUpload());
        }

        if (this.ui.fontInput) {
            this.ui.fontInput.addEventListener('change', (e) => this.handleFontUpload(e));
        }

        if (this.ui.boldBtn) {
            this.ui.boldBtn.addEventListener('click', () => {
                state.textState.isBold = !state.textState.isBold;
                this.ui.boldBtn.classList.toggle('active');
                this.generateAndEmit();
            });
        }
        if (this.ui.italicBtn) {
            this.ui.italicBtn.addEventListener('click', () => {
                state.textState.isItalic = !state.textState.isItalic;
                this.ui.italicBtn.classList.toggle('active');
                this.generateAndEmit();
            });
        }
    }

    async handleFontUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const fontName = file.name.split('.')[0];
            const buffer = await file.arrayBuffer();
            const fontFace = new FontFace(fontName, buffer);
            
            await fontFace.load();
            document.fonts.add(fontFace);

            const option = document.createElement('option');
            option.value = fontName;
            // [수정] 다국어: 접미사 (User) 처리
            option.textContent = fontName + t('suffix_user');
            option.selected = true;
            
            this.ui.fontSelect.appendChild(option);
            state.textState.fontFamily = fontName;
            
            // [수정] 다국어: 성공 메시지 ({name} 치환)
            alert(t('alert_font_uploaded', { name: fontName }));
            this.generateAndEmit();

        } catch (err) {
            console.error(err);
            // [수정] 다국어: 실패 메시지
            alert(t('alert_font_load_error'));
        }
        e.target.value = '';
    }

    generateAndEmit() {
        if (state.appMode !== 'text') {
            return;
        }

        const result = this.renderer.render(state.textState);
        if (!result) return;

        state.originalImageObject = result.canvas; 
        state.originalImageData = result.imageData;
        state.aspectRatio = result.width / result.height;
        state.resizeWidth = result.width;
        state.resizeHeight = result.height;

        eventBus.emit('IMAGE_LOADED', result.canvas);
    }
}