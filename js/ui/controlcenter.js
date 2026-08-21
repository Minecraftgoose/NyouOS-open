/**
 * 控制中心模块
 */
const ControlCenter = {
    element: null,
    isOpen: false,

    init() {
        this.element = document.getElementById('control-center');
        this.bindEvents();
        this.updateTiles();
        this.updateLanguage();
        
        // 监听语言切换
        State.on('languageChange', () => {
            this.updateLanguage();
            this.updateTiles();
        });
        
        // 监听设置变更，实时同步
        State.on('settingsChange', (updates) => {
            if (updates.bluetoothEnabled !== undefined || 
                updates.enableBlur !== undefined || 
                updates.enableAnimation !== undefined ||
                updates.theme !== undefined ||
                updates.volume !== undefined ||
                updates.brightness !== undefined) {
                this.updateTiles();
            }
        });
    },
    
    updateLanguage() {
        // 更新 Wi-Fi 标题
        const wifiTitle = document.getElementById('wifi-tile-title');
        if (wifiTitle) wifiTitle.textContent = t('control.wifi');
        
        // 更新蓝牙标题
        const bluetoothTitle = document.getElementById('bluetooth-tile-title');
        if (bluetoothTitle) bluetoothTitle.textContent = t('control.bluetooth');
        
        // 更新模糊标题
        const blurTitle = document.getElementById('blur-tile-title');
        if (blurTitle) blurTitle.textContent = t('control.blur');
        
        // 更新动画标题
        const animationTitle = document.getElementById('animation-tile-title');
        if (animationTitle) animationTitle.textContent = t('control.animation');

        document.getElementById('volume-slider')?.setAttribute('aria-label', t('control.volume'));
        document.getElementById('brightness-slider')?.setAttribute('aria-label', t('control.brightness'));
    },

    bindEvents() {
        this.element.addEventListener('keydown', (event) => {
            const tile = event.target.closest?.('.control-tile[role="button"]');
            if (!tile || (event.key !== 'Enter' && event.key !== ' ')) return;
            event.preventDefault();
            tile.click();
        });

        // Wi-Fi 瓷贴
        const wifiTile = document.getElementById('wifi-tile');
        wifiTile.addEventListener('click', () => {
            const isActive = wifiTile.dataset.active === 'true';
            wifiTile.dataset.active = !isActive;
            
            const subtitle = wifiTile.querySelector('.tile-subtitle');
            subtitle.textContent = isActive ? t('control.wifi.disconnected') : t('control.wifi.connected');
            
            State.addNotification({
                title: t('control.wifi'),
                message: isActive ? t('notify.wifi.disconnected') : t('notify.wifi.connected'),
                type: 'info'
            });
        });

        // 蓝牙瓷贴
        const bluetoothTile = document.getElementById('bluetooth-tile');
        bluetoothTile.addEventListener('click', () => {
            const isActive = bluetoothTile.dataset.active === 'true';
            const newState = !isActive;
            bluetoothTile.dataset.active = newState;
            
            // 同步到设置状态
            State.updateSettings({ bluetoothEnabled: newState });
            
            // 更新图标（带动画）
            const iconOff = bluetoothTile.querySelector('.bluetooth-icon-off');
            const iconOn = bluetoothTile.querySelector('.bluetooth-icon-on');
            if (iconOff && iconOn) {
                iconOff.style.opacity = newState ? '0' : '1';
                iconOn.style.opacity = newState ? '1' : '0';
            }
            
            const subtitle = bluetoothTile.querySelector('.tile-subtitle');
            subtitle.textContent = newState ? t('control.bluetooth.on') : t('control.bluetooth.off');
            
            State.addNotification({
                title: t('control.bluetooth'),
                message: newState ? t('notify.bluetooth.on') : t('notify.bluetooth.off'),
                type: 'info'
            });
        });

        // 主题瓷贴
        const themeTile = document.getElementById('theme-tile');
        const themeTileTitle = document.getElementById('theme-tile-title');
        themeTile.addEventListener('click', () => {
            const currentTheme = State.settings.theme;
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            State.updateSettings({ theme: newTheme });
            themeTile.dataset.active = newTheme === 'dark' ? 'true' : 'false';
            
            // 更新按钮文字：显示当前模式
            themeTileTitle.textContent = newTheme === 'dark' ? t('control.theme') : t('control.theme.light');
            
            const modeName = newTheme === 'dark' ? t('control.theme') : t('control.theme.light');
            State.addNotification({
                title: t('settings.theme'),
                message: t('notify.theme.changed', { mode: modeName }),
                type: 'info'
            });
        });

        // 模糊瓷贴
        const blurTile = document.getElementById('blur-tile');
        blurTile.addEventListener('click', () => {
            const isActive = blurTile.dataset.active === 'true';
            State.updateSettings({ enableBlur: !isActive });
            blurTile.dataset.active = !isActive;
            
            State.addNotification({
                title: t('control.blur'),
                message: isActive ? t('notify.blur.off') : t('notify.blur.on'),
                type: 'info'
            });
        });

        // 动画瓷贴
        const animationTile = document.getElementById('animation-tile');
        animationTile.addEventListener('click', () => {
            const isActive = animationTile.dataset.active === 'true';
            State.updateSettings({ enableAnimation: !isActive });
            animationTile.dataset.active = !isActive;
            
            State.addNotification({
                title: t('control.animation'),
                message: isActive ? t('notify.animation.off') : t('notify.animation.on'),
                type: 'info'
            });
        });

        // 辅助功能瓷贴
        const a11yTile = document.getElementById('a11y-tile');
        if (a11yTile) {
            a11yTile.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleAccessibilityPanel(a11yTile);
            });
        }

        // 音量滑块
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            volumeValue.textContent = value;
            this.syncSliderVisual(e.target);
            State.updateSettings({ volume: parseInt(value, 10) });
        });

        // 亮度滑块
        const brightnessSlider = document.getElementById('brightness-slider');
        const brightnessValue = document.getElementById('brightness-value');
        brightnessSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            brightnessValue.textContent = value;
            this.syncSliderVisual(e.target);
            State.updateSettings({ brightness: parseInt(value, 10) });
        });

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target) && 
                !e.target.closest('#control-center-btn')) {
                this.close();
            }
        });
    },

    // 切换辅助功能面板
    _toggleAccessibilityPanel(anchorTile) {
        let panel = document.getElementById('control-a11y-panel');
        if (panel) {
            panel.remove();
            return;
        }

        // 辅助功能选项配置（和 OOBE 一致）
        const a11yOptions = [
            { key: 'invertMode', label: '反色模式', desc: '反转屏幕颜色', type: 'toggle' },
            { key: 'grayscaleMode', label: '灰度模式', desc: '屏幕变为黑白', type: 'toggle' },
            { key: 'highContrastMode', label: '高对比度', desc: '增强对比度', type: 'toggle' },
            { key: 'largeTextMode', label: '大字体', desc: '增大系统字体', type: 'toggle' },
            { key: 'screenReader', label: '旁白', desc: '朗读屏幕文字', type: 'toggle' },
            { key: 'screenKeyboard', label: '屏幕键盘', desc: '虚拟键盘输入', type: 'toggle' },
            { key: 'enableAnimation', label: '减少动画', desc: '禁用动画效果', type: 'toggle', invert: true },
            { key: 'zoomLevel', label: '屏幕缩放', desc: '调整界面比例', type: 'select', options: [
                { value: 0.75, label: '75%' }, { value: 1, label: '100%' },
                { value: 1.25, label: '125%' }, { value: 1.5, label: '150%' },
                { value: 1.75, label: '175%' }, { value: 2, label: '200%' }
            ]},
            { key: 'colorBlindMode', label: '色弱模式', desc: '色弱优化显示', type: 'select', options: [
                { value: 'none', label: '关闭' },
                { value: 'protanopia', label: '红色弱' },
                { value: 'deuteranopia', label: '绿色弱' },
                { value: 'tritanopia', label: '蓝色弱' }
            ]}
        ];

        // 创建面板
        panel = document.createElement('div');
        panel.id = 'control-a11y-panel';
        panel.style.cssText = 'position:absolute;left:16px;right:16px;bottom:calc(100% + 8px);z-index:10;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);padding:14px 16px;font-family:inherit;max-height:60vh;overflow-y:auto;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:10px;color:#000;display:flex;align-items:center;gap:6px;';
        title.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M19 13v-2a7 7 0 0 0-14 0v2"/><path d="M5 19a7 7 0 0 0 14 0"/><line x1="12" y1="10" x2="12" y2="15"/></svg>辅助功能';
        panel.appendChild(title);

        a11yOptions.forEach((opt, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:9px 0;' + (idx < a11yOptions.length - 1 ? 'border-bottom:1px solid rgba(0,0,0,0.06);' : '');
            const labelDiv = document.createElement('div');
            labelDiv.style.cssText = 'flex:1;min-width:0;';
            labelDiv.innerHTML = `<div style="font-size:13px;font-weight:500;color:#000;">${opt.label}</div><div style="font-size:11px;color:#888;margin-top:1px;">${opt.desc}</div>`;
            row.appendChild(labelDiv);

            if (opt.type === 'toggle') {
                const isChecked = opt.invert
                    ? (State?.settings?.[opt.key] === false)
                    : (State?.settings?.[opt.key] === true);
                const label = document.createElement('label');
                label.style.cssText = 'position:relative;display:inline-block;width:42px;height:24px;cursor:pointer;flex-shrink:0;margin-left:8px;';
                label.innerHTML = `
                    <input type="checkbox" style="opacity:0;width:0;height:0;" ${isChecked ? 'checked' : ''}>
                    <span class="cc-a11y-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:${isChecked ? '#0078d4' : '#ccc'};transition:.3s;border-radius:24px;"></span>
                    <span class="cc-a11y-thumb" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background-color:white;transition:.3s;border-radius:50%;z-index:1;box-shadow:0 1px 2px rgba(0,0,0,0.2);transform:translateX(${isChecked ? '18px' : '0'});"></span>
                `;
                const input = label.querySelector('input');
                input.addEventListener('change', () => {
                    const invert = opt.invert === true;
                    const value = invert ? !input.checked : input.checked;
                    State.updateSettings({ [opt.key]: value });
                    label.querySelector('.cc-a11y-track').style.backgroundColor = input.checked ? '#0078d4' : '#ccc';
                    label.querySelector('.cc-a11y-thumb').style.transform = input.checked ? 'translateX(18px)' : 'translateX(0)';
                });
                row.appendChild(label);
            } else if (opt.type === 'select') {
                const select = document.createElement('select');
                select.style.cssText = 'padding:5px 8px;border-radius:5px;border:1px solid #ccc;background:#fff;color:#000;font-size:12px;min-width:90px;cursor:pointer;';
                opt.options.forEach(o => {
                    const option = document.createElement('option');
                    option.value = o.value;
                    option.textContent = o.label;
                    const currentVal = State?.settings?.[opt.key];
                    if (String(o.value) === String(currentVal !== undefined ? currentVal : (opt.key === 'zoomLevel' ? 1 : 'none'))) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                select.addEventListener('change', () => {
                    let val = select.value;
                    if (opt.key === 'zoomLevel') val = parseFloat(val);
                    State.updateSettings({ [opt.key]: val });
                });
                row.appendChild(select);
            }
            panel.appendChild(row);
        });

        // 插入到控制中心内容的顶部
        const grid = this.element.querySelector('.control-center-grid');
        if (grid && grid.parentNode) {
            grid.parentNode.insertBefore(panel, grid);
        } else {
            this.element.insertBefore(panel, this.element.firstChild);
        }

        // 阻止点击面板关闭控制中心
        panel.addEventListener('click', (e) => e.stopPropagation());
    },

    updateTiles() {
        // 更新瓷贴状态
        const themeTile = document.getElementById('theme-tile');
        const themeTileTitle = document.getElementById('theme-tile-title');
        themeTile.dataset.active = State.settings.theme === 'dark' ? 'true' : 'false';
        // 更新主题瓷贴文字：显示当前模式
        themeTileTitle.textContent = State.settings.theme === 'dark' ? t('control.theme') : t('control.theme.light');
        
        // 更新 Wi-Fi 和蓝牙的副标题
        const wifiSubtitle = document.getElementById('wifi-tile-subtitle');
        const wifiTile = document.getElementById('wifi-tile');
        if (wifiSubtitle && wifiTile) {
            const isWifiActive = wifiTile.dataset.active === 'true';
            wifiSubtitle.textContent = isWifiActive ? t('control.wifi.connected') : t('control.wifi.disconnected');
        }
        
        const bluetoothSubtitle = document.getElementById('bluetooth-tile-subtitle');
        const bluetoothTile = document.getElementById('bluetooth-tile');
        if (bluetoothSubtitle && bluetoothTile) {
            // 从设置同步蓝牙状态
            const btEnabled = State.settings.bluetoothEnabled !== false;
            bluetoothTile.dataset.active = btEnabled ? 'true' : 'false';
            bluetoothSubtitle.textContent = btEnabled ? t('control.bluetooth.on') : t('control.bluetooth.off');
            
            // 更新蓝牙图标
            const iconOff = bluetoothTile.querySelector('.bluetooth-icon-off');
            const iconOn = bluetoothTile.querySelector('.bluetooth-icon-on');
            if (iconOff && iconOn) {
                iconOff.style.opacity = btEnabled ? '0' : '1';
                iconOn.style.opacity = btEnabled ? '1' : '0';
            }
        }

        const blurTile = document.getElementById('blur-tile');
        blurTile.dataset.active = State.settings.enableBlur ? 'true' : 'false';

        const animationTile = document.getElementById('animation-tile');
        animationTile.dataset.active = State.settings.enableAnimation ? 'true' : 'false';

        // 更新滑块值
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        volumeSlider.value = State.settings.volume ?? 50;
        volumeValue.textContent = State.settings.volume ?? 50;
        this.syncSliderVisual(volumeSlider);

        const brightnessSlider = document.getElementById('brightness-slider');
        const brightnessValue = document.getElementById('brightness-value');
        brightnessSlider.value = State.settings.brightness ?? 100;
        brightnessValue.textContent = State.settings.brightness ?? 100;
        this.syncSliderVisual(brightnessSlider);
    },

    syncSliderVisual(slider) {
        if (!slider) return;
        const min = Number(slider.min || 0);
        const max = Number(slider.max || 100);
        const value = Number(slider.value || 0);
        const progress = Math.max(0, Math.min(100, ((value - min) / Math.max(1, max - min)) * 100));
        slider.style.setProperty('--Nyou-slider-progress', `${progress}%`);
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        this.updateTiles();

        // 计算控制中心按钮位置
        const btn = document.getElementById('control-center-btn');
        const btnRect = btn.getBoundingClientRect();
        
        // 先显示元素以获取正确的尺寸
        this.element.classList.remove('hidden');
        this.element.classList.remove('closing');
        
        // 先隐藏显示以获取宽度
        this.element.style.visibility = 'hidden';
        this.element.style.display = 'block';
        
        const panelRect = this.element.getBoundingClientRect();
        
        // 计算按钮中心点
        const btnCenterX = btnRect.left + btnRect.width / 2;
        
        // 设置控制中心位置：底部距离任务栏按钮顶部 8px
        const bottomDistance = window.innerHeight - btnRect.top + 8;
        this.element.style.bottom = `${bottomDistance}px`;
        // 使用left定位，让控制中心的中心点对齐按钮的中心点
        this.element.style.left = `${btnCenterX - panelRect.width / 2}px`;
        this.element.style.right = 'auto';
        
        // 显示面板
        this.element.style.visibility = 'visible';
        
        this.isOpen = true;
        
        // 更新按钮状态
        btn.classList.add('active');

        // 关闭其他面板（互斥）
        StartMenu.close();
        NotificationCenter.close();
        if (typeof SurfAi !== 'undefined' && SurfAi && SurfAi.isOpen) {
            SurfAi.hide('panel-switch');
        }

    },

    close() {
        if (!this.isOpen) return;
        
        const btn = document.getElementById('control-center-btn');
        btn.classList.remove('active');
        
        // 添加关闭动画
        if (State.settings.enableAnimation) {
            this.element.classList.add('closing');
            setTimeout(() => {
                this.element.classList.add('hidden');
                this.element.classList.remove('closing');
                // 清除inline样式，恢复到默认状态
                this.element.style.display = '';
                this.element.style.visibility = '';
            }, 200);
        } else {
            this.element.classList.add('hidden');
            this.element.style.display = '';
            this.element.style.visibility = '';
        }
        
        this.isOpen = false;
    }
};
