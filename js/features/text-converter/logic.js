// js/features/text-converter/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../state.js';
import { TextConverterUI } from './ui.js';
import { TextRenderer } from './renderer.js';

export class TextConverterFeature {
    constructor() {
        this.ui = new TextConverterUI();
        this.renderer = new TextRenderer();
        this.renderTimeout = null; 
        this.isComposing = false;  

        this.initEvents();
    }

    initEvents() {
        const inputs = [
            this.ui.textarea, this.ui.fontSelect, this.ui.algorithmSelect, 
            ...Object.values(this.ui.sliders), ...Object.values(this.ui.colors)
        ];

        // 렌더링 모드 스위칭 감지
        if (this.ui.renderModeRadios) {
            this.ui.renderModeRadios.forEach(radio => {
                radio.addEventListener('change', () => this.triggerTextRender());
            });
        }

        if (this.ui.textarea) {
            this.ui.textarea.addEventListener('compositionstart', () => { this.isComposing = true; });
            this.ui.textarea.addEventListener('compositionend', () => { 
                this.isComposing = false;
                this.triggerTextRender(); 
            });
        }

        inputs.forEach(input => {
            if (input) input.addEventListener('input', () => { if (!this.isComposing) this.triggerTextRender(); });
        });

        if (this.ui.uploadBtn) this.ui.uploadBtn.addEventListener('click', (e) => { e.preventDefault(); this.ui.triggerFontUpload(); });
        if (this.ui.fontInput) this.ui.fontInput.addEventListener('change', (e) => this.handleFontUpload(e));
        
        [this.ui.boldBtn, this.ui.italicBtn].forEach(btn => {
            if (btn) btn.addEventListener('click', (e) => {
                const style = e.currentTarget.getAttribute('data-style');
                if (style === 'bold') state.textBold = !state.textBold;
                else state.textItalic = !state.textItalic;
                e.currentTarget.classList.toggle('active');
                this.triggerTextRender();
            });
        });

        if (this.ui.algorithmSelect) {
            this.ui.algorithmSelect.addEventListener('change', () => {
                state.colorMethodSelect = this.ui.algorithmSelect.value;
                const mainColorSelect = document.getElementById('colorMethodSelect');
                if (mainColorSelect) mainColorSelect.value = this.ui.algorithmSelect.value;
                this.triggerTextRender();
            });
        }
    }

    handleFontUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const fontName = 'CustomFont_' + Date.now();
            const font = new FontFace(fontName, e.target.result);
            const loadedFont = await font.load();
            document.fonts.add(loadedFont);
            const option = document.createElement('option');
            option.value = fontName; option.textContent = file.name; option.selected = true;
            if (this.ui.fontSelect) { this.ui.fontSelect.appendChild(option); this.ui.fontSelect.value = fontName; }
            this.triggerTextRender();
        };
        reader.readAsArrayBuffer(file);
    }

    triggerTextRender() {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.renderTextToImage(), 150); 
    }

    renderTextToImage() {
        if (!this.ui.textarea) return;
        const content = this.ui.textarea.value;
        if (!content || content.trim() === '') return;

        // UI의 상태를 모아서 renderer.js로 넘겨줍니다.
        const textState = {
            content: content,
            fontFamily: this.ui.fontSelect ? this.ui.fontSelect.value : 'Arial',
            fontSize: parseInt(this.ui.sliders.fontSize.value),
            letterSpacing: parseInt(this.ui.sliders.letterSpacing.value),
            padding: parseInt(this.ui.sliders.padding.value),
            textLineHeight: parseFloat(this.ui.sliders.textLineHeight.value) / 10,
            strokeWidth: parseInt(this.ui.sliders.strokeWidth.value),
            isBold: state.textBold,
            isItalic: state.textItalic,
            bgColor: this.ui.colors.bg.value,
            textColor: this.ui.colors.text.value,
            strokeColor: this.ui.colors.stroke.value,
            renderMode: document.querySelector('input[name="textRenderMode"]:checked')?.value || 'soft' // 신규
        };

        const result = this.renderer.render(textState);
        
        if (result && result.imageData) {
            state.originalImageData = result.imageData;
            eventBus.emit('TEXT_CONVERTER_UPDATED', state.originalImageData);
            eventBus.emit('OPTION_CHANGED');
        }
    }
}