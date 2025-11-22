// js/events.js
import { state, CONFIG, hexToRgb } from './state.js';
import { 
    elements, updateTransform, populateColorSelects, updatePaletteStatus, 
    createAddedColorItem, clearAndResetInputFields, updateScaleUIVisibility,
    showLoading, isColorAlreadyAdded, getOptions
} from './ui.js';
import { triggerConversion, conversionWorker } from './worker-handler.js';

export const setupEventListeners = (callbacks) => {
    // ==========================================================================
    // 1. 파일 업로드 및 드래그 앤 드롭 (중복 방지 강화)
    // ==========================================================================
    
    // (1) 실제 input 변경 시 실행
    elements.imageUpload.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            callbacks.handleFile(e.target.files[0]);
        }
        e.target.value = ''; // 재선택 가능하게 초기화
    });

    // (2) 클릭 시에도 값 초기화 (안전장치)
    elements.imageUpload.addEventListener('click', (e) => {
        e.target.value = '';
    });

    // (3) 드래그 앤 드롭 영역
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.appContainer.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
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

    // ==========================================================================
    // 2. 모드 전환 (이미지 <-> 텍스트) 및 UI 리셋
    // ==========================================================================
    
    // 이미지 모드로 전환
    elements.imageMode.addEventListener('change', () => {
        if (callbacks.setAppMode) {
            callbacks.setAppMode('image'); 
            
            // UI 패널 표시 상태 변경
            if(elements.textEditorPanel) elements.textEditorPanel.style.display = 'none';
            if(elements.imageControls) elements.imageControls.style.display = 'grid'; // flex 대신 grid 사용 권장
            if(elements.textControls) elements.textControls.style.display = 'none';
            
            // 캔버스 초기화
            const canvas = elements.convertedCanvas;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            elements.convertedCanvasContainer.classList.remove('has-image');
            
            // 업로드 버튼 활성화
            elements.imageUpload.disabled = false;
        }
    });

    // 텍스트 모드로 전환
    elements.textMode.addEventListener('change', () => {
        if (callbacks.setAppMode) {
            callbacks.setAppMode('text');
            
            // UI 패널 표시 상태 변경
            if(elements.textEditorPanel) elements.textEditorPanel.style.display = 'flex';
            if(elements.imageControls) elements.imageControls.style.display = 'none';
            if(elements.textControls) elements.textControls.style.display = 'block';
            
            // 이미지 모드의 잔재 삭제
            state.originalImageObject = null;
            const canvas = elements.convertedCanvas;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            elements.convertedCanvasContainer.classList.remove('has-image');
            
            // 텍스트 모드 진입 시 즉시 변환 트리거 (미리보기용)
            triggerConversion();
        }
    });

    // [신규] 텍스트 입력 실시간 감지 (이게 없어서 텍스트가 안 나왔던 것임)
    if (elements.editorTextarea) {
        elements.editorTextarea.addEventListener('input', (e) => {
            state.textState.content = e.target.value;
            triggerConversion(); // 입력할 때마다 변환 요청
        });
    }

    // [신규] 텍스트 스타일 옵션 변경 감지
    const textStyleIds = [
        'fontSelect', 'fontSizeSlider', 'letterSpacingSlider', 'paddingSlider', 
        'strokeWidthSlider', 'textColorSelect', 'bgColorSelect', 'strokeColorSelect'
    ];
    
    textStyleIds.forEach(id => {
        const el = elements[id];
        if (el) {
            el.addEventListener('input', (e) => {
                // 값 표시 라벨 업데이트
                const display = document.getElementById(id.replace('Slider', 'Value'));
                if (display) display.textContent = el.value;
                
                // state 업데이트 (필요 시)
                const key = id.replace('Select', '').replace('Slider', '');
                if (state.textState.hasOwnProperty(key)) {
                    state.textState[key] = (el.type === 'range') ? parseInt(el.value) : el.value;
                }
                triggerConversion();
            });
        }
    });

    // ==========================================================================
    // 3. 팔레트 및 옵션 컨트롤
    // ==========================================================================

    // 팔레트 모드 전환
    const paletteRadios = document.getElementsByName('paletteMode');
    paletteRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) callbacks.setPaletteMode(e.target.value);
        });
    });

    // Wplace 체크박스
    if (elements.useWplaceInGeoMode) {
        elements.useWplaceInGeoMode.addEventListener('change', (e) => {
            const wplaceSection = document.getElementById('wplace-palette-in-geo');
            if (wplaceSection) wplaceSection.style.display = e.target.checked ? 'block' : 'none';
            updatePaletteStatus();
            populateColorSelects();
            triggerConversion();
        });
    }

    // 슬라이더 & 셀렉트 변경 이벤트
    const controlIds = [
        'scaleSlider', 'saturationSlider', 'brightnessSlider', 'contrastSlider',
        'ditheringSlider', 'ditheringAlgorithmSelect', 
        'patternTypeSelect', 'patternSizeSlider',
        'gradientAngleSlider', 'gradientStrengthSlider',
        'highlightSensitivitySlider',
        'scaleWidth', 'scaleHeight', 'pixelScaleSlider',
        'celShadingLevelsSlider', 'celShadingColorSpaceSelect',
        'celShadingOutlineThresholdSlider', 'celShadingOutlineColorSelect'
    ];

    controlIds.forEach(id => {
        const el = elements[id];
        if (el) {
            const eventType = (el.tagName === 'SELECT' || el.type === 'checkbox') ? 'change' : 'input';
            el.addEventListener(eventType, (e) => {
                // 값 표시 업데이트
                const valueDisplay = document.getElementById(id.replace('Slider', 'Value').replace('Select', 'Value'));
                if (valueDisplay) {
                    valueDisplay.textContent = e.target.value;
                    if (id === 'scaleSlider') {
                         const scaleFactor = 1.0 + (parseInt(e.target.value, 10) * 0.25);
                         valueDisplay.textContent = `${scaleFactor.toFixed(2)}x`;
                    }
                }
                
                // 스케일 모드 등 특수 처리
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
    
    // 체크박스 토글 (UI 숨김/표시)
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
    
    // 외곽선 UI 토글
    if (elements.celShadingOutline) {
        elements.celShadingOutline.addEventListener('change', (e) => {
            const subSettings = document.getElementById('outline-sub-settings');
            if (subSettings) subSettings.style.display = e.target.checked ? 'block' : 'none';
            triggerConversion();
        });
    }

    // 버튼 이벤트
    if (elements.celShadingRetryBtn) {
        elements.celShadingRetryBtn.addEventListener('click', () => {
            if (typeof state.celShadingSeed === 'undefined') state.celShadingSeed = 0;
            state.celShadingSeed++;
            triggerConversion();
        });
    }

    if (elements.highQualityMode) elements.highQualityMode.addEventListener('change', triggerConversion);
    if (elements.pixelatedScaling) elements.pixelatedScaling.addEventListener('change', triggerConversion);
    
    if (elements.scaleModeSelect) {
        elements.scaleModeSelect.addEventListener('change', (e) => callbacks.handleScaleModeChange(e.target.value));
    }
    
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
    // 4. 캔버스 조작 (클릭 업로드, 줌, 이동)
    // ==========================================================================
    
    if (elements.convertedCanvasContainer) {
        
        // [수정됨] 클릭하여 업로드 (중복 방지: stopPropagation)
        elements.convertedCanvasContainer.addEventListener('click', (e) => {
            // 텍스트 모드거나 이미지가 이미 있으면 클릭 무시
            if (state.appMode === 'text' || elements.appContainer.classList.contains('image-loaded')) return;
            
            // 이미지 모드이고 이미지가 없을 때만
            if (state.appMode === 'image') {
                e.stopPropagation(); // 중요: 이벤트 전파 막기
                elements.imageUpload.click();
            }
        });

        // 휠 줌 (비율 가속)
        elements.convertedCanvasContainer.addEventListener('wheel', (e) => {
            // 텍스트 모드이거나 이미지가 있을 때만 줌 허용
            if (!state.originalImageObject && !state.finalDownloadableData && state.appMode !== 'text') return;
            
            e.preventDefault();

            const scaleFactor = 1.1; 
            const delta = e.deltaY > 0 ? (1 / scaleFactor) : scaleFactor;
            let newZoom = (state.zoomLevel || 100) * delta;
            
            newZoom = Math.max(10, Math.min(2000, newZoom));
            
            if (callbacks.updateZoom) {
                callbacks.updateZoom(newZoom);
            } else {
                state.zoomLevel = newZoom;
                updateTransform();
                const display = document.getElementById('zoomLevelDisplay');
                if (display) display.textContent = `${Math.round(state.zoomLevel)}%`;
            }
        }, { passive: false });

        // 드래그 이동
        let isDragging = false;
        let startX, startY;

        elements.convertedCanvasContainer.addEventListener('mousedown', (e) => {
            // 이미지가 있거나 텍스트 결과물이 있을 때만 드래그 허용
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
    // 5. 기타 기능 (색상 추가, 팔레트 I/O, 프리셋 등)
    // ==========================================================================

    // 색상 추가
    if (elements.addColorBtn) {
        elements.addColorBtn.addEventListener('click', () => {
            let rgb = null;
            if (elements.addHex.value.trim()) {
                rgb = hexToRgb(elements.addHex.value.trim());
                if (!rgb) { if(elements.hexInputFeedback) elements.hexInputFeedback.textContent = '유효하지 않은 HEX 코드입니다.'; return; }
            } else if (elements.addR.value && elements.addG.value && elements.addB.value) {
                rgb = [parseInt(elements.addR.value), parseInt(elements.addG.value), parseInt(elements.addB.value)];
            }
            if (rgb) {
                if (callbacks.tryAddColor && callbacks.tryAddColor(rgb)) {
                    if(callbacks.clearAndResetInputFields) callbacks.clearAndResetInputFields();
                    populateColorSelects();
                } else if (!isColorAlreadyAdded(rgb)) {
                    createAddedColorItem(rgb, true, triggerConversion);
                    clearAndResetInputFields();
                    updatePaletteStatus();
                    populateColorSelects();
                    triggerConversion();
                }
            }
        });
    }
    
    // 색상 초기화
    if (elements.resetAddedColorsBtn) {
        elements.resetAddedColorsBtn.addEventListener('click', () => {
            if (callbacks.resetAddedColors) callbacks.resetAddedColors();
            populateColorSelects();
        });
    }

    // 팔레트 내보내기
    if (elements.exportPaletteBtn) {
        elements.exportPaletteBtn.addEventListener('click', () => {
            const items = elements.addedColorsContainer.querySelectorAll('.added-color-item');
            if (items.length === 0) { alert('내보낼 사용자 색상이 없습니다.'); return; }
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

    // 팔레트 가져오기
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
                            if (!isColorAlreadyAdded(rgb)) { 
                                createAddedColorItem(rgb, true, triggerConversion); 
                                addedCount++; 
                            }
                        });
                        if (addedCount > 0) { 
                            alert(`${addedCount}개의 색상을 불러왔습니다.`); 
                            updatePaletteStatus(); 
                            populateColorSelects(); 
                            triggerConversion(); 
                        } else alert('추가할 새로운 색상이 없습니다.');
                    } else alert('올바르지 않은 파일 형식입니다.');
                } catch (err) { alert('파일 읽기 오류: ' + err.message); }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // 프리셋 추천
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
            conversionWorker.postMessage({
                type: 'getStyleRecommendations',
                imageData: originalData,
                options: getOptions(),
                processId: state.processId
            }, [originalData.data.buffer]);
        });
    }
    if (elements.closePresetPopupBtn) elements.closePresetPopupBtn.addEventListener('click', () => elements.presetPopupContainer.classList.add('hidden'));
    
    // 다운로드
    if (elements.downloadBtn) {
        elements.downloadBtn.addEventListener('click', () => {
            if (!elements.convertedCanvas) return;
            const link = document.createElement('a');
            const originalName = state.originalFileName || 'noadot-image';
            link.download = `${originalName}_converted.png`;
            link.href = elements.convertedCanvas.toDataURL('image/png');
            link.click();
        });
    }
    
    // 언어
    document.querySelectorAll('#language-switcher button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            if (callbacks.setLanguage) callbacks.setLanguage(lang);
        });
    });
};