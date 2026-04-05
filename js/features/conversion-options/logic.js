// js/features/conversion-options/logic.js
import { eventBus } from '../../core/EventBus.js';
import { state, CONFIG, t, rgbToHex } from '../../state.js';
import { ConversionOptionsUI } from './ui.js';
import { geopixelsColors, wplaceFreeColors, wplacePaidColors } from '../../../data/palettes.js';
import { extractExactKMeansPalette } from '../../worker/analysis.js';

export class ConversionOptionsFeature {
    constructor() {
        this.ui = new ConversionOptionsUI();

        if (!state.ditheringAlgorithmSelect || state.ditheringAlgorithmSelect === 'none') {
            state.ditheringAlgorithmSelect = 'atkinson';
        }

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
    }

    updateTextureUI() {
        const val = document.getElementById('ditheringAlgorithmSelect')?.value || state.ditheringAlgorithmSelect;
        const patternValues = ['bayer8x8', 'crosshatch', 'vertical', 'checkerboard', 'diagonal_right', 'diagonal_left', 'brick'];
        const isPattern = patternValues.includes(val);
        const isNone = (val === 'none');
        
        const ditherStrengthGroup = document.getElementById('dithering-strength-group');
        const patternSizeGroup = document.getElementById('pattern-size-group');
        
        if (isNone) {
            if (ditherStrengthGroup) ditherStrengthGroup.style.display = 'none';
            if (patternSizeGroup) patternSizeGroup.style.display = 'none';
        } else if (isPattern) {
            if (ditherStrengthGroup) ditherStrengthGroup.style.display = 'none';
            if (patternSizeGroup) patternSizeGroup.style.display = 'block'; 
        } else {
            if (ditherStrengthGroup) ditherStrengthGroup.style.display = 'block';
            if (patternSizeGroup) patternSizeGroup.style.display = 'none';
        }
    }

    updateUIConflictLocks() {
        const isCelShading = document.getElementById('celShadingApply')?.checked;
        const isRefinement = document.getElementById('applyRefinement')?.checked;
        const ditherStrength = parseInt(document.getElementById('ditheringSlider')?.value || '0', 10);
        
        const val = document.getElementById('ditheringAlgorithmSelect')?.value || state.ditheringAlgorithmSelect;
        const patternValues = ['bayer8x8', 'crosshatch', 'vertical', 'checkerboard', 'diagonal_right', 'diagonal_left', 'brick'];
        const isPattern = patternValues.includes(val);

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
        const bindInput = (element, stateKey, isGroupToggle = false, groupElement = null) => {
            if (!element) return;
            
            if (element.type === 'range') {
                element.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value, 10);
                    this.ui.updateDisplay(stateKey, val); 
                });
                element.addEventListener('change', (e) => {
                    const val = parseInt(e.target.value, 10);
                    state[stateKey] = val;
                    
                    if (stateKey === 'ditheringSlider') state.ditheringIntensity = val;
                    if (stateKey === 'patternSizeSlider') state.patternSize = val;
                    if (stateKey === 'refinementSlider') state.refinementStrength = val;

                    if (isGroupToggle && groupElement) this.ui.toggleGroup(groupElement, val);
                    this.triggerDebouncedUpdate();
                });
            } else if (element.type === 'checkbox') {
                element.addEventListener('change', (e) => {
                    const val = element.checked;
                    state[stateKey] = val;
                    this.ui.updateDisplay(stateKey, val);
                    if (isGroupToggle && groupElement) this.ui.toggleGroup(groupElement, val);
                    this.updateUIConflictLocks();
                    eventBus.emit('OPTION_CHANGED');
                });
            } else if (element.tagName === 'SELECT') {
                element.addEventListener('change', (e) => {
                    const val = e.target.value;
                    state[stateKey] = val;
                    this.updateUIConflictLocks();
                    eventBus.emit('OPTION_CHANGED');
                });
            }
        };

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

        bindInput(document.getElementById('patternSizeSlider'), 'patternSizeSlider');
        bindInput(document.getElementById('ditheringSlider'), 'ditheringSlider');

        bindInput(document.getElementById('applyRefinement'), 'applyRefinement', true, document.getElementById('refinementOptions'));
        bindInput(document.getElementById('refinementSlider'), 'refinementSlider');

        bindInput(document.getElementById('applyOutlineExpansion'), 'applyOutlineExpansion');
        bindInput(document.getElementById('applySmartSampling'), 'applySmartSampling');
        
        bindInput(document.getElementById('saturationSlider'), 'saturationSlider');
        bindInput(document.getElementById('brightnessSlider'), 'brightnessSlider');
        bindInput(document.getElementById('contrastSlider'), 'contrastSlider');

        bindInput(document.getElementById('applyGradient'), 'applyGradient', true, document.getElementById('gradientOptions'));
        bindInput(document.getElementById('gradientTypeSelect'), 'gradientTypeSelect');
        bindInput(document.getElementById('gradientDitherSizeSlider'), 'gradientDitherSizeSlider');
        bindInput(document.getElementById('gradientAngleSlider'), 'gradientAngleSlider');
        bindInput(document.getElementById('gradientStrengthSlider'), 'gradientStrengthSlider');

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

    }

    triggerDebouncedUpdate() {
        if (state.timeoutId) clearTimeout(state.timeoutId);
        state.timeoutId = setTimeout(() => {
            eventBus.emit('OPTION_CHANGED');
        }, CONFIG.DEBOUNCE_DELAY);
    }

    loadInitialState() {
        const keys = [
            'applyOutlineExpansion', 'applySmartSampling', 
            'saturationSlider', 'brightnessSlider', 'contrastSlider', 
            'ditheringAlgorithmSelect', 'ditheringSlider',
            'patternSizeSlider',
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

        const val = state.ditheringAlgorithmSelect;
        state.dithering = val;
        
        const patternValues = ['bayer8x8', 'crosshatch', 'vertical', 'checkerboard', 'diagonal_right', 'diagonal_left', 'brick'];
        if (patternValues.includes(val)) {
            state.applyPattern = true;
            state.patternTypeSelect = val;
            state.patternType = val;
        } else {
            state.applyPattern = false;
        }

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
            applyPattern: false,
            patternTypeSelect: 'bayer8x8',
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
}