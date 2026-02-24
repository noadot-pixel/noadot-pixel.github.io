// js/features/export-utils/ui.js
export class ExportUI {
    constructor() {
        this.downloadBtn = document.getElementById('downloadBtn');
        this.chkSeparated = document.getElementById('chkDownloadSeparated');
        
        // [신규] Uplace 체크박스와 그 부모 껍데기(Wrapper)를 함께 찾습니다.
        this.chkUplace = document.getElementById('chkDownloadUplace');
        this.uplaceWrapper = this.chkUplace ? this.chkUplace.closest('.custom-checkbox-wrapper') : null;
        
        this.chkSplit = document.getElementById('chkDownloadSplit');
        this.splitOptions = document.getElementById('split-options');
        this.splitCols = document.getElementById('splitCols');
        this.splitRows = document.getElementById('splitRows');
        this.chkMaintainSize = document.getElementById('chkMaintainSize');

        // 초기 화면에서는 Uplace 다운로드 옵션을 숨겨둡니다.
        if (this.uplaceWrapper) {
            this.uplaceWrapper.style.display = 'none';
        }
    }
}