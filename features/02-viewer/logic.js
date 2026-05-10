// js/features/image-viewer/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state } from '../../core/state.js';
import { ImageViewerUI } from './ui.js';
import { geopixelsColors } from '../../data/palettes.js';

export class ImageViewerFeature {
    constructor() {
        this.ui = new ImageViewerUI();
        
        state.currentZoom = 100;
        state.panX = 0;
        state.panY = 0;
        state.isDragging = false;
        
        this.isEyedropperActive = false;
        this.startDragX = 0;
        this.startDragY = 0;
        this.hasDragged = false;
        
        this.lastTouchDistance = 0;


        //스포이드 관련
        this.addedColorsInSession = 0;

        this.eyedropperTooltip = document.createElement('div');
        this.eyedropperTooltip.style.position = 'absolute';
        this.eyedropperTooltip.style.pointerEvents = 'none';
        this.eyedropperTooltip.style.display = 'none';
        this.eyedropperTooltip.style.zIndex = '9999';
        this.eyedropperTooltip.style.background = 'rgba(0, 0, 0, 0.8)';
        this.eyedropperTooltip.style.padding = '6px 10px';
        this.eyedropperTooltip.style.borderRadius = '6px';
        this.eyedropperTooltip.style.alignItems = 'center';
        this.eyedropperTooltip.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        document.body.appendChild(this.eyedropperTooltip);

        this.initBusListeners();
        this.initInteractions();
        
        this.checkEyedropperStatus();
    }

    checkEyedropperStatus() {
        const isFixedPalette = state.currentMode === 'wplace' || state.currentMode === 'uplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.style.display = isFixedPalette ? 'none' : 'flex';
        }

