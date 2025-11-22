// js/worker/quantization.js
import { clamp, colorDistanceSq, ColorConverter } from './color.js';

export function preprocessImageData(sourceImageData, options) {
    const { saturation, brightness, contrast } = options;
    const sat = saturation / 100.0, bri = brightness, con = contrast;
    const factor = (259 * (con + 255)) / (255 * (259 - con));
    const data = new Uint8ClampedArray(sourceImageData.data);
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        if (bri !== 0) { r = clamp(r + bri, 0, 255); g = clamp(g + bri, 0, 255); b = clamp(b + bri, 0, 255); }
        if (con !== 0) { r = clamp(factor * (r - 128) + 128, 0, 255); g = clamp(factor * (g - 128) + 128, 0, 255); b = clamp(factor * (b - 128) + 128, 0, 255); }
        if (sat !== 1.0) { const gray = 0.299 * r + 0.587 * g + 0.114 * b; r = clamp(gray + sat * (r - gray), 0, 255); g = clamp(gray + sat * (g - gray), 0, 255); b = clamp(gray + sat * (b - gray), 0, 255); }
        data[i] = r; data[i + 1] = g; data[i + 2] = b;
    }
    return new ImageData(data, sourceImageData.width, sourceImageData.height);
}

export function posterizeWithKMeans(imageData, options) {
    const { levels: k, quantMethod, colorSpace } = options;
    const { data, width, height } = imageData;
    const useOklab = colorSpace === 'oklab';
    const pixels = [];
    const oklabPixels = useOklab ? [] : null;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            const rgb = [data[i], data[i + 1], data[i + 2]];
            pixels.push(rgb);
            if (useOklab) { oklabPixels.push(ColorConverter.rgbToOklab(rgb)); }
        }
    }
    if (pixels.length === 0) return { centroids: [], posterizedData: imageData };
    if (k >= pixels.length) {
        const posterizedData = new ImageData(width, height);
        let pixelIndex = 0;
        for (let i = 0; i < posterizedData.data.length; i += 4) {
            if (data[i + 3] > 128) {
                const p = pixels[pixelIndex++];
                posterizedData.data[i] = p[0]; posterizedData.data[i + 1] = p[1]; posterizedData.data[i + 2] = p[2]; posterizedData.data[i + 3] = 255;
            }
        }
        return { centroids: pixels, posterizedData };
    }
    const centroids = [];
    const centroidIndices = new Set();
    if (quantMethod === 'kmeans++' || quantMethod === 'deterministic') {
        const distances = new Array(pixels.length).fill(Infinity);
        let firstIndex = (quantMethod === 'deterministic') ? 0 : Math.floor(Math.random() * pixels.length);
        centroids.push(pixels[firstIndex]);
        centroidIndices.add(firstIndex);
        for (let i = 1; i < k; i++) {
            let sum = 0;
            const lastCentroid = useOklab ? ColorConverter.rgbToOklab(centroids[i - 1]) : centroids[i - 1];
            for (let j = 0; j < pixels.length; j++) {
                const p = useOklab ? oklabPixels[j] : pixels[j];
                const d = useOklab ? ColorConverter.deltaE2000(p, lastCentroid) : colorDistanceSq(p, lastCentroid);
                if (d < distances[j]) distances[j] = d;
                sum += distances[j];
            }
            const rand = Math.random() * sum;
            let partialSum = 0;
            for (let j = 0; j < pixels.length; j++) {
                partialSum += distances[j];
                if (partialSum >= rand) {
                    if (!centroidIndices.has(j)) { centroids.push(pixels[j]); centroidIndices.add(j); } else { i--; }
                    break;
                }
            }
        }
    } else {
        while (centroids.length < k) {
            const index = Math.floor(Math.random() * pixels.length);
            if (!centroidIndices.has(index)) { centroids.push(pixels[index]); centroidIndices.add(index); }
        }
    }
    const assignments = new Array(pixels.length);
    let iterations = 0;
    let moved = true;
    while (moved && iterations < 20) {
        moved = false;
        const centroidColors = useOklab ? centroids.map(c => ColorConverter.rgbToOklab(c)) : centroids;
        for (let i = 0; i < pixels.length; i++) {
            let minDistance = Infinity; let bestCentroid = 0;
            const p = useOklab ? oklabPixels[i] : pixels[i];
            for (let j = 0; j < centroids.length; j++) {
                const distance = useOklab ? ColorConverter.deltaE2000(p, centroidColors[j]) : colorDistanceSq(p, centroidColors[j]);
                if (distance < minDistance) { minDistance = distance; bestCentroid = j; }
            }
            if (assignments[i] !== bestCentroid) { assignments[i] = bestCentroid; moved = true; }
        }
        const newCentroids = new Array(k).fill(0).map(() => [0, 0, 0]);
        const counts = new Array(k).fill(0);
        for (let i = 0; i < pixels.length; i++) {
            const centroidIndex = assignments[i];
            newCentroids[centroidIndex][0] += pixels[i][0]; newCentroids[centroidIndex][1] += pixels[i][1]; newCentroids[centroidIndex][2] += pixels[i][2];
            counts[centroidIndex]++;
        }
        for (let i = 0; i < centroids.length; i++) {
            if (counts[i] > 0) {
                centroids[i] = [newCentroids[i][0] / counts[i], newCentroids[i][1] / counts[i], newCentroids[i][2] / counts[i]];
            }
        }
        iterations++;
    }
    const posterizedData = new ImageData(width, height);
    let pixelIndex = 0;
    for (let i = 0; i < posterizedData.data.length; i += 4) {
        if (data[i + 3] > 128) {
            const centroid = centroids[assignments[pixelIndex++]];
            posterizedData.data[i] = centroid[0]; posterizedData.data[i + 1] = centroid[1]; posterizedData.data[i + 2] = centroid[2]; posterizedData.data[i + 3] = 255;
        }
    }
    const finalCentroids = centroids.map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]);
    return { centroids: finalCentroids, posterizedData };
}