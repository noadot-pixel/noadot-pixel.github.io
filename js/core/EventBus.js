// js/core/EventBus.js
class EventBus {
    constructor() {
        this.listeners = {};
    }

    // 신호 받기 (Subscribe)
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    // 신호 보내기 (Publish)
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// 앱 전체에서 하나만 쓰는 '공용 무전기'입니다.
export const eventBus = new EventBus();