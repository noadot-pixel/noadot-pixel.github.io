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
        // app.js에서 생성한 껍데기(sub-slot)들을 직접 컨트롤합니다.
        const slots = [
            'sub-slot-uploader', 
            'sub-slot-resizer', 
            'sub-slot-engine', 
            'sub-slot-palettes', 
            'sub-slot-export'
        ];

        slots.forEach(slotId => {
            const el = document.getElementById(slotId);
            if (el) {
                el.style.display = (slotId === targetId) ? 'block' : 'none';
            }
        });
    }

    // 🌟 [핵심] 화면 비율이 바뀔 때마다 실행되는 함수
    handleScreenResize() {
        const slots = [
            'sub-slot-uploader', 
            'sub-slot-resizer', 
            'sub-slot-engine', 
            'sub-slot-palettes', 
            'sub-slot-export'
        ];

        if (this.isMobile) {
            // PC -> 모바일로 좁아졌을 때
            if (!this.isInitialized) {
                this.setupMobileUI();
            } else {
                // 기존 활성화된 탭 보여주기
                const activeBtn = document.querySelector('.nav-btn.active');
                const targetId = activeBtn ? activeBtn.getAttribute('data-target') : 'sub-slot-engine';
                this.showTargetTab(targetId);
            }
        } else {
            // 🚨 모바일 -> PC로 넓어졌을 때: JS가 먹여놨던 숨김 속성(display: none)을 완전히 청소!
            slots.forEach(slotId => {
                const el = document.getElementById(slotId);
                if (el) el.style.display = ''; 
            });
            
            // 열려있던 바텀 시트 강제 닫기
            const sidebar = document.getElementById('slot-sidebar');
            if (sidebar) sidebar.classList.remove('sheet-open');
        }
    }
}