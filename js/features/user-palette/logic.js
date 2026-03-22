// js/features/user-palette/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, hexToRgb, rgbToHex, t } from '../../state.js';
import { UserPaletteUI } from './ui.js';
import { UserPaletteAlgorithms } from './algorithms.js';

export class UserPaletteFeature {
    constructor() {
        this.ui = new UserPaletteUI();
        this.algo = new UserPaletteAlgorithms();
        this.lastPixelStats = {}; 
        this.lastAnalyzedImage = null; 
        this.lastRecommendations = []; // [신규] 추천 목록 저장용 배열 추가
        
        if (!state.addedColors) state.addedColors = [];
        if (!state.paletteViewMode) state.paletteViewMode = 'list';
        
        this.initEvents();
        this.initBusListeners();
        
        this.renderUIOnly();
    }

    initBusListeners() {
        eventBus.on('IMAGE_ANALYZED', (data) => {
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

            if (Object.keys(this.lastPixelStats).length > 0) {
                totalPixels = Object.values(this.lastPixelStats).reduce((sum, count) => sum + count, 0);
            }

            if (totalPixels > 0 && state.originalImageData) {
                const fullPixels = state.originalImageData.width * state.originalImageData.height;
                state.validPixelRatio = totalPixels / fullPixels; 
                eventBus.emit('PIXEL_RATIO_UPDATED'); 
            }

            if (state.addedColors && state.addedColors.length > 0) {
                recommendations = recommendations.filter(rec => {
                    return !this.algo.isDuplicate(rec.rgb, state.addedColors);
                });
            }

            // [신규] 들어온 추천 목록을 저장해둡니다 (언어 변경 시 재사용)
            this.lastRecommendations = recommendations;

            this.ui.renderRecommendations(this.lastRecommendations, (rgb) => {
                this.addColor(rgb);
            });
            
            if (totalPixels > 0) {
                this.ui.updateTotalPixelCount(totalPixels);
            } else {
                this.ui.updateTotalPixelCount(0);
            }

            this.renderUIOnly();
            
            if (this.lastAnalyzedImage !== state.originalImageData && state.originalImageData) {
                this.lastAnalyzedImage = state.originalImageData;
                
                const sortedColors = this.algo.analyzeOriginalColors(state.originalImageData);
                const totalUniqueColors = sortedColors.length;
                
                this.ui.updateExtractSliderMax(totalUniqueColors);

                if (this.ui.extractNumberSlider) {
                    this.ui.extractNumberSlider.value = 0;
                    this.ui.updateExtractPercentDisplay(0, totalUniqueColors);
                }
            }
            
            if (this.ui.extractNumberSlider) {
                this.updateExtractWarningUI(this.ui.extractNumberSlider.value);
            }
        });

        eventBus.on('LANGUAGE_CHANGED', () => {
            this.renderUIOnly();
            
            // [신규] 언어가 바뀌면 저장해둔 추천 목록도 다시 렌더링해서 텍스트를 바꿉니다.
            if (this.lastRecommendations && this.lastRecommendations.length > 0) {
                this.ui.renderRecommendations(this.lastRecommendations, (rgb) => {
                    this.addColor(rgb);
                });
            }
        });
    }

    resetStats() {
        this.lastPixelStats = {};
        this.lastRecommendations = []; // [신규] 초기화 시 배열도 비움
        this.ui.renderRecommendations([], () => {});
        this.renderUIOnly();
    }

    updateExtractWarningUI(countStr) {
        const targetCount = parseInt(countStr, 10) || 0;
        if (!state.originalImageData) {
            this.ui.updateExtractWarning(0);
            return;
        }
        
        const sortedColors = this.algo.analyzeOriginalColors(state.originalImageData);
        const actualCount = Math.min(targetCount, sortedColors.length);
        
        let newColorCount = 0;
        const currentHexes = new Set(state.addedColors.map(c => rgbToHex(c[0], c[1], c[2]).toUpperCase()));
        
        for(let i = 0; i < actualCount; i++) {
            const hex = sortedColors[i][0];
            if (!currentHexes.has(hex)) {
                newColorCount++; 
            }
        }

        this.ui.updateExtractWarning(newColorCount);
    }

