// js/features/07-kmeans/logic.js
import { eventBus } from '../../core/EventBus.js';
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
        
        // 🌟 [추가] 사용량 기반 추출 버튼
        this.btnUsageExtract = document.getElementById('btnUsageExtract');
        this.track2Container = document.getElementById('kmeans-track-match');

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

        // 🌟 [추가] +/- 미세 조정 버튼 이벤트 탑재!
        document.querySelectorAll('.adjust-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target');
                const val = parseInt(e.target.getAttribute('data-val'), 10);
                const slider = document.getElementById(targetId);
                if (slider) {
                    let newVal = parseInt(slider.value, 10) + val;
                    newVal = Math.max(slider.min, Math.min(slider.max, newVal));
                    slider.value = newVal;
                    slider.dispatchEvent(new Event('input')); // 숫자 라벨과 위치 즉시 갱신
                }
            });
        });

        if (this.btnMatch) this.btnMatch.addEventListener('click', () => this.sendKmeansRequest('match', this.matchSlider.value));
        if (this.btnExtract) this.btnExtract.addEventListener('click', () => this.sendKmeansRequest('add', this.addSlider.value));
        // 🌟 [추가] 사용량 추출 0초 컷 명령
        if (this.btnUsageExtract) this.btnUsageExtract.addEventListener('click', () => this.processUsageExtraction(this.addSlider.value));
    }

    initBusListeners() {
        eventBus.on('PALETTE_MODE_CHANGED', () => this.updateUI());
        eventBus.on('PALETTE_UPDATED', () => this.updateUI());
        
        // 🌟 [핵심] 변환이 끝날 때마다 영수증(colorCounts)을 보관해둡니다!
        eventBus.on('CONVERSION_COMPLETE', (payload) => {
            if (payload && payload.stats && payload.stats.colorCounts) {
                state.latestColorCounts = payload.stats.colorCounts;
            } else if (payload && payload.imageData === null) {
                state.latestColorCounts = null;
            }
        });
        
        eventBus.on('LANGUAGE_CHANGED', () => {
            if (this.matchSliderVal && this.matchSlider) this.matchSliderVal.textContent = t('unit_colors', { count: this.matchSlider.value });
            if (this.addSliderVal && this.addSlider) this.addSliderVal.textContent = t('unit_colors', { count: this.addSlider.value });
            if (!this.pendingTask) {
                if (this.btnMatch) this.btnMatch.textContent = t('btn_kmeans_match');
                if (this.btnExtract) this.btnExtract.textContent = t('btn_kmeans_extract');
                if (this.btnUsageExtract) this.btnUsageExtract.textContent = t('btn_usage_extract') || "📊 사용량 랭킹 추출";
            }
        });
        
        eventBus.on('KMEANS_EXTRACTION_COMPLETE', (payload) => {
            if (!payload || !payload.colors) return;
            const extractedColors = payload.colors;
            
            if (this.pendingTask === 'match') this.processMatching(extractedColors);
            else if (this.pendingTask === 'add') this.processExtraction(extractedColors);
            
            this.pendingTask = null;
            if (this.btnMatch) this.btnMatch.textContent = t('btn_kmeans_match');
            if (this.btnExtract) this.btnExtract.textContent = t('btn_kmeans_extract');
        });
    }

    updateUI() {
        const mode = state.currentMode || 'geopixels';
        const extractTrack = document.getElementById('kmeans-track-extract');
        
        if (extractTrack) extractTrack.style.display = (mode === 'geopixels') ? 'block' : 'none';

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
            if (parseInt(this.matchSlider.value) > maxCount) this.matchSlider.value = maxCount;
            if (this.matchSliderVal) this.matchSliderVal.textContent = t('unit_colors', { count: this.matchSlider.value });
        }
    }

    // 🌟 [신규 추가] 연산 시간 0초! 영수증 기반 사용량 추출 로직
    processUsageExtraction(count) {
        if (!state.latestColorCounts) {
            alert(t('msg_convert_image_first') || "먼저 이미지를 변환해야 사용량을 분석할 수 있습니다.");
            return;
        }

        const maxCount = parseInt(count, 10);
        // 영수증 데이터를 사용량(픽셀 개수) 내림차순으로 정렬하여 상위 N개만 뽑아냅니다.
        const sortedColors = Object.entries(state.latestColorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxCount)
            .map(([hex, _]) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return [r, g, b];
            });
            
        this.processExtraction(sortedColors);
    }

    sendKmeansRequest(task, count) {
        // 🌟 [핵심 변경] 원본 이미지 대신 변환/리사이징 된 이미지를 브릿지에 실어 보냅니다!
        const targetData = state.latestConversionData || state.originalImageData;
        
        if (!targetData) {
            alert(t('msg_no_image_upload_first'));
            return;
        }

        this.pendingTask = task; 
        if (task === 'match' && this.btnMatch) this.btnMatch.textContent = t('msg_matching');
        if (task === 'add' && this.btnExtract) this.btnExtract.textContent = t('msg_extracting');

        eventBus.emit('REQUEST_KMEANS_EXTRACTION', {
            options: {
                colorCount: parseInt(count, 10),
                kmeansUseOklab: true, 
                kmeansChromaBoost: 1.5 
            },
            imageData: targetData // 🌟 WorkerBridge가 이걸 받아서 쓰도록 넘겨줍니다!
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