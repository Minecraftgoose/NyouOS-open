/**
 * 全局状态管理
 */
const State = {
    // 当前视图
    view: 'boot', // 'boot' | 'lock' | 'login' | 'desktop'
    
    // 设置
    settings: {},
    _resolvedWallpapers: { desktop: '', lock: '' },
    _wallpaperAccentPromise: null,
    
    // 会话
    session: {},
    
    // 文件系统
    fs: {},
    
    // 桌面布局
    desktopLayout: {},
    
    // 通知列表
    notifications: [],
    
    // 打开的窗口
    windows: [],
    
    // 运行的应用
    runningApps: new Set(),

    // 应用使用记录
    appUsage: {},
    
    // 事件监听器
    listeners: {},

    // 保存设置到 localStorage
    save() {
        Storage.set(Storage.keys.SETTINGS, this.settings);
    },

    // 初始化
    init() {
        // 从 localStorage 加载数据
        this.settings = Storage.get(Storage.keys.SETTINGS);
        this.session = Storage.get(Storage.keys.SESSION);
        this.fs = Storage.get(Storage.keys.FS);
        this.desktopLayout = Storage.get(Storage.keys.DESKTOP_LAYOUT) || { icons: [] };
        this.appUsage = Storage.get(Storage.keys.APP_USAGE) || {};
        this.notifications = Storage.get(Storage.keys.NOTIFICATIONS) || [];
        this.ensureSettingsDefaults();
        this.restoreStrictCspOnStartup();
        
        // 校验并修复文件系统完整性（防止关键目录缺失）
        this.ensureFSIntegrity();
        
        // 重置灵翼交互状态（每次启动时都需要重新授权摄像头）
        if (this.settings.lingyiEnabled) {
            this.settings.lingyiEnabled = false;
            Storage.set(Storage.keys.SETTINGS, this.settings);
        }
        
        // 应用主题
        this.applyTheme();
        this.applyAccentColorSetting();
        
        // 应用动画设置
        this.applyAnimationSetting();
        
        // 应用模糊设置
        this.applyBlurSetting();
        
        // 应用窗口模糊设置
        this.applyWindowBlurSetting();
        
        // 应用反色模式（辅助功能）
        this.applyAccessibility();
        
        // 应用新版 UI 设置
        this.applyNyouV2Setting();
        this.applyMaterialSetting();
        if (this.settings.accentColorAuto === true) {
            this.updateAccentFromWallpaper(this.settings.wallpaperDesktop);
        }
        this.applyButtonGlowSetting();
        this.applyStrictCspSetting();
        
        // 应用亮度设置
        this.applyBrightness();
        this.applyVolume();
    },

    wallpaperSettingKey(slot) {
        return slot === 'lock' ? 'wallpaperLock' : 'wallpaperDesktop';
    },

    getResolvedWallpaper(slot) {
        const id = slot === 'lock' ? 'lock' : 'desktop';
        if (this._resolvedWallpapers[id]) return this._resolvedWallpapers[id];
        const value = this.settings[this.wallpaperSettingKey(id)];
        if (typeof WallpaperStore !== 'undefined' && WallpaperStore.isBuiltIn(value)) return value;
        return typeof WallpaperStore !== 'undefined'
            ? WallpaperStore.DEFAULTS[id]
            : (id === 'lock' ? 'Theme/Picture/Fluent-1.webp' : 'Theme/Picture/Fluent-2.webp');
    },

    async resolveWallpaper(slot) {
        const id = slot === 'lock' ? 'lock' : 'desktop';
        const key = this.wallpaperSettingKey(id);
        const value = this.settings[key];
        if (typeof WallpaperStore === 'undefined') return value;
        const resolved = await WallpaperStore.resolveSetting(id, value);
        if (this.settings[key] !== value) return this.getResolvedWallpaper(id);
        this._resolvedWallpapers[id] = resolved.url;
        if ((resolved.migrated || resolved.reset) && resolved.reference && resolved.reference !== value) {
            this.settings = { ...this.settings, [key]: resolved.reference };
            Storage.set(Storage.keys.SETTINGS, this.settings);
            this.emit('settingsChange', { [key]: resolved.reference });
        }
        return resolved.url;
    },

    async setWallpaper(slot, source, meta = {}) {
        const id = slot === 'lock' ? 'lock' : 'desktop';
        const key = this.wallpaperSettingKey(id);
        if (typeof WallpaperStore === 'undefined' || WallpaperStore.isBuiltIn(source)) {
            const fallback = id === 'lock' ? 'Theme/Picture/Fluent-1.webp' : 'Theme/Picture/Fluent-2.webp';
            const value = String(source || fallback);
            this._resolvedWallpapers[id] = value;
            if (typeof WallpaperStore !== 'undefined') await WallpaperStore.clearSlot(id);
            const settingsChanged = this.updateSettings({ [key]: value });
            this.emit('wallpaperChange', { slot: id, key, reference: value, url: value });
            if (id === 'desktop' && this.settings.accentColorAuto === true) {
                const accentUpdate = settingsChanged
                    ? this._wallpaperAccentPromise
                    : this.updateAccentFromWallpaper(value);
                if (accentUpdate) await accentUpdate;
            }
            return value;
        }
        const reference = await WallpaperStore.saveForSlot(id, source, meta);
        const url = await WallpaperStore.resolveReference(reference);
        if (!url) throw new Error('wallpaper_cache_unavailable');
        this._resolvedWallpapers[id] = url;
        const settingsChanged = this.updateSettings({ [key]: reference });
        // The reference is stable (wallpaper-cache:<slot>) even when its image
        // bytes change, so settingsChange alone cannot represent every update.
        this.emit('wallpaperChange', { slot: id, key, reference, url });
        if (id === 'desktop' && this.settings.accentColorAuto === true) {
            const accentUpdate = settingsChanged
                ? this._wallpaperAccentPromise
                : this.updateAccentFromWallpaper(url);
            if (accentUpdate) await accentUpdate;
        }
        return reference;
    },

    // 确保文件系统关键目录存在
    ensureFSIntegrity() {
        if (!this.fs || !this.fs.root) {
            this.fs = Storage.get(Storage.keys.FS) || { root: { id: 'root', name: '此电脑', type: 'folder', children: [] } };
        }
        const root = this.fs.root;
        let changed = false;
        if (!Array.isArray(root.children)) {
            root.children = [];
            changed = true;
        }
        const ensureFolder = (id, name) => {
            let node = root.children.find(c => c.id === id);
            if (!node) {
                node = { id, name, type: 'folder', children: [] };
                root.children.push(node);
                changed = true;
            } else if (!Array.isArray(node.children)) {
                node.children = [];
                changed = true;
            }
        };
        ensureFolder('desktop', '桌面');
        ensureFolder('documents', '文档');
        ensureFolder('pictures', '图片');
        ensureFolder('music', '音乐');
        ensureFolder('downloads', '下载');
        ensureFolder('recycle', '回收站');
        // 保存修复结果
        if (changed) Storage.set(Storage.keys.FS, this.fs);
    },

    getDefaultUserAvatar() {
        return 'Theme/Profile_img/UserAva.webp';
    },

    getBuiltInUserAvatars() {
        return [
            this.getDefaultUserAvatar(),
            ...Array.from({ length: 10 }, (_, i) => `Theme/Profile_img/${i + 1}.jpg`)
        ];
    },

    normalizeUserAvatar(value) {
        const fallback = this.getDefaultUserAvatar();
        if (typeof value !== 'string') return fallback;

        const raw = value.trim();
        if (!raw) return fallback;
        if (/^data:image\//i.test(raw)) return raw;

        let normalized = raw.replace(/\\/g, '/');
        if (/^https?:\/\//i.test(normalized)) {
            try {
                const url = new URL(normalized, window.location.href);
                if (url.origin !== window.location.origin) return fallback;
                normalized = decodeURIComponent(url.pathname.replace(/^\//, ''));
            } catch (_) {
                return fallback;
            }
        }

        normalized = normalized.replace(/^\.\//, '').replace(/^\//, '');
        const lower = normalized.toLowerCase();

        if (
            lower === 'userava.webp'
            || lower === 'userava.webp'
            || lower === 'theme/icon/userava.webp'
            || lower === 'icon/userava.webp'
            || lower === 'profile_img/userava.webp'
            || lower === 'theme/profile_img/userava.webp'
            || lower === 'profile_img/userava.webp'
            || lower === 'theme/profile_img/userava.webp'
        ) {
            return fallback;
        }

        const builtIn = this.getBuiltInUserAvatars();
        const exact = builtIn.find((item) => item.toLowerCase() === lower);
        if (exact) return exact;

        const profileMatch = lower.match(/^(?:theme\/)?profile_img\/(\d+)\.jpg$/);
        if (profileMatch) {
            const index = Number(profileMatch[1]);
            if (index >= 1 && index <= 10) {
                return `Theme/Profile_img/${index}.jpg`;
            }
        }

        const plainMatch = lower.match(/^(\d+)\.jpg$/);
        if (plainMatch) {
            const index = Number(plainMatch[1]);
            if (index >= 1 && index <= 10) {
                return `Theme/Profile_img/${index}.jpg`;
            }
        }

        return fallback;
    },

    ensureSettingsDefaults() {
        this.settings = this.settings || {};
        let changed = false;
        if (this.settings.enableSystemInteractionAudio === undefined
            && this.settings.enableSpatialWindowAudio !== undefined) {
            this.settings.enableSystemInteractionAudio = this.settings.enableSpatialWindowAudio === true;
            changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(this.settings, 'enableSpatialWindowAudio')) {
            delete this.settings.enableSpatialWindowAudio;
            changed = true;
        }
        const processManagerRegistrationVersion = Number(this.settings.processManagerRegistrationVersion || 0);
        const needsProcessManagerRegistration = processManagerRegistrationVersion < 2;
        const externalFileImportDefaultVersion = Number(this.settings.externalFileImportDefaultVersion || 0);
        const needsExternalFileImportDefaultMigration = externalFileImportDefaultVersion < 1;

        const defaults = {
            strictCspEnabled: false,
            strictCspLastEnabled: false,
            fingoAiMode: 'local',
            fingoCustomMode: false,
            fingoCustomLastEnabled: false,
            fingoProvider: 'agnes',
            fingoApiKey: 'sk-Iysf5fO5NtRZ2H4dws8hgFmUMwe8B3weANd4VFuvFWy7mDyA',
            fingoApiEncrypted: null,
            fingoApiStorageType: 'permanent-plain',
            fingoApiSaveMode: 'permanent',
            defaultSearchEngine: 'baidu',
            autoRestartEveryVisit: true,
            autoRestartHours: 0,
            autoRestartMinutes: 0,
            autoRestartSeconds: 30,
            userCity: '深圳',
            autoEnterFullscreen: true,
            enableExternalFileImport: true,
            externalFileImportDefaultVersion: 1,
            enableSystemInteractionAudio: false,
            enableCrossAppDragDrop: false,
            enableAppMultiWindow: true,
            forceRealtimeBlur: false,
            enableWindowBlur: false,
            enableNyouV2: true,
            materialType: 'gaussian',
            blurIntensity: 40,
            accentColor: '#0078d4',
            accentColorAuto: false,
            accentColorExpanded: false,
            accentColorReadability: false,
            wallpaperAccentColor: '#0078d4',
            recentAccentColors: ['#d83b01', '#0078d4', '#00b7c3', '#4c4a48', '#e81123'],
            enableButtonGlowEffect: true,
            userName: 'Owner',
            userEmail: 'owner@sample.com',
            userAvatar: this.getDefaultUserAvatar(),
            language: 'zh',
            invertMode: false,
            grayscaleMode: false,
            highContrastMode: false,
            largeTextMode: false,
            zoomLevel: 1,
            colorBlindMode: 'none',
            screenReader: false,
            screenReaderRate: 1,
            screenReaderPitch: 1,
            screenKeyboard: false,
            quickWindowSwitchEnabled: true,
            tombstoneBackgroundEnabled: true,
            tombstoneFreezeDelayMs: 60 * 1000,
            tombstoneDimFrozenAppsEnabled: false,
            windowEdgeSnapEnabled: true,
            windowHoverSnapEnabled: true,
            windowTopMaximizeEnabled: false,
            processManagerRefreshInterval: 3000,
            startPinnedApps: ['files', 'settings', 'calculator', 'notes', 'browser', 'clock', 'weather', 'appshop', 'camera', 'photos', 'media'],
            developerModeUnlocked: false,
            debugModeEnabled: false,
            hideDeveloperCenter: true,
            windowBoundsMemory: {},
            enableAnimation: true,
            enableBlur: true
        };

        Object.keys(defaults).forEach((key) => {
            if (this.settings[key] === undefined) {
                this.settings[key] = defaults[key];
                changed = true;
            }
        });

        // File upload graduated from Lab to Privacy. Enable it once for users
        // upgrading from the former opt-in default, then respect later choices.
        if (needsExternalFileImportDefaultMigration) {
            this.settings.enableExternalFileImport = true;
            this.settings.externalFileImportDefaultVersion = 1;
            changed = true;
        }

        // Keep Process Manager available on the desktop and in All Apps, but do
        // not pin it to the Start home page by default. Version 2 reverses the
        // automatic Start pin added by the first registration migration.
        if (needsProcessManagerRegistration) {
            if (processManagerRegistrationVersion === 1 && Array.isArray(this.settings.startPinnedApps)) {
                this.settings.startPinnedApps = this.settings.startPinnedApps.filter((appId) => appId !== 'process-manager');
            }
            if (this.desktopLayout && Array.isArray(this.desktopLayout.icons) && !this.desktopLayout.icons.some((icon) => icon?.id === 'process-manager' || icon?.appId === 'process-manager')) {
                const nextRow = this.desktopLayout.icons.reduce((max, icon) => Math.max(max, Number(icon?.y) || 0), -1) + 1;
                this.desktopLayout.icons.push({ id: 'process-manager', x: 0, y: nextRow });
                Storage.set(Storage.keys.DESKTOP_LAYOUT, this.desktopLayout);
            }
            this.settings.processManagerRegistrationVersion = 2;
            changed = true;
        }

        if (Array.isArray(this.settings.startPinnedApps) && this.settings.startPinnedApps.includes('settingsnew')) {
            this.settings.startPinnedApps = this.settings.startPinnedApps.filter(appId => appId !== 'settingsnew');
            changed = true;
        }

        if (this.settings.windowBoundsMemory && this.settings.windowBoundsMemory.settingsnew) {
            delete this.settings.windowBoundsMemory.settingsnew;
            changed = true;
        }

        if (this.appUsage && this.appUsage.settingsnew) {
            delete this.appUsage.settingsnew;
            Storage.set(Storage.keys.APP_USAGE, this.appUsage);
        }

        if (this.desktopLayout && Array.isArray(this.desktopLayout.icons)) {
            const beforeCount = this.desktopLayout.icons.length;
            this.desktopLayout.icons = this.desktopLayout.icons.filter(icon => icon && icon.appId !== 'settingsnew' && icon.id !== 'settingsnew');
            if (this.desktopLayout.icons.length !== beforeCount) {
                Storage.set(Storage.keys.DESKTOP_LAYOUT, this.desktopLayout);
            }
        }

        if (this.settings.enableNyouV2 !== true) {
            this.settings.enableNyouV2 = true;
            changed = true;
        }

        const normalizedAccent = this.normalizeAccentColor(this.settings.accentColor);
        if (normalizedAccent !== this.settings.accentColor) {
            this.settings.accentColor = normalizedAccent;
            changed = true;
        }

        const normalizedWallpaperAccent = this.normalizeAccentColor(this.settings.wallpaperAccentColor, normalizedAccent);
        if (normalizedWallpaperAccent !== this.settings.wallpaperAccentColor) {
            this.settings.wallpaperAccentColor = normalizedWallpaperAccent;
            changed = true;
        }

        const normalizedRecentAccentColors = this.normalizeRecentAccentColors(this.settings.recentAccentColors);
        if (JSON.stringify(normalizedRecentAccentColors) !== JSON.stringify(this.settings.recentAccentColors)) {
            this.settings.recentAccentColors = normalizedRecentAccentColors;
            changed = true;
        }

        // Migration: remember prior "enabled" state for startup auto-restore.
        if (this.settings.strictCspEnabled === true && this.settings.strictCspLastEnabled !== true) {
            this.settings.strictCspLastEnabled = true;
            changed = true;
        }

        // Migration: preserve prior custom mode preference for startup restoration.
        if (this.settings.fingoCustomMode === true && this.settings.fingoCustomLastEnabled !== true) {
            this.settings.fingoCustomLastEnabled = true;
            changed = true;
        }

        if (!this.settings.fingoApiStorageType) {
            if (this.settings.fingoApiEncrypted && this.settings.fingoApiEncrypted.ciphertext) {
                this.settings.fingoApiStorageType = 'permanent-encrypted';
            } else {
                this.settings.fingoApiStorageType = 'none';
            }
            changed = true;
        }

        // Default to local SurfAi model if not set
        if (!this.settings.fingoAiMode) {
            this.settings.fingoAiMode = 'local';
            this.settings.fingoCustomMode = false;
            changed = true;
        }
        // Keep customMode in sync with aiMode
        if (this.settings.fingoAiMode === 'local' && this.settings.fingoCustomMode !== false) {
            this.settings.fingoCustomMode = false;
            changed = true;
        }
        if (this.settings.fingoAiMode === 'custom' && this.settings.fingoCustomMode !== true) {
            this.settings.fingoCustomMode = true;
            changed = true;
        }

        const normalizedUserAvatar = this.normalizeUserAvatar(this.settings.userAvatar);
        if (normalizedUserAvatar !== this.settings.userAvatar) {
            this.settings.userAvatar = normalizedUserAvatar;
            changed = true;
        }

        const normalizedTombstoneFreezeDelay = this.normalizeTombstoneFreezeDelay(this.settings.tombstoneFreezeDelayMs);
        if (normalizedTombstoneFreezeDelay !== this.settings.tombstoneFreezeDelayMs) {
            this.settings.tombstoneFreezeDelayMs = normalizedTombstoneFreezeDelay;
            changed = true;
        }

        if (changed) {
            Storage.set(Storage.keys.SETTINGS, this.settings);
        }
    },

    normalizeTombstoneFreezeDelay(value) {
        const fallback = 60 * 1000;
        const min = 3 * 1000;
        const max = 10 * 60 * 1000;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(min, Math.min(max, Math.round(numeric)));
    },

    restoreStrictCspOnStartup() {
        if (!this.settings) return;
        let changed = false;

        if (this.settings.strictCspEnabled !== true && this.settings.strictCspLastEnabled === true) {
            this.settings.strictCspEnabled = true;
            changed = true;
        }

        // If strict CSP is restored, restore last custom-mode preference too.
        if (
            this.settings.strictCspEnabled === true
            && this.settings.fingoCustomMode !== true
            && this.settings.fingoCustomLastEnabled === true
        ) {
            this.settings.fingoCustomMode = true;
            changed = true;
        }

        if (changed) {
            Storage.set(Storage.keys.SETTINGS, this.settings);
        }
    },

    areValuesEqual(a, b) {
        if (Object.is(a, b)) return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch (_) {
            return false;
        }
    },

    // 订阅状态变化
    on(event, callback, options = {}) {
        if (typeof callback !== 'function') return () => {};
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        const key = options && options.key;
        if (key) {
            callback._stateListenerKey = key;
            this.off(event, key);
        } else if (this.listeners[event].includes(callback)) {
            return () => this.off(event, callback);
        }

        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    },

    off(event, callbackOrKey) {
        const list = this.listeners[event];
        if (!Array.isArray(list) || !callbackOrKey) return false;

        const next = list.filter((callback) => {
            if (callback === callbackOrKey) return false;
            if (typeof callbackOrKey === 'string' && callback._stateListenerKey === callbackOrKey) return false;
            return true;
        });

        if (next.length === list.length) return false;
        if (next.length > 0) this.listeners[event] = next;
        else delete this.listeners[event];
        return true;
    },

    once(event, callback, options = {}) {
        let unsubscribe = null;
        const wrapped = (data) => {
            if (unsubscribe) unsubscribe();
            callback(data);
        };
        unsubscribe = this.on(event, wrapped, options);
        return unsubscribe;
    },

    // 触发事件
    emit(event, data) {
        const list = this.listeners[event];
        if (!Array.isArray(list) || list.length === 0) return;
        list.slice().forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`State listener error for "${event}":`, error);
            }
        });
    },

    // 切换视图
    setView(newView) {
        const oldView = this.view;
        this.view = newView;
        this.emit('viewChange', { oldView, newView });
    },

    // 更新设置
    updateSettings(updates) {
        let safeUpdates = { ...(updates || {}) };
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'enableNyouV2')) {
            safeUpdates.enableNyouV2 = true;
        }
        const turningOffCustomMode = safeUpdates.fingoCustomMode === false
            && this.settings
            && this.settings.fingoCustomMode === true;
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'userAvatar')) {
            safeUpdates.userAvatar = this.normalizeUserAvatar(safeUpdates.userAvatar);
        }
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'tombstoneFreezeDelayMs')) {
            safeUpdates.tombstoneFreezeDelayMs = this.normalizeTombstoneFreezeDelay(safeUpdates.tombstoneFreezeDelayMs);
        }
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'accentColor')) {
            safeUpdates.accentColor = this.normalizeAccentColor(safeUpdates.accentColor);
        }
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'wallpaperAccentColor')) {
            safeUpdates.wallpaperAccentColor = this.normalizeAccentColor(safeUpdates.wallpaperAccentColor);
        }
        if (Object.prototype.hasOwnProperty.call(safeUpdates, 'recentAccentColors')) {
            safeUpdates.recentAccentColors = this.normalizeRecentAccentColors(safeUpdates.recentAccentColors);
        }
        if (safeUpdates.strictCspEnabled === true) {
            safeUpdates.strictCspLastEnabled = true;
        } else if (safeUpdates.strictCspEnabled === false) {
            // User explicitly disabled: keep it permanently off.
            safeUpdates.strictCspLastEnabled = false;
        }
        if (safeUpdates.fingoCustomMode === true) {
            if (!Object.prototype.hasOwnProperty.call(safeUpdates, 'fingoCustomLastEnabled')) {
                safeUpdates.fingoCustomLastEnabled = true;
            }
        } else if (safeUpdates.fingoCustomMode === false) {
            if (!Object.prototype.hasOwnProperty.call(safeUpdates, 'fingoCustomLastEnabled')) {
                safeUpdates.fingoCustomLastEnabled = false;
            }
        }
        if (turningOffCustomMode) {
            // Security hardening: when custom mode is disabled, clear all API key material.
            safeUpdates.fingoApiKey = '';
            safeUpdates.fingoApiEncrypted = null;
            safeUpdates.fingoApiStorageType = 'none';
        }

        const changedUpdates = {};
        Object.keys(safeUpdates).forEach((key) => {
            if (!this.areValuesEqual(this.settings && this.settings[key], safeUpdates[key])) {
                changedUpdates[key] = safeUpdates[key];
            }
        });
        safeUpdates = changedUpdates;

        if (Object.keys(safeUpdates).length === 0) {
            return false;
        }

        this.settings = { ...this.settings, ...safeUpdates };
        Storage.set(Storage.keys.SETTINGS, this.settings);
        this.emit('settingsChange', safeUpdates);
        if (turningOffCustomMode) {
            if (typeof window !== 'undefined' && window.Fingo) {
                window.Fingo._sessionApiKey = '';
                window.Fingo._pendingDecryptPromise = null;
            }
            this.emit('fingoApiKeyReady', { storageType: 'none', decrypted: false });
        }
        
        // 应用相关设置
        if (safeUpdates.theme !== undefined) {
            this.applyTheme();
        }
        if (safeUpdates.enableAnimation !== undefined) {
            this.applyAnimationSetting();
        }
        if (safeUpdates.enableBlur !== undefined) {
            this.applyBlurSetting();
        }
        if (safeUpdates.brightness !== undefined) {
            this.applyBrightness();
        }
        if (safeUpdates.volume !== undefined) {
            this.applyVolume();
        }
        if (safeUpdates.enableWindowBlur !== undefined) {
            this.applyWindowBlurSetting();
        }
        if (safeUpdates.invertMode !== undefined) {
            this.applyAccessibility();
        }
        if (safeUpdates.grayscaleMode !== undefined ||
            safeUpdates.highContrastMode !== undefined ||
            safeUpdates.largeTextMode !== undefined ||
            safeUpdates.zoomLevel !== undefined ||
            safeUpdates.colorBlindMode !== undefined ||
            safeUpdates.screenReader !== undefined ||
            safeUpdates.screenReaderRate !== undefined ||
            safeUpdates.screenReaderPitch !== undefined ||
            safeUpdates.screenKeyboard !== undefined) {
            this.applyAccessibility();
        }
        if (safeUpdates.enableNyouV2 !== undefined) {
            this.applyNyouV2Setting();
        }
        if (
            safeUpdates.materialType !== undefined ||
            safeUpdates.blurIntensity !== undefined ||
            safeUpdates.wallpaperDesktop !== undefined ||
            safeUpdates.theme !== undefined
        ) {
            this.applyMaterialSetting();
        }
        if (
            safeUpdates.accentColor !== undefined ||
            safeUpdates.wallpaperAccentColor !== undefined ||
            safeUpdates.accentColorReadability !== undefined ||
            safeUpdates.theme !== undefined
        ) {
            this.applyAccentColorSetting();
        }
        if (
            safeUpdates.accentColorAuto === true ||
            (safeUpdates.wallpaperDesktop !== undefined && this.settings.accentColorAuto === true)
        ) {
            this._wallpaperAccentPromise = this.updateAccentFromWallpaper(this.settings.wallpaperDesktop);
        }
        if (safeUpdates.enableButtonGlowEffect !== undefined) {
            this.applyButtonGlowSetting();
        }
        if (safeUpdates.strictCspEnabled !== undefined) {
            this.applyStrictCspSetting();
        }
        return true;
    },

    // 更新会话
    updateSession(updates) {
        this.session = { ...this.session, ...updates };
        Storage.set(Storage.keys.SESSION, this.session);
        this.emit('sessionChange', updates);
    },

    // 应用主题
    applyTheme() {
        const theme = this.settings.theme;
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (theme === 'light') {
            document.body.classList.remove('dark-mode');
        } else if (theme === 'auto') {
            // 根据系统时间自动切换
            const hour = new Date().getHours();
            if (hour >= 18 || hour < 6) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }
        // 广播系统主题变更事件，方便应用（如 Office）实时同步
        try {
            const isDarkMode = document.body.classList.contains('dark-mode');
            const payload = {
                theme: isDarkMode ? 'dark' : 'light',
                isDarkMode
            };
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('systemThemeChanged', { detail: payload }));
            }
        } catch (e) {
            // ignore
        }
    },

    normalizeAccentColor(value, fallback = '#0078d4') {
        const raw = String(value || '').trim();
        const match = raw.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (!match) return fallback;
        const hex = match[1].length === 3
            ? match[1].split('').map((char) => char + char).join('')
            : match[1];
        return `#${hex.toLowerCase()}`;
    },

    normalizeRecentAccentColors(colors) {
        const defaults = ['#d83b01', '#0078d4', '#00b7c3', '#4c4a48', '#e81123'];
        const source = Array.isArray(colors) && colors.length ? colors : defaults;
        const seen = new Set();
        return source
            .map((color) => this.normalizeAccentColor(color, ''))
            .filter((color) => color && !seen.has(color) && seen.add(color))
            .slice(0, 8);
    },

    addRecentAccentColor(color, colors = null) {
        const normalized = this.normalizeAccentColor(color);
        const source = Array.isArray(colors) ? colors : this.settings.recentAccentColors;
        return this.normalizeRecentAccentColors([normalized, ...(source || [])]);
    },

    hexToRgb(hex) {
        const normalized = this.normalizeAccentColor(hex);
        const value = parseInt(normalized.slice(1), 16);
        return {
            r: (value >> 16) & 255,
            g: (value >> 8) & 255,
            b: value & 255
        };
    },

    rgbToHex(r, g, b) {
        const toHex = (value) => Math.max(0, Math.min(255, Math.round(value)))
            .toString(16)
            .padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                default:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }

        return { h, s, l };
    },

    hslToRgb(h, s, l) {
        if (s === 0) {
            const gray = l * 255;
            return { r: gray, g: gray, b: gray };
        }

        const hueToRgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return {
            r: hueToRgb(p, q, h + 1 / 3) * 255,
            g: hueToRgb(p, q, h) * 255,
            b: hueToRgb(p, q, h - 1 / 3) * 255
        };
    },

    createAccentHoverColor(hex) {
        const { r, g, b } = this.hexToRgb(hex);
        const hsl = this.rgbToHsl(r, g, b);
        hsl.s = Math.min(0.92, hsl.s + 0.05);
        hsl.l = document.body && document.body.classList.contains('dark-mode')
            ? Math.min(0.78, hsl.l + 0.08)
            : Math.max(0.26, hsl.l - 0.08);
        const next = this.hslToRgb(hsl.h, hsl.s, hsl.l);
        return this.rgbToHex(next.r, next.g, next.b);
    },

    optimizeAccentColorForReadability(hex) {
        if (this.settings.accentColorReadability !== true || typeof document === 'undefined') {
            return this.normalizeAccentColor(hex);
        }

        const { r, g, b } = this.hexToRgb(hex);
        const hsl = this.rgbToHsl(r, g, b);
        const isDarkMode = document.body && document.body.classList.contains('dark-mode');

        hsl.s = Math.min(0.9, Math.max(0.34, hsl.s + 0.02));
        hsl.l = isDarkMode
            ? Math.min(0.74, hsl.l + (hsl.l < 0.5 ? 0.1 : 0.06))
            : Math.max(0.24, hsl.l - (hsl.l > 0.55 ? 0.1 : 0.06));

        const next = this.hslToRgb(hsl.h, hsl.s, hsl.l);
        return this.rgbToHex(next.r, next.g, next.b);
    },

    applyAccentColorSetting() {
        if (typeof document === 'undefined') return;
        const rawAccent = this.normalizeAccentColor(this.settings.accentColor);
        const accent = this.optimizeAccentColorForReadability(rawAccent);
        const hover = this.createAccentHoverColor(accent);
        const { r, g, b } = this.hexToRgb(accent);
        const targets = [document.documentElement, document.body].filter(Boolean);

        // 根据主题色明度计算前景对比色：浅色主题色→黑字，深色主题色→白字
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const contrastFg = luminance > 0.6 ? '#1b1b1b' : '#ffffff';

        targets.forEach((target) => {
            target.style.setProperty('--accent', accent);
            target.style.setProperty('--accent-raw', rawAccent);
            target.style.setProperty('--accent-hover', hover);
            target.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
            target.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.16)`);
            target.style.setProperty('--accent-contrast', contrastFg);
        });
        // accent-deep：主题色较深（前景应为白色）
        if (document.body) {
            document.body.classList.toggle('accent-deep', contrastFg === '#ffffff');
        }
    },

    async updateAccentFromWallpaper(wallpaper) {
        if (typeof document === 'undefined') return null;
        let source = wallpaper || this.settings.wallpaperDesktop;
        if (typeof WallpaperStore !== 'undefined' && !WallpaperStore.isBuiltIn(source)) {
            source = await this.resolveWallpaper('desktop');
        }
        if (!source) return null;
        const token = (this._accentExtractionToken || 0) + 1;
        this._accentExtractionToken = token;

        try {
            const color = await this.extractAccentColorFromImage(source);
            if (!color || this._accentExtractionToken !== token || this.settings.accentColorAuto !== true) {
                return color || null;
            }
            this.updateSettings({
                accentColor: color,
                wallpaperAccentColor: color,
                recentAccentColors: this.addRecentAccentColor(color)
            });
            return color;
        } catch (error) {
            console.warn('Accent color extraction failed', error);
            return null;
        }
    },

    async extractAccentColorFromImage(src) {
        const tryImage = async (imageSrc, shouldRevoke = false) => {
            try {
                const img = await this.loadImageForAccentExtraction(imageSrc);
                return this.sampleAccentColorFromImage(img);
            } finally {
                if (shouldRevoke && typeof URL !== 'undefined') URL.revokeObjectURL(imageSrc);
            }
        };

        try {
            return await tryImage(src);
        } catch (firstError) {
            if (!/^https?:\/\//i.test(String(src || '')) || typeof fetch !== 'function' || typeof URL === 'undefined') {
                throw firstError;
            }
            const response = await fetch(src, { mode: 'cors' });
            const blob = await response.blob();
            return tryImage(URL.createObjectURL(blob), true);
        }
    },

    loadImageForAccentExtraction(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            if (!/^data:image\//i.test(String(src || '')) && !/^blob:/i.test(String(src || ''))) {
                img.crossOrigin = 'anonymous';
            }
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    sampleAccentColorFromImage(img) {
        const canvas = document.createElement('canvas');
        const width = Math.max(1, Math.min(112, img.naturalWidth || img.width || 112));
        const height = Math.max(1, Math.min(72, img.naturalHeight || img.height || 72));
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const buckets = new Map();

        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < 170) continue;

            const hsl = this.rgbToHsl(r, g, b);
            if (hsl.l < 0.16 || hsl.l > 0.86 || hsl.s < 0.16) continue;

            const key = [
                Math.round(r / 24) * 24,
                Math.round(g / 24) * 24,
                Math.round(b / 24) * 24
            ].join(',');
            const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, weight: 0, score: 0 };
            const vividness = hsl.s * 2.2 + (1 - Math.abs(hsl.l - 0.52)) * 1.3;
            const weight = 1 + vividness;
            bucket.r += r * weight;
            bucket.g += g * weight;
            bucket.b += b * weight;
            bucket.weight += weight;
            bucket.score += weight;
            buckets.set(key, bucket);
        }

        let best = null;
        buckets.forEach((bucket) => {
            if (!best || bucket.score > best.score) best = bucket;
        });
        if (!best || best.weight <= 0) return null;

        const avg = {
            r: best.r / best.weight,
            g: best.g / best.weight,
            b: best.b / best.weight
        };
        const hsl = this.rgbToHsl(avg.r, avg.g, avg.b);
        hsl.s = Math.max(0.38, Math.min(0.86, hsl.s));
        hsl.l = Math.max(0.32, Math.min(0.62, hsl.l));
        const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
        return this.rgbToHex(rgb.r, rgb.g, rgb.b);
    },

    // 应用动画设置
    applyAnimationSetting() {
        if (this.settings.enableAnimation) {
            document.body.classList.remove('animations-disabled');
            document.body.classList.add('animations-enabled');
        } else {
            document.body.classList.remove('animations-enabled');
            document.body.classList.add('animations-disabled');
        }
    },

    // 应用模糊设置
    applyBlurSetting() {
        if (this.settings.enableBlur) {
            document.body.classList.remove('blur-disabled');
            document.body.classList.add('blur-enabled');
        } else {
            document.body.classList.remove('blur-enabled');
            document.body.classList.add('blur-disabled');
        }
    },

    // 应用亮度设置
    applyBrightness() {
        const brightness = this.settings.brightness || 100;
        document.body.style.filter = `brightness(${brightness}%)`;
    },

    // 应用音量设置
    applyVolume() {
        const rawVolume = Number(this.settings.volume ?? 50);
        const volume = Math.min(100, Math.max(0, Number.isFinite(rawVolume) ? rawVolume : 50));

        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        if (volumeSlider) volumeSlider.value = String(volume);
        if (volumeValue) volumeValue.textContent = String(volume);

        if (typeof MediaApp !== 'undefined' && typeof MediaApp.syncVolumeFromState === 'function') {
            MediaApp.syncVolumeFromState();
        }
    },

    // 应用窗口模糊设置
    applyWindowBlurSetting() {
        if (this.settings.enableWindowBlur === true) {
            document.body.classList.add('window-blur-enabled');
            document.body.classList.remove('window-blur-disabled');
        } else {
            document.body.classList.add('window-blur-disabled');
            document.body.classList.remove('window-blur-enabled');
        }
    },

    // 应用反色模式（辅助功能）
    applyInvertMode() {
        this.applyAccessibility();
    },

    applyAccessibility() {
        const html = document.documentElement;
        const s = this.settings;

        // 确保辅助功能 style 标签存在
        let style = document.getElementById('nyou-a11y-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'nyou-a11y-style';
            document.head.appendChild(style);
        }

        // 组合 CSS filter
        const filters = [];
        if (s.invertMode === true) {
            filters.push('invert(1) hue-rotate(180deg)');
        }
        if (s.grayscaleMode === true) {
            filters.push('grayscale(1)');
        }
        if (s.highContrastMode === true) {
            filters.push('contrast(1.4)');
        }
        // 色弱模式（用 SVG 滤镜近似）
        const colorBlindSVG = {
            protanopia: 'url(#nyou-cb-protanopia)',
            deuteranopia: 'url(#nyou-cb-deuteranopia)',
            tritanopia: 'url(#nyou-cb-tritanopia)'
        };
        if (s.colorBlindMode && colorBlindSVG[s.colorBlindMode]) {
            filters.push(colorBlindSVG[s.colorBlindMode]);
        }

        const filterStr = filters.length ? filters.join(' ') : 'none';

        // 放大级别
        const zoom = Math.max(0.75, Math.min(2, Number(s.zoomLevel ?? 1)));

        // 大字体
        const fontSize = s.largeTextMode === true ? '18px' : '16px';

        style.textContent = `
            html.nyou-a11y-active {
                filter: ${filterStr};
                font-size: ${fontSize};
            }
            html.nyou-a11y-active img,
            html.nyou-a11y-active video,
            html.nyou-a11y-active canvas {
                ${s.invertMode === true ? 'filter: invert(1) hue-rotate(180deg);' : ''}
            }
            html.nyou-a11y-zoom {
                zoom: ${zoom};
            }
            /* 色弱 SVG 滤镜 */
            svg.nyou-a11y-svg-filters { position: absolute; width: 0; height: 0; }
        `;

        // 注入色弱 SVG 滤镜（如果需要）
        if (s.colorBlindMode && s.colorBlindMode !== 'none') {
            this._injectColorBlindSVG();
        }

        // 应用 class
        const hasA11y = s.invertMode === true || s.grayscaleMode === true || s.highContrastMode === true
            || s.largeTextMode === true || (s.colorBlindMode && s.colorBlindMode !== 'none');
        html.classList.toggle('nyou-a11y-active', hasA11y);
        html.classList.toggle('nyou-a11y-zoom', zoom !== 1);

        // 减少动画（复用 enableAnimation）
        if (s.enableAnimation === false) {
            html.classList.add('nyou-reduced-motion');
        } else {
            html.classList.remove('nyou-reduced-motion');
        }

        // 旁白（屏幕阅读器）
        this.applyScreenReader();

        // 屏幕键盘
        this.applyScreenKeyboard();
    },

    // 注入色弱 SVG 滤镜
    _injectColorBlindSVG() {
        if (document.getElementById('nyou-a11y-cb-svg')) return;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'nyou-a11y-cb-svg';
        svg.setAttribute('class', 'nyou-a11y-svg-filters');
        svg.innerHTML = `
            <defs>
                <filter id="nyou-cb-protanopia">
                    <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/>
                </filter>
                <filter id="nyou-cb-deuteranopia">
                    <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/>
                </filter>
                <filter id="nyou-cb-tritanopia">
                    <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/>
                </filter>
            </defs>
        `;
        document.body.appendChild(svg);
    },

    // ===== 旁白（屏幕阅读器）=====
    _screenReaderHandlers: null,
    _speakDebounceTimer: null,
    _lastSpokenText: '',

    // 应用旁白设置
    applyScreenReader() {
        const enabled = this.settings.screenReader === true;
        if (enabled) {
            this._enableScreenReader();
        } else {
            this._disableScreenReader();
        }
    },

    // 启用旁白
    _enableScreenReader() {
        if (this._screenReaderHandlers) return;

        const speak = (text) => this.speak(text);

        // 鼠标悬停朗读
        const onMouseOver = (e) => {
            if (e.target.closest('.nyou-a11y-panel, #oobe-a11y-panel, #control-a11y-panel')) return;
            const text = this._extractReadableText(e.target);
            if (text) {
                clearTimeout(this._speakDebounceTimer);
                this._speakDebounceTimer = setTimeout(() => speak(text), 300);
            }
        };

        // 焦点朗读
        const onFocusIn = (e) => {
            const text = this._extractReadableText(e.target);
            if (text) {
                clearTimeout(this._speakDebounceTimer);
                this._speakDebounceTimer = setTimeout(() => speak(text), 100);
            }
        };

        // 鼠标移出停止
        const onMouseOut = (e) => {
            if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
                clearTimeout(this._speakDebounceTimer);
            }
        };

        document.addEventListener('mouseover', onMouseOver, true);
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('mouseout', onMouseOut, true);

        this._screenReaderHandlers = { onMouseOver, onFocusIn, onMouseOut };

        // 提示旁白已开启
        setTimeout(() => this.speak('旁白已开启'), 200);
    },

    // 禁用旁白
    _disableScreenReader() {
        if (!this._screenReaderHandlers) return;
        const { onMouseOver, onFocusIn, onMouseOut } = this._screenReaderHandlers;
        document.removeEventListener('mouseover', onMouseOver, true);
        document.removeEventListener('focusin', onFocusIn, true);
        document.removeEventListener('mouseout', onMouseOut, true);
        this._screenReaderHandlers = null;
        clearTimeout(this._speakDebounceTimer);
        this.stopSpeak();
    },

    // 朗读文本
    speak(text) {
        if (!text || !text.trim()) return;
        if (text === this._lastSpokenText) return;
        this._lastSpokenText = text;

        if (!('speechSynthesis' in window)) {
            console.warn('SpeechSynthesis not supported');
            return;
        }

        try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = Math.max(0.5, Math.min(2, Number(this.settings.screenReaderRate || 1)));
            utterance.pitch = Math.max(0, Math.min(2, Number(this.settings.screenReaderPitch || 1)));
            utterance.volume = 1;
            // 尝试使用中文语音
            const voices = window.speechSynthesis.getVoices();
            const zhVoice = voices.find(v => v.lang.startsWith('zh'));
            if (zhVoice) utterance.voice = zhVoice;
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('Speak failed:', e);
        }
    },

    // 停止朗读
    stopSpeak() {
        if ('speechSynthesis' in window) {
            try { window.speechSynthesis.cancel(); } catch (e) {}
        }
        this._lastSpokenText = '';
    },

    // 从元素提取可朗读的文本
    _extractReadableText(el) {
        if (!el || el.nodeType !== 1) return '';

        // 跳过不需要朗读的元素
        if (el.closest('script, style, template, .a11y-skip')) return '';

        // 优先读取 aria-label
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        // 读取 title
        const title = el.getAttribute('title');
        if (title) return title;

        // 读取 alt（图片）
        const alt = el.getAttribute('alt');
        if (alt) return alt;

        // 读取 placeholder（输入框）
        const placeholder = el.getAttribute('placeholder');
        if (placeholder && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return placeholder;

        // 读取文本内容
        let text = '';
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'LABEL') {
            text = el.textContent.trim();
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            text = el.value || placeholder || '';
        } else {
            // 对于其他元素，读取直接子文本或最近的文本节点
            text = (el.innerText || el.textContent || '').trim().substring(0, 100);
        }

        // 如果当前元素没有文本，尝试父元素
        if (!text && el.parentElement) {
            const parentText = (el.parentElement.innerText || el.parentElement.textContent || '').trim().substring(0, 100);
            if (parentText && parentText.length < 50) text = parentText;
        }

        return text;
    },

    // ===== 屏幕键盘 =====
    _screenKeyboardEl: null,
    _screenKeyboardShift: false,
    _screenKeyboardSymbol: false,
    _screenKeyboardFocusedEl: null,
    _screenKeyboardDrag: null,

    applyScreenKeyboard() {
        const enabled = this.settings.screenKeyboard === true;
        if (enabled) {
            this._enableScreenKeyboard();
        } else {
            this._disableScreenKeyboard();
        }
    },

    _enableScreenKeyboard() {
        if (this._screenKeyboardEl) {
            this._showScreenKeyboard();
            return;
        }
        this._createScreenKeyboard();
        document.addEventListener('focusin', this._screenKeyboardOnFocus.bind(this));
        document.addEventListener('focusout', this._screenKeyboardOnBlur.bind(this));
        // 开启后立即显示键盘
        this._showScreenKeyboard();
    },

    _disableScreenKeyboard() {
        document.removeEventListener('focusin', this._screenKeyboardOnFocus.bind(this));
        document.removeEventListener('focusout', this._screenKeyboardOnBlur.bind(this));
        if (this._screenKeyboardEl) {
            this._screenKeyboardEl.remove();
            this._screenKeyboardEl = null;
        }
        this._screenKeyboardFocusedEl = null;
    },

    _screenKeyboardOnFocus(e) {
        const el = e.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
            if (!el.closest('.nyou-screen-keyboard')) {
                this._screenKeyboardFocusedEl = el;
                this._showScreenKeyboard();
            }
        }
    },

    _screenKeyboardOnBlur(e) {
        // 不自动隐藏键盘，保持显示直到手动关闭或关闭开关
        // 点击键盘按键时重新聚焦到输入框
        setTimeout(() => {
            if (this._screenKeyboardFocusedEl && document.activeElement !== this._screenKeyboardFocusedEl) {
                // 如果焦点不在输入框也不在键盘内，保持键盘显示但不强制聚焦
            }
        }, 100);
    },

    _createScreenKeyboard() {
        const kb = document.createElement('div');
        kb.className = 'nyou-screen-keyboard';
        kb.id = 'nyou-screen-keyboard';
        kb.innerHTML = `
            <div class="nyou-kb-header">
                <span class="nyou-kb-title">屏幕键盘</span>
                <button class="nyou-kb-close" type="button" title="关闭">×</button>
            </div>
            <div class="nyou-kb-keys" id="nyou-kb-keys"></div>
        `;
        document.body.appendChild(kb);
        this._screenKeyboardEl = kb;

        // 关闭按钮
        kb.querySelector('.nyou-kb-close').addEventListener('click', () => {
            this._hideScreenKeyboard();
        });

        // 拖动
        const header = kb.querySelector('.nyou-kb-header');
        header.addEventListener('mousedown', (e) => this._startKbDrag(e));
        document.addEventListener('mousemove', (e) => this._onKbDrag(e));
        document.addEventListener('mouseup', () => this._endKbDrag());

        this._renderKbKeys();
        this._injectKbStyles();
    },

    _injectKbStyles() {
        if (document.getElementById('nyou-kb-styles')) return;
        const style = document.createElement('style');
        style.id = 'nyou-kb-styles';
        style.textContent = `
            .nyou-screen-keyboard {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(30,30,30,0.95);
                backdrop-filter: blur(20px);
                border-radius: 12px;
                padding: 8px;
                z-index: 99999;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                border: 1px solid rgba(255,255,255,0.1);
                user-select: none;
                display: none;
            }
            .nyou-screen-keyboard.show { display: block; }
            .nyou-kb-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px 8px;
                cursor: move;
            }
            .nyou-kb-title {
                font-size: 12px;
                color: rgba(255,255,255,0.6);
            }
            .nyou-kb-close {
                border: none;
                background: transparent;
                color: rgba(255,255,255,0.6);
                font-size: 18px;
                cursor: pointer;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .nyou-kb-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
            .nyou-kb-keys { display: flex; flex-direction: column; gap: 6px; }
            .nyou-kb-row { display: flex; gap: 6px; justify-content: center; }
            .nyou-kb-key {
                min-width: 36px;
                height: 40px;
                padding: 0 10px;
                border: none;
                border-radius: 6px;
                background: rgba(255,255,255,0.15);
                color: #fff;
                font-size: 15px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.1s;
                font-family: inherit;
            }
            .nyou-kb-key:hover { background: rgba(255,255,255,0.25); }
            .nyou-kb-key:active { background: rgba(255,255,255,0.35); transform: scale(0.95); }
            .nyou-kb-key.wide { min-width: 60px; }
            .nyou-kb-key.space { flex: 1; min-width: 200px; }
            .nyou-kb-key.function { background: rgba(255,255,255,0.08); font-size: 12px; }
            .nyou-kb-key.function:hover { background: rgba(255,255,255,0.15); }
            .nyou-kb-key.active { background: #0078d4; }
        `;
        document.head.appendChild(style);
    },

    _renderKbKeys() {
        const container = this._screenKeyboardEl?.querySelector('#nyou-kb-keys');
        if (!container) return;

        const shift = this._screenKeyboardShift;
        const symbol = this._screenKeyboardSymbol;

        let rows;
        if (symbol) {
            rows = [
                ['1','2','3','4','5','6','7','8','9','0'],
                ['-','/',':',';','(',')','$','&','@','"'],
                ['.',',','?','!','\'','#','%','*','+','='],
                [{label:'ABC', action:'symbol', wide:true}, {label:'space', action:'space', space:true}, {label:'return', action:'enter', wide:true}]
            ];
        } else {
            const letters = shift
                ? ['Q','W','E','R','T','Y','U','I','O','P']
                : ['q','w','e','r','t','y','u','i','o','p'];
            const row2 = shift
                ? ['A','S','D','F','G','H','J','K','L']
                : ['a','s','d','f','g','h','j','k','l'];
            const row3 = shift
                ? ['Z','X','C','V','B','N','M']
                : ['z','x','c','v','b','n','m'];

            rows = [
                letters,
                row2,
                [{label:'⇧', action:'shift', wide:true}, ...row3, {label:'⌫', action:'backspace', wide:true}],
                [{label:'123', action:'symbol', wide:true}, {label:'space', action:'space', space:true}, {label:'return', action:'enter', wide:true}]
            ];
        }

        container.innerHTML = '';
        rows.forEach(row => {
            const rowEl = document.createElement('div');
            rowEl.className = 'nyou-kb-row';
            row.forEach(key => {
                const btn = document.createElement('button');
                btn.className = 'nyou-kb-key';
                if (typeof key === 'string') {
                    btn.textContent = key;
                    btn.addEventListener('click', () => this._kbInput(key));
                } else {
                    btn.textContent = key.label;
                    if (key.wide) btn.classList.add('wide');
                    if (key.space) btn.classList.add('space');
                    if (key.action === 'shift' && shift) btn.classList.add('active');
                    btn.classList.add('function');
                    btn.addEventListener('click', () => this._kbAction(key.action));
                }
                rowEl.appendChild(btn);
            });
            container.appendChild(rowEl);
        });
    },

    _kbInput(char) {
        const el = this._screenKeyboardFocusedEl;
        if (!el) return;

        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            const start = el.selectionStart || el.value.length;
            const end = el.selectionEnd || el.value.length;
            el.value = el.value.substring(0, start) + char + el.value.substring(end);
            el.selectionStart = el.selectionEnd = start + char.length;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (el.isContentEditable) {
            document.execCommand('insertText', false, char);
        }

        // 输入字符后关闭 shift（如果是单次 shift）
        if (this._screenKeyboardShift && !this._screenKeyboardShiftLocked) {
            this._screenKeyboardShift = false;
            this._renderKbKeys();
        }
    },

    _kbAction(action) {
        const el = this._screenKeyboardFocusedEl;
        switch (action) {
            case 'shift':
                this._screenKeyboardShift = !this._screenKeyboardShift;
                this._renderKbKeys();
                break;
            case 'symbol':
                this._screenKeyboardSymbol = !this._screenKeyboardSymbol;
                this._screenKeyboardShift = false;
                this._renderKbKeys();
                break;
            case 'backspace':
                if (el) {
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        const start = el.selectionStart || el.value.length;
                        const end = el.selectionEnd || el.value.length;
                        if (start !== end) {
                            el.value = el.value.substring(0, start) + el.value.substring(end);
                            el.selectionStart = el.selectionEnd = start;
                        } else if (start > 0) {
                            el.value = el.value.substring(0, start - 1) + el.value.substring(end);
                            el.selectionStart = el.selectionEnd = start - 1;
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    } else if (el.isContentEditable) {
                        document.execCommand('delete');
                    }
                }
                break;
            case 'space':
                this._kbInput(' ');
                break;
            case 'enter':
                if (el) {
                    if (el.tagName === 'TEXTAREA') {
                        this._kbInput('\n');
                    } else if (el.tagName === 'INPUT') {
                        el.form?.requestSubmit();
                        el.blur();
                        this._hideScreenKeyboard();
                    }
                }
                break;
        }
    },

    _showScreenKeyboard() {
        if (this._screenKeyboardEl) {
            this._screenKeyboardEl.classList.add('show');
        }
    },

    _hideScreenKeyboard() {
        if (this._screenKeyboardEl) {
            this._screenKeyboardEl.classList.remove('show');
        }
    },

    _startKbDrag(e) {
        if (!this._screenKeyboardEl) return;
        const rect = this._screenKeyboardEl.getBoundingClientRect();
        this._screenKeyboardDrag = {
            startX: e.clientX,
            startY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top
        };
        this._screenKeyboardEl.style.transform = 'none';
        e.preventDefault();
    },

    _onKbDrag(e) {
        if (!this._screenKeyboardDrag || !this._screenKeyboardEl) return;
        const dx = e.clientX - this._screenKeyboardDrag.startX;
        const dy = e.clientY - this._screenKeyboardDrag.startY;
        this._screenKeyboardEl.style.left = (this._screenKeyboardDrag.startLeft + dx) + 'px';
        this._screenKeyboardEl.style.top = (this._screenKeyboardDrag.startTop + dy) + 'px';
        this._screenKeyboardEl.style.bottom = 'auto';
    },

    _endKbDrag() {
        this._screenKeyboardDrag = null;
    },

    // 应用新版 UI 设置
    applyNyouV2Setting() {
        this.settings.enableNyouV2 = true;
        document.body.classList.add('Nyou-v2');
    },

    applyMaterialSetting(wallpaperOverride = null) {
        const material = this.settings.materialType === 'mica' ? 'mica' : 'gaussian';
        const blur = Math.max(10, Math.min(70, Number(this.settings.blurIntensity ?? 40)));
        const materialBlur = blur;
        const lightBlur = Math.max(8, Math.round(materialBlur * 0.5));
        const smallBlur = Math.max(6, Math.round(materialBlur * 0.35));
        const wallpaper = wallpaperOverride || this.getResolvedWallpaper('desktop');
        let safeWallpaper = String(wallpaper).replace(/\\/g, '/').replace(/"/g, '\\"');
        // Convert relative paths to absolute URLs so CSS variables resolve
        // correctly regardless of which stylesheet uses them.
        if (safeWallpaper && !/^(https?:|data:|blob:|file:|\/)/i.test(safeWallpaper)) {
            try {
                safeWallpaper = new URL(safeWallpaper, location.href).href;
            } catch (_) { /* keep original */ }
        }

        document.body.classList.remove(
            'material-gaussian',
            'material-mica'
        );
        document.body.classList.add(`material-${material}`);
        document.body.style.setProperty('--v2-blur', `${materialBlur}px`);
        document.body.style.setProperty('--v2-blur-light', `${lightBlur}px`);
        document.body.style.setProperty('--blur-lg', `${materialBlur}px`);
        document.body.style.setProperty('--blur-md', `${lightBlur}px`);
        document.body.style.setProperty('--blur-sm', `${smallBlur}px`);
        document.body.style.setProperty('--Nyou-material-blur', `${materialBlur}px`);
        document.body.style.setProperty('--Nyou-material-blur-light', `${lightBlur}px`);
        document.body.style.setProperty('--Nyou-wallpaper-url', `url("${safeWallpaper}")`);
    },

    applyButtonGlowSetting() {
        const enabled = this.settings.enableButtonGlowEffect !== false;
        if (typeof document === 'undefined' || !document.body) return;
        document.body.classList.toggle('button-glow-enabled', enabled);
        this.ensureButtonGlowListeners();
        if (!enabled) {
            this.clearButtonGlowTarget();
        }
    },

    ensureButtonGlowListeners() {
        if (this._buttonGlowListenersReady === true || typeof document === 'undefined') return;
        this._buttonGlowListenersReady = true;
        this._buttonGlowTarget = null;
        this._buttonGlowSelector = [
            'button',
            'a[href]',
            '[role="button"]',
            '.nyou-btn',
            '.nyou-icon-btn',
            '.Nyou-toggle-wrapper',
            '.Nyou-select-trigger',
            '.Nyou-tab-close',
            '.window-control-btn',
            '.taskbar-btn',
            '.desktop-icon',
            '.start-app',
            '.start-app-item',
            '.start-all-app-row',
            '.recent-item',
            '.start-section-link',
            '.start-footer-btn',
            '.start-power-btn',
            '.fw-nav-item',
            '.settings-advanced-entry',
            '.settings-recommend-item',
            '.settings-recent-item',
            '.network-option-item',
            '.app-list-item',
            '.wallpaper-item',
            '.settings-about-hero-card',
            '.widgets-sidebar-item'
        ].join(',');

        document.addEventListener('pointermove', (event) => this.handleButtonGlowPointerMove(event), { passive: true });
        document.addEventListener('pointerout', (event) => this.handleButtonGlowPointerOut(event), { passive: true });
        document.addEventListener('pointerdown', (event) => this.handleButtonGlowPointerDown(event), { passive: true });
    },

    getButtonGlowTarget(source) {
        if (!source || !document.body.classList.contains('button-glow-enabled')) return null;
        const toggleWrapper = source.closest ? source.closest('.Nyou-toggle-wrapper') : null;
        if (toggleWrapper) {
            if (toggleWrapper.classList.contains('Nyou-toggle-disabled')) return null;
            return toggleWrapper.querySelector('.Nyou-toggle-track');
        }
        const target = source.closest ? source.closest(this._buttonGlowSelector) : null;
        if (!target || target.closest('.button-glow-disabled')) return null;
        if (target.disabled || target.getAttribute('aria-disabled') === 'true') return null;
        return target;
    },

    prepareButtonGlowTarget(target) {
        if (!target || target.dataset.buttonGlowReady === 'true') return;
        target.dataset.buttonGlowReady = 'true';
        target.classList.add('button-glow-target');
        if (target.classList.contains('Nyou-toggle-track')) {
            const surface = document.createElement('span');
            surface.className = 'button-toggle-glow-surface';
            surface.setAttribute('aria-hidden', 'true');
            const edge = document.createElement('span');
            edge.className = 'button-edge-glow';
            edge.setAttribute('aria-hidden', 'true');
            surface.appendChild(edge);
            target.insertBefore(surface, target.firstChild);
            return;
        }
        const edge = document.createElement('span');
        edge.className = 'button-edge-glow';
        edge.setAttribute('aria-hidden', 'true');
        target.appendChild(edge);
    },

    clearButtonGlowTarget(target = this._buttonGlowTarget) {
        if (!target) return;
        target.classList.remove('button-glow-hover');
        if (this._buttonGlowTarget === target) {
            this._buttonGlowTarget = null;
        }
    },

    updateButtonGlowPosition(target, event) {
        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
        target.style.setProperty('--button-glow-x', `${x}px`);
        target.style.setProperty('--button-glow-y', `${y}px`);
    },

    handleButtonGlowPointerMove(event) {
        const target = this.getButtonGlowTarget(event.target);
        if (!target) {
            this.clearButtonGlowTarget();
            return;
        }
        this.prepareButtonGlowTarget(target);
        if (this._buttonGlowTarget && this._buttonGlowTarget !== target) {
            this.clearButtonGlowTarget(this._buttonGlowTarget);
        }
        this._buttonGlowTarget = target;
        this.updateButtonGlowPosition(target, event);
        target.classList.add('button-glow-hover');
    },

    handleButtonGlowPointerOut(event) {
        const target = this._buttonGlowTarget;
        if (!target) return;
        const related = event.relatedTarget;
        if (related && target.contains(related)) return;
        this.clearButtonGlowTarget(target);
    },

    handleButtonGlowPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        const target = this.getButtonGlowTarget(event.target);
        if (!target) return;
        this.prepareButtonGlowTarget(target);
        this.updateButtonGlowPosition(target, event);
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2.25;
        const ripple = document.createElement('span');
        ripple.className = 'button-glow-ripple';
        ripple.setAttribute('aria-hidden', 'true');
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        const toggleSurface = target.classList.contains('Nyou-toggle-track')
            ? target.querySelector('.button-toggle-glow-surface')
            : null;
        (toggleSurface || target).appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    },

    applyStrictCspSetting() {
        const enabled = this.settings.strictCspEnabled === true;
        document.body.classList.toggle('strict-csp-enabled', enabled);
        if (typeof window !== 'undefined' &&
            window.RealCSP &&
            typeof window.RealCSP.apply === 'function') {
            window.RealCSP.apply(enabled);
        }
        if (typeof window !== 'undefined' &&
            window.StrictScriptGuard &&
            typeof window.StrictScriptGuard.setEnabled === 'function') {
            window.StrictScriptGuard.setEnabled(enabled);
        }
    },

    // 添加通知
    addNotification(notification) {
        const { playSound = true, ...notificationData } = notification || {};
        const newNotification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            time: new Date().toISOString(),
            type: 'info',
            ...notificationData
        };
        this.notifications.unshift(newNotification);
        
        // 普通通知最多保留 50 条；手动关闭型提醒不参与自动淘汰。
        let regularNotificationCount = 0;
        this.notifications = this.notifications.filter(item => {
            if (item.manualDismissOnly === true) return true;
            regularNotificationCount += 1;
            return regularNotificationCount <= 50;
        });
        
        Storage.set(Storage.keys.NOTIFICATIONS, this.notifications);
        this.emit('notificationAdd', newNotification);
        if (playSound !== false && typeof SystemInteractionAudio !== 'undefined') {
            SystemInteractionAudio.playNotification(newNotification.type);
        }
        return newNotification.id;
    },

    // 删除通知
    removeNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        Storage.set(Storage.keys.NOTIFICATIONS, this.notifications);
        this.emit('notificationRemove', id);
    },

    // 清空所有通知
    clearNotifications() {
        // 需要用户明确点击关闭按钮的提醒不能被“全部清除”误删。
        this.notifications = this.notifications.filter(notification => notification.manualDismissOnly === true);
        Storage.set(Storage.keys.NOTIFICATIONS, this.notifications);
        this.emit('notificationsClear');
    },

    // 文件系统操作
    updateFS(newFS) {
        this.fs = newFS;
        const saved = Storage.set(Storage.keys.FS, this.fs);
        this.emit('fsChange', newFS);
        if (globalThis.NyouOSStorage) NyouOSStorage.invalidate();
        return saved;
    },

    // 查找文件/文件夹
    findNode(id, node = this.fs.root) {
        if (node.id === id) return node;
        if (node.children) {
            for (const child of node.children) {
                const result = this.findNode(id, child);
                if (result) return result;
            }
        }
        return null;
    },

    // 查找父节点
    findParentNode(id, node = this.fs.root, parent = null) {
        if (!node) return null;
        if (node.id === id) return parent;
        if (node.children) {
            for (const child of node.children) {
                const result = this.findParentNode(id, child, node);
                if (result) return result;
            }
        }
        return null;
    },

    // 添加应用到运行列表
    addRunningApp(appId) {
        this.runningApps.add(appId);
        this.emit('appStart', appId);
    },

    recordAppUsage(appId, timestamp = Date.now()) {
        if (!appId) return;
        if (!this.appUsage || typeof this.appUsage !== 'object') {
            this.appUsage = {};
        }
        this.appUsage[appId] = timestamp;
        Storage.set(Storage.keys.APP_USAGE, this.appUsage);
        this.emit('appUsageChange', { appId, lastUsed: timestamp });
    },

    getAppLastUsed(appId) {
        const value = this.appUsage && this.appUsage[appId];
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    },

    // 从运行列表移除应用
    removeRunningApp(appId) {
        this.runningApps.delete(appId);
        this.emit('appStop', appId);
    },

    // 重启系统 - 显示重启覆盖层 6s，然后进入开机界面
    restart() {
        this.updateSession({ isLoggedIn: false });
        this.windows = [];
        this.runningApps.clear();
        this.emit('powerAction', { action: 'restart' });
    },

    // 关机 - 显示关机覆盖层 5s，然后关闭网页
    shutdown() {
        this.updateSession({ isLoggedIn: false });
        this.windows = [];
        this.runningApps.clear();
        this.emit('powerAction', { action: 'shutdown' });
    },

    // 注销 - 显示注销覆盖层 3s，然后进入锁屏
    logout() {
        this.updateSession({ isLoggedIn: false });
        this.windows = [];
        this.runningApps.clear();
        this.emit('powerAction', { action: 'logout' });
    },

    // 锁屏 - 直接进入锁屏
    lock() {
        this.setView('lock');
    }
};
