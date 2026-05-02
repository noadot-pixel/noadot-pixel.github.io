// js/core/mobile.js
export class MobileUIManager {
    constructor() {
        this.sidebar = document.getElementById('slot-sidebar');
        this.navBtns = document.querySelectorAll('.nav-btn');
        this.dragHandle = document.getElementById('mobile-drag-handle');
        
        // 🌟 핵심: 유저님이 지정해주신 5개의 탭 그룹 매핑!
        this.slotMap = {
            'resizer':  ['sub-slot-resizer'],
            'engine':   ['sub-slot-engine'],
            'palette':  ['sub-slot-palettes', 'sub-slot-kmeans'], // 팔레트 관리 + 스마트 색상
            'preset':   ['sub-slot-presets'], // 빈공간 (필수)
            'download': ['sub-slot-uploader', 'sub-slot-export', 'sub-slot-comments'] // 파일 업로드 + 다운로드 옵션 통폐합
        };

        // 🌟 가로가 768px 이하이거나, 세로가 더 긴(4:5 비율 이하) 경우를 모바일로 판정
        this.mediaQuery = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 4/5)");
        
        this.initEvents();
    }

    initEvents() {
        // 1. 하단 탭 버튼 클릭
        this.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                const isAlreadyActive = btn.classList.contains('active') && this.sidebar.classList.contains('sheet-open');

                this.navBtns.forEach(b => b.classList.remove('active'));

                if (isAlreadyActive) {
                    this.sidebar.classList.remove('sheet-open');
                } else {
                    btn.classList.add('active');
                    this.switchContent(target);
                    this.sidebar.classList.add('sheet-open');
                }
            });
        });

        // 2. 바텀 시트 손잡이 클릭 시 닫기
        if (this.dragHandle) {
            this.dragHandle.addEventListener('click', () => {
                this.sidebar.classList.remove('sheet-open');
                this.navBtns.forEach(b => b.classList.remove('active'));
            });
        }

        // 3. 화면 비율/크기 변화 실시간 감지
        this.mediaQuery.addEventListener('change', (e) => this.handleResize(e.matches));
        this.handleResize(this.mediaQuery.matches); // 초기 기동 시 한번 체크
    }

    handleResize(isMobileView) {
        // 공통: 화면이 바뀌면 일단 열려있던 시트는 닫습니다.
        this.sidebar.classList.remove('sheet-open');
        this.navBtns.forEach(b => b.classList.remove('active'));

        if (!isMobileView) {
            // 🖥️ PC 화면: 모든 패널이 사이드바에 쫙 보여야 함
            Object.values(this.slotMap).flat().forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = ''; // CSS 기본값으로 복구
            });
        }
    }

    switchContent(targetKey) {
        // 모든 패널 숨기기
        Object.values(this.slotMap).flat().forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // 선택한 그룹의 패널만 켜기
        this.slotMap[targetKey].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'block';
        });

        this.sidebar.scrollTop = 0; // 탭 바꿀 때마다 스크롤 맨 위로!
    }
}