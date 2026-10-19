import { ComponentLoader } from '../ComponentLoader.js';

// 🌟 [정리] showTargetTab()과 handleScreenResize()가 이 목록을 각자 따로 들고 있어서
// 서로 다르게 드리프트되어 있었음(sub-slot-presets 누락, 존재하지 않는 sub-slot-export 잔존) -> 하나로 통합.
const MOBILE_TAB_SLOTS = [
    'sub-slot-uploader',
    'sub-slot-resizer',
    'sub-slot-engine',
    'sub-slot-layers',
    'sub-slot-palettes',
    'sub-slot-kmeans',
    'sub-slot-comments',
    'sub-slot-download'
];

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
        // 변환(engine) 탭을 누르면 레이어 패널도 같이 켜기 (4번째 네비 버튼을 새로 만들지 않고 짝꿍으로 추가)
        if (targetId === 'sub-slot-engine') {
            slotsToShow.push('sub-slot-layers');
        }

        if (targetId === 'sub-slot-download') {
            slotsToShow.push('sub-slot-comments');
        }

        // 🌟 3. 장바구니에 있는 건 켜고, 없는 건 끕니다.
        MOBILE_TAB_SLOTS.forEach(slotId => {
            const el = document.getElementById(slotId);
            if (el) {
                el.style.display = slotsToShow.includes(slotId) ? 'block' : 'none';
            }
        });
    }

    // 🌟 [핵심] 화면 비율이 바뀔 때마다 실행되는 함수
    handleScreenResize() {
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
            // 🌟 [수정] sub-slot-download(모바일 전용 다운로드 패널)는 데스크탑 화면에 노출될 트리거가
            // 전혀 없으므로, display를 비워서 되돌리지 말고 항상 숨김(none) 상태를 유지시킴.
            MOBILE_TAB_SLOTS.forEach(slotId => {
                const el = document.getElementById(slotId);
                if (!el) return;
                el.style.display = (slotId === 'sub-slot-download') ? 'none' : '';
            });


            const sidebar = document.getElementById('slot-sidebar');
            if (sidebar) sidebar.classList.remove('sheet-open');
        }
    }
}