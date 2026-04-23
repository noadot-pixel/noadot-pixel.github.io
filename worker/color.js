// js/worker/color.js

// 값 범위 제한 유틸리티
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// RGB 유클리드 거리 제곱 (빠른 계산용)
export const colorDistanceSq = (c1, c2) => ((c1[0] - c2[0]) ** 2) + ((c1[1] - c2[1]) ** 2) + ((c1[2] - c2[2]) ** 2);

// ==============================================================
// [기존] Wdot 로직 (RGB -> Lab D50 변환)
// 인쇄물 등 D50 환경에 적합
// ==============================================================
function rgbToLab(rgb) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    let X = r * 0.4124 + g * 0.3576 + b * 0.1805;
    let Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    let Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
    
    // D50 Reference White
    let x = X / 0.9642; 
    let y = Y / 1.0000; 
    let z = Z / 0.8249; 
    
    x = (x > 0.008856) ? Math.cbrt(x) : (7.787 * x) + (16 / 116);
    y = (y > 0.008856) ? Math.cbrt(y) : (7.787 * y) + (16 / 116);
    z = (z > 0.008856) ? Math.cbrt(z) : (7.787 * z) + (16 / 116);
    
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

// ==============================================================
// [신규] 웹 표준 로직 (RGB -> Lab D65 변환)
// 모니터 화면, 웹 이미지에 적합 (피부톤 문제 해결)
// ==============================================================
function rgbToLabD65(rgb) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    // sRGB to XYZ (D65) Matrix
    let X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    let Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    let Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
    
    // D65 Reference White (2° Observer)
    let x = X / 0.95047; 
    let y = Y / 1.00000; 
    let z = Z / 1.08883; 
    
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
// ColorConverter 객체
// ==============================================================
export const ColorConverter = {
    srgbToLinear(c) { return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; },
    
    rgbToOklab(rgb) {
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

    oklabToRgb: function(c) {
        let L = c[0], a = c[1], b = c[2];
        
        // 1. Oklab -> 선형 LMS
        let l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        let m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        let s_ = L - 0.0894841775 * a - 1.2914855480 * b;

        let l = l_ * l_ * l_;
        let m = m_ * m_ * m_;
        let s = s_ * s_ * s_;

        // 2. 선형 LMS -> 선형 RGB
        let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        let b_ = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

        // 3. 선형 RGB -> sRGB (모니터용 감마 교정)
        const toSRGB = (x) => {
            x = Math.max(0, Math.min(1, x));
            return x >= 0.0031308 ? (1.055 * Math.pow(x, 1.0 / 2.4) - 0.055) : 12.92 * x;
        };

        // 최종적으로 화면에 뿌릴 수 있는 0~255 RGB 배열로 리턴
        return [toSRGB(r) * 255, toSRGB(g) * 255, toSRGB(b_) * 255];
    },
    
    rgbToLab: rgbToLab,       
    rgbToLabD65: rgbToLabD65, 
    ciede2000: ciede2000,
    deltaE2000: ciede2000, 
    
    deltaOklab(lab1, lab2) { 
        return (lab1[0] - lab2[0])**2 + (lab1[1] - lab2[1])**2 + (lab1[2] - lab2[2])**2; 
    }
};

// ==============================================================
// 가장 가까운 색 찾기
// ==============================================================
export const findClosestColor = (r1, g1, b1, palette, paletteConverted, colorMethod, satWeight = 0.5) => {
    let minDistance = Infinity;
    let closestIndex = 0;

    // [신규 통합 연산 방식] wdot-plus (NoaDot-X) 로직 추가
    const isWdotBased = (colorMethod === 'wdot-plus' || colorMethod === 'ciede2000');

    if (isWdotBased || colorMethod === 'ciede2000-d65') {
        const isD65 = (colorMethod === 'ciede2000-d65');
        const targetLab = isD65 ? ColorConverter.rgbToLabD65([r1, g1, b1]) : ColorConverter.rgbToLab([r1, g1, b1]);
        const origChroma = Math.sqrt(targetLab[1] ** 2 + targetLab[2] ** 2);

        for (let i = 0; i < paletteConverted.length; i++) {
            const palLab = paletteConverted[i];
            let dist = ColorConverter.ciede2000(targetLab, palLab);

            // 'wdot-plus' 모드일 때만 채도 보정 가중치를 활성화하여 적용
            if (colorMethod === 'wdot-plus' && satWeight > 0 && origChroma > 2.0) { 
                const palChroma = Math.sqrt(palLab[1] ** 2 + palLab[2] ** 2);
                const lumDiff = Math.abs(targetLab[0] - palLab[0]);
                
                // 명도 차이가 크지 않을 때만 채도 우선 계산
                if (lumDiff < 15.0 && origChroma > palChroma) {
                    dist += (origChroma - palChroma) * (satWeight * 2.5);
                }
            }

            if (dist < minDistance) { 
                minDistance = dist; 
                closestIndex = i; 
            }
        }
    } else if (colorMethod === 'oklab') {
        const targetOklab = ColorConverter.rgbToOklab([r1, g1, b1]);
        for (let i = 0; i < paletteConverted.length; i++) {
            const dist = ColorConverter.deltaOklab(targetOklab, paletteConverted[i]);
            if (dist < minDistance) { 
                minDistance = dist; 
                closestIndex = i; 
            }
        }
    } else {
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

// (패턴 디더링용, RGB 거리 사용)
export const findTwoClosestColors = (r, g, b, palette, paletteConverted, colorMethod) => {
    if (palette.length < 2) { 
        const c = palette[0] || [0,0,0]; 
        return { darker: c, brighter: c }; 
    }
    
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

function getNormalizedDistance(metric, target, palColor) {
    if (metric === 'rgb') return colorDistanceSq(target.rgb, palColor.rgb) / 195075.0;
    if (metric === 'oklab') return ColorConverter.deltaOklab(target.oklab, palColor.oklab) / 1.5;
    if (metric === 'ciede2000') return ColorConverter.deltaE2000(target.labD50, palColor.labD50) / 100.0;
    if (metric === 'ciede2000-d65') return ColorConverter.deltaE2000(target.labD65, palColor.labD65) / 100.0; // 👈 추가됨!
    return Infinity;
}

// 🌟 대망의 퓨전 코어 (기존 findClosestColor를 대체합니다)
export function findClosestColorFusion(r, g, b, activePalette, fusionParams) {
    const tRgb = [r, g, b];
    const tOklab = ColorConverter.rgbToOklab(tRgb);
    
    // 1. 타겟 픽셀 데이터 세팅
    const target = {
        rgb: tRgb,
        oklab: tOklab,
        labD50: ColorConverter.rgbToLab(tRgb),
        labD65: ColorConverter.rgbToLabD65(tRgb), // 🌟 이 한 줄이 빠져서 기절했던 겁니다!
        chroma: Math.sqrt(tOklab[1]**2 + tOklab[2]**2)
    };

    let minDistance = Infinity;
    let bestColor = [0, 0, 0];

    // 2. 팔레트 순회하며 퓨전 공식 계산
    for (const pal of activePalette) {
        // 단일 모드일 때는 무조건 A(선택한 모델)의 거리만 계산합니다.
        const distA = getNormalizedDistance(fusionParams.modelA, target, pal);
        let finalDistance = distA; 

        // 🌟 퓨전 모드(modelB가 있고, 비중이 0 이상일 때)에만 B를 계산해서 섞습니다!
        if (fusionParams.modelB !== 'none' && fusionParams.weightM > 0) {
            const distB = getNormalizedDistance(fusionParams.modelB, target, pal);
            finalDistance = (distA * (1.0 - fusionParams.weightM)) + (distB * fusionParams.weightM);
        }

        // 3. 피부색(채도) 보호막 개입
        if (fusionParams.chromaBoost > 0) {
            const palChroma = Math.sqrt(pal.oklab[1]**2 + pal.oklab[2]**2);
            if (target.chroma > 0.05 && palChroma < target.chroma) {
                const lumaDiff = Math.abs(target.oklab[0] - pal.oklab[0]);
                // 밝기 차이가 적을 때만 채도 페널티를 강하게 줌
                if (lumaDiff < 0.2) {
                    finalDistance += (target.chroma - palChroma) * (fusionParams.chromaBoost / 10.0);
                }
            }
        }

        // 4. 최단 거리(최고의 색) 갱신
        if (finalDistance < minDistance) {
            minDistance = finalDistance;
            bestColor = pal.rgb;
        }
    }

    return { color: bestColor };
}