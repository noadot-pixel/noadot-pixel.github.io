// 🌟 [신규] 중복 색상 검사 팝업 - 서로 거의 구분 안 되는 색상들을 구역(A)으로 묶어 보여주고,
// 실시간 미리보기와 함께 어떤 색을 남기고 뺄지 사용자가 직접 결정하게 해준다.
// "최종 결정"을 누르기 전까지는 실제 state.disabledHexes를 절대 건드리지 않는다.
import { eventBus } from '../../core/EventBus.js';
import { state, t, rgbToHex, getTextColorForBg } from '../../core/state.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors, bplaceColors } from '../../data/palettes.js';
import { findDuplicateZones } from './duplicate-finder.js';

export class DuplicateCheckModal {
    /** @param {() => void} onApplied 최종 결정 버튼을 눌러 disabledHexes가 실제로 바뀌었을 때 호출됨 */
    constructor(onApplied) {
        this.modal = document.getElementById('dupCheckModal');
        this.sidebar = document.getElementById('dupCheckSidebar');
        this.previewPane = document.querySelector('.dupcheck-preview-pane');
        this.canvas = document.getElementById('dupCheckPreviewCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.loadingEl = document.getElementById('dupCheckLoading');
        this.summaryEl = document.getElementById('dupCheckSummary');
        this.onApplied = onApplied;

        this.zones = [];
        this.pendingOff = new Set(); // 이번 팝업 세션 동안 임시로 꺼둔 hex들 (적용 전까지는 미리보기 전용)
        this.previewTimer = null;

        // 🌟 [신규] 메인 뷰어(02-viewer)와 동일한 방식의 확대/드래그 상태
        this.zoom = 100;
        this.panX = 0;
        this.panY = 0;
        this.isDraggingPreview = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        this.initEvents();
        this.initBusListeners();
        this.initPreviewInteraction();

        if (this.canvas) {
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '50%';
            this.canvas.style.left = '50%';
            this.canvas.style.transformOrigin = 'center center';
        }
    }

    initEvents() {
        document.getElementById('btnCheckDuplicates')?.addEventListener('click', () => this.open());
        document.getElementById('btnCloseDupCheck')?.addEventListener('click', () => this.close());
        document.getElementById('btnApplyDupCheck')?.addEventListener('click', () => this.apply());

        // 팝업 바깥(반투명 배경) 클릭 시 취소하고 닫기
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    // 🌟 [신규] 미리보기 캔버스 확대(휠)/이동(드래그) - 메인 뷰어의 줌/팬 로직과 같은 수식을 사용
    initPreviewInteraction() {
        if (!this.previewPane || !this.canvas) return;

        this.previewPane.addEventListener('wheel', (e) => {
            if (!this.isOpen()) return;
            e.preventDefault();

            this.canvas.style.transition = 'none';
            clearTimeout(this.wheelZoomEndTimer);
            this.wheelZoomEndTimer = setTimeout(() => {
                if (this.canvas) this.canvas.style.transition = 'transform 0.1s ease-out';
            }, 150);

            const delta = -Math.sign(e.deltaY);
            const zoomSpeed = 0.15;
            let newZoom = this.zoom * (1 + delta * zoomSpeed);
            newZoom = Math.max(10, Math.min(5000, newZoom));

            const rect = this.previewPane.getBoundingClientRect();
            const dx = e.clientX - rect.left - rect.width / 2;
            const dy = e.clientY - rect.top - rect.height / 2;
            const scaleRatio = newZoom / this.zoom;

            this.panX = dx - (dx - this.panX) * scaleRatio;
            this.panY = dy - (dy - this.panY) * scaleRatio;
            this.zoom = newZoom;
            this.applyTransform();
        }, { passive: false });

        this.previewPane.addEventListener('mousedown', (e) => {
            if (!this.isOpen() || e.target.closest('button')) return;
            this.isDraggingPreview = true;
            this.dragStartX = e.clientX - this.panX;
            this.dragStartY = e.clientY - this.panY;
            this.previewPane.classList.add('is-grabbing');
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDraggingPreview) return;
            this.panX = e.clientX - this.dragStartX;
            this.panY = e.clientY - this.dragStartY;
            this.applyTransform();
        });

        window.addEventListener('mouseup', () => {
            if (this.isDraggingPreview) {
                this.isDraggingPreview = false;
                this.previewPane?.classList.remove('is-grabbing');
            }
        });
    }

    applyTransform() {
        if (!this.canvas) return;
        this.canvas.style.transform = `translate(calc(-50% + ${this.panX}px), calc(-50% + ${this.panY}px)) scale(${this.zoom / 100})`;
    }

    initBusListeners() {
        eventBus.on('PALETTE_PREVIEW_READY', ({ imageData }) => {
            if (!this.isOpen() || !imageData) return;
            this.drawPreview(imageData);
        });
    }

    isOpen() {
        return !!this.modal && this.modal.style.display !== 'none';
    }

    // 🌟 현재 모드/병합 설정 기준으로 "지금 실제로 매칭에 쓰이고 있는" 활성 색상만 모은다
    // (이미 꺼진 색은 검사 대상에서 제외 - 어차피 매칭에 참여하지 않으므로)
    buildActiveEntries() {
        const disabled = new Set(state.disabledHexes || []);
        const mode = state.currentMode || 'geopixels';
        const counts = state.latestColorCounts || {};
        const seen = new Map(); // hex -> entry (플랫폼 병합 시 동일 hex 중복 등록 방지)

        const addAll = (list) => {
            list.forEach(c => {
                const hex = rgbToHex(...c.rgb);
                if (disabled.has(hex) || seen.has(hex)) return;
                seen.set(hex, { hex, rgb: c.rgb, count: counts[hex] || 0 });
            });
        };

        if (mode === 'geopixels') {
            addAll(geopixelsColors);
            if (state.useWplaceInGeopixels) { addAll(wplaceFreeColors); addAll(wplacePaidColors); }
            if (state.useUplaceInGeopixels) addAll(uplaceColors);
            if (state.useBplaceInGeopixels) addAll(bplaceColors);
            addAll(state.addedColors || []);
        } else if (mode === 'wplace') {
            addAll(wplaceFreeColors); addAll(wplacePaidColors);
        } else if (mode === 'uplace') {
            addAll(uplaceColors);
        } else if (mode === 'bplace') {
            addAll(bplaceColors);
        }

        return Array.from(seen.values());
    }

    open() {
        if (!state.originalImageData || !state.latestConversionData) {
            alert(t('msg_no_image_upload_first'));
            return;
        }

        const entries = this.buildActiveEntries();
        this.zones = findDuplicateZones(entries);
        this.pendingOff.clear();

        if (this.zones.length === 0) {
            alert(t('msg_no_duplicate_colors'));
            return;
        }

        this.renderSidebar();
        if (this.loadingEl) this.loadingEl.style.display = 'none';
        // 팝업이 display:none인 상태에서는 미리보기 창 크기를 잴 수 없으므로(clientWidth가 0),
        // 먼저 보여준 다음에 "화면에 맞추기" 계산을 하는 캔버스를 그린다.
        if (this.modal) this.modal.style.display = 'flex';
        this.drawPreview(state.latestConversionData, true);
    }

    close() {
        if (this.modal) this.modal.style.display = 'none';
        if (this.loadingEl) this.loadingEl.style.display = 'none';
        if (this.previewTimer) { clearTimeout(this.previewTimer); this.previewTimer = null; }
        this.pendingOff.clear();
    }

    renderSidebar() {
        if (!this.sidebar) return;
        this.sidebar.innerHTML = '';

        this.zones.forEach(zone => {
            const row = document.createElement('div');
            row.className = 'dupcheck-zone-row';

            // 구역 전체 켜기/끄기 버튼 (기존 기본 팔레트의 'A' 전체선택 버튼과 같은 시각 언어)
            const allBtn = document.createElement('button');
            allBtn.className = 'dupcheck-zone-all';
            allBtn.textContent = 'A';
            allBtn.title = t('title_dup_zone_toggle_all');
            const zoneAllOff = zone.colors.every(c => this.pendingOff.has(c.hex));
            allBtn.classList.toggle('all-off', zoneAllOff);
            allBtn.addEventListener('click', () => {
                const shouldTurnOff = !zone.colors.every(c => this.pendingOff.has(c.hex));
                zone.colors.forEach(c => {
                    if (shouldTurnOff) this.pendingOff.add(c.hex);
                    else this.pendingOff.delete(c.hex);
                });
                this.renderSidebar();
                this.schedulePreview();
            });
            row.appendChild(allBtn);

            zone.colors.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'dupcheck-zone-color';
                btn.style.background = c.hex;
                // 🌟 밝은 배경엔 검은 체크, 어두운 배경엔 흰 체크 - 밝기에 따라 자동으로 잘 보이는 쪽을 고른다
                btn.style.color = getTextColorForBg(c.rgb);
                const isOff = this.pendingOff.has(c.hex);
                btn.classList.toggle('is-off', isOff);
                btn.textContent = isOff ? '✗' : '✔';
                btn.title = `${c.hex} · ${c.count}px`;
                btn.addEventListener('click', () => {
                    if (this.pendingOff.has(c.hex)) this.pendingOff.delete(c.hex);
                    else this.pendingOff.add(c.hex);
                    this.renderSidebar();
                    this.schedulePreview();
                });
                row.appendChild(btn);
            });

            const countLine = document.createElement('span');
            countLine.className = 'dupcheck-zone-count';
            countLine.textContent = zone.colors.map(c => `${c.count}px`).join(' / ');
            row.appendChild(countLine);

            this.sidebar.appendChild(row);
        });

