// js/worker/outlining.js
import { ColorConverter, findClosestColor } from './color.js';
import { posterizeWithKMeans, quantizePopularity, quantizeMedianCut, quantizeOctree, quantizeWu } from './quantization.js';
import { applyKuwaharaFilter, applyMedianFilter, applyDespeckle, applyColorSimplification, getEdgeMask, applySmartBlur } from './filters.js';

export function applyCelShadingFilter(imageData, palette, options) {
    const { celShading, colorMethod } = options;
    const { width, height, data } = imageData;
    
    // [독립 옵션 처리] 체크박스가 켜져있을 때만 작동
    const useAspireDither = options.applyAspireDither === true;
    const applyRefinement = options.applyRefinement === true;
    const strength = applyRefinement ? parseInt(options.refinementStrength || 0) : 0;

    let processedImage = imageData;
    
    if (strength > 0) {
        if (strength <= 40) {
            const radius = strength > 20 ? 2 : 1;
            const threshold = 10 + strength; 
            processedImage = applySmartBlur(imageData, radius, threshold);
        } else if (strength <= 80) {
            const radius = strength > 60 ? 3 : 2;
            processedImage = applyKuwaharaFilter(imageData, radius);
        } else {
            const radius = strength > 90 ? 2 : 1;
            processedImage = applyMedianFilter(imageData, radius);
        }

        if (strength > 50) {
            const step = Math.floor((strength - 50) * 0.4);
            if (step > 2) processedImage = applyColorSimplification(processedImage, step);
        }
    }

    let edgeMask = null;
    if (celShading && celShading.outline) {
        const threshold = celShading.outlineThreshold || 50;
        edgeMask = getEdgeMask(processedImage, threshold);
    }

    const algorithm = celShading.algorithm || 'kmeans'; 
    let quantizationResult;

    switch (algorithm) {
        case 'popularity': quantizationResult = quantizePopularity(processedImage, celShading); break;
        case 'mediancut': quantizationResult = quantizeMedianCut(processedImage, celShading); break;
        case 'octree': quantizationResult = quantizeOctree(processedImage, celShading); break;
        case 'wu': quantizationResult = quantizeWu(processedImage, celShading); break;
        case 'kmeans': default: quantizationResult = posterizeWithKMeans(processedImage, celShading); break;
    }

    let { centroids: posterColors, posterizedData } = quantizationResult;
    
    const finalImageData = new ImageData(width, height);
    
    let paletteConverted = null;
    if (colorMethod === 'oklab') {
        paletteConverted = palette.map(c => ColorConverter.rgbToOklab(c));
    } else if (colorMethod === 'ciede2000' || colorMethod === 'ciede2000-d65') {
        const converter = (colorMethod === 'ciede2000-d65') ? ColorConverter.rgbToLabD65 : ColorConverter.rgbToLab;
        paletteConverted = palette.map(c => converter(c));
    }

    const finalUniqueColors = [];
    const colorSet = new Set();
    const posterMap = new Map();

    for (const pColor of posterColors) {
        let finalColor = pColor;
        if (palette && palette.length > 0) {
            finalColor = findClosestColor(pColor[0], pColor[1], pColor[2], palette, paletteConverted, colorMethod).color;
        }
        posterMap.set(pColor.join(','), finalColor);
        const hex = finalColor.join(',');
        if (!colorSet.has(hex)) {
            colorSet.add(hex);
            finalUniqueColors.push(finalColor);
        }
    }

    if (useAspireDither && finalUniqueColors.length > 1) {
        const bayer8x8 = [
            [ 0, 32,  8, 40,  2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
            [12, 44,  4, 36, 14, 46,  6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
            [ 3, 35, 11, 43,  1, 33,  9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
            [15, 47,  7, 39, 13, 45,  5, 37], [63, 31, 55, 23, 61, 29, 53, 21]
        ];

        const procData = processedImage.data;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                if (procData[i + 3] === 0) continue;

                const r = procData[i], g = procData[i+1], b = procData[i+2];

                let d1 = Infinity, idx1 = 0;
                let d2 = Infinity, idx2 = 0;

                for (let j = 0; j < finalUniqueColors.length; j++) {
                    const pr = finalUniqueColors[j][0], pg = finalUniqueColors[j][1], pb = finalUniqueColors[j][2];
                    const dist = (r-pr)*(r-pr) + (g-pg)*(g-pg) + (b-pb)*(b-pb);
                    
                    if (dist < d1) { d2 = d1; idx2 = idx1; d1 = dist; idx1 = j; } 
                    else if (dist < d2) { d2 = dist; idx2 = j; }
                }

                let ratio = 0;
                if (d1 + d2 > 0) ratio = d1 / (d1 + d2);
                
                const threshold = bayer8x8[y % 8][x % 8] / 64.0;
                const chosenColor = ratio > threshold ? finalUniqueColors[idx2] : finalUniqueColors[idx1];

                finalImageData.data[i] = chosenColor[0];
                finalImageData.data[i+1] = chosenColor[1];
                finalImageData.data[i+2] = chosenColor[2];
                finalImageData.data[i+3] = 255;
            }
        }
    } else {
        for (let i = 0; i < posterizedData.data.length; i += 4) {
            if (posterizedData.data[i + 3] > 0) {
                const key = [
                    Math.round(posterizedData.data[i]), 
                    Math.round(posterizedData.data[i + 1]), 
                    Math.round(posterizedData.data[i + 2])
                ].join(',');
                
                const finalColor = posterMap.get(key) || [0, 0, 0];
                finalImageData.data[i] = finalColor[0]; 
                finalImageData.data[i + 1] = finalColor[1]; 
                finalImageData.data[i + 2] = finalColor[2]; 
                finalImageData.data[i + 3] = 255;
            }
        }
    }

    let cleanedImageData = finalImageData;
    if (strength > 0 && !useAspireDither) {
        const iterations = strength > 60 ? 2 : 1;
        cleanedImageData = applyDespeckle(finalImageData, iterations);
    }

    if (edgeMask) {
        let outlineRGB = celShading.outlineColor || [0, 0, 0];
        if (typeof outlineRGB === 'string') {
            const r = parseInt(outlineRGB.slice(1, 3), 16);
            const g = parseInt(outlineRGB.slice(3, 5), 16);
            const b = parseInt(outlineRGB.slice(5, 7), 16);
            outlineRGB = [r, g, b];
        }

        for (let i = 0; i < width * height; i++) {
            if (edgeMask[i] === 1) {
                cleanedImageData.data[i * 4] = outlineRGB[0];
                cleanedImageData.data[i * 4 + 1] = outlineRGB[1];
                cleanedImageData.data[i * 4 + 2] = outlineRGB[2];
                cleanedImageData.data[i * 4 + 3] = 255;
            }
        }
    }

    return cleanedImageData;
}