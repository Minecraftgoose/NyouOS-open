/**
 * 番茄钟应用
 * NyouOS On Web 内置应用
 * 闭源 © 2025-2026 KevinAnanda. All rights reserved.
 */
const PomodoroApp = {
    windowId: null,
    container: null,
    mode: 'work', // work | break
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
    timeLeft: 25 * 60,
    isRunning: false,
    timer: null,
    completedPomodoros: 0,
    STORAGE_KEY: 'NyouOS.pomodoro',

    init(windowId) {
        this.windowId = windowId;
        this.container = document.getElementById(`${windowId}-content`);
        if (!this.container) return;
        this.loadSettings();
        this.addStyles();
        this.render();
    },

    addStyles() {
        if (document.getElementById('pomodoro-styles')) return;
        const style = document.createElement('style');
        style.id = 'pomodoro-styles';
        style.textContent = `
            .pomo-app { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; font-family: inherit; box-sizing: border-box; }
            .pomo-mode-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
            .pomo-mode-tab { padding: 8px 20px; border: 1px solid rgba(0,0,0,0.1); border-radius: 20px; background: transparent; cursor: pointer; font-size: 14px; transition: all 0.2s; }
            .pomo-mode-tab.active { background: #e81123; color: #fff; border-color: #e81123; }
            .pomo-mode-tab.break.active { background: #107c10; border-color: #107c10; }
            .pomo-circle { position: relative; width: 240px; height: 240px; margin-bottom: 24px; }
            .pomo-circle svg { transform: rotate(-90deg); }
            .pomo-circle-bg { fill: none; stroke: rgba(0,0,0,0.08); stroke-width: 8; }
            .pomo-circle-progress { fill: none; stroke: #e81123; stroke-width: 8; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
            .pomo-circle-progress.break { stroke: #107c10; }
            .pomo-time { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 48px; font-weight: 300; font-variant-numeric: tabular-nums; }
            .pomo-controls { display: flex; gap: 12px; margin-bottom: 20px; }
            .pomo-btn { padding: 12px 32px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; transition: all 0.2s; }
            .pomo-btn-primary { background: #e81123; color: #fff; }
            .pomo-btn-primary:hover { background: #d00e1f; }
            .pomo-btn-primary.break { background: #107c10; }
            .pomo-btn-primary.break:hover { background: #0e6b0e; }
            .pomo-btn-secondary { background: rgba(0,0,0,0.05); color: #333; }
            .pomo-btn-secondary:hover { background: rgba(0,0,0,0.1); }
            .pomo-stats { font-size: 14px; color: #666; margin-bottom: 16px; }
            .pomo-stats span { font-weight: 600; color: #e81123; }
            .pomo-settings { display: flex; gap: 16px; align-items: center; font-size: 13px; color: #666; }
            .pomo-settings label { display: flex; align-items: center; gap: 6px; }
            .pomo-settings input { width: 50px; padding: 4px 8px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; font-size: 13px; text-align: center; }
        `;
        document.head.appendChild(style);
    },

    loadSettings() {
        try {
            const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
            if (data.workDuration) this.workDuration = data.workDuration;
            if (data.breakDuration) this.breakDuration = data.breakDuration;
            if (data.completedPomodoros) this.completedPomodoros = data.completedPomodoros;
        } catch (e) {}
        this.timeLeft = this.mode === 'work' ? this.workDuration : this.breakDuration;
    },

    saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                workDuration: this.workDuration,
                breakDuration: this.breakDuration,
                completedPomodoros: this.completedPomodoros
            }));
        } catch (e) {}
    },

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.timer = setInterval(() => this.tick(), 1000);
        this.render();
    },

    pause() {
        this.isRunning = false;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.render();
    },

    reset() {
        this.pause();
        this.timeLeft = this.mode === 'work' ? this.workDuration : this.breakDuration;
        this.render();
    },

    tick() {
        this.timeLeft--;
        if (this.timeLeft <= 0) {
            this.complete();
        } else {
            this.updateDisplay();
        }
    },

    complete() {
        this.pause();
        if (this.mode === 'work') {
            this.completedPomodoros++;
            this.saveSettings();
            this.notify('🍅 工作时间结束！', '休息一下吧，你已经完成了 ' + this.completedPomodoros + ' 个番茄钟。');
            this.mode = 'break';
        } else {
            this.notify('☕ 休息时间结束！', '继续工作吧，保持专注。');
            this.mode = 'work';
        }
        this.timeLeft = this.mode === 'work' ? this.workDuration : this.breakDuration;
        this.render();
    },

    switchMode(mode) {
        if (this.isRunning) {
            if (!confirm('计时器正在运行，确定切换模式吗？')) return;
            this.pause();
        }
        this.mode = mode;
        this.timeLeft = mode === 'work' ? this.workDuration : this.breakDuration;
        this.render();
    },

    setWorkDuration(minutes) {
        this.workDuration = Math.max(1, Math.min(120, parseInt(minutes) || 25)) * 60;
        if (this.mode === 'work' && !this.isRunning) this.timeLeft = this.workDuration;
        this.saveSettings();
        this.updateDisplay();
    },

    setBreakDuration(minutes) {
        this.breakDuration = Math.max(1, Math.min(60, parseInt(minutes) || 5)) * 60;
        if (this.mode === 'break' && !this.isRunning) this.timeLeft = this.breakDuration;
        this.saveSettings();
        this.updateDisplay();
    },

    notify(title, message) {
        if (typeof State !== 'undefined' && typeof State.addNotification === 'function') {
            State.addNotification({ title, message, type: 'info' });
        }
        // 播放提示音
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {}
    },

    updateDisplay() {
        const timeEl = this.container?.querySelector('.pomo-time');
        const progressEl = this.container?.querySelector('.pomo-circle-progress');
        if (timeEl) timeEl.textContent = this.formatTime(this.timeLeft);
        if (progressEl) {
            const total = this.mode === 'work' ? this.workDuration : this.breakDuration;
            const circumference = 2 * Math.PI * 110;
            const offset = circumference * (1 - this.timeLeft / total);
            progressEl.style.strokeDasharray = circumference;
            progressEl.style.strokeDashoffset = offset;
        }
    },

    render() {
        if (!this.container) return;
        const total = this.mode === 'work' ? this.workDuration : this.breakDuration;
        const circumference = 2 * Math.PI * 110;
        const offset = circumference * (1 - this.timeLeft / total);
        const isBreak = this.mode === 'break';

        let html = '<div class="pomo-app">';
        html += '<div class="pomo-mode-tabs">';
        html += '<button class="pomo-mode-tab' + (this.mode === 'work' ? ' active' : '') + '" onclick="PomodoroApp.switchMode(\'work\')">🍅 工作</button>';
        html += '<button class="pomo-mode-tab break' + (this.mode === 'break' ? ' active' : '') + '" onclick="PomodoroApp.switchMode(\'break\')">☕ 休息</button>';
        html += '</div>';

        html += '<div class="pomo-circle">';
        html += '<svg width="240" height="240" viewBox="0 0 240 240">';
        html += '<circle class="pomo-circle-bg" cx="120" cy="120" r="110"/>';
        html += '<circle class="pomo-circle-progress' + (isBreak ? ' break' : '') + '" cx="120" cy="120" r="110" style="stroke-dasharray:' + circumference + ';stroke-dashoffset:' + offset + ';"/>';
        html += '</svg>';
        html += '<div class="pomo-time">' + this.formatTime(this.timeLeft) + '</div>';
        html += '</div>';

        html += '<div class="pomo-controls">';
        if (this.isRunning) {
            html += '<button class="pomo-btn pomo-btn-primary' + (isBreak ? ' break' : '') + '" onclick="PomodoroApp.pause()">⏸ 暂停</button>';
        } else {
            html += '<button class="pomo-btn pomo-btn-primary' + (isBreak ? ' break' : '') + '" onclick="PomodoroApp.start()">▶ 开始</button>';
        }
        html += '<button class="pomo-btn pomo-btn-secondary" onclick="PomodoroApp.reset()">↻ 重置</button>';
        html += '</div>';

        html += '<div class="pomo-stats">今日已完成 <span>' + this.completedPomodoros + '</span> 个番茄钟</div>';

        html += '<div class="pomo-settings">';
        html += '<label>工作 <input type="number" min="1" max="120" value="' + (this.workDuration / 60) + '" onchange="PomodoroApp.setWorkDuration(this.value)"> 分钟</label>';
        html += '<label>休息 <input type="number" min="1" max="60" value="' + (this.breakDuration / 60) + '" onchange="PomodoroApp.setBreakDuration(this.value)"> 分钟</label>';
        html += '</div>';
        html += '</div>';

        this.container.innerHTML = html;
    },

    beforeClose() {
        this.pause();
        this.windowId = null;
        this.container = null;
        return true;
    }
};
