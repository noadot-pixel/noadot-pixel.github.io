import { ComponentLoader } from './core/ComponentLoader.js';
import { WorkerBridge } from './core/WorkerBridge.js';

import { setLanguage, currentLang, updateDOMTranslations } from './core/state.js';

import { ImageViewerFeature } from './features/02-viewer/logic.js';
import { ImageUploaderFeature } from './features/03-uploader/logic.js';
import { ImageResizerFeature } from './features/04-resizer/logic.js';
// 🌟 1. K-Means 정찰대 두뇌 수입!
import { KMeansFeature } from './features/07-kmeans/logic.js'; 
import { ConversionOptionsFeature } from './features/05-color-engine/logic.js';
import { PaletteSelectorFeature } from './features/06-palettes/logic.js';
import { CommentFeature } from './features/09-comments/logic.js';

class NoaDotApp {
    constructor() {
        console.log("🚀 NoaDot v7 그랜드 리메이크 가동 준비 중...");
        this.initAppShell();
    }

    async initAppShell() {
        const root = document.getElementById('app-root');
        root.innerHTML = `
            <div id="slot-header"></div>
            <div id="slot-viewer"></div>
            <div id="slot-sidebar">
                <div id="sub-slot-uploader"></div>
                <div id="sub-slot-resizer"></div>
                
                <div id="sub-slot-engine"></div>
                
                <div id="sub-slot-kmeans"></div> 
                
                <div id="sub-slot-palettes"></div>
                <div id="sub-slot-comments"></div>
            </div>
        `;

        await ComponentLoader.load('slot-header', 'features/01-header/header.html');
        await ComponentLoader.load('slot-viewer', 'features/02-viewer/viewer.html');
        await ComponentLoader.load('sub-slot-uploader', 'features/03-uploader/uploader.html');
        await ComponentLoader.load('sub-slot-resizer', 'features/04-resizer/resizer.html');
        
        await ComponentLoader.load('sub-slot-kmeans', 'features/07-kmeans/kmeans.html'); 
        
        await ComponentLoader.load('sub-slot-engine', 'features/05-color-engine/engine.html');
        await ComponentLoader.load('sub-slot-palettes', 'features/06-palettes/palettes.html');
        await ComponentLoader.load('sub-slot-comments', 'features/09-comments/comments.html');


        console.log("🧩 HTML UI 조립 완벽 완료! 자바스크립트 뇌를 연결합니다...");
        this.initLogic();
    }

    initLogic() {
        try {
            this.workerBridge = new WorkerBridge();

            this.viewer = new ImageViewerFeature();
            this.uploader = new ImageUploaderFeature();
            this.resizer = new ImageResizerFeature();
            
            this.kmeans = new KMeansFeature(); 
            
            this.engineOptions = new ConversionOptionsFeature();
            this.palettes = new PaletteSelectorFeature();
            this.comments = new CommentFeature();

            setTimeout(() => { // 헤더 HTML이 완전히 로드된 직후에 버튼을 찾습니다
                const themeBtn = document.getElementById('themeToggleBtn');
                if (themeBtn) {
                    // 브라우저 저장소에서 이전 테마 불러오기 (기본값: dark)
                    const savedTheme = localStorage.getItem('noadot-theme') || 'dark';
                    document.documentElement.setAttribute('data-theme', savedTheme);
                    themeBtn.textContent = savedTheme === 'light' ? '🌙' : '☀️';

                    // 버튼 클릭 시 테마 전환
                    themeBtn.addEventListener('click', () => {
                        const currentTheme = document.documentElement.getAttribute('data-theme');
                        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                        
                        document.documentElement.setAttribute('data-theme', newTheme);
                        localStorage.setItem('noadot-theme', newTheme);
                        themeBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
                        
                        console.log(`🎨 테마가 [${newTheme.toUpperCase()}] 모드로 변경되었습니다!`);
                    });
                }
            }, 500);

            setTimeout(() => {
                // 1. 처음 화면 켜질 때 텍스트 싹 번역하기
                updateDOMTranslations();

                // 2. 라디오 버튼 초기값 맞추기
                const langRadio = document.querySelector(`input[name="language"][value="${currentLang}"]`);
                if (langRadio) langRadio.checked = true;

                // 3. 버튼 누르면 언어 변경!
                document.querySelectorAll('input[name="language"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        setLanguage(e.target.value);
                    });
                });
            }, 500);

            console.log("✅ 모든 로직 및 워커 기동 성공! NoaDot v7.0 정상 작동 중.");
        } catch (error) {
            console.error("🚨 로직 기동 중 에러 발생 (import 경로를 확인하세요!):", error);
        }
    }
}

window.onload = () => {
    new NoaDotApp();
};