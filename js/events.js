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
    // 1. 파일 업로드 (중복 방지 & 드래그앤드롭)
    // ==========================================================================
    elements.imageUpload.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            callbacks.handleFile(e.target.files[0]);
        }
        e.target.value = ''; // 재선택 가능하게 초기화
    });

    elements.imageUpload.addEventListener('click', (e) => e.target.value = '');

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

    // ==========================================================================
    // 2. 모드 전환 (초기화 로직 강화)
    // ==========================================================================
    elements.imageMode.addEventListener('change', () => {
        if (callbacks.setAppMode) {
            callbacks.setAppMode('image');
            // UI 리셋
            if(elements.textEditorPanel) elements.textEditorPanel.style.display = 'none';
            if(elements.imageControls) elements.imageControls.style.display = 'grid';
            if(elements.textControls) elements.textControls.style.display = 'none';
            
            const canvas = elements.convertedCanvas;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            elements.convertedCanvasContainer.classList.remove('has-image');
            elements.imageUpload.disabled = false;
        }
    });

    elements.textMode.addEventListener('change', () => {
        if (callbacks.setAppMode) {
            callbacks.setAppMode('text');
            if(elements.textEditorPanel) elements.textEditorPanel.style.display = 'flex';
            if(elements.imageControls) elements.imageControls.style.display = 'none';
            if(elements.textControls) elements.textControls.style.display = 'block';
            
            state.originalImageObject = null;
            const canvas = elements.convertedCanvas;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            elements.convertedCanvasContainer.classList.remove('has-image');
            
            triggerConversion();
        }
    });

    // 텍스트 입력 감지 (필수)
    if (elements.editorTextarea) {
        elements.editorTextarea.addEventListener('input', (e) => {
            state.textState.content = e.target.value;
            triggerConversion();
        });
    }

    // 텍스트 스타일 변경 감지
    const textStyleIds = ['fontSelect', 'fontSizeSlider', 'letterSpacingSlider', 'paddingSlider', 'strokeWidthSlider', 'textColorSelect', 'bgColorSelect', 'strokeColorSelect'];
    textStyleIds.forEach(id => {
        const el = elements[id];
        if (el) {
            el.addEventListener('input', (e) => {
                const display = document.getElementById(id.replace('Slider', 'Value'));
                if (display) display.textContent = el.value;
                const key = id.replace('Select', '').replace('Slider', '');
                if (state.textState.hasOwnProperty(key)) state.textState[key] = (el.type === 'range') ? parseInt(el.value) : el.value;
                triggerConversion();
            });
        }
    });

    // ==========================================================================
    // 3. 팔레트 및 옵션
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

    const controlIds = [
        'scaleSlider', 'saturationSlider', 'brightnessSlider', 'contrastSlider',
        'ditheringSlider', 'ditheringAlgorithmSelect', 'patternTypeSelect', 'patternSizeSlider',
        'gradientAngleSlider', 'gradientStrengthSlider', 'highlightSensitivitySlider',
        'scaleWidth', 'scaleHeight', 'pixelScaleSlider',
        'celShadingLevelsSlider', 'celShadingColorSpaceSelect',
        'celShadingOutlineThresholdSlider', 'celShadingOutlineColorSelect'
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
    
    const toggleMap = { 'applyPattern': elements.patternOptions, 'applyGradient': elements.gradientOptions, 'celShadingApply': elements.celShadingOptions };
    Object.entries(toggleMap).forEach(([checkboxId, optionPanel]) => {
        if (elements[checkboxId]) {
            elements[checkboxId].addEventListener('change', (e) => {
                if (optionPanel) optionPanel.style.display = e.target.checked ? 'block' : 'none';
                if (checkboxId === 'celShadingApply' && e.target.checked) populateColorSelects();
                triggerConversion();
            });
        }
    });
    
    if (elements.celShadingOutline) {
        elements.celShadingOutline.addEventListener('change', (e) => {
            const subSettings = document.getElementById('outline-sub-settings');
            if (subSettings) subSettings.style.display = e.target.checked ? 'block' : 'none';
            triggerConversion();
        });
    }

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
    // 4. 캔버스 조작 (클릭 업로드, 휠 줌, 드래그)
    // ==========================================================================
    if (elements.convertedCanvasContainer) {
        // 클릭하여 업로드 (중복 방지)
        elements.convertedCanvasContainer.addEventListener('click', (e) => {
            if (state.appMode === 'text' || elements.appContainer.classList.contains('image-loaded')) return;
            if (state.appMode === 'image') {
                e.stopPropagation();
                elements.imageUpload.click();
            }
        });

        // 휠 줌 (Ctrl 없이, 2000%까지)
        elements.convertedCanvasContainer.addEventListener('wheel', (e) => {
            if (!state.originalImageObject && !state.finalDownloadableData && state.appMode !== 'text') return;
            e.preventDefault();
            const scaleFactor = 1.1; 
            const delta = e.deltaY > 0 ? (1 / scaleFactor) : scaleFactor;
            let newZoom = (state.zoomLevel || 100) * delta;
            newZoom = Math.max(10, Math.min(2000, newZoom));
            
            if (callbacks.updateZoom) callbacks.updateZoom(newZoom);
            else {
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
    
    if (elements.resetAddedColorsBtn) {
        elements.resetAddedColorsBtn.addEventListener('click', () => {
            if (callbacks.resetAddedColors) callbacks.resetAddedColors();
            else if (confirm("추가한 색상을 모두 삭제하시겠습니까?")) {
                elements.addedColorsContainer.innerHTML = '';
                updatePaletteStatus();
                populateColorSelects();
                triggerConversion();
            }
            populateColorSelects();
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
                        if (addedCount > 0) { alert(`${addedCount}개의 색상을 불러왔습니다.`); updatePaletteStatus(); populateColorSelects(); triggerConversion(); }
                        else alert('추가할 새로운 색상이 없습니다.');
                    } else alert('올바르지 않은 파일 형식입니다.');
                } catch (err) { alert('파일 읽기 오류: ' + err.message); }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // [중요] 프리셋 추천 버튼 (originalData 변수 선언 문제 해결)
    if (elements.getStyleRecommendationsBtn) {
        elements.getStyleRecommendationsBtn.addEventListener('click', () => {
            if (!state.originalImageObject) return;
            showLoading(true);
            elements.getStyleRecommendationsBtn.disabled = true;
            
            // 변수 선언 순서 수정 (중요!)
            const tempC = document.createElement('canvas');
            tempC.width = state.originalImageObject.width;
            tempC.height = state.originalImageObject.height;
            const ctx = tempC.getContext('2d');
            ctx.drawImage(state.originalImageObject, 0, 0);
            const originalData = ctx.getImageData(0, 0, tempC.width, tempC.height);

            // 현재 팔레트 수집 (옵션)
            let currentPalette = [];
            const activeBtns = document.querySelectorAll('.color-button[data-on="true"], .added-color-item[data-on="true"]');
            activeBtns.forEach(btn => {
                if (!btn.classList.contains('all-toggle-btn')) currentPalette.push(JSON.parse(btn.dataset.rgb));
            });

            conversionWorker.postMessage({
                type: 'getStyleRecommendations',
                imageData: originalData,
                palette: currentPalette, // 팔레트 정보 전달
                options: getOptions(),
                processId: state.processId
            }, [originalData.data.buffer]);
        });
    }
    
    if (elements.closePresetPopupBtn) elements.closePresetPopupBtn.addEventListener('click', () => elements.presetPopupContainer.classList.add('hidden'));
    
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
    
    document.querySelectorAll('#language-switcher button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            if (callbacks.setLanguage) callbacks.setLanguage(lang);
        });
    });
};