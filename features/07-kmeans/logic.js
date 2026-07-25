// js/features/07-kmeans/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, t, rgbToHex } from '../../core/state.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors, bplaceColors } from '../../data/palettes.js';

// 🌟 [신규] '커스텀 색상 자동 추출' 슬라이더(addSlider)를 절대 색상 수(1~256) 대신
// "원본 이미지의 실질 색 다양성 대비 %"로 재정의.
//   - 100% = 원본에서 실제로 쓰인(안티앨리어싱 잡음은 살짝 양자화로 걸러낸) 색 종류 수 그대로.
//     256으로 상한을 걸지 않고, 이미지가 실제로 그만큼 다양하면 max도 그만큼 커진다.
//   - 슬라이더 내부 위치는 0~ADD_SLIDER_RAW_MAX의 선형값이지만, 표시되는 %/색상 수로 변환할 때
//     거듭제곱 곡선(ADD_SLIDER_CURVE)을 먹여서 슬라이더 거리 50% 지점이 실제 색상 수의 20%가 되도록 보정하고,
//     그 이후로는 (거듭제곱 곡선의 성질상) 갈수록 더 가파르게 증가한다.
const ADD_SLIDER_RAW_MAX = 1000;
const ADD_SLIDER_CURVE = Math.log(0.2) / Math.log(0.5); // p=0.5 -> 20%가 되도록 역산한 지수 (≈2.3219)
const ADD_SLIDER_DEFAULT_PERCENT = 6; // 기존 기본값(16/256 ≈ 6%)과 감각을 맞춤
const COLOR_BASIS_QUANT_SHIFT = 3; // 8bit(256) >> 3 = 채널당 32단계로 양자화해서 안티앨리어싱 잡음 제거

export class KMeansFeature {
    constructor() {
        this.pendingTask = null;
        this.colorBasis = 256; // 이미지가 아직 없을 때의 기본 상한
        this.imageBuckets = null; // 원본 이미지가 실제로 쓴 양자화 색상 버킷 집합
        this.initEvents();
        this.initBusListeners();
    }

    // 채널당 32단계로 양자화한 버킷 키 (updateColorBasis/getRemainingColorBasis에서 공용으로 씀)
    quantizeBucket(rgb) {
        const r = rgb[0] >> COLOR_BASIS_QUANT_SHIFT;
        const g = rgb[1] >> COLOR_BASIS_QUANT_SHIFT;
        const b = rgb[2] >> COLOR_BASIS_QUANT_SHIFT;
        return (r << 10) | (g << 5) | b;
    }

    // 🌟 [신규] "이미 추가된 커스텀 색상 중, 실제로 원본 이미지에 있는 색과 겹치는 색"의 개수만큼
    // colorBasis(전체 색 다양성)에서 빼서, "아직 더 뽑아낼 수 있는 새로운 색이 얼마나 남았는지"를 max로 삼는다.
    // (원본에 없는 색을 수동으로 추가한 경우는 원본의 다양성을 갉아먹은 게 아니므로 카운트하지 않음)
    getRemainingColorBasis() {
        if (!this.imageBuckets || this.imageBuckets.size === 0) return this.colorBasis;

        const covered = new Set();
        (state.addedColors || []).forEach(c => {
            const bucket = this.quantizeBucket(c.rgb);
            if (this.imageBuckets.has(bucket)) covered.add(bucket);
        });

        return Math.max(1, this.colorBasis - covered.size);
    }

    // ── 슬라이더 위치(raw, 0~1000) <-> 퍼센트(0~100) 변환 (거듭제곱 곡선) ──
    rawToPercent(raw) {
        const p = Math.max(0, Math.min(1, raw / ADD_SLIDER_RAW_MAX));
        return Math.pow(p, ADD_SLIDER_CURVE) * 100;
    }

