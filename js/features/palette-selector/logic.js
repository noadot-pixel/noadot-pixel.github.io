// js/features/palette-selector/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../state.js';
import { PaletteSelectorUI } from './ui.js';

export class PaletteSelectorFeature {
    constructor() {
        this.ui = new PaletteSelectorUI();
        this.lastPixelStats = {}; // 통계 데이터 저장소

        this.initEvents();
        this.initBusListeners();
        
        // 초기 상태 반영
        this.setMode('geopixels');
    }

    initEvents() {
        // 1. GeoPixels 모드 클릭
        if (this.ui.geoModeRadio) {
            this.ui.geoModeRadio.addEventListener('change', () => this.setMode('geopixels'));
        }

        // 2. Wplace 모드 클릭
        if (this.ui.wplaceModeRadio) {
            this.ui.wplaceModeRadio.addEventListener('change', () => this.setMode('wplace'));
        }

        // 3. [신규] Uplace 모드 클릭
        if (this.ui.modeUplace) {
            this.ui.modeUplace.addEventListener('change', () => this.setMode('uplace'));
        }

        // 4. Geo 모드 내 Wplace 사용 체크박스
        if (this.ui.useWplaceInGeoCheckbox) {
            this.ui.useWplaceInGeoCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                state.useWplaceInGeoMode = isChecked;
                
                this.ui.toggleWplaceSubSection(isChecked);
                
                // 설정 변경 시 UI 갱신 (통계 유지)
                this.ui.renderPalettes(this.lastPixelStats);
                eventBus.emit('PALETTE_UPDATED');
            });
        }
    }

    initBusListeners() {
        // 이미지 분석 완료 시 통계 수신
        eventBus.on('IMAGE_ANALYZED', (data) => {
            this.lastPixelStats = data.pixelStats || {};
            // 통계 데이터를 포함하여 팔레트 다시 그리기
            this.ui.renderPalettes(this.lastPixelStats);
        });
    }

    setMode(mode) {
        state.currentMode = mode;
        this.ui.updateDisplay(mode);
        // 모드 변경 시에도 기존 통계가 있다면 표시
        this.ui.renderPalettes(this.lastPixelStats);
        
        eventBus.emit('PALETTE_MODE_CHANGED', mode);
        eventBus.emit('PALETTE_UPDATED');
    }
}