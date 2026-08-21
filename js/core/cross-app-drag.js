/** Cross-App drag routing and live destination previews. */
(function () {
    'use strict';

    const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg']);
    const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
    const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'html', 'htm']);

    const CrossAppDrag = {
        _initialized: false,
        _previewWindow: null,
        _previewElement: null,

        init() {
            if (this._initialized || typeof document === 'undefined') return;
            this._initialized = true;
            document.addEventListener('dragover', (event) => this._onDragOver(event), true);
            document.addEventListener('dragleave', (event) => this._onDragLeave(event), true);
            document.addEventListener('drop', (event) => this._onDrop(event), true);
            document.addEventListener('dragend', () => this.hidePreview(), true);
            window.addEventListener('blur', () => this.hidePreview());
            State?.on?.('settingsChange', (updates) => {
                if (updates?.enableCrossAppDragDrop === false) this.hidePreview();
            });
        },

        enabled() {
            return State?.settings?.enableCrossAppDragDrop === true;
        },

        _types(dataTransfer) {
            return Array.from(dataTransfer?.types || []).map((value) => String(value || '').toLowerCase());
        },

        _extension(name) {
            const value = String(name || '');
            const index = value.lastIndexOf('.');
            return index >= 0 ? value.slice(index + 1).toLowerCase() : '';
        },

        _internalPayload(dataTransfer) {
            if (!this._types(dataTransfer).includes('application/Nyou-file')) return null;
            try {
                const raw = dataTransfer.getData('application/Nyou-file');
                return raw ? JSON.parse(raw) : null;
            } catch (_) {
                return null;
            }
        },

        _internalNodes(dataTransfer) {
            const payload = this._internalPayload(dataTransfer);
            if (!payload) return [];
            const ids = Array.isArray(payload.ids) ? payload.ids : [payload.id];
            return [...new Set(ids.filter(Boolean))]
                .map((id) => State?.findNode?.(id))
                .filter(Boolean);
        },

        _externalFiles(dataTransfer) {
            if (dataTransfer?.files?.length) return Array.from(dataTransfer.files);
            const files = [];
            Array.from(dataTransfer?.items || []).forEach((item) => {
                if (item?.kind !== 'file') return;
                const file = item.getAsFile?.();
                if (file) files.push(file);
            });
            return files;
        },

        _externalMimeTypes(dataTransfer) {
            return Array.from(dataTransfer?.items || [])
                .filter((item) => item?.kind === 'file')
                .map((item) => String(item.type || '').toLowerCase());
        },

        _hasExternalFiles(dataTransfer) {
            const types = this._types(dataTransfer);
            if (types.includes('application/Nyou-file')) return false;
            return types.some((type) => type === 'files' || type.includes('file'))
                || Array.from(dataTransfer?.items || []).some((item) => item?.kind === 'file');
        },

        _plainText(dataTransfer) {
            if (this._types(dataTransfer).includes('application/Nyou-file')) return '';
            return String(dataTransfer?.getData('text/uri-list') || dataTransfer?.getData('text/plain') || '').trim();
        },

        _matchesNodes(nodes, extensions, mimePrefix = '') {
            return nodes.length > 0 && nodes.every((node) => {
                const extension = this._extension(node?.name);
                const mime = String(node?.mime || '').toLowerCase();
                return extensions.has(extension) || (mimePrefix && mime.startsWith(mimePrefix));
            });
        },

        _matchesExternal(dataTransfer, extensions, mimePrefix = '') {
            const files = this._externalFiles(dataTransfer);
            if (files.length) {
                return files.every((file) => extensions.has(this._extension(file.name)) || String(file.type || '').toLowerCase().startsWith(mimePrefix));
            }
            const mimeTypes = this._externalMimeTypes(dataTransfer);
            return mimeTypes.length > 0 && mimeTypes.every((mime) => !mime || mime.startsWith(mimePrefix));
        },

        _getWindowData(target) {
            const windowElement = target instanceof Element ? target.closest('.window') : null;
            if (!windowElement || !Array.isArray(WindowManager?.windows)) return null;
            return WindowManager.windows.find((item) => item?.id === windowElement.id) || null;
        },

        _decision(windowData, dataTransfer) {
            if (!windowData || !dataTransfer) return null;
            const appId = windowData.appId;
            const nodes = this._internalNodes(dataTransfer);
            const internal = this._types(dataTransfer).includes('application/Nyou-file');
            const external = this._hasExternalFiles(dataTransfer);
            const externalAllowed = globalThis.FileImport?.enabled?.() === true;
            const plainText = this._plainText(dataTransfer);

            if (appId === 'files' && (internal || (external && externalAllowed))) {
                return { labelKey: 'crossAppDrop.files', native: true };
            }
            if (appId === 'notes' && (
                (internal && this._matchesNodes(nodes, TEXT_EXTENSIONS, 'text/'))
                || (external && externalAllowed && this._matchesExternal(dataTransfer, TEXT_EXTENSIONS, 'text/'))
                || plainText
            )) return { labelKey: 'crossAppDrop.notes' };
            if (appId === 'photos' && (
                (internal && this._matchesNodes(nodes, IMAGE_EXTENSIONS, 'image/'))
                || (external && externalAllowed && this._matchesExternal(dataTransfer, IMAGE_EXTENSIONS, 'image/'))
            )) return { labelKey: 'crossAppDrop.photos' };
            if (appId === 'media' && (
                (internal && this._matchesNodes(nodes, AUDIO_EXTENSIONS, 'audio/'))
                || (external && externalAllowed && this._matchesExternal(dataTransfer, AUDIO_EXTENSIONS, 'audio/'))
            )) return { labelKey: 'crossAppDrop.media' };
            if (appId === 'browser' && (
                (internal && this._matchesNodes(nodes, TEXT_EXTENSIONS, 'text/')) || plainText
            )) return { labelKey: 'crossAppDrop.browser' };
            if (appId === 'terminal' && (internal || plainText || (external && externalAllowed))) {
                return { labelKey: 'crossAppDrop.terminal' };
            }
            return null;
        },

        _showPreview(windowData, decision) {
            if (!windowData?.element || !decision) return;
            if (this._previewWindow === windowData && this._previewElement?.isConnected) return;
            this.hidePreview();

            const config = WindowManager?.getAppConfig?.(windowData.appId);
            const overlay = document.createElement('div');
            overlay.className = 'cross-app-drop-preview';
            overlay.setAttribute('aria-hidden', 'true');
            const card = document.createElement('div');
            card.className = 'cross-app-drop-preview-card';
            if (config?.icon) {
                const icon = document.createElement('img');
                icon.src = config.icon;
                icon.alt = '';
                card.appendChild(icon);
            }
            const copy = document.createElement('span');
            const title = document.createElement('strong');
            title.textContent = t(decision.labelKey);
            const hint = document.createElement('small');
            hint.textContent = t('crossAppDrop.release');
            copy.append(title, hint);
            card.appendChild(copy);
            overlay.appendChild(card);
            windowData.element.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('show'));
            this._previewWindow = windowData;
            this._previewElement = overlay;
        },

        hidePreview() {
            const overlay = this._previewElement;
            this._previewElement = null;
            this._previewWindow = null;
            if (!overlay) return;
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 140);
        },

        _onDragOver(event) {
            if (!this.enabled()) {
                this.hidePreview();
                return;
            }
            const windowData = this._getWindowData(event.target);
            const decision = this._decision(windowData, event.dataTransfer);
            if (!decision) {
                this.hidePreview();
                return;
            }
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = decision.native ? (this._types(event.dataTransfer).includes('application/Nyou-file') ? 'move' : 'copy') : 'copy';
            this._showPreview(windowData, decision);
        },

        _onDragLeave(event) {
            const windowElement = event.target instanceof Element ? event.target.closest('.window') : null;
            if (!windowElement || windowElement.contains(event.relatedTarget)) return;
            if (this._previewWindow?.id === windowElement.id) this.hidePreview();
        },

        _onDrop(event) {
            if (!this.enabled()) return;
            const windowData = this._getWindowData(event.target);
            const decision = this._decision(windowData, event.dataTransfer);
            this.hidePreview();
            if (!decision || decision.native) return;
            event.preventDefault();
            // Stop target App handlers while allowing other document-level
            // capture listeners to clear their own drag UI.
            event.stopPropagation();
            this._deliver(windowData, event.dataTransfer).catch((error) => {
                console.warn('[CrossAppDrag] Drop delivery failed', error);
            });
        },

        async _deliver(windowData, dataTransfer) {
            const component = windowData?.component || WindowManager?._getWindowComponent?.(windowData);
            if (!component) return false;
            const nodes = this._internalNodes(dataTransfer);
            const files = this._externalFiles(dataTransfer);
            const plainText = this._plainText(dataTransfer);

            if (windowData.appId === 'notes') {
                if (nodes[0]?.id && component.loadFile) {
                    component.loadFile(nodes[0].id);
                } else if (files.length && component.readExternalTextFile && component.createFileInFolder) {
                    const imported = [];
                    for (const file of files) {
                        const content = await component.readExternalTextFile(file);
                        const folder = component.getDefaultFolder();
                        const extension = this._extension(file.name) === 'md' ? '.md' : '.txt';
                        const desired = component.ensureFileExtension(file.name || component.tr('newFileBase'), extension);
                        const name = component.uniqueFileName(folder, desired);
                        imported.push(component.createFileInFolder(folder, name, content, {
                            mime: file.type || (extension === '.md' ? 'text/markdown' : 'text/plain'),
                            encoding: 'text'
                        }));
                    }
                    if (imported[0]) component.openEditor(imported[0].id, false);
                } else if (plainText && component.createFileInFolder) {
                    const folder = component.getDefaultFolder();
                    const name = component.uniqueFileName(folder, `${component.tr('newFileBase')}${component.tr('txtExt')}`);
                    const note = component.createFileInFolder(folder, name, plainText, { mime: 'text/plain', encoding: 'text' });
                    component.openEditor(note.id, true);
                }
            } else if (windowData.appId === 'photos') {
                if (nodes[0]?.id && component.loadFile) component.loadFile(nodes[0].id);
                else if (files.length && component.importFiles) await component.importFiles(files);
            } else if (windowData.appId === 'media') {
                if (nodes[0]?.id && component.loadFile) await component.loadFile(nodes[0].id);
                else if (files.length && component.importFiles) await component.importFiles(files);
            } else if (windowData.appId === 'browser') {
                const value = nodes[0]?.content || nodes[0]?.url || plainText;
                if (value && component.navigate) component.navigate(String(value).trim());
            } else if (windowData.appId === 'terminal') {
                const values = nodes.length
                    ? nodes.map((node) => node.name)
                    : (files.length ? files.map((file) => file.name) : [plainText]);
                const insertion = values.filter(Boolean).map((value) => /\s/.test(value) ? `"${value}"` : value).join(' ');
                if (component.input && insertion) {
                    const prefix = component.input.value && !component.input.value.endsWith(' ') ? ' ' : '';
                    component.input.value += `${prefix}${insertion}`;
                    component.input.focus();
                }
            }
            WindowManager?.focusWindow?.(windowData.id);
            return true;
        }
    };

    /**
     * Pointer-to-drag bridge for touch screens. Mobile browsers generally do
     * not start HTML drag-and-drop from touch input, while Desktop and Files
     * intentionally share the existing drag payload/drop routing. A short,
     * stationary hold arms dragging; moving before that remains native scroll.
     */
    const TouchDragBridge = {
        HOLD_MS: 380,
        MOVE_TOLERANCE_PX: 12,
        DRAG_START_PX: 13,
        _active: null,

        bind(source, options = {}) {
            if (!(source instanceof Element) || source.dataset.touchDragBound === 'true') return false;
            source.dataset.touchDragBound = 'true';
            const listenerOptions = options.signal ? { signal: options.signal } : undefined;
            source.addEventListener('pointerdown', (event) => this._onPointerDown(source, event), listenerOptions);
            source.addEventListener('contextmenu', (event) => {
                // A stationary hold keeps the system's existing long-press
                // context menu. Movement after the earlier drag-arm feedback
                // cancels that global timer and starts dragging instead.
                if (event.NyouLongPress === true && this._active?.source === source) this.cancel();
            }, listenerOptions);
            options.signal?.addEventListener('abort', () => {
                if (this._active?.source === source) this.cancel();
            }, { once: true });
            return true;
        },

        _createDataTransfer() {
            const values = new Map();
            return {
                dropEffect: 'none',
                effectAllowed: 'all',
                files: [],
                items: [],
                get types() { return [...values.keys()]; },
                setData(type, value) { values.set(String(type), String(value)); },
                getData(type) { return values.get(String(type)) || ''; },
                clearData(type) {
                    if (type === undefined) values.clear();
                    else values.delete(String(type));
                },
                setDragImage() {}
            };
        },

        _dragEvent(type, state, point, relatedTarget = null) {
            const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
            const values = {
                dataTransfer: state.dataTransfer,
                clientX: Number(point?.clientX) || 0,
                clientY: Number(point?.clientY) || 0,
                screenX: Number(point?.screenX) || 0,
                screenY: Number(point?.screenY) || 0,
                relatedTarget
            };
            Object.entries(values).forEach(([name, value]) => {
                try { Object.defineProperty(event, name, { value, enumerable: true }); }
                catch (_) {}
            });
            return event;
        },

        _onPointerDown(source, event) {
            if (event.pointerType !== 'touch' || event.isPrimary === false || (typeof event.button === 'number' && event.button !== 0)) return;
            this.cancel();
            const state = {
                source,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                armed: false,
                dragging: false,
                dataTransfer: null,
                ghost: null,
                target: null,
                dropAllowed: false,
                timer: 0,
                lastPoint: event
            };
            this._active = state;

            const onMove = (moveEvent) => this._onPointerMove(state, moveEvent);
            const onFinish = (finishEvent) => this._finish(state, finishEvent);
            state.removeListeners = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onFinish);
                document.removeEventListener('pointercancel', onFinish);
            };
            document.addEventListener('pointermove', onMove, { passive: false });
            document.addEventListener('pointerup', onFinish);
            document.addEventListener('pointercancel', onFinish);

            state.timer = setTimeout(() => {
                state.timer = 0;
                if (this._active !== state || !source.isConnected) return;
                state.armed = true;
                source.classList.add('touch-drag-armed');
                try { source.setPointerCapture?.(state.pointerId); } catch (_) {}
                try { navigator.vibrate?.(18); } catch (_) {}
            }, this.HOLD_MS);
        },

        _onPointerMove(state, event) {
            if (this._active !== state || event.pointerId !== state.pointerId) return;
            state.lastPoint = event;
            const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
            if (!state.armed) {
                if (distance > this.MOVE_TOLERANCE_PX) this._cleanup(state);
                return;
            }
            if (event.cancelable) event.preventDefault();
            if (!state.dragging) {
                if (distance < this.DRAG_START_PX) return;
                if (!this._beginDrag(state, event)) return;
            }
            this._updateTarget(state, event);
        },

        _beginDrag(state, event) {
            state.dataTransfer = this._createDataTransfer();
            const startEvent = this._dragEvent('dragstart', state, event);
            if (!state.source.dispatchEvent(startEvent)) {
                this._cleanup(state);
                return false;
            }
            state.dragging = true;
            state.source.classList.remove('touch-drag-armed');
            document.body.classList.add('touch-drag-active');
            state.ghost = document.createElement('div');
            state.ghost.className = 'taskbar-drag-ghost desktop-native-drag-ghost touch-drag-ghost';
            const image = state.source.querySelector('img')?.cloneNode(false);
            if (image) {
                image.alt = '';
                state.ghost.appendChild(image);
            }
            document.body.appendChild(state.ghost);
            this._moveGhost(state, event);
            return true;
        },

        _moveGhost(state, point) {
            if (!state.ghost) return;
            state.ghost.style.left = `${point.clientX}px`;
            state.ghost.style.top = `${point.clientY}px`;
            state.ghost.classList.toggle('droppable', state.dropAllowed);
        },

        _updateTarget(state, point) {
            const nextTarget = document.elementFromPoint(point.clientX, point.clientY);
            if (nextTarget !== state.target) {
                if (state.target) state.target.dispatchEvent(this._dragEvent('dragleave', state, point, nextTarget));
                if (nextTarget) nextTarget.dispatchEvent(this._dragEvent('dragenter', state, point, state.target));
                state.target = nextTarget;
            }
            state.dropAllowed = !!state.target && !state.target.dispatchEvent(this._dragEvent('dragover', state, point));
            this._moveGhost(state, point);
        },

        _suppressClick(source) {
            const suppress = (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
            };
            source.addEventListener('click', suppress, { capture: true, once: true });
            setTimeout(() => source.removeEventListener('click', suppress, true), 800);
        },

        _finish(state, event) {
            if (this._active !== state || event.pointerId !== state.pointerId) return;
            if (state.armed || state.dragging) this._suppressClick(state.source);
            if (state.dragging) {
                if (event.type === 'pointerup') {
                    this._updateTarget(state, event);
                    if (state.dropAllowed && state.target) {
                        state.target.dispatchEvent(this._dragEvent('drop', state, event));
                    }
                }
                state.source.dispatchEvent(this._dragEvent('dragend', state, event));
            }
            this._cleanup(state);
        },

        _cleanup(state) {
            if (!state) return;
            clearTimeout(state.timer);
            state.removeListeners?.();
            if (state.target && state.dragging) {
                state.target.dispatchEvent(this._dragEvent('dragleave', state, state.lastPoint, null));
            }
            state.source?.classList.remove('touch-drag-armed');
            try {
                if (state.source?.hasPointerCapture?.(state.pointerId)) state.source.releasePointerCapture(state.pointerId);
            } catch (_) {}
            state.ghost?.remove();
            document.body.classList.remove('touch-drag-active');
            if (this._active === state) this._active = null;
        },

        cancel() {
            const state = this._active;
            if (!state) return;
            if (state.dragging) state.source.dispatchEvent(this._dragEvent('dragend', state, state.lastPoint));
            this._cleanup(state);
        }
    };

    globalThis.CrossAppDrag = CrossAppDrag;
    globalThis.TouchDragBridge = TouchDragBridge;
})();
