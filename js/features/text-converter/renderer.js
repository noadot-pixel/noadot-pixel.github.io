// js/features/text-converter/renderer.js

export class TextRenderer {
    constructor() {
        this.measureCtx = document.createElement('canvas').getContext('2d');
    }

    render(textState) {
        const { 
            content, fontFamily, fontSize, isBold, isItalic, 
            letterSpacing, padding, textColor, bgColor, 
            strokeColor, strokeWidth, textLineHeight, renderMode 
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
        
        const lineHeightPx = renderFontSize * (textLineHeight || 1.2);
        
        const lineMetrics = lines.map(line => {
            const metrics = this.measureCtx.measureText(line || ' ');
            const w = metrics.width + (Math.max(0, line.length - 1) * letterSpacing);
            maxWidth = Math.max(maxWidth, w);
            return { width: w };
        });

        const contentHeight = lines.length * lineHeightPx;
        const canvasWidth = Math.ceil(maxWidth + (padding * 2));
        const canvasHeight = Math.ceil(contentHeight + (padding * 2));

        // 3. 그리기
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // 배경 처리
        if (bgColor === 'transparent') {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        } else {
            ctx.fillStyle = this.toCssColor(bgColor);
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        // 텍스트 속성
        ctx.font = this.measureCtx.font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top'; 
        
        if (ctx.letterSpacing !== undefined) {
            ctx.letterSpacing = `${letterSpacing}px`;
        }

        let currentY = padding;
        const verticalAdjustment = (lineHeightPx - renderFontSize) / 2;

        lines.forEach((line, i) => {
            const drawY = currentY + verticalAdjustment;

            // 외곽선
            if (strokeWidth > 0) {
                ctx.strokeStyle = this.toCssColor(strokeColor === 'transparent' ? '#000000' : strokeColor);
                ctx.lineWidth = strokeWidth;
                ctx.lineJoin = 'round';
                if (strokeColor === 'transparent') ctx.globalCompositeOperation = 'destination-out';
                ctx.strokeText(line, padding, drawY);
                ctx.globalCompositeOperation = 'source-over';
            }
            
            // 채우기
            ctx.fillStyle = this.toCssColor(textColor === 'transparent' ? '#000000' : textColor);
            if (textColor === 'transparent') ctx.globalCompositeOperation = 'destination-out';
            ctx.fillText(line, padding, drawY);
            ctx.globalCompositeOperation = 'source-over';

            currentY += lineHeightPx;
        });

        // 4. [수정됨] 텍스트 렌더링 모드 후처리 (임계값 분리 적용)
        const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            
            if (renderMode === 'sharp') {
                // 날카롭게: 투명도가 50%(알파 128) 미만이면 제거, 이상이면 불투명화 (가장 픽셀아트 다운 거친 외곽선)
                if (a < 128) {
                    data[i + 3] = 0;
                } else {
                    data[i + 3] = 255;
                }
            } else {
                // 부드럽게 (유저 제안 1번 방식): 투명도가 90% 이상(알파 25 이하)인 잉여 픽셀만 날리고 나머지는 색을 채워 부드러운 형태 보존
                if (a <= 25) {
                    data[i + 3] = 0;
                } else {
                    data[i + 3] = 255;
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);

        return {
            canvas: canvas,
            imageData: imgData,
            width: canvasWidth,
            height: canvasHeight
        };
    }

    toCssColor(val) {
        if (!val) return '#000000';
        return val;
    }
}