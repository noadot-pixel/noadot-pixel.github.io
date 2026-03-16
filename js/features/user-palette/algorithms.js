// js/features/user-palette/algorithms.js
import { hexToRgb, rgbToHex } from '../../state.js';

export class UserPaletteAlgorithms {
    constructor() {
        this._cachedImageData = null;
        this._cachedSortedColors = null;
    }

    validateInput(type, value) {
        if (type === 'hex') {
            return /^#?([0-9A-F]{3}){1,2}$/i.test(value);
        }
        if (type === 'rgb') {
            const num = parseInt(value, 10);
            return !isNaN(num) && num >= 0 && num <= 255;
        }
        return false;
    }

    isDuplicate(newColorRgb, currentList) {
        return currentList.some(c => 
            c[0] === newColorRgb[0] && 
            c[1] === newColorRgb[1] && 
            c[2] === newColorRgb[2]
        );
    }

    parseImportData(textData) {
        try {
            const parsed = JSON.parse(textData);
            if (Array.isArray(parsed)) {
                const validColors = parsed.filter(item => 
                    Array.isArray(item) && 
                    item.length === 3 && 
                    item.every(n => typeof n === 'number' && n >= 0 && n <= 255)
                );
                if (validColors.length > 0) return validColors;
            }
        } catch (e) {}

        return this.extractColorsFromText(textData);
    }

    extractColorsFromText(text) {
        const foundColors = [];
        let remainingText = text;

        const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
        let match;
        
        while ((match = hexRegex.exec(text)) !== null) {
            const rgb = hexToRgb(match[0]);
            if (rgb) {
                foundColors.push(rgb);
                remainingText = remainingText.replace(match[0], ' ');
            }
        }

        const numberMatches = remainingText.match(/\d+/g);
        if (numberMatches) {
            const numbers = numberMatches.map(Number);
            for (let i = 0; i < numbers.length; i += 3) {
                if (i + 2 < numbers.length) {
                    const r = numbers[i];
                    const g = numbers[i+1];
                    const b = numbers[i+2];
                    if (r <= 255 && g <= 255 && b <= 255) {
                        foundColors.push([r, g, b]);
                    }
                }
            }
        }
        return foundColors;
    }

    analyzeOriginalColors(imageData) {
        if (!imageData) return [];
        
        if (this._cachedImageData === imageData && this._cachedSortedColors) {
            return this._cachedSortedColors;
        }

        const data = imageData.data;
        const colorCounts = new Map();

        for (let i = 0; i < data.length; i += 4) {
            if (data[i+3] === 0) continue; 
            const hex = rgbToHex(data[i], data[i+1], data[i+2]).toUpperCase();
            colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
        }

        const sortedColors = Array.from(colorCounts.entries()).sort((a, b) => b[1] - a[1]);

        this._cachedImageData = imageData;
        this._cachedSortedColors = sortedColors;

        return sortedColors;
    }

    // [핵심 변경] 퍼센트가 아니라 'N개'로 정확히 추출합니다.
    extractTopColorsFromImage(imageData, targetCount) {
        if (!imageData || targetCount <= 0) return [];
        
        const sortedColors = this.analyzeOriginalColors(imageData);
        const actualCount = Math.min(targetCount, sortedColors.length); // 최대치를 넘지 않도록 방어
        const result = [];

        for (let i = 0; i < actualCount; i++) {
            const hex = sortedColors[i][0];
            const rgb = hexToRgb(hex);
            if (rgb) result.push(rgb);
        }
        
        return result;
    }
}