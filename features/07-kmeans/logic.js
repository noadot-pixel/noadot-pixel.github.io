// js/features/07-kmeans/logic.js
import { eventBus } from '../../core/EventBus.js';
// 🌟 번역 함수 t() 수입 추가!
import { state, t } from '../../core/state.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';

export class KMeansFeature {
    constructor() {
        this.pendingTask = null; 
        this.initEvents();
        this.initBusListeners();
    }

    initEvents() {
        this.matchSlider = document.getElementById('matchSlider');
        this.matchSliderVal = document.getElementById('matchSliderVal');
        this.btnMatch = document.getElementById('btnKmeansMatch');

        this.addSlider = document.getElementById('addSlider');
        this.addSliderVal = document.getElementById('addSliderVal');
        this.btnExtract = document.getElementById('btnKmeansExtract');
        this.track2Container = document.getElementById('kmeans-track-2');

        // 🌟 슬라이더 숫자 동기화 시 다국어 변수 {count} 적용
        if (this.matchSlider) {
            this.matchSlider.addEventListener('input', (e) => {
                if (this.matchSliderVal) this.matchSliderVal.textContent = t('unit_colors', { count: e.target.value });
            });
        }
        if (this.addSlider) {
            this.addSlider.addEventListener('input', (e) => {
                if (this.addSliderVal) this.addSliderVal.textContent = t('unit_colors', { count: e.target.value });
            });
        }

        if (this.btnMatch) {
            this.btnMatch.addEventListener('click', () => this.sendKmeansRequest('match', this.matchSlider.value));
        }
        if (this.btnExtract) {
            this.btnExtract.addEventListener('click', () => this.sendKmeansRequest('add', this.addSlider.value));
        }
    }

    initBusListeners() {
        eventBus.on('PALETTE_MODE_CHANGED', () => this.updateUI());
        eventBus.on('PALETTE_UPDATED', () => this.updateUI());
        
        // 🌟 언어가 바뀔 때 슬라이더의 현재 텍스트(예: 16색 -> 16 Colors)도 즉시 다시 그려줍니다!
        eventBus.on('LANGUAGE_CHANGED', () => {
            if (this.matchSliderVal && this.matchSlider) this.matchSliderVal.textContent = t('unit_colors', { count: this.matchSlider.value });
            if (this.addSliderVal && this.addSlider) this.addSliderVal.textContent = t('unit_colors', { count: this.addSlider.value });
            // 버튼 텍스트 복구
            if (!this.pendingTask) {
                if (this.btnMatch) this.btnMatch.textContent = t('btn_kmeans_match');
                if (this.btnExtract) this.btnExtract.textContent = t('btn_kmeans_extract');
            }
        });
        
        eventBus.on('KMEANS_EXTRACTION_COMPLETE', (payload) => {
            if (!payload || !payload.colors) return;
            const extractedColors = payload.colors;
            
            if (this.pendingTask === 'match') {
                this.processMatching(extractedColors);
            } else if (this.pendingTask === 'add') {
                this.processExtraction(extractedColors);
            }
            
            // 🌟 버튼 상태 원상복구 시 다국어 적용
            this.pendingTask = null;
            if (this.btnMatch) this.btnMatch.textContent = t('btn_kmeans_match');
            if (this.btnExtract) this.btnExtract.textContent = t('btn_kmeans_extract');
        });
    }

    updateUI() {
        const mode = state.currentMode || 'geopixels';
        
        if (this.track2Container) {
            this.track2Container.style.display = (mode === 'geopixels') ? 'block' : 'none';
        }

        if (this.matchSlider) {
            let maxCount = 16; 
            if (mode === 'wplace') maxCount = 63;
            else if (mode === 'uplace') maxCount = 127;
            else if (mode === 'geopixels') {
                const customCount = (state.addedColors || []).length;
                maxCount = 29 + customCount;
            }
            
            maxCount = Math.max(2, maxCount);
            this.matchSlider.max = maxCount;
            
            if (parseInt(this.matchSlider.value) > maxCount) {
                this.matchSlider.value = maxCount;
            }
            // 🌟 갱신 시 다국어 적용
            if (this.matchSliderVal) this.matchSliderVal.textContent = t('unit_colors', { count: this.matchSlider.value });
        }
    }

    sendKmeansRequest(task, count) {
        if (!state.originalImageData) {
            alert(t('msg_no_image_upload_first')); // 🌟 다국어 알림
            return;
        }

        this.pendingTask = task; 
        // 🌟 버튼 로딩 상태 텍스트 다국어 적용
        if (task === 'match' && this.btnMatch) this.btnMatch.textContent = t('msg_matching');
        if (task === 'add' && this.btnExtract) this.btnExtract.textContent = t('msg_extracting');

        eventBus.emit('REQUEST_KMEANS_EXTRACTION', {
            options: {
                colorCount: parseInt(count, 10),
                kmeansUseOklab: true, 
                kmeansChromaBoost: 1.5 
            }
        });
    }

    rgbToHex(rgbArray) {
        return '#' + rgbArray.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    processMatching(extractedColors) {
        const mode = state.currentMode;
        let targetPalette = [];
        
        if (mode === 'wplace') targetPalette = [...wplaceFreeColors, ...wplacePaidColors];
        else if (mode === 'uplace') targetPalette = uplaceColors;
        else if (mode === 'geopixels') targetPalette = [...geopixelsColors, ...(state.addedColors || [])];

        const matchedHexes = new Set();
        
        extractedColors.forEach(exRgb => {
            let minDist = Infinity;
            let bestHex = null;
            targetPalette.forEach(pColor => {
                const distSq = Math.pow(exRgb[0]-pColor.rgb[0], 2) + Math.pow(exRgb[1]-pColor.rgb[1], 2) + Math.pow(exRgb[2]-pColor.rgb[2], 2);
                if (distSq < minDist) {
                    minDist = distSq;
                    bestHex = this.rgbToHex(pColor.rgb);
                }
            });
            if (bestHex) matchedHexes.add(bestHex);
        });

        const allTargetHexes = targetPalette.map(c => this.rgbToHex(c.rgb));
        state.disabledHexes = allTargetHexes.filter(hex => !matchedHexes.has(hex));

        console.log(`[트랙1: 매칭완료] 목표: ${extractedColors.length}색 / 실제 활성화: ${matchedHexes.size}색 유지`);
        eventBus.emit('PALETTE_UPDATED');
    }

    processExtraction(extractedColors) {
        if (state.currentMode !== 'geopixels') return;
        if (!state.addedColors) state.addedColors = [];
        
        let addedCount = 0;
        extractedColors.forEach(rgb => {
            const hex = this.rgbToHex(rgb);
            const existsInCustom = state.addedColors.some(c => this.rgbToHex(c.rgb) === hex);
            const existsInBase = geopixelsColors.some(c => this.rgbToHex(c.rgb) === hex);

            if (!existsInCustom && !existsInBase) {
                state.addedColors.push({ id: Date.now() + Math.random(), rgb: rgb, count: 0 });
                addedCount++;
            }
        });
        
        console.log(`[트랙2: 추출완료] ${addedCount}개의 색상이 자동 추가되었습니다.`);
        eventBus.emit('PALETTE_UPDATED');
    }
}