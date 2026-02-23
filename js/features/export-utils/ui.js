// js/features/export-utils/ui.js
export class ExportUI {
    constructor() {
        this.downloadBtn = document.getElementById('downloadBtn');
        
        // [오류 원인 해결!] 이 줄이 빠져서 체크박스를 인식하지 못했습니다.
        this.chkUplace = document.getElementById('chkDownloadUplace'); 
        
        this.chkSeparated = document.getElementById('chkDownloadSeparated');
        this.chkSplit = document.getElementById('chkDownloadSplit');
        this.splitOptions = document.getElementById('split-options');
        this.splitCols = document.getElementById('splitCols');
        this.splitRows = document.getElementById('splitRows');
        this.chkMaintainSize = document.getElementById('chkMaintainSize');
    }
}