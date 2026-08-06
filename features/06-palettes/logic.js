// js/features/06-palettes/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../core/state.js'; // 🌟 번역 함수 수입!
import { PaletteSelectorUI } from './ui.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors, bplaceColors, threeplaceColors } from '../../data/palettes.js';
import { DuplicateCheckModal } from './duplicate-check-ui.js';

// 🌟 마지막으로 쓰던 팔레트 모드를 언어 설정과 같은 방식(localStorage)으로 기억합니다.
const PALETTE_MODE_STORAGE_KEY = 'noadot-palette-mode';
const VALID_PALETTE_MODES = ['geopixels', 'wplace', 'uplace', 'bplace', '3place'];

export class PaletteSelectorFeature {
    constructor() {
        this.ui = new PaletteSelectorUI();

        if (!state.paletteViewMode) state.paletteViewMode = 'list';
        if (!state.paletteSortMode) state.paletteSortMode = 'added';
        if (!state.addedColors) state.addedColors = [];

        this.initEvents();
        this.initBusListeners();

        // 🌟 [신규] 중복 색상 검사 팝업 - "최종 결정" 시 팔레트 새로고침 + 재변환 트리거
        this.dupCheckModal = new DuplicateCheckModal(() => {
            this.refresh();
            eventBus.emit('PALETTE_UPDATED');
        });

        const savedMode = localStorage.getItem(PALETTE_MODE_STORAGE_KEY);
        this.setMode(VALID_PALETTE_MODES.includes(savedMode) ? savedMode : 'geopixels');
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

        const modeSelect = document.getElementById('paletteModeSelect');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                this.setMode(e.target.value);
            });
        }

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

        // 🌟 [신규] 미사용 색상 일괄 제거 - 최근 변환 결과에서 count가 0인(=한 번도 안 쓰인) 커스텀 색만 골라냄
        const removeUnusedBtn = document.getElementById('removeUnusedColorsBtn');
        if (removeUnusedBtn) {
            removeUnusedBtn.addEventListener('click', () => {
                const unused = (state.addedColors || []).filter(c => !c.count);
                if (unused.length === 0) {
                    alert(t('msg_no_unused_colors'));
                    return;
                }
                if (!confirm(t('msg_confirm_remove_unused', { count: unused.length }))) return;

                const unusedHexes = unused.map(c => this.ui.rgbToHex(...c.rgb));
                state.addedColors = state.addedColors.filter(c => c.count);

                // 🌟 [버그 수정] 삭제되는 커스텀 색상의 HEX가 기본 제공 팔레트(geopixels/wplace/uplace/bplace) 색상과
                // 우연히 겹치는 경우, disabledHexes에서 그 HEX를 무조건 지워버리면 꺼둔 기본 팔레트 색이
                // 함께 재활성화되던 문제가 있었음. 남아있는 색(기본 팔레트 전체 + 남은 커스텀 색)이
                // 실제로 그 HEX를 더 이상 하나도 안 쓸 때만 disabledHexes에서 지운다.
                const stillExistingHexes = new Set([
                    ...geopixelsColors, ...wplaceFreeColors, ...wplacePaidColors, ...uplaceColors, ...bplaceColors, ...threeplaceColors
                ].map(c => this.ui.rgbToHex(...c.rgb)));
                state.addedColors.forEach(c => stillExistingHexes.add(this.ui.rgbToHex(...c.rgb)));

                state.disabledHexes = (state.disabledHexes || []).filter(h => !unusedHexes.includes(h) || stillExistingHexes.has(h));

                this.refresh();
                eventBus.emit('PALETTE_UPDATED');
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

        const useUplaceChk = document.getElementById('useUplaceInGeopixels');
        if (useUplaceChk) {
            useUplaceChk.checked = state.useUplaceInGeopixels || false;
            useUplaceChk.addEventListener('change', (e) => {
                state.useUplaceInGeopixels = e.target.checked;
                this.refresh();
                eventBus.emit('PALETTE_UPDATED');
            });
        }

        const useBplaceChk = document.getElementById('useBplaceInGeopixels');
        if (useBplaceChk) {
            useBplaceChk.checked = state.useBplaceInGeopixels || false;
            useBplaceChk.addEventListener('change', (e) => {
                state.useBplaceInGeopixels = e.target.checked;
                this.refresh();
                eventBus.emit('PALETTE_UPDATED');
            });
        }

        const useThreeplaceChk = document.getElementById('useThreeplaceInGeopixels');
        if (useThreeplaceChk) {
            useThreeplaceChk.checked = state.useThreeplaceInGeopixels || false;
            useThreeplaceChk.addEventListener('change', (e) => {
                state.useThreeplaceInGeopixels = e.target.checked;
                this.refresh();
                eventBus.emit('PALETTE_UPDATED');
            });
        }

        // 🌟 [신규] 자동 정렬 토글
        const chkAutoSort = document.getElementById('chkAutoSort');
        if (chkAutoSort) {
            chkAutoSort.checked = state.autoSortCustom || false;
            chkAutoSort.addEventListener('change', (e) => {
                state.autoSortCustom = e.target.checked;
                this.sortAndRefresh(); // 이제 sortAndRefresh() 안에서 refresh()까지 함께 처리됨
            });
        }

    }

    initBusListeners() {

        // 🌟 [신규] .you 파일 업로드처럼, 다른 기능이 팔레트 모드를 강제로 전환해야 할 때 사용
        eventBus.on('FORCE_PALETTE_MODE', (mode) => {
            if (VALID_PALETTE_MODES.includes(mode)) this.setMode(mode);
        });

        eventBus.on('LANGUAGE_CHANGED', () => {
            this.updatePlaceholders();
            this.refresh();
        });
        
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

        // 🌟 [정리] add/match 실제 처리는 07-kmeans/logic.js가 this.pendingTask로 담당함.
        // 여기서는 절대 설정되지 않는 state.pendingKmeansAction을 검사하는 죽은 분기가 있었어서 제거하고,
        // kmeans 쪽이 state.addedColors/disabledHexes를 바꾼 뒤 화면만 새로고침.
        eventBus.on('KMEANS_EXTRACTION_COMPLETE', (payload) => {
            if (!payload || !payload.colors) return;

            this.sortAndRefresh(); // sortAndRefresh()가 refresh()까지 함께 처리
            eventBus.emit('PALETTE_UPDATED');
        });
    }

    sortAndRefresh() {
        if (!state.addedColors) return;
        const mode = state.paletteSortMode || 'added';
        
        state.addedColors.sort((a, b) => {
            // 🌟 [자동 정렬 ON] 비활성화된 색상은 무슨 일이 있어도 최하단으로 유배 보냅니다!
            if (state.autoSortCustom) {
                const aHex = this.ui.rgbToHex(...a.rgb).toUpperCase();
                const bHex = this.ui.rgbToHex(...b.rgb).toUpperCase();
                const aDisabled = state.disabledHexes?.includes(aHex) ? 1 : 0;
                const bDisabled = state.disabledHexes?.includes(bHex) ? 1 : 0;

                // 둘의 활성화 상태가 다르면, 비활성화(1)된 녀석을 뒤로 보냄
                if (aDisabled !== bDisabled) {
                    return aDisabled - bDisabled; 
                }
            }

            // 활성화 상태가 같으면 유저가 선택한 정렬 방식에 따름
            if (mode === 'bright') {
                const lumA = 0.299 * a.rgb[0] + 0.587 * a.rgb[1] + 0.114 * a.rgb[2];
                const lumB = 0.299 * b.rgb[0] + 0.587 * b.rgb[1] + 0.114 * b.rgb[2];
                return lumB - lumA;
            } else if (mode === 'count') {
                return (b.count || 0) - (a.count || 0);
            } else if (mode === 'r') return b.rgb[0] - a.rgb[0];
            else if (mode === 'g') return b.rgb[1] - a.rgb[1];
            else if (mode === 'b') return b.rgb[2] - a.rgb[2];
            else {
                // 'added' (추가순) 일 때는 고유 ID를 비교해서 원본 순서를 유지합니다.
                return a.id - b.id;
            }
        });

        // 🌟 [버그 수정] 이름과 달리 정렬만 하고 화면을 갱신하지 않아서, 색상 추가/정렬 변경/
        // 팔레트 불러오기 직후 화면에 즉시 반영되지 않던 문제를 고쳤습니다.
        this.refresh();
    }

    refresh() { this.ui.renderPalettes(); }

    setMode(mode) {
        state.currentMode = mode;
        localStorage.setItem(PALETTE_MODE_STORAGE_KEY, mode);
        this.ui.updateDisplay(mode);
        this.refresh();
        eventBus.emit('PALETTE_MODE_CHANGED', mode);
        eventBus.emit('PALETTE_UPDATED');
    }
}