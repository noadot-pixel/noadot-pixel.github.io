// js/features/export-utils/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../state.js';
import { ExportUI } from './ui.js';

export class ExportFeature {
    constructor() {
        this.ui = new ExportUI();
        this.initListeners();
        // CRC32 테이블 미리 생성 (성능 최적화)
        this.crcTable = this.makeCRCTable();
    }

    initListeners() {
        eventBus.on('CONVERSION_COMPLETE', () => {
            if (this.ui.downloadBtn) this.ui.downloadBtn.disabled = false;
        });

        eventBus.on('IMAGE_LOADED', () => {
            if (this.ui.downloadBtn) this.ui.downloadBtn.disabled = true;
        });

        if (this.ui.downloadBtn) {
            this.ui.downloadBtn.addEventListener('click', () => {
                this.handleDownload();
            });
        }
    }

    handleDownload() {
        const imageData = state.latestConversionData;
        if (!imageData) {
            alert("변환된 이미지가 없습니다.");
            return;
        }

        const scale = state.exportScale || 1;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = imageData.width * scale;
        canvas.height = imageData.height * scale;

        ctx.imageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        ctx.drawImage(
            tempCanvas, 
            0, 0, imageData.width, imageData.height, 
            0, 0, canvas.width, canvas.height
        );

        this.triggerFileDownload(canvas);
    }

    triggerFileDownload(canvas) {
        // 1. [요청 사항 2] 파일명 포맷 변경
        // Noadot_yyyy_mm_dd_hh_mm_{원본이미지이름}.png
        const originalName = state.originalFileName || 'image';
        const cleanName = originalName.replace(/\.[^/.]+$/, ""); 
        
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');

        const fileName = `Noadot_${yyyy}_${mm}_${dd}_${hh}_${min}_${cleanName}.png`;

        // 2. [요청 사항 1] 메타데이터 주입 후 다운로드
        // canvas.toBlob을 사용하여 바이너리 데이터를 얻고, tEXt 청크를 삽입합니다.
        canvas.toBlob(async (blob) => {
            if (!blob) return;

            // 메타데이터 삽입 ("noadot_image" 태그)
            const newBlob = await this.addMetadata(blob, "noadot_image", "true");
            
            // 다운로드 트리거
            const url = URL.createObjectURL(newBlob);
            const link = document.createElement('a');
            link.download = fileName;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    // --- PNG 메타데이터 조작 헬퍼 함수들 ---

    async addMetadata(blob, key, value) {
        const buffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        
        // 1. tEXt 청크 데이터 생성 (Keyword + Null + Text)
        const keyBytes = new TextEncoder().encode(key);
        const valBytes = new TextEncoder().encode(value);
        const length = keyBytes.length + 1 + valBytes.length;
        
        // 청크 구조: Length(4) + Type(4) + Data(length) + CRC(4)
        const chunkTotalLength = 4 + 4 + length + 4;
        const chunkData = new Uint8Array(chunkTotalLength);
        const view = new DataView(chunkData.buffer);
        
        // Length 작성 (Big Endian)
        view.setUint32(0, length, false);
        
        // Type 작성 ("tEXt" = 0x74455874)
        chunkData.set([116, 69, 88, 116], 4);
        
        // Data 작성
        chunkData.set(keyBytes, 8);
        chunkData[8 + keyBytes.length] = 0; // Null separator
        chunkData.set(valBytes, 8 + keyBytes.length + 1);
        
        // CRC 계산 (Type + Data 부분만 계산)
        const crcInput = chunkData.slice(4, 4 + 4 + length);
        const crc = this.calculateCRC32(crcInput);
        view.setUint32(4 + 4 + length, crc, false); // CRC 작성 (Big Endian)
        
        // 2. 청크 삽입 (IHDR 청크 뒤인 33번째 바이트 위치에 삽입)
        // PNG Signature(8) + IHDR(25) = 33
        const finalBuffer = new Uint8Array(uint8.length + chunkTotalLength);
        finalBuffer.set(uint8.slice(0, 33), 0);
        finalBuffer.set(chunkData, 33);
        finalBuffer.set(uint8.slice(33), 33 + chunkTotalLength);
        
        return new Blob([finalBuffer], { type: 'image/png' });
    }

    makeCRCTable() {
        let c;
        const table = [];
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            table[n] = c >>> 0;
        }
        return table;
    }

    calculateCRC32(buf) {
        let crc = -1; // 0xFFFFFFFF
        for (let i = 0; i < buf.length; i++) {
            crc = (crc >>> 8) ^ this.crcTable[(crc ^ buf[i]) & 0xFF];
        }
        return (crc ^ -1) >>> 0;
    }
}