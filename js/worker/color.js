// js/worker/color.js

// 값 범위 제한 유틸리티
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// RGB 유클리드 거리 제곱 (빠른 계산용)
export const colorDistanceSq = (c1, c2) => ((c1[0] - c2[0]) ** 2) + ((c1[1] - c2[1]) ** 2) + ((c1[2] - c2[2]) ** 2);

// ==============================================================
// [New] Wdot 로직 이식 (RGB -> Lab 변환 및 CIEDE2000 공식)
// ==============================================================
function rgbToLab(rgb) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    
    x = (x > 0.008856) ? Math.cbrt(x) : (7.787 * x) + (16 / 116);
    y = (y > 0.008856) ? Math.cbrt(y) : (7.787 * y) + (16 / 116);
    z = (z > 0.008856) ? Math.cbrt(z) : (7.787 * z) + (16 / 116);
    
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

function ciede2000(lab1, lab2) {
    const [L1, a1, b1] = lab1; 
    const [L2, a2, b2] = lab2;
    
    const kL = 1, kC = 1, kH = 1;
    const deg2rad = Math.PI / 180;
    const rad2deg = 180 / Math.PI;

    const C1 = Math.sqrt(a1**2 + b1**2);
    const C2 = Math.sqrt(a2**2 + b2**2);
    const C_bar = (C1 + C2) / 2;
    
    const G = 0.5 * (1 - Math.sqrt(C_bar**7 / (C_bar**7 + 25**7)));
    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;
    
    const C1p = Math.sqrt(a1p**2 + b1**2);
    const C2p = Math.sqrt(a2p**2 + b2**2);
    
    const h1p = (Math.atan2(b1, a1p) * rad2deg + 360) % 360;
    const h2p = (Math.atan2(b2, a2p) * rad2deg + 360) % 360;
    
    const dLp = L2 - L1;
    const dCp = C2p - C1p;
    
    let dhp = 0;
    if (C1p * C2p !== 0) {
        const diff = h2p - h1p;
        if (Math.abs(diff) <= 180) dhp = diff;
        else if (diff > 180) dhp = diff - 360;
        else dhp = diff + 360;
    }
    
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * deg2rad);
    
    const Lp_bar = (L1 + L2) / 2;
    const Cp_bar = (C1p + C2p) / 2;
    
    let hp_bar = 0;
    if (C1p * C2p !== 0) {
        const sum = h1p + h2p;
        if (Math.abs(h1p - h2p) <= 180) hp_bar = sum / 2;
        else if (sum < 360) hp_bar = (sum + 360) / 2;
        else hp_bar = (sum - 360) / 2;
    }
    
    const T = 1 - 0.17 * Math.cos((hp_bar - 30) * deg2rad) 
                + 0.24 * Math.cos((2 * hp_bar) * deg2rad) 
                + 0.32 * Math.cos((3 * hp_bar + 6) * deg2rad) 
                - 0.20 * Math.cos((4 * hp_bar - 63) * deg2rad);
                
    const dTheta = 30 * Math.exp(-Math.pow((hp_bar - 275) / 25, 2));
    const Rc = 2 * Math.sqrt(Cp_bar**7 / (Cp_bar**7 + 25**7));
    const Sl = 1 + (0.015 * Math.pow(Lp_bar - 50, 2)) / Math.sqrt(20 + Math.pow(Lp_bar - 50, 2));
    const Sc = 1 + 0.045 * Cp_bar;
    const Sh = 1 + 0.015 * Cp_bar * T;
    const Rt = -Math.sin(2 * dTheta * deg2rad) * Rc;
    
    return Math.sqrt(
        (dLp / (kL * Sl))**2 + 
        (dCp / (kC * Sc))**2 + 
        (dHp / (kH * Sh))**2 + 
        Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
    );
}

