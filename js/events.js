// js/events.js
import { state, CONFIG, hexToRgb } from './state.js';
import { 
    elements, updateTransform, populateColorSelects, updatePaletteStatus, updateOutputDimensionsDisplay,
    createAddedColorItem, clearAndResetInputFields, updateScaleUIVisibility, updateColorRecommendations, 
    showLoading, isColorAlreadyAdded, getOptions, updateUpscaleButtonState // updateUpscaleButtonState 추가
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
                alert("먼저 이미지를 변환해주세요.");
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
            alert("보관함에 저장되었습니다.\n[📂 프리셋 보관함] 버튼을 눌러 확인하세요.");
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
                }
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
                        alert("프리셋이 성공적으로 적용되었습니다! 🎉");
                    } else {
                        console.error("❌ 오류: applyPreset 함수를 찾을 수 없습니다.");
                        alert("시스템 오류: 프리셋 적용 함수가 연결되지 않았습니다.");
                    }
                } catch (err) {
                    console.error("파일 파싱 오류:", err);
                    alert("올바른 프리셋 파일이 아닙니다.\n(.json 파일인지 확인해주세요)");
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
                            alert(`${addedCount}개의 색상을 불러왔습니다.`); 
                            updatePaletteStatus(); populateColorSelects(); triggerConversion(); 
                        } else alert('추가할 새로운 색상이 없습니다.');
                    } else alert('올바르지 않은 파일 형식입니다.');
                } catch (err) { alert('파일 읽기 오류: ' + err.message); }
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
                alert("이미지를 먼저 업로드해주세요.");
                return;
            }
            if (state.sessionPresets.length === 0) {
                alert("아직 보관함에 저장된 프리셋이 없습니다.\n'현재 설정 저장하기' 버튼을 눌러 추가해보세요.");
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