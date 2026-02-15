// js/core/features/export-utils/ui.js
export class ExportUI {
    constructor() {
        this.downloadBtn = document.getElementById('downloadBtn');
        this.chkUplace = document.getElementById('chkDownloadUplace');
        this.chkSeparated = document.getElementById('chkDownloadSeparated');
        
        // [신규 참조]
        this.chkSplit = document.getElementById('chkDownloadSplit');
        this.splitOptions = document.getElementById('split-options');
        this.splitCols = document.getElementById('splitCols');
        this.splitRows = document.getElementById('splitRows');
        this.chkMaintainSize = document.getElementById('chkMaintainSize');
    }
}