// ==============================================================
// ColorConverter 객체 (외부에서 호출용)
// ==============================================================
export const ColorConverter = {
    srgbToLinear(c) { return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; },
    
    rgbToOklab(rgb) {
        // ... (기존 Oklab 변환 로직 유지) ...
        const r = this.srgbToLinear(rgb[0] / 255);
        const g = this.srgbToLinear(rgb[1] / 255);
        const b = this.srgbToLinear(rgb[2] / 255);
        
        const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
        
        const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
        
        return [
            0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        ];
    },
    
    // Wdot 모드용 함수들
    rgbToLab: rgbToLab,
    ciede2000: ciede2000,

    // ★ [중요 수정] quantization.js에서 호출하는 이름과 맞춰줍니다.
    deltaE2000: ciede2000, 
    
    // Oklab 거리 계산 (유클리드)
    deltaOklab(lab1, lab2) { 
        return (lab1[0] - lab2[0])**2 + (lab1[1] - lab2[1])**2 + (lab1[2] - lab2[2])**2; 
    }
};

// ==============================================================
// 가장 가까운 색 찾기 (Find Closest Color) - 3가지 모드 지원
// ==============================================================
export const findClosestColor = (r1, g1, b1, palette, paletteConverted, colorMethod) => {
    let minDistance = Infinity;
    let closestIndex = 0;

    if (colorMethod === 'ciede2000') {
        // [Mode 3] Wdot 모드 (CIEDE2000) - 가장 느림, 최고 정확도
        const targetLab = ColorConverter.rgbToLab([r1, g1, b1]);
        for (let i = 0; i < paletteConverted.length; i++) {
            const dist = ColorConverter.ciede2000(targetLab, paletteConverted[i]);
            if (dist < minDistance) { 
                minDistance = dist; 
                closestIndex = i; 
            }
        }
    } else if (colorMethod === 'oklab') {
        // [Mode 2] Noadot 고품질 (Oklab) - 빠르고 정확함
        const targetOklab = ColorConverter.rgbToOklab([r1, g1, b1]);
        for (let i = 0; i < paletteConverted.length; i++) {
            const dist = ColorConverter.deltaOklab(targetOklab, paletteConverted[i]);
            if (dist < minDistance) { 
                minDistance = dist; 
                closestIndex = i; 
            }
        }
    } else {
        // [Mode 1] 일반 (RGB Redmean) - 매우 빠름
        for (let i = 0; i < palette.length; i++) {
            const [r2, g2, b2] = palette[i];
            const rMean = (r1 + r2) * 0.5;
            const r = r1 - r2;
            const g = g1 - g2;
            const b = b1 - b2;
            const dist = ((512 + rMean) * r * r) + (4 * 256 * g * g) + ((767 - rMean) * b * b);
            if (dist < minDistance) { 
                minDistance = dist; 
                closestIndex = i; 
            }
        }
    }
    
    return { color: palette[closestIndex] || [0, 0, 0] };
};

// (패턴 디더링용, 속도를 위해 단순 거리 계산 사용)
export const findTwoClosestColors = (r, g, b, palette, paletteConverted, colorMethod) => {
    if (palette.length < 2) { 
        const c = palette[0] || [0,0,0]; 
        return { darker: c, brighter: c }; 
    }
    
    // 성능을 위해 패턴 디더링에서는 복잡한 ciede2000 대신 RGB 방식을 주로 사용하거나,
    // 필요하다면 위와 같은 분기 처리를 넣을 수 있습니다.
    // 여기서는 RGB 거리 기준으로 근사합니다.
    let d1 = Infinity, idx1 = -1;
    let d2 = Infinity, idx2 = -1;
    
    for (let i = 0; i < palette.length; i++) {
        const dist = colorDistanceSq([r,g,b], palette[i]);
        if (dist < d1) {
            d2 = d1; idx2 = idx1;
            d1 = dist; idx1 = i;
        } else if (dist < d2) {
            d2 = dist; idx2 = i;
        }
    }
    
    const c1 = palette[idx1];
    const c2 = palette[idx2];
    const l1 = c1[0]*0.299 + c1[1]*0.587 + c1[2]*0.114;
    const l2 = c2[0]*0.299 + c2[1]*0.587 + c2[2]*0.114;
    
    return l1 < l2 ? { darker: c1, brighter: c2 } : { darker: c2, brighter: c1 };
};