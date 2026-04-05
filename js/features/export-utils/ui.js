// js/features/export-utils/ui.js
export class ExportUI {
    constructor() {
        this.downloadBtn = document.getElementById('downloadBtn');
        this.chkSeparated = document.getElementById('chkDownloadSeparated');
        
        // [기존] Uplace 체크박스와 그 부모 껍데기(Wrapper)를 함께 찾습니다.
        this.chkUplace = document.getElementById('chkDownloadUplace');
        this.uplaceWrapper = this.chkUplace ? this.chkUplace.closest('.custom-checkbox-wrapper') : null;
        
        this.chkSplit = document.getElementById('chkDownloadSplit');
        this.splitOptions = document.getElementById('split-options');
        this.splitCols = document.getElementById('splitCols');
        this.splitRows = document.getElementById('splitRows');
        this.chkMaintainSize = document.getElementById('chkMaintainSize');

        // 🌟 [신규 추가] Wplace 다운로드 관련 UI 요소들
        this.chkWplace = document.getElementById('chkDownloadWplace');
        this.wplaceWrapper = this.chkWplace ? this.chkWplace.closest('.custom-checkbox-wrapper') : null;
        
        this.wplaceCoordSection = document.getElementById('wplaceCoordSection');
        this.wplaceTileX = document.getElementById('wplaceTileX');
        this.wplaceTileY = document.getElementById('wplaceTileY');
        this.wplaceLocalX = document.getElementById('wplaceLocalX');
        this.wplaceLocalY = document.getElementById('wplaceLocalY');
        
        this.wplacePixelX = document.getElementById('wplacePixelX');
        this.wplacePixelY = document.getElementById('wplacePixelY');

        // 초기 화면에서는 특수 다운로드 옵션들을 숨겨둡니다.
        if (this.uplaceWrapper) this.uplaceWrapper.style.display = 'none';
        if (this.wplaceWrapper) this.wplaceWrapper.style.display = 'none';
    }
}