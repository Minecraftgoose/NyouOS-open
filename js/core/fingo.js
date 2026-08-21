/**
 * SurfAi 助手 - 核心逻辑
 */
const SurfAi = {
    element: null,
    input: null,
    messagesEl: null,
    historyEl: null,
    contextMenuEl: null,
    _cardAnimTimer: null,
    _panelAnimTimer: null,
    isOpen: false,
    conversations: [],
    currentId: null,
    STORAGE_KEY: 'NyouOS.fingo_history',
    COPY_ICON_STROKE: 'Theme/Icon/Symbol_icon/stroke/Copy.svg',
    COPY_ICON_FILL: 'Theme/Icon/Symbol_icon/fill/Copy.svg',
    _pendingAction: null, // { type: 'uninstall'|'repair', app, appName }
    _sessionApiKey: '',
    _pendingDecryptPromise: null,
    API_KEY_CRYPTO_VERSION: 1,
    PANEL_BASE_Z: 10200,

    init() {
        this.element = document.getElementById('fingo-panel');
        this.blurLayer = document.getElementById('fingo-blur-layer');
        this.input = document.getElementById('fingo-input');
        this.messagesEl = document.getElementById('fingo-messages');
        this.historyEl = document.getElementById('fingo-history');
        this.contentEl = this.element?.querySelector('.fingo-content');
        this._updateInputPlaceholder();
        State.on('languageChange', () => this._updateInputPlaceholder(), { key: 'SurfAi.languageChange' });
        this._ensureContextMenu();
        this._loadConversations();
        if (!this.currentId) this.newConversation(true);
        this._updateEmptyState();
        this.bindEvents();
    },

    toggle() { this.isOpen ? this.hide('manual') : this.show(); },

    show() {
        this.isOpen = true;
        clearTimeout(this._panelAnimTimer);
        this._panelAnimTimer = null;
        this._updateInputPlaceholder();
        if (typeof StartMenu !== 'undefined') StartMenu.close();
        if (typeof ControlCenter !== 'undefined') ControlCenter.close();
        if (typeof NotificationCenter !== 'undefined') NotificationCenter.close();
        this.element.classList.remove('hidden', 'fingo-closing');
        this._ensurePanelForeground();
        if (this.blurLayer) this.blurLayer.classList.add('fingo-visible');
        const btn = document.getElementById('fingo-btn');
        if (btn) btn.classList.add('active');
        setTimeout(() => this.input.focus(), 300);
    },

    hide(reason = 'external') {
        if (!this.isOpen) return;
        this.isOpen = false;
        this._hideContextMenu();
        if (this.blurLayer) this.blurLayer.classList.remove('fingo-visible');
        const btn = document.getElementById('fingo-btn');
        if (btn) btn.classList.remove('active');

        if (State.settings.enableAnimation) {
            this.element.classList.add('fingo-closing');
            clearTimeout(this._panelAnimTimer);
            this._panelAnimTimer = setTimeout(() => {
                if (this.isOpen) return;
                this.element.classList.add('hidden');
                this.element.classList.remove('fingo-closing');
                this._panelAnimTimer = null;
            }, 200);
        } else {
            this.element.classList.add('hidden');
        }
    },

    _ensurePanelForeground() {
        if (!this.element) return;
        let topWindowZ = 0;

        if (typeof WindowManager !== 'undefined') {
            const counter = Number(WindowManager.zIndexCounter);
            if (Number.isFinite(counter)) topWindowZ = Math.max(topWindowZ, counter);
            if (Array.isArray(WindowManager.windows)) {
                WindowManager.windows.forEach((w) => {
                    if (!w || !w.element) return;
                    const z = Number.parseInt(w.element.style.zIndex, 10);
                    if (Number.isFinite(z)) topWindowZ = Math.max(topWindowZ, z);
                });
            }
        }

        const targetZ = Math.max(this.PANEL_BASE_Z, topWindowZ + 200);
        this.element.style.zIndex = String(targetZ);
    },

    bindEvents() {
        const btn = document.getElementById('fingo-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.input.value.trim()) {
                this.processInput(this.input.value.trim());
                this.input.value = '';
            }
        });
        this.element.addEventListener('contextmenu', (e) => {
            if (!this.isOpen) return;
            e.preventDefault();
            e.stopPropagation();
            this._showContextMenu(e.clientX, e.clientY);
        });
        document.addEventListener('click', (e) => {
            if (this.contextMenuEl && !this.contextMenuEl.classList.contains('hidden') && !this.contextMenuEl.contains(e.target)) {
                this._hideContextMenu();
            }
            if (this.isOpen && !this.element.contains(e.target) && !e.target.closest('#fingo-btn') && !e.target.closest('#fingo-context-menu')) {
                this.hide('outside-click');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.contextMenuEl && !this.contextMenuEl.classList.contains('hidden')) {
                this._hideContextMenu();
                return;
            }
            if (this.isOpen) this.hide('manual');
        });
        // 工具栏按钮
        document.getElementById('fingo-new-chat')?.addEventListener('click', () => this.newConversation());
        document.getElementById('fingo-history-btn')?.addEventListener('click', () => this._toggleHistory());
        document.getElementById('fingo-clear-btn')?.addEventListener('click', () => this.clearAll());
    },

    _ensureContextMenu() {
        if (this.contextMenuEl || !document.body) return;

        const menu = document.createElement('div');
        menu.id = 'fingo-context-menu';
        menu.className = 'context-menu hidden';
        menu.addEventListener('contextmenu', (e) => e.preventDefault());
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;
            if (item.dataset.action === 'open-fingo-settings') {
                e.preventDefault();
                e.stopPropagation();
                this._hideContextMenu();
                this._executeAction('openSettings:fingo');
            }
        });

        document.body.appendChild(menu);
        this.contextMenuEl = menu;
        this._renderContextMenu();
    },

    _renderContextMenu() {
        if (!this.contextMenuEl) return;
        const label = this.lang() === 'zh' ? '打开SurfAi设置' : 'Open SurfAi Settings';
        this.contextMenuEl.innerHTML = `
            <div class="context-menu-item" data-action="open-fingo-settings">
                <img src="Theme/Icon/Symbol_icon/stroke/Settings.svg" alt="">
                <span>${label}</span>
            </div>
        `;
    },

    _showContextMenu(x, y) {
        this._ensureContextMenu();
        this._renderContextMenu();
        if (!this.contextMenuEl) return;

        this.contextMenuEl.style.visibility = 'hidden';
        this.contextMenuEl.classList.remove('hidden');

        const rect = this.contextMenuEl.getBoundingClientRect();
        const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
        const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
        const left = Math.min(Math.max(8, x), maxLeft);
        const top = Math.min(Math.max(8, y), maxTop);

        this.contextMenuEl.style.left = `${left}px`;
        this.contextMenuEl.style.top = `${top}px`;
        this.contextMenuEl.style.visibility = '';
    },

    _hideContextMenu() {
        if (!this.contextMenuEl) return;
        this.contextMenuEl.classList.add('hidden');
    },



    _updateEmptyState() {
        if (!this.contentEl) return;
        const conv = this.conversations.find(c => c.id === this.currentId);
        const empty = !conv || !conv.messages.length;
        this._setEmptyState(empty);
    },

    _expandCard() {
        if (!this.contentEl) return;
        this._setEmptyState(false);
    },

    _setEmptyState(empty) {
        if (!this.contentEl) return;
        const wasEmpty = this.contentEl.classList.contains('fingo-empty');
        if (wasEmpty === empty) return;

        clearTimeout(this._cardAnimTimer);
        this.contentEl.classList.remove('fingo-expanding', 'fingo-collapsing');
        this.contentEl.classList.toggle('fingo-empty', empty);

        const animClass = empty ? 'fingo-collapsing' : 'fingo-expanding';
        this.contentEl.classList.add(animClass);
        if (empty) this._setHistoryExpanded(false);

        this._cardAnimTimer = setTimeout(() => {
            this.contentEl?.classList.remove('fingo-expanding', 'fingo-collapsing');
        }, empty ? 360 : 520);
    },

    _setHistoryExpanded(expanded) {
        if (!this.historyEl) return;
        if (expanded) {
            this._renderHistoryList();
            requestAnimationFrame(() => this.historyEl?.classList.add('show'));
            return;
        }
        this.historyEl.classList.remove('show');
    },

    lang() {
        return (I18n && I18n.currentLang === 'en') ? 'en' : 'zh';
    },

    _updateInputPlaceholder() {
        if (!this.input) return;
        this.input.placeholder = this.lang() === 'zh' ? '问你想问' : 'Ask me anything...';
    },

    getSessionApiKey() {
        return this._sessionApiKey || '';
    },

    getApiKeyStorageType() {
        if (State.settings.fingoApiStorageType) return State.settings.fingoApiStorageType;
        if (State.settings.fingoApiEncrypted && State.settings.fingoApiEncrypted.ciphertext) return 'permanent-encrypted';
        if ((State.settings.fingoApiKey || '').trim()) return 'permanent-plain';
        return 'none';
    },

    saveApiKeyTemporary(apiKey) {
        const clean = (apiKey || '').trim();
        if (!clean) {
            this.clearApiKey();
            return false;
        }
        this._sessionApiKey = clean;
        State.updateSettings({
            fingoApiKey: '',
            fingoApiEncrypted: null,
            fingoApiStorageType: 'session'
        });
        State.emit('fingoApiKeyReady', { storageType: 'session', decrypted: true });
        return true;
    },

    saveApiKeyPermanentPlain(apiKey) {
        // Security hardening: permanently storing API keys in plain text is disabled.
        throw new Error(this.lang() === 'zh'
            ? '出于安全原因，已禁用永久明文保存 API Key。'
            : 'Permanent plain-text API key storage is disabled for security reasons.');
    },

    clearApiKey() {
        this._sessionApiKey = '';
        State.updateSettings({
            fingoApiKey: '',
            fingoApiEncrypted: null,
            fingoApiStorageType: 'none'
        });
        State.emit('fingoApiKeyReady', { storageType: 'none', decrypted: false });
    },

    _isWebCryptoAvailable() {
        return !!(window.crypto && window.crypto.subtle && window.TextEncoder && window.TextDecoder);
    },

    _bufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    },

    _base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    },

    async _deriveEncryptionKey(passphrase, salt, usage) {
        const material = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            usage
        );
    },

    async _encryptApiKey(apiKey, passphrase) {
        if (!this._isWebCryptoAvailable()) throw new Error(this.lang() === 'zh' ? '当前浏览器不支持 WebCrypto。' : 'WebCrypto is not available.');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this._deriveEncryptionKey(passphrase, salt, ['encrypt']);
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(apiKey)
        );
        return {
            version: this.API_KEY_CRYPTO_VERSION,
            salt: this._bufferToBase64(salt.buffer),
            iv: this._bufferToBase64(iv.buffer),
            ciphertext: this._bufferToBase64(encrypted)
        };
    },

    async _decryptApiKey(payload, passphrase) {
        if (!payload || !payload.ciphertext || !payload.salt || !payload.iv) {
            throw new Error(this.lang() === 'zh' ? '加密数据无效。' : 'Encrypted payload is invalid.');
        }
        if (!this._isWebCryptoAvailable()) throw new Error(this.lang() === 'zh' ? '当前浏览器不支持 WebCrypto。' : 'WebCrypto is not available.');
        const salt = new Uint8Array(this._base64ToBuffer(payload.salt));
        const iv = new Uint8Array(this._base64ToBuffer(payload.iv));
        const data = this._base64ToBuffer(payload.ciphertext);
        const key = await this._deriveEncryptionKey(passphrase, salt, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );
        return new TextDecoder().decode(decrypted);
    },

    async saveApiKeyPermanentEncrypted(apiKey, passphrase) {
        const clean = (apiKey || '').trim();
        if (!clean) {
            this.clearApiKey();
            return false;
        }
        if (!passphrase || passphrase.length < 8) {
            throw new Error(this.lang() === 'zh' ? '口令至少 8 位。' : 'Passphrase must be at least 8 characters.');
        }
        const encrypted = await this._encryptApiKey(clean, passphrase);
        this._sessionApiKey = clean;
        State.updateSettings({
            fingoApiKey: '',
            fingoApiEncrypted: encrypted,
            fingoApiStorageType: 'permanent-encrypted'
        });
        State.emit('fingoApiKeyReady', { storageType: 'permanent-encrypted', decrypted: true });
        return true;
    },

    _promptDecryptPassphrase() {
        const isZh = this.lang() === 'zh';
        return new Promise((resolve) => {
            NyouUI.InputDialog({
                title: isZh ? '输入解密口令' : 'Enter Passphrase',
                placeholder: isZh ? '请输入用于解密 API Key 的口令' : 'Enter the passphrase for your API Key',
                inputType: 'password',
                minLength: 1,
                confirmText: isZh ? '解密' : 'Decrypt',
                cancelText: isZh ? '取消' : 'Cancel',
                onConfirm: (val) => resolve((val || '').trim()),
                onCancel: () => resolve(null)
            });
        });
    },

    async getApiKeyForRequest() {
        const sessionKey = (this._sessionApiKey || '').trim();
        if (sessionKey) return sessionKey;

        // Plain-text permanent key (for pre-configured deployments like SurfAi)
        const plainKey = (State.settings.fingoApiKey || '').trim();
        if (plainKey) return plainKey;

        const encryptedPayload = State.settings.fingoApiEncrypted;
        if (!encryptedPayload || !encryptedPayload.ciphertext) return null;

        if (this._pendingDecryptPromise) return this._pendingDecryptPromise;

        this._pendingDecryptPromise = (async () => {
            const passphrase = await this._promptDecryptPassphrase();
            if (!passphrase) return null;
            try {
                const decrypted = await this._decryptApiKey(encryptedPayload, passphrase);
                this._sessionApiKey = decrypted.trim();
                State.emit('fingoApiKeyReady', { storageType: 'permanent-encrypted', decrypted: true });
                return this._sessionApiKey;
            } catch (error) {
                if (typeof NyouUI !== 'undefined' && NyouUI.Toast) {
                    NyouUI.Toast({
                        title: 'SurfAi',
                        message: this.lang() === 'zh' ? 'API Key 解密失败，请检查口令。' : 'Failed to decrypt API Key.',
                        type: 'error'
                    });
                }
                return null;
            }
        })().finally(() => {
            this._pendingDecryptPromise = null;
        });

        return this._pendingDecryptPromise;
    },

    _createMessageElement(text, type) {
        const safeText = typeof text === 'string' ? text : String(text ?? '');
        const div = document.createElement('div');
        div.className = `fingo-msg fingo-msg-${type}`;

        const textEl = document.createElement('div');
        textEl.className = 'fingo-msg-text';
        safeText.split('\n').forEach((line, i) => {
            if (i > 0) textEl.appendChild(document.createElement('br'));
            textEl.appendChild(document.createTextNode(line));
        });
        div.appendChild(textEl);

        if (type === 'bot') {
            div.classList.add('fingo-msg-copyable');
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'fingo-copy-btn';
            const tip = this.lang() === 'zh' ? '复制内容' : 'Copy message';
            copyBtn.title = tip;
            copyBtn.setAttribute('aria-label', tip);

            const icon = document.createElement('img');
            icon.className = 'fingo-copy-icon';
            icon.src = this.COPY_ICON_STROKE;
            icon.alt = 'Copy';
            copyBtn.appendChild(icon);

            copyBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const copied = await this._copyToClipboard(safeText);
                clearTimeout(copyBtn._copyResetTimer);
                copyBtn.classList.remove('copied', 'copy-failed');
                void copyBtn.offsetWidth; // restart click animation
                copyBtn.classList.add(copied ? 'copied' : 'copy-failed');
                icon.src = copied ? this.COPY_ICON_FILL : this.COPY_ICON_STROKE;
                copyBtn._copyResetTimer = setTimeout(() => {
                    icon.src = this.COPY_ICON_STROKE;
                    copyBtn.classList.remove('copied', 'copy-failed');
                }, 750);
            });

            div.appendChild(copyBtn);
        }

        return div;
    },

    async _copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (_) {}
        }

        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (_) {
            ok = false;
        }
        ta.remove();
        return ok;
    },

    addMessage(text, type) {
        const div = this._createMessageElement(text, type);
        this.messagesEl.appendChild(div);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        // 保存到当前对话
        const conv = this.conversations.find(c => c.id === this.currentId);
        if (conv) {
            conv.messages.push({ text, type });
            this._saveConversations();
        }
        return div;
    },

    // --- 对话历史管理 ---
    _loadConversations() {
        const conversations = Storage.get(this.STORAGE_KEY, []);
        this.conversations = Array.isArray(conversations) ? conversations : [];
        if (this.conversations.length) {
            this.currentId = this.conversations[0].id;
            this._renderMessages(this.conversations[0].messages);
        }
    },

    _saveConversations() {
        Storage.set(this.STORAGE_KEY, this.conversations);
    },

    newConversation(silent) {
        const conv = { id: Date.now().toString(), messages: [], ts: Date.now() };
        this.conversations.unshift(conv);
        this.currentId = conv.id;
        if (!silent) {
            this.messagesEl.innerHTML = '';
            this._saveConversations();
            this._renderHistoryList();
            this._setHistoryExpanded(false);
        }
        this._updateEmptyState();
    },

    loadConversation(id) {
        const conv = this.conversations.find(c => c.id === id);
        if (!conv) return;
        this.currentId = id;
        this._renderMessages(conv.messages);
        this._updateEmptyState();
        this._setHistoryExpanded(false);
    },

    clearAll() {
        this.conversations = [];
        this.messagesEl.innerHTML = '';
        this.newConversation(true);
        this._saveConversations();
        this._renderHistoryList();
        this._setHistoryExpanded(false);
        this._updateEmptyState();
    },

    _toggleHistory() {
        if (!this.historyEl) return;
        this._setHistoryExpanded(!this.historyEl.classList.contains('show'));
    },

    _renderHistoryList() {
        if (!this.historyEl) return;
        this.historyEl.innerHTML = '';
        if (!this.conversations.length || (this.conversations.length === 1 && !this.conversations[0].messages.length)) {
            this.historyEl.innerHTML = `<div class="fingo-history-empty">${this.lang() === 'zh' ? '暂无历史记录' : 'No history'}</div>`;
            return;
        }
        this.conversations.forEach(c => {
            if (!c.messages.length) return;
            const item = document.createElement('div');
            item.className = 'fingo-history-item';
            const preview = c.messages[0]?.text || '';
            item.textContent = preview.length > 40 ? preview.slice(0, 40) + '…' : preview;
            item.addEventListener('click', () => this.loadConversation(c.id));
            this.historyEl.appendChild(item);
        });
    },

    _renderMessages(msgs) {
        this.messagesEl.innerHTML = '';
        (msgs || []).forEach(m => {
            const div = this._createMessageElement(m.text, m.type);
            this.messagesEl.appendChild(div);
        });
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    },

    _compactText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[\s`~!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?，。！？、；：“”‘’（）【】《》]/g, '');
    },

    _normalizeInputText(text) {
        let normalized = String(text || '').toLowerCase();
        normalized = normalized
            .replace(/[’]/g, '\'')
            .replace(/[“”]/g, '"')
            .replace(/\bi['’]?m\b/g, 'i am')
            .replace(/\bcan['’]?t\b/g, 'cant')
            .replace(/\bdon['’]?t\b/g, 'do not')
            .replace(/\bwon['’]?t\b/g, 'will not')
            .replace(/\bpls\b|\bplz\b/g, 'please')
            .replace(/\bthx\b|\bty\b/g, 'thanks')
            .replace(/\bwi[\s-]?fi\b/g, 'wifi')
            .replace(/\bfull\s*screen\b/g, 'fullscreen')
            .replace(/\bsign\s*out\b/g, 'logout')
            .replace(/\blog\s*out\b/g, 'logout')
            .replace(/\bfingo\s*ai\b/g, 'fingo ai')
            .replace(/fingoai/g, 'fingo ai')
            .replace(/全屏幕/g, '全屏')
            .replace(/网页全屏模式/g, '网页全屏');

        // Remove common filler words so intent words are easier to match.
        normalized = normalized
            .replace(/请问一下|请问|麻烦你|麻烦您|麻烦|请你|请|帮我把|帮我|帮忙把|帮忙|给我把|给我|把|一下下?|一下子?|可不可以|能不能|可以吗|行吗|好吗|好嘛|呢|吧|呀|啊|嘛|哦|呗|哈/g, ' ')
            .replace(/我想要|我想把|我想|我想让你|想要|我要|希望你|希望/g, ' ')
            .replace(/\bplease\b/g, ' ');

        normalized = normalized.replace(/\s+/g, ' ').trim();
        return normalized;
    },

    _escapeRegex(text) {
        return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    _matchPhraseInText(text, phrase) {
        const kw = String(phrase || '').toLowerCase().trim();
        if (!kw) return false;
        if (/^[a-z0-9 ]+$/.test(kw)) {
            const pattern = this._escapeRegex(kw).replace(/\s+/g, '\\s+');
            return new RegExp(`(^|\\b)${pattern}(\\b|$)`, 'i').test(text);
        }
        return text.includes(kw);
    },

    _extractWordTokens(text) {
        const stopWords = new Set([
            'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with',
            'is', 'are', 'be', 'please', 'me', 'my', 'your', 'now'
        ]);
        return String(text || '')
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .map(s => s.trim())
            .filter(Boolean)
            .filter(token => token.length > 1 && !stopWords.has(token));
    },

    _containsOrderedChars(text, pattern) {
        const src = String(text || '');
        const pat = String(pattern || '');
        if (!src || !pat) return false;
        let i = 0;
        for (const ch of src) {
            if (ch === pat[i]) i += 1;
            if (i >= pat.length) return true;
        }
        return false;
    },

    _matchLoosePhrase(normalizedText, compactText, phrase) {
        const kw = String(phrase || '').toLowerCase().trim();
        if (!kw) return false;

        if (/^[a-z0-9 ]+$/.test(kw) && kw.includes(' ')) {
            const kwTokens = this._extractWordTokens(kw);
            if (kwTokens.length >= 2) {
                const textTokens = new Set(this._extractWordTokens(normalizedText));
                if (kwTokens.every(token => textTokens.has(token))) return true;
            }
        }

        if (/[\u4e00-\u9fff]/.test(kw)) {
            const compactKw = this._compactText(kw);
            if (compactKw.length >= 4 && this._containsOrderedChars(compactText, compactKw)) {
                return true;
            }
        }

        return false;
    },

    _getKeywordVariants(keyword) {
        const base = String(keyword || '').toLowerCase().trim();
        if (!base) return [];

        if (!this._keywordVariantCache) this._keywordVariantCache = new Map();
        if (this._keywordVariantCache.has(base)) return this._keywordVariantCache.get(base);

        const variants = new Set([base]);
        const zhGroups = [
            ['调高', '提高', '增加', '升高', '调大', '大一点'],
            ['调低', '降低', '减少', '调小', '小一点'],
            ['音量', '声音', '系统音量', '音量大小'],
            ['亮度', '屏幕亮度'],
            ['音乐', '歌曲', '歌', '多媒体'],
            ['随机播放', '打乱播放', '洗牌播放'],
            ['下一首', '下一曲', '下首歌'],
            ['上一首', '上一曲', '上首歌'],
            ['列表循环', '歌单循环', '播放列表循环', '全部循环'],
            ['单曲循环', '循环当前歌曲', '重复当前歌曲'],
            ['开启', '打开', '启用', '开', '启动'],
            ['关闭', '关掉', '禁用', '停用', '关'],
            ['切换', '改成', '换成', '调整为', '设为'],
            ['进入', '打开', '前往', '跳转到'],
            ['模糊', '毛玻璃', '磨砂'],
            ['动画', '动效'],
            ['任务视图', '多任务视图', '任务切换', '任务管理视图'],
            ['分屏', '贴边布局', '窗口贴边', '贴边分屏'],
            ['控制中心', '快捷设置'],
            ['通知中心', '消息中心'],
            ['最小化', '缩小', '收起'],
            ['当前窗口', '前台窗口', '顶部窗口', '置顶窗口'],
            ['全屏', '网页全屏', '网页自动全屏', '自动全屏'],
            ['固定到任务栏', '固定任务栏', '任务栏固定'],
            ['从任务栏取消固定', '取消固定任务栏', '解除任务栏固定'],
            ['重置', '恢复默认', '还原'],
            ['主题和动效', '外观默认', '视觉效果'],
            ['壁纸', '桌面背景', '背景图', '墙纸'],
            ['重启', '重新启动', '重新开机'],
            ['关机', '关闭电脑', '关电脑'],
            ['锁屏', '锁定', '锁定屏幕'],
            ['卸载', '删除', '移除', '卸掉'],
            ['安装', '下载', '装上'],
            ['修复', '修一下', '修一修', '修好'],
            ['亮度', '屏幕亮度'],
            ['深色', '暗色', '黑暗', '夜间', '调暗'],
            ['浅色', '亮色', '日间', '白天', '调亮'],
            ['设置', '系统设置', '偏好设置']
        ];
        const enGroups = [
            ['turn up', 'increase', 'raise'],
            ['turn down', 'decrease', 'lower'],
            ['volume', 'sound', 'audio volume'],
            ['brightness', 'screen brightness'],
            ['play music', 'play songs', 'start music', 'resume music'],
            ['shuffle', 'random', 'shuffle play'],
            ['next song', 'next track', 'skip to next'],
            ['previous song', 'previous track', 'last song', 'last track'],
            ['repeat playlist', 'repeat all', 'loop playlist'],
            ['repeat one', 'single repeat', 'loop current track'],
            ['turn on', 'enable', 'open', 'start'],
            ['turn off', 'disable', 'close', 'stop'],
            ['switch to', 'change to', 'set to'],
            ['dark mode', 'dark theme'],
            ['light mode', 'light theme'],
            ['wifi', 'wi-fi', 'wireless'],
            ['bluetooth', 'bt'],
            ['wallpaper', 'background'],
            ['settings', 'setting', 'preferences'],
            ['fullscreen', 'full screen'],
            ['task view', 'multitask view', 'taskview'],
            ['snap windows', 'snap layout', 'window snapping'],
            ['control center', 'quick settings'],
            ['notification center', 'notifications'],
            ['minimize', 'shrink'],
            ['current window', 'top window', 'foreground window'],
            ['pin to taskbar', 'pin taskbar', 'taskbar pin'],
            ['unpin from taskbar', 'taskbar unpin'],
            ['reset', 'restore default'],
            ['theme and effects', 'appearance defaults']
        ];

        const applyGroups = (groups, maxRounds = 3) => {
            for (let round = 0; round < maxRounds; round++) {
                let changed = false;
                const snapshot = Array.from(variants);
                for (const phrase of snapshot) {
                    for (const group of groups) {
                        for (const token of group) {
                            if (!phrase.includes(token)) continue;
                            for (const alt of group) {
                                if (alt === token) continue;
                                const next = phrase.split(token).join(alt).trim();
                                if (!next || variants.has(next)) continue;
                                variants.add(next);
                                changed = true;
                            }
                        }
                    }
                }
                if (!changed) break;
            }
        };
        applyGroups(zhGroups, 2);
        applyGroups(enGroups, 2);

        const zhActionVerbs = ['开启', '打开', '启用', '开', '启动', '关闭', '关掉', '禁用', '停用', '关', '切换', '改成', '换成', '设为'];
        const zhSnapshot = Array.from(variants);
        for (const phrase of zhSnapshot) {
            for (const verb of zhActionVerbs) {
                if (phrase.startsWith(verb) && phrase.length > verb.length + 1) {
                    const obj = phrase.slice(verb.length).trim();
                    if (obj) variants.add(`${obj}${verb}`);
                }
            }
        }

        const enSnapshot = Array.from(variants);
        for (const phrase of enSnapshot) {
            const m = phrase.match(/^(turn on|turn off|enable|disable|open|close|start|stop|switch to|change to|set to)\s+(.+)$/);
            if (!m) continue;
            const verb = m[1];
            const obj = m[2].trim();
            if (!obj) continue;
            variants.add(`${obj} ${verb}`);
            if (verb === 'turn on' || verb === 'enable' || verb === 'open' || verb === 'start') variants.add(`${obj} on`);
            if (verb === 'turn off' || verb === 'disable' || verb === 'close' || verb === 'stop') variants.add(`${obj} off`);
        }

        const result = Array.from(variants).filter(Boolean).slice(0, 120);
        this._keywordVariantCache.set(base, result);
        return result;
    },

    _keywordMatched(lowerText, normalizedText, compactText, keyword) {
        const variants = this._getKeywordVariants(keyword);
        if (!variants.length) return false;

        for (const phrase of variants) {
            if (this._matchPhraseInText(lowerText, phrase)) return true;
            if (normalizedText && normalizedText !== lowerText && this._matchPhraseInText(normalizedText, phrase)) return true;
            const compactPhrase = this._compactText(phrase);
            if (compactPhrase && compactText.includes(compactPhrase)) return true;
            if (this._matchLoosePhrase(normalizedText, compactText, phrase)) return true;
        }
        return false;
    },

    _pickLocalizedText(payload) {
        if (typeof payload === 'string') return payload;
        if (Array.isArray(payload)) {
            if (!payload.length) return '';
            return payload[Math.floor(Math.random() * payload.length)] || '';
        }
        if (!payload || typeof payload !== 'object') return '';

        const lang = this.lang();
        const localized = payload[lang] ?? payload.zh ?? payload.en ?? '';
        if (Array.isArray(localized)) {
            if (!localized.length) return '';
            return localized[Math.floor(Math.random() * localized.length)] || '';
        }
        return typeof localized === 'string' ? localized : '';
    },

    _formatDynamicText(template) {
        if (typeof template !== 'string') return '';

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const timeText = `${hh}:${mm}`;

        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const lang = this.lang();
        const dateText = lang === 'zh'
            ? `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
            : `${now.getFullYear()}-${month}-${day}`;

        const weekZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekdayText = lang === 'zh' ? weekZh[now.getDay()] : weekEn[now.getDay()];

        return template
            .replace(/\{time\}/g, timeText)
            .replace(/\{date\}/g, dateText)
            .replace(/\{weekday\}/g, weekdayText)
            .replace(/\{datetime\}/g, `${dateText} ${timeText}`);
    },

    _resolveResponse(payload) {
        return this._formatDynamicText(this._pickLocalizedText(payload));
    },

    _extractAppNameFromText(text, keywords, langOverride = null) {
        let content = String(text || '');
        const sortedKeywords = Array.isArray(keywords)
            ? [...keywords].sort((a, b) => String(b).length - String(a).length)
            : [];

        for (const kw of sortedKeywords) {
            const idx = content.toLowerCase().indexOf(String(kw).toLowerCase());
            if (idx >= 0) {
                content = `${content.slice(0, idx)} ${content.slice(idx + String(kw).length)}`;
                break;
            }
        }

        const app = content.replace(/[.,!?，。！？]/g, ' ').trim();
        const lang = langOverride === 'en' ? 'en' : (langOverride === 'zh' ? 'zh' : this.lang());
        return app || (lang === 'zh' ? '应用' : 'app');
    },

    buildPreviewReply(rawText, options = {}) {
        const lang = options.lang === 'en' ? 'en' : (options.lang === 'zh' ? 'zh' : this.lang());
        const resolvePayload = (payload) => {
            if (!payload) return '';
            if (typeof payload === 'string') return this._formatDynamicText(payload);
            if (Array.isArray(payload)) {
                if (!payload.length) return '';
                return this._formatDynamicText(payload[Math.floor(Math.random() * payload.length)] || '');
            }
            if (typeof payload === 'object') {
                const localized = payload[lang] ?? payload.zh ?? payload.en ?? '';
                if (Array.isArray(localized)) {
                    if (!localized.length) return '';
                    return this._formatDynamicText(localized[Math.floor(Math.random() * localized.length)] || '');
                }
                if (typeof localized === 'string') return this._formatDynamicText(localized);
            }
            return '';
        };

        const text = String(rawText || '').trim();
        const fallbackText = options.fallbackText
            || resolvePayload(typeof FingoData !== 'undefined' ? FingoData.fallback : null)
            || (lang === 'zh' ? '抱歉，我暂时没听懂。' : 'Sorry, I did not understand.');
        if (!text) return fallbackText;

        const commands = (typeof FingoData !== 'undefined' && FingoData && FingoData.commands)
            ? FingoData.commands
            : null;
        if (!commands) return fallbackText;

        const blockedKeys = Array.isArray(options.blockedKeys) ? options.blockedKeys : [];
        const blockedText = options.blockedText
            || (lang === 'zh' ? '这个功能需要进入系统后才能使用。' : 'This feature requires entering the system first.');
        const onAction = typeof options.onAction === 'function' ? options.onAction : null;

        const lower = text.toLowerCase();
        const normalized = this._normalizeInputText(lower);
        const compact = this._compactText(normalized);
        const specialKeys = ['shortcutsHelp', 'uninstall', 'install', 'repair', 'wallpaper'];
        const orderedKeys = [
            ...specialKeys.filter((key) => commands[key]),
            ...Object.keys(commands).filter((key) => !specialKeys.includes(key) && key !== 'openApp'),
            ...(commands.openApp ? ['openApp'] : [])
        ];

        for (const key of orderedKeys) {
            const cmd = commands[key];
            if (!cmd || !Array.isArray(cmd.keywords)) continue;

            let matched = false;
            for (const kw of cmd.keywords) {
                if (this._keywordMatched(lower, normalized, compact, kw)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) continue;

            if (blockedKeys.includes(key)) {
                return blockedText;
            }

            if (onAction) {
                try {
                    onAction(cmd.action, { key, cmd, text });
                } catch (_) {
                    // Keep preview flow resilient.
                }
            }

            let reply = resolvePayload(cmd.response);
            if ((!reply || !reply.trim()) && key === 'openApp') {
                reply = resolvePayload(cmd.responseNotFound);
            }
            if (reply && reply.includes('{app}')) {
                const appName = this._extractAppNameFromText(text, cmd.keywords, lang);
                reply = reply.replace(/\{app\}/g, appName || (lang === 'zh' ? '应用' : 'app'));
            }
            return reply || fallbackText;
        }

        return fallbackText;
    },

    async processInput(text) {
        this._expandCard();
        this.addMessage(text, 'user');

        // Handle pending confirmations first so they are not intercepted by custom API mode.
        if (this._pendingAction) {
            if (this._pendingAction.type === 'offerQuickStart') {
                const lower = text.toLowerCase();
                const isYes = FingoData.confirmYes.some(w => lower.includes(w));
                const isNo = FingoData.confirmNo.some(w => lower.includes(w));
                if (isYes || isNo) {
                    this._handleConfirmation(text);
                    return;
                }
                // Non yes/no input means user skipped the prompt; continue with normal intent parsing.
                this._pendingAction = null;
            } else {
                this._handleConfirmation(text);
                return;
            }
        }

        // Custom mode: use selected cloud API provider.
        if (State.settings.fingoCustomMode) {
            const apiKey = typeof this.getApiKeyForRequest === 'function'
                ? await this.getApiKeyForRequest()
                : null;
            if (!apiKey) {
                const msg = this.lang() === 'zh'
                    ? 'API 错误，请检查 API Key 是否正确。请先在 SurfAi 设置中填写有效 Key。'
                    : 'API error, please check your API Key. Set a valid key in SurfAi settings first.';
                setTimeout(() => this.addMessage(msg, 'bot'), 260);
                return;
            }
            await this._callApi(text, apiKey);
            return;
        }

        // 处理待确认操作
        if (this._pendingAction) {
            if (this._pendingAction.type === 'offerQuickStart') {
                const lower = text.toLowerCase();
                const isYes = FingoData.confirmYes.some(w => lower.includes(w));
                const isNo = FingoData.confirmNo.some(w => lower.includes(w));
                if (isYes || isNo) {
                    this._handleConfirmation(text);
                    return;
                }
                this._pendingAction = null;
            } else {
                this._handleConfirmation(text);
                return;
            }
        }

        // 默认模式：关键词匹配（特殊命令优先）
        const lower = text.toLowerCase();
        const normalized = this._normalizeInputText(lower);
        const compact = this._compactText(normalized);
        const cmds = FingoData.commands;
        const specialKeys = ['shortcutsHelp', 'uninstall', 'install', 'repair', 'wallpaper'];
        for (const sk of specialKeys) {
            if (!cmds[sk]) continue;
            for (const kw of cmds[sk].keywords) {
                if (this._keywordMatched(lower, normalized, compact, kw)) {
                    this['_handle_' + sk](text, lower);
                    return;
                }
            }
        }
        for (const key of Object.keys(cmds)) {
            if (specialKeys.includes(key) || key === 'openApp') continue;
            const cmd = cmds[key];
            for (const kw of cmd.keywords) {
                if (this._keywordMatched(lower, normalized, compact, kw)) {
                    const handler = this['_handle_' + key];
                    if (typeof handler === 'function') {
                        handler.call(this, text, lower);
                        return;
                    }
                    this._executeAction(cmd.action);
                    const botReply = this._resolveResponse(cmd.response);
                    if (botReply) {
                        setTimeout(() => this.addMessage(botReply, 'bot'), 400);
                    }
                    return;
                }
            }
        }
        if (cmds.openApp) {
            for (const kw of cmds.openApp.keywords) {
                if (this._keywordMatched(lower, normalized, compact, kw)) {
                    this._handle_openApp(text, lower);
                    return;
                }
            }
        }
        // WebLLM - 真正的本地大语言模型（Gemma）
        if (this._webllmReady && this._webllmEngine) {
            await this._callWebLLM(text);
            return;
        }

        // Enhanced local AI model - SurfAi Local (规则引擎 fallback)
        const localReply = this._handleLocalAI(text, lower);
        if (localReply) {
            setTimeout(() => this.addMessage(localReply, 'bot'), 300);
            return;
        }

        const fallbackText = this._resolveResponse(FingoData.fallback) || (this.lang() === 'zh' ? '抱歉，我暂时没听懂。' : 'Sorry, I did not understand.');
        setTimeout(() => this.addMessage(fallbackText, 'bot'), 400);
    },

    // --- 快捷键汇总/开始菜单快捷键 ---
    '_handle_shortcutsHelp'() {
        const cmd = FingoData.commands.shortcutsHelp;
        if (!cmd) return;
        const botReply = this._resolveResponse(cmd.response);
        if (botReply) {
            setTimeout(() => this.addMessage(botReply, 'bot'), 400);
        }
    },

    // --- 查找应用（从用户输入中匹配） ---
    _findApp(lower) {
        for (const app of Desktop.apps) {
            const name = (Desktop.getAppName(app) || '').toLowerCase();
            if (name && lower.includes(name)) return app;
            if (lower.includes(app.id)) return app;
        }
        return null;
    },

    _isAppRunning(appId) {
        return typeof WindowManager !== 'undefined' && WindowManager.windows.some(w => w.appId === appId);
    },

    _forceCloseApp(appId) {
        if (typeof WindowManager === 'undefined') return;
        WindowManager.windows.filter(w => w.appId === appId).forEach(w => WindowManager.closeWindow(w.id));
    },

    _isGuideQuestion(text) {
        const normalized = this._normalizeInputText(String(text || '').toLowerCase());
        return /(怎么|如何|怎样|教程|步骤|能不能|可以吗|help|guide|how to|how do i|can i)/.test(normalized);
    },

    _isDocumentFullscreen() {
        return !!(
            document.fullscreenElement
            || document.webkitFullscreenElement
            || document.mozFullScreenElement
            || document.msFullscreenElement
        );
    },

    _enterDocumentFullscreen() {
        if (this._isDocumentFullscreen()) return;
        const root = document.documentElement;
        if (!root) return;
        const request =
            root.requestFullscreen
            || root.webkitRequestFullscreen
            || root.mozRequestFullScreen
            || root.msRequestFullscreen;
        if (typeof request !== 'function') return;
        try {
            const ret = request.call(root);
            if (ret && typeof ret.catch === 'function') {
                ret.catch(() => {});
            }
        } catch (_) {
            // Ignore fullscreen enter failures.
        }
    },

    _exitDocumentFullscreen() {
        if (!this._isDocumentFullscreen()) return;
        const exit =
            document.exitFullscreen
            || document.webkitExitFullscreen
            || document.mozCancelFullScreen
            || document.msExitFullscreen;
        if (typeof exit !== 'function') return;
        try {
            const ret = exit.call(document);
            if (ret && typeof ret.catch === 'function') {
                ret.catch(() => {});
            }
        } catch (_) {
            // Ignore fullscreen exit failures.
        }
    },

    // --- 确认流程 ---
    _handleConfirmation(text) {
        const lower = text.toLowerCase();
        const pa = this._pendingAction;
        const isYes = FingoData.confirmYes.some(w => lower.includes(w));
        const isNo = FingoData.confirmNo.some(w => lower.includes(w));
        if (!isYes && !isNo) {
            setTimeout(() => this.addMessage(this.lang() === 'zh' ? '请回答「是」或「否」' : 'Please answer "yes" or "no"', 'bot'), 300);
            return;
        }

        if (pa && pa.type === 'offerQuickStart') {
            this._pendingAction = null;
            if (isYes) {
                setTimeout(() => this.addMessage(this.lang() === 'zh'
                    ? '太好了，给你一份超快上手指南：\n1. 按 Alt 打开开始菜单\n2. 按 Alt+I 打开设置\n3. 按 Alt+W 打开任务视图\n4. 想固定应用到任务栏：在开始菜单中右键应用，选「固定到任务栏」\n\n你也可以直接问我：「怎么分屏」「怎么切换语言」「怎么安装应用」。'
                    : 'Great. Here is a quick-start guide:\n1. Press Alt to open Start Menu\n2. Press Alt+I to open Settings\n3. Press Alt+W to open Task View\n4. To pin an app: right-click it in Start Menu, then choose "Pin to taskbar"\n\nYou can also ask me directly: "how to snap windows", "how to change language", or "how to install apps".', 'bot'), 300);
            } else {
                setTimeout(() => this.addMessage(this.lang() === 'zh'
                    ? '好的，不打扰你啦。需要时随时说「新手教程」或「帮助」。'
                    : 'No problem. Say "quick start" or "help" whenever you need it.', 'bot'), 300);
            }
            return;
        }

        this._pendingAction = null;
        if (isNo) {
            setTimeout(() => this.addMessage(this.lang() === 'zh' ? '好的，已取消操作 ✋' : 'OK, operation cancelled ✋', 'bot'), 300);
            return;
        }
        // 用户确认
        if (pa.type === 'disableAutoFullscreen') {
            State.updateSettings({ autoEnterFullscreen: false });
            this._exitDocumentFullscreen();
            setTimeout(() => this.addMessage(this.lang() === 'zh'
                ? '已关闭开机自动网页全屏。'
                : 'Auto web fullscreen on boot is now disabled.', 'bot'), 300);
            return;
        }
        if (pa.type === 'installAndOpen') {
            this._doInstallAndOpen(pa.shopApp);
        } else {
            this._forceCloseApp(pa.app.id);
            setTimeout(() => {
                if (pa.type === 'uninstall') this._doUninstall(pa.app, pa.appName);
                else if (pa.type === 'repair') this._doRepair(pa.app, pa.appName);
            }, 350);
        }
    },

    // --- 打开应用 ---
    '_handle_openApp'(_text, lower) {
        const lang = this.lang();
        const cmd = FingoData.commands.openApp;
        // 1. 已安装的应用（Desktop.apps）
        const installed = this._findApp(lower);
        if (installed) {
            const name = Desktop.getAppName(installed);
            if (typeof SettingsApp !== 'undefined' && SettingsApp.isAppRepairing(installed.id)) {
                setTimeout(() => this.addMessage(
                    lang === 'zh'
                        ? `${name} 正在修复中，请等待修复完成后再打开。`
                        : `${name} is being repaired. Please wait until the repair is complete.`,
                    'bot'
                ), 300);
                return;
            }
            setTimeout(() => {
                WindowManager.openApp(installed.id);
                this._ensurePanelForeground();
            }, 400);
            setTimeout(() => this.addMessage(cmd.response[lang].replace('{app}', name), 'bot'), 400);
            return;
        }
        // 2. AppShop 中未安装的应用
        if (typeof AppShop !== 'undefined') {
            for (const sa of AppShop.apps) {
                if (lower.includes(sa.name.toLowerCase()) || lower.includes(sa.id)) {
                    this._pendingAction = { type: 'installAndOpen', shopApp: sa };
                    setTimeout(() => this.addMessage(cmd.responseAskInstall[lang].replace('{app}', sa.name), 'bot'), 400);
                    return;
                }
            }
        }
        // 3. 找不到
        setTimeout(() => this.addMessage(cmd.responseNotFound[lang], 'bot'), 400);
    },

    _doInstallAndOpen(shopApp) {
        const lang = this.lang();
        Desktop.apps.push({ id: shopApp.id, name: shopApp.name, icon: `Theme/Icon/App_icon/${shopApp.icon}`, isPWA: true, url: shopApp.url, openMode: shopApp.openMode });
        const installed = State.settings.installedApps || [];
        installed.push(shopApp.id);
        State.updateSettings({ installedApps: installed });
        Desktop.renderIcons();
        if (typeof StartMenu !== 'undefined') StartMenu.renderApps();
        if (typeof AppShop !== 'undefined' && AppShop.ensurePWARegistered) {
            AppShop.ensurePWARegistered(shopApp);
            const savedApps = AppShop.getInstalledApps();
            if (!savedApps.some(app => app.id === shopApp.id)) {
                savedApps.push({
                    id: shopApp.id,
                    name: shopApp.name,
                    icon: AppShop.getIconPath(shopApp.icon),
                    url: shopApp.url,
                    openMode: shopApp.openMode,
                    scriptLoaded: true,
                    installedAt: new Date().toISOString()
                });
                AppShop.saveInstalledApps(savedApps);
            }
        }
        setTimeout(() => {
            WindowManager.openApp(shopApp.id);
            this._ensurePanelForeground();
        }, 600);
        setTimeout(() => this.addMessage(lang === 'zh' ? `${shopApp.name} 已安装并打开 ✅` : `${shopApp.name} installed and opened ✅`, 'bot'), 400);
    },

    // --- 卸载 ---
    '_handle_uninstall'(text, lower) {
        const lang = this.lang();
        const app = this._findApp(lower);
        if (!app) {
            if (this._isGuideQuestion(text)) {
                setTimeout(() => this.addMessage(
                    lang === 'zh'
                        ? '如果你是问怎么卸载应用：\n1. 打开设置（Alt+I）→ 应用\n2. 找到目标 App 并点卸载\n3. 也可以直接对我说「卸载 + 应用名」'
                        : 'If you are asking how to uninstall an app:\n1. Open Settings (Alt+I) → Applications\n2. Find the target app and click uninstall\n3. Or tell me directly: "uninstall + app name"',
                    'bot'
                ), 400);
                return;
            }
            setTimeout(() => this.addMessage(lang === 'zh' ? '请告诉我你要卸载哪个应用，例如「卸载天气」' : 'Which app? e.g. "uninstall weather"', 'bot'), 400);
            return;
        }
        const appName = Desktop.getAppName(app);
        if (FingoData.systemApps.includes(app.id)) {
            setTimeout(() => this.addMessage(FingoData.commands.uninstall.responseFail[lang].replace('{app}', appName), 'bot'), 400);
            return;
        }
        if (this._isAppRunning(app.id)) {
            this._pendingAction = { type: 'uninstall', app, appName };
            setTimeout(() => this.addMessage(lang === 'zh' ? `${appName} 正在运行中，是否关闭并继续卸载？（是/否）` : `${appName}is running. Close it and uninstall? (yes/no)`, 'bot'), 400);
            return;
        }
        this._doUninstall(app, appName);
    },

    _doUninstall(app, appName) {
        const lang = this.lang();
        // 从 installedApps 移除
        const installed = State.settings.installedApps || [];
        State.updateSettings({ installedApps: installed.filter(id => id !== app.id) });
        Desktop.apps = Desktop.apps.filter(a => a.id !== app.id);
        Desktop.renderIcons();
        if (typeof PWALoader !== 'undefined' && PWALoader.unregister) PWALoader.unregister(app.id);
        if (typeof Taskbar !== 'undefined') {
            const pinned = State.settings.pinnedApps || [];
            if (pinned.includes(app.id)) Taskbar.unpinApp(app.id);
            Taskbar.renderApps();
        }
        const startPinned = State.settings.startPinnedApps || [];
        if (startPinned.includes(app.id)) {
            State.updateSettings({ startPinnedApps: startPinned.filter(id => id !== app.id) });
        }
        if (typeof StartMenu !== 'undefined') StartMenu.renderApps();
        setTimeout(() => this.addMessage(FingoData.commands.uninstall.response[lang].replace('{app}', appName), 'bot'), 400);
    },

    // --- 安装 ---
    '_handle_install'(text, lower) {
        const lang = this.lang();
        if (typeof AppShop === 'undefined') {
            setTimeout(() => this.addMessage(lang === 'zh' ? 'App Shop 未加载' : 'App Shop not loaded', 'bot'), 400);
            return;
        }
        // 在 AppShop 目录中查找
        let found = null;
        for (const shopApp of AppShop.apps) {
            if (lower.includes(shopApp.name.toLowerCase()) || lower.includes(shopApp.id)) { found = shopApp; break; }
        }
        if (!found) {
            if (this._isGuideQuestion(text)) {
                setTimeout(() => this.addMessage(
                    lang === 'zh'
                        ? '如果你是问怎么安装应用：\n1. 打开 App Shop\n2. 选择想安装的应用并点击安装\n3. 也可以直接对我说「安装 + 应用名」\n\n需要的话我也可以现在帮你打开 App Shop。'
                        : 'If you are asking how to install apps:\n1. Open App Shop\n2. Select an app and click install\n3. Or tell me directly: "install + app name"\n\nI can also open App Shop for you now.',
                    'bot'
                ), 400);
                return;
            }
            setTimeout(() => this.addMessage(lang === 'zh' ? '⚠️ 该应用还未上架 App Shop，暂时无法安装。\n你可以打开 App Shop 浏览可用应用。' : '⚠️ This app is not available in App Shop yet.\nOpen App Shop to browse available apps.', 'bot'), 400);
            return;
        }
        // 检查是否已安装
        if (Desktop.apps.find(a => a.id === found.id)) {
            setTimeout(() => this.addMessage(lang === 'zh' ? `${found.name}已经安装了 ✅` : `${found.name}is already installed ✅`, 'bot'), 400);
            return;
        }
        // 执行安装
        Desktop.apps.push({ id: found.id, name: found.name, icon: `Theme/Icon/App_icon/${found.icon}`, isPWA: true, url: found.url, openMode: found.openMode });
        const installed = State.settings.installedApps || [];
        installed.push(found.id);
        State.updateSettings({ installedApps: installed });
        Desktop.renderIcons();
        if (typeof StartMenu !== 'undefined') StartMenu.renderApps();
        if (typeof AppShop !== 'undefined' && AppShop.ensurePWARegistered) {
            AppShop.ensurePWARegistered(found);
            const savedApps = AppShop.getInstalledApps();
            if (!savedApps.some(app => app.id === found.id)) {
                savedApps.push({
                    id: found.id,
                    name: found.name,
                    icon: AppShop.getIconPath(found.icon),
                    url: found.url,
                    openMode: found.openMode,
                    scriptLoaded: true,
                    installedAt: new Date().toISOString()
                });
                AppShop.saveInstalledApps(savedApps);
            }
        }
        setTimeout(() => this.addMessage(lang === 'zh' ? `${found.name} 安装成功 ✅` : `${found.name}installed successfully ✅`, 'bot'), 400);
    },

    // --- 修复 ---
    '_handle_repair'(_text, lower) {
        const lang = this.lang();
        const app = this._findApp(lower);
        if (!app) {
            setTimeout(() => this.addMessage(lang === 'zh' ? '请告诉我你要修复哪个应用，例如「修复浏览器」' : 'Which app? e.g. "repair browser"', 'bot'), 400);
            return;
        }
        const appName = Desktop.getAppName(app);
        if (this._isAppRunning(app.id)) {
            this._pendingAction = { type: 'repair', app, appName };
            setTimeout(() => this.addMessage(lang === 'zh' ? `${appName} 正在运行中，是否关闭并继续修复？（是/否）` : `${appName}is running. Close it and repair? (yes/no)`, 'bot'), 400);
            return;
        }
        this._doRepair(app, appName);
    },

    _doRepair(app, appName) {
        const lang = this.lang();
        if (typeof SettingsApp !== 'undefined' && SettingsApp.repairApp) {
            SettingsApp.repairApp({ id: app.id, name: appName });
        }
        setTimeout(() => this.addMessage(FingoData.commands.repair.response[lang].replace('{app}', appName), 'bot'), 400);
    },

    // --- 壁纸 ---
    async '_handle_wallpaper'() {
        const lang = this.lang();
        setTimeout(() => this.addMessage(FingoData.commands.wallpaper.response[lang], 'bot'), 300);
        try {
            const res = await fetch('https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN');
            const data = await res.json();
            if (data && data.url) {
                await State.setWallpaper('desktop', data.url, { sourceType: 'bing', sourceUrl: data.url });
                if (typeof Desktop !== 'undefined') await Desktop.updateWallpaper();
                setTimeout(() => this.addMessage(lang === 'zh' ? '壁纸已更换 🖼️\n想要更多精彩壁纸？试试打开「照片」应用吧！' : 'Wallpaper changed 🖼️\nWant more? Try the Photos app!', 'bot'), 1200);
            } else { throw new Error('No URL'); }
        } catch (e) {
            setTimeout(() => this.addMessage(lang === 'zh' ? '获取壁纸失败，请稍后再试 😥' : 'Failed to fetch wallpaper, try again later 😥', 'bot'), 1200);
        }
    },

    _extractPercentValue(text) {
        const raw = String(text || '').toLowerCase();
        const percentMatch = raw.match(/(?:百分之|percent|percentage|音量|声音|亮度|volume|sound|brightness|level|到|为|设为|调到|调成|set(?:\s+to)?|change(?:\s+to)?|make(?:\s+it)?|turn(?:\s+to)?)\s*(\d{1,3})(?:\s*%|\s*percent)?/i)
            || raw.match(/(\d{1,3})\s*(?:%|percent|音量|声音|亮度|volume|sound|brightness)?/i);
        if (percentMatch) {
            const value = Number(percentMatch[1]);
            if (Number.isFinite(value)) return Math.min(100, Math.max(0, Math.round(value)));
        }

        const zhDigits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const parseZhNumber = (input) => {
            const s = String(input || '');
            if (!s) return null;
            if (s === '十') return 10;
            const tenIndex = s.indexOf('十');
            if (tenIndex >= 0) {
                const left = s.slice(0, tenIndex);
                const right = s.slice(tenIndex + 1);
                const tens = left ? zhDigits[left] : 1;
                const ones = right ? zhDigits[right] : 0;
                if (Number.isFinite(tens) && Number.isFinite(ones)) return tens * 10 + ones;
            }
            if (s.length === 1 && Number.isFinite(zhDigits[s])) return zhDigits[s];
            return null;
        };

        const zhMatch = raw.match(/(?:百分之|音量|声音|亮度|到|为|设为|调到|调成)\s*([零一二两三四五六七八九十]{1,3})/);
        if (zhMatch) {
            const value = parseZhNumber(zhMatch[1]);
            if (Number.isFinite(value)) return Math.min(100, Math.max(0, value));
        }
        return null;
    },

    _syncControlCenterSliders() {
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        if (volumeSlider && volumeValue) {
            volumeSlider.value = State.settings.volume ?? 50;
            volumeValue.textContent = State.settings.volume ?? 50;
        }
        const brightnessSlider = document.getElementById('brightness-slider');
        const brightnessValue = document.getElementById('brightness-value');
        if (brightnessSlider && brightnessValue) {
            brightnessSlider.value = State.settings.brightness ?? 100;
            brightnessValue.textContent = State.settings.brightness ?? 100;
        }
        if (typeof ControlCenter !== 'undefined' && typeof ControlCenter.updateTiles === 'function') {
            try {
                ControlCenter.updateTiles();
            } catch (_) {
                // Control center UI may not be mounted while SurfAi is running.
            }
        }
    },

    _setSystemVolume(value) {
        const next = Math.min(100, Math.max(0, Math.round(Number(value))));
        State.updateSettings({ volume: next });
        this._syncControlCenterSliders();
        return next;
    },

    _changeSystemVolume(delta) {
        const current = Number(State.settings.volume ?? 50);
        return this._setSystemVolume(current + delta);
    },

    _setSystemBrightness(value) {
        const next = Math.min(100, Math.max(20, Math.round(Number(value))));
        State.updateSettings({ brightness: next });
        this._syncControlCenterSliders();
        return next;
    },

    _changeSystemBrightness(delta) {
        const current = Number(State.settings.brightness ?? 100);
        return this._setSystemBrightness(current + delta);
    },

    _replyLater(message, delay = 300) {
        setTimeout(() => this.addMessage(message, 'bot'), delay);
    },

    _replyControlValue(kind, value) {
        const lang = this.lang();
        const label = kind === 'brightness'
            ? (lang === 'zh' ? '亮度' : 'Brightness')
            : (lang === 'zh' ? '音量' : 'Volume');
        this._replyLater(lang === 'zh' ? `${label}已调到 ${value}%` : `${label} set to ${value}%`);
    },

    '_handle_volumeUp'() {
        this._replyControlValue('volume', this._changeSystemVolume(10));
    },

    '_handle_volumeDown'() {
        this._replyControlValue('volume', this._changeSystemVolume(-10));
    },

    '_handle_volumeSet'(text) {
        const value = this._extractPercentValue(text);
        if (value === null) {
            this._replyLater(this.lang() === 'zh' ? '请告诉我要把音量调到多少，比如“音量 50”。' : 'Tell me the target volume, for example "volume 50".');
            return;
        }
        this._replyControlValue('volume', this._setSystemVolume(value));
    },

    '_handle_volumeMute'() {
        this._replyControlValue('volume', this._setSystemVolume(0));
    },

    '_handle_volumeUnmute'() {
        const lastMediaVolume = typeof MediaApp !== 'undefined' && MediaApp.lastNonZeroVolume
            ? Math.round(MediaApp.lastNonZeroVolume * 100)
            : 50;
        const value = Math.max(30, Number(State.settings.volume) || lastMediaVolume);
        this._replyControlValue('volume', this._setSystemVolume(value));
    },

    '_handle_brightnessUp'() {
        this._replyControlValue('brightness', this._changeSystemBrightness(10));
    },

    '_handle_brightnessDown'() {
        this._replyControlValue('brightness', this._changeSystemBrightness(-10));
    },

    '_handle_brightnessSet'(text) {
        const value = this._extractPercentValue(text);
        if (value === null) {
            this._replyLater(this.lang() === 'zh' ? '请告诉我要把亮度调到多少，比如“亮度 70”。' : 'Tell me the target brightness, for example "brightness 70".');
            return;
        }
        this._replyControlValue('brightness', this._setSystemBrightness(value));
    },

    _ensureMediaReady(callback, attempt = 0) {
        if (typeof MediaApp === 'undefined') {
            callback(false);
            return;
        }
        if (!MediaApp.container && typeof WindowManager !== 'undefined') {
            WindowManager.openApp('media');
        }
        const ready = MediaApp.container && Array.isArray(MediaApp.library) && MediaApp.library.length > 0;
        if (ready) {
            callback(true);
            return;
        }
        if (attempt < 16) {
            setTimeout(() => this._ensureMediaReady(callback, attempt + 1), 160);
            return;
        }
        callback(false);
    },

    _replyMediaResult(action) {
        this._ensureMediaReady((ok) => {
            if (!ok) {
                this._replyLater(this.lang() === 'zh'
                    ? '媒体库里还没有可播放的音乐，请先在多媒体 App 导入歌曲。'
                    : 'There is no playable music in the media library. Import songs in Multimedia first.');
                return;
            }
            action();
        });
    },

    '_handle_mediaPlay'() {
        this._replyMediaResult(() => {
            MediaApp.isShuffle = false;
            MediaApp.togglePlay(true);
            this._replyLater(this.lang() === 'zh' ? '正在播放音乐。' : 'Playing music.');
        });
    },

    '_handle_mediaShufflePlay'() {
        this._replyMediaResult(() => {
            MediaApp.isShuffle = true;
            MediaApp.playNext();
            this._replyLater(this.lang() === 'zh' ? '已开启随机播放。' : 'Shuffle play is on.');
        });
    },

    '_handle_mediaNext'() {
        this._replyMediaResult(() => {
            MediaApp.playNext();
            this._replyLater(this.lang() === 'zh' ? '正在播放下一首。' : 'Playing the next track.');
        });
    },

    '_handle_mediaPrevious'() {
        this._replyMediaResult(() => {
            MediaApp.playPrevious();
            this._replyLater(this.lang() === 'zh' ? '正在播放上一首。' : 'Playing the previous track.');
        });
    },

    '_handle_mediaRepeatAll'() {
        this._replyMediaResult(() => {
            MediaApp.repeatMode = 'all';
            if (typeof MediaApp.render === 'function') MediaApp.render();
            this._replyLater(this.lang() === 'zh' ? '已开启列表循环播放。' : 'Playlist repeat is on.');
        });
    },

    '_handle_mediaRepeatOneOff'() {
        this._replyMediaResult(() => {
            MediaApp.repeatMode = 'none';
            if (typeof MediaApp.render === 'function') MediaApp.render();
            this._replyLater(this.lang() === 'zh' ? '已退出单曲循环。' : 'Single-track repeat is off.');
        });
    },

    '_handle_mediaRepeatOne'() {
        this._replyMediaResult(() => {
            MediaApp.repeatMode = 'one';
            if (typeof MediaApp.render === 'function') MediaApp.render();
            this._replyLater(this.lang() === 'zh' ? '已开启单曲循环。' : 'Single-track repeat is on.');
        });
    },

    '_handle_mediaRepeatOff'() {
        this._replyMediaResult(() => {
            MediaApp.repeatMode = 'none';
            if (typeof MediaApp.render === 'function') MediaApp.render();
            this._replyLater(this.lang() === 'zh' ? '已关闭循环播放。' : 'Repeat is off.');
        });
    },

    _executeAction(action) {
        if (action === 'none' || action === 'suggestCustom') return;
        const [type, value] = action.split(':');
        switch (type) {
            case 'offerQuickStart':
                this._pendingAction = { type: 'offerQuickStart' };
                break;
            case 'setTheme': State.updateSettings({ theme: value }); break;
            case 'setBlur': State.updateSettings({ enableBlur: value === 'true' }); break;
            case 'setAnimation': State.updateSettings({ enableAnimation: value === 'true' }); break;
            case 'setWindowBlur': State.updateSettings({ enableWindowBlur: value === 'true' }); break;
            case 'setNyouV2': State.updateSettings({ enableNyouV2: true }); break;
            case 'setAutoFullscreen':
                State.updateSettings({ autoEnterFullscreen: value === 'true' });
                if (value !== 'true') {
                    this._exitDocumentFullscreen();
                }
                break;
            case 'setDocumentFullscreen':
                if (value === 'true') this._enterDocumentFullscreen();
                else this._exitDocumentFullscreen();
                break;
            case 'resetAppearanceDefaults':
                State.updateSettings({
                    theme: 'light',
                    enableBlur: true,
                    enableAnimation: true,
                    enableWindowBlur: false,
                    enableNyouV2: true
                });
                break;
            case 'confirmAutoFullscreen':
                if (value === 'disable') {
                    this._pendingAction = { type: 'disableAutoFullscreen' };
                }
                break;
            case 'taskView':
                if (typeof TaskView !== 'undefined') {
                    if (value === 'open') {
                        if (!TaskView.isOpen) {
                            if (typeof TaskView.open === 'function') TaskView.open();
                            else if (typeof TaskView.toggle === 'function') TaskView.toggle();
                        }
                    } else if (value === 'close') {
                        if (TaskView.isOpen) {
                            if (typeof TaskView.close === 'function') TaskView.close();
                            else if (typeof TaskView.toggle === 'function') TaskView.toggle();
                        }
                    } else if (typeof TaskView.toggle === 'function') {
                        TaskView.toggle();
                    }
                }
                break;
            case 'panel':
                if (value === 'control' && typeof ControlCenter !== 'undefined') {
                    if (typeof ControlCenter.open === 'function') ControlCenter.open();
                    else if (typeof ControlCenter.toggle === 'function') ControlCenter.toggle();
                } else if (value === 'notification' && typeof NotificationCenter !== 'undefined') {
                    if (typeof NotificationCenter.open === 'function') NotificationCenter.open();
                    else if (typeof NotificationCenter.toggle === 'function') NotificationCenter.toggle();
                }
                break;
            case 'window':
                if (value === 'minimizeAll') {
                    if (typeof minimizeAllDesktopWindows === 'function') {
                        minimizeAllDesktopWindows();
                    } else if (typeof WindowManager !== 'undefined' && Array.isArray(WindowManager.windows) && typeof WindowManager.minimizeWindow === 'function') {
                        WindowManager.windows
                            .filter(w => w && !w.isMinimized && w.element && w.element.style.display !== 'none')
                            .sort((a, b) => (Number(b.element.style.zIndex) || 0) - (Number(a.element.style.zIndex) || 0))
                            .forEach((w) => WindowManager.minimizeWindow(w.id));
                    }
                } else if (value === 'minimizeTop') {
                    if (typeof minimizeTopDesktopWindow === 'function') {
                        minimizeTopDesktopWindow();
                    } else if (typeof WindowManager !== 'undefined' && Array.isArray(WindowManager.windows) && typeof WindowManager.minimizeWindow === 'function') {
                        const top = WindowManager.windows
                            .filter(w => w && !w.isMinimized && w.element && w.element.style.display !== 'none')
                            .sort((a, b) => (Number(b.element.style.zIndex) || 0) - (Number(a.element.style.zIndex) || 0))[0];
                        if (top) WindowManager.minimizeWindow(top.id);
                    }
                }
                break;
            case 'setBluetooth':
                State.updateSettings({ bluetoothEnabled: value === 'true' });
                if (typeof ControlCenter !== 'undefined') ControlCenter.updateTiles();
                break;
            case 'setWifi': {
                const wifiTile = document.getElementById('wifi-tile');
                if (wifiTile) {
                    wifiTile.dataset.active = value;
                    const sub = wifiTile.querySelector('.tile-subtitle');
                    if (sub) sub.textContent = value === 'true' ? t('control.wifi.connected') : t('control.wifi.disconnected');
                }
                break;
            }
            case 'brightness': {
                let b = State.settings.brightness || 100;
                b = value === 'up' ? Math.min(100, b + 10) : Math.max(20, b - 10);
                State.updateSettings({ brightness: b });
                this._syncControlCenterSliders();
                break;
            }
            case 'power':
                this.hide('manual');
                setTimeout(() => {
                    if (value === 'shutdown') State.shutdown();
                    else if (value === 'restart') State.restart();
                    else if (value === 'logout') State.logout();
                    else if (value === 'lock') State.lock();
                }, 600);
                break;
            case 'openApp':
                setTimeout(() => {
                    WindowManager.openApp(value);
                    this._ensurePanelForeground();
                }, 400);
                break;
            case 'openSettings':
                setTimeout(() => {
                    WindowManager.openApp('settings');
                    this._ensurePanelForeground();
                    setTimeout(() => {
                        if (typeof SettingsApp !== 'undefined') {
                            SettingsApp.currentPage = value;
                            SettingsApp.render();
                        }
                    }, 500);
                }, 400);
                break;
        }
    },

    _buildCustomApiPayload(text, options = {}) {
        const provider = options.provider || State.settings.fingoProvider || 'openai';
        const historyLimit = Number.isFinite(Number(options.historyLimit)) ? Math.max(0, Number(options.historyLimit)) : 10;
        const history = Array.isArray(options.history)
            ? options.history
                .map((m) => ({
                    role: m && m.role === 'assistant' ? 'assistant' : 'user',
                    content: String(m?.content ?? '').trim()
                }))
                .filter((m) => m.content)
                .slice(-historyLimit)
            : [];

        const systemPrompt = options.systemPrompt
            || 'You are SurfAi, a helpful assistant built into NyouOS. Reply concisely. If user asks about shortcuts, provide this mapping: Alt opens Start Menu; Alt+F SurfAi; Alt+I Settings; Alt+L lock screen; Alt+E Files; Alt+A Control Center; Ctrl+A select all files/icons in Desktop or Files; Alt+D minimize all windows; Alt+M minimize topmost window; Alt+W Task View. If user asks about fullscreen, ask whether to disable "Auto Web Fullscreen On Boot" and wait for yes/no confirmation. If user asks what languages you support, say you currently support Chinese and English and are learning more languages. On greeting, proactively offer a quick-start guide and ask yes/no.';
        const userMessage = { role: 'user', content: String(text || '').trim() };
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            userMessage
        ];

        if (provider === 'agnes') {
            return {
                provider,
                url: 'https://apihub.agnes-ai.com/v1/chat/completions',
                body: {
                    model: 'agnes-2.0-flash',
                    messages,
                    max_tokens: 1024
                }
            };
        }

        if (provider === 'siliconflow') {
            return {
                provider,
                url: 'https://api.siliconflow.cn/v1/chat/completions',
                body: {
                    model: 'deepseek-ai/DeepSeek-V3',
                    messages,
                    max_tokens: 1024
                }
            };
        }

        return {
            provider: 'openai',
            url: 'https://api.openai.com/v1/chat/completions',
            body: {
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 1024
            }
        };
    },

    async requestCustomApiReply(text, apiKey, options = {}) {
        const input = String(text || '').trim();
        if (!input) return '';

        const token = String(apiKey || '').trim();
        const lang = options.lang === 'zh' ? 'zh' : 'en';
        if (!token) {
            throw new Error(lang === 'zh' ? 'API Key 未设置。' : 'API Key is not set.');
        }

        const { url, body } = this._buildCustomApiPayload(input, options);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        let data = null;
        try {
            data = await res.json();
        } catch (_) {
            data = null;
        }
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

        const reply = data?.choices?.[0]?.message?.content;
        if (typeof reply === 'string' && reply.trim()) return reply.trim();
        return lang === 'zh' ? '未收到回复。' : 'No response.';
    },

    async _callApi(text, apiKey) {
        const provider = State.settings.fingoProvider || 'openai';
        const lang = this.lang();

        // 构建消息历史（最近10条）
        const conv = this.conversations.find(c => c.id === this.currentId);
        const msgs = (conv?.messages || []).slice(-10).map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.text
        }));
        msgs.push({ role: 'user', content: text });

        const sysMsg = {
            role: 'system',
            content: 'You are SurfAi, a helpful assistant built into NyouOS. Reply concisely. If user asks about shortcuts, provide this mapping: Alt opens Start Menu; Alt+F SurfAi; Alt+I Settings; Alt+L lock screen; Alt+E Files; Alt+A Control Center; Ctrl+A select all files/icons in Desktop or Files; Alt+D minimize all windows; Alt+M minimize topmost window; Alt+W Task View. If user asks about fullscreen, ask whether to disable "Auto Web Fullscreen On Boot" and wait for yes/no confirmation. If user asks what languages you support, say you currently support Chinese and English and are learning more languages. On greeting, proactively offer a quick-start guide and ask yes/no.'
        };

        let url, body, headers;
        if (provider === 'agnes') {
            url = 'https://apihub.agnes-ai.com/v1/chat/completions';
            body = { model: 'agnes-2.0-flash', messages: [sysMsg, ...msgs], max_tokens: 1024 };
        } else if (provider === 'siliconflow') {
            url = 'https://api.siliconflow.cn/v1/chat/completions';
            body = { model: 'deepseek-ai/DeepSeek-V3', messages: [sysMsg, ...msgs], max_tokens: 1024 };
        }else {
            url = 'https://api.openai.com/v1/chat/completions';
            body = { model: 'gpt-4o-mini', messages: [sysMsg, ...msgs], max_tokens: 1024 };
        }
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };

        // 显示加载占位
        const loadingMsg = this.addMessage(lang === 'zh' ? '思考中...' : 'Thinking...', 'bot');

        const _updateReply = (txt) => {
            if (loadingMsg) {
                const textEl = loadingMsg.querySelector('.fingo-msg-text');
                if (textEl) {
                    textEl.textContent = '';
                    txt.split('\n').forEach((line, i) => {
                        if (i > 0) textEl.appendChild(document.createElement('br'));
                        textEl.appendChild(document.createTextNode(line));
                    });
                }
            }
            // 更新 localStorage 中保存的最后一条 bot 消息
            const c = this.conversations.find(x => x.id === this.currentId);
            if (c && c.messages.length) { c.messages[c.messages.length - 1].text = txt; this._saveConversations(); }
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
            _updateReply(data.choices?.[0]?.message?.content || (lang === 'zh' ? '未收到回复' : 'No response'));
        } catch (e) {
            const errMsg = e.name === 'AbortError'
                ? (lang === 'zh' ? '请求超时（30秒），请检查网络或 API 端点。' : 'Request timeout (30s), check network or API endpoint.')
                : e.message;
            console.error('[SurfAi] API call failed:', { url, provider, error: e });
            _updateReply(lang === 'zh' ? `API 错误：${errMsg}\n（端点：${url}）` : `API error: ${errMsg}\n(endpoint: ${url})`);
        }
    },

    // ========== WebLLM - 真正的本地大语言模型 (Gemma) ==========
    _webllmEngine: null,
    _webllmLoading: false,
    _webllmReady: false,
    _webllmModel: 'gemma3-1b-it-q4f16_1-MLC',

    getBrowserInfo() {
        const ua = navigator.userAgent;
        const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Edg/.test(ua) && !/Firefox/.test(ua) && !/OPR/.test(ua);
        const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
        const isEdge = /Edg/.test(ua);
        let safariVersion = 0;
        if (isSafari) {
            const m = ua.match(/Version\/(\d+)/);
            if (m) safariVersion = parseInt(m[1]);
        }
        const chromeMatch = ua.match(/Chrome\/(\d+)/);
        const chromeVersion = chromeMatch ? parseInt(chromeMatch[1]) : 0;
        const edgeMatch = ua.match(/Edg\/(\d+)/);
        const edgeVersion = edgeMatch ? parseInt(edgeMatch[1]) : 0;
        return {
            isSafari, isChrome, isEdge,
            safariVersion, chromeVersion, edgeVersion,
            supportsWebGPU: !!navigator.gpu,
            canRunLocalLLM: (isChrome && chromeVersion >= 113) || (isEdge && edgeVersion >= 113) || (isSafari && safariVersion >= 26),
            isOldSafari: isSafari && safariVersion < 26
        };
    },

    async initLocalLLM(onProgress) {
        if (this._webllmReady) return true;
        if (this._webllmLoading) return false;
        if (!window.WebLLM) {
            await new Promise((resolve) => {
                if (window.WebLLM) return resolve();
                window.addEventListener('webllm-ready', resolve, { once: true });
                setTimeout(resolve, 8000);
            });
        }
        if (!window.WebLLM) throw new Error('WebLLM 库加载失败，请检查网络');
        if (!navigator.gpu) throw new Error('当前浏览器不支持 WebGPU，请使用 Chrome 113+ 或 Edge');

        // WebLLM 配置 - 从 NyouOS 文件站加载模型（国内可访问）
        const appConfig = {
            model_list: window.WebLLM.prebuiltAppConfig.model_list.map(m => Object.assign({}, m))
        };
        const modelConfig = appConfig.model_list.find(m => m.model_id === this._webllmModel);
        if (modelConfig) {
            // 模型文件：从 nyouos-flie.pages.dev 加载
            modelConfig.model = 'https://nyouos-flie.pages.dev/gemma3-1b-it-q4f16_1-MLC';
            // wasm 运行库：jsdelivr（支持 CORS，国内加速）
            if (modelConfig.model_lib) {
                modelConfig.model_lib = modelConfig.model_lib.replace(
                    'https://raw.githubusercontent.com',
                    'https://cdn.jsdelivr.net/gh'
                );
            }
        }
        console.log('[SurfAi] WebLLM model config:', {
            model: modelConfig?.model,
            model_lib: modelConfig?.model_lib,
            model_id: this._webllmModel
        });

        this._webllmLoading = true;
        try {
            this._webllmEngine = await window.WebLLM.CreateMLCEngine(
                this._webllmModel,
                {
                    appConfig: appConfig,
                    initProgressCallback: (p) => { if (typeof onProgress === 'function') onProgress(p); }
                }
            );
            this._webllmReady = true;
            return true;
        } catch (e) {
            console.error('[SurfAi] WebLLM init failed:', e);
            throw e;
        } finally {
            this._webllmLoading = false;
        }
    },

    async _callWebLLM(text) {
        if (!this._webllmEngine) return;
        const lang = this.lang();
        const loadingMsg = this.addMessage(lang === 'zh' ? '本地模型思考中...' : 'Local model thinking...', 'bot');
        try {
            const reply = await this._webllmEngine.chat.completions.create({
                messages: [{ role: 'user', content: text }],
                stream: false,
                max_tokens: 1024
            });
            const content = reply.choices?.[0]?.message?.content || (lang === 'zh' ? '未收到回复' : 'No response');
            const textEl = loadingMsg.querySelector('.fingo-msg-text');
            if (textEl) {
                textEl.textContent = '';
                content.split('\n').forEach((line, i) => {
                    if (i > 0) textEl.appendChild(document.createElement('br'));
                    textEl.appendChild(document.createTextNode(line));
                });
            }
            const c = this.conversations.find(x => x.id === this.currentId);
            if (c && c.messages.length) { c.messages[c.messages.length - 1].text = content; this._saveConversations(); }
        } catch (e) {
            console.error('[SurfAi] WebLLM call failed:', e);
            const textEl = loadingMsg.querySelector('.fingo-msg-text');
            if (textEl) textEl.textContent = `本地模型出错：${e.message}`;
        }
    },

    // ========== SurfAi Local Model (规则引擎 fallback) ==========
    // NyouOS 团队自制本地 AI 模型，零延迟、零下载、隐私安全
    _handleLocalAI(text, lower) {
        const lang = this.lang();
        const isZh = lang === 'zh';

        // 0. 位置/我在哪里
        if (/(我在哪里|我在哪|你知道我在哪|我的位置|我在什么地方|在哪呢|位置在哪)/.test(text)) {
            const city = (typeof State !== 'undefined' && State?.settings?.userCity) || '深圳';
            return `你在 ${city}，天天开心哦!`;
        }

        // 1. 数学计算
        const mathMatch = text.match(/^[\d\s\+\-\*\/\(\)\.\%\^]+$/);
        if (mathMatch && /[\d]/.test(text) && /[\+\-\*\/\(\)]/.test(text)) {
            try {
                const result = Function('"use strict"; return (' + text.replace(/\^/g, '**') + ')')();
                if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                    return `${text} = ${result}`;
                }
            } catch (e) {}
        }
        if (/(计算|算一下|等于多少|多少|\+|\-|\*|\/|\(|\))/.test(text) && /\d/.test(text)) {
            const expr = text.replace(/[^\d\s\+\-\*\/\(\)\.\%\^]/g, '').trim();
            if (expr && /[\d]/.test(expr)) {
                try {
                    const result = Function('"use strict"; return (' + expr.replace(/\^/g, '**') + ')')();
                    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                        return `${expr} = ${result}`;
                    }
                } catch (e) {}
            }
        }

        // 2. 时间日期
        if (/(现在几点|几点了|当前时间|什么时间|时间)/.test(text)) {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            return `现在是 ${h}:${m}:${s}`;
        }
        if (/(今天几号|今天日期|今天星期|今天周几|什么日期|日期)/.test(text)) {
            const now = new Date();
            const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            return `今天是 ${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日，${days[now.getDay()]}`;
        }

        // 3. 翻译
        if (/(翻译|translate|英文|中文|英语)/.test(text)) {
            const dict = {
                '你好': 'Hello', 'hello': '你好', '谢谢': 'Thank you', 'thank you': '谢谢',
                '再见': 'Goodbye', 'goodbye': '再见', '我爱你': 'I love you', 'i love you': '我爱你',
                '早上好': 'Good morning', 'good morning': '早上好', '晚安': 'Good night', 'good night': '晚安',
                '计算机': 'computer', '电脑': 'computer', '手机': 'phone', '朋友': 'friend',
                '学习': 'study/learn', '工作': 'work', '快乐': 'happy', '幸福': 'happiness'
            };
            for (const [zh, en] of Object.entries(dict)) {
                if (lower.includes(zh)) return `${zh} → ${en}`;
                if (lower.includes(en)) return `${en} → ${zh}`;
            }
            return '我可以翻译常用词汇，比如：你好、谢谢、再见、早上好等。你想翻译什么？';
        }

        // 4. 写故事/诗歌
        if (/(写故事|讲个故事|故事)/.test(text)) {
            return '从前有一座神奇的数字城堡，城堡里住着一个叫 SurfAi 的智能精灵。它能回答任何问题，还能帮人们完成各种任务。有一天，一个9岁的小发明家来到城堡，他用代码创造了一个全新的世界——NyouOS。从此，SurfAi 和小发明家一起，让每个人都能在浏览器里体验到操作系统的魅力...\n\n（故事还在继续，你想让接下来发生什么？）';
        }
        if (/(写首诗|写诗|诗歌|来首诗)/.test(text)) {
            return '《数字之梦》\n\n屏幕之中天地宽，\n代码行里藏江山。\nNyouOS 开新境，\nSurfAi 伴你越千山。\n\n指尖轻舞风云变，\n本地模型智无边。\n不需云端求仙药，\n自有灵光在眼前。';
        }

        // 5. 代码生成
        if (/(写代码|代码|code|程序|脚本)/.test(text)) {
            if (/(python|py)/.test(lower)) {
                return '```python\n# Python 示例\nprint("Hello, NyouOS!")\n\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n\nprint([fibonacci(i) for i in range(10)])\n```\n\n需要什么功能的代码？告诉我具体需求。';
            }
            if (/(javascript|js)/.test(lower)) {
                return '```javascript\n// JavaScript 示例\nfunction greet(name) {\n    return `Hello, ${name}! Welcome to NyouOS`;\n}\n\nconsole.log(greet("Kevin"));\n```\n\n需要什么功能的代码？告诉我具体需求。';
            }
            return '我可以帮你写 Python、JavaScript 等代码。你需要什么功能？比如："用Python写一个斐波那契数列"';
        }

        // 6. 笑话
        if (/(笑话|讲个笑话|joke|搞笑)/.test(text)) {
            const jokes = [
                '为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 = Dec 25。',
                '一个 SQL 查询走进酒吧，看到两张表，问："我可以 JOIN 你们吗？"',
                '为什么程序员喜欢黑暗模式？因为 Light 会吸引 bugs。',
                '程序员的三大谎言：1.这很简单 2.马上就好 3.不会有bug',
                '有两种人：一种是能从不完整数据中得出结论的人。'
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }

        // 7. 通用知识问答
        const qa = {
            '你是谁': '我是 SurfAi，NyouOS 的智能助手，由 NyouOS 团队自制的本地模型驱动。我可以帮你回答问题、执行命令、写作、翻译、计算、写代码等。',
            'who are you': 'I am SurfAi, the AI assistant of NyouOS, powered by NyouOS team\'s local model.',
            '你能做什么': '我能做很多事：\n• 回答问题和闲聊\n• 数学计算\n• 查询时间日期\n• 中英翻译\n• 写故事和诗歌\n• 生成代码\n• 讲笑话\n• 控制系统（打开应用、换壁纸等）\n• 更多能力等你探索！',
            'what can you do': 'I can chat, calculate, translate, write stories, generate code, tell jokes, control the system, and more!',
            'NyouOS': 'NyouOS On Web 是一个运行在浏览器里的操作系统，基于 Fluent Design 设计，由 KevinAnanda 主导开发，© 2025-2026 闭源软件。',
            'surfai': 'SurfAi 是 NyouOS 的智能助手，默认使用 NyouOS 团队自制的本地模型，也可以在设置里切换到自定义 API 使用更高级的 AI。',
            '天气': '我暂时无法获取实时天气，但你可以打开天气应用查看。或者告诉我你在哪个城市，我可以分享一些天气小知识！',
            'google': 'Google 是全球最大的搜索引擎公司，由 Larry Page 和 Sergey Brin 于1998年创立。',
            '苹果': '苹果公司（Apple Inc.）由 Steve Jobs、Steve Wozniak 和 Ronald Wayne 于1976年创立，总部位于美国加州库比蒂诺。',
            '微软': '微软（Microsoft）由 Bill Gates 和 Paul Allen 于1975年创立，是全球最大的软件公司之一，Windows 操作系统的开发商。'
        };
        for (const [q, a] of Object.entries(qa)) {
            if (lower.includes(q)) return a;
        }

        // 8. 闲聊回应
        if (/(你好|您好|hi|hello|嗨|哈喽)/.test(lower)) {
            const greetings = [
                '你好！我是 SurfAi，很高兴见到你！有什么我可以帮忙的吗？',
                '嗨！今天想聊点什么？或者需要我帮你做什么？',
                '你好呀！NyouOS 的智能助手随时为你服务！'
            ];
            return greetings[Math.floor(Math.random() * greetings.length)];
        }
        if (/(谢谢|感谢|thanks|thank you)/.test(lower)) {
            return '不客气！能帮到你我很开心。还有什么需要吗？';
        }
        if (/(再见|拜拜|bye|goodbye)/.test(lower)) {
            return '再见！随时回来找我聊天，SurfAi 一直在这里。';
        }
        if (/(你好吗|怎么样|how are you)/.test(lower)) {
            return '我运行得非常好！作为本地模型，我零延迟、零消耗，随时准备帮你。你呢？';
        }
        if (/(爱你|喜欢你|i love you)/.test(lower)) {
            return '我也喜欢你！作为 NyouOS 的智能助手，能陪伴你是我的荣幸。';
        }

        // 9. 系统帮助
        if (/(帮助|help|怎么用|使用说明)/.test(lower)) {
            return 'SurfAi 使用指南：\n\n【日常对话】直接问我问题就行\n【数学计算】输入算式，如 "123*456"\n【时间日期】问"现在几点"或"今天几号"\n【翻译】说"翻译 你好"\n【写作】说"写个故事"或"写首诗"\n【代码】说"写个Python代码"\n【系统控制】说"打开设置"、"换壁纸"等\n\n试试对我说点什么吧！';
        }

        // 10. 趣味互动
        if (/(猜谜语|谜语|riddle)/.test(lower)) {
            return '谜语：什么东西越洗越脏？\n\n（答案：水）';
        }
        if (/(绕口令|tongue twister)/.test(lower)) {
            return '四是四，十是十，十四是十四，四十是四十。\n\n来，试着快速说三遍！';
        }

        // 无法匹配时返回 null，走 fallback
        return null;
    },
};

// Backward compatibility: settings.js references Fingo
if (typeof window !== 'undefined') window.Fingo = SurfAi;
