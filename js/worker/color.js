// js/worker/color.js

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const colorDistanceSq = (c1, c2) => ((c1[0] - c2[0]) ** 2) + ((c1[1] - c2[1]) ** 2) + ((c1[2] - c2[2]) ** 2);

export const ColorConverter = {
    K_L: 1, K_C: 1, K_H: 1,
    DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI,
    srgbToLinear(c) { return (c > 0.04045) ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; },
    rgbToOklab(rgb) {
        const r = this.srgbToLinear(rgb[0] / 255);
        const g = this.srgbToLinear(rgb[1] / 255);
        const b = this.srgbToLinear(rgb[2] / 255);
        const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
        const l_ = Math.cbrt(l); const m_ = Math.cbrt(m); const s_ = Math.cbrt(s);
        return [0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_];
    },
    deltaE2000(lab1, lab2) {
        const [L1, a1, b1] = lab1; const [L2, a2, b2] = lab2;
        const C1 = Math.sqrt(a1 * a1 + b1 * b1); const C2 = Math.sqrt(a2 * a2 + b2 * b2);
        const C_bar = (C1 + C2) * 0.5; const C_pow7 = Math.pow(C_bar, 7);
        const G = 0.5 * (1 - Math.sqrt(C_pow7 / (C_pow7 + 6103515625)));
        const a1_prime = a1 * (1 + G); const a2_prime = a2 * (1 + G);
        const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1); const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);
        let h1_prime = Math.atan2(b1, a1_prime) * this.RAD_TO_DEG; if (h1_prime < 0) h1_prime += 360;
        let h2_prime = Math.atan2(b2, a2_prime) * this.RAD_TO_DEG; if (h2_prime < 0) h2_prime += 360;
        const delta_L_prime = L2 - L1; const delta_C_prime = C2_prime - C1_prime;
        let delta_h_prime; const C_prod_prime = C1_prime * C2_prime;
        if (C_prod_prime === 0) { delta_h_prime = 0; } else { let h_diff = h2_prime - h1_prime; if (Math.abs(h_diff) <= 180) { delta_h_prime = h_diff; } else if (h_diff > 180) { delta_h_prime = h_diff - 360; } else { delta_h_prime = h_diff + 360; } }
        const delta_H_prime = 2 * Math.sqrt(C_prod_prime) * Math.sin(delta_h_prime * this.DEG_TO_RAD * 0.5);
        const L_bar_prime = (L1 + L2) * 0.5; const C_bar_prime = (C1_prime + C2_prime) * 0.5;
        let h_bar_prime; if (C_prod_prime === 0) { h_bar_prime = h1_prime + h2_prime; } else { const h_sum = h1_prime + h2_prime; if (Math.abs(h1_prime - h2_prime) <= 180) { h_bar_prime = h_sum * 0.5; } else if (h_sum < 360) { h_bar_prime = (h_sum + 360) * 0.5; } else { h_bar_prime = (h_sum - 360) * 0.5; } }
        const T = 1 - 0.17 * Math.cos((h_bar_prime - 30) * this.DEG_TO_RAD) + 0.24 * Math.cos(2 * h_bar_prime * this.DEG_TO_RAD) + 0.32 * Math.cos((3 * h_bar_prime + 6) * this.DEG_TO_RAD) - 0.20 * Math.cos((4 * h_bar_prime - 63) * this.DEG_TO_RAD);
        const L_bar_minus_50_sq = (L_bar_prime - 50) * (L_bar_prime - 50);
        const S_L = 1 + (0.015 * L_bar_minus_50_sq) / Math.sqrt(20 + L_bar_minus_50_sq);
        const S_C = 1 + 0.045 * C_bar_prime;
        const S_H = 1 + 0.015 * C_bar_prime * T;
        const C_bar_prime_pow7 = Math.pow(C_bar_prime, 7);
        const R_T = -2 * Math.sqrt(C_bar_prime_pow7 / (C_bar_prime_pow7 + 6103515625)) * Math.sin(60 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2)) * this.DEG_TO_RAD);
        const L_term = delta_L_prime / (this.K_L * S_L); const C_term = delta_C_prime / (this.K_C * S_C); const H_term = delta_H_prime / (this.K_H * S_H);
        return Math.sqrt(L_term * L_term + C_term * C_term + H_term * H_term + R_T * C_term * H_term);
    },
};

export const findClosestColor = (r1, g1, b1, palette, paletteOklab, useHighQuality) => {
    let minDistance = Infinity; let closestIndex = 0;
    if (useHighQuality && paletteOklab && paletteOklab.length > 0) {
        const targetOklab = ColorConverter.rgbToOklab([r1, g1, b1]);
        for (let i = 0; i < paletteOklab.length; i++) {
            const distance = ColorConverter.deltaE2000(targetOklab, paletteOklab[i]);
            if (distance < minDistance) { minDistance = distance; closestIndex = i; }
            if (minDistance < 0.001) return { color: palette[closestIndex], distance: minDistance };
        }
    } else {
        for (let i = 0; i < palette.length; i++) {
            const [r2, g2, b2] = palette[i];
            const rMean = (r1 + r2) * 0.5; const r = r1 - r2; const g = g1 - g2; const b = b1 - b2;
            const distance = ((512 + rMean) * r * r) / 256 + 4 * g * g + ((767 - rMean) * b * b) / 256;
            if (distance < minDistance) { minDistance = distance; closestIndex = i; }
            if (minDistance < 1) return { color: palette[closestIndex], distance: minDistance };
        }
    }
    return { color: palette[closestIndex] || [0, 0, 0], distance: minDistance };
};

export const findTwoClosestColors = (r, g, b, palette, paletteOklab, useHighQuality) => {
    if (palette.length < 2) { const color = palette[0] || [0, 0, 0]; return { darker: color, brighter: color }; }
    let firstMinDist = Infinity, firstIndex = -1; let secondMinDist = Infinity, secondIndex = -1;
    const targetOklab = useHighQuality ? ColorConverter.rgbToOklab([r, g, b]) : null;
    for (let i = 0; i < palette.length; i++) {
        const dist = useHighQuality ? ColorConverter.deltaE2000(targetOklab, paletteOklab[i]) : colorDistanceSq([r, g, b], palette[i]);
        if (dist < firstMinDist) { secondMinDist = firstMinDist; secondIndex = firstIndex; firstMinDist = dist; firstIndex = i; }
        else if (dist < secondMinDist) { secondMinDist = dist; secondIndex = i; }
    }
    const c1 = palette[firstIndex]; const c2 = palette[secondIndex];
    const lum1 = 0.299 * c1[0] + 0.587 * c1[1] + 0.114 * c1[2];
    const lum2 = 0.299 * c2[0] + 0.587 * c2[1] + 0.114 * c2[2];
    return lum1 < lum2 ? { darker: c1, brighter: c2 } : { darker: c2, brighter: c1 };
};