        if (this.summaryEl) {
            this.summaryEl.textContent = t('msg_dup_zone_summary', { zones: this.zones.length, removed: this.pendingOff.size });
        }
    }

    schedulePreview() {
        // 🌟 워커 왕복 동안 "변환 중"임을 바로 알 수 있도록 디바운스 타이머를 걸기 전에 즉시 표시
        if (this.loadingEl) this.loadingEl.style.display = 'flex';

        if (this.previewTimer) clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => {
            const overrideDisabled = [...(state.disabledHexes || []), ...this.pendingOff];
            eventBus.emit('REQUEST_PALETTE_PREVIEW', { disabledHexes: overrideDisabled });
        }, 150);
    }

    // 🌟 [수정] 메인 뷰어와 동일하게 캔버스 크기는 항상 원본 픽셀 비율 그대로 두고(찌그러짐 방지),
    // 화면에 보이는 크기는 transform의 scale(줌)만으로 조절한다.
    // resetView=true일 때만 "창에 맞추기" 배율을 다시 계산한다 (사용자가 직접 줌/이동한 걸 매 프레임 덮어쓰지 않도록).
    drawPreview(imageData, resetView = false) {
        if (!this.canvas || !this.ctx || !imageData) return;
        if (this.loadingEl) this.loadingEl.style.display = 'none';
        this.canvas.width = imageData.width;
        this.canvas.height = imageData.height;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.putImageData(imageData, 0, 0);

        this.canvas.style.width = `${imageData.width}px`;
        this.canvas.style.height = `${imageData.height}px`;

        if (resetView && this.previewPane) {
            const paneW = this.previewPane.clientWidth || 1;
            const paneH = this.previewPane.clientHeight || 1;
            const fitZoom = Math.min(paneW / imageData.width, paneH / imageData.height) * 100;
            // 원본이 이미 작으면 억지로 100% 이상 확대하지 않고, 창보다 크면 다 보이도록 축소한다.
            this.zoom = Math.min(100, fitZoom) || 100;
            this.panX = 0;
            this.panY = 0;
        }

        this.applyTransform();
    }

    apply() {
        if (this.pendingOff.size > 0) {
            const merged = new Set(state.disabledHexes || []);
            this.pendingOff.forEach(hex => merged.add(hex));
            state.disabledHexes = Array.from(merged);
        }
        this.close();
        if (this.onApplied) this.onApplied();
    }
}
