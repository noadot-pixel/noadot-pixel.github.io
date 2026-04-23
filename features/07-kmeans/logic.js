import { eventBus } from '../../core/EventBus.js';
import { state } from '../../core/state.js';
// 🌟 팔레트 비교를 위해 고정 팔레트 원본 데이터 수입
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';

export class KMeansFeature {
    constructor() {
        this.pendingTask = null; // 방금 누른 버튼이 'match'인지 'add'인지 기억하는 메모장
        this.initEvents();
        this.initBusListeners();
    }

    initEvents() {
        // 트랙 1 요소 (매칭)
        this.matchSlider = document.getElementById('matchSlider');
        this.matchSliderVal = document.getElementById('matchSliderVal');
        this.btnMatch = document.getElementById('btnKmeansMatch');

        // 트랙 2 요소 (추출 추가)
        this.addSlider = document.getElementById('addSlider');
        this.addSliderVal = document.getElementById('addSliderVal');
        this.btnExtract = document.getElementById('btnKmeansExtract');
        this.track2Container = document.getElementById('kmeans-track-2');

        // 슬라이더 숫자 동기화
        if (this.matchSlider) {
            this.matchSlider.addEventListener('input', (e) => {
                if (this.matchSliderVal) this.matchSliderVal.textContent = `${e.target.value}색`;
            });
        }
        if (this.addSlider) {
            this.addSlider.addEventListener('input', (e) => {
                if (this.addSliderVal) this.addSliderVal.textContent = `${e.target.value}색`;
            });
        }

        // 버튼 클릭 이벤트 (목적에 따라 다른 task 꼬리표를 붙여서 전송)
        if (this.btnMatch) {
            this.btnMatch.addEventListener('click', () => this.sendKmeansRequest('match', this.matchSlider.value));
        }
        if (this.btnExtract) {
            this.btnExtract.addEventListener('click', () => this.sendKmeansRequest('add', this.addSlider.value));
        }
    }

    initBusListeners() {
        // 팔레트 탭이 바뀌거나 색상이 추가되면 UI(슬라이더 맥스값, 표시 여부) 업데이트!
        eventBus.on('PALETTE_MODE_CHANGED', () => this.updateUI());
        eventBus.on('PALETTE_UPDATED', () => this.updateUI());
        
        // 🌟 워커가 추출을 끝내고 돌아왔을 때의 처리 (모든 계산은 여기서!)
        eventBus.on('KMEANS_EXTRACTION_COMPLETE', (payload) => {
            if (!payload || !payload.colors) return;
            const extractedColors = payload.colors;
            
            // 내가 시켰던 일(pendingTask)에 따라 분기 처리
            if (this.pendingTask === 'match') {
                this.processMatching(extractedColors);
            } else if (this.pendingTask === 'add') {
                this.processExtraction(extractedColors);
            }
            
            // 버튼 상태 원상복구
            this.pendingTask = null;
            if (this.btnMatch) this.btnMatch.textContent = "🎯 이미지와 매칭하여 팔레트 최적화";
            if (this.btnExtract) this.btnExtract.textContent = "✨ 추출한 색상을 커스텀에 추가";
        });
    }

    // [UI 업데이트 로직]
    updateUI() {
        const mode = state.currentMode || 'geopixels';
        
        // 1. 트랙 2(추출/추가)는 GeoPixels 탭에서만 보이게 숨김 처리
        if (this.track2Container) {
            this.track2Container.style.display = (mode === 'geopixels') ? 'block' : 'none';
        }

        // 2. 트랙 1(매칭) 슬라이더의 물리적 MAX 값 조절
        if (this.matchSlider) {
            let maxCount = 16; 
            if (mode === 'wplace') maxCount = 63;
            else if (mode === 'uplace') maxCount = 127;
            else if (mode === 'geopixels') {
                // GeoPixels는 기본 29색 + 사용자가 추가한 색상 수
                const customCount = (state.addedColors || []).length;
                maxCount = 29 + customCount;
            }
            
            maxCount = Math.max(2, maxCount);
            this.matchSlider.max = maxCount;
            
            // 만약 현재 슬라이더 값이 바뀐 MAX보다 크면 깎아내림
            if (parseInt(this.matchSlider.value) > maxCount) {
                this.matchSlider.value = maxCount;
            }
            if (this.matchSliderVal) this.matchSliderVal.textContent = `${this.matchSlider.value}색`;
        }
    }

