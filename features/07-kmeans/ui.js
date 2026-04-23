export class KMeansUI {
    constructor() {
        this.container = document.getElementById('kmeansResultContainer');
        this.swatchesArea = document.getElementById('kmeansSwatches');
    }

    /**
     * 추출된 RGB 색상 배열을 받아 화면에 렌더링합니다.
     * @param {Array} colors [[r,g,b], [r,g,b], ...] 형태
     */
    renderSwatches(colors) {
        if (!this.swatchesArea || !this.container) return;

        // 기존 내용 삭제
        this.swatchesArea.innerHTML = '';
        this.container.style.display = 'block';

        colors.forEach(rgb => {
            const [r, g, b] = rgb;
            const hex = this.rgbToHex(r, g, b);
            
            const chip = document.createElement('div');
            chip.className = 'color-chip'; // CSS에서 스타일 정의 필요
            chip.style.width = '24px';
            chip.style.height = '24px';
            chip.style.borderRadius = '50%';
            chip.style.backgroundColor = hex;
            chip.style.border = '2px solid var(--border-color)';
            chip.style.cursor = 'pointer';
            chip.title = hex;

            // 클릭 시 클립보드 복사 등 추가 기능을 넣을 수 있습니다.
            chip.addEventListener('click', () => {
                console.log(`선택된 색상: ${hex}`);
                // 나중에 06-palettes와 연동하여 팔레트에 추가하는 로직이 들어갈 자리입니다.
            });

            this.swatchesArea.appendChild(chip);
        });
    }

    rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }
}