// js/features/05-color-engine/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, CONFIG, t, rgbToHex } from '../../core/state.js';
import { ConversionOptionsUI } from './ui.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors, uplaceColors } from '../../data/palettes.js';
import { extractExactKMeansPalette } from '../../worker/analysis.js';

export class ConversionOptionsFeature {
    constructor() {
        this.ui = new ConversionOptionsUI();

        this.initEvents();
        this.initBusListeners();
        this.loadInitialState();
        
        this.updateOutlineDropdown();
        this.updateTextureUI();
        this.updateUIConflictLocks();
    }

    initBusListeners() {
        eventBus.on('UPDATE_UI_ONLY', ({ key, value }) => {
            this.ui.updateDisplay(key, value);
            
            if (key === 'applyGradient') this.ui.toggleGroup(document.getElementById('gradientOptions'), value);
            if (key === 'celShadingApply') this.ui.toggleGroup(document.getElementById('celShadingOptions'), value);
            if (key === 'celShadingOutline') this.ui.toggleGroup(document.getElementById('celShadingOutlineOptions'), value);
            if (key === 'applyRefinement') this.ui.toggleGroup(document.getElementById('refinementOptions'), value);
            if (key === 'applyUpscale') this.ui.toggleGroup(document.getElementById('upscaleDropdownGroup'), value);
        });

        eventBus.on('MODE_CHANGED', () => this.updateOutlineDropdown());
        eventBus.on('PALETTE_UPDATED', () => this.updateOutlineDropdown());
        
        eventBus.on('OPTION_CHANGED', () => {
            this.updateOutlineDropdown();
            this.updateTextureUI();
            this.updateUIConflictLocks();
        });
        eventBus.on('REQUEST_RESET_ALL', () => {
            this.resetOptions();

            document.querySelectorAll('.reset-slider-btn').forEach(btn => {
                const valId = btn.getAttribute('data-value-id');
                const defaultVal = btn.getAttribute('data-default');
                const valDisplay = document.getElementById(valId);
                
                if (valDisplay) {
                    valDisplay.textContent = defaultVal;
                }
            });
            
            console.log("🔄 모든 엔진 설정이 초기화되었습니다.");
        });
    }

    

    updateTextureUI() {
        const mode = state.ditherModeSelect || 'none';
        
        const basicPanel = document.getElementById('ditherBasicControls');
        const patternPanel = document.getElementById('ditherPatternControls');
        const sharedStrength = document.getElementById('ditherSharedStrength');

        // 모드에 맞춰 패널을 켜고, 'none'이 아니면 강도 슬라이더를 무조건 표시합니다.
        if (basicPanel) basicPanel.style.display = (mode === 'basic') ? 'block' : 'none';
        if (patternPanel) patternPanel.style.display = (mode === 'pattern') ? 'block' : 'none';
        if (sharedStrength) sharedStrength.style.display = (mode !== 'none') ? 'block' : 'none';
    }

    updateFusionUI() {
        const modelASelect = document.getElementById('advancedModelA');
        const modelBSelect = document.getElementById('advancedModelB');
        const weightSlider = document.getElementById('advancedWeightMSlider');
        // HTML에서 새로 만든 좌/우 텍스트 공간을 가져옵니다.
        const weightValA = document.getElementById('advancedWeightMVal_A');
        const weightValB = document.getElementById('advancedWeightMVal_B');

        if (!modelASelect || !modelBSelect || !weightSlider || !weightValA || !weightValB) return;

        const valA = modelASelect.value;
        const valB = modelBSelect.value;

        // 1. 상호 배제 (선택된 옵션을 상대방 목록에서 비활성화. 단, none은 제외)
        Array.from(modelASelect.options).forEach(opt => opt.disabled = (opt.value === valB && valB !== 'none'));
        Array.from(modelBSelect.options).forEach(opt => opt.disabled = (opt.value === valA));

        // 2. 만약 오류로 A와 B가 같아진다면, B를 다른 값으로 밀어냄
        if (valA === valB && valA !== 'none') {
            const availableB = Array.from(modelBSelect.options).find(opt => !opt.disabled);
            if (availableB) {
                modelBSelect.value = availableB.value;
                state.algoModelB = availableB.value;
            }
        }

        // 3. 양끝 텍스트 조립
        const nameMap = { 'rgb': 'RGB', 'oklab': 'Oklab', 'ciede2000': 'Wdot', 'ciede2000-d65': 'D65', 'none': 'None' };
        
        // 만약 예기치 못한 값이 들어와도 undefined가 뜨지 않도록 방어
        const nameA = nameMap[modelASelect.value] || 'Unknown';
        const nameB = nameMap[modelBSelect.value] || 'Unknown';

        const weightM = parseFloat(weightSlider.value);
        const weightA = (1.0 - weightM).toFixed(2);
        const weightB = weightM.toFixed(2);

        // 🌟 유저님의 디테일: 모델 이름은 얇고 차분한 색, 숫자는 굵고 포인트 되는 색으로 조립하는 도우미!
        const formatText = (name, val) => 
            `<span style="color: var(--text-secondary); font-weight: normal; margin-right: 4px;">${name}</span><span style="color: var(--accent-success); font-weight: bold;">${val}</span>`;

        if (modelBSelect.value === 'none' || !modelBSelect.value) {
            // 모델 B를 안 쓸 때
            weightValA.innerHTML = formatText(nameA, '1.00');
            weightValB.innerHTML = `<span style="color: var(--text-secondary); font-weight: normal; font-size: 0.9em;">혼합 안 함</span>`;
        } else {
            // 모델 A와 B를 섞을 때
            weightValA.innerHTML = formatText(nameA, weightA);
            weightValB.innerHTML = formatText(nameB, weightB);
        }
    }

