// js/features/image-resizer/ui.js
export class ImageResizerUI {
    constructor() {
        this.originalDims = document.getElementById('originalDimensions');
        this.convertedDims = document.getElementById('convertedDimensions');
        this.pixelCount = document.getElementById('totalPixelCount');
        this.imageInfoPanel = document.getElementById('imageInfoPanel');
        
        this.scaleControlsFieldset = document.getElementById('scaleControlsFieldset');
        this.scaleModeSelect = document.getElementById('scaleModeSelect');
        this.ratioControls = document.getElementById('ratio-scale-controls');
        this.pixelControls = document.getElementById('pixel-scale-controls');
        
        this.scaleSlider = document.getElementById('scaleSlider');
        this.scaleValue = document.getElementById('scaleValue');
        
        this.pixelScaleSlider = document.getElementById('pixelScaleSlider');
        
        this.widthInput = document.getElementById('scaleWidth');
        this.heightInput = document.getElementById('scaleHeight');
        
        this.exportScaleSlider = document.getElementById('exportScaleSlider');
        this.exportScaleValue = document.getElementById('exportScaleValue');
        
        this.upscaleRadios = document.getElementsByName('upscaleMode');

        // [삭제됨] injectStyles() 호출 제거
        // 이제 모든 스타일은 style.css 파일에서 관리합니다.
    }

    toggleInfoPanel(show) {
        if (this.imageInfoPanel) {
            this.imageInfoPanel.style.display = show ? 'block' : 'none';
        }
    }

    // 슬라이더 동기화 로직 (이전 요청 반영 유지)
    syncSliders(currentWidth, originalWidth) {
        if (!originalWidth || originalWidth === 0) return;

        if (this.scaleSlider) {
            const ratio = currentWidth / originalWidth;
            let sliderVal = (1 - ratio) * 100;
            sliderVal = Math.max(0, Math.min(76, Math.round(sliderVal)));
            
            if (!isNaN(sliderVal)) {
                this.scaleSlider.value = sliderVal;
                if (this.scaleValue) this.scaleValue.textContent = `${ratio.toFixed(2)}x`;
            }
        }

        if (this.pixelScaleSlider) {
            const reduction = originalWidth - currentWidth;
            const val = Math.max(0, Math.round(reduction));
            if (!isNaN(val)) this.pixelScaleSlider.value = val;
        }
    }

    updateInfo(originalW, originalH, targetW, targetH, exportScale, upscaleFactor) {
        if (originalW && originalH) {
            this.originalDims.textContent = `${originalW} x ${originalH} px`;
        }

        const finalW = targetW * exportScale * upscaleFactor;
        const finalH = targetH * exportScale * upscaleFactor;
        const totalPixels = finalW * finalH;

        this.convertedDims.innerHTML = `${finalW} x ${finalH} px`;
        this.pixelCount.innerHTML = totalPixels.toLocaleString();

        // 1. 기존 효과 클래스 초기화 (항상 깨끗한 상태에서 시작)
        const effectClasses = ['neon-gold', 'neon-purple-light', 'neon-purple-dark', 'neon-red'];
        this.convertedDims.classList.remove(...effectClasses);
        this.pixelCount.classList.remove(...effectClasses);

        let suffix = '';
        let targetClass = '';

        const isExportScaled = exportScale > 1;
        const isUpscaled = upscaleFactor > 1;

        // 2. 우선순위에 따른 클래스 선택 로직
        // [수정] 폰트 색상을 다시 #333으로 복구했습니다.
        if (isExportScaled && isUpscaled) {
            // [최우선] 배율 + 업스케일 동시 적용 -> 네온 레드 (경고성/강조)
            targetClass = 'neon-red';
            suffix = `<span style="font-size:0.8em; margin-left:5px; font-weight:normal;">(${exportScale}배 + ${upscaleFactor}x EPX)</span>`;
        } 
        else if (upscaleFactor === 3) {
            // [3배 업스케일] -> 다크 퍼플
            targetClass = 'neon-purple-dark';
            suffix = `<span style="font-size:0.8em; margin-left:5px; font-weight:normal;">(3x EPX)</span>`;
        } 
        else if (upscaleFactor === 2) {
            // [2배 업스케일] -> 라이트 퍼플
            targetClass = 'neon-purple-light';
            suffix = `<span style="font-size:0.8em; margin-left:5px; font-weight:normal;">(2x EPX)</span>`;
        } 
        else if (isExportScaled) {
            // [출력 배율만] -> 골드
            targetClass = 'neon-gold';
            suffix = `<span style="font-size:0.8em; margin-left:5px; font-weight:normal;">(${exportScale}배)</span>`;
        }

        // 3. 클래스 적용
        if (targetClass) {
            this.convertedDims.classList.add(targetClass);
            this.pixelCount.classList.add(targetClass);
            this.convertedDims.innerHTML += suffix;
        }
    }

    toggleControls(enable) {
        if (this.scaleControlsFieldset) this.scaleControlsFieldset.disabled = !enable;
    }

    updateInputs(ratio, width, height) {
        if (this.scaleValue && ratio !== null) this.scaleValue.textContent = `${ratio.toFixed(2)}x`;
        if (this.widthInput) this.widthInput.value = Math.round(width);
        if (this.heightInput) this.heightInput.value = Math.round(height);
    }

    updateExportScaleLabel(val) {
        if (this.exportScaleValue) this.exportScaleValue.textContent = `${val}x`;
    }
}