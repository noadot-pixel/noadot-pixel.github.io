// palettes.js

export const wplaceFreeColors = [{rgb:[0,0,0],name:"black"},{rgb:[60,60,60],name:"dark gray"},{rgb:[120,120,120],name:"gray"},{rgb:[210,210,210],name:"light gray"},{rgb:[255,255,255],name:"white"},{rgb:[96,0,24],name:"deep red"},{rgb:[237,28,36],name:"red"},{rgb:[255,127,39],name:"orange"},{rgb:[246,170,9],name:"gold"},{rgb:[249,221,59],name:"yellow"},{rgb:[255,250,188],name:"light yellow"},{rgb:[14,185,104],name:"dark green"},{rgb:[19,230,123],name:"green"},{rgb:[135,255,94],name:"light green"},{rgb:[12,129,110],name:"dark teal"},{rgb:[16,174,166],name:"teal"},{rgb:[19,225,190],name:"light teal"},{rgb:[96,247,242],name:"cyan"},{rgb:[40,80,158],name:"dark blue"},{rgb:[64,147,228],name:"blue"},{rgb:[107,80,246],name:"indigo"},{rgb:[153,177,251],name:"light indigo"},{rgb:[120,12,153],name:"dark purple"},{rgb:[170,56,185],name:"purple"},{rgb:[224,159,249],name:"light purple"},{rgb:[203,0,122],name:"dark pink"},{rgb:[236,31,128],name:"pink"},{rgb:[243,141,169],name:"light pink"},{rgb:[104,70,52],name:"dark brown"},{rgb:[149,104,42],name:"brown"},{rgb:[248,178,119],name:"beige"}];

export const wplacePaidColors = [{rgb:[170,170,170],name:"medium gray"},{rgb:[165,14,30],name:"dark red"},{rgb:[250,128,114],name:"light red"},{rgb:[228,92,26],name:"dark orange"},{rgb:[156,132,49],name:"dark goldenrod"},{rgb:[197,173,49],name:"goldenrod"},{rgb:[232,212,95],name:"light goldenrod"},{rgb:[74,107,58],name:"dark olive"},{rgb:[90,148,74],name:"olive"},{rgb:[132,197,115],name:"light olive"},{rgb:[15,121,159],name:"dark cyan"},{rgb:[187,250,242],name:"light cyan"},{rgb:[125,199,255],name:"light blue"},{rgb:[77,49,184],name:"dark indigo"},{rgb:[74,66,132],name:"dark slate blue"},{rgb:[122,113,196],name:"slate blue"},{rgb:[181,174,241],name:"light slate blue"},{rgb:[155,82,73],name:"dark peach"},{rgb:[209,128,120],name:"peach"},{rgb:[250,182,164],name:"light peach"},{rgb:[219,164,99],name:"light brown"},{rgb:[123,99,82],name:"dark tan"},{rgb:[156,132,107],name:"tan"},{rgb:[214,181,148],name:"light tan"},{rgb:[209,128,81],name:"dark beige"},{rgb:[255,197,165],name:"light beige"},{rgb:[109,100,63],name:"dark stone"},{rgb:[148,140,107],name:"stone"},{rgb:[205,197,158],name:"light stone"},{rgb:[51,57,65],name:"dark slate"},{rgb:[109,117,141],name:"slate"},{rgb:[179,185,209],name:"light slate"}];

