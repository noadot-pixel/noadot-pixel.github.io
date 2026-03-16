// js/features/user-palette/ui.js
import { rgbToHex, state, t } from '../../state.js';

export class UserPaletteUI {
    constructor() {
        this.recommendationContainer = document.getElementById('recommendation-report-container');
        this.recommendationPlaceholder = document.getElementById('recommendedColorsPlaceholder');
        this.addedColorsContainer = document.getElementById('addedColors');
        
        this.initExtractControl();
        this.initSortControl();

        this.hexInput = document.getElementById('addHex');
        if (this.hexInput) {
            this.hexInput.setAttribute('data-lang-placeholder', 'placeholder_hex');
            this.hexInput.placeholder = t('placeholder_hex') || "HEX 코드 입력 (예: #FFFFFF)";
        }

        this.rgbInputs = {
            r: document.getElementById('addR'),
            g: document.getElementById('addG'),
            b: document.getElementById('addB')
        };
        
        this.addBtn = document.getElementById('addColorBtn');
        this.resetBtn = document.getElementById('resetAddedColorsBtn');
        this.exportBtn = document.getElementById('exportPaletteBtn');
        this.importBtn = document.getElementById('importPaletteBtn');
        this.fileInput = document.getElementById('paletteUpload');
        
        this.totalPixelDisplay = document.getElementById('totalPixelCount');
    }

