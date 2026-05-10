import { ComponentLoader } from '../ComponentLoader.js';

export class MobileManager {
    constructor() {
        this.mediaQuery = window.matchMedia("(max-width: 768px), (max-aspect-ratio: 4/5)");
        this.isMobile = this.mediaQuery.matches;
        this.isInitialized = false;
    }

    async init() {
        // 🌟 1. 실시간 화면 비율 변경 감지 (PC <-> 모바일 전환)
        this.mediaQuery.addEventListener('change', (e) => {
            this.isMobile = e.matches;
            this.handleScreenResize();
        });

        // 🌟 2. 처음에 접속했을 때 모바일 환경이면 즉시 장착
        if (this.isMobile) {
            await this.setupMobileUI();
        }
    }

    async setupMobileUI() {
        if (this.isInitialized) return; // 중복 실행 방지
        
        console.log("📱 모바일 환경 감지! 모바일 UI를 장착합니다.");
        
        const mobileUiSlot = document.createElement('div');
        mobileUiSlot.id = 'slot-mobile-ui';
        document.body.appendChild(mobileUiSlot);
        await ComponentLoader.load('slot-mobile-ui', 'core/mobile/mobile.html');

        this.rearrangeDOM();
        this.bindEvents();
        
        // 처음 렌더링 시 '변환(engine)' 탭 기본 표시
        this.showTargetTab('sub-slot-engine');
        
        this.isInitialized = true;
    }

    rearrangeDOM() {
        const zoomDisplay = document.getElementById('zoomLevelDisplay');
        if (zoomDisplay) {
            zoomDisplay.style.top = '10px';
            zoomDisplay.style.left = '10px';
        }

        const sidebar = document.getElementById('slot-sidebar');
        const handle = document.getElementById('mobile-drag-handle');
        if (sidebar && handle) {
            sidebar.insertBefore(handle, sidebar.firstChild);
        }
    }

    bindEvents() {
        const navBtns = document.querySelectorAll('.nav-btn');
        const sidebar = document.getElementById('slot-sidebar');
        const handle = document.getElementById('mobile-drag-handle');

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                
                if (btn.classList.contains('active') && sidebar.classList.contains('sheet-open')) {
                    closeSheet();
                    return;
                }
                
                // 버튼 시각적 활성화
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 타겟 패널 표시 및 바텀 시트 열기
                this.showTargetTab(targetId);
                sidebar.classList.add('sheet-open');
            });
        });

        // 시트 닫기 로직
        const closeSheet = () => {
            sidebar.classList.remove('sheet-open');
            navBtns.forEach(b => b.classList.remove('active'));
        };

        if (handle) handle.addEventListener('click', closeSheet);
        document.getElementById('slot-viewer')?.addEventListener('touchstart', closeSheet, { passive: true });
    }

    showTargetTab(targetId) {
        const allSlots = [
            'sub-slot-uploader', 
            'sub-slot-resizer', 
            'sub-slot-engine', 
            'sub-slot-palettes', 
            'sub-slot-kmeans',
            'sub-slot-export',
            'sub-slot-comments',
            'sub-slot-download'
        ];

        // 🌟 2. 켜야 할 패널들을 담을 장바구니 (기본적으로 누른 탭 1개)
        let slotsToShow = [targetId];

        // 🌟 2. 1+1 짝꿍 맺어주기 대잔치
        // 크기 변경 탭을 누르면 업로드 패널도 같이 켜기 (DOM 구조상 업로드가 위, 크기가 아래로 자동 배치됩니다)
        if (targetId === 'sub-slot-resizer') {
            slotsToShow.push('sub-slot-uploader');
        }
        // 팔레트 탭을 누르면 K-Means 같이 켜기
        if (targetId === 'sub-slot-palettes') {
            slotsToShow.push('sub-slot-kmeans');
        }

        if (targetId === 'sub-slot-download') {
            slotsToShow.push('sub-slot-comments');
        }

        // 저장 탭을 누르면 댓글 같이 켜기
        if (targetId === 'sub-slot-export') {
            slotsToShow.push('sub-slot-comments');
        }

        // 🌟 3. 장바구니에 있는 건 켜고, 없는 건 끕니다.
        allSlots.forEach(slotId => {
            const el = document.getElementById(slotId);
            if (el) {
                el.style.display = slotsToShow.includes(slotId) ? 'block' : 'none';
            }
        });
    }

    // 🌟 [핵심] 화면 비율이 바뀔 때마다 실행되는 함수
    handleScreenResize() {
        // 여기도 모든 슬롯 목록으로 업데이트
        const allSlots = [
            'sub-slot-uploader', 
            'sub-slot-resizer', 
            'sub-slot-engine', 
            'sub-slot-palettes', 
            'sub-slot-kmeans', 
            'sub-slot-export',
            'sub-slot-comments',
            'sub-slot-download',
            'sub-slot-presets'
        ];

        if (this.isMobile) {
            // PC -> 모바일로 좁아졌을 때
            if (!this.isInitialized) {
                this.setupMobileUI();
            } else {
                const activeBtn = document.querySelector('.nav-btn.active');
                const targetId = activeBtn ? activeBtn.getAttribute('data-target') : 'sub-slot-engine';
                this.showTargetTab(targetId);
            }
        } else {
            // 🚨 모바일 -> PC로 넓어졌을 때: K-Means와 댓글까지 포함해서 숨김 속성을 완전히 청소!
            allSlots.forEach(slotId => {
                const el = document.getElementById(slotId);
                if (el) el.style.display = ''; 
            });
            
            const sidebar = document.getElementById('slot-sidebar');
            if (sidebar) sidebar.classList.remove('sheet-open');
        }
    }
}