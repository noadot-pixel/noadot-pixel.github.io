// js/features/palette-selector/ui.js

// [수정] uplaceColors 추가 임포트
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../../data/palettes.js';
import { rgbToHex, state } from '../../state.js'; 
import { eventBus } from '../../core/EventBus.js'; 

export class PaletteSelectorUI {
    constructor() {
        this.injectStyles();

        this.geoModeRadio = document.getElementById('geopixelsMode');
        this.wplaceModeRadio = document.getElementById('wplaceMode');
        // [신규] Uplace 라디오 버튼 연결
        this.modeUplace = document.getElementById('uplaceMode');

        this.geoControls = document.getElementById('geopixels-controls');
        this.wplaceControls = document.getElementById('wplace-controls');
        this.uplaceControls = document.getElementById('uplace-controls'); // [신규] Uplace 컨트롤 연결
        this.userPaletteSection = document.getElementById('user-palette-section');

        // 타겟 컨테이너들
        this.geoPixelColorsContainer = document.getElementById('geoPixelColors');
        this.wplaceFreeColorsContainer = document.getElementById('wplaceFreeColors');
        this.wplacePaidColorsContainer = document.getElementById('wplacePaidColors');
        this.uplaceColorsList = document.getElementById('uplaceColorsList'); // [신규] Uplace 컨테이너 연결

        this.useWplaceInGeoCheckbox = document.getElementById('useWplaceInGeoMode');
        this.wplaceInGeoSection = document.getElementById('wplace-palette-in-geo');
        
        this.wplaceFreeColorsInGeoContainer = document.getElementById('wplaceFreeColorsInGeo');
        this.wplacePaidColorsInGeoContainer = document.getElementById('wplacePaidColorsInGeo');

        // 초기 렌더링 (데이터 없음)
        this.renderPalettes({});
    }

    injectStyles() {
        if (document.getElementById('palette-selector-styles')) return;
        const style = document.createElement('style');
        style.id = 'palette-selector-styles';
        style.textContent = `
            /* 5열 그리드 레이아웃 */
            .palette-grid {
                display: grid;
                grid-template-columns: repeat(5, 1fr); 
                gap: 6px; 
                padding: 5px; 
                box-sizing: border-box;
            }

            /* 색상 칩 (부모 relative 설정 필수) */
            .palette-swatch {
                position: relative; 
                width: 100%; 
                aspect-ratio: 1 / 1; 
                border-radius: 4px;
                border: 1px solid rgba(0,0,0,0.15); 
                cursor: pointer;
                transition: transform 0.1s ease;
                box-sizing: border-box;
                overflow: hidden; /* 뱃지가 둥근 모서리를 넘지 않게 */
            }
            .palette-swatch:hover { 
                transform: scale(1.08); 
                border-color: #000; 
                z-index: 5; 
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .palette-swatch.disabled {
                opacity: 0.25;
                filter: grayscale(100%);
                border: 1px dashed #aaa;
                transform: scale(0.95);
            }

            /* 전체 선택 버튼(A) */
            .palette-btn-all {
                width: 100%;
                aspect-ratio: 1 / 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background: white;
                border: 2px solid #444;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 800;
                color: #333;
                font-size: 18px;
                user-select: none;
                box-sizing: border-box;
            }
            .palette-btn-all:hover { 
                background: #f0f0f0; 
                transform: scale(1.05);
            }

            /* 픽셀 카운트 배지 (우측 하단 고정) */
            .grid-count-badge {
                position: absolute;
                bottom: 2px;
                right: 2px;
                background: rgba(0, 0, 0, 0.75);
                color: #fff;
                font-size: 9px;
                font-weight: 700;
                padding: 1px 4px;
                border-radius: 3px;
                pointer-events: none; /* 클릭 방해 금지 */
                text-shadow: 0 1px 2px black;
                line-height: 1.1;
                backdrop-filter: blur(1px);
            }
        `;
        document.head.appendChild(style);
    }

