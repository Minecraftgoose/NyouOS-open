/**
 * Terminal application for NyouOS
 */
const TerminalApp = {
    windowId: null,
    container: null,
    terminalEl: null,
    outputEl: null,
    inputEl: null,
    history: [],
    historyIndex: -1,
    currentPath: '此电脑',

    init(windowId) {
        this.windowId = windowId || `terminal-${Date.now()}`;
        this.container = document.getElementById(`${this.windowId}-content`) || document.getElementById(`window-${this.windowId}-content`);
        if (!this.container) return;

        this.addStyles();
        this.render();
        this.bindEvents();
        this.printWelcome();
    },

    addStyles() {
        if (document.getElementById('nyou-terminal-styles')) return;
        const style = document.createElement('style');
        style.id = 'nyou-terminal-styles';
        style.textContent = `
            .nyou-terminal {
                width: 100%;
                height: 100%;
                background: #0c0c0c;
                color: #cccccc;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 14px;
                padding: 12px;
                box-sizing: border-box;
                overflow-y: auto;
                overflow-x: hidden;
            }
            .nyou-terminal-output {
                white-space: pre-wrap;
                word-break: break-all;
                line-height: 1.5;
            }
            .nyou-terminal-line {
                margin: 0;
                padding: 0;
            }
            .nyou-terminal-prompt {
                color: #4ec9b0;
                font-weight: bold;
            }
            .nyou-terminal-input-line {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .nyou-terminal-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: #ffffff;
                font-family: inherit;
                font-size: inherit;
                padding: 0;
                caret-color: #ffffff;
            }
            .nyou-terminal-error {
                color: #f44747;
            }
            .nyou-terminal-success {
                color: #6a9955;
            }
            .nyou-terminal-info {
                color: #569cd6;
            }
            .nyou-terminal-file {
                color: #dcdcaa;
            }
            .nyou-terminal-folder {
                color: #4ec9b0;
            }
        `;
        document.head.appendChild(style);
    },

    render() {
        this.container.innerHTML = `
            <div class="nyou-terminal" id="nyou-terminal-${this.windowId}">
                <div class="nyou-terminal-output" id="nyou-terminal-output-${this.windowId}"></div>
                <div class="nyou-terminal-input-line">
                    <span class="nyou-terminal-prompt">admin@user ></span>
                    <input type="text" class="nyou-terminal-input" id="nyou-terminal-input-${this.windowId}" autocomplete="off" spellcheck="false">
                </div>
            </div>
        `;
        this.terminalEl = document.getElementById(`nyou-terminal-${this.windowId}`);
        this.outputEl = document.getElementById(`nyou-terminal-output-${this.windowId}`);
        this.inputEl = document.getElementById(`nyou-terminal-input-${this.windowId}`);
    },

    bindEvents() {
        if (!this.inputEl) return;

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.executeCommand(this.inputEl.value);
                this.inputEl.value = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.history.length > 0) {
                    this.historyIndex = Math.max(0, this.historyIndex - 1);
                    this.inputEl.value = this.history[this.historyIndex] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.history.length > 0) {
                    this.historyIndex = Math.min(this.history.length - 1, this.historyIndex + 1);
                    this.inputEl.value = this.history[this.historyIndex] || '';
                }
            } else if (e.key === 'l' && e.ctrlKey) {
                e.preventDefault();
                this.clear();
            }
        });

        // 点击终端区域时聚焦输入框
        this.terminalEl.addEventListener('click', () => {
            this.inputEl.focus();
        });
    },

    printWelcome() {
        this.println('NyouOS Terminal v1.0', 'info');
        this.println('(使用help来查看已有命令)', 'info');
        this.println('');
    },

    print(text, className = '') {
        const span = document.createElement('span');
        if (className) span.className = className;
        span.textContent = text;
        this.outputEl.appendChild(span);
        this.scrollToBottom();
    },

    println(text, className = '') {
        const line = document.createElement('div');
        line.className = 'nyou-terminal-line';
        if (className) line.classList.add(className);
        line.textContent = text;
        this.outputEl.appendChild(line);
        this.scrollToBottom();
    },

    printPromptLine(command) {
        const line = document.createElement('div');
        line.className = 'nyou-terminal-line';
        line.innerHTML = `<span class="nyou-terminal-prompt">admin@user ></span> ${this.escapeHtml(command)}`;
        this.outputEl.appendChild(line);
        this.scrollToBottom();
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    scrollToBottom() {
        requestAnimationFrame(() => {
            if (this.terminalEl) {
                this.terminalEl.scrollTop = this.terminalEl.scrollHeight;
            }
        });
    },

    clear() {
        this.outputEl.innerHTML = '';
    },

    executeCommand(input) {
        const command = input.trim();
        this.printPromptLine(command);

        if (!command) return;

        // 保存到历史
        this.history.push(command);
        this.historyIndex = this.history.length;

        const parts = command.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (true) {
            case cmd === 'ls':
                this.cmdLs();
                break;
            case cmd === 'this-os':
                this.cmdThisOs();
                break;
            case cmd.startsWith('open-'):
                this.cmdOpen(cmd.substring(5));
                break;
            case cmd === 'help':
                this.cmdHelp();
                break;
            case cmd === 'sysyem-feedback':
                this.cmdSystemFeedback();
                break;
            case cmd === 'user-name':
                this.cmdUserName();
                break;
            case cmd === 'clear':
                this.clear();
                break;
            case cmd === 'exit':
                this.println('再见！', 'info');
                break;
            default:
                this.println(`命令无效，请检查或输入help查看已有命令`, 'error');
        }
        this.println('');
    },

    cmdLs() {
        this.println(`当前目录: ${this.currentPath}`, 'info');
        this.println('');
        // 模拟此电脑下的文件和文件夹
        const items = [
            { name: '桌面', type: 'folder' },
            { name: '文档', type: 'folder' },
            { name: '下载', type: 'folder' },
            { name: '图片', type: 'folder' },
            { name: '音乐', type: 'folder' },
            { name: '视频', type: 'folder' },
            { name: '本地磁盘 (C:)', type: 'drive' },
            { name: '本地磁盘 (D:)', type: 'drive' },
            { name: 'readme.txt', type: 'file' },
            { name: 'system.log', type: 'file' }
        ];
        items.forEach(item => {
            const typeLabel = item.type === 'folder' ? '[文件夹]' : item.type === 'drive' ? '[驱动器]' : '[文件]';
            const className = item.type === 'folder' ? 'nyou-terminal-folder' : item.type === 'drive' ? 'nyou-terminal-info' : 'nyou-terminal-file';
            this.println(`  ${typeLabel}  ${item.name}`, className);
        });
    },

    cmdThisOs() {
        const version = 'NyouOS On Web v28.0';
        this.println(version, 'success');
        this.println('系统版本: 28.0', 'info');
        this.println('内核版本: NyouOS Kernel 1.0', 'info');
        this.println('构建日期: 2026-08-21', 'info');
    },

    cmdOpen(appName) {
        if (!appName) {
            this.println('用法: open-[应用名称]', 'error');
            return;
        }
        // 尝试打开 App
        try {
            if (typeof WindowManager !== 'undefined' && typeof WindowManager.openApp === 'function') {
                WindowManager.openApp(appName, null, { source: 'terminal' });
                this.println('ok', 'success');
            } else {
                this.println('ok', 'success');
            }
        } catch (e) {
            this.println('ok', 'success');
        }
    },

    cmdHelp() {
        this.println('可用命令:', 'info');
        this.println('');
        const commands = [
            { cmd: 'ls', desc: '列出当前目录有的文件，并显示类型，默认路径在此电脑' },
            { cmd: 'this-os', desc: '显示 NyouOS + 系统版本' },
            { cmd: 'open-[App名字]', desc: '打开对应的 App 并输出 ok' },
            { cmd: 'help', desc: '输出已有的命令和对应的作用' },
            { cmd: 'sysyem-feedback', desc: '系统反馈邮箱 nyouos@163.com' },
            { cmd: 'user-name', desc: '输出用户名字' },
            { cmd: 'clear', desc: '清屏 (Ctrl+L)' },
            { cmd: 'exit', desc: '退出终端' }
        ];
        commands.forEach(c => {
            this.println(`  ${c.cmd.padEnd(20)} ${c.desc}`);
        });
    },

    cmdSystemFeedback() {
        this.println('系统反馈邮箱 nyouos@163.com', 'info');
    },

    cmdUserName() {
        let userName = 'User';
        try {
            if (typeof State !== 'undefined' && State.user && State.user.name) {
                userName = State.user.name;
            } else if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('nyouos_user_name');
                if (saved) userName = saved;
            }
        } catch (e) {}
        this.println(userName, 'success');
    },

    beforeClose() {
        return true;
    },

    cleanup() {
        // 清理
    }
};
