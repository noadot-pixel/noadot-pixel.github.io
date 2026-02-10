import { eventBus } from '../../core/EventBus.js';
import { state, hexToRgb, rgbToHex, t } from '../../state.js';
import { UserPaletteUI } from './ui.js';
import { UserPaletteAlgorithms } from './algorithms.js';

export class UserPaletteFeature {
    constructor() {
        this.ui = new UserPaletteUI();
        this.algo = new UserPaletteAlgorithms();
        this.lastPixelStats = {}; 
        
        if (!state.addedColors) state.addedColors = [];
        
        this.initEvents();
        this.initBusListeners();
        
        this.renderUIOnly();
    }

    initBusListeners() {
        eventBus.on('IMAGE_ANALYZED', (data) => {
            console.log("[UserPalette] 데이터 수신:", data);
            let recommendations = [];
            let totalPixels = 0;
            if (Array.isArray(data)) {
                recommendations = data;
                if (data.totalPixels !== undefined) totalPixels = data.totalPixels;
            } else if (data && typeof data === 'object') {
                recommendations = data.recommendations || [];
                totalPixels = data.totalPixels || 0;
            }
            this.lastPixelStats = data.pixelStats || {}; 

            if (totalPixels > 0 && state.originalImageData) {
                const fullPixels = state.originalImageData.width * state.originalImageData.height;
                state.validPixelRatio = totalPixels / fullPixels; 
                eventBus.emit('PIXEL_RATIO_UPDATED'); 
            }

            if (state.addedColors && state.addedColors.length > 0) {
                recommendations = recommendations.filter(rec => {
                    const isAlreadyAdded = this.algo.isDuplicate(rec.rgb, state.addedColors);
                    return !isAlreadyAdded;
                });
            }

            this.ui.renderRecommendations(recommendations, (rgb) => {
                this.addColor(rgb);
            });
            
            if (totalPixels > 0) {
                this.ui.updateTotalPixelCount(totalPixels);
            }

            this.renderUIOnly();
        });
    }

    resetStats() {
        this.lastPixelStats = {};
        this.ui.renderRecommendations([], () => {});
        this.renderUIOnly();
    }

