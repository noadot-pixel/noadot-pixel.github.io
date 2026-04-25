// js/core/WorkerBridge.js
import { eventBus } from './EventBus.js';
import { state, hexToRgb } from './state.js';

export class WorkerBridge {
    constructor() {
        // 🌟 [복구] 잃어버린 메인 엔진(이미지 변환 워커) 부활!
        this.worker = new Worker(
            new URL(`../worker/image-worker.js?v=${Date.now()}`, import.meta.url), 
            { type: 'module' }
        );

        // 🌟 [유지] 새로 추가한 다운로드 전담 워커
        this.downloadWorker = new Worker(
            new URL(`../worker/download.js?v=${Date.now()}`, import.meta.url), 
            { type: 'module' }
        );

        this.conversionTimer = null; 
        this.isWorkerBusy = false;
        this.hasPendingRequest = false; 

        this.initWorkerListeners();
        this.initBusListeners();
    }

    initWorkerListeners() {
        this.downloadWorker.onmessage = (e) => {
            const { status, blob, fileName, message } = e.data;
            if (status === 'success') {
                // 워커가 만들어준 파일을 다운로드 트리거
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert("다운로드 처리 중 오류 발생: " + message);
            }
        };

        this.worker.onmessage = (e) => {
            const payload = e.data;
            const { type, status, message } = payload;

            if (status === 'error') {
                console.error(`[Worker Error] ${message}`);
                this.isWorkerBusy = false; 
                state.isConverting = false;
                eventBus.emit('WORKER_ERROR', message);
                eventBus.emit('CONVERSION_COMPLETE', { imageData: state.originalImageData }); 
                return;
            }

            switch (type) {
                case 'conversionResult': 
                case 'conversionDone':
                    state.isConverting = false;
                    this.isWorkerBusy = false;
                    
                    // 🚨 [필수 복구 1] 뷰어(Viewer)가 에러를 뿜지 않도록 창고에 이미지 꼬박꼬박 저장!
                    state.originalConvertedData = payload.imageData;
                    state.latestConversionData = payload.imageData;

                    // 🌟 [유지] 워커가 보낸 stats(영수증) 포장해서 방송!
                    eventBus.emit('CONVERSION_COMPLETE', { 
                        imageData: payload.imageData,
                        stats: payload.stats 
                    });

                    // 🚀 [필수 복구 2] 워커가 바쁠 때 슬라이더를 움직여서 밀려있던 주문(Pending) 다시 돌리기!
                    if (this.hasPendingRequest) {
                        this.hasPendingRequest = false;
                        this.triggerConversion(true); 
                    }
                    break;

                case 'kmeansExtractionResult':
                    state.isConverting = false;
                    this.isWorkerBusy = false;
                    eventBus.emit('KMEANS_EXTRACTION_COMPLETE', payload);
                    break;

                case 'recommendationResult':
                    if (!payload.tags) payload.tags = [];
                    eventBus.emit('IMAGE_ANALYZED', payload);
                    break;
            }
        };

        this.worker.onerror = (err) => {
            console.error("Worker File Load Error:", err);
            this.isWorkerBusy = false;
            state.isConverting = false;
        };
    }

    initBusListeners() {
        eventBus.on('OPTION_CHANGED', () => this.triggerConversion());
        eventBus.on('BATCH_OPTION_CHANGED', () => this.triggerConversion());
        eventBus.on('PALETTE_UPDATED', () => this.triggerConversion());
        eventBus.on('IMAGE_LOADED', () => this.triggerConversion(true));

        eventBus.on('MANUAL_CONVERSION_REQUEST', ({ imageData }) => {
            const message = this.packOptions();
            message.imageData = imageData;
            message.options.dithering = 'none'; 
            message.options.ditheringIntensity = 0;
            message.options.applyPattern = false;
            message.options.applyGradient = false;
            message.options.applyAspireDither = false;
            message.options.applyRefinement = false;
            message.options.celShading = { apply: false };
            
            state.isConverting = true;
            eventBus.emit('CONVERSION_START');
            this.worker.postMessage(message);
        });

        eventBus.on('REQUEST_KMEANS_EXTRACTION', (payload) => {
            if (!state.originalImageData || this.isWorkerBusy) return;
            
            state.isConverting = true;
            this.isWorkerBusy = true;
            
            // UI에서 받은 옵션(K 개수, Oklab 여부 등)을 워커로 전달!
            this.worker.postMessage({
                type: 'extractKMeans',
                imageData: state.originalImageData, 
                options: payload.options 
            });
        });
        eventBus.on('REQUEST_DOWNLOAD_WORKER', (payload) => {
            this.downloadWorker.postMessage(payload);
        });
    }

