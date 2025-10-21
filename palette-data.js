/**
 * Hex 코드를 RGB 배열로 변환하는 헬퍼 함수
 * @param {string} hex - #RRGGBB 형식의 Hex 코드
 * @returns {number[]|null} - [r, g, b] 배열 또는 변환 실패 시 null
 */
function hexToRgb(hex) {
  if (!hex || hex.length !== 7) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ==================================================================
// 1. wplace 무료 색상 (wplace 기본 색상 목록)
// ==================================================================
const wplaceFreeColors = [
  { rgb: [0, 0, 0], name: "black" },
  { rgb: [60, 60, 60], name: "dark gray" },
  { rgb: [120, 120, 120], name: "gray" },
  { rgb: [210, 210, 210], name: "light gray" },
  { rgb: [255, 255, 255], name: "white" },
  { rgb: [96, 0, 24], name: "deep red" },
  { rgb: [237, 28, 36], name: "red" },
  { rgb: [255, 127, 39], name: "orange" }, // 이미지의 #ff7f27
  { rgb: [246, 171, 9], name: "gold" },
  { rgb: [249, 221, 59], name: "yellow" },
  { rgb: [255, 250, 188], name: "light yellow" },
  { rgb: [14, 185, 104], name: "dark green" },
  { rgb: [19, 230, 123], name: "green" },
  { rgb: [135, 255, 94], name: "light green" },
  { rgb: [12, 129, 110], name: "dark teal" },
  { rgb: [16, 174, 166], name: "teal" },
  { rgb: [19, 225, 190], name: "light teal" },
  { rgb: [96, 247, 242], name: "cyan" },
  { rgb: [40, 80, 158], name: "dark blue" },
  { rgb: [64, 147, 228], name: "blue" },
  { rgb: [107, 80, 246], name: "indigo" },
  { rgb: [153, 177, 251], name: "light indigo" }, // 이미지의 #99b1fb
  { rgb: [120, 12, 153], name: "dark purple" },
  { rgb: [170, 56, 185], name: "purple" },
  { rgb: [224, 159, 249], name: "light purple" },
  { rgb: [203, 0, 122], name: "dark pink" },
  { rgb: [236, 31, 128], name: "pink" },
  { rgb: [243, 141, 169], name: "light pink" },
  { rgb: [104, 70, 52], name: "dark brown" },
  { rgb: [149, 104, 42], name: "brown" },
  { rgb: [248, 178, 119], name: "beige" },
  { rgb: null, name: "transparent" }
];

// ==================================================================
// 2. wplace 유료 색상 (구매 색상 목록)
// ==================================================================
const wplacePaidColors = [
  { rgb: [170, 170, 170], name: "medium gray" },
  { rgb: [165, 14, 30], name: "dark red" },
  { rgb: [250, 128, 114], name: "light red" },
  { rgb: [228, 92, 26], name: "dark orange" },
  { rgb: [156, 132, 49], name: "dark goldenrod" },
  { rgb: [197, 173, 49], name: "goldenrod" },
  { rgb: [232, 212, 95], name: "light goldenrod" },
  { rgb: [74, 107, 58], name: "dark olive" },
  { rgb: [90, 148, 74], name: "olive" },
  { rgb: [132, 197, 115], name: "light olive" },
  { rgb: [15, 121, 159], name: "dark cyan" },
  { rgb: [187, 250, 242], name: "light cyan" },
  { rgb: [125, 199, 255], name: "light blue" },
  { rgb: [77, 49, 184], name: "dark indigo" },
  { rgb: [74, 66, 132], name: "dark slate blue" },
  { rgb: [122, 113, 196], name: "slate blue" },
  { rgb: [181, 174, 241], name: "light slate blue" },
  { rgb: [155, 82, 73], name: "dark peach" },
  { rgb: [209, 128, 120], name: "peach" },
  { rgb: [250, 182, 164], name: "light peach" },
  { rgb: [219, 164, 99], name: "light brown" },
  { rgb: [123, 99, 82], name: "dark tan" },
  { rgb: [156, 132, 107], name: "tan" },
  { rgb: [214, 181, 148], name: "light tan" },
  { rgb: [209, 128, 81], name: "dark beige" },
  { rgb: [255, 197, 165], name: "light beige" },
  { rgb: [109, 100, 63], name: "dark stone" },
  { rgb: [148, 140, 107], name: "stone" },
  { rgb: [205, 197, 158], name: "light stone" },
  { rgb: [51, 57, 65], name: "dark slate" },
  { rgb: [109, 117, 141], name: "slate" },
  { rgb: [179, 185, 209], name: "light slate" }
];

// ==================================================================
// 3. geopixels 색상 (geopixels 기본 색상 목록)
// ==================================================================
const geopixelsColors = [
  { rgb: [255, 255, 255], name: "white" },
  { rgb: [244, 245, 159], name: null },
  { rgb: [255, 202, 58], name: null },
  { rgb: [255, 159, 28], name: null },
  { rgb: [255, 89, 94], name: null },
  { rgb: [231, 29, 54], name: null },
  { rgb: [243, 187, 194], name: null },
  { rgb: [255, 133, 161], name: null },
  { rgb: [189, 99, 125], name: null },
  { rgb: [205, 180, 219], name: null },
  { rgb: [106, 76, 147], name: null },
  { rgb: [77, 25, 77], name: null },
  { rgb: [168, 208, 220], name: null },
  { rgb: [46, 196, 182], name: null },
  { rgb: [26, 83, 92], name: null },
  { rgb: [109, 157, 205], name: null },
  { rgb: [25, 130, 196], name: null },
  { rgb: [161, 193, 129], name: null },
  { rgb: [138, 201, 38], name: null },
  { rgb: [160, 160, 160], name: null },
  { rgb: [107, 66, 38], name: null },
  { rgb: [80, 80, 80], name: null },
  { rgb: [207, 208, 120], name: null },
  { rgb: [20, 90, 122], name: null },
  { rgb: [139, 29, 36], name: null },
  { rgb: [192, 127, 122], name: null },
  { rgb: [196, 154, 108], name: null },
  { rgb: [91, 123, 28], name: null },
  { rgb: [0, 0, 0], name: "black" },
  { rgb: null, name: "transparent" }
];