/**
 * 日历应用
 * NyouOS On Web 内置应用
 * 闭源 © 2025-2026 KevinAnanda. All rights reserved.
 */
const CalendarApp = {
    windowId: null,
    container: null,
    currentDate: null,
    selectedDate: null,
    events: [],
    STORAGE_KEY: 'NyouOS.calendar.events',

    init(windowId) {
        this.windowId = windowId;
        this.container = document.getElementById(`${windowId}-content`);
        if (!this.container) return;
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.events = this.loadEvents();
        this.addStyles();
        this.render();
    },

    addStyles() {
        if (document.getElementById('calendar-app-styles')) return;
        const style = document.createElement('style');
        style.id = 'calendar-app-styles';
        style.textContent = `
            .calendar-app { padding: 16px; font-family: inherit; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
            .cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
            .cal-title { font-size: 18px; font-weight: 600; }
            .cal-nav { display: flex; gap: 8px; }
            .cal-nav button { padding: 6px 12px; border: 1px solid var(--input-border, #ccc); border-radius: 4px; background: transparent; cursor: pointer; font-size: 13px; color: var(--text-primary, #000); }
            .cal-nav button:hover { background: rgba(0,0,0,0.05); }
            .cal-nav button.today { background: #0078d4; color: #fff; border-color: #0078d4; }
            .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; flex: 1; }
            .cal-day-name { text-align: center; font-size: 12px; font-weight: 600; padding: 8px 0; color: #666; }
            .cal-day { border: 1px solid rgba(0,0,0,0.08); border-radius: 4px; padding: 6px; min-height: 60px; cursor: pointer; position: relative; transition: background 0.15s; }
            .cal-day:hover { background: rgba(0,120,212,0.08); }
            .cal-day.other-month { opacity: 0.3; }
            .cal-day.today { border-color: #0078d4; border-width: 2px; }
            .cal-day.selected { background: rgba(0,120,212,0.15); }
            .cal-day-num { font-size: 13px; font-weight: 500; }
            .cal-day.today .cal-day-num { color: #0078d4; }
            .cal-event-dot { width: 5px; height: 5px; border-radius: 50%; background: #0078d4; position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); }
            .cal-events-panel { margin-top: 16px; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 12px; max-height: 180px; overflow-y: auto; }
            .cal-events-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
            .cal-event-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.04); }
            .cal-event-time { font-size: 12px; color: #0078d4; min-width: 50px; }
            .cal-event-text { flex: 1; font-size: 13px; }
            .cal-event-del { border: none; background: transparent; color: #999; cursor: pointer; font-size: 14px; }
            .cal-event-del:hover { color: #e81123; }
            .cal-add-event { display: flex; gap: 6px; margin-top: 8px; }
            .cal-add-event input { flex: 1; padding: 6px 10px; border: 1px solid var(--input-border, #ccc); border-radius: 4px; font-size: 12px; }
            .cal-add-event button { padding: 6px 12px; border: none; border-radius: 4px; background: #0078d4; color: #fff; font-size: 12px; cursor: pointer; }
            .cal-no-events { font-size: 13px; color: #999; text-align: center; padding: 12px 0; }
        `;
        document.head.appendChild(style);
    },

    loadEvents() {
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
        catch (e) { return []; }
    },

    saveEvents() {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events)); } catch (e) {}
    },

    prevMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    },

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    },

    goToday() {
        this.currentDate = new Date();
        this.selectedDate = new Date();
        this.render();
    },

    selectDate(year, month, day) {
        this.selectedDate = new Date(year, month, day);
        this.currentDate = new Date(year, month, day);
        this.render();
    },

    addEvent(text) {
        if (!text || !text.trim()) return;
        const dateStr = this.formatDate(this.selectedDate);
        this.events.push({ id: Date.now(), date: dateStr, text: text.trim(), time: new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}) });
        this.saveEvents();
        this.render();
    },

    deleteEvent(id) {
        this.events = this.events.filter(e => e.id !== id);
        this.saveEvents();
        this.render();
    },

    getEventsForDate(dateStr) {
        return this.events.filter(e => e.date === dateStr);
    },

    formatDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    render() {
        if (!this.container) return;
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const today = new Date();
        const todayStr = this.formatDate(today);
        const selectedStr = this.formatDate(this.selectedDate);

        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        let html = '<div class="calendar-app">';
        html += '<div class="cal-header">';
        html += '<div class="cal-title">' + year + '年 ' + monthNames[month] + '</div>';
        html += '<div class="cal-nav">';
        html += '<button onclick="CalendarApp.prevMonth()">◀</button>';
        html += '<button class="today" onclick="CalendarApp.goToday()">今天</button>';
        html += '<button onclick="CalendarApp.nextMonth()">▶</button>';
        html += '</div></div>';

        html += '<div class="cal-grid">';
        dayNames.forEach(d => { html += '<div class="cal-day-name">' + d + '</div>'; });

        // 上个月的日期
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEvent = this.getEventsForDate(dateStr).length > 0;
            html += '<div class="cal-day other-month" onclick="CalendarApp.selectDate(' + prevYear + ',' + prevMonth + ',' + day + ')">';
            html += '<div class="cal-day-num">' + day + '</div>';
            if (hasEvent) html += '<div class="cal-event-dot"></div>';
            html += '</div>';
        }

        // 当月日期
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedStr;
            const hasEvent = this.getEventsForDate(dateStr).length > 0;
            html += '<div class="cal-day' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '') + '" onclick="CalendarApp.selectDate(' + year + ',' + month + ',' + day + ')">';
            html += '<div class="cal-day-num">' + day + '</div>';
            if (hasEvent) html += '<div class="cal-event-dot"></div>';
            html += '</div>';
        }

        // 下个月的日期
        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - (totalCells % 7)) % 7;
        for (let day = 1; day <= remaining; day++) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEvent = this.getEventsForDate(dateStr).length > 0;
            html += '<div class="cal-day other-month" onclick="CalendarApp.selectDate(' + nextYear + ',' + nextMonth + ',' + day + ')">';
            html += '<div class="cal-day-num">' + day + '</div>';
            if (hasEvent) html += '<div class="cal-event-dot"></div>';
            html += '</div>';
        }
        html += '</div>';

        // 选中日期的事件
        const selectedEvents = this.getEventsForDate(selectedStr);
        html += '<div class="cal-events-panel">';
        html += '<div class="cal-events-title">📅 ' + selectedStr + ' 的日程</div>';
        if (selectedEvents.length === 0) {
            html += '<div class="cal-no-events">暂无日程</div>';
        } else {
            selectedEvents.forEach(e => {
                html += '<div class="cal-event-item">';
                html += '<span class="cal-event-time">' + this.escapeHtml(e.time || '') + '</span>';
                html += '<span class="cal-event-text">' + this.escapeHtml(e.text) + '</span>';
                html += '<button class="cal-event-del" onclick="CalendarApp.deleteEvent(' + e.id + ')" title="删除">×</button>';
                html += '</div>';
            });
        }
        html += '<div class="cal-add-event">';
        html += '<input type="text" id="cal-event-input" placeholder="添加日程..." onkeydown="if(event.key===\'Enter\'){CalendarApp.addEvent(this.value);this.value=\'\';}">';
        html += '<button onclick="const i=document.getElementById(\'cal-event-input\');CalendarApp.addEvent(i.value);i.value=\'\';">添加</button>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        this.container.innerHTML = html;
    },

    beforeClose() {
        this.windowId = null;
        this.container = null;
        return true;
    }
};
