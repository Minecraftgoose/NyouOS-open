/**
 * 文档编辑器应用
 * NyouOS On Web 内置应用
 * 闭源 © 2025-2026 KevinAnanda. All rights reserved.
 */
const DocumentEditorApp = {
    windowId: null,
    container: null,
    docs: [],
    currentDocId: null,
    STORAGE_KEY: 'NyouOS.docs',

    init(windowId) {
        this.windowId = windowId;
        this.container = document.getElementById(`${windowId}-content`);
        if (!this.container) return;
        this.docs = this.loadDocs();
        if (this.docs.length === 0) {
            this.createNewDoc();
        } else {
            this.currentDocId = this.docs[0].id;
        }
        this.addStyles();
        this.render();
    },

    addStyles() {
        if (document.getElementById('doc-editor-styles')) return;
        const style = document.createElement('style');
        style.id = 'doc-editor-styles';
        style.textContent = `
            .doc-app { display: flex; height: 100%; font-family: inherit; }
            .doc-sidebar { width: 200px; border-right: 1px solid rgba(0,0,0,0.1); display: flex; flex-direction: column; background: rgba(0,0,0,0.02); }
            .doc-sidebar-header { padding: 12px; font-size: 14px; font-weight: 600; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; }
            .doc-new-btn { border: none; background: #0078d4; color: #fff; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
            .doc-list { flex: 1; overflow-y: auto; padding: 8px; }
            .doc-item { padding: 8px 10px; border-radius: 4px; cursor: pointer; margin-bottom: 2px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
            .doc-item:hover { background: rgba(0,0,0,0.05); }
            .doc-item.active { background: rgba(0,120,212,0.15); }
            .doc-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .doc-item-del { border: none; background: transparent; color: #999; cursor: pointer; font-size: 14px; opacity: 0; }
            .doc-item:hover .doc-item-del { opacity: 1; }
            .doc-item-del:hover { color: #e81123; }
            .doc-main { flex: 1; display: flex; flex-direction: column; }
            .doc-toolbar { padding: 8px 12px; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
            .doc-toolbar button { padding: 6px 10px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; min-width: 32px; }
            .doc-toolbar button:hover { background: rgba(0,0,0,0.05); }
            .doc-toolbar button.active { background: #0078d4; color: #fff; border-color: #0078d4; }
            .doc-toolbar select { padding: 5px 8px; border: 1px solid rgba(0,0,0,0.1); border-radius: 4px; font-size: 13px; }
            .doc-toolbar .sep { width: 1px; height: 20px; background: rgba(0,0,0,0.1); margin: 0 4px; }
            .doc-title-input { width: 100%; padding: 12px 20px 4px; border: none; font-size: 24px; font-weight: 600; outline: none; background: transparent; }
            .doc-editor { flex: 1; padding: 12px 20px 20px; overflow-y: auto; outline: none; font-size: 15px; line-height: 1.7; }
            .doc-editor:empty:before { content: '开始输入...'; color: #ccc; }
            .doc-status { padding: 4px 12px; font-size: 11px; color: #999; border-top: 1px solid rgba(0,0,0,0.05); }
        `;
        document.head.appendChild(style);
    },

    loadDocs() {
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
        catch (e) { return []; }
    },

    saveDocs() {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.docs)); } catch (e) {}
    },

    createNewDoc() {
        const doc = { id: Date.now(), title: '未命名文档', content: '', created: new Date().toISOString(), modified: new Date().toISOString() };
        this.docs.unshift(doc);
        this.currentDocId = doc.id;
        this.saveDocs();
    },

    deleteDoc(id) {
        if (!confirm('确定删除这个文档吗？')) return;
        this.docs = this.docs.filter(d => d.id !== id);
        if (this.currentDocId === id) {
            this.currentDocId = this.docs.length > 0 ? this.docs[0].id : null;
            if (!this.currentDocId) this.createNewDoc();
        }
        this.saveDocs();
        this.render();
    },

    selectDoc(id) {
        this.currentDocId = id;
        this.render();
    },

    getCurrentDoc() {
        return this.docs.find(d => d.id === this.currentDocId);
    },

    updateTitle(title) {
        const doc = this.getCurrentDoc();
        if (doc) {
            doc.title = title || '未命名文档';
            doc.modified = new Date().toISOString();
            this.saveDocs();
            this.renderSidebar();
        }
    },

    updateContent() {
        const doc = this.getCurrentDoc();
        const editor = this.container.querySelector('.doc-editor');
        if (doc && editor) {
            doc.content = editor.innerHTML;
            doc.modified = new Date().toISOString();
            this.saveDocs();
            this.updateStatus();
        }
    },

    execCommand(cmd, value = null) {
        document.execCommand(cmd, false, value);
        const editor = this.container.querySelector('.doc-editor');
        if (editor) editor.focus();
        this.updateToolbarState();
        this.updateContent();
    },

    updateToolbarState() {
        const buttons = this.container.querySelectorAll('.doc-toolbar button[data-cmd]');
        buttons.forEach(btn => {
            const cmd = btn.dataset.cmd;
            try {
                if (document.queryCommandState(cmd)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            } catch (e) {}
        });
    },

    updateStatus() {
        const status = this.container.querySelector('.doc-status');
        const doc = this.getCurrentDoc();
        if (status && doc) {
            const text = this.container.querySelector('.doc-editor')?.innerText || '';
            const chars = text.length;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            status.textContent = `${chars} 字符 · ${words} 词 · 已自动保存`;
        }
    },

    renderSidebar() {
        const list = this.container.querySelector('.doc-list');
        if (!list) return;
        list.innerHTML = '';
        this.docs.forEach(doc => {
            const item = document.createElement('div');
            item.className = 'doc-item' + (doc.id === this.currentDocId ? ' active' : '');
            item.innerHTML = `<span class="doc-item-title">${this.escapeHtml(doc.title)}</span><button class="doc-item-del" title="删除">×</button>`;
            item.onclick = (e) => {
                if (e.target.classList.contains('doc-item-del')) {
                    this.deleteDoc(doc.id);
                } else {
                    this.selectDoc(doc.id);
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
        const doc = this.getCurrentDoc();

        let html = '<div class="doc-app">';
        html += '<div class="doc-sidebar">';
        html += '<div class="doc-sidebar-header">📄 文档 <button class="doc-new-btn" onclick="DocumentEditorApp.createNewDoc();DocumentEditorApp.render();" title="新建">+</button></div>';
        html += '<div class="doc-list"></div>';
        html += '</div>';

        html += '<div class="doc-main">';
        html += '<div class="doc-toolbar">';
        html += '<select onchange="DocumentEditorApp.execCommand(\'formatBlock\', this.value);this.selectedIndex=0;">';
        html += '<option value="">段落样式</option>';
        html += '<option value="h1">标题 1</option>';
        html += '<option value="h2">标题 2</option>';
        html += '<option value="h3">标题 3</option>';
        html += '<option value="p">正文</option>';
        html += '<option value="blockquote">引用</option>';
        html += '</select>';
        html += '<div class="sep"></div>';
        html += '<button data-cmd="bold" onclick="DocumentEditorApp.execCommand(\'bold\')" title="加粗"><b>B</b></button>';
        html += '<button data-cmd="italic" onclick="DocumentEditorApp.execCommand(\'italic\')" title="斜体"><i>I</i></button>';
        html += '<button data-cmd="underline" onclick="DocumentEditorApp.execCommand(\'underline\')" title="下划线"><u>U</u></button>';
        html += '<button data-cmd="strikeThrough" onclick="DocumentEditorApp.execCommand(\'strikeThrough\')" title="删除线"><s>S</s></button>';
        html += '<div class="sep"></div>';
        html += '<button onclick="DocumentEditorApp.execCommand(\'insertUnorderedList\')" title="无序列表">• 列表</button>';
        html += '<button onclick="DocumentEditorApp.execCommand(\'insertOrderedList\')" title="有序列表">1. 列表</button>';
        html += '<div class="sep"></div>';
        html += '<button onclick="DocumentEditorApp.execCommand(\'justifyLeft\')" title="左对齐">⬅</button>';
        html += '<button onclick="DocumentEditorApp.execCommand(\'justifyCenter\')" title="居中">⬌</button>';
        html += '<button onclick="DocumentEditorApp.execCommand(\'justifyRight\')" title="右对齐">➡</button>';
        html += '<div class="sep"></div>';
        html += '<button onclick="DocumentEditorApp.execCommand(\'undo\')" title="撤销">↶</button>';
        html += '<button onclick="DocumentEditorApp.execCommand(\'redo\')" title="重做">↷</button>';
        html += '</div>';

        html += '<input type="text" class="doc-title-input" value="' + this.escapeHtml(doc?.title || '') + '" oninput="DocumentEditorApp.updateTitle(this.value)" placeholder="文档标题">';
        html += '<div class="doc-editor" contenteditable="true" oninput="DocumentEditorApp.updateContent()" onkeyup="DocumentEditorApp.updateToolbarState()" onmouseup="DocumentEditorApp.updateToolbarState()">' + (doc?.content || '') + '</div>';
        html += '<div class="doc-status"></div>';
        html += '</div></div>';

        this.container.innerHTML = html;
        this.renderSidebar();
        this.updateStatus();
    },

    beforeClose() {
        this.updateContent();
        this.windowId = null;
        this.container = null;
        return true;
    }
};
