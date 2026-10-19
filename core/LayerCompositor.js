// js/core/LayerCompositor.js
// 🌟 [레이어 기능] 레이어 합성 담당. DOM을 직접 건드리지 않는 순수 모듈 - 뷰어(실시간 미리보기)와
// 다운로드(내보내기 전 평탄화) 양쪽에서 똑같이 가져다 쓴다.
//
// 🚨 [설계 결정] <canvas>+drawImage가 아니라 ImageData를 직접 순회하는 방식을 쓴다:
//   - 다운로드는 지금도 ImageData를 그대로 읽어서 쓰는데, 캔버스로 합성하면 내보내기 직전에
//     getImageData()로 다시 읽어야 하고, 지문방지(anti-fingerprinting) 브라우저(Brave 등)는
//     캔버스 읽기에 일부러 노이즈를 섞어서 내보낸 파일에 팔레트 밖의 엉뚱한 색이 섞여 들어갈 수 있음.
//   - 캔버스 알파는 premultiplied라 반투명(opacity<100%) 정밀도가 깎임.
//   - 'normal'은 유효한 globalCompositeOperation 값이 아님('source-over'가 맞는 이름) - 조용히 무시되는 버그 소지.
//   - 아래의 "클린업 패스"(팔레트 밖 색/반투명 정리)는 어차피 픽셀 단위로 순회해야 해서, 캔버스를 쓰든
//     안 쓰든 이 순회 자체는 피할 수 없음.
import { smartResize } from '../worker/smart-resizer.js';

export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'];

function blendChannel(mode, cb, cs) {
    switch (mode) {
        case 'multiply': return (cb * cs) / 255;
        case 'screen': return 255 - ((255 - cb) * (255 - cs)) / 255;
        case 'overlay': return cb < 128 ? (2 * cb * cs) / 255 : 255 - (2 * (255 - cb) * (255 - cs)) / 255;
        case 'darken': return Math.min(cb, cs);
        case 'lighten': return Math.max(cb, cs);
        case 'normal':
        default: return cs;
    }
}

// 레이어의 픽셀 데이터를 목표 해상도로 돌려준다. 베이스 레이어 리사이즈(엔진 쪽 resizeMode)와는
// 무관하게, 레이어 합성용으로는 항상 nearest(최근접)로만 맞춘다 - 레이어 쪽에서 임의로 다른
// 리샘플링 흐림을 만들지 않기 위함. 크기가 이미 맞으면 그대로 반환(복사 없음).
export function getLayerPixels(layer, w, h) {
    const source = layer.type === 'image' ? layer.sourceImageData : layer.imageData;
    if (!source) return null;
    if (source.width === w && source.height === h) return source;

    const cacheKey = `${w}x${h}`;
    if (layer._cache && layer._cacheKey === cacheKey) return layer._cache;

    const resized = smartResize(source, w, h, 'nearest');
    layer._cache = resized;
    layer._cacheKey = cacheKey;
    return resized;
}

// W3C 합성/블렌드 공식(straight alpha):
//   mixedSrc = (1-αb)×Cs + αb×B(Cb,Cs)
//   Co = αs×mixedSrc + αb×Cb×(1-αs),  αo = αs + αb×(1-αs),  결과색 = Co/αo
// dst(out 배열)를 그 자리에서 갱신한다. 아무것도 안 바뀌면 false를 돌려준다.
function compositePixel(dst, o, srcData, so, opacity01, mode) {
    const srcA = srcData[so + 3] / 255;
    const effSrcA = srcA * opacity01;
    if (effSrcA <= 0) return false;

    const ab = dst[o + 3] / 255;
    let changed = false;

    const ao = effSrcA + ab * (1 - effSrcA);
    if (ao <= 0) {
        dst[o] = 0; dst[o + 1] = 0; dst[o + 2] = 0; dst[o + 3] = 0;
        return true;
    }

    for (let ch = 0; ch < 3; ch++) {
        const cb = dst[o + ch], cs = srcData[so + ch];
        const mixed = (1 - ab) * cs + ab * blendChannel(mode, cb, cs);
        const co = effSrcA * mixed + ab * cb * (1 - effSrcA);
        dst[o + ch] = Math.max(0, Math.min(255, co / ao));
    }
    dst[o + 3] = Math.max(0, Math.min(255, ao * 255));
    changed = true;
    return changed;
}

