import { eventBus } from '../../core/EventBus.js';
import { state } from '../../core/state.js';
import { PaletteSelectorUI } from './ui.js';
import { wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';

export class PaletteSelectorFeature {
    constructor() {
        this.ui = new PaletteSelectorUI();
        
        // 초기 뷰 모드 및 정렬 상태 설정
        if (!state.paletteViewMode) state.paletteViewMode = 'list';
        if (!state.paletteSortMode) state.paletteSortMode = 'added';
        if (!state.addedColors) state.addedColors = [];

        this.initEvents();
        this.initBusListeners();
        this.setMode('geopixels');
    }

    initEvents() {
        // 🌟 커스텀 팔레트 전체 켜기/끄기 (A 버튼) 로직
        const toggleAllCustomBtn = document.getElementById('toggleAllCustomBtn');
        if (toggleAllCustomBtn) {
            toggleAllCustomBtn.addEventListener('click', () => {
                if (!state.addedColors || state.addedColors.length === 0) return;

                // 현재 커스텀 팔레트에 있는 모든 색상의 HEX 코드 추출
                const customHexes = state.addedColors.map(c => this.ui.rgbToHex(...c.rgb).toUpperCase());
                
                // 커스텀 색상들이 전부 다 꺼져(disabled) 있는지 확인
                const allDisabled = customHexes.every(hex => state.disabledHexes.includes(hex));

                if (allDisabled) {
                    // 모두 꺼져있다면 -> 전체 켜기! (disabledHexes에서 커스텀 색상들을 제거)
                    state.disabledHexes = state.disabledHexes.filter(hex => !customHexes.includes(hex));
                } else {
                    // 하나라도 켜져있다면 -> 전체 끄기! (disabledHexes에 안 들어간 녀석들 전부 집어넣기)
                    customHexes.forEach(hex => {
                        if (!state.disabledHexes.includes(hex)) {
                            state.disabledHexes.push(hex);
                        }
                    });
                }
                
                this.refresh(); // UI 갱신
                eventBus.emit('PALETTE_UPDATED'); // 엔진 가동
            });
        }
        
        // 상단 기본 팔레트 토글 로직
        this.ui.paletteContainer.addEventListener('toggleAllColors', (e) => {
            const colors = e.detail; 
            // 🌟 1. 무조건 대문자로 강제 변환해서 워커와 언어를 맞춥니다.
            const hexes = colors.map(c => this.ui.rgbToHex(...c.rgb).toUpperCase());
            
            const anyDisabled = hexes.some(hex => state.disabledHexes.includes(hex));
            if (anyDisabled) state.disabledHexes = state.disabledHexes.filter(hex => !hexes.includes(hex));
            else hexes.forEach(hex => { if (!state.disabledHexes.includes(hex)) state.disabledHexes.push(hex); });
            
            this.refresh();
            // 🌟 2. 잃어버렸던 마법의 주문! "워커야, 팔레트 바뀌었으니 즉시 다시 그려라!"
            eventBus.emit('PALETTE_UPDATED'); 
        });

        this.ui.paletteContainer.addEventListener('toggleSingleColor', (e) => {
            // 🌟 1. 개별 색상을 클릭할 때도 무조건 대문자로 변환!
            const hex = e.detail.toUpperCase();
            
            if (state.disabledHexes.includes(hex)) state.disabledHexes = state.disabledHexes.filter(h => h !== hex);
            else state.disabledHexes.push(hex);
            
            this.refresh();
            // 🌟 2. 클릭하자마자 즉시 렌더링 지시!
            eventBus.emit('PALETTE_UPDATED'); 
        });

        // [기존] 상단 탭 모드 전환
        this.ui.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setMode(e.target.dataset.mode);
            });
        });

        // ==========================================
        // 🌟 [신규] V6 커스텀 팔레트 로직 시작
        // ==========================================

        // 1. 색상 추가 (HEX 우선, 없으면 RGB)
        const addColorBtn = document.getElementById('addColorBtn');
        if (addColorBtn) {
            addColorBtn.addEventListener('click', () => {
                const hexInput = document.getElementById('addHex').value.trim();
                let finalRgb = null;

                if (hexInput) {
                    const cleanHex = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
                    if (result) {
                        finalRgb = [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
                    }
                } else {
                    const r = parseInt(document.getElementById('addR').value) || 0;
                    const g = parseInt(document.getElementById('addG').value) || 0;
                    const b = parseInt(document.getElementById('addB').value) || 0;
                    finalRgb = [
                        Math.max(0, Math.min(255, r)),
                        Math.max(0, Math.min(255, g)),
                        Math.max(0, Math.min(255, b))
                    ];
                }

                if (finalRgb) {
                    const hex = this.ui.rgbToHex(...finalRgb);
                    const exists = state.addedColors.some(c => this.ui.rgbToHex(...c.rgb) === hex);
                    if (!exists) {
                        // 고유 ID(Date.now)를 넣어 추가순 정렬 시 활용합니다.
                        state.addedColors.push({ id: Date.now(), rgb: finalRgb, count: 0 });
                        
                        // 입력창 초기화
                        document.getElementById('addHex').value = '';
                        ['addR', 'addG', 'addB'].forEach(id => document.getElementById(id).value = '');
                        
                        this.sortAndRefresh();
                        eventBus.emit('PALETTE_UPDATED');
                    }
                }
            });
        }

        // 2. 개별 색상 삭제 이벤트 수신
        this.ui.customPaletteContainer.addEventListener('removeCustomColor', (e) => {
            const hexToRemove = e.detail;
            state.addedColors = state.addedColors.filter(c => this.ui.rgbToHex(...c.rgb) !== hexToRemove);
            state.disabledHexes = state.disabledHexes.filter(h => h !== hexToRemove);
            this.refresh(); 
            eventBus.emit('PALETTE_UPDATED');
        });

        // 3. 전체 색상 초기화
        const resetBtn = document.getElementById('resetAddedColorsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm("추가한 커스텀 색상을 모두 지우시겠습니까?")) {
                    state.addedColors = [];
                    this.refresh();
                    eventBus.emit('PALETTE_UPDATED');
                }
            });
        }

        // 4. 정렬 방식 변경
        const sortSelect = document.getElementById('paletteSortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.paletteSortMode = e.target.value;
                this.sortAndRefresh();
            });
        }

        // 5. 뷰 모드 전환 (리스트 vs 타일)
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

        // 6. 파일로 내보내기 (JSON)
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

        // 7. 파일 불러오기 (JSON)
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
                            // 🌟 [수정됨] [[r,g,b], ...] 순수 배열 형태일 경우 V7 객체 포맷으로 변환
                            if (parsed.length > 0 && Array.isArray(parsed[0])) {
                                state.addedColors = parsed.map((rgbArr, index) => ({
                                    id: Date.now() + index, // 정렬을 위한 고유 ID
                                    rgb: rgbArr,
                                    count: 0
                                }));
                            } 
                            // 이미 V7 포맷(객체 배열)인 경우 그대로 저장
                            else if (parsed.length > 0 && parsed[0].rgb) {
                                state.addedColors = parsed;
                            }

                            this.sortAndRefresh();
                            eventBus.emit('PALETTE_UPDATED');
                        }
                    } catch (err) {
                        alert("잘못된 팔레트 파일입니다. JSON 형식을 확인해주세요.");
                    }
                };
                reader.readAsText(file);
                fileInput.value = ''; // 같은 파일 다시 열기 위해 초기화
            });
        }
    }

    initBusListeners() {
        // 워커가 도트 변환을 마치고 '영수증(stats)'을 보내면, 각 색상별 픽셀 수를 기록합니다.
        eventBus.on('CONVERSION_COMPLETE', (payload) => {
            if (payload.stats && payload.stats.colorCounts) {
                const counts = payload.stats.colorCounts; // { '#FFFFFF': 1052, '#000000': 500 } 형태
                
                // 기본 팔레트 수
                state.latestColorCounts = counts;

                // 내 커스텀 팔레트에 있는 색상들의 count 값을 업데이트
                state.addedColors.forEach(color => {
                    const hex = this.ui.rgbToHex(...color.rgb);
                    color.count = counts[hex] || 0;
                });

                // 만약 현재 '사용량순' 정렬 상태라면 순서가 바뀌어야 하므로 재정렬
                if (state.paletteSortMode === 'count') {
                    this.sortAndRefresh();
                } else {
                    this.refresh();
                }
            }
        });

        // 🌟 [수정 완료] K-Means 추출 결과 수신기 (목적에 따라 분기)
        eventBus.on('KMEANS_EXTRACTION_COMPLETE', (payload) => {
            if (!payload || !payload.colors) return;
            
            const extractedColors = payload.colors; 
            const actionType = state.pendingKmeansAction; // 'add' 또는 'match'
            const mode = state.currentMode;

            // 🛤️ [액션 A: 추출 및 추가] - GeoPixels 모드일 때만 커스텀에 추가
            if (actionType === 'add') {
                if (mode !== 'geopixels') {
                    alert("커스텀 색상 추가는 GeoPixels 모드에서만 가능합니다.");
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
            
            // 🛤️ [액션 B: 안 쓰는 색 끄기] - 현재 모드의 모든 색상을 대상으로 컷오프!
            else if (actionType === 'match') {
                let targetPalette = [];
                // 현재 탭에 맞는 색상 후보군 모집
                if (mode === 'wplace') targetPalette = [...wplaceFreeColors, ...wplacePaidColors];
                else if (mode === 'uplace') targetPalette = uplaceColors;
                else if (mode === 'geopixels') targetPalette = [...geopixelsColors, ...(state.addedColors || [])];

                const matchedHexes = new Set(); 

                // K-Means 색상과 가장 가까운 후보 찾기
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

                // 선택받지 못한 녀석들을 모조리 비활성화(disabled) 리스트로 덮어쓰기!
                const allTargetHexes = targetPalette.map(c => this.ui.rgbToHex(...c.rgb).toUpperCase());
                state.disabledHexes = allTargetHexes.filter(hex => !matchedHexes.has(hex));

                console.log(`[비활성화 완료] 목표: ${extractedColors.length}색 / 실제 활성화: ${matchedHexes.size}색 유지`);
            }

            // 정리된 화면 갱신 및 렌더링 엔진 가동
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
            // 🌟 [추가됨] R, G, B 값 높은 순 정렬
            else if (mode === 'r') {
                return b.rgb[0] - a.rgb[0];
            } else if (mode === 'g') {
                return b.rgb[1] - a.rgb[1];
            } else if (mode === 'b') {
                return b.rgb[2] - a.rgb[2];
            } 
            else {
                return (a.id || 0) - (b.id || 0);
            }
        });

        this.refresh();
    }

    refresh() {
        this.ui.renderPalettes();
    }

    setMode(mode) {
        state.currentMode = mode;
        this.ui.updateDisplay(mode);
        this.refresh();
        eventBus.emit('PALETTE_MODE_CHANGED', mode);
        eventBus.emit('PALETTE_UPDATED');
    }
}