    triggerConversion(immediate = false) {
        if (!state.originalImageData) return;

        if (this.isWorkerBusy) {
            this.hasPendingRequest = true;
            return; 
        }

        if (this.conversionTimer) {
            clearTimeout(this.conversionTimer);
            this.conversionTimer = null;
        }

        const perform = () => {
            this.isWorkerBusy = true; 
            state.isConverting = true;
            eventBus.emit('CONVERSION_START');
            this.worker.postMessage(this.packOptions());
        };

        if (immediate) {
            perform();
        } else {
            this.conversionTimer = setTimeout(perform, 100);
        }
    }

    packOptions() {
        return {
            type: 'convert',
            imageData: state.originalImageData,
            options: {
                // 1. 색상 및 톤
                colorMethod: state.colorMethodSelect ?? 'oklab',
                saturation: state.saturationSlider ?? 100,
                brightness: state.brightnessSlider ?? 0,
                contrast: state.contrastSlider ?? 0,
                
                // 2. 디더링 옵션
                useMicroDither: String(state.useMicroDither) === 'true',
                useMacroPattern: String(state.useMacroPattern) === 'true',
                basicDitherType: state.basicDitherType || 'bayer',
                bayerSize: 1,
                ditheringIntensity: state.ditheringSlider ?? 50,
                patternType: state.patternTypeSelect || 'grid',
                patternSize: state.patternSizeSlider ?? 2,

                patternMatrix: state.patternMatrix || null, 
                patternStrength: state.patternStrengthSlider ?? 10,

                // 3. 포스트 프로세싱 (새로 연결할 옵션들 자리표시자)
                usePixelioe: state.usePixelioe ?? false,
                pixelioeStrength: state.pixelioeStrength ?? 50,
                useSmoothing: state.useSmoothing ?? false,
                smoothingLevel: state.smoothingLevel ?? 0,
                // 🌟 최신 변수명으로 매칭하여 투명도 그라데이션 정상 작동!
                useAlphaGradient: state.useAlphaGradient ?? false,
                alphaGradientType: state.alphaGradientType ?? 'bayer',
                alphaGradientAngle: state.alphaGradientAngle ?? 0,
                alphaGradientSize: state.alphaGradientSize ?? 1,
                alphaGradientStrength: state.alphaGradientStrength ?? 50,

                useOrganicNoise: state.useOrganicNoise ?? false, //노이징 파트
                organicNoiseStrength: state.organicNoiseStrength ?? 50,

                // 기타 시스템 설정
                mode: state.currentMode || 'geopixels',
                palette: state.currentMode === 'geopixels' ? (state.addedColors || []) : [],
                disabledHexes: state.disabledHexes || [],
                scaleWidth: state.resizeWidth,
                scaleHeight: state.resizeHeight,
                resizeMode: state.resizeMode || 'average',
                
                // 퓨전 엔진 파라미터
                fusionParams: (() => {
                    const isSimple = state.algoTrack !== 'advanced'; 

                    const params = {
                        modelA: state.algoModelA || 'oklab',
                        modelB: isSimple ? 'none' : (state.algoModelB || 'none'),
                        weightM: isSimple ? 0 : (state.algoWeightM !== undefined ? state.algoWeightM : 0), 
                        chromaBoost: state.algoChromaBoost !== undefined ? state.algoChromaBoost : 10
                    };
                    return params;
                })()
            }
        };
    }
}