    updateUIConflictLocks() {
        const isCelShading = document.getElementById('celShadingApply')?.checked;
        const isRefinement = document.getElementById('applyRefinement')?.checked;
        const ditherStrength = parseInt(document.getElementById('ditheringSlider')?.value || '0', 10);
        
        // 🌟 [수정됨] V7의 새로운 디더링 모드 ID를 추적합니다!
        const isPattern = document.getElementById('useMacroPattern')?.checked || state.useMacroPattern;

        const setLock = (elementId, isLocked, reasonMsg) => {
            const el = document.getElementById(elementId);
            if (!el) return;
            const container = el.closest('.control-group');
            if (!container) return;

            if (isLocked) {
                container.classList.add('locked-container');
                const disabledSuffix = t('text_disabled_reason') || '기능 활성으로 인해 사용하실 수 없습니다.';
                if (reasonMsg) container.setAttribute('title', `${reasonMsg} ${disabledSuffix}`);
                el.disabled = true;
            } else {
                container.classList.remove('locked-container');
                container.removeAttribute('title');
                el.disabled = false;
            }
        };

        const msgCelShading = t('reason_cartoon_filter') || '만화 스타일 필터';
        const msgRefinement = t('reason_refinement') || '면 평탄화';
        const msgPattern = t('reason_pattern') || '패턴 적용';
        const msgDitherActive = t('reason_dithering_active') || '디더링 사용 중 (강도 > 0)';
        const msgRefinementOff = t('reason_refinement_off') || '면 평탄화 (꺼짐)';
        const msgDitherNone = t('reason_dithering_none') || '디더링 (사용 안함)';
        const msgPatternOff = t('reason_pattern_off') || '패턴 (꺼짐)';

        if (isCelShading) {
            setLock('colorMethodSelect', true, msgCelShading);
            setLock('ditheringAlgorithmSelect', true, msgCelShading);
            setLock('ditheringSlider', true, msgCelShading);
            setLock('patternSizeSlider', true, msgCelShading);
            setLock('applyRefinement', false);
            setLock('refinementSlider', false);
            return;
        }
        
        setLock('colorMethodSelect', false);

        if (isRefinement) {
            setLock('ditheringAlgorithmSelect', true, msgRefinement);
            setLock('ditheringSlider', true, msgRefinement);
            setLock('patternSizeSlider', true, msgRefinement);
            setLock('applyRefinement', false);
            setLock('refinementSlider', false);
        } 
        else if (isPattern) {
            setLock('applyRefinement', true, msgPattern);
            setLock('refinementSlider', true, msgPattern);
            setLock('ditheringAlgorithmSelect', false); 
            setLock('patternSizeSlider', false);
            setLock('ditheringSlider', false);
        }
        else if (ditherStrength > 0) {
            setLock('applyRefinement', true, msgDitherActive);
            setLock('refinementSlider', true, msgDitherActive);
            setLock('ditheringAlgorithmSelect', false);
            setLock('ditheringSlider', false);
        }
        else {
            setLock('applyRefinement', false);
            setLock('refinementSlider', !isRefinement, msgRefinementOff);
            setLock('ditheringAlgorithmSelect', false);
            setLock('ditheringSlider', false);
            setLock('patternSizeSlider', true, msgPatternOff);
        }
    }

    updateOutlineDropdown() {
        const groups = [];
        const currentMode = state.currentMode || 'geopixels';

        const formatList = (list) => {
            if (!Array.isArray(list)) return [];
            return list.map(c => ({
                name: c.name || t('color_unknown') || 'Unknown',
                hex: c.hex || (c.rgb ? rgbToHex(c.rgb[0], c.rgb[1], c.rgb[2]) : '#000000')
            }));
        };

        const userColors = state.addedColors || state.customColors || [];
        
        if (userColors.length > 0) {
            const customGroup = {
                label: t('palette_user') || 'User Added',
                colors: userColors.map(c => {
                    let r, g, b;
                    if (Array.isArray(c)) {
                        [r, g, b] = c;
                    } else if (c.rgb && Array.isArray(c.rgb)) {
                        [r, g, b] = c.rgb;
                    } else {
                        r = 0; g = 0; b = 0;
                    }
                    return { hex: rgbToHex(r, g, b), name: t('palette_user_color') || 'User Color' };
                })
            };
            groups.push(customGroup);
        }

        if (currentMode === 'geopixels') {
            groups.push({ label: t('palette_geopixels_default') || 'GeoPixels Default', colors: formatList(geopixelsColors) });
            if (state.useWplaceInGeoMode) {
                groups.push({ label: t('palette_wplace_free') || 'Wplace Free', colors: formatList(wplaceFreeColors) });
                groups.push({ label: t('palette_wplace_paid') || 'Wplace Paid', colors: formatList(wplacePaidColors) });
            }
        } else if (currentMode === 'wplace') {
            groups.push({ label: t('palette_wplace_free') || 'Wplace Free', colors: formatList(wplaceFreeColors) });
            groups.push({ label: t('palette_wplace_paid') || 'Wplace Paid', colors: formatList(wplacePaidColors) });
        }

        this.ui.updateOutlineColorList(groups);

        const geoSmartSection = document.getElementById('geoSmartRecommendSection');
        if (geoSmartSection) {
            const isGeoMode = document.getElementById('mode-geopixels')?.checked || state.currentMode === 'geopixels';
            geoSmartSection.style.display = isGeoMode ? 'block' : 'none';
        }
    }

