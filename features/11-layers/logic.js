// js/features/11-layers/logic.js
// 🌟 [레이어 기능] 이 모듈은 state.layers만 바꾸고 LAYERS_CHANGED만 쏜다 - #main-canvas는
// 절대 직접 건드리지 않는다 (02-viewer가 유일한 캔버스 painter, zippy-dancing-dahl.md 참고).
import { eventBus } from '../../core/EventBus.js';
import { state, t } from '../../core/state.js';
import { LayersUI } from './ui.js';

const MAX_LAYERS = 8;
const OUTLINE_DEFAULTS = { threshold: 96, contrast: 30, brightness: 0, lineWeight: 0.25, inkHex: '#000000' };
const OUTLINE_DEBOUNCE_MS = 150;

let layerIdSeq = 0;
function nextLayerId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${(layerIdSeq++).toString(36)}`;
}

export class LayersFeature {
    constructor() {
        this.ui = new LayersUI();
        this.outlineDebounceTimers = new Map(); // layerId -> timeoutId

        this.initEvents();
        this.initBusListeners();
        this.render();
    }

    render() {
        this.ui.renderList(state.layers);
    }

    // 구조가 바뀌는 조작(추가/삭제/순서 변경)에서만 쓴다 - 슬라이더 드래그 중 호출하면
    // 매 프레임 리스트를 다시 그려서 드래그 중인 입력 요소가 통째로 교체되어버린다.
    emitChanged() {
        this.render();
        eventBus.emit('LAYERS_CHANGED');
    }

    initEvents() {
        if (this.ui.btnAddOutline) {
            this.ui.btnAddOutline.addEventListener('click', () => this.addOutlineLayer());
        }
        if (this.ui.btnAddImage) {
            this.ui.btnAddImage.addEventListener('click', () => {
                if (!state.originalImageData) { alert(t('alert_layer_needs_image')); return; }
                if (state.layers.length >= MAX_LAYERS) { alert(t('alert_layer_max')); return; }
                if (this.ui.fileInput) this.ui.fileInput.click();
            });
        }
        if (this.ui.fileInput) {
            this.ui.fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) this.addImageLayer(file);
                e.target.value = ''; // 같은 파일을 다시 선택해도 change가 또 발생하도록
            });
        }
        if (this.ui.chkAllowOffPalette) {
            this.ui.chkAllowOffPalette.checked = !state.layerSnapToPalette;
            this.ui.chkAllowOffPalette.addEventListener('change', (e) => {
                state.layerSnapToPalette = !e.target.checked;
                eventBus.emit('LAYERS_CHANGED');
            });
        }

        // 🌟 리스트 안의 모든 행 컨트롤(체크박스/슬라이더/셀렉트/버튼)을 #lyr-list 하나에만
        // 위임해서 건다 - renderList가 매번 innerHTML을 새로 그려도 리스너가 끊기거나 쌓이지 않는다.
        if (this.ui.list) {
            this.ui.list.addEventListener('click', (e) => this.handleListClick(e));
            this.ui.list.addEventListener('input', (e) => this.handleListInput(e));
            this.ui.list.addEventListener('change', (e) => this.handleListChange(e));
        }
    }

    initBusListeners() {
        eventBus.on('IMAGE_LOADED', () => {
            state.imageVersion++;
        });

        // 변환 결과(베이스)가 바뀔 때마다, 거기 묶여 있던 외곽선 레이어들의 생성 결과가
        // 지금 베이스와 안 맞으면(크기 변경, 새 이미지 로드 등) 다시 생성 요청을 건다.
        eventBus.on('CONVERSION_COMPLETE', (data) => {
            if (!data || !data.imageData) return;
            this.regenerateStaleOutlines(data.imageData);
        });

        eventBus.on('OUTLINE_LAYER_READY', ({ layerId, requestId, imageData }) => {
            const layer = state.layers.find(l => l.id === layerId);
            if (!layer || layer.pendingRequestId !== requestId) return; // 이미 stale해진 응답은 버림
            layer.imageData = imageData;
            layer.status = 'ready';
            layer.pendingRequestId = null;
            layer.sourceKey = { imageVersion: state.imageVersion, width: imageData.width, height: imageData.height };
            // LayerCompositor.getLayerPixels의 리사이즈 캐시가 옛 imageData를 들고 있을 수 있으니 무효화
            delete layer._cache;
            delete layer._cacheKey;
            this.emitChanged();
        });

        eventBus.on('OUTLINE_LAYER_FAILED', ({ layerId, requestId }) => {
            const layer = state.layers.find(l => l.id === layerId);
            if (!layer || layer.pendingRequestId !== requestId) return;
            layer.status = 'error';
            layer.pendingRequestId = null;
            this.emitChanged();
        });

        eventBus.on('LANGUAGE_CHANGED', () => this.render());
    }

    regenerateStaleOutlines(base) {
        state.layers.forEach(layer => {
            if (layer.type !== 'outline' || layer.status === 'pending') return;
            const key = layer.sourceKey;
            const stale = !key || key.imageVersion !== state.imageVersion || key.width !== base.width || key.height !== base.height;
            if (stale) this.requestOutline(layer);
        });
    }

    requestOutline(layer) {
        if (!state.latestConversionData) return;
        const requestId = nextLayerId('req');
        layer.pendingRequestId = requestId;
        layer.status = 'pending';
        this.render(); // '생성 중' 뱃지만 반영 - 아직 합성할 새 픽셀이 없으니 LAYERS_CHANGED는 쏘지 않음

        eventBus.emit('REQUEST_OUTLINE_LAYER', {
            layerId: layer.id,
            requestId,
            params: layer.params,
            width: state.latestConversionData.width,
            height: state.latestConversionData.height
        });
    }

    debounceRequestOutline(layer) {
        clearTimeout(this.outlineDebounceTimers.get(layer.id));
        const timer = setTimeout(() => this.requestOutline(layer), OUTLINE_DEBOUNCE_MS);
        this.outlineDebounceTimers.set(layer.id, timer);
    }

    addOutlineLayer() {
        if (!state.originalImageData || !state.latestConversionData) { alert(t('alert_layer_needs_image')); return; }
        if (state.layers.length >= MAX_LAYERS) { alert(t('alert_layer_max')); return; }

        const layer = {
            id: nextLayerId('outline'),
            type: 'outline',
            name: t('layer_default_name_outline'),
            visible: true,
            opacity: 100,
            blendMode: 'normal',
            params: { ...OUTLINE_DEFAULTS },
            imageData: null,
            sourceKey: null,
            pendingRequestId: null,
            status: 'pending'
        };
        state.layers.push(layer);
        this.emitChanged();
        this.requestOutline(layer);
    }

    // 03-uploader/logic.js의 handleFile과 같은 디코딩 방식(objectURL -> Image -> 캔버스 -> ImageData).
    // 캔버스 크기에 맞춰 늘리는 건 합성 시점에 LayerCompositor.getLayerPixels가 알아서 처리하므로
    // 여기서는 원본 그대로의 ImageData만 들고 있으면 된다.
    addImageLayer(file) {
        if (state.layers.length >= MAX_LAYERS) { alert(t('alert_layer_max')); return; }
        if (!file.type.startsWith('image/')) { alert(t('alert_image_only')); return; }

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const sourceImageData = ctx.getImageData(0, 0, img.width, img.height);

            const layer = {
                id: nextLayerId('image'),
                type: 'image',
                name: file.name || t('layer_default_name_image'),
                visible: true,
                opacity: 100,
                blendMode: 'normal',
                sourceImageData
            };
            state.layers.push(layer);
            this.emitChanged();
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            alert(t('alert_image_only'));
        };
        img.src = objectUrl;
    }

    removeLayer(id) {
        const idx = state.layers.findIndex(l => l.id === id);
        if (idx <= 0) return; // index 0(베이스)은 고정, 삭제 불가
        clearTimeout(this.outlineDebounceTimers.get(id));
        this.outlineDebounceTimers.delete(id);
        state.layers.splice(idx, 1);
        this.emitChanged();
    }

    // dir: +1(위로, 나중에 합성 = 더 위에 보임) / -1(아래로)
    moveLayer(id, dir) {
        const idx = state.layers.findIndex(l => l.id === id);
        if (idx <= 0) return;
        const target = idx + dir;
        if (target < 1 || target >= state.layers.length) return;
        [state.layers[idx], state.layers[target]] = [state.layers[target], state.layers[idx]];
        this.emitChanged();
    }

    getLayerFromEvent(e) {
        const row = e.target.closest('[data-layer-id]');
        if (!row) return null;
        return state.layers.find(l => l.id === row.dataset.layerId) || null;
    }

    handleListClick(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const layer = this.getLayerFromEvent(e);
        if (!layer) return;

        switch (actionEl.dataset.action) {
            case 'moveUp': this.moveLayer(layer.id, 1); break;
            case 'moveDown': this.moveLayer(layer.id, -1); break;
            case 'remove':
                if (confirm(t('confirm_remove_layer'))) this.removeLayer(layer.id);
                break;
        }
    }

    // range/color 입력 - 드래그 중 계속 발생하므로 리스트를 다시 그리지 않고(DOM 보존)
    // 값 표시만 직접 갱신한 뒤 LAYERS_CHANGED(합성 미리보기)나 디바운스된 외곽선 재생성을 건다.
    handleListInput(e) {
        const el = e.target;
        const action = el.dataset.action;
        if (!action) return;
        const layer = this.getLayerFromEvent(e);
        if (!layer || layer.type === 'base') return;

        if (action === 'opacity') {
            layer.opacity = parseInt(el.value, 10);
            const valSpan = el.closest('.lyr-opacity-row')?.querySelector('.lyr-opacity-val');
            if (valSpan) valSpan.textContent = `${layer.opacity}%`;
            eventBus.emit('LAYERS_CHANGED');
            return;
        }

        if (layer.type !== 'outline') return;
        const valSpan = el.closest('.lyr-outline-field')?.querySelector('.lyr-val');

        switch (action) {
            case 'outlineThreshold':
                layer.params.threshold = parseInt(el.value, 10);
                if (valSpan) valSpan.textContent = layer.params.threshold;
                break;
            case 'outlineContrast':
                layer.params.contrast = parseInt(el.value, 10);
                if (valSpan) valSpan.textContent = layer.params.contrast;
                break;
            case 'outlineBrightness':
                layer.params.brightness = parseInt(el.value, 10);
                if (valSpan) valSpan.textContent = layer.params.brightness;
                break;
            case 'outlineLineWeight':
                layer.params.lineWeight = parseFloat(el.value);
                if (valSpan) valSpan.textContent = `${Math.round(layer.params.lineWeight * 100)}%`;
                break;
            case 'outlineInkColor':
                layer.params.inkHex = el.value;
                break;
            default:
                return;
        }
        this.debounceRequestOutline(layer);
    }

    // checkbox(visibility)/select(blendMode) - 구조는 안 바뀌니 리스트를 다시 그릴 필요 없음.
    handleListChange(e) {
        const el = e.target;
        const action = el.dataset.action;
        if (!action) return;
        const layer = this.getLayerFromEvent(e);
        if (!layer) return;

        if (action === 'toggleVisible') {
            layer.visible = el.checked;
            eventBus.emit('LAYERS_CHANGED');
            return;
        }
        if (action === 'blendMode' && layer.type !== 'base') {
            layer.blendMode = el.value;
            eventBus.emit('LAYERS_CHANGED');
        }
    }
}
