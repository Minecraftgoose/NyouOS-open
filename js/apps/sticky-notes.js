/**
 * 便签应用
 * NyouOS On Web 内置应用
 * 闭源 © 2025-2026 KevinAnanda. All rights reserved.
 */
const StickyNotesApp = {
    windowId: null,
    container: null,
    notes: [],
    currentNoteId: null,
    STORAGE_KEY: 'NyouOS.stickyNotes',
    colors: ['#fff9c4', '#ffccbc', '#c8e6c9', '#bbdefb', '#e1bee7', '#f5f5f5'],

    init(windowId) {
        this.windowId = windowId;
        this.container = document.getElementById(`${windowId}-content`);
        if (!this.container) return;
        this.notes = this.loadNotes();
        if (this.notes.length === 0) {
            this.createNote();
        } else {
            this.currentNoteId = this.notes[0].id;
        }
        this.addStyles();
        this.render();
    },

    addStyles() {
        if (document.getElementById('sticky-notes-styles')) return;
        const style = document.createElement('style');
        style.id = 'sticky-notes-styles';
        style.textContent = `
            .sticky-app { display: flex; height: 100%; font-family: inherit; }
            .sticky-sidebar { width: 180px; border-right: 1px solid rgba(0,0,0,0.08); display: flex; flex-direction: column; background: rgba(0,0,0,0.02); }
            .sticky-sidebar-header { padding: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.06); }
            .sticky-new-btn { border: none; background: #ffb300; color: #fff; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
            .sticky-new-btn:hover { background: #ffa000; }
            .sticky-list { flex: 1; overflow-y: auto; padding: 6px; }
            .sticky-item { padding: 8px 10px; border-radius: 6px; cursor: pointer; margin-bottom: 4px; font-size: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; border: 2px solid transparent; }
            .sticky-item:hover { filter: brightness(0.95); }
            .sticky-item.active { border-color: rgba(0,0,0,0.2); }
            .sticky-item-preview { flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-all; }
            .sticky-item-del { border: none; background: transparent; color: rgba(0,0,0,0.4); cursor: pointer; font-size: 14px; padding: 0; flex-shrink: 0; }
            .sticky-item-del:hover { color: #e81123; }
            .sticky-main { flex: 1; display: flex; flex-direction: column; }
            .sticky-toolbar { padding: 8px 12px; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; gap: 6px; align-items: center; }
            .sticky-color-btn { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
            .sticky-color-btn.active { border-color: #333; }
            .sticky-color-btn:hover { transform: scale(1.1); }
            .sticky-date { font-size: 11px; color: rgba(0,0,0,0.5); margin-left: auto; }
            .sticky-editor { flex: 1; padding: 16px; border: none; outline: none; font-size: 15px; line-height: 1.6; resize: none; font-family: inherit; }
            .sticky-editor::placeholder { color: rgba(0,0,0,0.3); }
        `;
        document.head.appendChild(style);
    },

    loadNotes() {
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
        catch (e) { return []; }
    },

    saveNotes() {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.notes)); } catch (e) {}
    },

    createNote() {
        const note = {
            id: Date.now(),
            content: '',
            color: this.colors[Math.floor(Math.random() * this.colors.length)],
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };
        this.notes.unshift(note);
        this.currentNoteId = note.id;
        this.saveNotes();
    },

    deleteNote(id) {
        if (this.notes.length <= 1) {
            alert('至少保留一个便签');
            return;
        }
        this.notes = this.notes.filter(n => n.id !== id);
        if (this.currentNoteId === id) {
            this.currentNoteId = this.notes[0].id;
        }
        this.saveNotes();
        this.render();
    },

    selectNote(id) {
        this.currentNoteId = id;
        this.render();
    },

    getCurrentNote() {
        return this.notes.find(n => n.id === this.currentNoteId);
    },

    updateContent(content) {
        const note = this.getCurrentNote();
        if (note) {
            note.content = content;
            note.modified = new Date().toISOString();
            this.saveNotes();
            this.renderSidebar();
            this.updateDate();
        }
    },

    setColor(color) {
        const note = this.getCurrentNote();
        if (note) {
            note.color = color;
            this.saveNotes();
            this.render();
        }
    },

    updateDate() {
        const dateEl = this.container?.querySelector('.sticky-date');
        const note = this.getCurrentNote();
        if (dateEl && note) {
            dateEl.textContent = new Date(note.modified).toLocaleString('zh-CN', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
        }
    },

    renderSidebar() {
        const list = this.container.querySelector('.sticky-list');
        if (!list) return;
        list.innerHTML = '';
        this.notes.forEach(note => {
            const item = document.createElement('div');
            item.className = 'sticky-item' + (note.id === this.currentNoteId ? ' active' : '');
            item.style.background = note.color;
            const preview = note.content.trim() ? note.content.substring(0, 50) : '空白便签';
            item.innerHTML = `<span class="sticky-item-preview">${this.escapeHtml(preview)}</span><button class="sticky-item-del" title="删除">×</button>`;
            item.onclick = (e) => {
                if (e.target.classList.contains('sticky-item-del')) {
                    this.deleteNote(note.id);
                } else {
                    this.selectNote(note.id);
                }
            };
            list.appendChild(item);
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    render() {
        if (!this.container) return;
        const note = this.getCurrentNote();

        let html = '<div class="sticky-app">';
        html += '<div class="sticky-sidebar">';
        html += '<div class="sticky-sidebar-header"><span style="font-size:13px;font-weight:600;">📝 便签</span><button class="sticky-new-btn" onclick="StickyNotesApp.createNote();StickyNotesApp.render();" title="新建">+</button></div>';
        html += '<div class="sticky-list"></div>';
        html += '</div>';

        html += '<div class="sticky-main" style="background:' + (note?.color || '#fff9c4') + ';">';
        html += '<div class="sticky-toolbar">';
        this.colors.forEach(color => {
            html += '<button class="sticky-color-btn' + (note?.color === color ? ' active' : '') + '" style="background:' + color + ';" onclick="StickyNotesApp.setColor(\'' + color + '\')" title="颜色"></button>';
        });
        html += '<span class="sticky-date">' + (note ? new Date(note.modified).toLocaleString('zh-CN', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '') + '</span>';
        html += '</div>';
        html += '<textarea class="sticky-editor" style="background:' + (note?.color || '#fff9c4') + ';" placeholder="在这里输入便签内容..." oninput="StickyNotesApp.updateContent(this.value)">' + this.escapeHtml(note?.content || '') + '</textarea>';
        html += '</div></div>';

        this.container.innerHTML = html;
        this.renderSidebar();
    },

    beforeClose() {
        const editor = this.container?.querySelector('.sticky-editor');
        if (editor) this.updateContent(editor.value);
        this.windowId = null;
        this.container = null;
        return true;
    }
};