    percentToRaw(percent) {
        const p = Math.max(0, Math.min(1, percent / 100));
        return Math.round(Math.pow(p, 1 / ADD_SLIDER_CURVE) * ADD_SLIDER_RAW_MAX);
    }

    getAddSliderPercent() {
        if (!this.addSlider) return 0;
        return this.rawToPercent(parseInt(this.addSlider.value, 10));
    }

    // 현재 슬라이더 %가 가리키는 실제 K(추출할 색상 개수) - 이미 확보한 색은 제외한 "남은" 기준으로 계산
    getAddSliderColorCount() {
        const percent = this.getAddSliderPercent();
        const basis = this.getRemainingColorBasis();
        return Math.max(1, Math.min(basis, Math.round((percent / 100) * basis)));
    }

    updateAddSliderLabel() {
        if (!this.addSliderVal) return;
        const percent = Math.round(this.getAddSliderPercent());
        const count = this.getAddSliderColorCount();
        this.addSliderVal.textContent = t('unit_colors_percent', { percent, count });
    }

    // 🌟 pureColorCounts(원본을 리사이즈/평탄화만 한, 디더링 전 상태의 색상별 사용량)를
    // 채널당 32단계로 양자화해서 "실제로 몇 종류의 색이 쓰였는지"를 센다.
    // 정확한 24비트 RGB 고유값을 그대로 세면 안티앨리어싱 때문에 수만 개까지 뻥튀기되므로 반드시 양자화가 필요.
    // 🌟 [수정] 256 상한을 없애고, 이미지가 실제로 가진 색 다양성을 그대로 max로 사용한다.
    updateColorBasis() {
        const counts = state.pureColorCounts;
        if (!counts) { this.colorBasis = 256; this.imageBuckets = null; this.updateAddSliderLabel(); return; }

        const buckets = new Set();
        for (const hex in counts) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            buckets.add(this.quantizeBucket([r, g, b]));
        }
        this.imageBuckets = buckets;
        this.colorBasis = Math.max(1, buckets.size);
        this.updateAddSliderLabel();
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
            // 🌟 초기 슬라이더 위치를 기본 % 값에 대응하는 raw 위치로 세팅
            this.addSlider.value = this.percentToRaw(ADD_SLIDER_DEFAULT_PERCENT);
            this.addSlider.addEventListener('input', () => this.updateAddSliderLabel());
            this.updateAddSliderLabel();
        }

        // 🌟 [추가] +/- 미세 조정 버튼 이벤트 탑재!
        // addSlider는 이제 raw 위치가 아니라 %(%p 단위)로 조정하고, matchSlider는 기존처럼 색상 개수 그대로 조정한다.
        document.querySelectorAll('.adjust-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target');
                const val = parseInt(e.target.getAttribute('data-val'), 10);
                const slider = document.getElementById(targetId);
                if (!slider) return;

                if (targetId === 'addSlider') {
                    const newPercent = Math.max(0, Math.min(100, this.getAddSliderPercent() + val));
                    slider.value = this.percentToRaw(newPercent);
                    this.updateAddSliderLabel();
                } else {
                    let newVal = parseInt(slider.value, 10) + val;
                    newVal = Math.max(slider.min, Math.min(slider.max, newVal));
                    slider.value = newVal;
                    slider.dispatchEvent(new Event('input')); // 숫자 라벨과 위치 즉시 갱신
                }
            });
        });

        if (this.btnMatch) this.btnMatch.addEventListener('click', () => this.sendKmeansRequest('match', this.matchSlider.value));
        if (this.btnExtract) this.btnExtract.addEventListener('click', () => this.sendKmeansRequest('add', this.getAddSliderColorCount()));
        // 🌟 [추가] 사용량 추출 0초 컷 명령
        if (this.btnUsageExtract) this.btnUsageExtract.addEventListener('click', () => this.processUsageExtraction(this.getAddSliderColorCount()));
    }

    initBusListeners() {
        eventBus.on('PALETTE_MODE_CHANGED', () => this.updateUI());
        eventBus.on('PALETTE_UPDATED', () => this.updateUI());
        
        // 🌟 [핵심] 변환이 끝날 때마다 영수증(colorCounts)을 보관해둡니다!
        eventBus.on('CONVERSION_COMPLETE', (payload) => {
            if (payload && payload.stats) {
                state.latestColorCounts = payload.stats.colorCounts;
                // 🌟 2번 영수증을 별도로 보관합니다!
                state.pureColorCounts = payload.stats.pureColorCounts;
                // 🌟 원본이 바뀔 때마다 "실질 색 다양성" 기준(colorBasis)도 다시 계산 -> addSlider의 %가 가리키는 실제 색상 수도 갱신
                this.updateColorBasis();
            } else if (payload && payload.imageData === null) {
                state.latestColorCounts = null;
                state.pureColorCounts = null;
                this.updateColorBasis();
            }
        });

        eventBus.on('LANGUAGE_CHANGED', () => {
            if (this.matchSliderVal && this.matchSlider) this.matchSliderVal.textContent = t('unit_colors', { count: this.matchSlider.value });
            this.updateAddSliderLabel();
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
            if (mode === 'wplace') maxCount = wplaceFreeColors.length + wplacePaidColors.length;
            else if (mode === 'uplace') maxCount = uplaceColors.length;
            else if (mode === 'bplace') maxCount = bplaceColors.length;
            else if (mode === 'geopixels') {
                const customCount = (state.addedColors || []).length;
                // 🌟 geopixels에 다른 사이트 팔레트를 병합해서 쓰는 만큼 매칭 가능한 색상 수도 늘려줌
                // (예: geopixels 29개 + wplace 63개 = 102개). 이 병합은 geopixels 모드에서만 존재하는 옵션.
                let baseCount = geopixelsColors.length;
                if (state.useWplaceInGeopixels) baseCount += wplaceFreeColors.length + wplacePaidColors.length;
                if (state.useUplaceInGeopixels) baseCount += uplaceColors.length;
                if (state.useBplaceInGeopixels) baseCount += bplaceColors.length;
                maxCount = baseCount + customCount;
            }
            maxCount = Math.max(2, maxCount);
            this.matchSlider.max = maxCount;
            if (parseInt(this.matchSlider.value) > maxCount) this.matchSlider.value = maxCount;
            if (this.matchSliderVal) this.matchSliderVal.textContent = t('unit_colors', { count: this.matchSlider.value });
        }

        // 🌟 커스텀 팔레트가 늘거나 줄 때마다(추출/사용량/수동 추가·삭제 등) addSlider의 "남은 %" 기준도 즉시 갱신
        this.updateAddSliderLabel();
    }

    // 🌟 [신규 추가] 연산 시간 0초! 영수증 기반 사용량 추출 로직
    processUsageExtraction(count) {
        // 🌟 3번 영수증(latestColorCounts) 대신 2번 영수증(pureColorCounts) 사용!
        if (!state.pureColorCounts) {
            alert(t('msg_convert_image_first') || "먼저 이미지를 변환해야 사용량을 분석할 수 있습니다.");
            return;
        }

        const maxCount = parseInt(count, 10);
        // 순수 이미지의 픽셀 사용량을 바탕으로 상위 N개를 뽑아냅니다.
        const sortedColors = Object.entries(state.pureColorCounts)
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

    // 🌟 [정리] core/state.js의 공용 유틸을 그대로 위임 (여러 파일에 중복 구현되어 있던 것을 통합)
    rgbToHex(rgbArray) {
        return rgbToHex(...rgbArray);
    }

    processMatching(extractedColors) {
        const mode = state.currentMode;
        let targetPalette = [];
        
        if (mode === 'wplace') targetPalette = [...wplaceFreeColors, ...wplacePaidColors];
        else if (mode === 'uplace') targetPalette = uplaceColors;
        else if (mode === 'bplace') targetPalette = bplaceColors;
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