// js/features/image-viewer/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, rgbToHex, t, supportsCustomColors } from '../../core/state.js';
import { ImageViewerUI } from './ui.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';
import { smartResize } from '../../worker/smart-resizer.js';

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

        // 🌟 [신규] 스포이드 모드가 아니어도, 화면을 꾹 누르고 있으면(드래그와 구분) 그 자리 픽셀의 색을 보여주는 상태
        this.isHoldInspecting = false;
        this.holdTimer = null;
        this.holdTimerTouch = null;
        
        this.lastTouchDistance = 0;


        //스포이드 관련
        this.addedColorsInSession = 0;

        this.eyedropperTooltip = document.createElement('div');
        this.eyedropperTooltip.id = 'pixelHoverTooltip';
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
        const isFixedPalette = state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && state.useWplaceInGeoMode);
        
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

        eventBus.on('IMAGE_LOADED', (payload) => {
            if (!payload) return;

            // 🌟 [성능] 업로더가 이미 디코딩해 둔 ImageData/Image를 그대로 재사용해서
            // 캔버스 재-드로우 + getImageData + toDataURL 재인코딩(중복 디코딩)을 없앰.
            let rawData, imageObject;
            if (payload.imageData && payload.source) {
                rawData = payload.imageData;
                imageObject = payload.source;
            } else {
                // 방어적 fallback: Image 엘리먼트 또는 raw ImageData가 그대로 들어온 경우
                const source = payload;
                const tempCanvas = document.createElement('canvas');
                const ctx = tempCanvas.getContext('2d');

                if (source instanceof HTMLImageElement || source.tagName === 'IMG') {
                    tempCanvas.width = source.width;
                    tempCanvas.height = source.height;
                    ctx.drawImage(source, 0, 0);
                    imageObject = source;
                } else if (source.data && source.width && source.height) {
                    tempCanvas.width = source.width;
                    tempCanvas.height = source.height;
                    ctx.putImageData(source, 0, 0);
                    imageObject = new Image();
                    imageObject.src = tempCanvas.toDataURL();
                } else {
                    return;
                }
                rawData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            }

            state.originalImageData = rawData;
            state.originalImageObject = imageObject;

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

        // 🌟 [신규] 팔레트 스와치에 마우스를 올리거나(PC)/길게 누르면(모바일) 그 색이 실제로 쓰인 자리를 뷰어에서 강조
        eventBus.on('HIGHLIGHT_COLOR_REQUEST', (rgb) => this.showColorHighlight(rgb));
        eventBus.on('HIGHLIGHT_COLOR_CLEAR', () => this.clearColorHighlight());

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

        const updateDownloadVisibility = () => {
            const wrapWplace = document.getElementById('wrapDlWplace');
            const wrapUplace = document.getElementById('wrapDlUplace');
            const wrapBplace = document.getElementById('wrapDlBplace');
            const wrap3place = document.getElementById('wrapDl3place');

            if (wrapWplace) wrapWplace.style.display = (state.currentMode === 'wplace') ? 'inline-flex' : 'none';
            if (wrapUplace) wrapUplace.style.display = (state.currentMode === 'uplace') ? 'inline-flex' : 'none';
            if (wrapBplace) wrapBplace.style.display = (state.currentMode === 'bplace') ? 'inline-flex' : 'none';
            if (wrap3place) wrap3place.style.display = (state.currentMode === '3place') ? 'inline-flex' : 'none';

            // 🌟 모바일 버전의 .bplace 다운로드 항목도 bplace 팔레트를 쓰고 있을 때만 노출
            const mChkBplace = document.getElementById('m-chkDlBplace');
            const mWrapBplace = mChkBplace ? mChkBplace.closest('.m-dl-group') : null;
            const isBplaceMode = state.currentMode === 'bplace';
            if (mWrapBplace) mWrapBplace.style.display = isBplaceMode ? 'block' : 'none';
            if (mChkBplace && !isBplaceMode) {
                mChkBplace.checked = false;
                const mPopupBplace = document.getElementById('m-popupDlBplace');
                if (mPopupBplace) mPopupBplace.style.display = 'none';
            }

            // 🌟 모바일 버전의 .3place-blueprint 다운로드 항목도 3place 팔레트를 쓰고 있을 때만 노출
            const mChk3place = document.getElementById('m-chkDl3place');
            const mWrap3place = mChk3place ? mChk3place.closest('.m-dl-group') : null;
            const is3placeMode = state.currentMode === '3place';
            if (mWrap3place) mWrap3place.style.display = is3placeMode ? 'block' : 'none';
            if (mChk3place && !is3placeMode) {
                mChk3place.checked = false;
                const mPopup3place = document.getElementById('m-popupDl3place');
                if (mPopup3place) mPopup3place.style.display = 'none';
            }
        };

        eventBus.on('PALETTE_MODE_CHANGED', updateDownloadVisibility);
        eventBus.on('PALETTE_UPDATED', updateDownloadVisibility);
    }

    initInteractions() {
        const desktopBtn = document.getElementById('btnDownload');
        const mobileBtn = document.getElementById('m-btnDownload');

        const chkEditorMode = document.getElementById('chkEditorMode');
        if (chkEditorMode) {
            chkEditorMode.addEventListener('change', (e) => {
                eventBus.emit('TOGGLE_EDITOR_MODE', e.target.checked);
            });
        }

        const handleDownloadClick = () => {
            const targetData = state.latestConversionData || state.originalImageData;
            if (!targetData) {
                alert("다운로드할 이미지가 없습니다!");
                return;
            }

            // 🚨 해결 1: 변수명 오타 완벽 방어! (GeoMode와 Geopixels 둘 다 검사)
            const colorNameMap = {};
            if (state.currentMode === 'wplace' || (state.currentMode === 'geopixels' && (state.useWplaceInGeopixels || state.useWplaceInGeoMode))) {
                const palette = [...wplaceFreeColors, ...wplacePaidColors];
                palette.forEach(c => {
                    if (c.rgb) {
                        const hex = rgbToHex(...c.rgb);
                        colorNameMap[hex] = c.name;
                    }
                });
            } else if (state.currentMode === 'uplace') {
                const palette = uplaceColors || [];
                palette.forEach(c => {
                    if (c.rgb) {
                        const hex = rgbToHex(...c.rgb);
                        colorNameMap[hex] = c.name;
                    }
                });
            }

            // 🚨 해결 2: prefix 방식 폐기! PC와 모바일 체크박스 중 '하나라도' 켜져 있으면 작동하는 슈퍼 수집기
            const getChecked = (ids) => ids.some(id => document.getElementById(id)?.checked);
            const getVal = (ids, defaultVal) => {
                for (const id of ids) {
                    const el = document.getElementById(id);
                    if (el && el.value) return parseInt(el.value, 10);
                }
                return defaultVal;
            };

            const isWplace = (state.currentMode === 'wplace') && getChecked(['chkDlWplace', 'm-chkDlWplace']);
            const isUplace = (state.currentMode === 'uplace') && getChecked(['chkDlUplace', 'm-chkDlUplace']);
            const isBplace = (state.currentMode === 'bplace') && getChecked(['chkDlBplace', 'm-chkDlBplace']);
            const is3place = (state.currentMode === '3place') && getChecked(['chkDl3place', 'm-chkDl3place']);

            // 입력칸이 비어있는지 확인하는 탐지기
            const isInputEmpty = (pcId, mobileId) => {
                const pcEl = document.getElementById(pcId);
                const mEl = document.getElementById(mobileId);
                const pcVal = pcEl ? pcEl.value.trim() : '';
                const mVal = mEl ? mEl.value.trim() : '';
                return pcVal === '' && mVal === ''; // 둘 다 비어있으면 true
            };

            // 🌟 [경비원 2] Wplace 좌표 필수 입력 검사
            if (isWplace) {
                if (isInputEmpty('wplaceTileX', 'm-wplaceTileX') || isInputEmpty('wplaceTileY', 'm-wplaceTileY') ||
                    isInputEmpty('wplacePixelX', 'm-wplacePixelX') || isInputEmpty('wplacePixelY', 'm-wplacePixelY')) {
                    alert("⚠️ 다운로드 실패: Wplace 좌표 4개(TX, TY, PX, PY)를 모두 입력해주세요.");
                    return; // 함수를 즉시 멈추고 다운로드를 취소합니다.
                }
            }

            // 🌟 [경비원 3] Bplace 좌표 필수 입력 검사
            if (isBplace) {
                if (isInputEmpty('bplaceX', 'm-bplaceX') || isInputEmpty('bplaceY', 'm-bplaceY')) {
                    alert("⚠️ 다운로드 실패: Bplace 좌표 2개(X, Y)를 모두 입력해주세요.");
                    return; // 함수를 즉시 멈추고 다운로드를 취소합니다.
                }
            }

            const options = {
                currentMode: state.currentMode,
                colorNameMap: colorNameMap, // 🌟 이름 지도 탑재 완료
                
                // 배열 안에 PC 툴바 ID와 모바일 ID를 같이 넣어서 싹 긁어옵니다.
                isSeparated: getChecked(['chkDlSeparated', 'm-chkDlSeparated']),
                isSplit: getChecked(['chkDlSplit', 'm-chkDlSplit']),
                splitCols: getVal(['splitCols', 'm-splitCols'], 2),
                splitRows: getVal(['splitRows', 'm-splitRows'], 2),
                maintainSize: getChecked(['chkMaintainSize', 'm-chkMaintainSize']),

                isWplace: isWplace,
                wplaceTX: getVal(['wplaceTileX', 'm-wplaceTileX'], 0),
                wplaceTY: getVal(['wplaceTileY', 'm-wplaceTileY'], 0),
                wplacePX: getVal(['wplacePixelX', 'm-wplacePixelX'], 0),
                wplacePY: getVal(['wplacePixelY', 'm-wplacePixelY'], 0),
                
                isUplace: isUplace,

                isBplace: isBplace,
                bplaceX: getVal(['bplaceX', 'm-bplaceX'], 0),
                bplaceY: getVal(['bplaceY', 'm-bplaceY'], 0),

                // 🌟 [신규] 3Place 블루프린트 - 좌표는 사이트에서 배치 후 조정 가능하므로 필수 입력은 아니고 기본값 0
                // (PC/모바일 라디오는 같은 name을 공유하면 "기본 checked"가 서로 충돌해서 하나가 언체크되므로
                // 그룹을 완전히 분리하고, 실제로 화면에 보이는 쪽의 선택값을 읽는다 - 다운로드 버튼과 같은 방식)
                is3place: is3place,
                place3Orientation: (() => {
                    const mobileRadio = document.querySelector('input[name="m-place3Orientation"]:checked');
                    if (mobileRadio && mobileRadio.offsetParent !== null) return mobileRadio.value;
                    const pcRadio = document.querySelector('input[name="place3Orientation"]:checked');
                    return pcRadio ? pcRadio.value : 'flat';
                })(),
                place3X: getVal(['place3X', 'm-place3X'], 0),
                place3Y: getVal(['place3Y', 'm-place3Y'], 0),

                exportScale: state.exportScale || 1
            };

            const chkDlBplace = document.getElementById('chkDlBplace');
            const popupDlBplace = document.getElementById('popupDlBplace');
            if (chkDlBplace && popupDlBplace) {
                chkDlBplace.addEventListener('change', (e) => {
                    popupDlBplace.style.display = e.target.checked ? 'block' : 'none';
                });
            }
            // 🌟 Bplace 모바일 팝업 토글
            const mChkDlBplace = document.getElementById('m-chkDlBplace');
            const mPopupDlBplace = document.getElementById('m-popupDlBplace');
            if (mChkDlBplace && mPopupDlBplace) {
                mChkDlBplace.addEventListener('change', (e) => {
                    mPopupDlBplace.style.display = e.target.checked ? 'block' : 'none';
                });
            }

            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;

            // 워커로 다운로드 요청 발사!
            eventBus.emit('REQUEST_DOWNLOAD_WORKER', {
                imageData: targetData,
                options: options,
                timestamp: timestamp
            });
            
            // 🌟 PC/모바일 중 클릭된 버튼에 정확히 피드백 주기
            const clickedBtn = (mobileBtn && mobileBtn.offsetParent !== null) ? mobileBtn : desktopBtn;
            if (clickedBtn) {
                const originalText = clickedBtn.innerHTML;
                clickedBtn.innerHTML = "⌛ 처리 중...";
                setTimeout(() => clickedBtn.innerHTML = originalText, 1500);
            }
        };

        // 이벤트 리스너 바인딩 유지
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
        setupToggle('chkDl3place', 'popupDl3place');
        // 모바일 바텀시트 팝업 연결
        setupToggle('m-chkDlSplit', 'm-popupDlSplit');
        setupToggle('m-chkDlWplace', 'm-popupDlWplace');
        setupToggle('m-chkDl3place', 'm-popupDl3place');

        // 🌟 [신규] wplace.live "공유(Share)" 링크(https://wplace.live/?lat=...&lng=...)를 붙여넣으면
        // TX/TY/PX/PY를 자동으로 채워준다. 확장 스크립트(블루마블 등) 없이는 좌표가 화면에 안 보이는
        // 유저도 핀 찍고 공유 버튼만 누르면 되도록. worker/download.js의 pixelToLat/pixelToLng(지구
        // 좌표 변환 공식)를 정확히 역산한 것으로, 왕복 변환 오차 0인 걸 직접 확인했다.
        this.setupWplaceLinkPaste();

        // 🌟 [버그 수정] 3Place 배치 방향 스위치(눕혀서/세워서) - 라디오를 커스텀 스위치처럼 꾸미면서
        // 시각적으로만 숨긴(visually-hidden) input을 label로 감쌌는데, 환경에 따라 label 클릭이 감싸진
        // input을 제대로 활성화(체크)하지 못하는 경우가 있어서 직접 체크 처리하도록 명시적으로 배선한다.
        document.querySelectorAll('.dl-radio-row input[type="radio"][name$="place3Orientation"]').forEach(radio => {
            const label = radio.closest('label');
            if (!label) return;
            label.addEventListener('click', (e) => {
                e.preventDefault();
                if (!radio.checked) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

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

            // 🌟 [성능] 휠 줌 중에는 CSS transition을 꺼서 애니메이션이 밀리며 버벅이는 현상을 방지
            if (this.ui.canvas) this.ui.canvas.style.transition = 'none';
            clearTimeout(this.wheelZoomEndTimer);
            this.wheelZoomEndTimer = setTimeout(() => {
                if (this.ui.canvas) this.ui.canvas.style.transition = 'transform 0.1s ease-out';
            }, 150);

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

            // 🌟 [신규] 드래그(패닝)로 이어지지 않고 그 자리에서 꾹 누르고 있으면 픽셀 색을 보여준다
            clearTimeout(this.holdTimer);
            this.holdTimer = setTimeout(() => {
                if (!this.hasDragged) {
                    this.isHoldInspecting = true;
                    this.handlePixelHover(e);
                }
            }, 350);
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isEyedropperActive || this.isHoldInspecting) {
                // 🌟 [성능] mousemove는 초당 수십~백 회 발생하므로 rAF로 프레임당 1회만 처리
                this.lastHoverEvent = e;
                if (!this.hoverRafPending) {
                    this.hoverRafPending = true;
                    requestAnimationFrame(() => {
                        this.hoverRafPending = false;
                        this.handlePixelHover(this.lastHoverEvent);
                    });
                }
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
            clearTimeout(this.holdTimer);
            if (state.isDragging) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
            if (this.isHoldInspecting) {
                this.isHoldInspecting = false;
                this.handlePixelHover(null);
            }
        });

        container.addEventListener('touchstart', (e) => {
            if (!state.originalImageData) return;
            if (e.target.closest('button')) return;

            if (e.touches.length === 2) {
                e.preventDefault();
                state.isDragging = false;
                clearTimeout(this.holdTimerTouch); // 두 번째 손가락이 닿으면(핀치 줌) 홀드 인스펙트는 취소
                this.isHoldInspecting = false;
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

                // 🌟 [신규] 모바일에서 화면을 드래그 없이 꾹 누르고 있으면 그 자리 픽셀의 색을 보여준다
                clearTimeout(this.holdTimerTouch);
                this.holdTimerTouch = setTimeout(() => {
                    if (!this.hasDragged) {
                        this.isHoldInspecting = true;
                        this.handlePixelHover({ clientX: touch.clientX, clientY: touch.clientY });
                    }
                }, 350);
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

            if (this.isHoldInspecting && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handlePixelHover({ clientX: touch.clientX, clientY: touch.clientY });
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
            clearTimeout(this.holdTimerTouch);
            if (state.isDragging && e.touches.length === 0) {
                state.isDragging = false;
                this.ui.setGrabbing(false);
            }
            if (this.isHoldInspecting && e.touches.length === 0) {
                this.isHoldInspecting = false;
                this.handlePixelHover(null);
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

                // 🌟 [신규] "리사이징된 사이즈를 기준으로 원본 색상으로 보기" 체크 시,
                // 팔레트 매칭/디더링 없이 리사이즈만 적용한 원본 색상을 보여준다.
                if (this.ui.chkViewOriginalResized && this.ui.chkViewOriginalResized.checked && state.resizeWidth && state.resizeHeight) {
                    const resized = smartResize(state.originalImageData, state.resizeWidth, state.resizeHeight, state.resizeMode || 'average');
                    this.ui.showOriginalResizedImage(resized);
                } else {
                    this.ui.showOriginalImage();
                }
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

        const chkDlBplace = document.getElementById('chkDlBplace');
        const popupDlBplace = document.getElementById('popupDlBplace');
        if (chkDlBplace && popupDlBplace) {
            chkDlBplace.addEventListener('change', (e) => {
                popupDlBplace.style.display = e.target.checked ? 'block' : 'none';
            });
        }
        const mChkDlBplace = document.getElementById('m-chkDlBplace');
        const mPopupDlBplace = document.getElementById('m-popupDlBplace');
        if (mChkDlBplace && mPopupDlBplace) {
            mChkDlBplace.addEventListener('change', (e) => {
                mPopupDlBplace.style.display = e.target.checked ? 'block' : 'none';
            });
        }
    }

    // lat/lng -> wplace 글로벌 픽셀 좌표 역산 (worker/download.js의 pixelToLat/pixelToLng과 정확히 쌍을 이룸.
    // 왕복 변환 오차 0인 걸 직접 테스트로 확인했음)
    parseWplaceLink(text) {
        if (!text || !text.trim()) return null;
        let url;
        try {
            // 사용자가 "https://" 없이 붙여넣었을 수도 있으니 보정
            const raw = text.trim();
            url = new URL(raw.includes('://') ? raw : `https://${raw}`);
        } catch {
            return null;
        }

        const lat = parseFloat(url.searchParams.get('lat'));
        const lng = parseFloat(url.searchParams.get('lng'));
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const MAP_SIZE = 2048000;
        const x = (lng + 180) / 360 * MAP_SIZE;
        const latRad = lat * Math.PI / 180;
        const gdInv = Math.log(Math.tan(Math.PI / 4 + latRad / 2)); // 역 구데르만 함수
        const y = (MAP_SIZE / 2) * (1 - gdInv / Math.PI);

        const px = Math.floor(x), py = Math.floor(y);
        return {
            tx: Math.floor(px / 1000), px: ((px % 1000) + 1000) % 1000,
            ty: Math.floor(py / 1000), py: ((py % 1000) + 1000) % 1000
        };
    }

    // 🌟 [신규] wplace.live "공유(Share)" 링크(https://wplace.live/?lat=...&lng=...)를 붙여넣으면
    // TX/TY/PX/PY를 자동으로 채워준다. 확장 스크립트(블루마블 등) 없이는 좌표가 화면에 안 보이는
    // 유저도 핀 찍고 공유 버튼만 누르면 되도록.
    setupWplaceLinkPaste() {
        const wire = (inputId, btnId) => {
            const input = document.getElementById(inputId);
            const btn = document.getElementById(btnId);
            if (!input || !btn) return;

            const apply = () => {
                const coords = this.parseWplaceLink(input.value);
                if (!coords) { alert(t('alert_invalid_wplace_link')); return; }

                // PC/모바일 양쪽 입력칸을 전부 채워서 화면을 전환해도 값이 유지되게 한다
                [['wplaceTileX', 'm-wplaceTileX'], ['wplaceTileY', 'm-wplaceTileY'], ['wplacePixelX', 'm-wplacePixelX'], ['wplacePixelY', 'm-wplacePixelY']]
                    .forEach(([pcId, mId], i) => {
                        const val = [coords.tx, coords.ty, coords.px, coords.py][i];
                        const pcEl = document.getElementById(pcId);
                        const mEl = document.getElementById(mId);
                        if (pcEl) pcEl.value = val;
                        if (mEl) mEl.value = val;
                    });
            };

            btn.addEventListener('click', apply);
            // 붙여넣기(Ctrl+V) 직후 Enter 없이도 바로 반영되도록
            input.addEventListener('paste', () => setTimeout(apply, 0));
        };

        wire('wplaceLinkInput', 'btnWplaceLinkApply');
        wire('m-wplaceLinkInput', 'm-btnWplaceLinkApply');
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

            // 🌟 [신규] 체크박스가 켜져 있으면 스포이드도 리사이징된 사이즈의 원본 색상에서 색을 추출한다.
            // 캔버스에 실제로 그려진 픽셀에서 그대로 색을 뽑아오는 구조라 별도 좌표 보정 없이 그대로 동작한다.
            if (this.ui.chkViewOriginalResized && this.ui.chkViewOriginalResized.checked && state.resizeWidth && state.resizeHeight) {
                const resized = smartResize(state.originalImageData, state.resizeWidth, state.resizeHeight, state.resizeMode || 'average');
                this.ui.showOriginalResizedImage(resized);
            } else {
                this.ui.showOriginalImage();
            }
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
                eventBus.emit('PALETTE_UPDATED');
            }
        }
    }

    handleEyedropperPick(e) {
        if (!state.originalImageData) return;
        
        if (!supportsCustomColors(state.currentMode)) {
            alert(t('msg_eyedropper_only_geo'));
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
        const hex = rgbToHex(...rgb);

        //중복 검사 (커스텀 & 기본 팔레트)
        if (!state.addedColors) state.addedColors = [];
        const existsInCustom = state.addedColors.some(c => rgbToHex(...c.rgb) === hex);
        const baseColors = state.currentMode === 'uplace' ? uplaceColors : geopixelsColors;
        const existsInBase = baseColors.some(c => rgbToHex(...c.rgb) === hex);

        if (existsInCustom || existsInBase) {
            return;
        }

        // 장바구니에 무사히 추가!
        state.addedColors.push({ id: Date.now() + Math.random(), rgb: rgb, count: 0 });
        this.addedColorsInSession++;

        // 이제 사용자가 버튼을 다시 누르기 전까지 절대 모드가 풀리지 않습니다!
    }

    // 🌟 [신규] 특정 색이 실제로 적용된 픽셀들을 뷰어 캔버스 위에 붉은색(또는 그 색 자체가 붉은 계열이면 파란색)으로 강조
    // (중복 색상 검사 팝업의 showColorHighlight와 동일한 로직) - 캔버스에 지금 실제로 그려진 내용을 그대로 스냅샷해서 쓰므로
    // 원본/변환 뷰가 전환된 상태여도 항상 "지금 화면에 보이는 것" 기준으로 정확하게 동작한다.
    showColorHighlight(rgb) {
        if (!this.ui.canvas || !state.originalImageData) return;
        const ctx = this.ui.canvas.getContext('2d');
        const w = this.ui.canvas.width, h = this.ui.canvas.height;
        if (w === 0 || h === 0) return;

        this._highlightBaseImageData = ctx.getImageData(0, 0, w, h);
        const src = this._highlightBaseImageData;
        const highlighted = new Uint8ClampedArray(src.data);
        const [tr, tg, tb] = rgb;

        const isReddish = (tr - Math.max(tg, tb)) > 30;
        const [hr, hg, hb] = isReddish ? [0, 0, 255] : [255, 0, 0];

        for (let i = 0; i < highlighted.length; i += 4) {
            if (highlighted[i + 3] === 0) continue;
            if (highlighted[i] === tr && highlighted[i + 1] === tg && highlighted[i + 2] === tb) {
                highlighted[i] = hr; highlighted[i + 1] = hg; highlighted[i + 2] = hb;
            }
        }

        ctx.putImageData(new ImageData(highlighted, w, h), 0, 0);
    }

    clearColorHighlight() {
        if (!this._highlightBaseImageData || !this.ui.canvas) return;
        this.ui.canvas.getContext('2d').putImageData(this._highlightBaseImageData, 0, 0);
        this._highlightBaseImageData = null;
    }

    handlePixelHover(e) {
        if (!e || !state.originalImageData) {
            if (this.eyedropperTooltip) this.eyedropperTooltip.style.display = 'none';
            this.lastHoverPixel = null;
            return;
        }

        const rect = this.ui.canvas.getBoundingClientRect();
        const scaleX = this.ui.canvas.width / rect.width;
        const scaleY = this.ui.canvas.height / rect.height;
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);

        if (x >= 0 && x < this.ui.canvas.width && y >= 0 && y < this.ui.canvas.height) {
            // 🌟 [성능] 같은 픽셀 위에 머무는 동안은 getImageData/DOM 갱신을 다시 하지 않음
            const samePixel = this.lastHoverPixel && this.lastHoverPixel.x === x && this.lastHoverPixel.y === y;
            if (!samePixel) {
                const ctx = this.ui.canvas.getContext('2d');
                const p = ctx.getImageData(x, y, 1, 1).data;
                const hex = rgbToHex(p[0], p[1], p[2]);
                this.lastHoverPixel = { x, y };

                if (this.eyedropperTooltip) {
                    this.eyedropperTooltip.innerHTML = `
                        <div style="width: 16px; height: 16px; background: ${hex}; border: 1px solid rgba(255,255,255,0.8); border-radius: 4px; margin-right: 6px;"></div>
                        <span style="color: white; font-size: 0.9em; font-family: monospace;">${hex}</span>
                    `;
                }
            }

            if (this.eyedropperTooltip) {
                this.eyedropperTooltip.style.display = 'flex';
                // 마우스 커서에 가려지지 않게 살짝 우측 하단으로 이동
                this.eyedropperTooltip.style.left = (e.clientX + 15) + 'px';
                this.eyedropperTooltip.style.top = (e.clientY + 15) + 'px';
            }
        } else {
            this.lastHoverPixel = null;
            if (this.eyedropperTooltip) this.eyedropperTooltip.style.display = 'none';
        }
    }
}