    initEvents() {
        if (this.ui.addBtn) this.ui.addBtn.addEventListener('click', () => this.handleManualAdd());
        
        // 정렬 변경 이벤트
        if (this.ui.sortSelect) {
            this.ui.sortSelect.addEventListener('change', (e) => {
                state.paletteSortMode = e.target.value;
                this.renderUIOnly(); 
            });
        }

        if (this.ui.resetBtn) {
            this.ui.resetBtn.addEventListener('click', () => {
                if (state.addedColors.length === 0) { alert(t('alert_no_color_to_reset')); return; }
                if (confirm(t('confirm_reset_colors'))) {
                    state.addedColors = [];
                    state.disabledHexes = [];
                    this.updateStateAndUI();
                }
            });
        }
        if (this.ui.hexInput) {
            this.ui.hexInput.addEventListener('input', (e) => {
                const hex = e.target.value.trim();
                if (this.algo.validateInput('hex', hex)) {
                    const rgb = hexToRgb(hex);
                    if (rgb) {
                        this.ui.rgbInputs.r.value = rgb[0];
                        this.ui.rgbInputs.g.value = rgb[1];
                        this.ui.rgbInputs.b.value = rgb[2];
                    }
                }
            });
        }
        if (this.ui.exportBtn) {
            this.ui.exportBtn.addEventListener('click', () => {
                if (state.addedColors.length === 0) { alert(t('alert_no_color_to_export')); return; }
                const dataStr = JSON.stringify(state.addedColors);
                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = "noadot_palette.json";
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            });
        }
        if (this.ui.importBtn && this.ui.fileInput) {
            this.ui.importBtn.addEventListener('click', () => this.ui.fileInput.click());
            this.ui.fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const newColors = this.algo.parseImportData(content);
                    if (newColors && newColors.length > 0) {
                        let addedCount = 0;
                        newColors.forEach(rgb => {
                            if (!this.algo.isDuplicate(rgb, state.addedColors)) { state.addedColors.push(rgb); addedCount++; }
                        });
                        if (addedCount > 0) { alert(t('alert_palette_imported', { n: addedCount })); this.updateStateAndUI(); } 
                        else { alert(t('alert_no_addcolor')); }
                    } else { alert(t('alert_long_filecode')); }
                    this.ui.fileInput.value = '';
                };
                reader.readAsText(file);
            });
        }
    }

    handleManualAdd() {
        const hexInputValue = this.ui.hexInput.value.trim();
        if (hexInputValue.length > 0) {
            const extractedColors = this.algo.extractColorsFromText(hexInputValue);
            if (extractedColors.length > 0) {
                let addedCount = 0;
                extractedColors.forEach(rgb => {
                    if (!this.algo.isDuplicate(rgb, state.addedColors)) { state.addedColors.push(rgb); addedCount++; }
                });
                if (addedCount > 0) { this.updateStateAndUI(); this.ui.clearInputs(); } else { alert(t('alert_already_added')); }
                return;
            }
        }
        const r = parseInt(this.ui.rgbInputs.r.value);
        const g = parseInt(this.ui.rgbInputs.g.value);
        const b = parseInt(this.ui.rgbInputs.b.value);
        if (this.algo.validateInput('rgb', r) && this.algo.validateInput('rgb', g) && this.algo.validateInput('rgb', b)) {
            this.addColor([r, g, b]); this.ui.clearInputs();
        } else {
            if (hexInputValue.length > 0) { alert(t('alert_invalid_color_code')); } else { alert(t('alert_input_color_value')); }
        }
    }

    addColor(rgb) {
        // [핵심 해결] 스포이드 등에서 넘어온 데이터가 Uint8ClampedArray거나 객체일 수 있으므로
        // 순수 배열 [r, g, b] 형태로 강제 변환하여 저장합니다.
        const safeRgb = Array.isArray(rgb) ? [rgb[0], rgb[1], rgb[2]] : 
                        (rgb && typeof rgb === 'object' && '0' in rgb) ? [rgb[0], rgb[1], rgb[2]] : rgb;

        if (this.algo.isDuplicate(safeRgb, state.addedColors)) {
            // 중복이지만 스포이드로 찍은거라면 알림 없이 그냥 활성화/갱신만 수행
            this.updateStateAndUI(); 
            return;
        }
        state.addedColors.push(safeRgb);
        this.updateStateAndUI();
    }

    removeColor(index) {
        const removedColor = state.addedColors[index];
        if (removedColor) {
            const hex = rgbToHex(removedColor[0], removedColor[1], removedColor[2]);
            state.disabledHexes = state.disabledHexes.filter(h => h !== hex);
        }
        state.addedColors.splice(index, 1); 
        this.updateStateAndUI();
    }

    handleToggleColor(rgb) {
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        if (state.disabledHexes.includes(hex)) { state.disabledHexes = state.disabledHexes.filter(h => h !== hex); } 
        else { state.disabledHexes.push(hex); }
        this.updateStateAndUI();
    }

    // [중요] 색상이 추가/제거될 때 이 함수가 호출되어야 화면 갱신이 일어납니다.
    updateStateAndUI() { 
        this.renderUIOnly(); 
        eventBus.emit('PALETTE_UPDATED'); 
    }

    // [New] 확장된 정렬 로직 (오름차순/내림차순 모두 지원)
    renderUIOnly() {
        let displayList = state.addedColors.map((rgb, idx) => ({ rgb: rgb, originalIndex: idx }));
        
        const mode = state.paletteSortMode || 'default';
        const stats = this.lastPixelStats || {};

        if (mode !== 'default') {
            displayList.sort((a, b) => {
                const hexA = rgbToHex(a.rgb[0], a.rgb[1], a.rgb[2]);
                const hexB = rgbToHex(b.rgb[0], b.rgb[1], b.rgb[2]);
                
                // 1. 사용량
                if (mode === 'usage_desc') return (stats[hexB] || 0) - (stats[hexA] || 0);
                if (mode === 'usage_asc') return (stats[hexA] || 0) - (stats[hexB] || 0);
                
                // 2. RGB 채널
                if (mode === 'r_desc') return b.rgb[0] - a.rgb[0];
                if (mode === 'r_asc') return a.rgb[0] - b.rgb[0];
                
                if (mode === 'g_desc') return b.rgb[1] - a.rgb[1];
                if (mode === 'g_asc') return a.rgb[1] - b.rgb[1];
                
                if (mode === 'b_desc') return b.rgb[2] - a.rgb[2];
                if (mode === 'b_asc') return a.rgb[2] - b.rgb[2];
                
                // 3. 밝기 (Euclidean distance from White)
                // White(255,255,255)와의 거리가 작을수록 밝음
                const distA = Math.sqrt((255-a.rgb[0])**2 + (255-a.rgb[1])**2 + (255-a.rgb[2])**2);
                const distB = Math.sqrt((255-b.rgb[0])**2 + (255-b.rgb[1])**2 + (255-b.rgb[2])**2);
                
                if (mode === 'bright_desc') return distA - distB; // 밝은 순 (거리가 작은 순)
                if (mode === 'bright_asc') return distB - distA; // 어두운 순 (거리가 큰 순)
                
                return 0;
            });
        }

        this.ui.renderAddedList(
            displayList, 
            (idx) => this.removeColor(idx), 
            (rgb) => this.handleToggleColor(rgb), 
            this.lastPixelStats
        );
    }
}