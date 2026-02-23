import { eventBus } from '../../core/EventBus.js';
import { state } from '../../state.js';
import { TextConverterUI } from './ui.js';

export class TextConverterFeature {
    constructor() {
        this.ui = new TextConverterUI();
        this.renderTimeout = null; 
        this.isComposing = false;  

        this.initEvents();
    }

    initEvents() {
        const inputs = [
            this.ui.textarea, 
            this.ui.fontSelect, 
            this.ui.sliders.fontSize,
            this.ui.sliders.letterSpacing, 
            this.ui.sliders.padding, 
            this.ui.sliders.textLineHeight, 
            this.ui.sliders.strokeWidth,
            this.ui.colors.text, 
            this.ui.colors.bg, 
            this.ui.colors.stroke
        ];

        if (this.ui.textarea) {
            this.ui.textarea.addEventListener('compositionstart', () => { this.isComposing = true; });
            this.ui.textarea.addEventListener('compositionend', () => { 
                this.isComposing = false;
                this.triggerTextRender(); 
            });
        }

        inputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    if (!this.isComposing) {
                        this.triggerTextRender();
                    }
                });
            }
        });

        if (this.ui.fontInput) {
            this.ui.fontInput.addEventListener('change', (e) => this.handleFontUpload(e));
        }

        if (this.ui.boldBtn) {
            this.ui.boldBtn.addEventListener('click', (e) => {
                state.textBold = !state.textBold;
                e.currentTarget.classList.toggle('active');
                this.triggerTextRender();
            });
        }

        if (this.ui.italicBtn) {
            this.ui.italicBtn.addEventListener('click', (e) => {
                state.textItalic = !state.textItalic;
                e.currentTarget.classList.toggle('active');
                this.triggerTextRender();
            });
        }
    }

    handleFontUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const fontName = 'CustomFont_' + Date.now();
            const font = new FontFace(fontName, e.target.result);
            font.load().then((loadedFont) => {
                document.fonts.add(loadedFont);
                
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = file.name;
                option.selected = true;
                if (this.ui.fontSelect) this.ui.fontSelect.appendChild(option);
                
                this.triggerTextRender();
            }).catch(err => {
                console.error('폰트 로드 실패:', err);
                alert('유효하지 않은 폰트 파일입니다.');
            });
        };
        reader.readAsArrayBuffer(file);
    }

    triggerTextRender() {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => {
            this.renderTextToImage();
        }, 150); 
    }

    renderTextToImage() {
        if (!this.ui.textarea) return;
        const text = this.ui.textarea.value;
        if (!text || text.trim() === '') return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const fontFamily = this.ui.fontSelect ? this.ui.fontSelect.value : 'Arial';
        const fontSize = this.ui.sliders.fontSize ? parseInt(this.ui.sliders.fontSize.value) : 15;
        const letterSpacing = this.ui.sliders.letterSpacing ? parseInt(this.ui.sliders.letterSpacing.value) : 0;
        const padding = this.ui.sliders.padding ? parseInt(this.ui.sliders.padding.value) : 10;
        const lineHeightValue = this.ui.sliders.textLineHeight ? parseFloat(this.ui.sliders.textLineHeight.value) / 10 : 1.5;
        const strokeWidth = this.ui.sliders.strokeWidth ? parseInt(this.ui.sliders.strokeWidth.value) : 0;
        
        const isBold = state.textBold ? 'bold' : 'normal';
        const isItalic = state.textItalic ? 'italic' : 'normal';
        const fontStyleString = `${isItalic} ${isBold} ${fontSize}px "${fontFamily}"`;

        ctx.font = fontStyleString;
        if ('letterSpacing' in ctx) {
            ctx.letterSpacing = `${letterSpacing}px`;
        }

        const lines = text.split('\n');
        let maxWidth = 0;
        const lineHeight = fontSize * lineHeightValue;

        lines.forEach(line => {
            const metrics = ctx.measureText(line);
            if (metrics.width > maxWidth) maxWidth = metrics.width;
        });

        if (!('letterSpacing' in ctx) && letterSpacing !== 0) {
            maxWidth += (lines[0].length * letterSpacing);
        }

        canvas.width = Math.ceil(maxWidth + (padding * 2) + strokeWidth);
        canvas.height = Math.ceil((lines.length * lineHeight) + (padding * 2) + strokeWidth);

        ctx.font = fontStyleString;
        ctx.textBaseline = 'top';
        if ('letterSpacing' in ctx) {
            ctx.letterSpacing = `${letterSpacing}px`;
        }

        const bgColor = this.ui.colors.bg ? this.ui.colors.bg.value : '#FFFFFF';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = this.ui.colors.text ? this.ui.colors.text.value : '#000000';
        ctx.strokeStyle = this.ui.colors.stroke ? this.ui.colors.stroke.value : '#000000';
        ctx.lineWidth = strokeWidth * 2; 
        ctx.lineJoin = 'round';

        lines.forEach((line, index) => {
            const x = padding + (strokeWidth / 2);
            const y = padding + (index * lineHeight) + (strokeWidth / 2);

            if (strokeWidth > 0) {
                ctx.strokeText(line, x, y);
            }
            ctx.fillText(line, x, y);
        });

        state.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        state.resizeWidth = canvas.width;
        state.resizeHeight = canvas.height;
        const widthInput = document.getElementById('scaleWidth');
        const heightInput = document.getElementById('scaleHeight');
        if (widthInput) widthInput.value = canvas.width;
        if (heightInput) heightInput.value = canvas.height;

        // [에러 해결 핵심] 이미지 데이터를 페이로드로 함께 전달!
        eventBus.emit('IMAGE_LOADED', state.originalImageData);
    }
}