        if (isFixedPalette && this.isEyedropperActive) {
            this.toggleEyedropper(false);
        }
    }

    initBusListeners() {
        eventBus.on('CONVERSION_START', () => this.ui.toggleLoading(true));
        
        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (data && data.imageData) {
                state.latestConversionData = data.imageData;
                if (!this.isEyedropperActive) {
                    this.ui.updateCanvas(data.imageData);
                    this.updateTransform();
                }
            } else if (data && data.imageData === null) {
                // 🚨 [핵심 버그 수정] index.html이 보낸 null(초기화) 신호를 받아들여 캔버스를 완벽히 비웁니다!
                this.ui.lastConvertedData = null;
                this.ui.showPlaceholder(); // 업로드 안내 문구/아이콘 강제 복구
                this.resetView();          // 화면 줌/위치 초기화
            }
            this.ui.toggleLoading(false);
        });

        eventBus.on('PALETTE_MODE_CHANGED', () => {
            // PC 버전 요소
            const wrapW = document.getElementById('wrapDlWplace');
            const wrapU = document.getElementById('wrapDlUplace');
            const chkW = document.getElementById('chkDlWplace');
            const chkU = document.getElementById('chkDlUplace');
            const popupW = document.getElementById('popupDlWplace'); 

            // 모바일 버전 요소
            const mChkW = document.getElementById('m-chkDlWplace');
            const mChkU = document.getElementById('m-chkDlUplace');
            const mWrapW = mChkW ? mChkW.closest('.m-dl-group') : null;
            const mWrapU = mChkU ? mChkU.closest('.m-dl-item') : null;
            const mPopupW = document.getElementById('m-popupDlWplace');

            const isWplace = state.currentMode === 'wplace';
            const isUplace = state.currentMode === 'uplace';

            // 1. 표시/숨김 처리 (PC)
            if (wrapW) wrapW.style.display = isWplace ? 'flex' : 'none';
            if (wrapU) wrapU.style.display = isUplace ? 'flex' : 'none';

            // 2. 표시/숨김 처리 (Mobile)
            if (mWrapW) mWrapW.style.display = isWplace ? 'block' : 'none';
            if (mWrapU) mWrapU.style.display = isUplace ? 'flex' : 'none';
            
            // 3. 다른 모드로 넘어갈 때, 남아있는 체크 속성과 팝업창 잔상 강제 해제!
            if (!isWplace) {
                if (chkW) chkW.checked = false;
                if (mChkW) mChkW.checked = false;
                if (popupW) popupW.style.display = 'none';
                if (mPopupW) mPopupW.style.display = 'none';
            }
            if (!isUplace) {
                if (chkU) chkU.checked = false;
                if (mChkU) mChkU.checked = false;
            }
        });

        eventBus.on('IMAGE_LOADED', (source) => {
            if (!source) return;
            const tempCanvas = document.createElement('canvas');
            
            if (source instanceof HTMLImageElement || source.tagName === 'IMG') {
                tempCanvas.width = source.width;
                tempCanvas.height = source.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.drawImage(source, 0, 0);
            } else if (source.data && source.width && source.height) { 
                tempCanvas.width = source.width;
                tempCanvas.height = source.height;
                const ctx = tempCanvas.getContext('2d');
                ctx.putImageData(source, 0, 0);
            }

            const ctx = tempCanvas.getContext('2d');
            const rawData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = rawData.data;

            ctx.putImageData(rawData, 0, 0);
            state.originalImageData = rawData;
            state.originalImageObject = new Image();
            state.originalImageObject.src = tempCanvas.toDataURL();

            this.resetView(); 
            this.ui.updateCanvas(state.originalImageData);
            this.ui.showCanvas();
            this.checkEyedropperStatus();
        });

        eventBus.on('TEXT_CONVERTER_UPDATED', (source) => {
            if (!source || !source.width || !source.height) return;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = source.width;
            tempCanvas.height = source.height;
            const ctx = tempCanvas.getContext('2d');
            ctx.putImageData(source, 0, 0);

            const rawData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = rawData.data;
            ctx.putImageData(rawData, 0, 0);
            
            state.originalImageData = rawData;
            state.originalImageObject = new Image();
            state.originalImageObject.src = tempCanvas.toDataURL();

            this.ui.updateCanvas(state.originalImageData);
            this.updateTransform(); 
            this.ui.showCanvas();
            this.checkEyedropperStatus();
        });

        eventBus.on('MODE_CHANGED', () => this.checkEyedropperStatus());
        eventBus.on('OPTION_CHANGED', () => this.checkEyedropperStatus());
        eventBus.on('PALETTE_UPDATED', () => this.checkEyedropperStatus());

        eventBus.on('PALETTE_MODE_CHANGED', () => {
            const wrapW = document.getElementById('wrapDlWplace');
            const wrapU = document.getElementById('wrapDlUplace');
            const chkW = document.getElementById('chkDlWplace');
            const chkU = document.getElementById('chkDlUplace');
            
            // 🌟 팝업 요소 찾아오기
            const popupW = document.getElementById('popupDlWplace'); 

            if (wrapW && wrapU) {
                // 모드에 따라 껍데기(wrapper) 숨기기/보이기
                wrapW.style.display = state.currentMode === 'wplace' ? 'flex' : 'none';
                wrapU.style.display = state.currentMode === 'uplace' ? 'flex' : 'none';
                
                // 🌟 Wplace 모드를 벗어날 때 체크 해제 + 열려있던 팝업창 강제 종료!
                if (state.currentMode !== 'wplace' && chkW) {
                    chkW.checked = false;
                    if (popupW) popupW.style.display = 'none'; // 허공에 남는 잔상 제거
                }
                
                if (state.currentMode !== 'uplace' && chkU) {
                    chkU.checked = false;
                }
            }
        });
    }

    initInteractions() {

        // ==========================================
        // 🌟 1. 다운로드 통합 로직 (PC & Mobile)
        // ==========================================
        const desktopBtn = document.getElementById('btnDownload');
        const mobileBtn = document.getElementById('m-btnDownload');

        const handleDownloadClick = () => {
            // 현재 화면에 모바일 버튼(m-btnDownload)이 보인다면 모바일 UI로 간주
            const isMobileUI = mobileBtn && mobileBtn.offsetParent !== null;
            const prefix = isMobileUI ? 'm-' : '';

            const targetData = state.latestConversionData || state.originalImageData;
            if (!targetData) {
                alert("다운로드할 이미지가 없습니다!");
                return;
            }

            // prefix('m-')를 활용해 PC/모바일 중 현재 켜진 UI의 값을 수집!
            const options = {
                currentMode: state.currentMode,
                isSeparated: document.getElementById(`${prefix}chkDlSeparated`)?.checked || false,
                isSplit: document.getElementById(`${prefix}chkDlSplit`)?.checked || false,
                splitCols: parseInt(document.getElementById(`${prefix}splitCols`)?.value || 2),
                splitRows: parseInt(document.getElementById(`${prefix}splitRows`)?.value || 2),
                maintainSize: document.getElementById(`${prefix}chkMaintainSize`)?.checked || false,
                isWplace: document.getElementById(`${prefix}chkDlWplace`)?.checked || false,
                wplaceTX: parseInt(document.getElementById(`${prefix}wplaceTileX`)?.value || 0),
                wplaceTY: parseInt(document.getElementById(`${prefix}wplaceTileY`)?.value || 0),
                wplacePX: parseInt(document.getElementById(`${prefix}wplacePixelX`)?.value || 0),
                wplacePY: parseInt(document.getElementById(`${prefix}wplacePixelY`)?.value || 0),
                isUplace: document.getElementById(`${prefix}chkDlUplace`)?.checked || false,
                
                exportScale: state.exportScale || 1
            };

            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

            // 워커로 다운로드 요청 발사!
            eventBus.emit('REQUEST_DOWNLOAD_WORKER', {
                imageData: targetData,
                options: options,
                timestamp: timestamp
            });
            
            // 누른 버튼에 시각적 피드백 주기
            const clickedBtn = isMobileUI ? mobileBtn : desktopBtn;
            if (clickedBtn) {
                const originalText = clickedBtn.innerHTML;
                clickedBtn.innerHTML = "⌛ 처리 중...";
                setTimeout(() => clickedBtn.innerHTML = originalText, 1500);
            }
        };

        if (desktopBtn) desktopBtn.addEventListener('click', handleDownloadClick);
        if (mobileBtn) mobileBtn.addEventListener('click', handleDownloadClick);

        // ==========================================
        // 🌟 2. 하위 옵션 팝업 토글 통합 로직
        // ==========================================
        const setupToggle = (chkId, popupId) => {
            const chk = document.getElementById(chkId);
            const popup = document.getElementById(popupId);
            if(chk && popup) {
                chk.addEventListener('change', (e) => {
                    popup.style.display = e.target.checked ? 'block' : 'none';
                });
            }
        };

        // PC 팝업 연결
        setupToggle('chkDlSplit', 'popupDlSplit');
        setupToggle('chkDlWplace', 'popupDlWplace');
        // 모바일 바텀시트 팝업 연결
        setupToggle('m-chkDlSplit', 'm-popupDlSplit');
        setupToggle('m-chkDlWplace', 'm-popupDlWplace');

        const container = this.ui.container;
        if (!container) return;

        if (this.ui.chkSharpResizing) {
            this.ui.chkSharpResizing.addEventListener('change', (e) => {
                this.ui.toggleImageSmoothing(e.target.checked);
            });
        }

        if (this.ui.zoomInBtn) {
            this.ui.zoomInBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.adjustZoom(10);
            });
        }
        if (this.ui.zoomOutBtn) {
            this.ui.zoomOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.adjustZoom(-10);
            });
        }

        if (this.ui.eyedropperBtn) {
            this.ui.eyedropperBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEyedropper(!this.isEyedropperActive);
            });
        }

        container.addEventListener('click', (e) => {
            if (state.originalImageData) {
                const isControl = e.target.closest('button, input, select, a, label, .top-right-ui');
                if (isControl) return; 

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, { capture: true });

        container.addEventListener('wheel', (e) => {
            if (!state.originalImageData) return;
            e.preventDefault();
            e.stopPropagation();

            const delta = -Math.sign(e.deltaY);
            const zoomSpeed = 0.15;

            let newZoom = state.currentZoom * (1 + (delta * zoomSpeed));
            newZoom = Math.max(10, Math.min(5000, newZoom)); 
            
            const rect = container.getBoundingClientRect();
            const dx = e.clientX - rect.left - (rect.width / 2);
            const dy = e.clientY - rect.top - (rect.height / 2);
            
            const scaleRatio = newZoom / state.currentZoom;
            
            state.panX = dx - (dx - state.panX) * scaleRatio;
            state.panY = dy - (dy - state.panY) * scaleRatio;

            state.currentZoom = newZoom;
            this.updateTransform();
        }, { passive: false });

        container.addEventListener('mousedown', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return;

            if (this.isEyedropperActive) {
                this.handleEyedropperPick(e);
                return;
            }

            state.isDragging = true;
            this.hasDragged = false;
            this.startDragX = e.clientX - state.panX;
            this.startDragY = e.clientY - state.panY;
            this.ui.setGrabbing(true);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isEyedropperActive) {
                this.handlePixelHover(e);
            } 
            else if (state.isDragging) {
                e.preventDefault();
                const currentX = e.clientX - this.startDragX;
                const currentY = e.clientY - this.startDragY;

                if (Math.abs(currentX - state.panX) > 2 || Math.abs(currentY - state.panY) > 2) {
                    this.hasDragged = true;
                }

                state.panX = currentX;
                state.panY = currentY;
                this.updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            if (state.isDragging) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });

        container.addEventListener('touchstart', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return;

            if (e.touches.length === 2) {
                e.preventDefault();
                state.isDragging = false;
                this.lastTouchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                return;
            }

            if (this.isEyedropperActive) {
                if (e.touches.length > 0) {
                    const touch = e.touches[0];
                    this.handleEyedropperPick({ clientX: touch.clientX, clientY: touch.clientY });
                }
                return;
            }

            if (e.touches.length === 1) {
                state.isDragging = true;
                this.hasDragged = false;
                const touch = e.touches[0];
                this.startDragX = touch.clientX - state.panX;
                this.startDragY = touch.clientY - state.panY;
                this.ui.setGrabbing(true);
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && this.lastTouchDistance > 0) {
                e.preventDefault();
                const currentDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = currentDist - this.lastTouchDistance;
                let newZoom = state.currentZoom + (delta * 1.5);
                newZoom = Math.max(10, Math.min(5000, newZoom));
                
                state.currentZoom = newZoom;
                this.updateTransform();
                this.lastTouchDistance = currentDist;
                return;
            }

            if (state.isDragging && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                state.panX = touch.clientX - this.startDragX;
                state.panY = touch.clientY - this.startDragY;
                this.updateTransform();
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) this.lastTouchDistance = 0; 
            if (state.isDragging && e.touches.length === 0) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
        });
        
        if (this.ui.centerBtn) {
            this.ui.centerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetView(); 
            });
        }

        if (this.ui.resetBtn) {
            this.ui.resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(t('confirm_reset_all_settings'))) {
                    eventBus.emit('REQUEST_RESET_ALL');
                }
            });
        }

        if (this.ui.compareBtn) {
            const showOriginal = (e) => {
                if(e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (!state.originalImageData) return;
                this.ui.showOriginalImage();
            };

            const showConverted = (e) => {
                if(e.cancelable) e.preventDefault();
                e.stopPropagation();
                if (state.latestConversionData) this.ui.showConvertedImage();
                else this.ui.showOriginalImage();
            };

            this.ui.compareBtn.addEventListener('mousedown', showOriginal);
            this.ui.compareBtn.addEventListener('mouseup', showConverted);
            this.ui.compareBtn.addEventListener('mouseleave', showConverted);
            this.ui.compareBtn.addEventListener('touchstart', showOriginal, {passive: false});
            this.ui.compareBtn.addEventListener('touchend', showConverted, {passive: false});
            this.ui.compareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }
    }

    adjustZoom(amount) {
        if (!state.originalImageData) return;
        let newZoom = state.currentZoom + amount;
        newZoom = Math.max(10, Math.min(5000, newZoom));
        state.currentZoom = newZoom;
        this.updateTransform();
    }

    updateTransform() {
        this.ui.updateTransform(state.currentZoom, state.panX, state.panY);
    }

    resetView() {
        state.currentZoom = 100;
        state.panX = 0;
        state.panY = 0;
        this.updateTransform();
    }

    toggleEyedropper(active) {
        this.isEyedropperActive = active;
        this.ui.toggleEyedropperState(active);
        
        if (active) {
            //모드 진입: 장바구니 비우기 & 원본 이미지 강제 출력
            this.addedColorsInSession = 0; 
            this.ui.showOriginalImage();
        } else {
            //모드 해제: 툴팁 끄기 & 변환된 이미지로 롤백
            this.ui.updatePixelInfo(false);
            if (this.eyedropperTooltip) this.eyedropperTooltip.style.display = 'none';
            
            if (state.latestConversionData) {
                this.ui.updateCanvas(state.latestConversionData);
            } else {
                this.ui.showConvertedImage();
            }

            if (this.addedColorsInSession > 0) {
                console.log(`[스포이드] ${this.addedColorsInSession}개의 색상이 추가되어 변환을 갱신합니다.`);
                eventBus.emit('PALETTE_UPDATED');
            }
        }
    }

    handleEyedropperPick(e) {
        if (!state.originalImageData) return;
        
        if (state.currentMode !== 'geopixels') {
            alert("⚠️ 스포이드 색상 추가는 GeoPixels 모드에서만 가능합니다.");
            return;
        }

        // 화면 확대 비율에 영향받지 않는 정확한 픽셀 추적
        const rect = this.ui.canvas.getBoundingClientRect();
        const scaleX = this.ui.canvas.width / rect.width;
        const scaleY = this.ui.canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        if (x < 0 || x >= this.ui.canvas.width || y < 0 || y >= this.ui.canvas.height) return;
        
        const ctx = this.ui.canvas.getContext('2d');
        const p = ctx.getImageData(x, y, 1, 1).data;
        
        const rgb = [p[0], p[1], p[2]];
        const hex = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
        
        //중복 검사 (커스텀 & 기본 팔레트)
        if (!state.addedColors) state.addedColors = [];
        const existsInCustom = state.addedColors.some(c => '#' + c.rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase() === hex);
        const existsInBase = geopixelsColors.some(c => '#' + c.rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase() === hex);

        if (existsInCustom || existsInBase) {
            console.log(`⚠️ 이미 팔레트에 존재하는 색상입니다: ${hex}`);
            return;
        }

        // 장바구니에 무사히 추가!
        state.addedColors.push({ id: Date.now() + Math.random(), rgb: rgb, count: 0 });
        this.addedColorsInSession++;
        console.log(`✅ 커스텀 색상 등록 완료: ${hex}`);
        
        // 이제 사용자가 버튼을 다시 누르기 전까지 절대 모드가 풀리지 않습니다!
    }

    handlePixelHover(e) {
        if (!state.originalImageData || !this.isEyedropperActive) {
            if (this.eyedropperTooltip) this.eyedropperTooltip.style.display = 'none';
            return;
        }

        const rect = this.ui.canvas.getBoundingClientRect();
        const scaleX = this.ui.canvas.width / rect.width;
        const scaleY = this.ui.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (x >= 0 && x < this.ui.canvas.width && y >= 0 && y < this.ui.canvas.height) {
            const ctx = this.ui.canvas.getContext('2d');
            const p = ctx.getImageData(x, y, 1, 1).data;
            const hex = '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

            if (this.eyedropperTooltip) {
                this.eyedropperTooltip.style.display = 'flex';
                // 마우스 커서에 가려지지 않게 살짝 우측 하단으로 이동
                this.eyedropperTooltip.style.left = (e.clientX + 15) + 'px';
                this.eyedropperTooltip.style.top = (e.clientY + 15) + 'px';
                this.eyedropperTooltip.innerHTML = `
                    <div style="width: 16px; height: 16px; background: ${hex}; border: 1px solid rgba(255,255,255,0.8); border-radius: 4px; margin-right: 6px;"></div>
                    <span style="color: white; font-size: 0.9em; font-family: monospace;">${hex}</span>
                `;
            }
        } else {
            if (this.eyedropperTooltip) this.eyedropperTooltip.style.display = 'none';
        }
    }
}