    initExtractControl() {
        this.extractNumberSlider = document.getElementById('extractNumberSlider');
        // [핵심 변경] id를 extractPercentValue로 연결합니다.
        this.extractPercentValue = document.getElementById('extractPercentValue'); 
        this.extractAllBtn = document.getElementById('extractAllColorsBtn');
        this.extractWarningBox = document.getElementById('extractWarningBox');
        
        this.stepBtns = document.querySelectorAll('.step-btn');
        this.minusBtn = document.getElementById('extractMinusBtn');
        this.plusBtn = document.getElementById('extractPlusBtn');

        const toggleCheckbox = document.getElementById('toggleExtractCheckbox');
        const panel = document.getElementById('extractControlPanel');

        if (toggleCheckbox && panel) {
            toggleCheckbox.addEventListener('change', (e) => {
                panel.style.display = e.target.checked ? 'flex' : 'none';
            });
        }

        if (this.extractNumberSlider && this.extractPercentValue) {
            this.extractNumberSlider.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10);
                const max = parseInt(e.target.max, 10) || 1;
                this.updateExtractPercentDisplay(val, max);
            });
        }
        
        if (this.extractAllBtn) {
            this.extractAllBtn.onmousedown = () => this.extractAllBtn.style.transform = 'scale(0.95)';
            this.extractAllBtn.onmouseup = () => this.extractAllBtn.style.transform = 'scale(1)';
        }
    }

    // [신규] 값과 최대값을 받아 %를 계산해 화면에 뿌려줍니다.
    updateExtractPercentDisplay(val, max) {
        if (!this.extractPercentValue) return;
        if (max <= 0) {
            this.extractPercentValue.textContent = "0.00";
            return;
        }
        const percent = (val / max) * 100;
        this.extractPercentValue.textContent = percent.toFixed(2);
    }

    updateExtractSliderMax(maxColors) {
        if (this.extractNumberSlider) {
            this.extractNumberSlider.max = maxColors;
            let currentVal = parseInt(this.extractNumberSlider.value, 10);
            if (currentVal > maxColors) {
                this.extractNumberSlider.value = maxColors;
                currentVal = maxColors;
            }
            this.updateExtractPercentDisplay(currentVal, maxColors);
        }
    }

    updateExtractWarning(count) {
        if (!this.extractWarningBox) return;

        let msgKey = 'extract_new_colors';
        let bg = '#e8f5e9', color = '#2e7d32', border = '1px solid #c8e6c9';
        let btnBg = '#2ecc71', btnColor = '#fff';

        if (count > 1000) {
            msgKey = 'extract_warning_danger';
            bg = '#ffebee'; color = '#d32f2f'; border = '1px solid #ffcdd2';
            btnBg = '#d32f2f'; btnColor = '#fff';
        } else if (count > 300) {
            msgKey = 'extract_warning_caution';
            bg = '#fff3cd'; color = '#856404'; border = '1px solid #ffeeba';
            btnBg = '#ffc107'; btnColor = '#000';
        }

        this.extractWarningBox.style.background = bg;
        this.extractWarningBox.style.color = color;
        this.extractWarningBox.style.border = border;
        
        const msgStr = t(msgKey) || "새로 추가될 색상:";
        const unitStr = t('unit_items') || "개";
        
        this.extractWarningBox.innerHTML = `
            <span data-lang-key="${msgKey}">${msgStr}</span>
            <span style="font-size: 13px; font-weight: 900;">
                <span id="extractCountValue">${count.toLocaleString()}</span> 
                <span data-lang-key="unit_items">${unitStr}</span>
            </span>
        `;
        
        if (this.extractAllBtn) {
            this.extractAllBtn.style.background = btnBg;
            this.extractAllBtn.style.color = btnColor;
        }
    }

    initSortControl() {
        this.sortSelect = document.getElementById('paletteSortSelect');
        this.viewModeToggleBtn = document.getElementById('viewModeToggleBtn');
    }

    renderRecommendations(recommendations, onAddClick) {
        if (!this.recommendationContainer) return;
        const list = Array.isArray(recommendations) ? recommendations : [];
        if (list.length === 0) {
            this.recommendationContainer.style.display = 'none';
            if (this.recommendationPlaceholder) this.recommendationPlaceholder.style.display = 'block';
            return;
        }
        if (this.recommendationPlaceholder) this.recommendationPlaceholder.style.display = 'none';
        this.recommendationContainer.style.display = 'block';
        this.recommendationContainer.innerHTML = '';
        list.forEach(item => {
            const card = this.createCard({ rgb: item.rgb, tag: item.tag, count: null, type: 'add', onClick: () => onAddClick(item.rgb), viewMode: 'list' });
            this.recommendationContainer.appendChild(card);
        });
    }

    renderAddedList(colors, onRemoveClick, onToggleClick, stats = {}, viewMode = 'list') {
        if (!this.addedColorsContainer) return;
        this.addedColorsContainer.innerHTML = '';
        
        if (viewMode === 'tile') {
            this.addedColorsContainer.className = 'palette-grid-view'; 
            this.addedColorsContainer.style.cssText = 'display: grid !important; grid-template-columns: repeat(6, 1fr) !important; gap: 6px !important; padding: 10px 5px !important; width: 100% !important; box-sizing: border-box !important; background: transparent !important; border: none !important;';
        } else {
            this.addedColorsContainer.className = 'palette-buttons';
            this.addedColorsContainer.style.cssText = 'display: block !important; padding: 0 !important; width: 100% !important; box-sizing: border-box !important;';
        }

        if (this.viewModeToggleBtn) {
            const gridIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
            const listIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
            this.viewModeToggleBtn.innerHTML = viewMode === 'tile' ? listIcon : gridIcon;
        }

        const list = Array.isArray(colors) ? colors : [];
        if (list.length === 0) {
            const p = document.createElement('div'); p.className = 'placeholder-section'; p.textContent = t('placeholder_add_color') || "아래에서 직접 색상을 추가하세요.";
            this.addedColorsContainer.appendChild(p); 
            if (viewMode === 'tile') this.addedColorsContainer.style.display = 'block';
            return;
        }
        
        list.forEach((item, index) => {
            const rgbVal = item.rgb || item;
            const originalIndex = item.originalIndex !== undefined ? item.originalIndex : index;
            const hex = rgbToHex(rgbVal[0], rgbVal[1], rgbVal[2]);
            const count = stats[hex] || 0;
            const isDisabled = state.disabledHexes.includes(hex);
            
            const element = this.createCard({ 
                rgb: rgbVal, 
                tag: 'tag_user_added', 
                count: count, 
                type: 'remove', 
                isDisabled: isDisabled,
                onClick: () => onToggleClick(rgbVal), 
                onAction: () => onRemoveClick(originalIndex),
                viewMode: viewMode 
            });
            this.addedColorsContainer.appendChild(element);
        });
    }

    createCard({ rgb, tag, count, type, isDisabled, onClick, onAction, viewMode }) {
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        
        if (viewMode === 'tile' && type === 'remove') {
            const tile = document.createElement('div'); 
            tile.className = 'color-tile';
            if (isDisabled) tile.classList.add('disabled');
            tile.onclick = () => onClick();

            let badgeHtml = '';
            if (count && count > 0) {
                const displayCount = count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count;
                badgeHtml = `<div class="overlay-badge">${displayCount}</div>`;
            }

            tile.innerHTML = `
                <div class="preview" style="background-color: ${hex}">
                    ${badgeHtml}
                </div>
                <div class="hex">${hex}</div>
                <div class="rgb">(${rgb.join(', ')})</div>
            `;

            const btn = document.createElement('button'); 
            btn.className = 'remove-btn'; 
            btn.innerHTML = '&times;';
            btn.onclick = (e) => { e.stopPropagation(); onAction(); }; 
            tile.appendChild(btn);

            return tile;
        }

        const card = document.createElement('div'); card.className = 'color-card';
        if (isDisabled) card.classList.add('disabled');
        card.onclick = (e) => { onClick(); };
        const preview = document.createElement('div'); preview.className = 'color-preview-box'; preview.style.backgroundColor = hex; card.appendChild(preview);
        const info = document.createElement('div'); info.className = 'color-info';
        const hSpan = document.createElement('span'); hSpan.className = 'color-hex'; hSpan.textContent = hex;
        const sSpan = document.createElement('span'); sSpan.className = 'color-sub'; sSpan.textContent = `(${rgb.join(',')})`;
        info.appendChild(hSpan); info.appendChild(sSpan); card.appendChild(info);
        if (type === 'remove') {
            if (count && count > 0) {
                const badge = document.createElement('span'); badge.className = 'pixel-count-badge';
                badge.textContent = count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count;
                badge.title = t('tooltip_pixel_count', { n: count }) || `${count} 픽셀`;
                card.appendChild(badge);
            }
            const btn = document.createElement('button'); btn.className = `action-btn remove`; btn.textContent = '-';
            btn.title = t('tooltip_delete') || "삭제";
            btn.onclick = (e) => { e.stopPropagation(); onAction(); }; card.appendChild(btn);
        } else {
            if (tag) {
                const tSpan = document.createElement('span'); tSpan.className = 'color-tag'; tSpan.textContent = tag.startsWith('tag_') ? t(tag) : tag; card.appendChild(tSpan);
            }
            const plusIcon = document.createElement('span'); plusIcon.className = 'add-icon'; plusIcon.textContent = '+'; card.appendChild(plusIcon);
        }
        return card;
    }

    clearInputs() {
        if (this.hexInput) this.hexInput.value = '';
        if (this.rgbInputs.r) this.rgbInputs.r.value = '';
        if (this.rgbInputs.g) this.rgbInputs.g.value = '';
        if (this.rgbInputs.b) this.rgbInputs.b.value = '';
    }

    updateTotalPixelCount(count) {
        if (this.totalPixelDisplay) {
            this.totalPixelDisplay.textContent = count.toLocaleString();
            return;
        }
        const infoBoxes = document.querySelectorAll('.image-info, .info-row, span, div');
        for (const box of infoBoxes) {
            if (box.textContent.includes('총 픽셀') || box.textContent.includes('Total Pixels')) {
                const lines = box.innerHTML.split('<br>');
                const newLines = lines.map(line => {
                    if (line.includes('총 픽셀') || line.includes('Total Pixels')) {
                        const label = line.split(':')[0]; 
                        return `${label}: <strong>${count.toLocaleString()}</strong>`;
                    }
                    return line;
                });
                box.innerHTML = newLines.join('<br>');
                break;
            }
        }
    }
}