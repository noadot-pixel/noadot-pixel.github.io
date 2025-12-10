// js/comment.js 파일 전체 내용

// ====================================================================
// [1] 고유 식별자(UUID) 로직 및 검증 함수
// ====================================================================

/**
 * UUID를 생성하거나 로컬 저장소에서 가져옵니다.
 */
function getOrCreateUUID() {
    let uuid = localStorage.getItem('user_uuid');
    if (!uuid) {
        // UUID v4 형식 생성
        uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('user_uuid', uuid);
    }
    return uuid;
}

/**
 * 문자열 기반으로 짧은 해시 코드를 생성합니다. (작성자 구별용)
 */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // 32bit 정수로 변환
    }
    // 해시 값을 16진수 4자리로 만들고 앞에 #을 붙임
    return '#' + Math.abs(hash).toString(16).substring(0, 4).toUpperCase();
}


/**
 * 댓글 내용을 검증합니다.
 * - 최대 길이 검사: 20자를 초과할 수 없습니다. (수정됨)
 * - 특수문자 검사: 한글, 영어, 숫자, 기본 공백 외에는 금지합니다.
 */
function validateContent(content) {
    if (content.length > 20) { // ★ 20자로 수정
        alert("댓글 내용은 최대 20자까지 입력 가능합니다."); // ★ 메시지 수정
        return false;
    }

    // 한글, 영어 대소문자, 숫자, 공백(탭, 줄바꿈 포함)만 허용
    const specialCharRegex = /[^a-zA-Z0-9가-힣\s]/g;
    if (specialCharRegex.test(content)) {
        alert("댓글 내용에 특수문자(한글, 영어, 숫자, 공백 외)는 사용할 수 없습니다.");
        return false;
    }

    return true;
}


// ====================================================================
// [2] HTML 요소 정의 및 이벤트 리스너 연결 (팝업 제어)
// ====================================================================

// HTML 요소 정의 (ID가 index.html과 일치해야 합니다)
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
// [3] 댓글 등록 및 대댓글 등록 기능 (검증 로직 포함)
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
    
    // 내용 검증
    if (!validateContent(trimmedContent)) {
        return;
    }

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

    // 내용 검증
    if (!validateContent(trimmedContent)) {
        return;
    }

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
                if (!replies[data.parentId]) {
                    replies[data.parentId] = [];
                }
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


/**
 * 댓글 및 대댓글을 재귀적으로 렌더링합니다.
 */
function renderComment(comment, container, repliesMap, depth) {
    // 24시간제 시간 형식 적용
    const time = comment.timestamp 
                     ? comment.timestamp.toDate().toLocaleString('ko-KR', { 
                           year: 'numeric', month: '2-digit', day: '2-digit', 
                           hour: '2-digit', minute: '2-digit',
                           hour12: false
                         }) 
                     : '처리 중'; 

    const margin = depth * 30; 
    const replyPlaceholderId = `reply-form-${comment.id}`;
    
    // 해시 코드 생성 및 스타일
    const userHash = comment.userUUID ? simpleHash(comment.userUUID) : '#0000'; 
    const hashStyle = `color: #007bff; font-weight: normal; margin-left: 5px;`; 
    
    // 삭제 관련 로직 모두 제거됨

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
                [대댓글 달기]
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

    // 대댓글이 있다면 재귀적으로 렌더링
    if (repliesMap[comment.id]) {
        repliesMap[comment.id].forEach(reply => {
            renderComment(reply, container, repliesMap, depth + 1);
        });
    }
}