    initEvents() {

        document.querySelectorAll('.reset-slider-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target'); // 슬라이더 ID
                const valId = e.target.getAttribute('data-value-id'); // 화면의 파란 숫자 ID
                const defaultVal = e.target.getAttribute('data-default'); // 돌아갈 기본값
                
                const slider = document.getElementById(targetId);
                const valDisplay = document.getElementById(valId);
                
                if (slider) {
                    // 1. 슬라이더 바 위치 원상복구
                    slider.value = defaultVal;
                    
                    // 2. 🌟 화면의 파란 숫자 텍스트 직접 강제 변경! (버그 원천 차단)
                    if (valDisplay) {
                        valDisplay.textContent = defaultVal;
                    }
                    
                    // 3. 엔진으로 "옵션 바뀌었으니 다시 그려라!" 명령 발송
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });

        //노이징(유기적 노이즈) 파트
        const checkNoise = document.getElementById('useOrganicNoise');
        const boxNoise = document.getElementById('organicNoiseControls');
        checkNoise?.addEventListener('change', (e) => {
            state.useOrganicNoise = e.target.checked;
            if(boxNoise) boxNoise.style.display = e.target.checked ? 'block' : 'none';
            eventBus.emit('OPTION_CHANGED');
        });
        this.syncInput('organicNoiseStrength', 'value', 'organicNoiseStrengthVal');

        //pixelioe 파트
        const checkPixelioe = document.getElementById('usePixelioe');
        const boxPixelioe = document.getElementById('pixelioeControls');
        checkPixelioe?.addEventListener('change', (e) => {
            state.usePixelioe = e.target.checked;
            if(boxPixelioe) boxPixelioe.style.display = e.target.checked ? 'block' : 'none';
            eventBus.emit('OPTION_CHANGED');
        });
        this.syncInput('pixelioeStrength', 'value', 'pixelioeStrengthVal');

        // 🌟 2. 면 평탄화 제어 및 숨김 처리 (추가됨)
        const checkSmoothing = document.getElementById('useSmoothing');
        const boxSmoothing = document.getElementById('smoothingControls');
        checkSmoothing?.addEventListener('change', (e) => {
            state.useSmoothing = e.target.checked;
            if(boxSmoothing) boxSmoothing.style.display = e.target.checked ? 'block' : 'none';
            eventBus.emit('OPTION_CHANGED');
        });
        this.syncInput('smoothingLevel', 'value', 'smoothingLevelVal');

        // 3. 투명도 그라데이션 제어 및 숨김 처리
        const checkAlpha = document.getElementById('useAlphaGradient');
        const boxAlpha = document.getElementById('alphaGradientControls');
        checkAlpha?.addEventListener('change', (e) => {
            state.useAlphaGradient = e.target.checked;
            if(boxAlpha) boxAlpha.style.display = e.target.checked ? 'flex' : 'none';
            eventBus.emit('OPTION_CHANGED');
        });
        
        const basicTypeSelect = document.getElementById('basicDitherType');
        const bayerSizeGroup = document.getElementById('bayerSizeGroup');

        // 🌟 디더링 타입 드롭다운 동기화 (추가됨)
        const checkMicroDither = document.getElementById('useMicroDither');
        const boxMicroDither = document.getElementById('microDitherControls');
        checkMicroDither?.addEventListener('change', (e) => {
            state.useMicroDither = e.target.checked;
            if(boxMicroDither) boxMicroDither.style.display = e.target.checked ? 'block' : 'none';
            this.updateUIConflictLocks();
            eventBus.emit('OPTION_CHANGED');
        });

        const checkMacroPattern = document.getElementById('useMacroPattern');
        const boxMacroPattern = document.getElementById('macroPatternControls');
        checkMacroPattern?.addEventListener('change', (e) => {
            state.useMacroPattern = e.target.checked;
            if(boxMacroPattern) boxMacroPattern.style.display = e.target.checked ? 'block' : 'none';
            this.updateUIConflictLocks();
            eventBus.emit('OPTION_CHANGED');
        });

        // 🌟 2. 하위 옵션(방식 및 패턴) 동기화
        basicTypeSelect?.addEventListener('change', (e) => {
            state.basicDitherType = e.target.value;
            // 베이어일 때만 사이즈 드롭다운 표시
            if (bayerSizeGroup) bayerSizeGroup.style.display = (e.target.value === 'bayer') ? 'block' : 'none';
            eventBus.emit('OPTION_CHANGED');
        });

        const patternTypeSelect = document.getElementById('patternTypeSelect');
        patternTypeSelect?.addEventListener('change', (e) => {
            state.patternTypeSelect = e.target.value;
            eventBus.emit('OPTION_CHANGED');
        });

        const bayerSizeSelect = document.getElementById('bayerSizeSelect');
        bayerSizeSelect?.addEventListener('change', (e) => {
            state.bayerSizeSelect = parseInt(e.target.value, 10);
            eventBus.emit('OPTION_CHANGED');
        });

        const patternSizeSlider = document.getElementById('patternSizeSlider');
        const patternSizeValue = document.getElementById('patternSizeValue');

        if (patternSizeSlider) {
            // 1. 드래그 중: UI 숫자만 부드럽게 실시간 변경
            patternSizeSlider.addEventListener('input', (e) => {
                if (patternSizeValue) patternSizeValue.textContent = e.target.value;
            });
            // 2. 마우스 놓았을 때: 엔진(state)에 값을 저장하고 렌더링 명령 하달!
            patternSizeSlider.addEventListener('change', (e) => {
                state.patternSizeSlider = parseInt(e.target.value, 10);
                eventBus.emit('OPTION_CHANGED');
            });
        }

        const ditheringSlider = document.getElementById('ditheringSlider');
        const ditheringValue = document.getElementById('ditheringValue');

