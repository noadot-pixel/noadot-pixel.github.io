// js/features/user-palette/algorithms.js
import { hexToRgb, rgbToHex } from '../../state.js';

export class UserPaletteAlgorithms {
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

    // [New] 스마트 파싱 (JSON 우선 -> 텍스트 패턴 검색)
    parseImportData(textData) {
        // 1. JSON 형식(업로드한 파일 포맷)인지 먼저 시도
        try {
            const parsed = JSON.parse(textData);
            // 배열이고, 내부 요소도 배열([r,g,b])인지 확인
            if (Array.isArray(parsed)) {
                // 유효한 RGB 배열만 필터링
                const validColors = parsed.filter(item => 
                    Array.isArray(item) && 
                    item.length === 3 && 
                    item.every(n => typeof n === 'number' && n >= 0 && n <= 255)
                );
                
                if (validColors.length > 0) return validColors;
            }
        } catch (e) {
            // JSON 파싱 실패 시 무시하고 아래 텍스트 분석으로 넘어감
        }

        // 2. JSON이 아니라면 텍스트에서 Hex/RGB 추출 (기존 로직 + extractColorsFromText 활용)
        return this.extractColorsFromText(textData);
    }

    // 텍스트에서 색상 추출 (Hex 제거 후 숫자 추출 방식)
    extractColorsFromText(text) {
        const foundColors = [];
        let remainingText = text;

        // 1. Hex 코드 패턴 찾기
        const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
        let match;
        
        while ((match = hexRegex.exec(text)) !== null) {
            const rgb = hexToRgb(match[0]);
            if (rgb) {
                foundColors.push(rgb);
                remainingText = remainingText.replace(match[0], ' ');
            }
        }

        // 2. 남은 텍스트에서 RGB 숫자 패턴 찾기
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
}