// js/core/WorkerBridge.js
import { eventBus } from './EventBus.js';
import { state, hexToRgb } from '../state.js';

export class WorkerBridge {
    constructor() {
        this.worker = new Worker(
            new URL('../worker/image-worker.js', import.meta.url), 
            { type: 'module' }
        );

        this.conversionTimer = null; 
        this.isWorkerBusy = false;      
        this.hasPendingRequest = false; 

        this.initWorkerListeners();
        this.initBusListeners();
    }

    initWorkerListeners() {
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
                case 'upscaleResult': 
                    state.isConverting = false;

                    if (type === 'upscaleResult') {
                         state.latestConversionData = payload.imageData;
                    } else {
                         state.originalConvertedData = payload.imageData;
                         state.latestConversionData = payload.imageData;
                    }
                    
                    eventBus.emit('CONVERSION_COMPLETE', payload);
                    
                    this.isWorkerBusy = false; 

                    if (this.hasPendingRequest) {
                        this.hasPendingRequest = false;
                        this.triggerConversion(true); 
                    }
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

        eventBus.on('UPSCALE_REQUEST', (factor) => {
            if (!state.originalConvertedData) return;

            state.currentUpscaleFactor = factor;
            state.isUpscaled = (factor > 1);

            if (factor === 1) {
                state.latestConversionData = state.originalConvertedData;
                eventBus.emit('CONVERSION_COMPLETE', { imageData: state.originalConvertedData });
            } else {
                state.isConverting = true;
                eventBus.emit('CONVERSION_START');
                
                this.worker.postMessage({
                    type: 'upscale',
                    imageData: state.originalConvertedData,
                    options: { scaleFactor: factor }
                });
            }
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
                saturation: state.saturationSlider ?? 100,
                brightness: state.brightnessSlider ?? 0,
                contrast: state.contrastSlider ?? 0,
                
                dithering: state.ditheringAlgorithmSelect ?? 'none', 
                ditheringIntensity: state.ditheringSlider ?? 0,
                
                applyPattern: state.applyPattern ?? false,
                patternType: state.patternTypeSelect ?? 'bayer8x8',
                patternSize: state.patternSizeSlider ?? 4,
                
                applyGradient: state.applyGradient ?? false,
                gradientType: state.gradientTypeSelect ?? 'bayer',
                gradientDitherSize: state.gradientDitherSizeSlider ?? 1,
                gradientAngle: state.gradientAngleSlider ?? 0,
                gradientStrength: state.gradientStrengthSlider ?? 100,
                
                colorMethod: state.colorMethodSelect ?? 'oklab',
                pixelatedScaling: false,
                
                // [신규] 체크박스 상태 추가 (만화 필터 밖으로 독립됨)
                applyAspireDither: state.applyAspireDither ?? false,
                applyRefinement: state.applyRefinement ?? false,
                refinementStrength: state.refinementSlider ?? 50,
                
                celShading: {
                    apply: state.celShadingApply ?? false,
                    algorithm: state.celShadingAlgorithmSelect ?? 'kmeans',
                    levels: state.celShadingLevelsSlider ?? 8,
                    colorSpace: state.celShadingColorSpaceSelect ?? 'oklab',
                    outline: state.celShadingOutline ?? false,
                    outlineThreshold: state.celShadingOutlineThresholdSlider ?? 50,
                    outlineColor: hexToRgb(state.celShadingOutlineColorSelect ?? '#000000') || [0, 0, 0],
                    randomSeed: state.celShadingRandomSeed ?? 0
                },

                mode: state.currentMode || 'geopixels',
                palette: state.addedColors || [],
                useWplaceInGeoMode: state.useWplaceInGeoMode || false,
                
                disabledHexes: state.disabledHexes || [],
                
                scaleWidth: state.resizeWidth,
                scaleHeight: state.resizeHeight
            }
        };
    }
}