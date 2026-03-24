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
    let startY = 0;
    if (sheetHandle) {
        sheetHandle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
        sheetHandle.addEventListener('touchmove', (e) => {
            if (e.touches[0].clientY - startY > 50) { 
                if (rightPanel) rightPanel.classList.remove('sheet-open');
                navTabs.forEach(t => t.classList.remove('active'));
            }
        }, { passive: true });
    }
});