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
                if (data.totalPixels !== undefined) {
                    totalPixels = data.totalPixels;
                }
            } else if (data && typeof data === 'object') {
                recommendations = data.recommendations || [];
                totalPixels = data.totalPixels || 0;
            }

            this.lastPixelStats = data.pixelStats || {}; 

            // [핵심 수정] 유효 픽셀 비율 저장 후 '업데이트 신호' 발송
            if (totalPixels > 0 && state.originalImageData) {
                const fullPixels = state.originalImageData.width * state.originalImageData.height;
                state.validPixelRatio = totalPixels / fullPixels; 
                console.log(`[UserPalette] 유효 픽셀 비율 저장: ${state.validPixelRatio.toFixed(4)}`);
                
                // ★ 이 신호가 있어야 리사이저가 화면을 갱신합니다!
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
            
            // (보조) 정보창 직접 업데이트 시도 (리사이저가 없을 경우 대비)
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

    // ... (이하 코드는 기존과 동일하게 유지) ...
    initEvents() {
        if (this.ui.addBtn) this.ui.addBtn.addEventListener('click', () => this.handleManualAdd());
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
        if (this.algo.isDuplicate(rgb, state.addedColors)) { alert(t('alert_already_added')); return; }
        state.addedColors.push(rgb); this.updateStateAndUI();
    }

    removeColor(index) {
        const removedColor = state.addedColors[index];
        if (removedColor) {
            const hex = rgbToHex(removedColor[0], removedColor[1], removedColor[2]);
            state.disabledHexes = state.disabledHexes.filter(h => h !== hex);
        }
        state.addedColors.splice(index, 1); this.updateStateAndUI();
    }

    handleToggleColor(rgb) {
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        if (state.disabledHexes.includes(hex)) { state.disabledHexes = state.disabledHexes.filter(h => h !== hex); } 
        else { state.disabledHexes.push(hex); }
        this.updateStateAndUI();
    }

    updateStateAndUI() { this.renderUIOnly(); eventBus.emit('PALETTE_UPDATED'); }
    renderUIOnly() { this.ui.renderAddedList(state.addedColors, (idx) => this.removeColor(idx), (rgb) => this.handleToggleColor(rgb), this.lastPixelStats); }
}