    initEvents() {
        if (this.ui.addBtn) this.ui.addBtn.addEventListener('click', () => this.handleManualAdd());
        
        if (this.ui.extractNumberSlider) {
            this.ui.extractNumberSlider.addEventListener('input', (e) => {
                this.updateExtractWarningUI(e.target.value);
            });
        }

        let currentExtractStep = 1;
        
        if (this.ui.stepBtns) {
            this.ui.stepBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.ui.stepBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    currentExtractStep = parseInt(e.target.getAttribute('data-step'), 10);
                });
            });
        }

        const adjustSlider = (amount) => {
            if (!state.originalImageData || !this.ui.extractNumberSlider) return;
            const slider = this.ui.extractNumberSlider;
            let val = parseInt(slider.value, 10);
            const max = parseInt(slider.max, 10) || 1;
            
            val += amount;
            val = Math.max(0, Math.min(max, val));
            
            slider.value = val;
            this.ui.updateExtractPercentDisplay(val, max);
            this.updateExtractWarningUI(val);
        };

        if (this.ui.minusBtn) this.ui.minusBtn.addEventListener('click', () => adjustSlider(-currentExtractStep));
        if (this.ui.plusBtn) this.ui.plusBtn.addEventListener('click', () => adjustSlider(currentExtractStep));

        if (this.ui.extractAllBtn) {
            this.ui.extractAllBtn.addEventListener('click', () => {
                if (!state.originalImageData) {
                    alert(t('alert_need_image') || "먼저 이미지를 업로드해주세요!");
                    return;
                }
                const targetCount = parseInt(this.ui.extractNumberSlider.value, 10);
                if (targetCount <= 0) return;

                const extracted = this.algo.extractTopColorsFromImage(state.originalImageData, targetCount);
                const newColors = [];
                const currentHexes = new Set(state.addedColors.map(c => rgbToHex(c[0], c[1], c[2]).toUpperCase()));
                
                extracted.forEach(rgb => {
                    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase();
                    if (!currentHexes.has(hex)) { 
                        newColors.push(rgb);
                        currentHexes.add(hex); 
                    }
                });

                if (newColors.length === 0) {
                    alert(t('alert_already_added') || "지정한 개수 내에 추가할 새로운 색상이 없습니다.");
                    return;
                }

                if (newColors.length > 300) {
                    if (!confirm(`⚠️ 렉 발생 경고 ⚠️\n\n총 ${newColors.length.toLocaleString()}개의 색상을 한 번에 추가하려고 합니다.\n브라우저가 일시적으로 멈추거나 튕길 수 있습니다.\n\n정말 계속하시겠습니까?`)) {
                        return;
                    }
                }

                state.addedColors.push(...newColors);
                this.updateStateAndUI(); 
                alert(`총 ${newColors.length.toLocaleString()}개의 색상이 성공적으로 추가되었습니다!`);
            });
        }

        if (this.ui.viewModeToggleBtn) {
            this.ui.viewModeToggleBtn.addEventListener('click', () => {
                state.paletteViewMode = state.paletteViewMode === 'tile' ? 'list' : 'tile';
                this.renderUIOnly();
            });
        }
        
        if (this.ui.sortSelect) {
            this.ui.sortSelect.addEventListener('change', (e) => {
                const mode = e.target.value;
                if (mode !== 'default') {
                    this.applySortToColors(mode);
                    e.target.value = 'default';
                }
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

    applySortToColors(mode) {
        const stats = this.lastPixelStats || {};
        
        state.addedColors.sort((a, b) => {
            const hexA = rgbToHex(a[0], a[1], a[2]);
            const hexB = rgbToHex(b[0], b[1], b[2]);
            
            if (mode === 'usage_desc') return (stats[hexB] || 0) - (stats[hexA] || 0);
            if (mode === 'usage_asc') return (stats[hexA] || 0) - (stats[hexB] || 0);
            
            if (mode === 'r_desc') return b[0] - a[0];
            if (mode === 'r_asc') return a[0] - b[0];
            
            if (mode === 'g_desc') return b[1] - a[1];
            if (mode === 'g_asc') return a[1] - b[1];
            
            if (mode === 'b_desc') return b[2] - a[2];
            if (mode === 'b_asc') return a[2] - b[2];
            
            const distA = Math.sqrt((255-a[0])**2 + (255-a[1])**2 + (255-a[2])**2);
            const distB = Math.sqrt((255-b[0])**2 + (255-b[1])**2 + (255-b[2])**2);
            
            if (mode === 'bright_desc') return distA - distB; 
            if (mode === 'bright_asc') return distB - distA; 
            
            return 0;
        });
        
        this.updateStateAndUI();
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
        const safeRgb = Array.isArray(rgb) ? [rgb[0], rgb[1], rgb[2]] : 
                        (rgb && typeof rgb === 'object' && '0' in rgb) ? [rgb[0], rgb[1], rgb[2]] : rgb;

        if (this.algo.isDuplicate(safeRgb, state.addedColors)) {
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

    updateStateAndUI() { 
        this.renderUIOnly(); 
        eventBus.emit('PALETTE_UPDATED'); 
    }

    renderUIOnly() {
        let displayList = state.addedColors.map((rgb, idx) => ({ rgb: rgb, originalIndex: idx }));
        
        this.ui.renderAddedList(
            displayList, 
            (idx) => this.removeColor(idx), 
            (rgb) => this.handleToggleColor(rgb), 
            this.lastPixelStats,
            state.paletteViewMode
        );
    }
}