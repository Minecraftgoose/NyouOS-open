/**
 * 待办事项应用
 * NyouOS On Web 内置应用
 * 闭源 © 2025-2026 KevinAnanda. All rights reserved.
 */
const TodoApp = {
    windowId: null,
    container: null,
    todos: [],
    STORAGE_KEY: 'NyouOS.todos',
    filter: 'all',

    init(windowId) {
        this.windowId = windowId;
        this.container = document.getElementById(`${windowId}-content`);
        if (!this.container) return;
        this.todos = this.loadTodos();
        this.addStyles();
        this.render();
    },

    addStyles() {
        if (document.getElementById('todo-app-styles')) return;
        const style = document.createElement('style');
        style.id = 'todo-app-styles';
        style.textContent = `
            .todo-app { padding: 16px; font-family: inherit; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
            .todo-app h2 { margin: 0 0 12px 0; font-size: 18px; }
            .todo-input { display: flex; gap: 8px; margin-bottom: 12px; }
            .todo-input input { flex: 1; padding: 8px 12px; border: 1px solid var(--input-border, #ccc); border-radius: 6px; font-size: 14px; background: var(--input-bg, #fff); color: var(--text-primary, #000); }
            .todo-input button { padding: 8px 16px; border: none; border-radius: 6px; background: #0078d4; color: #fff; font-size: 14px; cursor: pointer; }
            .todo-input button:hover { background: #106ebe; }
            .todo-filters { display: flex; gap: 4px; margin-bottom: 12px; }
            .todo-filters button { padding: 6px 12px; border: 1px solid var(--input-border, #ccc); border-radius: 4px; background: transparent; font-size: 12px; cursor: pointer; color: var(--text-primary, #000); }
            .todo-filters button.active { background: #0078d4; color: #fff; border-color: #0078d4; }
            .todo-list { flex: 1; overflow-y: auto; }
            .todo-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.06); }
            .todo-item.done .todo-text { text-decoration: line-through; opacity: 0.5; }
            .todo-item input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
            .todo-text { flex: 1; font-size: 14px; }
            .todo-delete { border: none; background: transparent; font-size: 18px; cursor: pointer; color: #999; padding: 0 4px; }
            .todo-delete:hover { color: #e81123; }
            .todo-empty { text-align: center; color: #999; padding: 40px 0; font-size: 14px; }
            .todo-footer { margin-top: 12px; text-align: center; }
            .todo-footer button { padding: 6px 14px; border: 1px solid #e81123; border-radius: 4px; background: transparent; color: #e81123; font-size: 12px; cursor: pointer; }
            .todo-footer button:hover { background: #e81123; color: #fff; }
        `;
        document.head.appendChild(style);
    },

    loadTodos() {
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
        catch (e) { return []; }
    },

    saveTodos() {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.todos)); } catch (e) {}
    },

    addTodo(text) {
        if (!text || !text.trim()) return;
        this.todos.unshift({ id: Date.now(), text: text.trim(), done: false, created: new Date().toISOString() });
        this.saveTodos();
        this.render();
    },

    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) todo.done = !todo.done;
        this.saveTodos();
        this.render();
    },

    deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        this.saveTodos();
        this.render();
    },

    clearCompleted() {
        this.todos = this.todos.filter(t => !t.done);
        this.saveTodos();
        this.render();
    },

    setFilter(f) {
        this.filter = f;
        this.render();
    },

    render() {
        if (!this.container) return;
        const filtered = this.filter === 'active' ? this.todos.filter(t => !t.done)
            : this.filter === 'done' ? this.todos.filter(t => t.done)
            : this.todos;
        const activeCount = this.todos.filter(t => !t.done).length;
        const doneCount = this.todos.filter(t => t.done).length;

        let html = '<div class="todo-app">';
        html += '<h2>📋 待办事项</h2>';
        html += '<div class="todo-input">';
        html += '<input type="text" id="todo-input" placeholder="添加新任务，按回车确认..." onkeydown="if(event.key===\'Enter\'){TodoApp.addTodo(this.value);this.value=\'\';}">';
        html += '<button onclick="const i=document.getElementById(\'todo-input\');TodoApp.addTodo(i.value);i.value=\'\';">添加</button>';
        html += '</div>';
        html += '<div class="todo-filters">';
        html += '<button class="' + (this.filter === 'all' ? 'active' : '') + '" onclick="TodoApp.setFilter(\'all\')">全部 (' + this.todos.length + ')</button>';
        html += '<button class="' + (this.filter === 'active' ? 'active' : '') + '" onclick="TodoApp.setFilter(\'active\')">待办 (' + activeCount + ')</button>';
        html += '<button class="' + (this.filter === 'done' ? 'active' : '') + '" onclick="TodoApp.setFilter(\'done\')">已完成 (' + doneCount + ')</button>';
        html += '</div>';
        html += '<div class="todo-list">';

        if (filtered.length === 0) {
            html += '<p class="todo-empty">暂无任务，添加一个吧 ✨</p>';
        } else {
            filtered.forEach(todo => {
                const escaped = this.escapeHtml(todo.text);
                html += '<div class="todo-item' + (todo.done ? ' done' : '') + '">';
                html += '<input type="checkbox" ' + (todo.done ? 'checked' : '') + ' onchange="TodoApp.toggleTodo(' + todo.id + ')">';
                html += '<span class="todo-text">' + escaped + '</span>';
                html += '<button class="todo-delete" onclick="TodoApp.deleteTodo(' + todo.id + ')" title="删除">×</button>';
                html += '</div>';
            });
        }

        html += '</div>';
        if (doneCount > 0) {
            html += '<div class="todo-footer"><button onclick="TodoApp.clearCompleted()">清除已完成 (' + doneCount + ')</button></div>';
        }
        html += '</div>';
        this.container.innerHTML = html;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    beforeClose() {
        this.windowId = null;
        this.container = null;
        return true;
    }
};