// base: ImageData (오늘까지의 변환 파이프라인 결과, "베이스 레이어"). layers: state.layers 전체(베이스 포함).
// 반환: { imageData, touched } - touched는 Uint8Array|null, 레이어가 실제로 손댄 픽셀만 1.
export function compositeLayers(base, layers, { snapToPalette = false, snapper = null } = {}) {
    const baseEntry = layers.find(l => l.type === 'base');
    const baseVisible = !baseEntry || baseEntry.visible !== false;
    const visibleExtra = layers.filter(l => l.type !== 'base' && l.visible);

    // 🌟 빠른 경로: 추가 레이어가 하나도 안 보이면 오늘과 완전히 동일 - 복사조차 안 한다
    if (visibleExtra.length === 0) {
        if (!baseVisible) {
            return { imageData: new ImageData(base.width, base.height), touched: null };
        }
        return { imageData: base, touched: null };
    }

    const w = base.width, h = base.height;
    const out = new Uint8ClampedArray(base.data.length);
    if (baseVisible) out.set(base.data);

    const touched = new Uint8Array(w * h);

    for (const layer of visibleExtra) {
        const pixels = getLayerPixels(layer, w, h);
        if (!pixels) continue;
        const srcData = pixels.data;
        const opacity01 = Math.max(0, Math.min(100, layer.opacity ?? 100)) / 100;
        const mode = BLEND_MODES.includes(layer.blendMode) ? layer.blendMode : 'normal';

        for (let p = 0; p < w * h; p++) {
            const o = p * 4;
            if (srcData[o + 3] === 0) continue;
            if (compositePixel(out, o, srcData, o, opacity01, mode)) touched[p] = 1;
        }
    }

    // 🌟 클린업 패스: 레이어가 실제로 건드린 픽셀만 - 손 안 댄 픽셀의 디더링 결과는 그대로 보존한다.
    // 반투명/블렌드로 팔레트 밖 색이 생긴 걸 여기서 정리하지 않으면 wplace/bplace/3place처럼
    // "고정 팔레트 + 완전 불투명 또는 완전 투명"만 허용하는 내보내기 포맷이 전부 깨진다.
    for (let p = 0; p < w * h; p++) {
        if (!touched[p]) continue;
        const o = p * 4;
        if (out[o + 3] < 128) {
            out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0;
        } else {
            out[o + 3] = 255;
            if (snapToPalette && snapper) {
                const snapped = snapper(Math.round(out[o]), Math.round(out[o + 1]), Math.round(out[o + 2]));
                out[o] = snapped[0]; out[o + 1] = snapped[1]; out[o + 2] = snapped[2];
            }
        }
    }

    return { imageData: new ImageData(out, w, h), touched };
}

// 보이는 외곽선 레이어 중 아직 생성 중이거나(pending), 결과가 지금 베이스 이미지/크기와
// 안 맞는(stale) 게 하나라도 있으면 false - 내보내기를 막는 데 쓴다.
export function isLayerStackReady(layers, base, imageVersion) {
    if (!base) return true;
    for (const layer of layers) {
        if (layer.type !== 'outline' || !layer.visible) continue;
        if (layer.status === 'pending') return false; // 생성 중
        if (layer.status === 'error' && !layer.imageData) return false; // 실패했고 쓸 만한 이전 결과도 없음
        if (layer.sourceKey) {
            const k = layer.sourceKey;
            if (k.imageVersion !== imageVersion || k.width !== base.width || k.height !== base.height) return false;
        } else {
            return false;
        }
    }
    return true;
}
