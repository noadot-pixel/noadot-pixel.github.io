// js/comment.js
// [수정] import 문 삭제 (SyntaxError 해결)
// window.t 가 state.js에서 정의되므로 바로 사용 가능합니다.

// ====================================================================
// [1] 고유 식별자(UUID) 로직 및 검증 함수
// ====================================================================

function getOrCreateUUID() {
    let uuid = localStorage.getItem('user_uuid');
    if (!uuid) {
        uuid = '8e2e19a5-26f1-4cd3-88c4-375d13683c69'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('user_uuid', uuid);
    }
    return uuid;
}

function simpleHash(str) {
    // 👑 [관리자 예외 처리] 스크린샷의 UUID와 일치하면 무조건 관리자 뱃지를 출력합니다.
    if (str === '8e2e19a5-26f1-4cd3-88c4-375d13683c69') {
        return '👑 Noadot - Noa';
    }

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; 
    }
    return '#' + Math.abs(hash).toString(16).substring(0, 4).toUpperCase();
}

function validateInput(input, maxLength, type) {
    if (input.length > maxLength) {
        alert(`${type}은(는) 최대 ${maxLength}자까지 입력 가능합니다.`);
        return false;
    }
    return true;
}

// ====================================================================
// [2] HTML 요소 정의 및 이벤트 리스너 연결
// ====================================================================

const modal = document.getElementById('comment-modal');
const openBtn = document.getElementById('open-comment-modal');
const closeBtn = document.getElementById('close-comment-modal');
const submitBtn = document.getElementById('submit-comment');

if (openBtn) {
    openBtn.onclick = function() {
        modal.style.display = "block";
        loadComments();
    }
}

