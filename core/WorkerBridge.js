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

        // 🌟 [성능] state.originalImageData가 실제로 바뀐 시점만 추적해서,
        // 슬라이더 조작 등으로 발생하는 변환마다 전체 원본 픽셀 버퍼를 재전송하지 않도록 함.
        this.originalImageVersion = 0;
        this.workerCachedImageVersion = -1;

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

                // 🌟 [신규] 중복 색상 검사 팝업 전용 미리보기 결과.
                // 메인 화면/상태(state.latestConversionData, 팔레트 사용량 카운트 등)는
                // 절대 건드리지 않고 팝업에게만 결과를 전달한다.
                case 'previewConversionResult':
                    eventBus.emit('PALETTE_PREVIEW_READY', { imageData: payload.imageData, colorCounts: payload.colorCounts });
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
        eventBus.on('IMAGE_LOADED', () => {
            this.originalImageVersion++; // 새 원본이 로드됐으니 다음 변환 때 워커 캐시를 갱신해야 함
            this.triggerConversion(true);
        });

        eventBus.on('MANUAL_CONVERSION_REQUEST', ({ imageData }) => {
            const message = this.packOptions();
            message.imageData = imageData;
            message.cacheOriginal = false; // 임시로 넘긴 이미지가 워커의 원본 캐시를 덮어쓰지 않도록 방지
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
            // 🌟 [핵심 변경] 무조건 1번(원본 이미지)을 보냅니다.
            const targetData = state.originalImageData;
            if (!targetData || this.isWorkerBusy) return;
            
            state.isConverting = true;
            this.isWorkerBusy = true;
            
            // 🌟 워커가 2번(리사이즈) 상태로 만들 수 있도록 현재 사이즈 옵션 동봉!
            const kmeansOptions = {
                ...payload.options,
                scaleWidth: state.resizeWidth,
                scaleHeight: state.resizeHeight,
                resizeMode: state.resizeMode || 'average'
            };

            this.worker.postMessage({
                type: 'extractKMeans',
                imageData: targetData, 
                options: kmeansOptions 
            });
        });
        eventBus.on('REQUEST_DOWNLOAD_WORKER', (payload) => {
            this.downloadWorker.postMessage(payload);
        });

        // 🌟 [신규] 중복 색상 검사 팝업이 특정 색상들을 임시로 껐을 때의 결과만 미리 보고 싶을 때 사용.
        // 메인 변환 큐(isWorkerBusy/hasPendingRequest)와는 완전히 분리된 별도 요청이라
        // 팝업에서 체크박스를 연타해도 실제 화면/상태에는 아무 영향을 주지 않는다.
        eventBus.on('REQUEST_PALETTE_PREVIEW', (payload) => {
            if (!state.originalImageData) return;
            const message = this.packOptions();
            message.type = 'previewConvert';
            message.options.disabledHexes = payload.disabledHexes || [];
            this.worker.postMessage(message);
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
        // 🌟 [성능] 원본이 바뀌었을 때만 픽셀 버퍼를 실어 보내고,
        // 옵션(슬라이더 등)만 바뀐 변환은 가벼운 메시지만 전송해서 워커의 캐시본을 재사용한다.
        const needsImage = this.workerCachedImageVersion !== this.originalImageVersion;
        if (needsImage) this.workerCachedImageVersion = this.originalImageVersion;

        const message = {
            type: 'convert',
            options: {
                // 1. 색상 및 톤
                colorMethod: state.colorMethodSelect ?? 'oklab',
                saturation: state.saturationSlider ?? 100,
                brightness: state.brightnessSlider ?? 0,
                contrast: state.contrastSlider ?? 0,

                useDitherDenoise: state.useDitherDenoise ?? false,
                ditherDenoiseStrength: state.ditherDenoiseStrength ?? 50,
                
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
                useWplaceInGeopixels: state.useWplaceInGeopixels || false,
                useUplaceInGeopixels: state.useUplaceInGeopixels || false,
                useBplaceInGeopixels: state.useBplaceInGeopixels || false,
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

        if (needsImage) {
            message.imageData = state.originalImageData;
            message.cacheOriginal = true;
        }

        return message;
    }
}