export const geopixelsColors = [{rgb:[255,255,255],name:null},{rgb:[244,245,159],name:null},{rgb:[255,202,58],name:null},{rgb:[255,159,28],name:null},{rgb:[255,89,94],name:null},{rgb:[231,29,54],name:null},{rgb:[243,187,194],name:null},{rgb:[255,133,161],name:null},{rgb:[189,99,125],name:null},{rgb:[205,180,219],name:null},{rgb:[106,76,147],name:null},{rgb:[77,25,77],name:null},{rgb:[168,208,220],name:null},{rgb:[46,196,182],name:null},{rgb:[26,83,92],name:null},{rgb:[109,157,205],name:null},{rgb:[25,130,196],name:null},{rgb:[161,193,129],name:null},{rgb:[138,201,38],name:null},{rgb:[160,160,160],name:null},{rgb:[107,66,38],name:null},{rgb:[80,80,80],name:null},{rgb:[207,208,120],name:null},{rgb:[20,90,122],name:null},{rgb:[139,29,36],name:null},{rgb:[192,127,122],name:null},{rgb:[196,154,108],name:null},{rgb:[91,123,28],name:null},{rgb:[0,0,0],name:null}];

// [기존 코드 유지: wplaceFreeColors, wplacePaidColors, geopixelsColors]

