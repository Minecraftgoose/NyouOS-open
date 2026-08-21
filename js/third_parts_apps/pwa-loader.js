/**
 * 获取所有已注册的应用
 */

const PWALoader = {
    // 存储所有已注册的 PWA 应用配置
    apps: {},
    storageBridgeSupport: new Map(),
    storageRequestTimeout: 1800,
    storageClearTimeout: 15000,
    storageLoadTimeout: 5000,

    normalizeIcon(icon) {
        if (!icon) return 'Theme/Icon/App_icon/app_gallery.webp';
        return icon.includes('/') ? icon : `Theme/Icon/App_icon/${icon}`;
    },

    getCatalogApp(id) {
        const catalog = window.NyouPWACatalog;
        if (!Array.isArray(catalog)) return null;
        return catalog.find(app => app.id === id) || null;
    },

    _storageOrigin(config) {
        try { return new URL(config?.url || '', location.href).origin; }
        catch (_) { return null; }
    },

    _openStorageFrame(id) {
        const component = window[`PWA_${String(id || '').replace(/-/g, '_')}`];
        const frame = component?.getFrame?.();
        return frame?.isConnected ? frame : null;
    },

    _requestFrameStorage(frame, config, action) {
        return new Promise((resolve, reject) => {
            const target = frame?.contentWindow;
            const targetOrigin = this._storageOrigin(config);
            if (!target || !targetOrigin) {
                reject(new Error('pwa_storage_frame_unavailable'));
                return;
            }

            const requestId = globalThis.crypto?.randomUUID?.()
                || `pwa-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            let settled = false;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                window.removeEventListener('message', onMessage);
                callback(value);
            };
            const onMessage = (event) => {
                if (event.source !== target || event.origin !== targetOrigin) return;
                const message = event.data || {};
                if (message.type !== 'nyouos:storage-response' || message.version !== 2 || message.requestId !== requestId || message.appId !== config.id) return;
                if (message.ok !== true) {
                    finish(reject, new Error(String(message.error || 'pwa_storage_operation_failed')));
                    return;
                }
                this.storageBridgeSupport.set(config.id, true);
                const reportedBytes = Number(message.bytes);
                if (action === 'measure' && (!Number.isFinite(reportedBytes) || reportedBytes < 0)) {
                    finish(reject, new Error('pwa_storage_measurement_invalid'));
                    return;
                }
                const value = action === 'measure' ? Math.min(reportedBytes, 1024 * 1024 * 1024) : true;
                finish(resolve, value);
            };
            const timeout = action === 'clear' ? this.storageClearTimeout : this.storageRequestTimeout;
            const timer = setTimeout(() => {
                if (action === 'probe') this.storageBridgeSupport.set(config.id, false);
                finish(reject, new Error(action === 'clear' ? 'pwa_storage_clear_timeout' : 'pwa_storage_bridge_unavailable'));
            }, timeout);
            window.addEventListener('message', onMessage);
            try {
                target.postMessage({
                    source: 'NyouOS',
                    type: 'nyouos:storage-request',
                    version: 2,
                    requestId,
                    appId: config.id,
                    action
                }, targetOrigin);
            } catch (error) {
                finish(reject, error);
            }
        });
    },

    _withStorageFrame(id, action) {
        const config = this.apps[id];
        if (!config?.allowLocalStorage) return Promise.resolve(action === 'measure' ? 0 : true);

        const runOperation = (frame) => {
            if (action !== 'clear') return this._requestFrameStorage(frame, config, action);
            const support = this.storageBridgeSupport.get(id);
            if (support === false) return Promise.resolve(true);
            if (support === true) return this._requestFrameStorage(frame, config, 'clear');
            return this._requestFrameStorage(frame, config, 'probe')
                .then(() => this._requestFrameStorage(frame, config, 'clear'))
                .catch((error) => {
                    if (this.storageBridgeSupport.get(id) === false) return true;
                    throw error;
                });
        };

        const openFrame = this._openStorageFrame(id);
        if (openFrame) return runOperation(openFrame);

        return new Promise((resolve, reject) => {
            if (!document.body) {
                reject(new Error('pwa_storage_probe_unavailable'));
                return;
            }
            const frame = document.createElement('iframe');
            frame.hidden = true;
            frame.setAttribute('aria-hidden', 'true');
            frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
            frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
            let settled = false;
            const cleanup = () => {
                clearTimeout(loadTimer);
                frame.onload = null;
                frame.onerror = null;
                try { frame.remove(); } catch (_) {}
            };
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                callback(value);
            };
            const loadTimer = setTimeout(() => finish(reject, new Error('pwa_storage_probe_timeout')), this.storageLoadTimeout);
            frame.onload = () => {
                runOperation(frame)
                    .then((value) => finish(resolve, value))
                    .catch((error) => finish(reject, error));
            };
            frame.onerror = () => finish(reject, new Error('pwa_storage_probe_failed'));
            frame.src = config.url;
            document.body.appendChild(frame);
        });
    },

    measureAppStorage(id) {
        return this._withStorageFrame(id, 'measure');
    },

    clearAppStorage(id) {
        return this._withStorageFrame(id, 'clear');
    },

    _syncStorageProvider(id, config) {
        if (!globalThis.NyouOSStorage) return;
        this.storageBridgeSupport.delete(id);
        NyouOSStorage.unregisterProvider?.(id);
        if (!config?.allowLocalStorage) return;
        NyouOSStorage.registerProvider(id, {
            external: true,
            measure: () => this.measureAppStorage(id),
            clear: () => this.clearAppStorage(id)
        });
    },

    registerFromCatalog(appOrId) {
        const catalogId = typeof appOrId === 'string' ? appOrId : appOrId?.id;
        const catalogApp = this.getCatalogApp(catalogId);
        if (!catalogApp) return false;

        this.register({
            width: 1100,
            height: 760,
            ...catalogApp,
            trustedCatalog: true,
            icon: this.normalizeIcon(catalogApp.icon)
        });
        return true;
    },
    
    /**
     * 注册 PWA 应用
     * @param {Object} config 应用配置
     */
    register(config) {
        const { id, name, icon, url, width = 1024, height = 700 } = config;
        const catalogApp = this.getCatalogApp(id);
        const isExactCatalogUrl = (() => {
            if (!catalogApp || config.trustedCatalog !== true) return false;
            try { return new URL(catalogApp.url, location.href).href === new URL(url, location.href).href; }
            catch (_) { return false; }
        })();
        const isApprovedCreatedApp = (() => {
            const runtime = window.DeveloperCreatedRuntime;
            const app = runtime?.apps?.get?.(id);
            if (!app || app.type !== 'pwa' || config.allowLocalStorage !== true) return false;
            try {
                const exactUrl = new URL(app.url, location.href).href === new URL(url, location.href).href;
                return exactUrl && runtime._grantedPermissions(app).includes('storage.local');
            } catch (_) {
                return false;
            }
        })();
        const normalizedConfig = {
            ...config,
            icon: this.normalizeIcon(icon),
            width,
            height,
            // Catalog PWAs and created PWAs with an approved storage permission
            // keep their real origin. Every other created PWA remains opaque.
            trustedCatalog: isExactCatalogUrl,
            allowLocalStorage: isApprovedCreatedApp
        };
        
        this.apps[id] = normalizedConfig;
        this._syncStorageProvider(id, normalizedConfig);
        
        // 创建应用对象
        window[`PWA_${id.replace(/-/g, '_')}`] = {
            windowId: null,
            container: null,
            config: normalizedConfig,
            
            init(windowId) {
                this.windowId = windowId;
                this.container = document.getElementById(`${windowId}-content`);
                this._tombstonePausedMedia = [];
                this.render();
            },

            getFrame() {
                return this.container ? this.container.querySelector('.pwa-iframe') : null;
            },

            postTombstoneMessage(frame, action) {
                if (!frame || !frame.contentWindow) return;
                try {
                    frame.contentWindow.postMessage({
                        source: 'NyouOS',
                        type: 'nyouos:tombstone',
                        action,
                        appId: this.config.id,
                        appName: this.config.name
                    }, '*');
                } catch (_) {
                    // Cross-origin frames may reject access; the iframe remains frozen by the shell.
                }
            },

            pauseSameOriginMedia(frame) {
                this._tombstonePausedMedia = [];
                try {
                    const mediaNodes = Array.from(frame.contentDocument?.querySelectorAll('audio, video') || []);
                    mediaNodes.forEach((node, index) => {
                        if (!node.paused && !node.ended) {
                            this._tombstonePausedMedia.push(index);
                            node.pause();
                        }
                    });
                } catch (_) {
                    // Third-party PWAs are usually cross-origin; cooperative pages can use postMessage instead.
                }
            },

            resumeSameOriginMedia(frame) {
                if (!Array.isArray(this._tombstonePausedMedia) || this._tombstonePausedMedia.length === 0) return;
                try {
                    const mediaNodes = Array.from(frame.contentDocument?.querySelectorAll('audio, video') || []);
                    this._tombstonePausedMedia.forEach((index) => {
                        const node = mediaNodes[index];
                        if (node && typeof node.play === 'function') {
                            const playResult = node.play();
                            if (playResult && typeof playResult.catch === 'function') {
                                playResult.catch(() => {});
                            }
                        }
                    });
                } catch (_) {
                    // Ignore cross-origin restore failures; the frame itself was never reloaded.
                } finally {
                    this._tombstonePausedMedia = [];
                }
            },

            onTombstoneFreeze() {
                if (!this.container) return;
                this.container.classList.add('pwa-content-frozen');
                const frame = this.getFrame();
                if (frame) {
                    this.pauseSameOriginMedia(frame);
                    this.postTombstoneMessage(frame, 'freeze');
                    frame.dataset.fluentFrozen = 'true';
                    frame.dataset.fluentDisplayBeforeFreeze = frame.style.display || '';
                    frame.setAttribute('aria-hidden', 'true');
                    frame.style.pointerEvents = 'none';
                    try {
                        if (frame.contentWindow && typeof frame.contentWindow.stop === 'function') {
                            frame.contentWindow.stop();
                        }
                    } catch (_) {
                        // stop() is best-effort and not available for every cross-origin frame.
                    }
                }
            },

            onTombstoneRestore() {
                if (!this.container) return;
                this.container.classList.remove('pwa-content-frozen');
                const frame = this.getFrame();
                if (frame) {
                    delete frame.dataset.fluentFrozen;
                    delete frame.dataset.fluentDisplayBeforeFreeze;
                    frame.removeAttribute('aria-hidden');
                    frame.style.pointerEvents = '';
                    this.postTombstoneMessage(frame, 'restore');
                    this.resumeSameOriginMedia(frame);
                }
            },

            beforeClose() {
                const frame = this.getFrame();
                if (frame) {
                    try { frame.src = 'about:blank'; } catch (_) {}
                    frame.remove();
                }
                this._tombstonePausedMedia = [];
                this.container = null;
                this.windowId = null;
                return true;
            },
            
            render() {
                if (this.config.openMode === 'external') {
                    if (location.protocol === 'file:') {
                        console.warn('[PWA] Skipping external open on file://');
                        return;
                    }
                    window.open(this.config.url, '_blank', 'noopener,noreferrer');
                    const external = document.createElement('div');
                    external.className = 'pwa-app pwa-external-app';
                    const link = document.createElement('a');
                    link.href = this.config.url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = this.config.name;
                    external.appendChild(link);
                    this.container.replaceChildren(external);
                    return;
                }

                const app = document.createElement('div');
                app.className = 'pwa-app';
                const frozenSurface = document.createElement('div');
                frozenSurface.className = 'pwa-frozen-surface';
                frozenSurface.setAttribute('aria-hidden', 'true');
                const icon = document.createElement('img');
                icon.src = this.config.icon;
                icon.alt = '';
                const label = document.createElement('span');
                label.textContent = this.config.name;
                frozenSurface.append(icon, label);

                const frame = document.createElement('iframe');
                frame.className = 'pwa-iframe';
                frame.src = this.config.url;
                const sandbox = ['allow-scripts', 'allow-popups', 'allow-forms', 'allow-modals'];
                if (this.config.trustedCatalog || this.config.allowLocalStorage) sandbox.unshift('allow-same-origin');
                frame.setAttribute('sandbox', sandbox.join(' '));
                frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                app.append(frozenSurface, frame);
                this.container.replaceChildren(app);
                WindowManager.bindEmbeddedFrameFocus?.(frame, this.windowId);
            }};
        
        // 注册到 WindowManager
        if (typeof WindowManager !== 'undefined' && WindowManager.appConfigs) {
            WindowManager.appConfigs[id] = {
                title: name,
                icon: normalizedConfig.icon,
                width: width,
                height: height,
                openMode: normalizedConfig.openMode,
                url: normalizedConfig.url,
                component: `PWA_${id.replace(/-/g, '_')}`
            };
        }
        
        console.debug(`[PWA] 已注册应用 ${name}`);
    },
    
    /**
     * 鑾峰彇鎵€鏈夊凡娉ㄥ唽鐨?PWA 搴旂敤
     */
    getAll() {
        return Object.values(this.apps);
    },
    
    /**
     * 检查应用是否已注册
     */
    isRegistered(id) {
        return !!this.apps[id];
    },
    
    /**
     * 注销 PWA 应用
     */
    unregister(id) {
        this.storageBridgeSupport.delete(id);
        globalThis.NyouOSStorage?.unregisterProvider?.(id);
        if (this.apps[id]) {
            delete this.apps[id];
            delete window[`PWA_${id.replace(/-/g, '_')}`];
            if (typeof WindowManager !== 'undefined' && WindowManager.appConfigs) {
                delete WindowManager.appConfigs[id];
            }
            console.debug(`[PWA] 已注销应用: ${id}`);
        }
    }
};

window.PWALoader = PWALoader;
