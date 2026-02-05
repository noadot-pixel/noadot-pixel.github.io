// js/features/mode-selector/ui.js
export class ModeSelectorUI {
    constructor() {
        console.log("[UI] ModeSelectorUI 초기화 중...");

        this.imageRadio = document.getElementById('mode-image') || document.getElementById('imageMode');
        this.textRadio = document.getElementById('mode-text') || document.getElementById('textMode');
        
        this.imageUploadSection = document.getElementById('image-upload-section') 
                               || document.getElementById('image-section') 
                               || document.querySelector('.image-uploader-container');

        this.textEditorSection = document.getElementById('text-input-section') 
                              || document.getElementById('text-editor-panel') 
                              || document.getElementById('text-section');

        this.imageControls = document.getElementById('image-specific-controls'); 
        this.textControls = document.getElementById('text-style-controls') || document.getElementById('text-controls');

        // [New] 크기 조절 섹션 전체 찾기 (제목 포함하여 숨기기 위해)
        // 'image-specific-controls'나 'scaleControlsFieldset'의 부모 섹션을 찾습니다.
        const controlsInner = document.getElementById('image-specific-controls') || document.getElementById('scaleControlsFieldset');
        this.resizeSection = controlsInner ? controlsInner.closest('section') : document.getElementById('resize-control-panel');

        this.placeholderText = document.querySelector('#placeholder-ui p') || document.querySelector('#placeholder-ui span');
        this.fileInput = document.getElementById('imageUpload');
    }

    updateDisplay(mode) {
        if (mode === 'image') {
            if(this.imageRadio) this.imageRadio.checked = true;
            if(this.textRadio) this.textRadio.checked = false;

            this.toggleDisplay(this.imageUploadSection, true);
            this.toggleDisplay(this.textEditorSection, false);
            
            this.toggleDisplay(this.imageControls, true);
            this.toggleDisplay(this.textControls, false);
            
            // [New] 크기 조절 섹션 보이기
            this.toggleDisplay(this.resizeSection, true);

            if (this.placeholderText) this.placeholderText.textContent = "창 클릭 혹은 이미지를 화면으로 드래그";
            if (this.fileInput) this.fileInput.disabled = false;

        } else {
            if(this.textRadio) this.textRadio.checked = true;
            if(this.imageRadio) this.imageRadio.checked = false;

            this.toggleDisplay(this.imageUploadSection, false);
            this.toggleDisplay(this.textEditorSection, true);
            
            this.toggleDisplay(this.imageControls, false);
            this.toggleDisplay(this.textControls, true);

            // [New] 크기 조절 섹션 숨기기
            this.toggleDisplay(this.resizeSection, false);

            if (this.placeholderText) this.placeholderText.textContent = "해당 화면을 통해 텍스트를 미리 확인할 수 있습니다";
            if (this.fileInput) this.fileInput.disabled = true;
        }
    }

    toggleDisplay(el, show) {
        if (el) {
            el.style.display = show ? 'block' : 'none';
        }
    }
}