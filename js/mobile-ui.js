// js/mobile-ui.js
document.addEventListener('DOMContentLoaded', () => {
    const rightPanel = document.getElementById('mainRightPanel') || document.querySelector('.right-panel');
    const navTabs = document.querySelectorAll('.nav-tab');
    
    const topModeToggleBtn = document.getElementById('topModeToggleBtn');
    const imageModeRadio = document.getElementById('imageMode');
    const textModeRadio = document.getElementById('textMode');

    const sectionMap = {
        'resize-section-group': [document.getElementById('resize-section-group')],
        'main-options-section': [document.getElementById('main-options-section'), document.getElementById('text-controls')], 
        'palette-section-group': [document.getElementById('palette-section-group')],
        'ai-preset-section': [document.getElementById('ai-preset-section')],
        'download-section': [document.querySelector('.download-section'), document.getElementById('comment-entry-section')]
    };

    function isMobile() { return window.innerWidth <= 768; }

    function updateSectionsForMobile(targetId) {
        if (!isMobile()) return;
        
        Object.values(sectionMap).forEach(elements => {
            elements.forEach(el => { if(el) el.style.display = 'none'; });
        });
        const mainSwitcher = document.querySelector('.main-mode-switcher');
        if (mainSwitcher) mainSwitcher.style.display = 'none'; 

        if (targetId && sectionMap[targetId]) {
            const isTextMode = document.getElementById('textMode')?.checked;
            sectionMap[targetId].forEach(el => { 
                if(el) {
                    if (targetId === 'main-options-section') {
                        if (isTextMode && el.id === 'text-controls') el.style.display = 'block';
                        if (!isTextMode && el.id === 'main-options-section') el.style.display = 'block';
                    } else {
                        el.style.display = 'block'; 
                    }
                }
            });
        }
    }

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-target');
            const isAlreadyOpen = tab.classList.contains('active') && rightPanel.classList.contains('sheet-open');
            
            navTabs.forEach(t => t.classList.remove('active'));
            
            if (isAlreadyOpen) {
                rightPanel.classList.remove('sheet-open'); 
            } else {
                tab.classList.add('active');
                updateSectionsForMobile(target);
                rightPanel.classList.add('sheet-open'); 
            }
        });
    });

    // 🌟 [핵심] 원버튼 클릭: 오직 원본 라디오 버튼을 '대신 클릭'만 합니다! 
    // (경고창, UI 변환, 캔버스 초기화는 전부 mode-selector가 알아서 해줍니다)
    if (topModeToggleBtn && imageModeRadio && textModeRadio) {
        topModeToggleBtn.addEventListener('click', () => {
            if (imageModeRadio.checked) textModeRadio.click();
            else imageModeRadio.click();
            
            if (rightPanel) rightPanel.classList.remove('sheet-open');
            navTabs.forEach(t => t.classList.remove('active'));
        });
    }

    // 손잡이 스와이프 다운 닫기
    const sheetHandle = document.querySelector('.sheet-handle');
    if (sheetHandle) {
        sheetHandle.addEventListener('click', () => {
            const rightPanel = document.getElementById('mainRightPanel') || document.querySelector('.right-panel');
            
            if (rightPanel) rightPanel.classList.remove('sheet-open');
            navTabs.forEach(t => t.classList.remove('active'));
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            // 1. 모바일 팝업(바텀시트) 상태 해제
            const rightPanel = document.getElementById('mainRightPanel') || document.querySelector('.right-panel');
            if (rightPanel) rightPanel.classList.remove('sheet-open');
            navTabs.forEach(t => t.classList.remove('active'));

            // 2. 공통으로 항상 보여야 하는 섹션들 숨김 해제 (인라인 스타일 제거)
            ['palette-section-group', 'ai-preset-section', 'comment-entry-section'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = ''; 
            });
            
            const downloadSec = document.querySelector('.download-section');
            if (downloadSec) downloadSec.style.display = '';
            
            const mainSwitcher = document.querySelector('.main-mode-switcher');
            if (mainSwitcher) mainSwitcher.style.display = '';

            // 3. 현재 켜져 있는 모드(이미지 or 텍스트)에 맞춰 설정창 올바르게 복구
            const isTextMode = document.getElementById('textMode')?.checked;
            const resizeSec = document.getElementById('resize-section-group');
            const imgOptions = document.getElementById('main-options-section');
            const textControls = document.getElementById('text-controls');

            if (isTextMode) {
                if (resizeSec) resizeSec.style.display = 'none';
                if (imgOptions) imgOptions.style.display = 'none';
                if (textControls) textControls.style.display = '';
            } else {
                if (resizeSec) resizeSec.style.display = '';
                if (imgOptions) imgOptions.style.display = '';
                if (textControls) textControls.style.display = 'none';
            }
        }
    });
});