export const uplaceColors = [
    // ── Monochrome ──
    {rgb:[0,0,0], name:"black"}, {rgb:[36,36,36], name:"dark grey"}, {rgb:[73,73,73], name:"grey"},
    {rgb:[109,109,109], name:"medium grey"}, {rgb:[146,146,146], name:"light grey"}, {rgb:[182,182,182], name:"pale grey"},
    {rgb:[218,218,218], name:"off white"}, {rgb:[255,255,255], name:"white"}, {rgb:[26,28,44], name:"void"},
    {rgb:[255,232,231], name:"mist white"}, {rgb:[246,239,231], name:"seashell"}, {rgb:[10,17,40], name:"deep space"},
    {rgb:[21,27,30], name:"deep slate"}, {rgb:[224,247,250], name:"ice glint"}, {rgb:[92,107,115], name:"muted steel"},
    {rgb:[15,23,42], name:"slate 900"}, {rgb:[51,65,85], name:"slate 700"}, {rgb:[100,116,139], name:"slate 500"},
    {rgb:[203,213,225], name:"slate 300"}, {rgb:[241,245,249], name:"slate 100"},
    // ── Reds & Pinks ──
    {rgb:[71,0,0], name:"black cherry"}, {rgb:[105,0,0], name:"burgundy"}, {rgb:[139,0,0], name:"dark red"},
    {rgb:[172,0,0], name:"crimson"}, {rgb:[190,0,57], name:"cardinal"}, {rgb:[255,0,0], name:"red"},
    {rgb:[222,16,127], name:"magenta"}, {rgb:[255,56,129], name:"hot pink"}, {rgb:[255,153,170], name:"pastel pink"},
    {rgb:[177,62,83], name:"rose"}, {rgb:[239,125,87], name:"coral"}, {rgb:[207,46,46], name:"brick red"},
    {rgb:[255,102,107], name:"salmon"}, {rgb:[200,151,139], name:"dusty rose"}, {rgb:[252,151,131], name:"light coral"},
    {rgb:[255,189,182], name:"pale salmon"}, {rgb:[252,204,218], name:"cotton candy"}, {rgb:[210,148,170], name:"dusty pink"},
    {rgb:[255,128,174], name:"flamingo pink"}, {rgb:[251,189,207], name:"cherry blossom"}, {rgb:[43,4,4], name:"deep blood"},
    {rgb:[255,224,229], name:"rose glint"}, {rgb:[122,92,88], name:"muted clay"}, {rgb:[255,0,127], name:"cyber pink"},
    {rgb:[255,64,96], name:"coral bridge"}, {rgb:[192,32,96], name:"berry bridge"}, {rgb:[241,90,36], name:"contrast magma"},
    {rgb:[212,20,90], name:"contrast fuchsia"}, {rgb:[74,4,4], name:"crimson 900"}, {rgb:[153,27,27], name:"crimson 700"},
    {rgb:[239,68,68], name:"crimson 500"}, {rgb:[252,165,165], name:"crimson 300"}, {rgb:[254,226,226], name:"crimson 100"},
    // ── Oranges & Yellows ──
    {rgb:[255,69,0], name:"orange red"}, {rgb:[255,168,0], name:"orange"}, {rgb:[255,214,53], name:"yellow"},
    {rgb:[255,248,184], name:"pale yellow"}, {rgb:[220,141,95], name:"peach"}, {rgb:[255,205,117], name:"mustard"},
    {rgb:[163,70,3], name:"burnt orange"}, {rgb:[249,128,6], name:"vivid orange"}, {rgb:[216,157,69], name:"goldenrod"},
    {rgb:[255,227,85], name:"bright yellow"}, {rgb:[255,224,218], name:"pale peach"}, {rgb:[238,246,116], name:"pale canary"},
    {rgb:[255,206,199], name:"melon"}, {rgb:[255,239,224], name:"peach glint"}, {rgb:[255,250,224], name:"lemon glint"},
    {rgb:[163,145,113], name:"muted sand"}, {rgb:[255,85,0], name:"cyber orange"}, {rgb:[255,255,0], name:"cyber yellow"},
    {rgb:[255,123,0], name:"sunset bridge"}, {rgb:[223,64,0], name:"ember bridge"}, {rgb:[251,176,59], name:"contrast gold"},
    {rgb:[234,179,8], name:"gold 500"},
    // ── Greens ──
    {rgb:[0,41,0], name:"dark forest"}, {rgb:[0,69,0], name:"forest green"}, {rgb:[0,102,0], name:"green"},
    {rgb:[0,143,0], name:"kelly green"}, {rgb:[0,163,104], name:"shamrock"}, {rgb:[0,204,120], name:"bright green"},
    {rgb:[126,237,86], name:"lime"}, {rgb:[167,240,112], name:"chartreuse"}, {rgb:[56,183,100], name:"slime green"},
    {rgb:[55,84,24], name:"pine"}, {rgb:[129,156,45], name:"moss"}, {rgb:[170,216,31], name:"acid green"},
    {rgb:[133,132,88], name:"sage"}, {rgb:[16,55,42], name:"deep jungle green"}, {rgb:[72,107,58], name:"fern green"},
    {rgb:[82,202,53], name:"mantis green"}, {rgb:[96,151,74], name:"asparagus"}, {rgb:[144,197,115], name:"pistachio"},
    {rgb:[194,195,88], name:"lemongrass"}, {rgb:[167,244,180], name:"mint"}, {rgb:[219,251,181], name:"tea green"},
    {rgb:[11,31,19], name:"deep swamp"}, {rgb:[224,255,229], name:"mint glint"}, {rgb:[107,112,92], name:"muted olive"},
    {rgb:[204,255,0], name:"cyber lime"}, {rgb:[128,160,32], name:"moss bridge"}, {rgb:[140,198,63], name:"contrast lime"},
    {rgb:[6,78,59], name:"forest 900"}, {rgb:[4,120,87], name:"forest 700"}, {rgb:[16,185,129], name:"forest 500"},
    {rgb:[110,231,183], name:"forest 300"}, {rgb:[209,250,229], name:"forest 100"},
    // ── Teals & Cyans ──
    {rgb:[0,117,111], name:"dark teal"}, {rgb:[0,158,170], name:"teal"}, {rgb:[0,204,192], name:"aqua"},
    {rgb:[81,233,244], name:"cyan"}, {rgb:[0,72,68], name:"dark slate"}, {rgb:[66,240,191], name:"bright turquoise"},
    {rgb:[193,246,242], name:"ice blue"}, {rgb:[156,210,188], name:"seafoam"}, {rgb:[205,243,255], name:"light cyan"},
    {rgb:[91,117,112], name:"muted teal"}, {rgb:[0,255,204], name:"cyber teal"}, {rgb:[0,223,128], name:"tropic bridge"},
    {rgb:[12,74,110], name:"ocean 900"}, {rgb:[3,105,161], name:"ocean 700"}, {rgb:[14,165,233], name:"ocean 500"},
    {rgb:[125,211,252], name:"ocean 300"}, {rgb:[224,242,254], name:"ocean 100"},
    // ── Blues ──
    {rgb:[36,80,164], name:"dark blue"}, {rgb:[54,144,234], name:"blue"}, {rgb:[73,58,193], name:"indigo"},
    {rgb:[106,92,255], name:"periwinkle"}, {rgb:[148,179,255], name:"sky blue"}, {rgb:[36,20,98], name:"deep indigo"},
    {rgb:[82,77,120], name:"faded denim"}, {rgb:[216,218,234], name:"periwinkle mist"}, {rgb:[36,36,64], name:"dark navy"},
    {rgb:[60,58,75], name:"slate blue"}, {rgb:[53,37,132], name:"deep royal blue"}, {rgb:[37,22,175], name:"ultramarine"},
    {rgb:[114,149,248], name:"cornflower"}, {rgb:[102,203,245], name:"sky cyan"}, {rgb:[180,210,239], name:"baby blue"},
    {rgb:[0,96,223], name:"azure bridge"}, {rgb:[41,171,226], name:"contrast azure"}, {rgb:[27,20,100], name:"contrast indigo"},
    // ── Purples ──
    {rgb:[180,74,192], name:"deep purple"}, {rgb:[228,171,255], name:"lavender"}, {rgb:[51,0,51], name:"deep violet"},
    {rgb:[75,0,75], name:"plum"}, {rgb:[102,0,102], name:"grape"}, {rgb:[128,0,128], name:"purple"},
    {rgb:[160,0,160], name:"amethyst"}, {rgb:[192,0,192], name:"violet"}, {rgb:[224,0,224], name:"orchid"},
    {rgb:[255,0,255], name:"electric magenta"}, {rgb:[93,39,93], name:"tyrian"}, {rgb:[44,12,14], name:"black currant"},
    {rgb:[29,20,39], name:"midnight violet"}, {rgb:[91,39,49], name:"dark mauve"}, {rgb:[137,131,174], name:"heather"},
    {rgb:[191,190,225], name:"lavender mist"}, {rgb:[31,16,69], name:"midnight purple"}, {rgb:[111,75,204], name:"majestic purple"},
    {rgb:[208,125,228], name:"light orchid"}, {rgb:[31,5,41], name:"deep bruise"}, {rgb:[240,224,255], name:"lavender glint"},
    {rgb:[106,91,110], name:"muted plum"}, {rgb:[170,0,255], name:"cyber violet"}, {rgb:[64,32,160], name:"twilight bridge"},
    {rgb:[76,29,149], name:"grape 900"}, {rgb:[124,58,237], name:"grape 700"}, {rgb:[139,92,246], name:"grape 500"},
    {rgb:[196,181,253], name:"grape 300"}, {rgb:[237,233,254], name:"grape 100"},
    // ── Earth Tones ──
    {rgb:[129,30,9], name:"rust"}, {rgb:[61,30,12], name:"dark coffee"}, {rgb:[92,46,26], name:"cocoa"},
    {rgb:[124,63,32], name:"brown"}, {rgb:[156,84,50], name:"copper"}, {rgb:[188,111,71], name:"tan"},
    {rgb:[255,173,125], name:"light skin"}, {rgb:[255,209,179], name:"pale skin"}, {rgb:[39,32,19], name:"deep bronze"},
    {rgb:[77,43,37], name:"dark leather"}, {rgb:[119,94,40], name:"olive drab"}, {rgb:[159,91,80], name:"terracotta"},
    {rgb:[168,130,54], name:"ochre"}, {rgb:[45,34,28], name:"dark espresso"}, {rgb:[156,132,107], name:"taupe"},
    {rgb:[204,178,152], name:"sand"}, {rgb:[220,190,183], name:"pale taupe"}, {rgb:[237,218,199], name:"almond"},
    {rgb:[255,227,192], name:"navajo white"}, {rgb:[46,17,4], name:"deep rust"}
];

