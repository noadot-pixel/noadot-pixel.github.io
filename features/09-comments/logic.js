// js/features/08-comments/logic.js
import { eventBus } from '../../core/EventBus.js';
import { t, currentLang } from '../../core/state.js';

export class CommentFeature {
    constructor() {
        // 🌟 [수정] 구버전의 과거 댓글들을 다시 불러오기 위해 방 이름을 똑같이 맞춥니다!
        this.collectionName = 'noadot_comments'; 
        
        this.initEvents();
        this.updatePlaceholders();
        
        // Firebase가 연결될 시간을 1초 기다렸다가 댓글을 로드합니다.
        setTimeout(() => this.loadComments(), 1000);
    }

    updatePlaceholders() {
        const nick = document.getElementById('commentNickname');
        const content = document.getElementById('commentContent');
        if (nick) nick.placeholder = t('ph_nickname');
        if (content) content.placeholder = t('ph_comment');
    }

    // [1] UUID 및 Hash 로직 (구버전 완벽 이식)
    getOrCreateUUID() {
        let uuid = localStorage.getItem('user_uuid');
        if (!uuid) {
            uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem('user_uuid', uuid);
        }
        return uuid;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; 
        }
        return '#' + Math.abs(hash).toString(16).substring(0, 4).toUpperCase();
    }

    validateInput(input, maxLength, typeName) {
        if (input.length > maxLength) {
            alert(t('msg_input_too_long', { type: typeName, max: maxLength }));
            return false;
        }
        return true;
    }

    // [2] 이벤트 리스너 세팅
    initEvents() {
        const drawer = document.getElementById('commentsDrawer');
        const btnOpen = document.getElementById('btnOpenComments');
        const btnClose = document.getElementById('btnCloseComments');

        if (btnOpen && drawer) {
            btnOpen.addEventListener('click', () => drawer.classList.add('open'));
        }
        if (btnClose && drawer) {
            btnClose.addEventListener('click', () => drawer.classList.remove('open'));
        }

        // 기존 로직 유지...
        const submitBtn = document.getElementById('btnSubmitComment');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const nick = document.getElementById('commentNickname').value;
                const content = document.getElementById('commentContent').value;
                this.addComment(null, nick, content);
            });
        }

        // 🌟 이벤트 위임: 리스트 컨테이너 하나에서 클릭을 모두 감지! (메모리 절약)
        const container = document.getElementById('commentsContainer');
        if (container) {
            container.addEventListener('click', (e) => {
                const target = e.target;
                
                // 답글 달기 버튼 클릭
                if (target.classList.contains('btn-reply')) {
                    const id = target.dataset.id;
                    const form = document.getElementById(`reply-form-${id}`);
                    if (form) form.style.display = form.style.display === 'flex' ? 'none' : 'flex';
                }
                
                // 대댓글 취소 버튼
                if (target.classList.contains('btn-reply-cancel')) {
                    const id = target.dataset.id;
                    const form = document.getElementById(`reply-form-${id}`);
                    if (form) form.style.display = 'none';
                }

                // 대댓글 등록 버튼
                if (target.classList.contains('btn-reply-submit')) {
                    const id = target.dataset.id;
                    const nick = document.getElementById(`reply-nick-${id}`).value;
                    const content = document.getElementById(`reply-content-${id}`).value;
                    this.addComment(id, nick, content);
                }
            });
        }

        eventBus.on('LANGUAGE_CHANGED', () => {
            this.updatePlaceholders();
            this.loadComments(); // 언어가 바뀌면 버튼 이름 갱신을 위해 다시 렌더링
        });
    }

    // [3] DB 쓰기 로직 (원본/대댓글 통합)
    async addComment(parentId, nickname, content) {
        if (typeof db === 'undefined') return alert(t('msg_db_error'));

        const userUUID = this.getOrCreateUUID();
        const finalNickname = nickname.trim() === '' ? 'ㅇㅇ' : nickname.trim();
        const finalContent = content.trim();

        if (finalContent === '') return alert(t('msg_empty_comment'));
        if (!this.validateInput(finalNickname, 20, t('word_nickname'))) return;
        if (!this.validateInput(finalContent, 400, t('word_content'))) return;

        try {
            const payload = {
                nickname: finalNickname,
                content: finalContent,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userUUID: userUUID
            };
            if (parentId) payload.parentId = parentId;

            await db.collection(this.collectionName).add(payload);
            
            // 입력창 초기화
            if (!parentId) {
                document.getElementById('commentContent').value = '';
            }
            this.loadComments();

        } catch (e) {
            console.error("댓글 등록 중 오류: ", e);
            alert(t('msg_comment_fail'));
        }
    }

    // [4] DB 읽기 및 재귀 렌더링 로직
    async loadComments() {
        const container = document.getElementById('commentsContainer');
        if (!container) return;

        if (typeof db === 'undefined') {
            container.innerHTML = `<p class="comment-status-msg" style="color:red;">Firebase 연동 대기 중...</p>`;
            return;
        }

        try {
            const snapshot = await db.collection(this.collectionName).orderBy('timestamp', 'asc').get();
            const comments = [];
            const replies = {};

            snapshot.forEach((doc) => {
                const data = doc.data();
                data.id = doc.id;
                
                if (data.parentId) {
                    if (!replies[data.parentId]) replies[data.parentId] = [];
                    replies[data.parentId].push(data);
                } else {
                    comments.push(data);
                }
            });
            
            container.innerHTML = '';
            if (comments.length === 0) {
                container.innerHTML = `<p class="comment-status-msg">${t('msg_no_comments')}</p>`;
                return;
            }

            // 역순(최신순)으로 출력
            comments.reverse().forEach((comment) => {
                this.renderComment(comment, container, replies, 0);
            });

        } catch (e) {
            console.error("댓글 로딩 중 오류: ", e);
            container.innerHTML = `<p class="comment-status-msg" style="color:red;">${t('msg_comment_load_fail')}</p>`;
        }
    }

    renderComment(comment, container, repliesMap, depth) {
        const timeStr = comment.timestamp 
            ? comment.timestamp.toDate().toLocaleString(currentLang === 'en' ? 'en-US' : 'ko-KR', { 
                  year: 'numeric', month: '2-digit', day: '2-digit', 
                  hour: '2-digit', minute: '2-digit', hour12: false
              }) 
            : t('word_processing');

        // 🌟 들여쓰기(Depth) 계산 (최대 3번까지만 들여쓰기 되도록 방어)
        const marginStyle = depth > 0 ? `margin-left: ${Math.min(depth * 25, 75)}px;` : '';
        const isReplyClass = depth > 0 ? 'is-reply' : '';

        // 👑 관리자 이스터에그 효과
        let userHash = comment.userUUID ? this.simpleHash(comment.userUUID) : '#0000';
        let hashClass = '';
        if (comment.userUUID === 'noadot') {
            userHash = ' NoaDot';
            hashClass = 'admin-glow';
        }

        const html = `
            <div class="comment-item ${isReplyClass}" style="${marginStyle}">
                <div class="comment-header">
                    <span class="comment-author">${comment.nickname}</span>
                    <span class="comment-hash ${hashClass}" title="ID">${userHash}</span>
                    <span class="comment-time">(${timeStr})</span>
                </div>
                <div class="comment-body">${comment.content}</div>
                
                <div class="comment-actions">
                    <button class="btn-reply" data-id="${comment.id}">${t('btn_reply_comment')}</button>
                </div>
                
                <div id="reply-form-${comment.id}" class="reply-form">
                    <input type="text" id="reply-nick-${comment.id}" class="ui-input" placeholder="${t('ph_nickname')}">
                    <textarea id="reply-content-${comment.id}" class="ui-input" rows="2" placeholder="${t('ph_reply')}"></textarea>
                    <div class="reply-actions">
                        <button class="btn-reply-cancel" data-id="${comment.id}">${t('btn_cancel')}</button>
                        <button class="btn-reply-submit" data-id="${comment.id}">${t('btn_submit')}</button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);

        // 대댓글 재귀 호출
        if (repliesMap[comment.id]) {
            repliesMap[comment.id].forEach(reply => {
                this.renderComment(reply, container, repliesMap, depth + 1);
            });
        }
    }
}