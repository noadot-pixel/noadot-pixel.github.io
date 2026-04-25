// js/features/06-palettes/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../core/state.js'; // 🌟 번역 함수 수입!
import { PaletteSelectorUI } from './ui.js';
import { wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';

export class PaletteSelectorFeature {
    constructor() {
        this.ui = new PaletteSelectorUI();
        
        if (!state.paletteViewMode) state.paletteViewMode = 'list';
        if (!state.paletteSortMode) state.paletteSortMode = 'added';
        if (!state.addedColors) state.addedColors = [];

        this.initEvents();
        this.initBusListeners();
        this.setMode('geopixels');
        this.updatePlaceholders(); // 🌟 초기 placeholder 번역 세팅
    }

    // 🌟 동적으로 placeholder 글자 번역하기
    updatePlaceholders() {
        const addHex = document.getElementById('addHex');
        if (addHex) addHex.placeholder = t('ph_hex');
    }

    extractColorsFromMessyText(text) {
        const extracted = [];
        let processingText = text;

        // ① HEX 싹쓸이 (#이 있든 없든, 6자리 영문/숫자 추출)
        const hexRegex = /(?:#|0x)?([a-fA-F0-9]{6})\b/g;
        let match;
        while ((match = hexRegex.exec(processingText)) !== null) {
            const hex = match[1];
            extracted.push([
                parseInt(hex.substring(0, 2), 16),
                parseInt(hex.substring(2, 4), 16),
                parseInt(hex.substring(4, 6), 16)
            ]);
        }

        // HEX로 빨아들인 부분은 공백으로 지워서 아래 RGB 숫자와 안 겹치게 만듭니다.
        processingText = processingText.replace(hexRegex, ' ');

        // ② 남은 텍스트에서 숫자만 싹쓸이해서 RGB(3개 1세트)로 묶기
        const numRegex = /\d+/g;
        const nums = [];
        while ((match = numRegex.exec(processingText)) !== null) {
            nums.push(parseInt(match[0], 10));
        }

        for (let i = 0; i < nums.length - 2; i += 3) {
            // 과거 매뉴얼의 345 같은 오타를 방지하기 위해 0~255로 가둬버립니다.
            const r = Math.max(0, Math.min(255, nums[i]));
            const g = Math.max(0, Math.min(255, nums[i+1]));
            const b = Math.max(0, Math.min(255, nums[i+2]));
            extracted.push([r, g, b]);
        }

        return extracted;
    }

    initEvents() {
        const toggleAllCustomBtn = document.getElementById('toggleAllCustomBtn');
        if (toggleAllCustomBtn) {
            toggleAllCustomBtn.addEventListener('click', () => {
                if (!state.addedColors || state.addedColors.length === 0) return;

                const customHexes = state.addedColors.map(c => this.ui.rgbToHex(...c.rgb).toUpperCase());
                const allDisabled = customHexes.every(hex => state.disabledHexes.includes(hex));

                if (allDisabled) {
                    state.disabledHexes = state.disabledHexes.filter(hex => !customHexes.includes(hex));
                } else {
                    customHexes.forEach(hex => {
                        if (!state.disabledHexes.includes(hex)) state.disabledHexes.push(hex);
                    });
                }
                
                this.refresh();
                eventBus.emit('PALETTE_UPDATED');
            });
        }
        
        this.ui.paletteContainer.addEventListener('toggleAllColors', (e) => {
            const colors = e.detail; 
            const hexes = colors.map(c => this.ui.rgbToHex(...c.rgb).toUpperCase());
            
            const anyDisabled = hexes.some(hex => state.disabledHexes.includes(hex));
            if (anyDisabled) state.disabledHexes = state.disabledHexes.filter(hex => !hexes.includes(hex));
            else hexes.forEach(hex => { if (!state.disabledHexes.includes(hex)) state.disabledHexes.push(hex); });
            
            this.refresh();
            eventBus.emit('PALETTE_UPDATED'); 
        });

        this.ui.paletteContainer.addEventListener('toggleSingleColor', (e) => {
            const hex = e.detail.toUpperCase();
            if (state.disabledHexes.includes(hex)) state.disabledHexes = state.disabledHexes.filter(h => h !== hex);
            else state.disabledHexes.push(hex);
            
            this.refresh();
            eventBus.emit('PALETTE_UPDATED'); 
        });

        this.ui.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.setMode(e.target.dataset.mode));
        });

        const useWplaceCheckbox = document.getElementById('useWplaceInGeopixels');
        if (useWplaceCheckbox) {
            useWplaceCheckbox.checked = state.useWplaceInGeopixels || false;
            useWplaceCheckbox.addEventListener('change', (e) => {
                state.useWplaceInGeopixels = e.target.checked;
                this.refresh();
                eventBus.emit('PALETTE_UPDATED'); // 엔진아 다시 칠해라!
            });
        }

        const addHexInput = document.getElementById('addHex');
        if (addHexInput) {
            addHexInput.addEventListener('paste', (e) => {
                // 클립보드에서 유저가 복사한 지저분한 텍스트 원본 가져오기
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                
                // 청소기 가동!
                const colors = this.extractColorsFromMessyText(pastedText);
                
                if (colors.length > 0) {
                    e.preventDefault(); // 글자가 입력칸에 그대로 복사되는 것을 막음 (깔끔!)
                    
                    let addedCount = 0;
                    colors.forEach(rgb => {
                        const hex = this.ui.rgbToHex(...rgb).toUpperCase();
                        const exists = state.addedColors.some(c => this.ui.rgbToHex(...c.rgb).toUpperCase() === hex);
                        // 중복이 아니면 팔레트에 쏙쏙 집어넣기
                        if (!exists) {
                            state.addedColors.push({ id: Date.now() + Math.random(), rgb: rgb, count: 0 });
                            addedCount++;
                        }
                    });

                    if (addedCount > 0) {
                        console.log(`🧹 스마트 붙여넣기로 ${addedCount}개의 색상을 추가했습니다!`);
                        this.sortAndRefresh();
                        eventBus.emit('PALETTE_UPDATED');
                    }
                }
            });
        }

        const addColorBtn = document.getElementById('addColorBtn');
        if (addColorBtn) {
            addColorBtn.addEventListener('click', () => {
                const hexInput = document.getElementById('addHex').value.trim();
                let finalRgb = null;

                if (hexInput) {
                    const cleanHex = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
                    if (result) finalRgb = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
                } else {
                    const r = parseInt(document.getElementById('addR').value) || 0;
                    const g = parseInt(document.getElementById('addG').value) || 0;
                    const b = parseInt(document.getElementById('addB').value) || 0;
                    finalRgb = [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
                }

                if (finalRgb) {
                    const hex = this.ui.rgbToHex(...finalRgb);
                    const exists = state.addedColors.some(c => this.ui.rgbToHex(...c.rgb) === hex);
                    if (!exists) {
                        state.addedColors.push({ id: Date.now(), rgb: finalRgb, count: 0 });
                        
                        document.getElementById('addHex').value = '';
                        ['addR', 'addG', 'addB'].forEach(id => document.getElementById(id).value = '');
                        
                        this.sortAndRefresh();
                        eventBus.emit('PALETTE_UPDATED');
                    }
                }
            });
        }

        this.ui.customPaletteContainer.addEventListener('removeCustomColor', (e) => {
            const hexToRemove = e.detail;
            state.addedColors = state.addedColors.filter(c => this.ui.rgbToHex(...c.rgb) !== hexToRemove);
            state.disabledHexes = state.disabledHexes.filter(h => h !== hexToRemove);
            this.refresh(); 
            eventBus.emit('PALETTE_UPDATED');
        });

        const resetBtn = document.getElementById('resetAddedColorsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // 🌟 다국어 텍스트 적용!
                if (confirm(t('msg_confirm_reset_custom'))) {
                    state.addedColors = [];
                    this.refresh();
                    eventBus.emit('PALETTE_UPDATED');
                }
            });
        }

        const sortSelect = document.getElementById('paletteSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.paletteSortMode = e.target.value;
                this.sortAndRefresh();
            });
        }

        const viewListBtn = document.getElementById('viewListBtn');
        const viewGridBtn = document.getElementById('viewGridBtn');
        
        const updateViewMode = (mode) => {
            state.paletteViewMode = mode;
            if (mode === 'list') {
                viewListBtn?.classList.add('active');
                viewGridBtn?.classList.remove('active');
            } else {
                viewGridBtn?.classList.add('active');
                viewListBtn?.classList.remove('active');
            }
            this.refresh();
        };

        viewListBtn?.addEventListener('click', () => updateViewMode('list'));
        viewGridBtn?.addEventListener('click', () => updateViewMode('grid'));

        const exportBtn = document.getElementById('exportPaletteBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = JSON.stringify(state.addedColors);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `noadot-custom-palette-${Date.now()}.json`;
                a.click();
            });
        }

        const importBtn = document.getElementById('importPaletteBtn');
        const fileInput = document.getElementById('paletteUpload');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    try {
                        const parsed = JSON.parse(event.target.result);
                        if (Array.isArray(parsed)) {
                            if (parsed.length > 0 && Array.isArray(parsed[0])) {
                                state.addedColors = parsed.map((rgbArr, index) => ({
                                    id: Date.now() + index,
                                    rgb: rgbArr,
                                    count: 0
                                }));
                            } else if (parsed.length > 0 && parsed[0].rgb) {
                                state.addedColors = parsed;
                            }
                            this.sortAndRefresh();
                            eventBus.emit('PALETTE_UPDATED');
                        }
                    } catch (err) {
                        alert(t('msg_invalid_palette_json')); // 🌟 다국어 텍스트 적용!
                    }
                };
                reader.readAsText(file);
                fileInput.value = '';
            });
        }
    }

    initBusListeners() {
        // 🌟 언어가 바뀔 때마다 입력창 텍스트 새로고침
        eventBus.on('LANGUAGE_CHANGED', () => this.updatePlaceholders());

        eventBus.on('CONVERSION_COMPLETE', (payload) => {
            if (payload.stats && payload.stats.colorCounts) {
                const counts = payload.stats.colorCounts; 
                state.latestColorCounts = counts;

                state.addedColors.forEach(color => {
                    const hex = this.ui.rgbToHex(...color.rgb);
                    color.count = counts[hex] || 0;
                });

                if (state.paletteSortMode === 'count') this.sortAndRefresh();
                else this.refresh();
            }
        });

        eventBus.on('KMEANS_EXTRACTION_COMPLETE', (payload) => {
            if (!payload || !payload.colors) return;
            
            const extractedColors = payload.colors; 
            const actionType = state.pendingKmeansAction; 
            const mode = state.currentMode;

            if (actionType === 'add') {
                if (mode !== 'geopixels') {
                    alert(t('msg_custom_only_geo')); // 🌟 다국어 텍스트 적용!
                    return;
                }
                let addedCount = 0;
                extractedColors.forEach(rgb => {
                    const hex = this.ui.rgbToHex(...rgb).toUpperCase();
                    const exists = state.addedColors.some(c => this.ui.rgbToHex(...c.rgb).toUpperCase() === hex);
                    if (!exists) {
                        state.addedColors.push({ id: Date.now() + Math.random(), rgb: rgb, count: 0 });
                        addedCount++;
                    }
                });
                console.log(`[추가] ${addedCount}개의 색상이 등록되었습니다.`);
            } 
            else if (actionType === 'match') {
                let targetPalette = [];
                if (mode === 'wplace') targetPalette = [...wplaceFreeColors, ...wplacePaidColors];
                else if (mode === 'uplace') targetPalette = uplaceColors;
                else if (mode === 'geopixels') {
                    targetPalette = [...geopixelsColors, ...(state.addedColors || [])];
                    // 🌟 K-Means가 안 쓰는 색을 끌 때, Wplace 색상도 포함해서 검사하도록 추가!
                    if (state.useWplaceInGeopixels) {
                        targetPalette = [...targetPalette, ...wplaceFreeColors, ...wplacePaidColors];
                    }
                }

                const matchedHexes = new Set(); 

                extractedColors.forEach(exRgb => {
                    let minDist = Infinity;
                    let bestHex = null;
                    
                    targetPalette.forEach(pColor => {
                        const dist = Math.pow(exRgb[0]-pColor.rgb[0], 2) + Math.pow(exRgb[1]-pColor.rgb[1], 2) + Math.pow(exRgb[2]-pColor.rgb[2], 2);
                        if (dist < minDist) {
                            minDist = dist;
                            bestHex = this.ui.rgbToHex(...pColor.rgb).toUpperCase();
                        }
                    });
                    if (bestHex) matchedHexes.add(bestHex);
                });

                const allTargetHexes = targetPalette.map(c => this.ui.rgbToHex(...c.rgb).toUpperCase());
                state.disabledHexes = allTargetHexes.filter(hex => !matchedHexes.has(hex));

                console.log(`[비활성화 완료] 목표: ${extractedColors.length}색 / 실제 활성화: ${matchedHexes.size}색 유지`);
            }

            this.sortAndRefresh(); 
            this.refresh(); 
            eventBus.emit('PALETTE_UPDATED');
        });
    }

    sortAndRefresh() {
        if (!state.addedColors) return;
        const mode = state.paletteSortMode || 'added';
        
        state.addedColors.sort((a, b) => {
            if (mode === 'bright') {
                const lumA = 0.299 * a.rgb[0] + 0.587 * a.rgb[1] + 0.114 * a.rgb[2];
                const lumB = 0.299 * b.rgb[0] + 0.587 * b.rgb[1] + 0.114 * b.rgb[2];
                return lumB - lumA;
            } else if (mode === 'count') {
                return (b.count || 0) - (a.count || 0);
            } 
            else if (mode === 'r') return b.rgb[0] - a.rgb[0];
            else if (mode === 'g') return b.rgb[1] - a.rgb[1];
            else if (mode === 'b') return b.rgb[2] - a.rgb[2];
            else return (a.id || 0) - (b.id || 0);
        });

        this.refresh();
    }

    refresh() { this.ui.renderPalettes(); }

    setMode(mode) {
        state.currentMode = mode;
        this.ui.updateDisplay(mode);
        this.refresh();
        eventBus.emit('PALETTE_MODE_CHANGED', mode);
        eventBus.emit('PALETTE_UPDATED');
    }
}