    // [수정] 모드에 따라 Uplace 화면 전환 로직 추가
    updateDisplay(mode) {
        if (mode === 'geopixels') {
            if (this.geoControls) this.geoControls.style.display = 'block';
            if (this.wplaceControls) this.wplaceControls.style.display = 'none';
            if (this.uplaceControls) this.uplaceControls.style.display = 'none';
            if (this.userPaletteSection) this.userPaletteSection.style.display = 'block';
            if (this.geoModeRadio) this.geoModeRadio.checked = true;
        } else if (mode === 'wplace') {
            if (this.geoControls) this.geoControls.style.display = 'none';
            if (this.wplaceControls) this.wplaceControls.style.display = 'block';
            if (this.uplaceControls) this.uplaceControls.style.display = 'none';
            if (this.userPaletteSection) this.userPaletteSection.style.display = 'none';
            if (this.wplaceModeRadio) this.wplaceModeRadio.checked = true;
        } else if (mode === 'uplace') {
            if (this.geoControls) this.geoControls.style.display = 'none';
            if (this.wplaceControls) this.wplaceControls.style.display = 'none';
            if (this.uplaceControls) this.uplaceControls.style.display = 'block';
            if (this.userPaletteSection) this.userPaletteSection.style.display = 'none';
            if (this.modeUplace) this.modeUplace.checked = true;
        }
    }

    toggleWplaceSubSection(show) {
        if (this.wplaceInGeoSection) {
            this.wplaceInGeoSection.style.display = show ? 'block' : 'none';
        }
    }

    // [수정] Uplace 색상을 화면에 그려주도록 추가
    renderPalettes(stats = {}) {
        if (this.geoPixelColorsContainer) this.fillContainerWithColors(this.geoPixelColorsContainer, geopixelsColors, stats);
        if (this.wplaceFreeColorsContainer) this.fillContainerWithColors(this.wplaceFreeColorsContainer, wplaceFreeColors, stats);
        if (this.wplacePaidColorsContainer) this.fillContainerWithColors(this.wplacePaidColorsContainer, wplacePaidColors, stats);
        if (this.wplaceFreeColorsInGeoContainer) this.fillContainerWithColors(this.wplaceFreeColorsInGeoContainer, wplaceFreeColors, stats);
        if (this.wplacePaidColorsInGeoContainer) this.fillContainerWithColors(this.wplacePaidColorsInGeoContainer, wplacePaidColors, stats);
        // [신규] Uplace 리스트 렌더링
        if (this.uplaceColorsList) this.fillContainerWithColors(this.uplaceColorsList, uplaceColors, stats);
    }

    fillContainerWithColors(container, colors, stats) {
        if (!container) return;
        container.innerHTML = '';
        container.classList.add('palette-grid');

        // 1. "A" 버튼 생성
        const allBtn = document.createElement('div');
        allBtn.className = 'palette-btn-all';
        allBtn.textContent = 'A';
        allBtn.title = '전체 선택/해제';
        
        const groupHexes = colors.map(c => rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]));

        allBtn.addEventListener('click', () => {
            const areAllActive = groupHexes.every(hex => !state.disabledHexes.includes(hex));

            if (areAllActive) {
                // 모두 끄기
                groupHexes.forEach(hex => {
                    if (!state.disabledHexes.includes(hex)) state.disabledHexes.push(hex);
                });
            } else {
                // 모두 켜기
                state.disabledHexes = state.disabledHexes.filter(hex => !groupHexes.includes(hex));
            }
            
            // 변경 후 즉시 갱신 (stats 유지)
            this.renderPalettes(stats); 
            eventBus.emit('PALETTE_UPDATED');
        });
        container.appendChild(allBtn);

        // 2. 색상 칩 생성
        colors.forEach(c => {
            const swatch = document.createElement('div');
            const hex = rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]);
            
            swatch.className = 'palette-swatch';
            swatch.style.backgroundColor = hex;
            swatch.title = `${c.name || 'Color'} (${hex})`;

            // 비활성 상태 체크
            if (state.disabledHexes.includes(hex)) {
                swatch.classList.add('disabled');
            }

            // 카운트 뱃지 추가
            const count = stats[hex];
            if (count && count > 0) {
                const badge = document.createElement('div');
                badge.className = 'grid-count-badge';
                // 1000 이상은 k 단위로 축약
                badge.textContent = count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count;
                swatch.appendChild(badge);
            }

            swatch.addEventListener('click', () => {
                if (state.disabledHexes.includes(hex)) {
                    state.disabledHexes = state.disabledHexes.filter(h => h !== hex);
                } else {
                    state.disabledHexes.push(hex);
                }
                
                this.renderPalettes(stats);
                eventBus.emit('PALETTE_UPDATED');
            });

            container.appendChild(swatch);
        });
    }
}