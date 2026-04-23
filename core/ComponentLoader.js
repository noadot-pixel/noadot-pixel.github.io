/**
 * 텅 빈 HTML 슬롯(div)에 조각(Feature)들을 긁어와 끼워 넣는 핵심 엔진입니다.
 */
export class ComponentLoader {
    static async load(slotId, filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTML 조각을 찾을 수 없습니다: ${filePath}`);
            
            const htmlString = await response.text();
            const slotElement = document.getElementById(slotId);
            
            if (slotElement) {
                slotElement.innerHTML = htmlString;
                console.log(`✅ [ComponentLoader] ${slotId} 영역에 ${filePath} 장착 완료!`);
            } else {
                console.error(`❌ [ComponentLoader] ${slotId} 슬롯이 메인 HTML에 존재하지 않습니다!`);
            }
        } catch (error) {
            console.error(error);
        }
    }
}