import { state, t, rgbToHex, getTextColorForBg } from '../../core/state.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors, bplaceColors } from '../../data/palettes.js'; // bplaceColors 추가!

export class PaletteSelectorUI {
    constructor() {
        this.paletteContainer = document.getElementById('palette-container');
        this.modeSelect = document.getElementById('paletteModeSelect');
        this.customPaletteContainer = document.getElementById('custom-palette-container');
    }

    updateDisplay(mode) {
        // 1. 드롭다운 값 동기화
        if (this.modeSelect) {
            this.modeSelect.value = mode;
        }
        
        // 2. 타 플랫폼(Wplace, Uplace, Bplace) 병합 체크박스 영역 노출 제어
        const wplaceSection = document.getElementById('wplace-inclusion-section');
        if (wplaceSection) {
            wplaceSection.style.display = (mode === 'geopixels') ? 'flex' : 'none';
        }

        // 🌟 3. [신규 추가] 커스텀 팔레트 영역 노출 제어 (GeoPixels 모드에서만 켜짐!)
        const customSection = document.getElementById('custom-section');
        if (customSection) {
            customSection.style.display = (mode === 'geopixels') ? 'block' : 'none';
        }
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
        this.paletteContainer.style.gridTemplateColumns = 'repeat(6, 1fr)';
        this.paletteContainer.style.gap = '5px';

        // ==========================================
        // 🌟 [그룹화 설계] 플랫폼 및 상품 등급별 분리 배정
        // ==========================================
        let groups = [];
        let colorsToRender = [];

        if (mode === 'geopixels') {
            groups.push({ label: 'GeoPixels', colors: geopixelsColors });
            colorsToRender = [...geopixelsColors];
            if (state.useWplaceInGeopixels) {
                groups.push({ label: t('palette_wplace_free') || 'Wplace 기본색', colors: wplaceFreeColors });
                groups.push({ label: t('palette_wplace_paid') || 'Wplace 유료색', colors: wplacePaidColors });
                colorsToRender = [...colorsToRender, ...wplaceFreeColors, ...wplacePaidColors];
            }

            if (state.useUplaceInGeopixels) {
                groups.push({ label: 'Uplace', colors: uplaceColors });
                colorsToRender = [...colorsToRender, ...uplaceColors];
            }

        } else if (mode === 'wplace') {
            // 🌟 t('번역 키값')을 사용해 언어 설정에 맞게 글자가 출력되게 합니다.
            groups.push({ label: t('palette_wplace_free') || 'Wplace 기본색', colors: wplaceFreeColors });
            groups.push({ label: t('palette_wplace_paid') || 'Wplace 유료색', colors: wplacePaidColors });
            colorsToRender = [...wplaceFreeColors, ...wplacePaidColors];
        } else if (mode === 'uplace') {
            groups.push({ label: t('palette_uplace') || 'Uplace', colors: uplaceColors });
            colorsToRender = [...uplaceColors];
        } else if (mode === 'bplace') {
            groups.push({ label: t('palette_bplace') || 'Bplace', colors: bplaceColors });
            colorsToRender = [...bplaceColors];
        } else if (mode === 'geopixels') {
            groups.push({ label: 'GeoPixels', colors: geopixelsColors });
            colorsToRender = [...geopixelsColors];
            
            if (state.useWplaceInGeopixels) {
                groups.push({ label: t('palette_wplace_free') || 'Wplace 기본색', colors: wplaceFreeColors });
                groups.push({ label: t('palette_wplace_paid') || 'Wplace 유료색', colors: wplacePaidColors });
                colorsToRender = [...colorsToRender, ...wplaceFreeColors, ...wplacePaidColors];
            }
            if (state.useUplaceInGeopixels) {
                groups.push({ label: t('palette_uplace') || 'Uplace', colors: uplaceColors });
                colorsToRender = [...colorsToRender, ...uplaceColors];
            }
            if (state.useBplaceInGeopixels) {
                groups.push({ label: t('palette_bplace') || 'Bplace', colors: bplaceColors });
                colorsToRender = [...colorsToRender, ...bplaceColors];
            }
        }

        const globalCounts = state.latestColorCounts || {};

        groups.forEach(group => {
            // 섹션이 쪼개져 있거나 Wplace 모드 단독일 때 서브 타이틀 증명 바 삽입
            if (groups.length > 1 || mode === 'wplace') {
                const titleEl = document.createElement('div');
                titleEl.className = 'palette-group-title';
                titleEl.textContent = group.label;
                this.paletteContainer.appendChild(titleEl);
            }

            // ==========================================
            // 🌟 [신규] 각 그룹별 전용 'A (전체 선택/해제)' 버튼 생성!
            // ==========================================
            const groupAllBtn = document.createElement('button');
            groupAllBtn.className = 'color-btn'; // 기존 네모난 버튼 스타일 상속
            groupAllBtn.textContent = 'A';
            
            // 해당 그룹 내에 하나라도 꺼져있는 색이 있는지 확인
            const groupHexes = group.colors.map(c => this.rgbToHex(...c.rgb).toUpperCase());
            const hasDisabled = groupHexes.some(hex => state.disabledHexes?.includes(hex));
            
            Object.assign(groupAllBtn.style, {
                backgroundColor: hasDisabled ? '#444' : '#fff',
                color: hasDisabled ? '#fff' : '#111',
                fontWeight: '900',
                border: '2px solid var(--accent-primary)',
            });

            groupAllBtn.addEventListener('click', () => {
                // 클릭 시 전체 색상이 아니라 '해당 그룹의 색상들(group.colors)'만 전달하여 토글!
                this.paletteContainer.dispatchEvent(new CustomEvent('toggleAllColors', { detail: group.colors }));
            });
            this.paletteContainer.appendChild(groupAllBtn);

            // ==========================================
            // 개별 색상 버튼 생성
            // ==========================================
            group.colors.forEach(colorObj => {
                const btn = document.createElement('button');
                const hex = this.rgbToHex(...colorObj.rgb);
                const isDisabled = state.disabledHexes?.includes(hex);
                const textColor = this.getContrastYIQ(...colorObj.rgb);

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
                    btn.innerHTML = '';
                } else {
                    btn.style.opacity = '1';
                    btn.style.filter = 'none';
                    const checkMark = `<span style="font-size: 1.0em; font-weight: bold;">✓</span>`;
                    const countBadge = count > 0 ? `<span style="position:absolute; bottom:1px; right:2px; color:${textColor}; font-size:0.65em; font-weight:900; letter-spacing:-0.5px; text-shadow: 0px 0px 2px rgba(255,255,255,0.8), 0px 0px 2px rgba(0,0,0,0.8);">${countText}</span>` : '';
                    
                    btn.innerHTML = checkMark + countBadge;
                }

                btn.addEventListener('click', () => {
                    this.paletteContainer.dispatchEvent(new CustomEvent('toggleSingleColor', { detail: hex }));
                });
                this.paletteContainer.appendChild(btn);
            });
        });
    }

    // 2. 커스텀 팔레트 렌더링
    renderCustomPalettes() {
        const customSection = document.getElementById('custom-section'); 
        
        if (customSection) {
            customSection.style.display = (state.currentMode === 'geopixels') ? 'block' : 'none';
        }
        
        if (!this.customPaletteContainer || state.currentMode !== 'geopixels') return;
        
        if (!this.customPaletteContainer) return;
        
        // 🌟 [신규] 수량 표기 업데이트
        const countSpan = document.getElementById('customColorCount');
        if (countSpan) {
            countSpan.textContent = `[${state.addedColors ? state.addedColors.length : 0}]`;
        }

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

    // 🌟 [정리] core/state.js의 공용 유틸을 그대로 위임 (여러 파일에 중복 구현되어 있던 것을 통합)
    rgbToHex(r, g, b) {
        return rgbToHex(r, g, b);
    }

    getContrastYIQ(r, g, b) {
        return getTextColorForBg([r, g, b]);
    }
}