    sendKmeansRequest(task, count) {
        if (!state.originalImageData) {
            alert("먼저 이미지를 업로드해주세요!");
            return;
        }

        this.pendingTask = task; // 방아쇠 목적 저장
        if (task === 'match' && this.btnMatch) this.btnMatch.textContent = "⌛ 매칭 분석 중...";
        if (task === 'add' && this.btnExtract) this.btnExtract.textContent = "⌛ 추출 중...";

        eventBus.emit('REQUEST_KMEANS_EXTRACTION', {
            options: {
                colorCount: parseInt(count, 10),
                kmeansUseOklab: true, 
                kmeansChromaBoost: 1.5 
            }
        });
    }

    // HEX 변환 도우미 함수 (팔레트 UI와 독립하기 위해 내장)
    rgbToHex(rgbArray) {
        return '#' + rgbArray.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    // 🎯 [트랙 01] 매칭 및 비활성화 처리 (사용량 0인 색상 끄기)
    processMatching(extractedColors) {
        const mode = state.currentMode;
        let targetPalette = [];
        
        // 현재 탭에 맞는 후보군 준비
        if (mode === 'wplace') targetPalette = [...wplaceFreeColors, ...wplacePaidColors];
        else if (mode === 'uplace') targetPalette = uplaceColors;
        else if (mode === 'geopixels') targetPalette = [...geopixelsColors, ...(state.addedColors || [])];

        const matchedHexes = new Set();
        
        // 1. K-Means가 뽑은 색상들과 가장 가까운 기존 팔레트 색상 찾기 (유클리드 거리)
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

        // 2. 전체 팔레트 목록 중 매칭되지 않은 녀석들만 모아서 감옥(disabledHexes)에 넣기!
        const allTargetHexes = targetPalette.map(c => this.rgbToHex(c.rgb));
        state.disabledHexes = allTargetHexes.filter(hex => !matchedHexes.has(hex));

        console.log(`[트랙1: 매칭완료] 목표: ${extractedColors.length}색 / 실제 활성화: ${matchedHexes.size}색 유지`);
        
        // 팔레트 쪽에 "데이터 갱신됐으니 화면 새로 그려라!" 하고 알림 발송
        eventBus.emit('PALETTE_UPDATED');
    }

    // ✨ [트랙 02] 커스텀 색상 자동 추출 및 추가
    processExtraction(extractedColors) {
        if (state.currentMode !== 'geopixels') return;
        if (!state.addedColors) state.addedColors = [];
        
        let addedCount = 0;
        extractedColors.forEach(rgb => {
            const hex = this.rgbToHex(rgb);
            
            // 1. 사용자가 이미 추가해 둔 커스텀 팔레트에 있는지 확인
            const existsInCustom = state.addedColors.some(c => this.rgbToHex(c.rgb) === hex);
            // 2. 🌟 GeoPixels 기본 팔레트(29색)에 이미 존재하는 색인지 확인!
            const existsInBase = geopixelsColors.some(c => this.rgbToHex(c.rgb) === hex);

            // 두 곳 모두에 없을 때만 추가!
            if (!existsInCustom && !existsInBase) {
                state.addedColors.push({ id: Date.now() + Math.random(), rgb: rgb, count: 0 });
                addedCount++;
            }
        });
        
        console.log(`[트랙2: 추출완료] ${addedCount}개의 색상이 자동 추가되었습니다.`);
        eventBus.emit('PALETTE_UPDATED');
    }
}