// js/features/mode-selector/ui.js
import { t } from '../../state.js'; // 번역 시스템 연동

export class ModeSelectorUI {
    constructor() {
        console.log("[UI] ModeSelectorUI 초기화 중...");

        // 기존 요소들 가져오기
        this.imageRadio = document.getElementById('mode-image') || document.getElementById('imageMode');
        this.textRadio = document.getElementById('mode-text') || document.getElementById('textMode');
        
        this.imageUploadSection = document.getElementById('image-upload-section') 
                               || document.getElementById('image-section') 
                               || document.querySelector('.image-uploader-container');

        this.textEditorSection = document.getElementById('text-input-section') 
                              || document.getElementById('text-editor-panel') 
                              || document.getElementById('text-section');

        // 메인 옵션 패널 내 제어 요소 필드셋들
        this.imageControls = document.getElementById('image-specific-controls') || document.getElementById('main-options-section'); 
        this.textControls = document.getElementById('text-style-controls') || document.getElementById('text-controls');

        // 리사이즈 섹션 분리 처리
        const controlsInner = document.getElementById('image-specific-controls') || document.getElementById('scaleControlsFieldset');
        this.resizeSection = controlsInner ? controlsInner.closest('section') : document.getElementById('resize-control-panel');

        // 플레이스홀더 텍스트 및 input[type="file"]
        this.placeholderText = document.querySelector('#placeholder-ui p');
        this.fileInput = document.getElementById('imageUpload');

        this.reuploadBtn = document.getElementById('reuploadBtn');

        // 📱 [모바일 연동을 위한 요소 추가]
        this.appContainer = document.querySelector('.app-container');
        this.topModeToggleBtn = document.getElementById('topModeToggleBtn');
        this.optionsTab = document.querySelector('.nav-tab[data-target="main-options-section"]');
    }

    // 요소 표시/숨김 공통 함수
    toggleDisplay(element, show) {
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    }

    // 모드 변경에 따른 UI 전체 업데이트
    updateUI(mode) {
        if (mode === 'image') {
            // 1. 라디오 버튼 상태 업데이트
            if(this.imageRadio) this.imageRadio.checked = true;
            if(this.textRadio) this.textRadio.checked = false;

            // 2. 메인 화면 세그먼트 표시/숨김
            this.toggleDisplay(this.imageUploadSection, true);
            this.toggleDisplay(this.textEditorSection, false);

            // 3. 오른쪽 옵션 패널 내 필드셋 표시/숨김
            this.toggleDisplay(this.imageControls, true);
            this.toggleDisplay(this.textControls, false);
            
            // 리사이즈 섹션 표시
            this.toggleDisplay(this.resizeSection, true);

            // 4. 기타 UI 요소 업데이트
            if (this.placeholderText) {
                this.placeholderText.setAttribute('data-lang-key', 'placeholder_image_upload');
                this.placeholderText.textContent = t('placeholder_image_upload') || "창 클릭 혹은 이미지를 화면으로 드래그";
            }
            if (this.fileInput) this.fileInput.disabled = false;
            this.toggleDisplay(this.reuploadBtn, true);

            // 📱 모바일 컨테이너 및 버튼/탭 동기화
            if(this.appContainer) {
                this.appContainer.classList.remove('text-mode');
                this.appContainer.classList.add('image-mode');
            }
            if(this.topModeToggleBtn) {
                this.topModeToggleBtn.innerHTML = 'T'; 
                // 이미지 모드: 연한 회색 배경
                this.topModeToggleBtn.style.backgroundColor = '#f0f0f0';
                this.topModeToggleBtn.style.color = '#555';
            }
            if(this.optionsTab) {
                this.optionsTab.innerHTML = `🎛️<span data-lang-key="section_options">${t('section_options') || "변환 옵션"}</span>`;
            }

        } else if (mode === 'text') {
            // 1. 라디오 버튼 상태 업데이트
            if(this.textRadio) this.textRadio.checked = true;
            if(this.imageRadio) this.imageRadio.checked = false;

            // 2. 메인 화면 세그먼트 표시/숨김
            this.toggleDisplay(this.imageUploadSection, false);
            this.toggleDisplay(this.textEditorSection, true);

            // 3. 오른쪽 옵션 패널 내 필드셋 표시/숨김
            this.toggleDisplay(this.imageControls, false);
            this.toggleDisplay(this.textControls, true);
            
            // 리사이즈 섹션 숨김
            this.toggleDisplay(this.resizeSection, false);

            // 4. 기타 UI 요소 업데이트
            if (this.placeholderText) {
                this.placeholderText.setAttribute('data-lang-key', 'placeholder_text_preview');
                this.placeholderText.textContent = t('placeholder_text_preview') || "해당 화면을 통해 텍스트를 미리 확인할 수 있습니다";
            }
            if (this.fileInput) this.fileInput.disabled = true;
            this.toggleDisplay(this.reuploadBtn, false);
            
            // 📱 모바일 컨테이너 및 버튼/탭 동기화
            if(this.appContainer) {
                this.appContainer.classList.remove('image-mode', 'image-loaded');
                this.appContainer.classList.add('text-mode');
            }
            if(this.topModeToggleBtn) {
                this.topModeToggleBtn.innerHTML = '🖼️'; 
                // 🌟 [수정 완료] 텍스트 모드: 파란색 배경 대신, 이미지 모드와 동일하게 연한 회색 배경 적용
                this.topModeToggleBtn.style.backgroundColor = '#f0f0f0';
                this.topModeToggleBtn.style.color = '#555';
            }
            if(this.optionsTab) {
                this.optionsTab.innerHTML = `🎛️<span data-lang-key="section_text_style">${t('section_text_style') || "텍스트 설정"}</span>`;
            }
        }
    }
}