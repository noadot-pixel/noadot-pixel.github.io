import { rgbToHex, state, t } from '../../state.js';

export class UserPaletteUI {
    constructor() {
        this.injectStyles();

        this.recommendationContainer = document.getElementById('recommendation-report-container');
        this.recommendationPlaceholder = document.getElementById('recommendedColorsPlaceholder');
        this.addedColorsContainer = document.getElementById('addedColors');
        
        // [수정] HTML에 직접 넣었으므로, 찾아서 참조만 연결합니다.
        this.sortSelect = document.getElementById('paletteSortSelect');

        this.hexInput = document.getElementById('addHex');
        if (this.hexInput) {
            this.hexInput.setAttribute('data-lang-placeholder', 'placeholder_hex');
            this.hexInput.placeholder = t('placeholder_hex');
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

    // createSortControl 메서드는 이제 불필요하거나, 
    // 만약 index.html 수정이 안 되었을 경우를 대비한 백업용으로 남겨둘 수 있습니다.
    // 하지만 index.html을 수정했다면 이 메서드는 실행되지 않거나(ID 중복 체크) 무시됩니다.
    createSortControl() {
        // 이미 HTML에 존재하면 패스
        if (document.getElementById('paletteSortSelect')) return;
        
        // (백업 로직 생략: 사용자가 index.html을 수정할 것이므로)
    }

    injectStyles() {
        if (document.getElementById('user-palette-styles')) return;
        const style = document.createElement('style');
        style.id = 'user-palette-styles';
        style.textContent = `
            .color-card { display: flex; align-items: center; background: white; border: 1px solid #eee; border-radius: 8px; padding: 8px 12px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: transform 0.1s; cursor: pointer; position: relative; }
            .color-card:hover { transform: translateY(-1px); box-shadow: 0 3px 6px rgba(0,0,0,0.1); }
            .color-card.disabled { opacity: 0.5; filter: grayscale(100%); background: #f9f9f9; }
            .color-preview-box { width: 36px; height: 36px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.1); margin-right: 12px; flex-shrink: 0; }
            .color-info { display: flex; flex-direction: column; flex-grow: 1; font-size: 13px; overflow: hidden; }
            .color-hex { font-weight: 700; color: #333; font-family: monospace; }
            .color-sub { font-size: 11px; color: #888; white-space: nowrap; }
            .color-tag { background: #eee; color: #555; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 10px; flex-shrink: 0; }
            .pixel-count-badge { background: #333; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-left: auto; margin-right: 10px; min-width: 35px; text-align: center; box-shadow: inset 0 0 2px rgba(0,0,0,0.5); flex-shrink: 0; }
            .action-btn { width: 28px; height: 28px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #555; transition: all 0.2s; flex-shrink: 0; }
            .action-btn:hover { background: #f5f5f5; border-color: #bbb; color: #000; }
            .action-btn.remove { color: #d32f2f; }
            .add-icon { font-size: 20px; font-weight: bold; color: #888; margin-left: 10px; margin-right: 5px; }
            .color-card:hover .add-icon { color: #000; }
            .placeholder-section { text-align: center; color: #999; font-size: 13px; padding: 20px 0; border: 1px dashed #ddd; border-radius: 8px; margin-bottom: 10px; }
        `;
        document.head.appendChild(style);
    }

    // ... (나머지 renderRecommendations, renderAddedList, createCard, clearInputs, updateTotalPixelCount 등 기존 코드 유지) ...
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
            const card = this.createCard({ rgb: item.rgb, tag: item.tag, count: null, type: 'add', onClick: () => onAddClick(item.rgb) });
            this.recommendationContainer.appendChild(card);
        });
    }

    renderAddedList(colors, onRemoveClick, onToggleClick, stats = {}) {
        if (!this.addedColorsContainer) return;
        this.addedColorsContainer.innerHTML = '';
        const list = Array.isArray(colors) ? colors : [];
        if (list.length === 0) {
            const p = document.createElement('div'); p.className = 'placeholder-section'; p.textContent = t('placeholder_add_color');
            this.addedColorsContainer.appendChild(p); return;
        }
        list.forEach((item, index) => {
            const rgbVal = item.rgb || item;
            const originalIndex = item.originalIndex !== undefined ? item.originalIndex : index;
            const hex = rgbToHex(rgbVal[0], rgbVal[1], rgbVal[2]);
            const count = stats[hex] || 0;
            const isDisabled = state.disabledHexes.includes(hex);
            const card = this.createCard({ 
                rgb: rgbVal, 
                tag: 'tag_user_added', 
                count: count, 
                type: 'remove', 
                isDisabled: isDisabled,
                onClick: () => onToggleClick(rgbVal), 
                onAction: () => onRemoveClick(originalIndex) 
            });
            this.addedColorsContainer.appendChild(card);
        });
    }

    createCard({ rgb, tag, count, type, isDisabled, onClick, onAction }) {
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
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
                badge.title = t('tooltip_pixel_count', { n: count });
                card.appendChild(badge);
            }
            const btn = document.createElement('button'); btn.className = `action-btn remove`; btn.textContent = '-';
            btn.title = t('tooltip_delete');
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