const bplaceHexList = [
    "#FFD1D1", "#FFA2A2", "#FB2C2C", "#C10000", "#631212",
    "#FFE2C2", "#FFB675", "#FF7300", "#C24100", "#662200",
    "#FFF4A3", "#FFE566", "#FFCC00", "#BD7E00", "#5C3D00",
    "#E5FBBC", "#C2F368", "#7CCF00", "#537D00", "#293D00",
    "#C7F9D9", "#7BF1A8", "#00C950", "#007531", "#08351B",
    "#C6FBF0", "#74F1DF", "#00C7AC", "#007864", "#00382F",
    "#CDFBFF", "#85F1FF", "#04D0E2", "#087B85", "#0C3F45",
    "#CCE3FF", "#8EC5FF", "#2B7FFF", "#1344DD", "#132762",
    "#D6DFFF", "#A3B3FF", "#615FFF", "#2E39B8", "#202A60",
    "#E7DBFF", "#CDB4FF", "#8B51FF", "#6B07CF", "#3B0F66",
    "#F8DBFF", "#F4A8FF", "#DC31F4", "#9F00AD", "#540E58",
    "#FDD9ED", "#FDA5D5", "#FA2F9A", "#C6005C", "#640C32",
    "#FFD6E4", "#FFA1C0", "#FF206A", "#BD003F", "#700027",
    "#F4E1D7", "#E7C0AC", "#BA7D5E", "#88543A", "#4A2D1F",
    "#FAEDDB", "#E0BA94", "#BF7C40", "#874F22", "#4E2809",
    "#ECE5D7", "#CCC3AD", "#968661", "#6F6041", "#433C23",
    "#E4E4E6", "#C4C4CA", "#82818D", "#4E4D5B", "#23222A",
    "#FFFFFF", "#000000"
];

