/**
 * 锁屏模块 - 集成 Supabase 最后登录时间
 */
const LockScreen = {
    element: null,
    timeElement: null,
    dateElement: null,
    wallpaperElement: null,
    hintElement: null,
    notificationsElement: null,
    timeInterval: null,

    init() {
        this.element = document.getElementById('lock-screen');
        this.timeElement = document.getElementById('lock-time');
        this.dateElement = document.getElementById('lock-date');
        this.wallpaperElement = this.element.querySelector('.lock-wallpaper');
        this.hintElement = this.element.querySelector('.lock-hint');
        this.notificationsElement = document.getElementById('lock-notifications');

        // 绑定事件
        this.element.addEventListener('click', (event) => {
            this.unlock(event);
        });
        document.addEventListener('keydown', (e) => {
            if (e.target && e.target.closest && e.target.closest('.Nyou-widget')) return;
            if (e.target && e.target.closest && e.target.closest('.lock-notifications')) return;
            if (State.view === 'lock') {
                this.unlock();
            }
        });

        State.on('languageChange', () => this.updateTexts());
        State.on('notificationAdd', () => this.renderNotifications());
        State.on('notificationRemove', () => this.renderNotifications());
        State.on('notificationsClear', () => this.renderNotifications());
        this.updateTexts();
        this.renderNotifications();
    },

    show() {
        this.element.classList.remove('hidden');
        this.element.classList.add('show');
        this.updateTime();
        this.updateWallpaper();
        
        if (this.timeInterval) clearInterval(this.timeInterval);
        this.timeInterval = setInterval(() => this.updateTime(), 1000);
    },

    hide() {
        this.element.classList.add('hidden');
        this.element.classList.remove('show');
        
        if (this.timeInterval) {
            clearInterval(this.timeInterval);
            this.timeInterval = null;
        }
    },

    async unlock() {
        if (State.view !== 'lock') return;
        
        // 更新最后登录时间到 Supabase
        if (typeof SupabaseClient !== 'undefined' && SupabaseClient.isInitialized) {
            await SupabaseClient.updateLastLoginTime();
        }
        
        const hasPin = !!State.settings.pin;
        const animate = State.settings.enableAnimation !== false;

        const doTransition = () => {
            if (hasPin) {
                State.setView('login');
                this.hide();
                if (typeof LoginScreen !== 'undefined' && typeof LoginScreen.show === 'function') {
                    LoginScreen.show();
                }
            } else {
                State.setView('desktop');
                this.hide();
                if (typeof Desktop !== 'undefined' && typeof Desktop.show === 'function') {
                    Desktop.show();
                }
            }
        };

        if (animate) {
            const animClass = hasPin ? 'lock-to-login' : 'lock-to-desktop-blur';
            document.body.classList.add(animClass);
            setTimeout(() => {
                doTransition();
                setTimeout(() => {
                    document.body.classList.remove(animClass);
                }, 100);
            }, 480);
        } else {
            doTransition();
        }
    },

    updateTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        if (this.timeElement) this.timeElement.textContent = `${hours}:${minutes}`;
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (this.dateElement) this.dateElement.textContent = now.toLocaleDateString(undefined, options);
    },

    updateWallpaper() {
        const wallpaper = State.settings.wallpaper || 'Theme/Picture/Fluent-2.webp';
        this.wallpaperElement.style.backgroundImage = `url('${wallpaper}')`;
        this.element.style.backgroundImage = `url('${wallpaper}')`;
    },

    updateTexts() {
        if (this.hintElement && I18n && typeof I18n.t === 'function') {
            this.hintElement.textContent = I18n.t('lock.hint');
        }
    },

    renderNotifications() {
        if (!this.notificationsElement) return;
        const notifs = State.notifications || [];
        if (notifs.length === 0) {
            this.notificationsElement.innerHTML = '<div class="lock-notif-empty">暂无通知</div>';
            return;
        }
        this.notificationsElement.innerHTML = notifs.slice(-3).reverse().map(n => `
            <div class="lock-notif-item">
                <div class="lock-notif-title">${n.title}</div>
                <div class="lock-notif-body">${n.message}</div>
            </div>
        `).join('');
    },

};