        if (ditheringSlider) {
            // 1. 드래그 중: UI 숫자만 부드럽게 실시간 변경
            ditheringSlider.addEventListener('input', (e) => {
                if (ditheringValue) ditheringValue.textContent = e.target.value;
            });
            // 2. 마우스 놓았을 때: 엔진(state)에 값을 저장하고 렌더링 명령 하달!
            ditheringSlider.addEventListener('change', (e) => {
                state.ditheringSlider = parseInt(e.target.value, 10);
                eventBus.emit('OPTION_CHANGED');
            });
        }

        const alphaGradientAngle = document.getElementById('alphaGradientAngle');
        const alphaGradientAngleVal = document.getElementById('alphaGradientAngleVal');
        if (alphaGradientAngle) {
            alphaGradientAngle.addEventListener('input', (e) => {
                if (alphaGradientAngleVal) alphaGradientAngleVal.textContent = e.target.value;
            });
            alphaGradientAngle.addEventListener('change', (e) => {
                state.alphaGradientAngle = parseInt(e.target.value, 10);
                eventBus.emit('OPTION_CHANGED');
            });
        }

        // 2. 그라데이션 패턴 크기 (Size)
        const alphaGradientSize = document.getElementById('alphaGradientSize');
        const alphaGradientSizeVal = document.getElementById('alphaGradientSizeVal');
        if (alphaGradientSize) {
            alphaGradientSize.addEventListener('input', (e) => {
                if (alphaGradientSizeVal) alphaGradientSizeVal.textContent = e.target.value;
            });
            alphaGradientSize.addEventListener('change', (e) => {
                state.alphaGradientSize = parseInt(e.target.value, 10);
                eventBus.emit('OPTION_CHANGED');
            });
        }

        // 3. 그라데이션 강도/폭 (Strength)
        const alphaGradientStrength = document.getElementById('alphaGradientStrength');
        const alphaGradientStrengthVal = document.getElementById('alphaGradientStrengthVal');
        if (alphaGradientStrength) {
            alphaGradientStrength.addEventListener('input', (e) => {
                if (alphaGradientStrengthVal) alphaGradientStrengthVal.textContent = e.target.value;
            });
            alphaGradientStrength.addEventListener('change', (e) => {
                state.alphaGradientStrength = parseInt(e.target.value, 10);
                eventBus.emit('OPTION_CHANGED');
            });
        }

        // 4. 그라데이션 패턴 모양 드롭다운 (Type)
        const alphaGradientType = document.getElementById('alphaGradientType');
        if (alphaGradientType) {
            alphaGradientType.addEventListener('change', (e) => {
                state.alphaGradientType = e.target.value;
                eventBus.emit('OPTION_CHANGED');
            });
        }

        const advancedAlgoPanel = document.getElementById('advancedAlgoPanel');
        
