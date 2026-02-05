// js/features/text-converter/renderer.js

export class TextRenderer {
    constructor() {
        this.measureCtx = document.createElement('canvas').getContext('2d');
    }

    render(textState) {
        const { 
            content, fontFamily, fontSize, isBold, isItalic, 
            letterSpacing, padding, textColor, bgColor, 
            strokeColor, strokeWidth, textLineHeight 
        } = textState;

        if (!content) return null;

        // 1. 폰트 설정
        let fontStyle = '';
        if (isItalic) fontStyle += 'italic ';
        if (isBold) fontStyle += 'bold ';
        const renderFontSize = fontSize; 
        this.measureCtx.font = `${fontStyle} ${renderFontSize}px "${fontFamily}", sans-serif`;

        // 2. 크기 및 줄 높이 계산
        const lines = content.split('\n');
        let maxWidth = 0;
        
        // 줄 높이 (기본 1.2배)
        const lineHeightPx = renderFontSize * (textLineHeight || 1.2);
        
        const lineMetrics = lines.map(line => {
            const metrics = this.measureCtx.measureText(line || ' ');
            const w = metrics.width + (Math.max(0, line.length - 1) * letterSpacing);
            maxWidth = Math.max(maxWidth, w);
            return { width: w };
        });

        // 캔버스 전체 크기
        const contentHeight = lines.length * lineHeightPx;
        const canvasWidth = Math.ceil(maxWidth + (padding * 2));
        const canvasHeight = Math.ceil(contentHeight + (padding * 2));

        // 3. 그리기
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // 배경
        ctx.fillStyle = this.toCssColor(bgColor);
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 텍스트 속성
        ctx.font = this.measureCtx.font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top'; 
        
        if (ctx.letterSpacing !== undefined) {
            ctx.letterSpacing = `${letterSpacing}px`;
        }

        let currentY = padding;
        
        // 폰트 수직 중앙 정렬 보정
        const verticalAdjustment = (lineHeightPx - renderFontSize) / 2;

        lines.forEach((line, i) => {
            const drawY = currentY + verticalAdjustment;

            // 외곽선
            if (strokeWidth > 0) {
                ctx.strokeStyle = this.toCssColor(strokeColor);
                ctx.lineWidth = strokeWidth;
                ctx.lineJoin = 'round';
                ctx.strokeText(line, padding, drawY);
            }
            // 채우기
            ctx.fillStyle = this.toCssColor(textColor);
            ctx.fillText(line, padding, drawY);

            // [수정] 다음 줄 위치 계산
            currentY += lineHeightPx;
        });

        return {
            canvas: canvas,
            imageData: ctx.getImageData(0, 0, canvasWidth, canvasHeight),
            width: canvasWidth,
            height: canvasHeight
        };
    }

    toCssColor(val) {
        if (!val) return '#000000';
        return val;
    }
}