export const bplaceColors = bplaceHexList.map(hex => ({
    rgb: [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
    ]
}));

// 🌟 [신규] 3Place 블루프린트(.3place-blueprint) 파일 내부에서 색상을 가리키는 고정 순서의 전체 64색 팔레트.
// 실제로 사이트에서 뽑은 blueprint 파일 두 개(용도가 다른 모델)를 비교해서 확인한 사실:
//   - palette 배열은 항상 이 64색 전체를 "이 순서 그대로" 담고 있고, 실제로 몇 색만 쓰였는지는 상관없음
//     (한 모델은 64색 중 12색만, 다른 모델은 23색만 실제로 썼는데도 둘 다 palette는 64개 전체였음)
//   - 이 순서를 어기거나 일부 색만 넣으면 사이트가 "palette does not match the current world palette" 에러를 냄
// 즉 voxel의 colorIndex는 항상 이 고정 배열을 기준으로 계산해야 하며, 절대 "실제로 쓰인 색만 골라 압축"하면 안 된다.
export const threeplaceBlueprintPalette = [
    "#000000","#2b2b31","#4a4a52","#6b6b73","#8f8f96","#b5b5ba","#dadade","#ffffff",
    "#451317","#7c1a21","#b2242a","#e33d38","#f4735f","#ffab9a",
    "#4a230d","#7d3c12","#b25b16","#e5821d","#f9a94b","#ffd0a0",
    "#4d3b10","#806316","#b58f1c","#e2b829","#f6d94f","#fdf0a6",
    "#14351b","#1f5a28","#2f8236","#4aab48","#7ccf67","#bceaa2",
    "#0f3336","#16575c","#1f8288","#2fadb2","#5cd5d8","#abefed",
    "#16204a","#21387d","#2f57b2","#4479de","#74a7f2","#b1d3fb",
    "#2d1646","#4c2478","#7036ad","#9455d8","#b783f1","#dcbafb",
    "#481230","#7c1c50","#b32b76","#e2489c","#f680bb","#ffb8d9",
    "#342114","#5b3a22","#845731","#ab7a4b","#cfa478","#edcda6",
    "#4f4d23","#8a8449"
];