        if (advancedAlgoPanel) {
            const radioTracks = document.querySelectorAll('input[name="algoTrack"]');
            const simplePanel = document.getElementById('simpleAlgoPanel');
            const advancedPanel = document.getElementById('advancedAlgoPanel');
            const simpleSelect = document.getElementById('simpleAlgoSelect');
            
            const modelA = document.getElementById('advancedModelA');
            const modelB = document.getElementById('advancedModelB');
            const weightMSlider = document.getElementById('advancedWeightMSlider');
            const weightMVal = document.getElementById('advancedWeightMVal');

            // 1. 라디오 버튼 스위칭 로직
            radioTracks.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const track = e.target.value;
                    state.algoTrack = track;
                    console.log('🚨 [CCTV 1 - UI] 트랙 변경됨:', track); // 로그 추가

                    if (track === 'simple') {
                        simplePanel.style.display = 'block';
                        advancedPanel.style.display = 'none';

                        state.algoModelA = simpleSelect.value;
                        state.algoModelB = 'none';
                        state.algoWeightM = 0;
                        
                        if(modelA) modelA.value = state.algoModelA;
                        if(modelB) modelB.value = 'none';
                        if(weightMSlider) weightMSlider.value = 0;
                        if(weightMVal) weightMVal.textContent = "0";
                    } else {
                        simplePanel.style.display = 'none';
                        advancedPanel.style.display = 'block';
                        
                        // 🌟 [새로 추가됨] 전문가 모드로 돌아오면, 전문가 UI에 있던 값을 다시 엔진으로 가져옵니다!
                        state.algoModelA = modelA ? modelA.value : 'oklab';
                        state.algoModelB = modelB ? modelB.value : 'ciede2000-d65';
                        state.algoWeightM = weightMSlider ? parseFloat(weightMSlider.value) : 0.8;

                        this.updateFusionUI();
                    }
                    
                    eventBus.emit('OPTION_CHANGED');
                });
            });

            // 2. 기본 드롭다운 동기화
            if (simpleSelect) {
                simpleSelect.addEventListener('change', (e) => {
                    console.log('🚨 [CCTV 1 - UI] 기본 알고리즘 드롭다운 선택됨:', e.target.value); // 로그 추가
                    state.algoModelA = e.target.value;
                    if(modelA) modelA.value = e.target.value;
                    
                    // 🌟 [수정됨] 선택하자마자 바로 렌더링 다시 돌리기!
                    eventBus.emit('OPTION_CHANGED');
                });
            }

            // 3. 전문가 모드 UI 이벤트
            // 3. 전문가 모드 UI 이벤트 통합 
            // (값 변경 시 UI 텍스트 업데이트와 워커 전송을 동시에 처리)
            const triggerFusionUpdate = () => {
                this.updateFusionUI();
                eventBus.emit('OPTION_CHANGED');
            };

            if (modelA) modelA.addEventListener('change', (e) => { 
                state.algoModelA = e.target.value; 
                triggerFusionUpdate(); 
            });

            if (modelB) modelB.addEventListener('change', (e) => { 
                state.algoModelB = e.target.value; 
                triggerFusionUpdate(); 
            });

            if (weightMSlider) {
                // 슬라이더 '드래그 중': UI 텍스트만 실시간으로 부드럽게 갱신
                weightMSlider.addEventListener('input', () => this.updateFusionUI());
                
                // 마우스 클릭을 '놓았을 때': 텍스트 갱신 및 엔진으로 연산 명령 전송
                weightMSlider.addEventListener('change', (e) => {
                    state.algoWeightM = parseFloat(e.target.value);
                    triggerFusionUpdate();
                });
            }
        }

        // 채도 보호막 슬라이더
        const chromaSlider = document.getElementById('algoChromaBoost');
        const chromaVal = document.getElementById('algoChroma_val');
        if (chromaSlider) {
            chromaSlider.addEventListener('input', (e) => { if (chromaVal) chromaVal.textContent = e.target.value; });
            chromaSlider.addEventListener('change', (e) => {
                state.algoChromaBoost = parseInt(e.target.value, 10);
                eventBus.emit('OPTION_CHANGED');
            });
        }

        document.querySelectorAll('input[name="paletteMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.addedColors = [];
                const addedColorsContainer = document.getElementById('addedColors');
                if (addedColorsContainer) {
                    const placeholderText = t('placeholder_add_color') || '아래에서 직접 색상을 추가하세요.';
                    addedColorsContainer.innerHTML = `<div class="placeholder-section" data-lang-key="placeholder_add_color">${placeholderText}</div>`;
                }
                this.updateOutlineDropdown();
                eventBus.emit('PALETTE_UPDATED');
                eventBus.emit('OPTION_CHANGED'); 
            });
        });

        document.querySelectorAll('input[name="upscaleMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                // 1. 선택된 값(2 또는 3)을 숫자로 변환해서 state에 저장
                state.upscaleMode = parseInt(e.target.value, 10);
                
                // 2. 엔진에게 "옵션 바뀌었으니 다시 그려줘!" 라고 명령
                eventBus.emit('OPTION_CHANGED'); 
            });
        });

        const syncUpscaleRadios = () => {
            const applyUpscale = document.getElementById('applyUpscale');
            const upscaleSelect = document.getElementById('upscaleSelect');
            
            let targetValue = '1';
            if (applyUpscale && applyUpscale.checked && upscaleSelect) {
                targetValue = upscaleSelect.value;
            }
            
            state.upscaleMode = parseInt(targetValue, 10);
            
            const hiddenRadio = document.querySelector(`input[name="upscaleMode"][value="${targetValue}"]`);
            if (hiddenRadio && !hiddenRadio.checked) {
                hiddenRadio.checked = true;
                hiddenRadio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        const applyUpscale = document.getElementById('applyUpscale');
        const upscaleSelect = document.getElementById('upscaleSelect');
        const upscaleDropdownGroup = document.getElementById('upscaleDropdownGroup');

        if (applyUpscale) {
            applyUpscale.addEventListener('change', (e) => {
                state.applyUpscale = e.target.checked;
                if (upscaleDropdownGroup) {
                    upscaleDropdownGroup.style.display = e.target.checked ? 'block' : 'none';
                }
                this.updateUIConflictLocks();
                syncUpscaleRadios(); 
            });
        }

        if (upscaleSelect) {
            upscaleSelect.addEventListener('change', (e) => {
                this.updateUIConflictLocks();
                syncUpscaleRadios();
            });
        }

        const ditherSelect = document.getElementById('ditheringAlgorithmSelect');
        if (ditherSelect) {
            ditherSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                state.ditheringAlgorithmSelect = val;
                state.dithering = val; 
                
                const patternValues = ['bayer8x8', 'crosshatch', 'vertical', 'checkerboard', 'diagonal_right', 'diagonal_left', 'brick'];
                
                if (patternValues.includes(val)) {
                    state.applyPattern = true;
                    state.patternTypeSelect = val;
                    state.patternType = val; 
                } else {
                    state.applyPattern = false;
                }
                
                this.updateTextureUI(); 
                this.updateUIConflictLocks(); 
                this.triggerDebouncedUpdate(); 
            });
        }

        const bindInput = (el, stateKey, isCheckbox = false, toggleEl = null) => {
            if (!el) return;
            el.addEventListener('change', (e) => {
                const val = isCheckbox ? e.target.checked : e.target.value;
                state[stateKey] = val;
                if (toggleEl) toggleEl.style.display = val ? 'block' : 'none';
                eventBus.emit('OPTION_CHANGED');
            });
        };

        bindInput(document.getElementById('ditheringSlider'), 'ditheringSlider');

        bindInput(document.getElementById('applyRefinement'), 'applyRefinement', true, document.getElementById('refinementOptions'));
        bindInput(document.getElementById('refinementSlider'), 'refinementSlider');

        bindInput(document.getElementById('applyOutlineExpansion'), 'applyOutlineExpansion');
        bindInput(document.getElementById('applySmartSampling'), 'applySmartSampling');
        
        const toneSliders = [
            { id: 'saturationSlider', valId: 'saturationValue', stateKey: 'saturationSlider' },
            { id: 'brightnessSlider', valId: 'brightnessValue', stateKey: 'brightnessSlider' },
            { id: 'contrastSlider', valId: 'contrastValue', stateKey: 'contrastSlider' }
        ];

        toneSliders.forEach(config => {
            const slider = document.getElementById(config.id);
            const valDisplay = document.getElementById(config.valId);
            
            if (slider) {
                // 1. 드래그 중: 화면의 숫자(Value)만 실시간으로 변경!
                slider.addEventListener('input', (e) => {
                    if (valDisplay) valDisplay.textContent = e.target.value;
                });
                
                // 2. 마우스 뗐을 때: 값을 저장하고 워커 엔진 가동!
                slider.addEventListener('change', (e) => {
                    state[config.stateKey] = parseInt(e.target.value, 10);
                    eventBus.emit('OPTION_CHANGED');
                });
            }
        });

        bindInput(document.getElementById('celShadingApply'), 'celShadingApply', true, document.getElementById('celShadingOptions'));
        bindInput(document.getElementById('celShadingAlgorithmSelect'), 'celShadingAlgorithmSelect');
        bindInput(document.getElementById('celShadingLevelsSlider'), 'celShadingLevelsSlider');
        bindInput(document.getElementById('celShadingColorSpaceSelect'), 'celShadingColorSpaceSelect');
        bindInput(document.getElementById('celShadingOutline'), 'celShadingOutline', true, document.getElementById('celShadingOutlineOptions'));
        bindInput(document.getElementById('celShadingOutlineThresholdSlider'), 'celShadingOutlineThresholdSlider');
        bindInput(document.getElementById('celShadingOutlineColorSelect'), 'celShadingOutlineColorSelect');

        bindInput(document.getElementById('colorMethodSelect'), 'colorMethodSelect');

        if (this.ui.resetAllBtn) {
            this.ui.resetAllBtn.addEventListener('click', () => {
                if (confirm(t('confirm_reset_all_settings'))) {
                    this.resetOptions();
                }
            });
        }

        if (this.ui.individualResetBtns) {
            this.ui.individualResetBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = btn.getAttribute('data-target');
                    if (targetId) {
                        this.resetIndividualOption(targetId);
                    }
                });
            });
        }

        document.querySelectorAll('input, select').forEach(el => {
            el.addEventListener('change', () => this.updateUIConflictLocks());
        });

        // ==========================================
        // 🌟 [핵심 변경] K-Means 팔레트 추출 (등록 및 재시도 통합)
        // ==========================================
        const extractAndApplyPalette = (e) => {
            e.preventDefault();
            if (!state.originalImageData) {
                alert(t('alert_need_image') || "먼저 이미지를 업로드해주세요!");
                return;
            }

            const targetK = state.celShadingLevelsSlider || 8;
            const newPalette = extractExactKMeansPalette(state.originalImageData, targetK); // 렉 없이 즉시 추출됨
            
            if (newPalette.length === 0) return;

            // 1. 꺼져있는(Off) 색상을 포함한 "모든 베이스 색상"을 검사 풀(Pool)로 모으기
            const allBaseColors = [];
            const collectBase = (list) => {
                if(!list) return;
                list.forEach(c => {
                    let rgb = c.rgb || c;
                    if (Array.isArray(rgb)) {
                        allBaseColors.push({ rgb, hex: rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase() });
                    }
                });
            };
            
            collectBase(geopixelsColors);
            if (state.useWplaceInGeoMode) {
                collectBase(wplaceFreeColors);
                collectBase(wplacePaidColors);
            }

            // 2. 추출된 K개의 색상을 하나씩 검사
            const finalActiveHexes = new Set();
            const newlyAddedColors = [];
            const distSq = (c1, c2) => (c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2;

            newPalette.forEach(extractedRgb => {
                let closestHex = null;
                let minDist = Infinity;

                // 모든 베이스 색상(Off된 것 포함) 중 가장 비슷한 녀석을 찾음
                allBaseColors.forEach(base => {
                    const d = distSq(extractedRgb, base.rgb);
                    if (d < minDist) { minDist = d; closestHex = base.hex; }
                });

                // 오차가 적으면(비슷하면) 쌩판 새 색상을 만들지 않고, 찾은 기존 색상을 "부활(활성화)" 예약
                const STRICT_THRESHOLD = 300; // 숫자가 작을수록 깐깐하게 검사합니다.

                if (minDist < STRICT_THRESHOLD && closestHex) {
                    finalActiveHexes.add(closestHex);
                } else {
                    // 조금이라도 연관성(톤)이 다르면 기존 색을 무시하고 무조건 새 색상으로 독립
                    const newHex = rgbToHex(extractedRgb[0], extractedRgb[1], extractedRgb[2]).toUpperCase();
                    finalActiveHexes.add(newHex);
                    newlyAddedColors.push(extractedRgb);
                }
            });

            // 3. disabledHexes(끄기 목록) 갱신: 방금 찾은(부활할) 녀석들 빼고 전부 끈다
            state.disabledHexes = [];
            allBaseColors.forEach(base => {
                if (!finalActiveHexes.has(base.hex)) {
                    state.disabledHexes.push(base.hex);
                }
            });

            // 4. 유저 팔레트에는 "완전히 새로운" 색상만 추가
            state.addedColors = newlyAddedColors;

            // 5. 화면 및 캔버스 갱신
            eventBus.emit('PALETTE_UPDATED');
            this.triggerDebouncedUpdate(); 
            
            // "K-Means 가져오기" 버튼을 누른 경우에만 상세 정보 알림창
            if (e.target.id === 'geoSmartRegisterBtn') {
                alert(`✨ 성공! K-Means 추출 및 팔레트 최적화 완료.\n(기존 팔레트에서 ${targetK - newlyAddedColors.length}개 재활용 부활, 완전히 새로운 색상 ${newlyAddedColors.length}개 추가됨)`);
            }
        };

        // K-Means 가져오기 버튼과 '다른 색상 조합 시도' 버튼 양쪽 모두에 위 로직 연결
        const geoSmartRegisterBtn = document.getElementById('geoSmartRegisterBtn');
        if (geoSmartRegisterBtn) geoSmartRegisterBtn.addEventListener('click', extractAndApplyPalette);

        const celShadingRetryBtn = document.getElementById('celShadingRetryBtn');
        if (celShadingRetryBtn) celShadingRetryBtn.addEventListener('click', extractAndApplyPalette);

        this.initPatternStrengthSync();
        this.initCustomPatternEditor();

    }

    triggerDebouncedUpdate() {
        if (state.timeoutId) clearTimeout(state.timeoutId);
        state.timeoutId = setTimeout(() => {
            eventBus.emit('OPTION_CHANGED');
        }, CONFIG.DEBOUNCE_DELAY);
    }

    loadInitialState() {
        const validPatterns = ['grid', 'vertical', 'checkerboard', 'diagonal_r', 'diagonal_l', 'brick', 'crt', 'maze', 'custom'];
        if (state.patternTypeSelect && !validPatterns.includes(state.patternTypeSelect)) {
            state.patternTypeSelect = 'grid'; // 옛날 값이면 강제로 '격자'로 초기화
        }
        delete state.bayerSizeSelect; // 🌟 2x2로 뭉개지게 만들던 과거의 원흉 변수 완벽 삭제!

        // 🌟 새로 분리된 디더링 & 패턴 UI의 키값들을 모두 추가해 초기 기동 시 값을 확실히 물고 들어가게 합니다!
        const keys = [
            'applyOutlineExpansion', 'applySmartSampling', 
            'saturationSlider', 'brightnessSlider', 'contrastSlider', 
            'useMicroDither', 'basicDitherType', 'ditheringSlider',
            'useMacroPattern', 'patternTypeSelect', 'patternSizeSlider', 'patternStrengthSlider',
            'applyGradient', 'gradientTypeSelect', 'gradientDitherSizeSlider', 'gradientAngleSlider', 'gradientStrengthSlider',
            'celShadingApply', 'celShadingAlgorithmSelect', 'celShadingLevelsSlider', 'celShadingColorSpaceSelect', 
            'celShadingOutline', 'celShadingOutlineThresholdSlider', 'celShadingOutlineColorSelect',
            'colorMethodSelect', 'refinementSlider', 'applyRefinement',
            'applyUpscale', 'upscaleMode'
        ];

        keys.forEach(key => {
            if (state[key] !== undefined) {
                this.ui.updateDisplay(key, state[key]);
            }
        });

        const applyUpscale = document.getElementById('applyUpscale');
        const upscaleSelect = document.getElementById('upscaleSelect');
        const upscaleDropdownGroup = document.getElementById('upscaleDropdownGroup');
        
        if (applyUpscale && state.applyUpscale) {
            applyUpscale.checked = true;
            if (upscaleDropdownGroup) upscaleDropdownGroup.style.display = 'block';
            if (upscaleSelect && state.upscaleMode) upscaleSelect.value = state.upscaleMode.toString();
        } else if (applyUpscale) {
            applyUpscale.checked = false;
            if (upscaleDropdownGroup) upscaleDropdownGroup.style.display = 'none';
        }

        this.updateOutlineDropdown();
        this.updateTextureUI();
        this.updateUIConflictLocks();
        const checkedTrack = document.querySelector('input[name="algoTrack"]:checked');
        if (checkedTrack) {
            checkedTrack.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    syncInput(id, prop, labelId = null) {
        const el = document.getElementById(id);
        const label = labelId ? document.getElementById(labelId) : null;
        if (!el) return;

        el.addEventListener('input', (e) => {
            const val = prop === 'checked' ? e.target.checked : e.target.value;
            state[id] = val; // state.pixelioeStrength = 50 이런 식으로 저장됨
            
            if (label) label.textContent = val + (id.includes('Strength') ? '' : '');
            
            // 성능을 위해 슬라이더는 뗐을 때(change)만 변환하고 싶다면 
            // 이 안에서 eventBus.emit을 하지 말고 별도의 change 리스너를 만듭니다.
        });

        el.addEventListener('change', () => {
            eventBus.emit('OPTION_CHANGED');
        });
    }

    resetIndividualOption(targetId) {
        let defaultValue = 0;
        switch(targetId) {
            case 'applyOutlineExpansion': defaultValue = false; break;
            case 'applySmartSampling': defaultValue = false; break;
            case 'saturationSlider': defaultValue = 100; break;
            case 'brightnessSlider': defaultValue = 0; break;
            case 'contrastSlider': defaultValue = 0; break;
            case 'patternSizeSlider': defaultValue = 4; break;
            case 'gradientDitherSizeSlider': defaultValue = 1; break;
            case 'gradientStrengthSlider': defaultValue = 100; break;
            case 'celShadingLevelsSlider': defaultValue = 8; break;
            case 'celShadingOutlineThresholdSlider': defaultValue = 50; break;
            case 'refinementSlider': defaultValue = 50; break;
            case 'applyUpscale': defaultValue = false; break;
            case 'upscaleSelect': defaultValue = 1; break;
            default: defaultValue = 0;
        }

        state[targetId] = defaultValue;
        this.ui.updateDisplay(targetId, defaultValue);
        
        if (targetId === 'applyUpscale') {
            state.upscaleMode = 1;
            const hiddenRadio = document.querySelector(`input[name="upscaleMode"][value="1"]`);
            if (hiddenRadio) {
                hiddenRadio.checked = true;
                hiddenRadio.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const grp = document.getElementById('upscaleDropdownGroup');
            if(grp) grp.style.display = 'none';
        }

        this.updateUIConflictLocks();
        this.triggerDebouncedUpdate();
    }

    resetOptions() {
        const defaults = {
            applyOutlineExpansion: false,
            applySmartSampling: false, 
            celShadingOutlineColorSelect: '#000000',
            saturationSlider: 100,
            brightnessSlider: 0,
            contrastSlider: 0,
            ditheringAlgorithmSelect: 'atkinson', 
            ditheringSlider: 0,

            useMicroDither: false,
            useMacroPattern: false,
            basicDitherType: 'bayer',

            applyPattern: false,
            patternTypeSelect: 'grid',
            patternSizeSlider: 1,
            applyGradient: false,
            gradientTypeSelect: 'bayer',
            gradientDitherSizeSlider: 1, 
            gradientAngleSlider: 0,
            gradientStrengthSlider: 100,
            colorMethodSelect: 'oklab',
            celShadingApply: false,
            celShadingAlgorithmSelect: 'kmeans', 
            celShadingLevelsSlider: 8,
            celShadingColorSpaceSelect: 'oklab',
            celShadingOutline: false,
            celShadingOutlineThresholdSlider: 50,
            celShadingOutlineColorSelect: '#000000',
            refinementSlider: 50,
            applyRefinement: false,
            applyUpscale: false,
            upscaleMode: 1
        };

        Object.keys(defaults).forEach(key => {
            state[key] = defaults[key];
            this.ui.updateDisplay(key, defaults[key]);
        });
        
        const upscaleDropdownGroup = document.getElementById('upscaleDropdownGroup');
        if (upscaleDropdownGroup) upscaleDropdownGroup.style.display = 'none';

        const hiddenRadio = document.querySelector(`input[name="upscaleMode"][value="1"]`);
        if (hiddenRadio) {
            hiddenRadio.checked = true;
            hiddenRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }

        this.ui.resetUI();
        this.updateOutlineDropdown(); 
        this.updateTextureUI();
        this.updateUIConflictLocks();
        eventBus.emit('OPTION_CHANGED');
    }

    initPatternStrengthSync() {
        const slider = document.getElementById('patternStrengthSlider');
        const val = document.getElementById('patternStrengthValue');
        if (slider) {
            slider.addEventListener('input', (e) => { if (val) val.textContent = e.target.value; });
            slider.addEventListener('change', (e) => {
                state.patternStrengthSlider = parseInt(e.target.value, 10);
                eventBus.emit('OPTION_CHANGED');
            });
        }
    }

    initCustomPatternEditor() {
        const modal = document.getElementById('customPatternModal');
        const openBtn = document.getElementById('btnOpenPatternEditor');
        const closeBtn = document.getElementById('btnClosePatternEditor');
        const patternTypeSelect = document.getElementById('patternTypeSelect');
        const gridContainer = document.getElementById('customPatternGrid');
        const sizeSelect = document.getElementById('customPatternSize');
        const toolBtns = document.querySelectorAll('.pattern-tool-btn');

        if (!modal || !gridContainer) return;

        let isDrawing = false;
        let currentBrush = 0; // 0: 깎기, 1: 유지, 2: 덧칠
        let currentSize = 5;  // 기본 5x5
        
        let matrix = Array(currentSize).fill().map(() => Array(currentSize).fill(1));

        if (patternTypeSelect) {
            patternTypeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    openBtn.style.display = 'inline-block';
                    modal.style.display = 'flex';
                    renderGrid();
                } else {
                    openBtn.style.display = 'none';
                    state.patternMatrix = null;
                }
            });
        }

        if (openBtn) openBtn.addEventListener('click', () => { modal.style.display = 'flex'; renderGrid(); });
        if (closeBtn) closeBtn.addEventListener('click', () => modal.style.display = 'none');

        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentBrush = parseInt(btn.getAttribute('data-state'), 10);
            });
        });

        if (sizeSelect) {
            sizeSelect.addEventListener('change', (e) => {
                currentSize = parseInt(e.target.value, 10);
                matrix = Array(currentSize).fill().map(() => Array(currentSize).fill(1));
                renderGrid();
            });
        }

        const renderGrid = () => {
            gridContainer.innerHTML = '';
            gridContainer.style.gridTemplateColumns = `repeat(${currentSize}, 1fr)`;

            for (let y = 0; y < currentSize; y++) {
                for (let x = 0; x < currentSize; x++) {
                    const cell = document.createElement('div');
                    cell.className = 'pattern-cell';
                    cell.setAttribute('data-state', matrix[y][x]); 

                    const paint = () => {
                        matrix[y][x] = currentBrush;
                        cell.setAttribute('data-state', currentBrush);
                    };

                    cell.addEventListener('mousedown', (e) => {
                        e.preventDefault(); 
                        isDrawing = true;
                        paint();
                    });

                    cell.addEventListener('mouseenter', () => {
                        if (isDrawing) paint();
                    });

                    gridContainer.appendChild(cell);
                }
            }
        };

        document.addEventListener('mouseup', () => { isDrawing = false; });

        const applyBtn = document.getElementById('btnApplyCustomPattern');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                state.patternMatrix = matrix; 
                modal.style.display = 'none';
                eventBus.emit('OPTION_CHANGED'); 
            });
        }

        const saveBtn = document.getElementById('btnSaveCustomPattern');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const data = JSON.stringify({ size: currentSize, matrix: matrix });
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `noadot-pattern-${currentSize}x${currentSize}.json`;
                a.click();
            });
        }

        const loadBtn = document.getElementById('btnLoadCustomPattern');
        const uploadInput = document.getElementById('patternUpload');
        if (loadBtn && uploadInput) {
            loadBtn.addEventListener('click', () => uploadInput.click());
            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const parsed = JSON.parse(event.target.result);
                        if (parsed.size && parsed.matrix) {
                            currentSize = parsed.size;
                            matrix = parsed.matrix;
                            if(sizeSelect) sizeSelect.value = currentSize;
                            renderGrid();
                        }
                    } catch (err) {
                        alert("잘못된 패턴 파일입니다.");
                    }
                };
                reader.readAsText(file);
                uploadInput.value = '';
            });
        }
    }
}