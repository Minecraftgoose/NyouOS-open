/**
 * NyouOS OOBE - HyperOS 3 风格控制器
 * 闭源 © 2025-2026 KevinAnanda. All rights reserved.
 */
const OOBE = {
    STORAGE_KEY: 'NyouOS.oobe_completed',
    element: null,
    steps: [],
    currentStep: 0,
    finishing: false,
    completionShown: false,

    // 选择状态
    selectedLang: null,
    selectedCountry: null,
    selectedFontSize: 'medium',
    selectedEngine: 'google',
    selectedTheme: 'light',
    selectedWallpaper: 'Fluent-1.webp',
    customWallpaper: null,
    apiProvider: 'openai',
    apiKey: '',
    apiBase: '',
    isLoggedIn: false,
    activationKeyValid: false,
    activationKeySkipped: false,
    pinType: '4',
    pinValue: '',
    pinConfirm: '',
    agreed: false,
    alwaysRestart: true,
    restartHours: 0,
    restartMinutes: 0,
    restartSeconds: 0,

    // 国家列表
    countries: [
        { code: 'CN', name: '中国', flag: '🇨🇳' },
        { code: 'HK', name: '中国香港', flag: '🇭🇰' },
        { code: 'TW', name: '中国台湾', flag: '🇹🇼' },
        { code: 'US', name: '美国', flag: '🇺🇸' },
        { code: 'GB', name: '英国', flag: '🇬🇧' },
        { code: 'JP', name: '日本', flag: '🇯🇵' },
        { code: 'KR', name: '韩国', flag: '🇰🇷' },
        { code: 'TH', name: '泰国', flag: '🇹🇭' },
        { code: 'SG', name: '新加坡', flag: '🇸🇬' },
        { code: 'MY', name: '马来西亚', flag: '🇲🇾' },
        { code: 'VN', name: '越南', flag: '🇻🇳' },
        { code: 'ID', name: '印度尼西亚', flag: '🇮🇩' },
        { code: 'PH', name: '菲律宾', flag: '🇵🇭' },
        { code: 'IN', name: '印度', flag: '🇮🇳' },
        { code: 'AU', name: '澳大利亚', flag: '🇦🇺' },
        { code: 'CA', name: '加拿大', flag: '🇨🇦' },
        { code: 'DE', name: '德国', flag: '🇩🇪' },
        { code: 'FR', name: '法国', flag: '🇫🇷' },
        { code: 'IT', name: '意大利', flag: '🇮🇹' },
        { code: 'ES', name: '西班牙', flag: '🇪🇸' },
        { code: 'RU', name: '俄罗斯', flag: '🇷🇺' },
        { code: 'BR', name: '巴西', flag: '🇧🇷' },
        { code: 'MX', name: '墨西哥', flag: '🇲🇽' },
        { code: 'AR', name: '阿根廷', flag: '🇦🇷' },
        { code: 'ZA', name: '南非', flag: '🇿🇦' },
        { code: 'EG', name: '埃及', flag: '🇪🇬' },
        { code: 'SA', name: '沙特阿拉伯', flag: '🇸🇦' },
        { code: 'AE', name: '阿联酋', flag: '🇦🇪' },
        { code: 'TR', name: '土耳其', flag: '🇹🇷' },
        { code: 'NL', name: '荷兰', flag: '🇳🇱' },
        { code: 'BE', name: '比利时', flag: '🇧🇪' },
        { code: 'CH', name: '瑞士', flag: '🇨🇭' },
        { code: 'AT', name: '奥地利', flag: '🇦🇹' },
        { code: 'SE', name: '瑞典', flag: '🇸🇪' },
        { code: 'NO', name: '挪威', flag: '🇳🇴' },
        { code: 'DK', name: '丹麦', flag: '🇩🇰' },
        { code: 'FI', name: '芬兰', flag: '🇫🇮' },
        { code: 'PL', name: '波兰', flag: '🇵🇱' },
        { code: 'PT', name: '葡萄牙', flag: '🇵🇹' },
        { code: 'GR', name: '希腊', flag: '🇬🇷' },
        { code: 'CZ', name: '捷克', flag: '🇨🇿' },
        { code: 'HU', name: '匈牙利', flag: '🇭🇺' },
        { code: 'RO', name: '罗马尼亚', flag: '🇷🇴' },
        { code: 'UA', name: '乌克兰', flag: '🇺🇦' },
        { code: 'NZ', name: '新西兰', flag: '🇳🇿' },
        { code: 'IE', name: '爱尔兰', flag: '🇮🇪' },
        { code: 'IL', name: '以色列', flag: '🇮🇱' },
        { code: 'PK', name: '巴基斯坦', flag: '🇵🇰' },
        { code: 'BD', name: '孟加拉国', flag: '🇧🇩' },
        { code: 'LK', name: '斯里兰卡', flag: '🇱🇰' },
        { code: 'MM', name: '缅甸', flag: '🇲🇲' },
        { code: 'KH', name: '柬埔寨', flag: '🇰🇭' },
        { code: 'LA', name: '老挝', flag: '🇱🇦' },
        { code: 'MN', name: '蒙古', flag: '🇲🇳' },
        { code: 'KZ', name: '哈萨克斯坦', flag: '🇰🇿' },
        { code: 'UZ', name: '乌兹别克斯坦', flag: '🇺🇿' },
        { code: 'IR', name: '伊朗', flag: '🇮🇷' },
        { code: 'IQ', name: '伊拉克', flag: '🇮🇶' },
        { code: 'QA', name: '卡塔尔', flag: '🇶🇦' },
        { code: 'KW', name: '科威特', flag: '🇰🇼' },
        { code: 'BH', name: '巴林', flag: '🇧🇭' },
        { code: 'OM', name: '阿曼', flag: '🇴🇲' },
        { code: 'JO', name: '约旦', flag: '🇯🇴' },
        { code: 'LB', name: '黎巴嫩', flag: '🇱🇧' },
        { code: 'SY', name: '叙利亚', flag: '🇸🇾' },
        { code: 'YE', name: '也门', flag: '🇾🇪' },
        { code: 'MA', name: '摩洛哥', flag: '🇲🇦' },
        { code: 'DZ', name: '阿尔及利亚', flag: '🇩🇿' },
        { code: 'TN', name: '突尼斯', flag: '🇹🇳' },
        { code: 'LY', name: '利比亚', flag: '🇱🇾' },
        { code: 'SD', name: '苏丹', flag: '🇸🇩' },
        { code: 'ET', name: '埃塞俄比亚', flag: '🇪🇹' },
        { code: 'KE', name: '肯尼亚', flag: '🇰🇪' },
        { code: 'NG', name: '尼日利亚', flag: '🇳🇬' },
        { code: 'GH', name: '加纳', flag: '🇬🇭' },
        { code: 'CO', name: '哥伦比亚', flag: '🇨🇴' },
        { code: 'PE', name: '秘鲁', flag: '🇵🇪' },
        { code: 'CL', name: '智利', flag: '🇨🇱' },
        { code: 'VE', name: '委内瑞拉', flag: '🇻🇪' },
        { code: 'CU', name: '古巴', flag: '🇨🇺' },
        { code: 'DO', name: '多米尼加', flag: '🇩🇴' },
        { code: 'CR', name: '哥斯达黎加', flag: '🇨🇷' },
        { code: 'PA', name: '巴拿马', flag: '🇵🇦' },
        { code: 'UY', name: '乌拉圭', flag: '🇺🇾' },
        { code: 'PY', name: '巴拉圭', flag: '🇵🇾' },
        { code: 'BO', name: '玻利维亚', flag: '🇧🇴' },
        { code: 'EC', name: '厄瓜多尔', flag: '🇪🇨' },
        { code: 'GT', name: '危地马拉', flag: '🇬🇹' },
        { code: 'HN', name: '洪都拉斯', flag: '🇭🇳' },
        { code: 'SV', name: '萨尔瓦多', flag: '🇸🇻' },
        { code: 'NI', name: '尼加拉瓜', flag: '🇳🇮' },
        { code: 'IS', name: '冰岛', flag: '🇮🇸' },
        { code: 'LU', name: '卢森堡', flag: '🇱🇺' },
        { code: 'MC', name: '摩纳哥', flag: '🇲🇨' },
        { code: 'SM', name: '圣马力诺', flag: '🇸🇲' },
        { code: 'VA', name: '梵蒂冈', flag: '🇻🇦' },
        { code: 'MT', name: '马耳他', flag: '🇲🇹' },
        { code: 'CY', name: '塞浦路斯', flag: '🇨🇾' },
        { code: 'EE', name: '爱沙尼亚', flag: '🇪🇪' },
        { code: 'LV', name: '拉脱维亚', flag: '🇱🇻' },
        { code: 'LT', name: '立陶宛', flag: '🇱🇹' },
        { code: 'SK', name: '斯洛伐克', flag: '🇸🇰' },
        { code: 'SI', name: '斯洛文尼亚', flag: '🇸🇮' },
        { code: 'HR', name: '克罗地亚', flag: '🇭🇷' },
        { code: 'RS', name: '塞尔维亚', flag: '🇷🇸' },
        { code: 'BG', name: '保加利亚', flag: '🇧🇬' },
        { code: 'AL', name: '阿尔巴尼亚', flag: '🇦🇱' },
        { code: 'MK', name: '北马其顿', flag: '🇲🇰' },
        { code: 'BA', name: '波黑', flag: '🇧🇦' },
        { code: 'ME', name: '黑山', flag: '🇲🇪' },
        { code: 'XK', name: '科索沃', flag: '🇽🇰' },
        { code: 'MD', name: '摩尔多瓦', flag: '🇲🇩' },
        { code: 'BY', name: '白俄罗斯', flag: '🇧🇾' },
        { code: 'GE', name: '格鲁吉亚', flag: '🇬🇪' },
        { code: 'AM', name: '亚美尼亚', flag: '🇦🇲' },
        { code: 'AZ', name: '阿塞拜疆', flag: '🇦🇿' },
        { code: 'AF', name: '阿富汗', flag: '🇦🇫' },
        { code: 'TM', name: '土库曼斯坦', flag: '🇹🇲' },
        { code: 'TJ', name: '塔吉克斯坦', flag: '🇹🇯' },
        { code: 'KG', name: '吉尔吉斯斯坦', flag: '🇰🇬' },
        { code: 'NP', name: '尼泊尔', flag: '🇳🇵' },
        { code: 'BT', name: '不丹', flag: '🇧🇹' },
        { code: 'MV', name: '马尔代夫', flag: '🇲🇻' },
        { code: 'FJ', name: '斐济', flag: '🇫🇯' },
        { code: 'PG', name: '巴布亚新几内亚', flag: '🇵🇬' },
        { code: 'SB', name: '所罗门群岛', flag: '🇸🇧' },
        { code: 'VU', name: '瓦努阿图', flag: '🇻🇺' },
        { code: 'WS', name: '萨摩亚', flag: '🇼🇸' },
        { code: 'TO', name: '汤加', flag: '🇹🇴' },
        { code: 'KI', name: '基里巴斯', flag: '🇰🇮' },
        { code: 'TV', name: '图瓦卢', flag: '🇹🇻' },
        { code: 'NR', name: '瑙鲁', flag: '🇳🇷' },
        { code: 'PW', name: '帕劳', flag: '🇵🇼' },
        { code: 'FM', name: '密克罗尼西亚', flag: '🇫🇲' },
        { code: 'MH', name: '马绍尔群岛', flag: '🇲🇭' }
    ],

    // 粒子动画
    completionParticles: [],
    completionParticleCanvas: null,
    completionParticleContext: null,
    completionParticleRaf: null,
    completionParticleStartTime: 0,
    completionParticleLastFrame: 0,

    init() {
        this.element = document.getElementById('oobe-screen');
        if (!this.element) return;

        this._createAccessibilityButton();
        this.steps = Array.from(this.element.querySelectorAll('.oobe-step'));
        this._bindEvents();
        this._renderCountryList();
        this.hide();
    },

    shouldShowOnFirstLaunch() {
        try { return !localStorage.getItem(this.STORAGE_KEY); }
        catch (_) { return true; }
    },

    show() {
        if (!this.element) return;
        this.element.classList.remove('hidden');
        this.element.style.opacity = '1';
        this._setAccessibilityButtonVisible(true);
        this._resetFlow();
        this._setStep(0, true);
    },

    hide() {
        if (!this.element) return;
        this._resetCompletionScene();
        this.element.classList.add('hidden');
        this._setAccessibilityButtonVisible(false);
    },

    _resetFlow() {
        this.finishing = false;
        this.selectedLang = null;
        this.selectedCountry = null;
        this.selectedFontSize = 'medium';
        this.isLoggedIn = false;
        this.pinType = '4';
        this.pinValue = '';
        this.pinConfirm = '';
        this.agreed = false;
    },

    _setStep(step, immediate = false) {
        this.currentStep = step;
        this.steps.forEach((section, idx) => {
            if (idx === step) {
                section.classList.add('active');
                if (immediate) {
                    section.style.animation = 'none';
                    requestAnimationFrame(() => { section.style.animation = ''; });
                }
            } else {
                section.classList.remove('active');
            }
        });
        this._updateNextButtonState();
    },

    _next() {
        if (this.currentStep < this.steps.length - 1) {
            this._setStep(this.currentStep + 1);
        } else {
            this.completeAndEnterDesktop();
        }
    },

    _back() {
        if (this.currentStep > 0) {
            this._setStep(this.currentStep - 1);
        }
    },

    _updateNextButtonState() {
        const nextBtn = document.getElementById(`oobe-next-${this.currentStep}`);
        if (!nextBtn) return;
        let enabled = false;
        switch (this.currentStep) {
            case 1: enabled = this.activationKeyValid || this.activationKeySkipped; break; // 激活密钥
            case 2: enabled = !!this.selectedLang; break;
            case 3: enabled = !!this.selectedCountry; break;
            case 4: enabled = true; break;
            case 5: enabled = true; break; // 搜索引擎
            case 6: enabled = true; break; // 连接互联网
            case 7: enabled = this.isLoggedIn; break; // 登录账号
            case 8: enabled = this._validatePin(); break; // 设置密码
            case 9: enabled = true; break; // 个性化
            case 10: enabled = true; break; // SurfAI
            case 11: enabled = true; break; // 启动选项
            case 12: enabled = this.agreed; break; // 协议声明
        }
        nextBtn.disabled = !enabled;
        nextBtn.classList.toggle('is-disabled', !enabled);
    },

    _validatePin() {
        if (!this.pinValue || !this.pinConfirm) return false;
        if (this.pinValue !== this.pinConfirm) return false;
        const minLen = this.pinType === 'custom' ? 4 : parseInt(this.pinType);
        if (this.pinValue.length < minLen) return false;
        return true;
    },

    _bindEvents() {
        // 欢迎页点击
        const welcomeCard = document.getElementById('oobe-card');
        if (welcomeCard) {
            welcomeCard.addEventListener('click', (e) => {
                if (this.currentStep === 0) {
                    this._setStep(1);
                }
            });
        }

        // 语言选择
        this.element.querySelectorAll('.oobe-option-btn[data-lang]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedLang = btn.dataset.lang;
                this.element.querySelectorAll('.oobe-option-btn[data-lang]').forEach(b => b.classList.toggle('active', b === btn));
                // 实时切换语言
                if (typeof I18n !== 'undefined' && typeof I18n.setLanguage === 'function') {
                    I18n.setLanguage(this.selectedLang);
                }
                // 立即更新 State.settings，确保刷新后能读取
                if (typeof State !== 'undefined' && typeof State.updateSettings === 'function') {
                    State.updateSettings({ language: this.selectedLang });
                }
                this._applyOOBELanguage();
                this._updateNextButtonState();
            });
        });

        // 国家搜索
        const countrySearch = document.getElementById('oobe-country-search');
        if (countrySearch) {
            countrySearch.addEventListener('input', () => this._filterCountries(countrySearch.value));
        }

        // 字体大小
        this.element.querySelectorAll('.oobe-option-btn[data-font]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedFontSize = btn.dataset.font;
                this.element.querySelectorAll('.oobe-option-btn[data-font]').forEach(b => b.classList.toggle('active', b === btn));
                this._updateFontPreview();
            });
        });

        // 搜索引擎选择
        this.element.querySelectorAll('.oobe-option-btn[data-engine]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedEngine = btn.dataset.engine;
                this.element.querySelectorAll('.oobe-option-btn[data-engine]').forEach(b => b.classList.toggle('active', b === btn));
            });
        });

        // 登录/注册切换
        this.element.querySelectorAll('.oobe-auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.element.querySelectorAll('.oobe-auth-tab').forEach(t => {
                    const isActive = t === tab;
                    t.classList.toggle('active', isActive);
                    t.style.background = isActive ? '#fff' : 'transparent';
                    t.style.color = isActive ? '#000' : '#666';
                    t.style.boxShadow = isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
                });
                const tabName = tab.dataset.authTab;
                document.getElementById('oobe-auth-login').style.display = tabName === 'login' ? 'block' : 'none';
                document.getElementById('oobe-auth-signup').style.display = tabName === 'signup' ? 'block' : 'none';
            });
        });

        // 登录按钮
        const loginEmail = document.getElementById('oobe-login-email');
        const loginPassword = document.getElementById('oobe-login-password');
        if (loginEmail && loginPassword) {
            const tryLogin = () => this._tryAuth('login');
            loginEmail.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
            loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
        }

        // 注册按钮
        const signupName = document.getElementById('oobe-signup-name');
        const signupEmail = document.getElementById('oobe-signup-email');
        const signupPassword = document.getElementById('oobe-signup-password');
        if (signupPassword) {
            signupPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._tryAuth('signup'); });
        }

        // 密码类型切换
        this.element.querySelectorAll('.oobe-pin-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.pinType = btn.dataset.pinType;
                this.element.querySelectorAll('.oobe-pin-type-btn').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.style.background = isActive ? '#0078d4' : 'var(--input-bg,#fff)';
                    b.style.color = isActive ? '#fff' : 'var(--text-primary,#000)';
                    b.style.borderColor = isActive ? '#0078d4' : 'var(--input-border,#ccc)';
                });
                const pinInput = document.getElementById('oobe-pin-input');
                const pinConfirm = document.getElementById('oobe-pin-confirm');
                if (this.pinType === 'custom') {
                    pinInput.type = 'text';
                    pinConfirm.type = 'text';
                    pinInput.maxLength = 20;
                    pinConfirm.maxLength = 20;
                    pinInput.placeholder = '输入自定义密码';
                    pinConfirm.placeholder = '确认自定义密码';
                } else {
                    pinInput.type = 'password';
                    pinConfirm.type = 'password';
                    pinInput.maxLength = parseInt(this.pinType);
                    pinConfirm.maxLength = parseInt(this.pinType);
                    pinInput.placeholder = `输入${this.pinType}位密码`;
                    pinConfirm.placeholder = `确认${this.pinType}位密码`;
                }
                this.pinValue = '';
                this.pinConfirm = '';
                pinInput.value = '';
                pinConfirm.value = '';
                this._updatePinStatus();
            });
        });

        // 密码输入
        const pinInput = document.getElementById('oobe-pin-input');
        const pinConfirm = document.getElementById('oobe-pin-confirm');
        if (pinInput) {
            pinInput.addEventListener('input', () => {
                this.pinValue = pinInput.value;
                this._updatePinStatus();
            });
        }
        if (pinConfirm) {
            pinConfirm.addEventListener('input', () => {
                this.pinConfirm = pinConfirm.value;
                this._updatePinStatus();
            });
        }

        // 协议勾选
        const agreeCheck = document.getElementById('oobe-agree-check');
        if (agreeCheck) {
            agreeCheck.addEventListener('change', () => {
                this.agreed = agreeCheck.checked;
                this._updateNextButtonState();
            });
        }

        // 启动选项 - 每次进入都重启开关
        const alwaysRestart = document.getElementById('oobe-always-restart');
        const restartIntervalSection = document.getElementById('oobe-restart-interval-section');
        if (alwaysRestart && restartIntervalSection) {
            alwaysRestart.addEventListener('change', () => {
                this.alwaysRestart = alwaysRestart.checked;
                restartIntervalSection.style.display = this.alwaysRestart ? 'none' : 'block';
            });
        }
        // 启动选项 - 间隔时间输入
        const restartHours = document.getElementById('oobe-restart-hours');
        const restartMinutes = document.getElementById('oobe-restart-minutes');
        const restartSeconds = document.getElementById('oobe-restart-seconds');
        if (restartHours) restartHours.addEventListener('input', () => { this.restartHours = parseInt(restartHours.value) || 0; });
        if (restartMinutes) restartMinutes.addEventListener('input', () => { this.restartMinutes = parseInt(restartMinutes.value) || 0; });
        if (restartSeconds) restartSeconds.addEventListener('input', () => { this.restartSeconds = parseInt(restartSeconds.value) || 0; });

        // 登录/注册提交按钮
        const authSubmit = document.getElementById('oobe-auth-submit');
        if (authSubmit) {
            authSubmit.addEventListener('click', () => {
                const activeTab = this.element.querySelector('.oobe-auth-tab.active');
                const mode = activeTab?.dataset.authTab || 'login';
                this._tryAuth(mode);
            });
        }
        // 登录/注册 tab 切换时更新按钮文字
        this.element.querySelectorAll('.oobe-auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (authSubmit) authSubmit.textContent = tab.dataset.authTab === 'signup' ? '注册' : '登录';
            });
        });

        // 主题模式切换
        this.element.querySelectorAll('.oobe-theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedTheme = btn.dataset.theme;
                this.element.querySelectorAll('.oobe-theme-btn').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.style.borderColor = isActive ? '#0078d4' : 'var(--input-border,#ccc)';
                    b.style.background = isActive ? '#e8f0fe' : 'var(--input-bg,#fff)';
                });
            });
        });

        // 激活密钥
        const activationKeyInput = document.getElementById('oobe-activation-key');
        const noKeyBtn = document.getElementById('oobe-no-key-btn');
        const activationStatus = document.getElementById('oobe-activation-status');
        const validKeys = [
            'A3028-AN4HG-23124-9UQSE-52487',
            'A3728-ANLHG-23124-54G68-59587',
            'A4054-ASR2F-588421-BETA1-512546'
        ];
        if (activationKeyInput) {
            activationKeyInput.addEventListener('input', () => {
                const key = activationKeyInput.value.trim().toUpperCase();
                activationKeyInput.value = key;
                if (validKeys.includes(key)) {
                    this.activationKeyValid = true;
                    this.activationKeySkipped = false;
                    if (activationStatus) {
                        let msg = '✓ 已验证';
                        if (key === validKeys[0]) msg += '成员密钥';
                        else if (key === validKeys[1]) msg += '访客密钥';
                        else if (key === validKeys[2]) msg += 'Beta版成员密钥';
                        activationStatus.textContent = msg;
                        activationStatus.style.color = '#107c10';
                    }
                } else if (key.length >= 29) {
                    this.activationKeyValid = false;
                    if (activationStatus) {
                        activationStatus.textContent = '✗ 无效的激活密钥';
                        activationStatus.style.color = '#d13438';
                    }
                } else {
                    this.activationKeyValid = false;
                    if (activationStatus) activationStatus.textContent = '';
                }
                this._updateNextButtonState();
            });
        }
        if (noKeyBtn) {
            noKeyBtn.addEventListener('click', () => {
                this.activationKeySkipped = true;
                this.activationKeyValid = false;
                if (activationKeyInput) activationKeyInput.value = '';
                if (activationStatus) {
                    activationStatus.textContent = '已跳过激活密钥';
                    activationStatus.style.color = '#666';
                }
                this._updateNextButtonState();
            });
        }

        // 壁纸选择
        this.element.querySelectorAll('.oobe-wallpaper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedWallpaper = btn.dataset.wallpaper;
                this.customWallpaper = null;
                this.element.querySelectorAll('.oobe-wallpaper-btn').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.style.borderColor = isActive ? '#0078d4' : 'transparent';
                });
                const preview = document.getElementById('oobe-custom-wallpaper-preview');
                if (preview) preview.style.display = 'none';
            });
        });

        // 上传自定义壁纸
        const wallpaperUpload = document.getElementById('oobe-wallpaper-upload');
        const uploadWallpaperBtn = document.getElementById('oobe-upload-wallpaper-btn');
        if (wallpaperUpload && uploadWallpaperBtn) {
            uploadWallpaperBtn.addEventListener('click', () => wallpaperUpload.click());
            wallpaperUpload.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.customWallpaper = ev.target.result;
                    this.selectedWallpaper = 'custom';
                    this.element.querySelectorAll('.oobe-wallpaper-btn').forEach(b => {
                        b.classList.remove('active');
                        b.style.borderColor = 'transparent';
                    });
                    const preview = document.getElementById('oobe-custom-wallpaper-preview');
                    const previewImg = document.getElementById('oobe-custom-wallpaper-img');
                    if (preview && previewImg) {
                        previewImg.src = ev.target.result;
                        preview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            });
        }

        // API 提供商选择
        this.element.querySelectorAll('.oobe-api-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.apiProvider = btn.dataset.api;
                this.element.querySelectorAll('.oobe-api-btn').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.style.borderColor = isActive ? '#0078d4' : 'var(--input-border,#ccc)';
                    b.style.background = isActive ? '#e8f0fe' : 'var(--input-bg,#fff)';
                });
            });
        });

        // API Key 和 Base URL 输入
        const apiKeyInput = document.getElementById('oobe-api-key');
        const apiBaseInput = document.getElementById('oobe-api-base');
        if (apiKeyInput) apiKeyInput.addEventListener('input', () => { this.apiKey = apiKeyInput.value; });
        if (apiBaseInput) apiBaseInput.addEventListener('input', () => { this.apiBase = apiBaseInput.value; });

        // 返回按钮
        for (let i = 1; i <= 12; i++) {
            const backBtn = document.getElementById(`oobe-back-${i}`);
            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._back();
                });
            }
        }

        // 下一步按钮
        for (let i = 1; i <= 12; i++) {
            const nextBtn = document.getElementById(`oobe-next-${i}`);
            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!nextBtn.disabled) this._next();
                });
            }
        }

        // 完成按钮
        const enterDesktop = document.getElementById('oobe-enter-desktop');
        if (enterDesktop) {
            enterDesktop.addEventListener('click', () => this._enterDesktopTransition());
        }

        // 初始化默认 active 样式
        this.element.querySelectorAll('.oobe-auth-tab').forEach(t => {
            const isActive = t.classList.contains('active');
            t.style.background = isActive ? '#fff' : 'transparent';
            t.style.color = isActive ? '#000' : '#666';
            t.style.boxShadow = isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
        });
        this.element.querySelectorAll('.oobe-pin-type-btn').forEach(b => {
            const isActive = b.classList.contains('active');
            b.style.background = isActive ? '#0078d4' : 'var(--input-bg,#fff)';
            b.style.color = isActive ? '#fff' : 'var(--text-primary,#000)';
            b.style.borderColor = isActive ? '#0078d4' : 'var(--input-border,#ccc)';
        });
    },

    _renderCountryList(filter = '') {
        const list = document.getElementById('oobe-country-list');
        if (!list) return;
        const filtered = filter
            ? this.countries.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.code.toLowerCase().includes(filter.toLowerCase()))
            : this.countries;
        list.innerHTML = filtered.map(c => `
            <div class="oobe-country-item${this.selectedCountry === c.code ? ' active' : ''}" data-code="${c.code}" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--input-border,#eee);transition:background 0.15s;background:${this.selectedCountry === c.code ? 'var(--input-bg,#e8f0fe)' : 'transparent'}">
                <span style="font-size:20px;width:28px;text-align:center">${c.flag}</span>
                <span style="font-size:14px;color:var(--text-primary,#000)">${c.name}</span>
                ${this.selectedCountry === c.code ? '<span style="margin-left:auto;color:#0078d4;font-weight:600">✓</span>' : ''}
            </div>
        `).join('');
        list.querySelectorAll('.oobe-country-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedCountry = item.dataset.code;
                this._renderCountryList(document.getElementById('oobe-country-search')?.value || '');
                this._updateNextButtonState();
            });
        });
    },

    _filterCountries(query) {
        this._renderCountryList(query);
    },

    _updateFontPreview() {
        const preview = document.getElementById('oobe-font-preview');
        const label = document.getElementById('oobe-font-preview-label');
        if (!preview || !label) return;
        const sizes = { small: '32px', medium: '48px', large: '64px' };
        const labels = { small: '极小', medium: '中等', large: '极大' };
        preview.style.fontSize = sizes[this.selectedFontSize] || sizes.medium;
        label.textContent = labels[this.selectedFontSize] || '中等';
    },

    _updateWelcomeText() {
        const welcomeText = document.getElementById('oobe-welcome-text');
        const continueText = document.getElementById('oobe-welcome-continue');
        if (!welcomeText || !continueText) return;
        if (this.selectedLang === 'en') {
            welcomeText.textContent = 'Welcome to NyouOS';
            continueText.textContent = 'Click anywhere to try';
        } else {
            welcomeText.textContent = '欢迎使用 NyouOS';
            continueText.textContent = '点击任意处试试';
        }
    },

    _applyOOBELanguage() {
        const isEn = this.selectedLang === 'en';
        const t = (zh, en) => isEn ? en : zh;

        // 步骤标题和副标题（按 data-step 索引）
        const stepTitles = [
            null, // 0 欢迎页
            t('激活密钥', 'Activation Key'),
            t('选择语言', 'Select Language'),
            t('国家或地区', 'Country or Region'),
            t('字体大小', 'Font Size'),
            t('选择搜索引擎', 'Select Search Engine'),
            t('连接互联网', 'Connect to Internet'),
            t('NyouOS 账号', 'NyouOS Account'),
            t('设置锁屏密码', 'Set Lock Screen Password'),
            t('个性化', 'Personalization'),
            t('SurfAI 智能助手', 'SurfAI Assistant'),
            t('启动选项', 'Startup Options'),
            t('协议与声明', 'Terms and Statements')
        ];
        const stepSubtitles = [
            null,
            t('输入你的 NyouOS 激活密钥以继续。', 'Enter your NyouOS activation key to continue.'),
            t('选择 NyouOS 的显示语言。', 'Select the display language for NyouOS.'),
            t('选择你所在的国家或地区。', 'Select your country or region.'),
            t('选择适合你的字体大小。', 'Choose the font size that suits you.'),
            t('选择桌面搜索框默认使用的搜索引擎。', 'Select the default search engine for the desktop search box.'),
            t('保持连接以获得完整体验。', 'Stay connected for the full experience.'),
            t('登录或注册以同步你的数据。', 'Sign in or register to sync your data.'),
            t('设置密码以保护你的设备。', 'Set a password to protect your device.'),
            t('选择壁纸和主题模式。', 'Choose wallpaper and theme mode.'),
            t('接入自定义 API 以使用高级 AI 功能。', 'Connect a custom API to use advanced AI features.'),
            t('设置系统启动行为。', 'Configure system startup behavior.'),
            t('请仔细阅读以下条款。', 'Please read the following terms carefully.')
        ];

        this.element.querySelectorAll('.oobe-step').forEach(step => {
            const idx = parseInt(step.dataset.step);
            const h1 = step.querySelector('h1');
            const p = step.querySelector('.oobe-panel-scroll > p');
            if (h1 && stepTitles[idx]) h1.textContent = stepTitles[idx];
            if (p && stepSubtitles[idx]) p.textContent = stepSubtitles[idx];
        });

        // 语言选项
        const langBtns = this.element.querySelectorAll('.oobe-option-btn[data-lang]');
        if (langBtns[0]) {
            langBtns[0].querySelector('.oobe-option-title').textContent = t('简体中文', 'Simplified Chinese');
            langBtns[0].querySelector('.oobe-option-desc').textContent = t('推荐中文用户', 'Recommended for Chinese users');
        }
        if (langBtns[1]) {
            langBtns[1].querySelector('.oobe-option-title').textContent = t('English', 'English');
            langBtns[1].querySelector('.oobe-option-desc').textContent = t('For English users', 'For English users');
        }

        // 国家搜索
        const countrySearch = document.getElementById('oobe-country-search');
        if (countrySearch) countrySearch.placeholder = t('搜索国家或地区...', 'Search country or region...');

        // 字体大小
        const fontLabels = this.element.querySelectorAll('.oobe-option-btn[data-font] .oobe-option-title');
        const fontDescs = this.element.querySelectorAll('.oobe-option-btn[data-font] .oobe-option-desc');
        if (fontLabels[0]) fontLabels[0].textContent = t('极小', 'Small');
        if (fontDescs[0]) fontDescs[0].textContent = t('显示更多内容', 'Show more content');
        if (fontLabels[1]) fontLabels[1].textContent = t('中等', 'Medium');
        if (fontDescs[1]) fontDescs[1].textContent = t('推荐大小', 'Recommended size');
        if (fontLabels[2]) fontLabels[2].textContent = t('极大', 'Large');
        if (fontDescs[2]) fontDescs[2].textContent = t('更易阅读', 'Easier to read');

        // 搜索引擎
        const engineLabels = this.element.querySelectorAll('.oobe-option-btn[data-engine] .oobe-option-title');
        const engineDescs = this.element.querySelectorAll('.oobe-option-btn[data-engine] .oobe-option-desc');
        if (engineLabels[0]) engineLabels[0].textContent = 'Google';
        if (engineDescs[0]) engineDescs[0].textContent = t('全球最大搜索引擎', "World's largest search engine");
        if (engineLabels[1]) engineLabels[1].textContent = 'Bing';
        if (engineDescs[1]) engineDescs[1].textContent = t('微软必应搜索', 'Microsoft Bing search');
        if (engineLabels[2]) engineLabels[2].textContent = 'DuckDuckGo';
        if (engineDescs[2]) engineDescs[2].textContent = t('注重隐私的搜索引擎', 'Privacy-focused search engine');
        if (engineLabels[3]) engineLabels[3].textContent = t('百度', 'Baidu');
        if (engineDescs[3]) engineDescs[3].textContent = t('中文搜索引擎', 'Chinese search engine');

        // 连接互联网
        const ethernetStrong = this.element.querySelector('.oobe-setting-card strong');
        if (ethernetStrong) ethernetStrong.textContent = t('以太网', 'Ethernet');
        const ethernetSpan = this.element.querySelector('.oobe-setting-card span');
        if (ethernetSpan) ethernetSpan.textContent = t('已连接 · 互联网访问正常', 'Connected · Internet access OK');
        const internetHint = this.element.querySelector('.oobe-panel-scroll > div[style*="margin-top:16px"]');
        if (internetHint) internetHint.textContent = t('你已连接到互联网，可以继续设置。', 'You are connected to the internet and can continue setup.');

        // 账号登录/注册
        const authTabs = this.element.querySelectorAll('.oobe-auth-tab');
        if (authTabs[0]) authTabs[0].textContent = t('登录', 'Sign In');
        if (authTabs[1]) authTabs[1].textContent = t('注册', 'Sign Up');
        const authSubmit = document.getElementById('oobe-auth-submit');
        if (authSubmit) {
            const activeTab = this.element.querySelector('.oobe-auth-tab.active');
            authSubmit.textContent = activeTab?.dataset.authTab === 'signup' ? t('注册', 'Sign Up') : t('登录', 'Sign In');
        }
        // 账号输入框标签和占位符
        const settingTitles = this.element.querySelectorAll('.oobe-setting-title');
        // 登录表单
        const loginEmail = document.getElementById('oobe-login-email');
        const loginPassword = document.getElementById('oobe-login-password');
        if (loginEmail) loginEmail.placeholder = t('邮箱地址', 'Email address');
        if (loginPassword) loginPassword.placeholder = t('密码', 'Password');
        // 注册表单
        const signupName = document.getElementById('oobe-signup-name');
        const signupEmail = document.getElementById('oobe-signup-email');
        const signupPassword = document.getElementById('oobe-signup-password');
        if (signupName) signupName.placeholder = t('用户名', 'Username');
        if (signupEmail) signupEmail.placeholder = t('邮箱地址', 'Email address');
        if (signupPassword) signupPassword.placeholder = t('密码（至少6位）', 'Password (min 6 chars)');

        // 密码类型
        const pinTypeBtns = this.element.querySelectorAll('.oobe-pin-type-btn');
        if (pinTypeBtns[0]) pinTypeBtns[0].textContent = t('4位数字', '4-digit PIN');
        if (pinTypeBtns[1]) pinTypeBtns[1].textContent = t('6位数字', '6-digit PIN');
        if (pinTypeBtns[2]) pinTypeBtns[2].textContent = t('自定义', 'Custom');
        const pinInput = document.getElementById('oobe-pin-input');
        const pinConfirm = document.getElementById('oobe-pin-confirm');
        if (pinInput) pinInput.placeholder = t(`输入${this.pinType}位密码`, `Enter ${this.pinType}-digit password`);
        if (pinConfirm) pinConfirm.placeholder = t(`确认${this.pinType}位密码`, `Confirm ${this.pinType}-digit password`);

        // 个性化
        const themeBtns = this.element.querySelectorAll('.oobe-theme-btn');
        if (themeBtns[0]) themeBtns[0].innerHTML = `<span style="font-size:16px">☀️</span> ${t('浅色', 'Light')}`;
        if (themeBtns[1]) themeBtns[1].innerHTML = `<span style="font-size:16px">🌙</span> ${t('深色', 'Dark')}`;
        const bingWallpaper = this.element.querySelector('.oobe-wallpaper-btn[data-wallpaper="bing"]');
        if (bingWallpaper) bingWallpaper.textContent = t('Bing 每日', 'Bing Daily');
        const uploadBtn = document.getElementById('oobe-upload-wallpaper-btn');
        if (uploadBtn) uploadBtn.textContent = `📁 ${t('上传自定义壁纸', 'Upload custom wallpaper')}`;

        // SurfAI
        const apiBtns = this.element.querySelectorAll('.oobe-api-btn');
        if (apiBtns[0]) apiBtns[0].textContent = 'OpenAI';
        if (apiBtns[1]) apiBtns[1].textContent = 'DeepSeek';
        if (apiBtns[2]) apiBtns[2].textContent = 'Anges';
        if (apiBtns[3]) apiBtns[3].textContent = 'GLM';
        const apiKeyInput = document.getElementById('oobe-api-key');
        const apiBaseInput = document.getElementById('oobe-api-base');
        if (apiKeyInput) apiKeyInput.placeholder = t('输入您的 API Key（可选，稍后可在设置中配置）', 'Enter your API Key (optional, configure later in Settings)');
        if (apiBaseInput) apiBaseInput.placeholder = t('自定义 API 地址（可选）', 'Custom API Base URL (optional)');
        const surfaiHint = this.element.querySelector('.oobe-panel-scroll > div[style*="padding:12px"]');
        if (surfaiHint) surfaiHint.textContent = t('不接入 API 也可使用本地取词功能。接入后可使用 NyouOS 输入法的 AI 辅助写作功能。', 'You can use local keyword features without an API. After connecting, you can use the AI writing assist in NyouOS Input Method.');

        // 启动选项
        const alwaysRestartLabel = this.element.querySelector('#oobe-always-restart')?.closest('.oobe-setting-card')?.querySelector('strong');
        if (alwaysRestartLabel) alwaysRestartLabel.textContent = t('每次进入都重启', 'Restart on every visit');
        const alwaysRestartDesc = this.element.querySelector('#oobe-always-restart')?.closest('.oobe-setting-card')?.querySelector('span');
        if (alwaysRestartDesc) alwaysRestartDesc.textContent = t('每次打开网页时重新启动系统', 'Restart the system every time the page is opened');
        const intervalTitle = this.element.querySelector('#oobe-restart-interval-section .oobe-setting-title');
        if (intervalTitle) intervalTitle.textContent = t('每隔以下时间再次进入将重启', 'Restart after the following interval');
        const intervalHint = this.element.querySelector('#oobe-restart-interval-section > div:last-child');
        if (intervalHint) intervalHint.textContent = t('超过此时间后再次打开网页将重新启动系统，否则保持当前状态。', 'After this interval, reopening the page will restart the system; otherwise, the current state is maintained.');

        // 协议
        const agreeLabel = this.element.querySelector('#oobe-agree-check')?.closest('.oobe-setting-card')?.querySelector('strong');
        if (agreeLabel) agreeLabel.textContent = t('我已阅读并同意上述协议与声明', 'I have read and agree to the above terms and statements');

        // 完成页
        const completionTitle = document.getElementById('oobe-completion-title');
        if (completionTitle) completionTitle.textContent = t('设置完成', 'Setup Complete');
        const completionDesc = document.querySelector('.oobe-completion-content p');
        if (completionDesc) completionDesc.textContent = t('需要重启以应用所有更改（语言、主题、壁纸等）', 'A restart is required to apply all changes (language, theme, wallpaper, etc.)');
        const completionBtn = document.getElementById('oobe-enter-desktop');
        if (completionBtn) completionBtn.textContent = t('立即重启', 'Restart Now');

        // 更新欢迎文字
        this._updateWelcomeText();
    },

    _updatePinStatus() {
        const status = document.getElementById('oobe-pin-status');
        if (!status) return;
        if (!this.pinValue && !this.pinConfirm) {
            status.textContent = '';
            status.className = 'oobe-status';
        } else if (this.pinValue && !this.pinConfirm) {
            status.textContent = '请再次输入密码以确认';
            status.className = 'oobe-status';
        } else if (this.pinValue !== this.pinConfirm) {
            status.textContent = '两次输入的密码不一致';
            status.className = 'oobe-status error';
        } else if (this._validatePin()) {
            status.textContent = '✓ 密码设置成功';
            status.className = 'oobe-status success';
        } else {
            const minLen = this.pinType === 'custom' ? 4 : parseInt(this.pinType);
            status.textContent = `密码至少需要${minLen}位`;
            status.className = 'oobe-status error';
        }
        this._updateNextButtonState();
    },

    async _tryAuth(mode) {
        const status = document.getElementById('oobe-auth-status');
        const email = mode === 'login'
            ? document.getElementById('oobe-login-email')?.value
            : document.getElementById('oobe-signup-email')?.value;
        const password = mode === 'login'
            ? document.getElementById('oobe-login-password')?.value
            : document.getElementById('oobe-signup-password')?.value;
        const name = mode === 'signup' ? document.getElementById('oobe-signup-name')?.value : '';

        if (!email || !password) {
            if (status) { status.textContent = '请输入邮箱和密码'; status.className = 'oobe-status error'; }
            return;
        }
        if (password.length < 6) {
            if (status) { status.textContent = '密码至少6位'; status.className = 'oobe-status error'; }
            return;
        }

        if (status) { status.textContent = mode === 'login' ? '正在登录...' : '正在注册...'; status.className = 'oobe-status loading'; }

        try {
            if (typeof SupabaseClient !== 'undefined' && !SupabaseClient.isInitialized && typeof SupabaseClient.init === 'function') {
                await SupabaseClient.init();
            }
            if (typeof SupabaseClient !== 'undefined' && SupabaseClient.isInitialized) {
                if (mode === 'login') {
                    await SupabaseClient.signIn(email, password);
                } else {
                    await SupabaseClient.signUp(email, password, name || 'NyouOS 用户');
                }
                this.isLoggedIn = true;
                if (status) { status.textContent = mode === 'login' ? '✓ 登录成功！' : '✓ 注册成功！已自动登录'; status.className = 'oobe-status success'; }
                this._updateNextButtonState();
            } else {
                // Supabase 不可用时的降级处理
                this.isLoggedIn = true;
                if (status) { status.textContent = '✓ 已跳过账号登录（离线模式）'; status.className = 'oobe-status success'; }
                this._updateNextButtonState();
            }
        } catch (e) {
            if (status) { status.textContent = (mode === 'login' ? '登录失败：' : '注册失败：') + (e.message || e); status.className = 'oobe-status error'; }
        }
    },

    completeAndEnterDesktop() {
        if (this.finishing || !this.element) return;
        this.finishing = true;
        this._applySelections();
        this._markCompleted();
        if (State && typeof State.updateSession === 'function') {
            State.updateSession({ isLoggedIn: true, lastLogin: new Date().toISOString(), loginAttempts: 0 });
        }
        this._showCompletionScene();
        setTimeout(() => this._requestLocationService(), 1000);
    },

    _applySelections() {
        if (typeof State !== 'undefined' && typeof State.updateSettings === 'function') {
            const settings = {};
            if (this.selectedLang) settings.language = this.selectedLang;
            if (this.selectedCountry) settings.country = this.selectedCountry;
            if (this.selectedFontSize) settings.fontSize = this.selectedFontSize;
            if (this.selectedEngine) settings.searchEngine = this.selectedEngine;
            if (this.selectedTheme) settings.theme = this.selectedTheme;
            if (this.selectedWallpaper) settings.wallpaper = this.selectedWallpaper;
            if (this.customWallpaper) settings.customWallpaper = this.customWallpaper;
            if (this.apiProvider) settings.apiProvider = this.apiProvider;
            if (this.apiKey) settings.apiKey = this.apiKey;
            if (this.apiBase) settings.apiBase = this.apiBase;
            if (this.pinValue) settings.pin = this.pinValue;
            settings.alwaysRestart = this.alwaysRestart;
            settings.restartHours = this.restartHours;
            settings.restartMinutes = this.restartMinutes;
            settings.restartSeconds = this.restartSeconds;
            State.updateSettings(settings);
        }
        if (typeof I18n !== 'undefined' && this.selectedLang && typeof I18n.setLanguage === 'function') {
            I18n.setLanguage(this.selectedLang);
        }
    },

    _markCompleted() {
        try { localStorage.setItem(this.STORAGE_KEY, '1'); } catch (_) {}
    },

    _showCompletionScene() {
        if (!this.element || this.completionShown) return;
        this.completionShown = true;
        const completion = document.getElementById('oobe-completion');
        if (completion) completion.setAttribute('aria-hidden', 'false');
        this._buildCompletionParticles();
        this._startCompletionParticleBurst();
    },

    _resetCompletionScene() {
        this._stopCompletionParticles();
        this.completionShown = false;
        const completion = document.getElementById('oobe-completion');
        if (completion) completion.setAttribute('aria-hidden', 'true');
    },

    _enterDesktopTransition() {
        const desktopEl = document.getElementById('desktop-screen');
        if (desktopEl) {
            if (typeof Desktop !== 'undefined' && typeof Desktop.show === 'function') Desktop.show();
            desktopEl.classList.remove('hidden');
        }
        this.element.classList.add('oobe-leaving');
        setTimeout(() => {
            if (State && typeof State.setView === 'function') State.setView('desktop');
            this.hide();
            this.finishing = false;
            this._setAccessibilityButtonVisible(false);
            // 刷新页面，让系统用新的语言/主题/壁纸设置重新初始化
            setTimeout(() => location.reload(), 300);
        }, 600);
    },

    _requestLocationService() {
        const overlay = document.createElement('div');
        overlay.className = 'location-permission-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:20px;padding:28px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center">
                <div style="font-size:48px;margin-bottom:16px">📍</div>
                <div style="font-size:20px;font-weight:700;margin-bottom:8px;color:#000">启用定位服务</div>
                <div style="font-size:14px;color:#666;line-height:1.6;margin-bottom:20px">由于心情小组件、天气、天气小组件使用定位服务，我们已向您的浏览器发送定位服务请求，请您选择同意。</div>
                <div style="display:flex;gap:10px">
                    <button class="loc-deny" style="flex:1;padding:12px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#333;cursor:pointer;font-size:14px;font-weight:500">暂不</button>
                    <button class="loc-allow" style="flex:1;padding:12px;border:none;border-radius:12px;background:#0078d4;color:#fff;cursor:pointer;font-size:14px;font-weight:600">允许</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.loc-deny').addEventListener('click', close);
        overlay.querySelector('.loc-allow').addEventListener('click', () => {
            close();
            this._doRequestLocation();
        });
    },

    _doRequestLocation() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh-CN`);
                    const data = await res.json();
                    let city = '';
                    if (data.address) {
                        city = data.address.city || data.address.town || data.address.county || data.address.state || data.address.province || '';
                        if (!city && data.address.village) city = data.address.village;
                    }
                    if (!city) {
                        const parts = (data.display_name || '').split(',');
                        if (parts.length >= 2) city = parts[parts.length - 3] || parts[0];
                    }
                    if (city) {
                        city = city.trim();
                        if (State && typeof State.updateSettings === 'function') {
                            State.updateSettings({ userCity: city });
                        }
                        if (typeof Widgets !== 'undefined' && typeof Widgets.refreshWidgetsByPrefix === 'function') {
                            Widgets.refreshWidgetsByPrefix('mood-');
                        }
                    }
                } catch (e) {}
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    },

    // ========== 辅助功能按钮 ==========
    _createAccessibilityButton() {
        if (document.getElementById('oobe-a11y-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'oobe-a11y-btn';
        btn.type = 'button';
        btn.title = '辅助功能';
        btn.setAttribute('aria-label', '辅助功能');
        btn.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:9999;width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);backdrop-filter:blur(12px);box-shadow:0 4px 16px rgba(0,0,0,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s';
        btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M19 13v-2a7 7 0 0 0-14 0v2"/><path d="M5 19a7 7 0 0 0 14 0"/><line x1="12" y1="10" x2="12" y2="15"/></svg>';
        btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.1)'; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; });

        const panel = document.createElement('div');
        panel.id = 'oobe-a11y-panel';
        panel.style.cssText = 'position:fixed;right:24px;bottom:84px;z-index:10000;width:320px;max-height:70vh;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.25);padding:18px;display:none;font-family:inherit;overflow-y:auto';
        panel.innerHTML = `
            <div style="font-size:17px;font-weight:600;margin-bottom:14px;color:#000;display:flex;align-items:center;gap:8px">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M19 13v-2a7 7 0 0 0-14 0v2"/><path d="M5 19a7 7 0 0 0 14 0"/><line x1="12" y1="10" x2="12" y2="15"/></svg>
                辅助功能
            </div>
            <div id="oobe-a11y-list"></div>
            <div style="font-size:11px;color:#999;margin-top:12px;text-align:center">NyouOS 辅助功能</div>
        `;

        const a11yOptions = [
            { key: 'invertMode', label: '反色模式', desc: '反转屏幕颜色，提高对比度', type: 'toggle' },
            { key: 'grayscaleMode', label: '灰度模式', desc: '整个屏幕变为黑白灰度', type: 'toggle' },
            { key: 'highContrastMode', label: '高对比度', desc: '增强屏幕元素的对比度', type: 'toggle' },
            { key: 'largeTextMode', label: '大字体', desc: '增大系统字体大小', type: 'toggle' },
            { key: 'screenReader', label: '旁白', desc: '朗读屏幕上的文字内容', type: 'toggle' },
            { key: 'screenKeyboard', label: '屏幕键盘', desc: '输入时显示虚拟键盘', type: 'toggle' },
            { key: 'enableAnimation', label: '减少动画', desc: '禁用系统动画和过渡效果', type: 'toggle', invert: true }
        ];

        const listEl = panel.querySelector('#oobe-a11y-list');
        a11yOptions.forEach((opt, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:11px 0;' + (idx < a11yOptions.length - 1 ? 'border-bottom:1px solid rgba(0,0,0,0.08)' : '');
            const labelDiv = document.createElement('div');
            labelDiv.innerHTML = `<div style="font-size:14px;font-weight:500;color:#000">${opt.label}</div><div style="font-size:12px;color:#666;margin-top:3px">${opt.desc}</div>`;
            row.appendChild(labelDiv);

            if (opt.type === 'toggle') {
                const isChecked = opt.invert ? (State?.settings?.[opt.key] === false) : (State?.settings?.[opt.key] === true);
                const label = document.createElement('label');
                label.style.cssText = 'position:relative;display:inline-block;width:46px;height:26px;cursor:pointer;flex-shrink:0';
                label.innerHTML = `
                    <input type="checkbox" data-a11y-key="${opt.key}" data-a11y-invert="${opt.invert || 'false'}" style="opacity:0;width:0;height:0" ${isChecked ? 'checked' : ''}>
                    <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:${isChecked ? '#0078d4' : '#ccc'};transition:.3s;border-radius:26px"></span>
                    <span style="position:absolute;height:20px;width:20px;left:3px;bottom:3px;background-color:white;transition:.3s;border-radius:50%;z-index:1;box-shadow:0 1px 3px rgba(0,0,0,0.2);transform:translateX(${isChecked ? '20px' : '0'})"></span>
                `;
                const input = label.querySelector('input');
                input.addEventListener('change', () => {
                    const invert = input.dataset.a11yInvert === 'true';
                    const value = invert ? !input.checked : input.checked;
                    if (State && typeof State.updateSettings === 'function') State.updateSettings({ [opt.key]: value });
                    label.querySelector('span:nth-child(2)').style.backgroundColor = input.checked ? '#0078d4' : '#ccc';
                    label.querySelector('span:nth-child(3)').style.transform = input.checked ? 'translateX(20px)' : 'translateX(0)';
                });
                row.appendChild(label);
            }
            listEl.appendChild(row);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && !btn.contains(e.target)) panel.style.display = 'none';
        });

        document.body.appendChild(btn);
        document.body.appendChild(panel);
        this.a11yBtn = btn;
        this.a11yPanel = panel;
    },

    _setAccessibilityButtonVisible(visible) {
        if (this.a11yBtn) this.a11yBtn.style.display = visible ? 'flex' : 'none';
        if (this.a11yPanel && !visible) this.a11yPanel.style.display = 'none';
    },

    // ========== 完成粒子动画 ==========
    _buildCompletionParticles() {
        this._stopCompletionParticles();
        const canvas = document.getElementById('oobe-completion-particles');
        const context = canvas?.getContext?.('2d');
        if (!canvas || !context) return;
        this.completionParticleCanvas = canvas;
        this.completionParticleContext = context;
        const resize = () => {
            const width = Math.max(1, window.innerWidth);
            const height = Math.max(1, window.innerHeight);
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        this._completionResizeHandler = resize;
        window.addEventListener('resize', resize);
        resize();

        const width = window.innerWidth;
        const height = window.innerHeight;
        const count = Math.min(200, Math.max(100, Math.round((width * height) / 8000)));
        this.completionParticles = Array.from({ length: count }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            return {
                x: width / 2,
                y: height / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                hue: 180 + Math.random() * 60,
                alpha: 0.6 + Math.random() * 0.4,
                life: 1
            };
        });
    },

    _startCompletionParticleBurst() {
        if (!this.completionParticleCanvas || !this.completionParticleContext) return;
        this.completionParticleStartTime = performance.now();
        this.completionParticleLastFrame = 0;
        this.completionParticleRaf = requestAnimationFrame((time) => this._animateCompletionParticles(time));
    },

    _animateCompletionParticles(time) {
        const canvas = this.completionParticleCanvas;
        const context = this.completionParticleContext;
        if (!canvas || !context || !this.completionShown) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        context.clearRect(0, 0, width, height);
        this.completionParticles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.vx *= 0.99;
            p.life -= 0.005;
            if (p.life <= 0) return;
            context.save();
            context.globalAlpha = p.alpha * p.life;
            context.fillStyle = `hsl(${p.hue}, 80%, 70%)`;
            context.shadowColor = `hsl(${p.hue}, 80%, 70%)`;
            context.shadowBlur = 8;
            context.beginPath();
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            context.fill();
            context.restore();
        });
        this.completionParticleRaf = requestAnimationFrame((nextTime) => this._animateCompletionParticles(nextTime));
    },

    _stopCompletionParticles() {
        if (this.completionParticleRaf) cancelAnimationFrame(this.completionParticleRaf);
        this.completionParticleRaf = null;
        if (this._completionResizeHandler) window.removeEventListener('resize', this._completionResizeHandler);
        this.completionParticles = [];
        this.completionParticleCanvas = null;
        this.completionParticleContext = null;
    }
};
