// js/events.js
import { state, CONFIG, hexToRgb } from './state.js';
import { 
    elements, updateTransform, populateColorSelects, updatePaletteStatus, updateOutputDimensionsDisplay,
    createAddedColorItem, clearAndResetInputFields, updateScaleUIVisibility, updateColorRecommendations, 
    showLoading, isColorAlreadyAdded, getOptions, updateUpscaleButtonState, getAlertMsg // updateUpscaleButtonState 추가
} from './ui.js';
import { triggerConversion, conversionWorker } from './worker-handler.js';

export const setupEventListeners = (callbacks) => {

    // ==========================================================================
    // 0. [수정됨] 변수 선언 (오류 원인 해결)
    // ==========================================================================
    // HTML ID를 JS 변수로 명시적으로 가져옵니다.
    const presetChoiceModal = document.getElementById('preset-save-choice-modal');
    const nameInputModal = document.getElementById('preset-name-input-modal');
    const nameInput = document.getElementById('preset-name-input');
    const exportScaleSelect = document.getElementById('exportScaleSelect'); // 다운로드 스케일용 (만약 있다면)

    // ==========================================================================
    // 1. 업스케일 및 프리셋 저장 관련 이벤트
    // ==========================================================================
    if (elements.compareBtn && elements.convertedCanvasContainer) {
        const canvas = elements.convertedCanvas;
        const container = elements.convertedCanvasContainer;
        
        // 오버레이용 이미지 태그 생성 (한 번만)
        let overlayImg = document.getElementById('compare-overlay-img');
        if (!overlayImg) {
            overlayImg = document.createElement('img');
            overlayImg.id = 'compare-overlay-img';
            overlayImg.style.position = 'absolute';
            overlayImg.style.zIndex = '50'; // 캔버스보다 높게
            overlayImg.style.pointerEvents = 'none'; // 클릭 통과
            overlayImg.style.display = 'none'; // 평소엔 숨김
            
            // [핵심] 캔버스와 똑같은 렌더링 방식 적용
            // 원본을 보여줄 때도 픽셀이 뭉개지지 않게 할지, 부드럽게 할지 결정
            // 보통 원본 비교는 부드럽게(bicubic) 보여주는 게 맞습니다.
            overlayImg.style.imageRendering = 'auto'; 
            
            // 캔버스 바로 뒤(또는 앞)에 형제로 추가
            // (container 안에 canvas와 overlayImg가 같이 있어야 위치 잡기 쉬움)
            canvas.parentNode.insertBefore(overlayImg, canvas.nextSibling);
        }

        const startCompare = (e) => {
            if (e.cancelable) e.preventDefault();
            if (e.type !== 'mouseenter') e.stopPropagation();

            if (!state.originalImageObject) return;

            // 1. 비율 왜곡 검사 (기존 로직 유지)
            const origRatio = state.originalImageObject.width / state.originalImageObject.height;
            const currRatio = canvas.width / canvas.height;
            if (Math.abs(origRatio - currRatio) > 0.15) {
                // showToast 함수가 정의되어 있다고 가정
                if (typeof showToast === 'function') showToast("원본 비율과 차이가 커서 비교할 수 없습니다.");
                alert(getAlertMsg('alert_2much_error'));
                return;
            }

            // 2. [핵심] 오버레이 이미지 속성 동기화
            overlayImg.src = state.originalImageObject.src;
            
            // 크기 맞춤 (CSS 크기)
            // canvas.style.width가 설정되어 있다면 그걸 따르고, 
            // 없다면 내부 픽셀 크기에 맞춰 늘려야 함.
            // 가장 확실한 건 캔버스의 현재 계산된 스타일을 가져오는 것
            const computedStyle = window.getComputedStyle(canvas);
            overlayImg.style.width = computedStyle.width;
            overlayImg.style.height = computedStyle.height;
            overlayImg.style.top = computedStyle.top;
            overlayImg.style.left = computedStyle.left;
            
            // 줌/팬 상태(transform) 복사
            overlayImg.style.transform = canvas.style.transform;
            overlayImg.style.transformOrigin = canvas.style.transformOrigin;

            // 3. 교체 (캔버스 숨기고 오버레이 보이기)
            overlayImg.style.display = 'block';
            canvas.style.opacity = '0';
            
            // 컨테이너 배경 숨기기 (옵션)
            container.classList.add('comparing');
        };

        const endCompare = (e) => {
            if (e && e.cancelable) e.preventDefault();
            
            // 복구
            if (overlayImg) overlayImg.style.display = 'none';
            if (canvas) canvas.style.opacity = '1';
            
            container.classList.remove('comparing');
        };

        const btn = elements.compareBtn;
        btn.addEventListener('mousedown', startCompare);
        btn.addEventListener('mouseup', endCompare);
        btn.addEventListener('mouseleave', endCompare);
        btn.addEventListener('touchstart', startCompare, { passive: false });
        btn.addEventListener('touchend', endCompare, { passive: false });
    }
    
    // 업스케일 라디오 버튼 (1x, 2x, 3x)
    const upscaleRadios = document.getElementsByName('upscaleMode');
    upscaleRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const scale = parseInt(e.target.value, 10);
            
            // 아직 변환된 데이터가 없으면 무시
            if (!state.originalConvertedData) return;
            
            // [Case 1] 1x (원본) 선택 시 -> 백업해둔 원본(originalConvertedData)으로 복구
            if (scale === 1) {
                // 백업 데이터를 현재 데이터로 복원
                state.latestConversionData = state.originalConvertedData;
                state.finalDownloadableData = state.originalConvertedData;
                state.currentUpscaleFactor = 1;
                state.isUpscaled = false;
                
                const canvas = elements.convertedCanvas;
                canvas.width = state.originalConvertedData.width;
                canvas.height = state.originalConvertedData.height;
                canvas.getContext('2d').putImageData(state.originalConvertedData, 0, 0);
                
                // 텍스트 업데이트 (네온 제거됨)
                updateOutputDimensionsDisplay();
            } 
            // [Case 2] 2x, 3x 선택 시 -> 원본(originalConvertedData)을 기반으로 요청
            else {
                showLoading(true);
                conversionWorker.postMessage({
                    type: 'upscaleImage',
                    // [중요] latestConversionData 대신 originalConvertedData를 보냅니다.
                    // 그래야 2배 상태에서 3배를 눌러도 "2배 x 3배"가 아니라 "1배 -> 3배"가 됩니다.
                    imageData: state.originalConvertedData, 
                    scale: scale,
                    processId: state.processId
                });
            }
        });
    });
    
    // 업스케일 버튼 (토글형)
    if (elements.upscaleBtn) {
        elements.upscaleBtn.addEventListener('click', () => {
            if (!state.finalDownloadableData) {
                alert(getAlertMsg('alert_first_gene'));
                return;
            }

            // [Case A] 이미 확대된 상태라면 -> 되돌리기 (재변환)
            if (state.isUpscaled) {
                state.isUpscaled = false; 
                if(typeof updateUpscaleButtonState === 'function') updateUpscaleButtonState(); 
                triggerConversion(); // 원본 변환 다시 실행
                return;
            }
            
            // [Case B] 원본 상태라면 -> 확대 실행 (2배)
            showLoading(true);
            conversionWorker.postMessage({
                type: 'upscaleImage',
                imageData: state.finalDownloadableData,
                scale: 2, // 기본 2배
                processId: state.processId
            });
        });
    }

    // 프리셋 저장 버튼 -> 모달 열기
    // [수정] elements 객체 사용
    if (elements.savePresetBtn) {
        elements.savePresetBtn.addEventListener('click', () => {
            if (presetChoiceModal) presetChoiceModal.classList.remove('hidden');
        });
    }

    // 모달 닫기 (X 버튼)
    const closeSaveModalBtn = document.getElementById('btn-close-save-modal');
    if (closeSaveModalBtn && presetChoiceModal) {
        closeSaveModalBtn.addEventListener('click', () => {
            presetChoiceModal.classList.add('hidden');
        });
    }

    // '추천 커스텀에 저장하기' (세션 저장)
    const btnSaveSession = document.getElementById('btn-save-to-session');
    if (btnSaveSession) {
        btnSaveSession.addEventListener('click', () => {
            const newPreset = createCurrentPresetObject("Custom Preset " + (state.sessionPresets.length + 1));
            newPreset.ranking = 'fixed';
            newPreset.displayTag = 'My Custom';
            
            state.sessionPresets.unshift(newPreset);
            
            if (presetChoiceModal) presetChoiceModal.classList.add('hidden');
            alert(getAlertMsg('alert_save_session'));
        });
    }

    // '파일로 저장하기' -> 이름 입력 모달 열기
    const btnSaveToFile = document.getElementById('btn-save-to-file');
    if (btnSaveToFile && nameInputModal) {
        btnSaveToFile.addEventListener('click', () => {
            if (presetChoiceModal) presetChoiceModal.classList.add('hidden');
            if (nameInput) nameInput.value = ''; 
            nameInputModal.classList.remove('hidden');
            if (nameInput) nameInput.focus();
        });
    }

    // 이름 입력 취소
    const btnCancelSaveFile = document.getElementById('btn-cancel-save-file');
    if (btnCancelSaveFile && nameInputModal) {
        btnCancelSaveFile.addEventListener('click', () => {
            nameInputModal.classList.add('hidden');
        });
    }

    // 이름 입력 후 실제 파일 저장
    const btnConfirmSaveFile = document.getElementById('btn-confirm-save-file');
    if (btnConfirmSaveFile) {
        btnConfirmSaveFile.addEventListener('click', () => {
            const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : "NoaDot_Preset";
            const newPreset = createCurrentPresetObject(name);
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(newPreset, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `${name}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            
            if (nameInputModal) nameInputModal.classList.add('hidden');
        });
    }

    // 헬퍼: 현재 설정으로 프리셋 객체 생성
    const createCurrentPresetObject = (name) => {
        const currentOpts = getOptions(); 
        const customColors = [];
        const userItems = document.querySelectorAll('#addedColors .added-color-item');
        userItems.forEach(item => {
            customColors.push(JSON.parse(item.dataset.rgb));
        });

        return {
            name: { ko: name, en: name },
            ranking: 'normal',
            tags: [],
            customColors: customColors,
            preset: {
                ...currentOpts,
                celShading: {
                    ...currentOpts.celShading,
                    randomSeed: 0
                },
                enableAllPalettes: true 
            }
        };
    };

    // ==========================================================================
    // 2. 파일 업로드 & 기본 조작
    // ==========================================================================
    if (elements.imageUpload) {
        elements.imageUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                callbacks.handleFile(e.target.files[0]);
            }
            e.target.value = '';
        });
        elements.imageUpload.addEventListener('click', (e) => e.target.value = '');
    }

    // 드래그 앤 드롭
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.appContainer.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
        }, false);
    });

    elements.appContainer.addEventListener('dragover', () => elements.appContainer.classList.add('drag-over'));
    elements.appContainer.addEventListener('dragleave', () => elements.appContainer.classList.remove('drag-over'));
    elements.appContainer.addEventListener('drop', (e) => {
        elements.appContainer.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files && files[0] && files[0].type.startsWith('image/')) {
            callbacks.handleFile(files[0]);
        }
    });

    // 모드 전환 (이미지 <-> 텍스트)
    if (elements.imageMode) {
        elements.imageMode.addEventListener('change', () => {
            if (callbacks.setAppMode) {
                callbacks.setAppMode('image');
                // UI 수동 제어 (필요시)
                if(elements.textEditorPanel) elements.textEditorPanel.style.display = 'none';
                if(elements.imageControls) elements.imageControls.style.display = 'grid';
                if(elements.textControls) elements.textControls.style.display = 'none';
            }
        });
    }

    if (elements.textMode) {
        elements.textMode.addEventListener('change', () => {
            if (callbacks.setAppMode) {
                callbacks.setAppMode('text');
                if(elements.textEditorPanel) elements.textEditorPanel.style.display = 'flex';
                if(elements.imageControls) elements.imageControls.style.display = 'none';
                if(elements.textControls) elements.textControls.style.display = 'block';
                
                state.originalImageObject = null;
                elements.convertedCanvasContainer.classList.remove('has-image');
                triggerConversion();
            }
        });
    }

    // 텍스트 입력
    if (elements.editorTextarea) {
        elements.editorTextarea.addEventListener('input', (e) => {
            state.textState.content = e.target.value;
            triggerConversion();
        });
    }

    if (elements.uploadFontBtn && elements.fontUpload) {
        elements.uploadFontBtn.addEventListener('click', (e) => {
            e.preventDefault(); // 혹시 모를 기본 동작 방지
            elements.fontUpload.click();
        });
    }

    // 2. 파일 선택 시 -> 폰트 로딩 처리 (script.js의 handleFontUpload 호출)
    if (elements.fontUpload) {
        elements.fontUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && callbacks.handleFontUpload) {
                callbacks.handleFontUpload(file);
            }
            // 같은 파일을 다시 올려도 작동하도록 초기화
            e.target.value = '';
        });
    }

    // 텍스트 스타일 변경
    const textControlMap = [
        { id: 'fontSelect', key: 'fontFamily' },
        { id: 'fontSizeSlider', key: 'fontSize', isNumber: true },
        { id: 'letterSpacingSlider', key: 'letterSpacing', isNumber: true },
        { id: 'paddingSlider', key: 'padding', isNumber: true },
        { id: 'strokeWidthSlider', key: 'strokeWidth', isNumber: true }
    ];

    textControlMap.forEach(item => {
        const el = elements[item.id];
        if (el) {
            // select는 change, slider는 input 이벤트 사용
            const evtType = el.tagName === 'SELECT' ? 'change' : 'input';
            
            el.addEventListener(evtType, (e) => {
                // 값 저장
                state.textState[item.key] = item.isNumber ? parseInt(e.target.value, 10) : e.target.value;
                
                // 슬라이더 숫자 표시 업데이트
                if (item.isNumber) {
                    const displayId = item.id.replace('Slider', 'Value');
                    const displayEl = document.getElementById(displayId);
                    if (displayEl) displayEl.textContent = e.target.value;
                }
                triggerConversion();
            });
        }
    });

    // 2. 색상 선택기 (드롭다운) - 별도 관리
    const textColorIds = [
        { id: 'textColorSelect', key: 'textColor' },
        { id: 'bgColorSelect', key: 'bgColor' },
        { id: 'strokeColorSelect', key: 'strokeColor' }
    ];

    textColorIds.forEach(item => {
        const el = elements[item.id];
        if (el) {
            // 드롭다운은 반드시 'change' 이벤트를 써야 함
            el.addEventListener('change', (e) => {
                state.textState[item.key] = e.target.value; // HEX 값 저장
                triggerConversion();
            });
        }
    });

    // ==========================================================================
    // 3. 팔레트 모드 및 옵션 제어
    // ==========================================================================
    const paletteRadios = document.getElementsByName('paletteMode');
    paletteRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) callbacks.setPaletteMode(e.target.value);
        });
    });

    if (elements.useWplaceInGeoMode) {
        elements.useWplaceInGeoMode.addEventListener('change', (e) => {
            const wplaceSection = document.getElementById('wplace-palette-in-geo');
            if (wplaceSection) wplaceSection.style.display = e.target.checked ? 'block' : 'none';
            updatePaletteStatus(); populateColorSelects(); triggerConversion();
        });
    }

    // 일반 슬라이더/옵션 제어
    const controlIds = [
        'scaleSlider', 'saturationSlider', 'brightnessSlider', 'contrastSlider',
        'ditheringSlider', 'ditheringAlgorithmSelect', 'patternTypeSelect', 'patternSizeSlider',
        'gradientAngleSlider', 'gradientStrengthSlider', 'highlightSensitivitySlider',
        'scaleWidth', 'scaleHeight', 'pixelScaleSlider',
        'celShadingLevelsSlider', 'celShadingColorSpaceSelect',
        'celShadingOutlineThresholdSlider', 'celShadingOutlineColorSelect', 'colorMethodSelect'
    ];

    controlIds.forEach(id => {
        const el = elements[id];
        if (el) {
            const eventType = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
            el.addEventListener(eventType, (e) => {
                const valueDisplay = document.getElementById(id.replace('Slider', 'Value').replace('Select', 'Value'));
                if (valueDisplay) {
                    valueDisplay.textContent = e.target.value;
                    if (id === 'scaleSlider') {
                         const scaleFactor = 1.0 + (parseInt(e.target.value, 10) * 0.25);
                         valueDisplay.textContent = `${scaleFactor.toFixed(2)}x`;
                    }
                }
                if (id === 'scaleSlider' || id === 'scaleWidth' || id === 'scaleHeight' || id === 'pixelScaleSlider') {
                    if (id === 'scaleSlider') callbacks.handleScaleModeChange('ratio');
                    else if (id === 'pixelScaleSlider') callbacks.updatePixelInputs('slider');
                    else if (id === 'scaleWidth') callbacks.updatePixelInputs('width');
                    else if (id === 'scaleHeight') callbacks.updatePixelInputs('height');
                } else {
                    triggerConversion();
                }
            });
        }
    });
    
    // 토글형 옵션 (패턴, 그라데이션, 만화필터)
    const toggleMap = { 
        'applyPattern': elements.patternOptions, 
        'applyGradient': elements.gradientOptions, 
        'celShadingApply': elements.celShadingOptions 
    };
    Object.entries(toggleMap).forEach(([checkboxId, optionPanel]) => {
        if (elements[checkboxId]) {
            elements[checkboxId].addEventListener('change', (e) => {
                if (optionPanel) optionPanel.style.display = e.target.checked ? 'block' : 'none';
                if (checkboxId === 'celShadingApply' && e.target.checked) populateColorSelects();
                triggerConversion();
            });
        }
    });
    
    // 외곽선 토글
    if (elements.celShadingOutline) {
        elements.celShadingOutline.addEventListener('change', (e) => {
            const subSettings = document.getElementById('outline-sub-settings');
            if (subSettings) subSettings.style.display = e.target.checked ? 'block' : 'none';
            triggerConversion();
        });
    }

    // 랜덤 시드 변경 버튼
    if (elements.celShadingRetryBtn) {
        elements.celShadingRetryBtn.addEventListener('click', () => {
            if (typeof state.celShadingSeed === 'undefined') state.celShadingSeed = 0;
            state.celShadingSeed++;
            triggerConversion();
        });
    }

    if (elements.highQualityMode) elements.highQualityMode.addEventListener('change', triggerConversion);
    if (elements.pixelatedScaling) elements.pixelatedScaling.addEventListener('change', triggerConversion);
    if (elements.scaleModeSelect) elements.scaleModeSelect.addEventListener('change', (e) => callbacks.handleScaleModeChange(e.target.value));
    
    // +/- 버튼
    document.querySelectorAll('.scale-mod-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const amount = parseInt(btn.dataset.amount, 10);
            const input = document.getElementById(targetId);
            if (input) {
                let val = parseInt(input.value, 10) || 0;
                val = Math.max(1, val + amount);
                input.value = val;
                input.dispatchEvent(new Event('input'));
            }
        });
    });

    // 리셋 버튼 (⟳)
    document.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            const slider = document.getElementById(targetId);
            if (slider) {
                slider.value = slider.getAttribute('value') || 0;
                const display = document.getElementById(targetId.replace('Slider', 'Value'));
                if (display) display.textContent = slider.value;
                triggerConversion();
            }
        });
    });

    // ==========================================================================
    // 4. 캔버스 조작 (클릭, 줌, 팬)
    // ==========================================================================
    if (elements.convertedCanvasContainer) {
        elements.convertedCanvasContainer.addEventListener('click', (e) => {
            if (state.appMode === 'text' || elements.appContainer.classList.contains('image-loaded')) return;
            if (state.appMode === 'image') {
                e.stopPropagation();
                if (elements.imageUpload) elements.imageUpload.click();
            }
        });

        // 휠 줌
        elements.convertedCanvasContainer.addEventListener('wheel', (e) => {
            if (!state.originalImageObject && !state.finalDownloadableData && state.appMode !== 'text') return;
            e.preventDefault();
            const scaleFactor = 1.1; 
            const delta = e.deltaY > 0 ? (1 / scaleFactor) : scaleFactor;
            let newZoom = (state.zoomLevel || 100) * delta;
            newZoom = Math.max(10, Math.min(2000, newZoom));
            
            if (callbacks.updateZoom) callbacks.updateZoom(newZoom);
        }, { passive: false });

        // 드래그
        let isDragging = false;
        let startX, startY;
        elements.convertedCanvasContainer.addEventListener('mousedown', (e) => {
            const hasContent = state.originalImageObject || state.finalDownloadableData || (state.appMode === 'text' && state.textState.content);
            if (e.button === 0 && hasContent) {
                isDragging = true;
                startX = e.clientX - state.panX;
                startY = e.clientY - state.panY;
                elements.convertedCanvasContainer.style.cursor = 'grabbing';
            }
        });
        window.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                state.panX = e.clientX - startX;
                state.panY = e.clientY - startY;
                updateTransform();
            }
        });
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                elements.convertedCanvasContainer.style.cursor = 'grab';
            }
        });
    }
    
    if (elements.centerBtn) {
        elements.centerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.panX = 0; state.panY = 0; state.zoomLevel = 100;
            const display = document.getElementById('zoomLevelDisplay');
            if (display) display.textContent = '100%';
            updateTransform();
        });
    }

    // ==========================================================================
    // 5. 색상 추가 및 기타 버튼
    // ==========================================================================
    if (elements.addColorBtn) {
        elements.addColorBtn.addEventListener('click', () => {
            const hexInput = elements.addHex.value.trim();
            const rInput = elements.addR.value;
            const gInput = elements.addG.value;
            const bInput = elements.addB.value;

            let colorsToAdd = [];

            // ---------------------------------------------------------
            // Case 1: RGB 입력칸(숫자칸)을 사용한 경우
            // ---------------------------------------------------------
            if (rInput && gInput && bInput) {
                colorsToAdd.push([parseInt(rInput), parseInt(gInput), parseInt(bInput)]);
            }
            
            // ---------------------------------------------------------
            // Case 2: HEX 입력칸(텍스트칸)을 사용한 경우 (스마트 파싱)
            // ---------------------------------------------------------
            else if (hexInput) {
                // 2-1. HEX 코드 패턴 찾기 (# 붙거나 안 붙은 6자리 영문/숫자)
                // 예: "#FF0000 #00FF00" 또는 "FF0000, 00FF00"
                const hexMatches = hexInput.match(/#?([0-9A-Fa-f]{6})/g);

                if (hexMatches && hexMatches.length > 0) {
                    // HEX 코드가 발견되면 전부 추가
                    hexMatches.forEach(hex => {
                        // #이 없으면 붙여서 변환
                        const formatted = hex.startsWith('#') ? hex : '#' + hex;
                        const rgbObj = hexToRgb(formatted);
                        if (rgbObj) colorsToAdd.push([rgbObj.r, rgbObj.g, rgbObj.b]);
                    });
                } 
                // 2-2. HEX가 없다면 숫자 추출 시도 (RGB 모드)
                // 예: "R:12 G:255 B:100", "12, 255, 100", "12 255 100"
                else {
                    // 문자열에서 숫자만 싹 긁어모음
                    const numbers = hexInput.match(/\d+/g);
                    
                    if (numbers && numbers.length >= 3) {
                        // 3개씩 묶어서 RGB로 인식
                        for (let i = 0; i < numbers.length; i += 3) {
                            if (i + 2 < numbers.length) {
                                const r = parseInt(numbers[i]);
                                const g = parseInt(numbers[i+1]);
                                const b = parseInt(numbers[i+2]);
                                
                                // 유효성 검사 (0~255)
                                if (r <= 255 && g <= 255 && b <= 255) {
                                    colorsToAdd.push([r, g, b]);
                                }
                            }
                        }
                    }
                }
            }

            // ---------------------------------------------------------
            // 결과 처리: 찾은 색상들 모두 등록
            // ---------------------------------------------------------
            if (colorsToAdd.length > 0) {
                let addedCount = 0;
                colorsToAdd.forEach(rgb => {
                    // tryAddColor는 중복 체크 후 추가 성공 시 true 반환
                    if (callbacks.tryAddColor(rgb)) {
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    // 성공 시 입력창 비우기 및 갱신
                    if (callbacks.clearAndResetInputFields) callbacks.clearAndResetInputFields();
                    populateColorSelects();
                    
                    // 1개면 조용히 넘어가고, 여러 개면 알림
                    if (addedCount > 1) {
                        let message = getAlertMsg('alert_palette_imported');
    
                        // 2. 문장 안의 '{n}'을 실제 숫자(addedCount)로 바꿔치기 합니다.
                        // (결과: "5개의 색상을 불러왔습니다." 또는 "5 colors imported.")
                        message = message.replace('{n}', addedCount);
                        
                        // 3. 완성된 문장을 띄웁니다.
                        alert(message);
                    }
                } else {
                    // 이미 다 있는 색상이면
                    if (elements.hexInputFeedback) elements.hexInputFeedback.textContent = '이미 추가된 색상입니다.';
                }
            } else {
                // 파싱 실패
                if (elements.hexInputFeedback) elements.hexInputFeedback.textContent = '유효한 색상 형식이 아닙니다.';
            }
        });
    }
    
    if (elements.resetAddedColorsBtn) {
        elements.resetAddedColorsBtn.addEventListener('click', () => {
            if (callbacks.resetAddedColors) callbacks.resetAddedColors();
        });
    }

    if (elements.exportPaletteBtn) {
        elements.exportPaletteBtn.addEventListener('click', () => {
            const items = elements.addedColorsContainer.querySelectorAll('.added-color-item');
            if (items.length === 0) { alert(getAlertMsg('alert_no_color_to_export')); return; }
            const colors = Array.from(items).map(item => JSON.parse(item.dataset.rgb));
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(colors));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "noadot_palette.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    }

    if (elements.loadPresetBtn && elements.presetUpload) {
        elements.loadPresetBtn.addEventListener('click', () => {
            elements.presetUpload.click(); // 숨겨진 <input type="file"> 실행
        });
    }

    // 2. [파일 처리] 사용자가 파일을 선택하면 -> 읽어서 적용함
    if (elements.presetUpload) {
        elements.presetUpload.addEventListener('change', (e) => {
            // 선택된 파일 가져오기
            const file = e.target.files[0];
            if (!file) return; // 파일이 없으면 취소

            // 파일을 읽는 도구 생성
            const reader = new FileReader();

            // 다 읽었을 때 실행할 일
            reader.onload = (event) => {
                try {
                    // 1. 텍스트를 JSON 객체로 변환
                    const presetData = JSON.parse(event.target.result);
                    
                    // 2. 전역 함수 applyPreset 실행 (script.js에 있는 함수)
                    if (typeof window.applyPreset === 'function') {
                        window.applyPreset(presetData);
                        alert(getAlertMsg('alert_preset_applied'));
                    } else {
                        console.error("❌ 오류: applyPreset 함수를 찾을 수 없습니다.");
                        alert(getAlertMsg('alert_logic_error'));
                    }
                } catch (err) {
                    console.error("파일 파싱 오류:", err);
                    alert(getAlertMsg('alert_preset_error'));
                }
            };
            
            // 파일 읽기 시작! (텍스트 형식으로)
            reader.readAsText(file);
            
            // (중요) 같은 파일을 다시 선택해도 작동하도록 입력값 초기화
            e.target.value = '';
        });
    }

    if (elements.importPaletteBtn) elements.importPaletteBtn.addEventListener('click', () => elements.paletteUpload.click());
    if (elements.paletteUpload) {
        elements.paletteUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedColors = JSON.parse(event.target.result);
                    if (Array.isArray(importedColors)) {
                        let addedCount = 0;
                        importedColors.forEach(rgb => {
                            if (!isColorAlreadyAdded(rgb)) { createAddedColorItem(rgb, true, triggerConversion); addedCount++; }
                        });
                        if (addedCount > 0) { 
                            const msg = getAlertMsg('alert_palette_imported');
                            alert(msg.replace('{n}', addedCount));
                            updatePaletteStatus(); populateColorSelects(); triggerConversion(); 
                        } else alert(getAlertMsg('alert_no_addcolor'));
                    } else alert(getAlertMsg('alert_long_filecode'));
                } catch (err) { alert(getAlertMsg('alert_error_general') + err.message); }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // 프리셋 추천 버튼
    if (elements.getStyleRecommendationsBtn) {
        elements.getStyleRecommendationsBtn.addEventListener('click', () => {
            if (!state.originalImageObject) return;
            showLoading(true);
            elements.getStyleRecommendationsBtn.disabled = true;
            
            const tempC = document.createElement('canvas');
            tempC.width = state.originalImageObject.width;
            tempC.height = state.originalImageObject.height;
            const ctx = tempC.getContext('2d');
            ctx.drawImage(state.originalImageObject, 0, 0);
            const originalData = ctx.getImageData(0, 0, tempC.width, tempC.height);

            let currentPalette = [];
            const activeBtns = document.querySelectorAll('.color-button[data-on="true"], .added-color-item[data-on="true"]');
            activeBtns.forEach(btn => {
                if (!btn.classList.contains('all-toggle-btn')) currentPalette.push(JSON.parse(btn.dataset.rgb));
            });

            conversionWorker.postMessage({
                type: 'getStyleRecommendations',
                imageData: originalData,
                palette: currentPalette,
                options: getOptions(),
                processId: state.processId
            }, [originalData.data.buffer]);
        });
    }
    
    // 프리셋 보관함 버튼
    if (elements.myPresetsBtn) {
        elements.myPresetsBtn.addEventListener('click', () => {
            if (!state.originalImageObject) {
                alert(getAlertMsg('alert_no_image'));
                return;
            }
            if (state.sessionPresets.length === 0) {
                alert(getAlertMsg('alert_unload_preset'));
                return;
            }

            showLoading(true);
            const tempC = document.createElement('canvas');
            tempC.width = state.originalImageObject.width;
            tempC.height = state.originalImageObject.height;
            const ctx = tempC.getContext('2d');
            ctx.drawImage(state.originalImageObject, 0, 0);
            const originalData = ctx.getImageData(0, 0, tempC.width, tempC.height);

            let currentPalette = [];
            const activeBtns = document.querySelectorAll('.color-button[data-on="true"], .added-color-item[data-on="true"]');
            activeBtns.forEach(btn => {
                if (!btn.classList.contains('all-toggle-btn')) currentPalette.push(JSON.parse(btn.dataset.rgb));
            });

            conversionWorker.postMessage({
                type: 'getStyleRecommendations',
                imageData: originalData,
                palette: currentPalette,
                options: getOptions(),
                extraPresets: state.sessionPresets,
                onlyCustom: true, 
                processId: state.processId
            }, [originalData.data.buffer]);
        });
    }

    if (elements.closePresetPopupBtn) elements.closePresetPopupBtn.addEventListener('click', () => elements.presetPopupContainer.classList.add('hidden'));
    
    // 다국어 버튼
    document.querySelectorAll('#language-switcher button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            if (callbacks.setLanguage) callbacks.setLanguage(lang);
        });
    });

    // 출력 배율 슬라이더
    if (elements.exportScaleSlider) {
    elements.exportScaleSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.exportScale = val;
        if (elements.exportScaleValue) elements.exportScaleValue.textContent = `${val}x`;
        updateOutputDimensionsDisplay();
        // [추가] 텍스트 정보 즉시 갱신 (JS 모듈에서 import 해와야 함)
        // 만약 ui.js에서 import { updateOutputDimensionsDisplay } from './ui.js' 했다면:
        if (callbacks.updateOutputDimensionsDisplay) {
             callbacks.updateOutputDimensionsDisplay();
        } else {
            // callbacks에 없다면 import한 함수 직접 호출 (구조에 따라 다름)
             updateOutputDimensionsDisplay(); 
        }
    });
}

    // 다운로드 버튼 (이벤트 교체 방식)
    if (elements.downloadBtn) {
        const newDownloadBtn = elements.downloadBtn.cloneNode(true);
        elements.downloadBtn.parentNode.replaceChild(newDownloadBtn, elements.downloadBtn);
        elements.downloadBtn = newDownloadBtn; 

        elements.downloadBtn.addEventListener('click', () => {
            if (callbacks.downloadImageWithScale) {
                const name = state.originalFileName || 'image';
                callbacks.downloadImageWithScale(name);
            }
        });
    }
};