// 🌟 [신규] 3Place 팔레트 (사이트 팔레트 패널 HTML에서 그대로 추출, 8색 램프 8묶음 순서 유지 - 팔레트 선택 UI 전용)
export const threeplaceColors = [{rgb:[69,19,23],name:"Deep Red"},{rgb:[124,26,33],name:"Dark Red"},{rgb:[178,36,42],name:"Red"},{rgb:[227,61,56],name:"Bright Red"},{rgb:[244,115,95],name:"Light Red"},{rgb:[255,171,154],name:"Pale Red"},{rgb:[74,35,13],name:"Deep Orange"},{rgb:[125,60,18],name:"Dark Orange"},{rgb:[178,91,22],name:"Orange"},{rgb:[229,130,29],name:"Bright Orange"},{rgb:[249,169,75],name:"Light Orange"},{rgb:[255,208,160],name:"Pale Orange"},{rgb:[77,59,16],name:"Deep Yellow"},{rgb:[128,99,22],name:"Dark Yellow"},{rgb:[181,143,28],name:"Yellow"},{rgb:[226,184,41],name:"Bright Yellow"},{rgb:[246,217,79],name:"Light Yellow"},{rgb:[253,240,166],name:"Pale Yellow"},{rgb:[20,53,27],name:"Deep Green"},{rgb:[31,90,40],name:"Dark Green"},{rgb:[47,130,54],name:"Green"},{rgb:[74,171,72],name:"Bright Green"},{rgb:[124,207,103],name:"Light Green"},{rgb:[188,234,162],name:"Pale Green"},{rgb:[15,51,54],name:"Deep Teal"},{rgb:[22,87,92],name:"Dark Teal"},{rgb:[31,130,136],name:"Teal"},{rgb:[47,173,178],name:"Bright Teal"},{rgb:[92,213,216],name:"Light Teal"},{rgb:[171,239,237],name:"Pale Teal"},{rgb:[22,32,74],name:"Deep Blue"},{rgb:[33,56,125],name:"Dark Blue"},{rgb:[47,87,178],name:"Blue"},{rgb:[68,121,222],name:"Bright Blue"},{rgb:[116,167,242],name:"Light Blue"},{rgb:[177,211,251],name:"Pale Blue"},{rgb:[45,22,70],name:"Deep Purple"},{rgb:[76,36,120],name:"Dark Purple"},{rgb:[112,54,173],name:"Purple"},{rgb:[148,85,216],name:"Bright Purple"},{rgb:[183,131,241],name:"Light Purple"},{rgb:[220,186,251],name:"Pale Purple"},{rgb:[72,18,48],name:"Deep Pink"},{rgb:[124,28,80],name:"Dark Pink"},{rgb:[179,43,118],name:"Pink"},{rgb:[226,72,156],name:"Bright Pink"},{rgb:[246,128,187],name:"Light Pink"},{rgb:[255,184,217],name:"Pale Pink"},{rgb:[0,0,0],name:"Black"},{rgb:[43,43,49],name:"Charcoal"},{rgb:[74,74,82],name:"Dark Gray"},{rgb:[107,107,115],name:"Gray"},{rgb:[143,143,150],name:"Ash"},{rgb:[181,181,186],name:"Light Gray"},{rgb:[218,218,222],name:"Mist"},{rgb:[255,255,255],name:"White"},{rgb:[52,33,20],name:"Espresso"},{rgb:[91,58,34],name:"Chestnut"},{rgb:[132,87,49],name:"Umber"},{rgb:[171,122,75],name:"Caramel"},{rgb:[207,164,120],name:"Tan"},{rgb:[237,205,166],name:"Sand"},{rgb:[79,77,35],name:"Dark Olive"},{rgb:[138,132,73],name:"Olive"}];