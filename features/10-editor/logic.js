import { eventBus } from '../../core/EventBus.js';
import { state } from '../../core/state.js';

export class PixelEditorFeature {
    constructor() {
        this.isActive = false;
        this.initBusListeners();
    }

    initBusListeners() {
        eventBus.on('TOGGLE_EDITOR_MODE', (isON) => {
            this.isActive = isON;
            const editorSlot = document.getElementById('sub-slot-editor');

            if (isON) {
                // 1. 에디터 켜기 (안전 검사)
                if (!state.latestConversionData) {
                    alert("먼저 이미지를 업로드하고 변환해주세요!");
                    document.getElementById('chkEditorMode').checked = false;
                    this.isActive = false;
                    return;
                }

                // 🌟 [핵심] 원본 훼손 방지를 위한 비파괴 복제(Clone) 생성!
                const src = state.latestConversionData.data;
                const clonedData = new Uint8ClampedArray(src);
                state.editorWorkingData = new ImageData(clonedData, state.latestConversionData.width, state.latestConversionData.height);

                // 2. 다른 메뉴들 전부 숨기고 에디터 띄우기 (통제권 획득)
                this.lockOtherModules(true);
                editorSlot.style.display = 'block';

                // (TODO) 마스터 팔레트 긁어오기 로직 호출 예정
                console.log("✏️ 에디터 모드 ON: 비파괴 복제본 캔버스 준비 완료!");

            } else {
                // 3. 에디터 끄기 (휴지통 버리기 및 권한 반환)
                state.editorWorkingData = null; 
                this.lockOtherModules(false);
                editorSlot.style.display = 'none';

                // 4. 복사본이 치워졌으니 깨끗한 원래 이미지로 캔버스 새로고침
                eventBus.emit('CONVERSION_COMPLETE', { imageData: state.latestConversionData });
                console.log("🔙 에디터 모드 OFF: 복제본 폐기 및 원상 복구 완료.");
            }
        });
    }

    // 다른 사이드바 메뉴들을 숨기고/보여주는 함수
    lockOtherModules(isLocked) {
        const slotsToLock = [
            'sub-slot-uploader', 
            'sub-slot-resizer', 
            'sub-slot-engine', 
            'sub-slot-palettes', 
            'sub-slot-kmeans'
        ];

        slotsToLock.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // 부드러운 전환을 위한 CSS 추가
                el.style.transition = 'opacity 0.3s, filter 0.3s';
                
                if (isLocked) {
                    el.style.pointerEvents = 'none'; // 클릭 방지
                    el.style.opacity = '0.3';       // 투명도 낮춤
                    el.style.filter = 'grayscale(100%)'; // 흑백 처리
                } else {
                    el.style.pointerEvents = 'auto'; // 복구
                    el.style.opacity = '1';
                    el.style.filter = 'none';
                }
            }
        });
    }
}