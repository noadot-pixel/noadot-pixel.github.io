// js/worker/upscale.js

// 1. EPX (Scale2x)
export function upscaleEPX2x(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const src = new Uint32Array(imageData.data.buffer);
    const newWidth = width * 2;
    const newHeight = height * 2;
    const newImageData = new ImageData(newWidth, newHeight);
    const dst = new Uint32Array(newImageData.data.buffer);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const p = src[y * width + x];
            const a = (y > 0) ? src[(y - 1) * width + x] : p;
            const b = (x < width - 1) ? src[y * width + (x + 1)] : p;
            const c = (x > 0) ? src[y * width + (x - 1)] : p;
            const d = (y < height - 1) ? src[(y + 1) * width + x] : p;

            let p1 = p, p2 = p, p3 = p, p4 = p;

            if (c == a && c != d && a != b) p1 = a;
            if (a == b && a != c && b != d) p2 = b;
            if (d == c && d != b && c != a) p3 = c;
            if (b == d && b != a && d != c) p4 = d;

            const destIndex = (y * 2) * newWidth + (x * 2);
            dst[destIndex] = p1; dst[destIndex + 1] = p2;
            dst[destIndex + newWidth] = p3; dst[destIndex + newWidth + 1] = p4;
        }
    }
    return newImageData;
}

// 2. EPX (Scale3x) - 3배 확대
export function upscaleEPX3x(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const src = new Uint32Array(imageData.data.buffer);
    const newWidth = width * 3;
    const newHeight = height * 3;
    const newImageData = new ImageData(newWidth, newHeight);
    const dst = new Uint32Array(newImageData.data.buffer);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const E = src[y * width + x]; // Center
            const A = (y > 0 && x > 0) ? src[(y-1)*width + (x-1)] : E;
            const B = (y > 0) ? src[(y-1)*width + x] : E;
            const C = (y > 0 && x < width-1) ? src[(y-1)*width + (x+1)] : E;
            const D = (x > 0) ? src[y*width + (x-1)] : E;
            const F = (x < width-1) ? src[y*width + (x+1)] : E;
            const G = (y < height-1 && x > 0) ? src[(y+1)*width + (x-1)] : E;
            const H = (y < height-1) ? src[(y+1)*width + x] : E;
            const I = (y < height-1 && x < width-1) ? src[(y+1)*width + (x+1)] : E;

            // 3x3 Grid mapping
            // 1 2 3
            // 4 5 6
            // 7 8 9
            let p1=E, p2=E, p3=E;
            let p4=E, p5=E, p6=E;
            let p7=E, p8=E, p9=E;

            if (D==B && D!=H && B!=F) p1=D;
            if ((D==B && D!=H && B!=F && E!=C) || (B==F && B!=D && F!=H && E!=A)) p2=B;
            if (B==F && B!=D && F!=H) p3=F;
            if ((H==D && H!=F && D!=B && E!=A) || (D==B && D!=H && B!=F && E!=G)) p4=D;
            
            if ((B==F && B!=D && F!=H && E!=I) || (F==H && F!=B && H!=D && E!=C)) p6=F;
            if (H==D && H!=F && D!=B) p7=D;
            if ((F==H && F!=B && H!=D && E!=G) || (H==D && H!=F && D!=B && E!=I)) p8=H;
            if (F==H && F!=B && H!=D) p9=F;

            const destBase = (y * 3) * newWidth + (x * 3);
            // Row 1
            dst[destBase] = p1; dst[destBase+1] = p2; dst[destBase+2] = p3;
            // Row 2
            dst[destBase+newWidth] = p4; dst[destBase+newWidth+1] = p5; dst[destBase+newWidth+2] = p6;
            // Row 3
            dst[destBase+newWidth*2] = p7; dst[destBase+newWidth*2+1] = p8; dst[destBase+newWidth*2+2] = p9;
        }
    }
    return newImageData;
}