if (closeBtn) {
    closeBtn.onclick = function() {
        modal.style.display = "none";
    }
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

if (submitBtn) {
    submitBtn.onclick = function() {
        const nickname = document.getElementById('nickname-input').value;
        const content = document.getElementById('comment-input').value;
        addComment(nickname, content);
    }
}

// ====================================================================
// [3] 댓글 등록 및 대댓글 등록 기능
// ====================================================================

async function addComment(nickname, content) {
    const userUUID = getOrCreateUUID();
    const trimmedNickname = nickname.trim();
    const finalNickname = trimmedNickname === '' ? 'ㅇㅇ' : trimmedNickname;

    const trimmedContent = content.trim();
    if (trimmedContent === '') {
        alert("댓글 내용을 입력해주세요.");
        return;
    }
    
    if (!validateInput(finalNickname, 20, '닉네임')) return;
    if (!validateInput(trimmedContent, 400, '댓글 내용')) return;

    try {
        await db.collection(COMMENTS_COLLECTION).add({ 
            nickname: finalNickname,
            content: trimmedContent,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userUUID: userUUID
        });
        
        console.log("댓글 등록 성공!");
        document.getElementById('comment-input').value = '';
        loadComments();

    } catch (e) {
        console.error("댓글 등록 중 오류 발생: ", e);
        alert("댓글 등록에 실패했습니다. (콘솔 확인)");
    }
}

async function addReply(parentId, nickname, content) {
    const userUUID = getOrCreateUUID();
    const trimmedNickname = nickname.trim();
    const finalNickname = trimmedNickname === '' ? 'ㅇㅇ' : trimmedNickname;

    const trimmedContent = content.trim();
    if (trimmedContent === '') return alert("대댓글 내용을 입력해주세요.");

    if (!validateInput(finalNickname, 20, '닉네임')) return;
    if (!validateInput(trimmedContent, 400, '댓글 내용')) return;

    try {
        await db.collection(COMMENTS_COLLECTION).add({
            nickname: finalNickname,
            content: trimmedContent,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            parentId: parentId,
            userUUID: userUUID
        });
        
        console.log("대댓글 등록 성공!");
        loadComments();

    } catch (e) {
        console.error("대댓글 등록 중 오류 발생: ", e);
    }
}

// ====================================================================
// [4] 댓글 불러오기 및 렌더링 로직
// ====================================================================

async function loadComments() {
    const commentsContainer = document.getElementById('comments-list');
    if (!commentsContainer) return;
    
    commentsContainer.innerHTML = '<p style="text-align: center;">로딩 중...</p>';

    try {
        const snapshot = await db.collection(COMMENTS_COLLECTION)
                                 .orderBy('timestamp', 'asc')
                                 .get();

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
        
        commentsContainer.innerHTML = '';
        if (comments.length === 0) {
            commentsContainer.innerHTML = '<p style="text-align: center; color: #888;">No Comment</p>';
            return;
        }

        comments.reverse().forEach((comment) => {
            renderComment(comment, commentsContainer, replies, 0);
        });

    } catch (e) {
        console.error("댓글 로딩 중 오류 발생: ", e);
        commentsContainer.innerHTML = '<p style="color: red;">댓글을 불러오는 데 실패했습니다.</p>';
    }
}

function renderComment(comment, container, repliesMap, depth) {
    const time = comment.timestamp 
                     ? comment.timestamp.toDate().toLocaleString('ko-KR', { 
                           year: 'numeric', month: '2-digit', day: '2-digit', 
                           hour: '2-digit', minute: '2-digit',
                           hour12: false
                         }) 
                     : '처리 중'; 

    const margin = depth * 30; 
    const replyPlaceholderId = `reply-form-${comment.id}`;
    
    const userHash = comment.userUUID ? simpleHash(comment.userUUID) : '#0000'; 
    
    // [핵심 변경 사항] 관리자 뱃지 전용 CSS 스타일을 분기 처리합니다.
    let hashStyle = `color: #007bff; font-weight: normal; margin-left: 5px;`; 
    if (userHash === '👑 Noadot - Noa') {
        // 관리자 뱃지는 눈에 확 띄도록 핑크빛 강조 및 텍스트 굵기 처리
        hashStyle = `color: #ff4757; font-weight: bold; margin-left: 5px; text-shadow: 0px 0px 2px rgba(255,71,87,0.2);`;
    }

    const commentHtml = `
        <div data-comment-id="${comment.id}" style="
            border: 1px solid ${depth === 0 ? '#ccc' : '#eee'}; 
            padding: 10px; margin-bottom: 10px; border-radius: 4px; 
            margin-left: ${margin}px; 
            background-color: ${depth === 0 ? '#fff' : '#f9f9f9'};
        ">
            <p style="margin: 0; font-weight: bold; line-height: 1.5;">
                ${comment.nickname} 
                <span style="font-size: 0.8em; color: #666;">(${time})</span>
                <span style="${hashStyle}" title="작성자 고유 식별자">${userHash}</span>
                </p>
            <hr style="margin: 5px 0; border-color: #eee;">
            <p style="margin: 0 0 10px 0; white-space: pre-wrap;">${comment.content}</p>
            
            <button onclick="document.getElementById('${replyPlaceholderId}').style.display = 'block';" 
                    style="font-size: 0.9em; color: #007bff; background: none; border: none; cursor: pointer;">
                ${t('btn_reply_comment')} 
            </button>
            
            <div id="${replyPlaceholderId}" style="display: none; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; padding-left: 10px; border-left: 3px solid #ffc107;">
                <input type="text" id="reply-nickname-${comment.id}" placeholder="닉네임" style="width: calc(100% - 10px); padding: 5px; margin-bottom: 5px; border-radius: 3px;">
                <textarea id="reply-content-${comment.id}" placeholder="대댓글 내용" rows="2" style="width: calc(100% - 10px); padding: 5px; margin-bottom: 5px; border-radius: 3px; resize: vertical;"></textarea>
                <button onclick="
                    const replyNick = document.getElementById('reply-nickname-${comment.id}').value;
                    const replyContent = document.getElementById('reply-content-${comment.id}').value;
                    addReply('${comment.id}', replyNick, replyContent);
                " style="padding: 5px 10px; background-color: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;">
                    등록
                </button>
                <button onclick="document.getElementById('reply-nickname-${comment.id}').value = ''; document.getElementById('reply-content-${comment.id}').value = ''; document.getElementById('${replyPlaceholderId}').style.display = 'none';" 
                        style="padding: 5px 10px; background-color: #ccc; color: black; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
                    취소
                </button>
            </div>
            
        </div>
    `;
    container.insertAdjacentHTML('beforeend', commentHtml);

    if (repliesMap[comment.id]) {
        repliesMap[comment.id].forEach(reply => {
            renderComment(reply, container, repliesMap, depth + 1);
        });
    }
}