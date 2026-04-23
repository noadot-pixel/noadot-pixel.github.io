import { state } from '../../core/state.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';

export class PaletteSelectorUI {
    constructor() {
        this.paletteContainer = document.getElementById('palette-container');
        this.modeButtons = document.querySelectorAll('.palette-mode-selector button');
        this.customPaletteContainer = document.getElementById('custom-palette-container');
    }

    updateDisplay(mode) {
        this.modeButtons.forEach(btn => {
            if (btn.dataset.mode === mode) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    renderPalettes() {
        this.renderBasePalettes();
        this.renderCustomPalettes();
    }

    // 1. 상단의 기본 팔레트 렌더링
    renderBasePalettes() {
        if (!this.paletteContainer) return;
        const mode = state.currentMode;
        
        this.paletteContainer.innerHTML = '';
        this.paletteContainer.style.display = 'grid';
        // 🌟 1. 6열 배치(6*n)로 넓게 변경!
        this.paletteContainer.style.gridTemplateColumns = 'repeat(6, 1fr)';
        this.paletteContainer.style.gap = '5px';

        let colorsToRender = [];
        if (mode === 'geopixels') colorsToRender = geopixelsColors;
        else if (mode === 'wplace') colorsToRender = [...wplaceFreeColors, ...wplacePaidColors];
        else if (mode === 'uplace') colorsToRender = uplaceColors;

        const allBtn = document.createElement('button');
        allBtn.className = 'color-btn';
        allBtn.textContent = 'ALL';
        const hasDisabled = colorsToRender.some(c => state.disabledHexes?.includes(this.rgbToHex(...c.rgb)));
        
        Object.assign(allBtn.style, {
            backgroundColor: hasDisabled ? '#444' : '#fff',
            color: hasDisabled ? '#fff' : '#111',
            fontWeight: '900',
            border: '2px solid var(--accent-primary)',
        });

        allBtn.addEventListener('click', () => {
            this.paletteContainer.dispatchEvent(new CustomEvent('toggleAllColors', { detail: colorsToRender }));
        });
        this.paletteContainer.appendChild(allBtn);

        const globalCounts = state.latestColorCounts || {};

        colorsToRender.forEach(colorObj => {
            const btn = document.createElement('button');
            const hex = this.rgbToHex(...colorObj.rgb);
            const isDisabled = state.disabledHexes?.includes(hex);
            const textColor = this.getContrastYIQ(...colorObj.rgb); // 🌟 글자색 자동 계산

            const count = globalCounts[hex] || 0;
            const countText = count > 0 ? (count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count) : '';

            btn.className = 'color-btn';
            btn.style.backgroundColor = hex;
            btn.style.color = textColor;
            btn.style.position = 'relative';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            
            if (isDisabled) {
                btn.style.opacity = '0.2';
                btn.style.filter = 'grayscale(80%)';
                btn.innerHTML = ''; // 꺼지면 V 표시 제거
            } else {
                btn.style.opacity = '1';
                btn.style.filter = 'none';
                // 🌟 2. 켜져 있으면 중앙에 V 표시!
                const checkMark = `<span style="font-size: 1.0em; font-weight: bold;">✓</span>`;
                const countBadge = count > 0 ? `<span style="position:absolute; bottom:1px; right:2px; color:${textColor}; font-size:0.65em; font-weight:900; letter-spacing:-0.5px; text-shadow: 0px 0px 2px rgba(255,255,255,0.8), 0px 0px 2px rgba(0,0,0,0.8);">${countText}</span>` : '';
                
                btn.innerHTML = checkMark + countBadge;
            }

            btn.addEventListener('click', () => {
                this.paletteContainer.dispatchEvent(new CustomEvent('toggleSingleColor', { detail: hex }));
            });
            this.paletteContainer.appendChild(btn);
        });
    }

    // 2. 커스텀 팔레트 렌더링
    renderCustomPalettes() {
        const customSection = document.getElementById('custom-section'); 
        
        if (customSection) {
            customSection.style.display = (state.currentMode === 'geopixels') ? 'block' : 'none';
        }
        
        if (!this.customPaletteContainer || state.currentMode !== 'geopixels') return;
        
        this.customPaletteContainer.innerHTML = '';
        const viewMode = state.paletteViewMode || 'list';
        const customColors = state.addedColors || [];

        if (viewMode === 'list') {
            this.customPaletteContainer.style.display = 'flex';
            this.customPaletteContainer.style.flexDirection = 'column';
            this.customPaletteContainer.style.gap = '6px';
        } else {
            this.customPaletteContainer.style.display = 'grid';
            // 🌟 1. 커스텀 그리드도 6열(6*n) 배치로 변경!
            this.customPaletteContainer.style.gridTemplateColumns = 'repeat(6, 1fr)'; 
            this.customPaletteContainer.style.gap = '5px';
        }
        
        customColors.forEach(colorObj => {
            const hex = this.rgbToHex(...colorObj.rgb);
            const rgbText = `(${colorObj.rgb.join(',')})`;
            const count = colorObj.count || 0;
            const isDisabled = state.disabledHexes?.includes(hex);
            
            // 🌟 3. 사용량 포맷 변환 (예: 1200 -> 1.2k)
            const countText = count > 0 ? (count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count) : '';
            const textColor = this.getContrastYIQ(...colorObj.rgb);

            if (viewMode === 'list') {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex', alignItems: 'center', padding: '6px 10px',
                    backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', gap: '10px'
                });

                if (isDisabled) {
                    row.style.opacity = '0.4';
                    row.style.filter = 'grayscale(80%)';
                }

                const smallCheck = !isDisabled ? `<span style="color:${textColor}; font-size:14px; font-weight:bold;">✓</span>` : '';

                row.innerHTML = `
                    <div style="width:28px; height:28px; border-radius:4px; border:1px solid rgba(0,0,0,0.1); background:${hex}; cursor:pointer; display:flex; align-items:center; justify-content:center;" class="toggle-click">
                        ${smallCheck}
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; line-height:1.2; cursor:pointer;" class="toggle-click">
                        <span style="font-weight:bold; font-size:0.95em;">${hex}</span>
                        <span style="font-size:0.75em; color:var(--text-secondary);">${rgbText}</span>
                    </div>
                    <div style="font-size:0.8em; color:var(--accent-primary); background:var(--bg-surface); padding:2px 6px; border-radius:10px;">
                        ${count}px
                    </div>
                    <button class="remove-btn" style="color:#e74c3c; background:none; border:1px solid #e74c3c; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold;">
                        -
                    </button>
                `;

                row.querySelectorAll('.toggle-click').forEach(el => {
                    el.addEventListener('click', () => {
                        this.paletteContainer.dispatchEvent(new CustomEvent('toggleSingleColor', { detail: hex }));
                    });
                });

                row.querySelector('.remove-btn').addEventListener('click', () => {
                    this.customPaletteContainer.dispatchEvent(new CustomEvent('removeCustomColor', { detail: hex }));
                });

                this.customPaletteContainer.appendChild(row);

            } else {
                // [타일(그리드) 뷰]
                const card = document.createElement('div');
                Object.assign(card.style, {
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    border: '1px solid var(--border-color)', borderRadius: '6px',
                    padding: '4px', backgroundColor: 'var(--bg-color)', gap: '2px',
                    minWidth: '0', overflow: 'hidden' 
                });

                if (isDisabled) {
                    card.style.opacity = '0.3';
                    card.style.filter = 'grayscale(80%)';
                }

                // 🌟 중앙 V 체크와 우측 하단 사용량(1.2k) 배지 삽입
                const checkMark = !isDisabled ? `<span style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:${textColor}; font-size:1.3em; font-weight:bold;">✓</span>` : '';
                const countBadge = count > 0 ? `<span style="position:absolute; bottom:2px; right:4px; color:${textColor}; font-size:0.75em; font-weight:900; text-shadow: 0px 0px 3px rgba(255,255,255,0.8), 0px 0px 3px rgba(0,0,0,0.8);">${countText}</span>` : '';

                card.innerHTML = `
                    <div class="toggle-click" style="position:relative; width: 100%; aspect-ratio: 1 / 1; background: ${hex}; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); cursor: pointer;">
                        ${checkMark}
                        ${countBadge}
                    </div>
                    <span style="width: 100%; font-size: 0.65em; font-weight: bold; margin-top: 4px; letter-spacing: -0.5px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${hex}</span>
                    <span style="width: 100%; font-size: 0.55em; color: var(--text-secondary); letter-spacing: -0.5px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rgbText}</span>
                `;

                card.querySelector('.toggle-click').addEventListener('click', () => {
                    this.paletteContainer.dispatchEvent(new CustomEvent('toggleSingleColor', { detail: hex }));
                });
                card.addEventListener('contextmenu', (e) => {
                    e.preventDefault(); 
                    this.customPaletteContainer.dispatchEvent(new CustomEvent('removeCustomColor', { detail: hex }));
                });

                this.customPaletteContainer.appendChild(card);
            }
        });
    }

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    // 🌟 배경색 밝기에 따라 글자색을 흑/백으로 결정해주는 도우미 함수
    getContrastYIQ(r, g, b) {
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }
}