// 🌟 [보안] CSP에서 script-src 'unsafe-inline'을 제거하기 위해
// index.html의 인라인 <script> 블록을 외부 파일로 분리한 것입니다.
const firebaseConfig = {
    apiKey: "AIzaSyC8o-GgPjhBepBUs3HF3cD7XMXP9-haUgI",
    authDomain: "noadot-commet-system.firebaseapp.com",
    projectId: "noadot-commet-system",
    storageBucket: "noadot-commet-system.firebasestorage.app",
    messagingSenderId: "335432879892",
    appId: "1:335432879892:web:62197c9dfef7a4bfd17c01"
};

// Firebase 초기화
const app = firebase.initializeApp(firebaseConfig);

// V7의 모듈(logic.js 등)에서 db를 읽을 수 있도록 window 객체에 쾅! 박아줍니다.
window.db = app.firestore();
