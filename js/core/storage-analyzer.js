/**
 * NyouOS storage accounting and physical payload cleanup.
 * Static package sizes come from storage-manifest.js; browser data is measured
 * from the payloads that the origin can actually inspect.
 */
const NyouOSStorage = {
    _cache: null,
    _cacheAt: 0,
    _providers: new Map(),
    cacheTtl: 1500,
    GIB: 1024 * 1024 * 1024,
    DEFAULT_CAPACITY_BYTES: 1024 * 1024 * 1024,
    EXPANDED_CAPACITY_BYTES: 5 * 1024 * 1024 * 1024,
    MAX_IMPORT_BYTES: 10 * 1024 * 1024 * 1024,

    utf8Bytes(value) {
        return new TextEncoder().encode(String(value ?? '')).byteLength;
    },

    valueBytes(value, seen = new WeakSet()) {
        if (value == null) return 0;
        const objectTag = typeof value === 'object'
            ? Object.prototype.toString.call(value)
            : '';
        if ((objectTag === '[object Blob]' || objectTag === '[object File]')
            && Number.isFinite(Number(value.size))) {
            return Math.max(0, Number(value.size) || 0);
        }
        if (value instanceof Blob) return Number(value.size || 0);
        if (value instanceof ArrayBuffer) return value.byteLength;
        if (ArrayBuffer.isView(value)) return value.byteLength;
        if (typeof value === 'string') return this.utf8Bytes(value);
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
            return this.utf8Bytes(String(value));
        }
        if (typeof value !== 'object' || seen.has(value)) return 0;
        seen.add(value);
        let bytes = Array.isArray(value) ? 2 : 2;
        Object.entries(value).forEach(([key, child]) => {
            bytes += this.utf8Bytes(key) + this.valueBytes(child, seen) + 3;
        });
        return bytes;
    },

    formatBytes(bytes) {
        const value = Math.max(0, Number(bytes) || 0);
        if (value < 1024) return `${Math.round(value)} B`;
        const units = ['KB', 'MB', 'GB', 'TB'];
        let scaled = value / 1024;
        let unit = 0;
        while (scaled >= 1024 && unit < units.length - 1) {
            scaled /= 1024;
            unit += 1;
        }
        const digits = scaled >= 100 ? 0 : (scaled >= 10 ? 1 : 2);
        return `${scaled.toFixed(digits)} ${units[unit]}`;
    },

    getDisplayCapacity(importedFilesBytes = 0) {
        const imported = Math.max(0, Number(importedFilesBytes) || 0);
        if (imported > this.EXPANDED_CAPACITY_BYTES) return this.MAX_IMPORT_BYTES;
        if (imported > this.DEFAULT_CAPACITY_BYTES) return this.EXPANDED_CAPACITY_BYTES;
        return this.DEFAULT_CAPACITY_BYTES;
    },

    isImportedFileNode(node) {
        if (!node || node.type !== 'file' || node.encoding === 'photos-ref') return false;
        if (node.imported === true) return true;
        if (['photos-local', 'media-local', 'external-import', 'files-import'].includes(String(node.source || ''))) return true;
        return ['photos-local-cache', 'media-local-cache', 'fap-package-cache', 'files-local-cache'].includes(String(node.encoding || ''));
    },

    normalizePath(path) {
        return String(path || '').replace(/^\.\//, '').replace(/\\/g, '/');
    },

    staticEntry(path) {
        return globalThis.NyouOSStorageManifest?.files?.[this.normalizePath(path)] || null;
    },

    getAppSize(app) {
        if (!app) return 0;
        const iconBytes = Number(this.staticEntry(app.icon)?.size || 0);
        if (app.isPWA === true) return iconBytes + 20;
        const registration = {
            id: app.id || '',
            nameKey: app.nameKey || '',
            icon: app.icon || '',
            component: globalThis.WindowManager?.appConfigs?.[app.id]?.component || ''
        };
        return iconBytes + this.utf8Bytes(JSON.stringify(registration));
    },

    registerProvider(appId, provider) {
        if (!appId || !provider) return;
        this._providers.set(String(appId), provider);
        this.invalidate();
    },

    unregisterProvider(appId) {
        if (!appId) return false;
        const removed = this._providers.delete(String(appId));
        if (removed) this.invalidate();
        return removed;
    },

    invalidate() {
        this._cache = null;
        this._cacheAt = 0;
        try { window.dispatchEvent(new CustomEvent('NyouOS-storage-change')); } catch (_) {}
    },

    _emptyAppMap(apps) {
        const map = {};
        (apps || []).forEach((app) => {
            map[app.id] = {
                appSizeBytes: this.getAppSize(app),
                dataSizeBytes: 0,
                dataAvailable: true
            };
        });
        return map;
    },

    _ownerForNode(node) {
        if (!node) return 'other';
        if (['root', 'desktop', 'documents', 'pictures', 'music', 'downloads', 'recycle', 'welcome'].includes(String(node.id || ''))) return 'unclassified';
        if (/^photos-(?:local|favorites)-/.test(String(node.id || ''))) return 'photos';
        if (node.source === 'photos-local' || node.source === 'photos-favorite') return 'photos';
        if (node.source === 'media-local') return 'media';
        // Everything created or imported through Desktop / Files belongs to
        // Files documents data, even when its physical payload lives in the
        // Photos or Media IndexedDB store.
        if (node.type === 'file' || node.type === 'folder') return 'files';
        return 'other';
    },

    _walkFileSystem(appData) {
        const photoOwners = new Map();
        const mediaOwners = new Map();
        const packageOwners = new Map();
        let otherBytes = 0;
        let importedFilesBytes = 0;
        const importedNodeIds = new Set();
        const visit = (node) => {
            if (!node || typeof node !== 'object') return;
            const shallow = { ...node };
            delete shallow.children;
            const owner = this._ownerForNode(node);
            const bytes = this.utf8Bytes(JSON.stringify(shallow));
            if (owner !== 'other' && owner !== 'unclassified' && appData[owner]) appData[owner].dataSizeBytes += bytes;
            else if (owner === 'other') otherBytes += bytes;

            if (node.encoding === 'photos-local-cache') {
                photoOwners.set(String(node.cacheId || node.id || ''), owner);
            }
            if (node.encoding === 'media-local-cache') {
                mediaOwners.set(String(node.mediaRecordId || `fs-${node.id}`), owner);
            }
            if (node.encoding === 'fap-package-cache') {
                packageOwners.set(String(node.packageCacheId || node.content || node.id || ''), owner);
            }
            if (this.isImportedFileNode(node) && !importedNodeIds.has(String(node.id || ''))) {
                importedNodeIds.add(String(node.id || ''));
                importedFilesBytes += Math.max(0, Number(node.size) || 0);
            }
            (node.children || []).forEach(visit);
        };
        visit(globalThis.State?.fs?.root);
        return { otherBytes, photoOwners, mediaOwners, packageOwners, importedFilesBytes, importedNodeIds };
    },

    _readDatabaseRecords(name, storeName) {
        return new Promise((resolve) => {
            if (!globalThis.indexedDB) return resolve([]);
            const request = indexedDB.open(name);
            request.onerror = () => resolve([]);
            request.onupgradeneeded = () => {
                try { request.transaction.abort(); } catch (_) {}
                resolve([]);
            };
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.close();
                    resolve([]);
                    return;
                }
                const tx = db.transaction(storeName, 'readonly');
                const getAll = tx.objectStore(storeName).getAll();
                getAll.onsuccess = () => resolve(Array.isArray(getAll.result) ? getAll.result : []);
                getAll.onerror = () => resolve([]);
                tx.oncomplete = () => db.close();
                tx.onerror = () => { db.close(); resolve([]); };
            };
        });
    },

    _measureLocalStorage(appData) {
        const owners = [
            { app: 'terminal', test: (key) => key === 'terminal_history' },
            { app: 'clock', test: (key) => key.startsWith('clock_') },
            { app: 'browser', test: (key) => key === 'NyouOS.favoriteSites' || key === 'NyouOS.searchHistory' },
            { app: 'photos', test: (key) => key.startsWith('NyouOS.photos.') },
            { app: 'media', test: (key) => key.startsWith('NyouOS.media.') },
            { app: 'appshop', test: (key) => key === 'NyouOS.installedApps' || key === 'NyouOS.uninstalledDefaultApps' },
            { app: 'fingo', test: (key) => key.startsWith('NyouOS.fingo_') }
        ];
        try {
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index) || '';
                if (key === 'NyouOS.fs') continue;
                const owner = owners.find((entry) => entry.test(key));
                if (!owner || !appData[owner.app]) continue;
                appData[owner.app].dataSizeBytes += this.utf8Bytes(key) + this.utf8Bytes(localStorage.getItem(key) || '');
            }
        } catch (_) {}
    },

    async analyze(apps = [], options = {}) {
        const signature = (apps || []).map((app) => `${app.id}:${app.icon}:${app.isPWA === true}`).join('|');
        if (!options.force && this._cache && this._cache.signature === signature && Date.now() - this._cacheAt < this.cacheTtl) {
            return this._cache.snapshot;
        }

        const appData = this._emptyAppMap(apps);
        const staticFiles = Object.values(globalThis.NyouOSStorageManifest?.files || {});
        const systemCoreBytes = staticFiles.filter((entry) => entry.category === 'core').reduce((sum, entry) => sum + Number(entry.size || 0), 0);
        const systemResourceBytes = staticFiles.filter((entry) => entry.category === 'resource').reduce((sum, entry) => sum + Number(entry.size || 0), 0);
        const fsResult = this._walkFileSystem(appData);
        let otherBytes = fsResult.otherBytes;
        let createdAppStorageBytes = 0;
        let externalAppDataBytes = 0;

        const [photoRecords, mediaRecords, wallpaperRecords, packageRecords, createdAppRecords] = await Promise.all([
            this._readDatabaseRecords('NyouOS.photos.cache.v1', 'localImages'),
            this._readDatabaseRecords('NyouOSMediaLibrary', 'files'),
            this._readDatabaseRecords('NyouOSWallpaperCache', 'wallpapers'),
            this._readDatabaseRecords('NyouOS.developerCenter', 'packages'),
            globalThis.DeveloperCenterStore?.getAll
                ? DeveloperCenterStore.getAll('apps').catch(() => [])
                : Promise.resolve([])
        ]);
        let importedFilesBytes = fsResult.importedFilesBytes;
        photoRecords.forEach((record) => {
            const bytes = this.valueBytes(record);
            const id = String(record?.id || '');
            const declaredOwner = ['files', 'photos'].includes(String(record?.ownerAppId || ''))
                ? String(record.ownerAppId)
                : '';
            const inferredOwner = id.startsWith('photo-local-') ? 'photos' : 'files';
            const owner = declaredOwner || fsResult.photoOwners.get(id) || inferredOwner;
            if (appData[owner]) appData[owner].dataSizeBytes += bytes;
            else otherBytes += bytes;
            if (!fsResult.photoOwners.has(id)) {
                importedFilesBytes += Math.max(0, Number(record?.size || record?.blob?.size) || 0);
            }
        });
        mediaRecords.forEach((record) => {
            const bytes = this.valueBytes(record);
            const id = String(record?.id || '');
            const declaredOwner = ['files', 'media'].includes(String(record?.ownerAppId || ''))
                ? String(record.ownerAppId)
                : '';
            const inferredOwner = !id.startsWith('fs-') || id.startsWith('fs-media-file-')
                ? 'media'
                : 'files';
            const owner = declaredOwner || fsResult.mediaOwners.get(id) || inferredOwner;
            if (appData[owner]) appData[owner].dataSizeBytes += bytes;
            else otherBytes += bytes;
            if (!fsResult.mediaOwners.has(id)) {
                importedFilesBytes += Math.max(0, Number(record?.size || record?.file?.size) || 0);
            }
        });
        packageRecords.forEach((record) => {
            const bytes = this.valueBytes(record);
            const id = String(record?.id || '');
            const owner = fsResult.packageOwners.get(id) || 'files';
            if (appData[owner]) appData[owner].dataSizeBytes += bytes;
            else otherBytes += bytes;
            if (!fsResult.packageOwners.has(id)) {
                importedFilesBytes += Math.max(0, Number(record?.size || record?.file?.size || record?.blob?.size) || 0);
            }
        });
        wallpaperRecords.forEach((record) => {
            const bytes = this.valueBytes(record);
            const isBing = String(record?.sourceType || '').toLowerCase() === 'bing'
                || /(?:^|\.)bing\.com\//i.test(String(record?.sourceUrl || ''));
            if (isBing && appData.photos) appData.photos.dataSizeBytes += bytes;
            else otherBytes += bytes;
        });
        createdAppRecords.forEach((record) => {
            const id = String(record?.id || '');
            if (!appData[id]) return;
            // Imported .fap Apps live in Developer Center's IndexedDB. Count the
            // actual persisted record instead of the tiny shell registration.
            const bytes = this.valueBytes(record);
            appData[id].appSizeBytes += bytes;
            createdAppStorageBytes += bytes;
        });
        this._measureLocalStorage(appData);

        await Promise.all([...this._providers.entries()].map(async ([appId, provider]) => {
            if (!appData[appId] || typeof provider.measure !== 'function') return;
            try {
                const bytes = Math.max(0, Number(await provider.measure()) || 0);
                appData[appId].dataSizeBytes += bytes;
                if (provider.external === true) externalAppDataBytes += bytes;
            } catch (_) {
                appData[appId].dataAvailable = false;
            }
        }));

        let quota = null;
        let browserUsage = null;
        try {
            const estimate = await navigator.storage?.estimate?.();
            quota = Number.isFinite(estimate?.quota) ? Number(estimate.quota) : null;
            browserUsage = Number.isFinite(estimate?.usage) ? Number(estimate.usage) : null;
        } catch (_) {}

        const appBytes = Object.values(appData).reduce((sum, item) => sum + item.appSizeBytes + item.dataSizeBytes, 0);
        const totalAppDataBytes = Object.values(appData).reduce((sum, item) => sum + item.dataSizeBytes, 0);
        const attributableBrowserBytes = otherBytes + createdAppStorageBytes + Math.max(0, totalAppDataBytes - externalAppDataBytes);
        const browserOverheadBytes = browserUsage == null ? 0 : Math.max(0, browserUsage - attributableBrowserBytes);
        const snapshot = {
            quotaBytes: quota,
            browserUsageBytes: browserUsage == null ? externalAppDataBytes : browserUsage + externalAppDataBytes,
            availableBytes: quota == null || browserUsage == null ? null : Math.max(0, quota - browserUsage),
            importedFilesBytes,
            displayCapacityBytes: this.getDisplayCapacity(importedFilesBytes),
            maxImportBytes: this.MAX_IMPORT_BYTES,
            categories: {
                systemCoreBytes,
                systemResourceBytes,
                appsBytes: appBytes,
                otherBytes,
                browserOverheadBytes
            },
            apps: appData
        };
        this._cache = { signature, snapshot };
        this._cacheAt = Date.now();
        return snapshot;
    },

    async getImportedFilesBytes() {
        const snapshot = await this.analyze([], { force: true });
        return Math.max(0, Number(snapshot?.importedFilesBytes) || 0);
    },

    async canAcceptImport(additionalBytes, reservedBytes = 0) {
        const currentBytes = await this.getImportedFilesBytes();
        const incomingBytes = Math.max(0, Number(additionalBytes) || 0);
        const reserved = Math.max(0, Number(reservedBytes) || 0);
        return {
            allowed: currentBytes + reserved + incomingBytes <= this.MAX_IMPORT_BYTES,
            currentBytes,
            incomingBytes,
            projectedBytes: currentBytes + reserved + incomingBytes,
            maxBytes: this.MAX_IMPORT_BYTES
        };
    },

    _flattenNodes(nodes) {
        const files = [];
        const visit = (node) => {
            if (!node) return;
            if (node.type === 'file') files.push(node);
            (node.children || []).forEach(visit);
        };
        (nodes || []).forEach(visit);
        return files;
    },

    async _deleteMediaRecord(id) {
        if (!id) return true;
        if (globalThis.MediaApp?.deleteStoredMedia) return MediaApp.deleteStoredMedia(id);
        return new Promise((resolve) => {
            const request = indexedDB.open('NyouOSMediaLibrary');
            request.onerror = () => resolve(false);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('files')) { db.close(); resolve(true); return; }
                const tx = db.transaction('files', 'readwrite');
                tx.objectStore('files').delete(id);
                tx.oncomplete = () => { db.close(); resolve(true); };
                tx.onerror = () => { db.close(); resolve(false); };
            };
        });
    },

    async purgeNodes(nodes) {
        const results = await Promise.all(this._flattenNodes(nodes).map(async (node) => {
            if (node.encoding === 'photos-local-cache') {
                if (!globalThis.PhotosDataStore?.removeLocalImageCache) return false;
                return PhotosDataStore.removeLocalImageCache(node);
            }
            if (node.encoding === 'media-local-cache') {
                return this._deleteMediaRecord(node.mediaRecordId || `fs-${node.id}`);
            }
            if (node.encoding === 'fap-package-cache') {
                if (!globalThis.DeveloperCenterStore?.removePackageFile) return false;
                return DeveloperCenterStore.removePackageFile(node.packageCacheId || node.content || node.id);
            }
            return true;
        }));
        if (results.some((result) => result === false)) throw new Error('physical_payload_delete_failed');
        this.invalidate();
        return true;
    },

    async purgeAppData(appId) {
        const id = String(appId || '');
        const provider = this._providers.get(id);
        if (provider?.clear) await provider.clear();
        const managedNativeApps = new Set(['tips', 'camera', 'photos', 'media']);
        if (id === 'photos' && globalThis.PhotosDataStore?.clearImportedPhotos) {
            await PhotosDataStore.clearImportedPhotos();
        }
        if (id === 'media' && globalThis.MediaApp?.clearLibrary) {
            const cleared = await MediaApp.clearLibrary();
            if (cleared === false) throw new Error('media_payload_delete_failed');
        }

        const prefixes = [`NyouOS.pwa.${id}.`, `NyouOS.app.${id}.`, `NyouOS.created.${id}.`, `${id}:`];
        const keys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index) || '';
            if (prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key);
        }
        keys.forEach((key) => localStorage.removeItem(key));

        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.filter((name) => name.includes(id)).map((name) => caches.delete(name)));
        } catch (_) {}
        if (!managedNativeApps.has(id)) {
            try {
                const databases = await indexedDB.databases?.();
                await Promise.all((databases || []).filter((db) => db.name?.includes(id)).map((db) => new Promise((resolve) => {
                    const request = indexedDB.deleteDatabase(db.name);
                    request.onsuccess = request.onerror = request.onblocked = () => resolve();
                })));
            } catch (_) {}
        }
        this.invalidate();
    }
};

globalThis.NyouOSStorage = NyouOSStorage;
