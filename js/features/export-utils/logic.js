import { eventBus } from '../../core/EventBus.js';
import { state, rgbToHex, t } from '../../state.js';
import { wplaceFreeColors, wplacePaidColors } from '../../../data/palettes.js';
import { ExportUI } from './ui.js';

export class ExportFeature {
    constructor() {
        this.ui = new ExportUI(); // UI 클래스 연결
        
        if (this.ui.downloadBtn) {
            this.ui.downloadBtn.disabled = true;
        }

        this.initEvents();
        this.initBusListeners();
        this.updateUplaceOptionVisibility();
    }

    initBusListeners() {
        // 변환 시작 시 다운로드 버튼 비활성화
        eventBus.on('CONVERSION_START', () => {
            if (this.ui.downloadBtn) this.ui.downloadBtn.disabled = true;
        });

        // 변환 완료 시 데이터 저장 및 버튼 활성화
        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (data && data.imageData) {
                state.finalDownloadableData = data.imageData;
                if (this.ui.downloadBtn) this.ui.downloadBtn.disabled = false;
                
                // [신규] 이미지 크기에 맞춰 분할 입력창의 최대값 설정
                this.updateSplitInputLimits();
            }
        });
        
        eventBus.on('MODE_CHANGED', () => this.updateUplaceOptionVisibility());
        eventBus.on('PALETTE_UPDATED', () => this.updateUplaceOptionVisibility());
    }

    initEvents() {
        // 다운로드 버튼 클릭
        if (this.ui.downloadBtn) {
            this.ui.downloadBtn.addEventListener('click', () => {
                this.handleDownload();
            });
        }

        // [신규] 분할 다운로드 체크박스 토글 (옵션 보이기/숨기기)
        if (this.ui.chkSplit) {
            this.ui.chkSplit.addEventListener('change', (e) => {
                if (this.ui.splitOptions) {
                    this.ui.splitOptions.style.display = e.target.checked ? 'block' : 'none';
                }
            });
        }

        // [신규] 분할 입력값 유효성 검사 (이미지 크기 초과 방지)
        if (this.ui.splitCols && this.ui.splitRows) {
            const validateInput = (input) => {
                if (!state.finalDownloadableData) return;
                let val = parseInt(input.value) || 1;
                const max = input.id === 'splitCols' ? state.finalDownloadableData.width : state.finalDownloadableData.height;
                
                if (val < 1) val = 1;
                if (val > max) val = max;
                input.value = val;
            };

            this.ui.splitCols.addEventListener('change', (e) => validateInput(e.target));
            this.ui.splitRows.addEventListener('change', (e) => validateInput(e.target));
        }

        document.addEventListener('click', () => this.updateUplaceOptionVisibility());
    }

    updateSplitInputLimits() {
        if (!state.finalDownloadableData) return;
        if (this.ui.splitCols) this.ui.splitCols.max = state.finalDownloadableData.width;
        if (this.ui.splitRows) this.ui.splitRows.max = state.finalDownloadableData.height;
    }

    updateUplaceOptionVisibility() {
        if (!this.ui.chkUplace) return;
        
        const isWplaceRelated = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
        if (isWplaceRelated) {
            this.ui.chkUplace.disabled = false;
            if(this.ui.chkUplace.nextElementSibling) this.ui.chkUplace.nextElementSibling.style.color = '#555';
        } else {
            this.ui.chkUplace.disabled = true;
            this.ui.chkUplace.checked = false;
            if(this.ui.chkUplace.nextElementSibling) this.ui.chkUplace.nextElementSibling.style.color = '#ccc';
        }
    }

    getTimestamp() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const h = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${y}${m}${d}_${h}${min}`;
    }

    async handleDownload() {
        if (!state.finalDownloadableData) {
            alert(t('alert_no_data_to_download')); 
            return;
        }

        const imageData = state.finalDownloadableData;
        
        // UI 요소 체크 상태 확인
        const isUplace = this.ui.chkUplace && this.ui.chkUplace.checked;
        const isSeparated = this.ui.chkSeparated && this.ui.chkSeparated.checked;
        const isSplit = this.ui.chkSplit && this.ui.chkSplit.checked;
        
        const timestamp = this.getTimestamp();

        // 1. 아무 옵션도 없으면 기본 PNG 다운로드
        if (!isUplace && !isSeparated && !isSplit) {
            const fileName = `NOADOT_Export_${timestamp}.png`;
            this.downloadCanvasAsPng(imageData, fileName);
            return;
        }

        // 2. Uplace 다운로드 (현재는 알림만 표시)
        if (isUplace) {
            alert(t('alert_uplace_wip')); 
        }

        // 3. ZIP 파일 생성 (색상 분리 OR 도안 분할 OR 둘 다)
        if (isSeparated || isSplit) {
            if (!window.JSZip) {
                alert(t('alert_jszip_missing'));
                return;
            }

            const zip = new JSZip();

            // 색상별 분리 이미지 추가
            if (isSeparated) {
                await this.addSeparatedColorsToZip(zip, imageData);
            }

            // 도안 분할 이미지 추가
            if (isSplit) {
                await this.addSplitImagesToZip(zip, imageData);
            }

            // 최종 ZIP 다운로드
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `NOADOT_Export_${timestamp}.zip`);
        }
    }

    downloadCanvasAsPng(imageData, fileName) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => {
            saveAs(blob, fileName);
        });
    }

    // [신규 기능] 도안 분할 로직
    async addSplitImagesToZip(zip, imageData) {
        const cols = parseInt(this.ui.splitCols.value) || 2;
        const rows = parseInt(this.ui.splitRows.value) || 2;
        const maintainSize = this.ui.chkMaintainSize.checked;

        const width = imageData.width;
        const height = imageData.height;

        // 원본 이미지를 그릴 마스터 캔버스 생성
        const masterCanvas = document.createElement('canvas');
        masterCanvas.width = width;
        masterCanvas.height = height;
        masterCanvas.getContext('2d').putImageData(imageData, 0, 0);

        // ZIP 내 폴더 생성
        const folder = zip.folder("split_drafts");
        
        // 각 조각의 기본 크기 (마지막 조각은 남은 크기만큼)
        const segW = Math.floor(width / cols);
        const segH = Math.floor(height / rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // 현재 조각의 좌표와 크기 계산
                const x = c * segW;
                const y = r * segH;
                const w = (c === cols - 1) ? width - x : segW; // 마지막 열 보정
                const h = (r === rows - 1) ? height - y : segH; // 마지막 행 보정

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (maintainSize) {
                    // [옵션 4] 원본 사이즈 유지 (나머지 투명)
                    canvas.width = width;
                    canvas.height = height;
                    
                    // (소스x, 소스y, 소스w, 소스h) -> (타겟x, 타겟y, 타겟w, 타겟h)
                    // 타겟 좌표를 소스와 동일하게 주어 원래 위치에 그림
                    ctx.drawImage(masterCanvas, x, y, w, h, x, y, w, h);
                } else {
                    // [기본] 조각내서 자르기
                    canvas.width = w;
                    canvas.height = h;
                    
                    // (소스x, 소스y, 소스w, 소스h) -> (0, 0, w, h)
                    ctx.drawImage(masterCanvas, x, y, w, h, 0, 0, w, h);
                }

                // 파일 추가
                const fileName = `part_${r + 1}_${c + 1}.png`;
                const blob = await new Promise(resolve => canvas.toBlob(resolve));
                folder.file(fileName, blob);
            }
        }
    }

    // [리팩토링] 색상별 분리 로직 (기존 generateAndDownloadZip을 Zip 객체를 받도록 수정)
    async addSeparatedColorsToZip(zip, imageData) {
        const { width, height, data } = imageData;
        const colorLayers = {}; 
        
        const palette = [...wplaceFreeColors, ...wplacePaidColors];
        const isWplaceRelated = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
        const folder = zip.folder("separated_colors");

        // 픽셀 순회하며 색상별 레이어 분리
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a === 0) continue; 

            const hex = rgbToHex(r, g, b);
            
            if (!colorLayers[hex]) {
                colorLayers[hex] = {
                    buffer: new Uint8ClampedArray(width * height * 4),
                    count: 0,
                    name: null 
                };

                if (isWplaceRelated) {
                    const matched = palette.find(c => 
                        c.rgb[0] === r && c.rgb[1] === g && c.rgb[2] === b
                    );
                    colorLayers[hex].name = matched && matched.name ? matched.name : hex;
                } else {
                    colorLayers[hex].name = hex;
                }
            }

            const layer = colorLayers[hex];
            // 해당 위치에 픽셀 복사
            const idx = i;
            layer.buffer[idx] = r;
            layer.buffer[idx+1] = g;
            layer.buffer[idx+2] = b;
            layer.buffer[idx+3] = a; 
            layer.count++;
        }

        // 레이어별 이미지 생성 및 ZIP 추가
        const promises = Object.keys(colorLayers).map(hex => {
            return new Promise((resolve) => {
                const layerInfo = colorLayers[hex];
                const layerCanvas = document.createElement('canvas');
                layerCanvas.width = width;
                layerCanvas.height = height;
                const ctx = layerCanvas.getContext('2d');
                
                const imgData = new ImageData(layerInfo.buffer, width, height);
                ctx.putImageData(imgData, 0, 0);

                const safeName = layerInfo.name.replace(/[\/\\?%*:|"<>]/g, '_');
                const fileName = `${safeName} - ${layerInfo.count}.png`;

                layerCanvas.toBlob((blob) => {
                    folder.file(fileName, blob);
                    resolve();
                });
            });
        });

        await Promise.all(promises);
    }
}