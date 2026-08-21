/**
 * Login screen module - 集成 Supabase 认证
 */
const LoginScreen = {
    element: null,
    cardElement: null,
    avatarElement: null,
    usernameElement: null,
    emailElement: null,
    pinInput: null,
    pinToggle: null,
    submitBtn: null,
    errorElement: null,
    securityLink: null,
    wallpaperElement: null,
    attempts: 0,
    isLoading: false,

    init() {
        this.element = document.getElementById('login-screen');
        this.cardElement = this.element.querySelector('.login-card');
        this.avatarElement = this.element.querySelector('.login-avatar img');
        this.usernameElement = this.element.querySelector('.login-username');
        this.emailElement = this.element.querySelector('.login-email');
        this.pinInput = document.getElementById('login-pin');
        this.pinToggle = document.getElementById('pin-toggle');
        this.submitBtn = document.getElementById('login-submit');
        this.errorElement = document.getElementById('login-error');
        this.securityLink = document.getElementById('security-link');
        this.wallpaperElement = this.element.querySelector('.login-wallpaper');

        this.submitBtn.addEventListener('click', () => this.handleLogin());
        this.pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin();
            }
        });

        this.pinToggle.addEventListener('click', () => this.togglePinVisibility());

        this.element.addEventListener('click', (e) => {
            if (State.view === 'login' && !this.cardElement.contains(e.target)) {
                this.backToLock();
            }
        });

        State.on('languageChange', () => this.updateTexts());
        State.on('settingsChange', (updates = {}) => {
            if (
                updates.userName !== undefined ||
                updates.userEmail !== undefined ||
                updates.userAvatar !== undefined
            ) {
                this.updateProfile();
            }
        });

        this.updateTexts();
    },

    backToLock() {
        if (window.handleLoginToLock) {
            window.handleLoginToLock();
        }
    },

    show() {
        this.element.classList.remove('hidden');
        this.element.classList.add('show');
        this.cardElement.classList.add('show');
        this.updateWallpaper();
        this.updateTexts();
        this.pinInput.value = '';
        this.pinInput.focus();
        this.errorElement.classList.add('hidden');
        this.securityLink.classList.add('hidden');
        this.attempts = State.session.loginAttempts || 0;
        this.isLoading = false;
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = I18n.t('login.submit') || '登录';
    },

    hide() {
        this.element.classList.add('hidden');
        this.cardElement.classList.remove('show');
    },

    updateWallpaper() {
        this.wallpaperElement.style.backgroundImage = 'none';
        if (typeof LockScreen !== 'undefined' && LockScreen.updateWallpaper) {
            LockScreen.updateWallpaper();
        }
    },

    getProfile() {
        const fallbackName = (I18n && typeof I18n.t === 'function') ? I18n.t('login.username') : 'Owner';
        const fallbackEmail = (I18n && typeof I18n.t === 'function') ? I18n.t('login.email') : 'owner@sample.com';
        const name = String(State?.settings?.userName || '').trim() || fallbackName;
        const email = String(State?.settings?.userEmail || '').trim() || fallbackEmail;
        const avatar = String(State?.settings?.userAvatar || '').trim() || 'Theme/Profile_img/UserAva.webp';
        return { name, email, avatar };
    },

    updateProfile() {
        const profile = this.getProfile();
        if (this.usernameElement) this.usernameElement.textContent = profile.name;
        if (this.emailElement) this.emailElement.textContent = profile.email;
        if (this.avatarElement) {
            this.avatarElement.onerror = () => {
                this.avatarElement.onerror = null;
                this.avatarElement.src = 'Theme/Profile_img/UserAva.webp';
            };
            this.avatarElement.src = profile.avatar;
        }
    },

    updateTexts() {
        if (!I18n || typeof I18n.t !== 'function') return;
        if (this.pinInput) this.pinInput.placeholder = I18n.t('login.pin.placeholder');
        if (this.errorElement) this.errorElement.textContent = I18n.t('login.pin.error');
        if (this.securityLink) this.securityLink.textContent = I18n.t('login.security.link');
        if (this.submitBtn) {
            if (!this.isLoading) {
                this.submitBtn.textContent = I18n.t('login.submit') || '登录';
            }
        }
        this.updateProfile();
    },

    togglePinVisibility() {
        const isPassword = this.pinInput.type === 'password';
        this.pinInput.type = isPassword ? 'text' : 'password';

        const strokeIcon = this.pinToggle.querySelector('.icon-stroke');
        const fillIcon = this.pinToggle.querySelector('.icon-fill');
        if (isPassword) {
            strokeIcon.classList.add('hidden');
            fillIcon.classList.remove('hidden');
        } else {
            strokeIcon.classList.remove('hidden');
            fillIcon.classList.add('hidden');
        }
    },

    setLoading(loading) {
        this.isLoading = loading;
        this.submitBtn.disabled = loading;
        if (loading) {
            this.submitBtn.textContent = '⏳ 处理中...';
        } else {
            this.updateTexts();
        }
    },

    showError(msg) {
        if (this.errorElement) {
            this.errorElement.textContent = msg;
            this.errorElement.classList.remove('hidden');
        }
    },

    clearError() {
        if (this.errorElement) {
            this.errorElement.classList.add('hidden');
        }
    },

    async handleLogin() {
        if (this.isLoading) return;
        
        const pin = this.pinInput.value;
        const email = String(State?.settings?.userEmail || '').trim();
        const password = pin; // PIN is used as password for now

        this.clearError();

        // 尝试 Supabase 登录
        if (typeof SupabaseClient !== 'undefined' && SupabaseClient.isInitialized && email) {
            this.setLoading(true);
            try {
                const { user, session } = await SupabaseClient.signIn(email, password);
                if (user) {
                    // 登录成功，更新显示名称
                    const displayName = user.user_metadata?.display_name || State.settings.userName || '用户';
                    await SupabaseClient.updateDisplayName(displayName);
                    await SupabaseClient.updateLastLoginTime();
                    
                    State.updateSession({
                        isLoggedIn: true,
                        lastLogin: new Date().toISOString(),
                        loginAttempts: 0,
                        userId: user.id
                    });
                    State.setView('desktop');
                    this.hide();
                    if (typeof Desktop !== 'undefined' && typeof Desktop.show === 'function') {
                        Desktop.show();
                    }

                    const profile = this.getProfile();
                    State.addNotification({
                        title: '登录成功',
                        message: `欢迎回来，${displayName}`,
                        type: 'success'
                    });
                }
            } catch (error) {
                console.error('[Login] Supabase error:', error);
                this.showError(error.message || '登录失败，请检查邮箱和密码');
                this.setLoading(false);
            }
            return;
        }

        // 本地 PIN 登录（后备方案）
        const correctPin = State.settings.pin || '1234';

        if (pin === correctPin) {
            this.attempts = 0;
            State.updateSession({
                isLoggedIn: true,
                lastLogin: new Date().toISOString(),
                loginAttempts: 0
            });
            State.setView('desktop');
            this.hide();
            if (typeof Desktop !== 'undefined' && typeof Desktop.show === 'function') {
                Desktop.show();
            }

            const profile = this.getProfile();
            State.addNotification({
                title: '登录成功',
                message: `欢迎回来，${profile.name}`,
                type: 'success'
            });
        } else {
            this.attempts++;
            State.updateSession({ loginAttempts: this.attempts });

            this.pinInput.classList.add('error');
            this.errorElement.classList.remove('hidden');

            setTimeout(() => {
                this.pinInput.classList.remove('error');
            }, 400);

            if (this.attempts >= 3) {
                this.securityLink.classList.remove('hidden');
            }

            this.pinInput.value = '';
            this.pinInput.focus();
        }
    }
};
