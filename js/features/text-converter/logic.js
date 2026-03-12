// js/features/text-converter/logic.js
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
            this.ui.algorithmSelect, 
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

        if (this.ui.uploadBtn) {
            this.ui.uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.ui.triggerFontUpload();
            });
        }

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
        reader.onload = async (e) => {
            try {
                const fontName = 'CustomFont_' + Date.now();
                const font = new FontFace(fontName, e.target.result);
                const loadedFont = await font.load();
                document.fonts.add(loadedFont);
                
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = file.name;
                option.selected = true;
                
                if (this.ui.fontSelect) {
                    this.ui.fontSelect.appendChild(option);
                    this.ui.fontSelect.value = fontName; 
                }
                
                this.triggerTextRender();
            } catch (err) {
                console.error('폰트 로드 실패:', err);
                alert('유효하지 않은 폰트 파일입니다. (TTF, OTF 등 파일 확인)');
            } finally {
                if (event.target) event.target.value = '';
            }
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
        if (bgColor === 'transparent') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const textColor = this.ui.colors.text ? this.ui.colors.text.value : '#000000';
        const strokeColor = this.ui.colors.stroke ? this.ui.colors.stroke.value : '#000000';
        
        ctx.lineWidth = strokeWidth * 2; 
        ctx.lineJoin = 'round';

        // [핵심 해결] 글자나 테두리를 '투명'으로 설정했을 때 캔버스를 뚫어버리는 지우개 모드 구현
        lines.forEach((line, index) => {
            const x = padding + (strokeWidth / 2);
            const y = padding + (index * lineHeight) + (strokeWidth / 2);

            if (strokeWidth > 0) {
                if (strokeColor === 'transparent') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.strokeStyle = '#000'; // 마스크 색상 (어떤 색이든 상관없음)
                    ctx.strokeText(line, x, y);
                    ctx.globalCompositeOperation = 'source-over'; // 모드 원상복구
                } else {
                    ctx.strokeStyle = strokeColor;
                    ctx.strokeText(line, x, y);
                }
            }
            
            if (textColor === 'transparent') {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = '#000'; // 마스크 색상
                ctx.fillText(line, x, y);
                ctx.globalCompositeOperation = 'source-over'; // 모드 원상복구
            } else {
                ctx.fillStyle = textColor;
                ctx.fillText(line, x, y);
            }
        });

        if (this.ui.algorithmSelect) {
            state.colorMethodSelect = this.ui.algorithmSelect.value; 
            const mainColorSelect = document.getElementById('colorMethodSelect');
            if (mainColorSelect) mainColorSelect.value = this.ui.algorithmSelect.value;
        }

        state.originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        eventBus.emit('TEXT_CONVERTER_UPDATED', state.originalImageData);
        eventBus.emit('OPTION_CHANGED');
    }
}