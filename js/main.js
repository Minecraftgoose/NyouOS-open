/**
 * NyouOS - 主入口文件
 * 闭源 © 2025-2026 KevinAnanda. All rights reserved.
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', async () => {
    console.log('%c NyouOS On Web v28.0 ', 'background:#0078d4;color:white;padding:4px 8px;border-radius:4px;');

    try {
        // 1. 核心状态初始化
        if (typeof State !== 'undefined' && typeof State.init === 'function') {
            State.init();
            console.log('[Core] State initialized');
        }

        // 1.5 自动重启检查
        (function checkAutoRestart() {
            try {
                // 刚重启过，跳过（避免无限循环）
                if (sessionStorage.getItem('nyouos_just_restarted')) {
                    sessionStorage.removeItem('nyouos_just_restarted');
                    return;
                }
                const s = State?.settings;
                if (!s) return;
                const now = Date.now();
                let shouldRestart = false;
                if (s.autoRestartEveryVisit) {
                    shouldRestart = true;
                } else {
                    const last = Number(localStorage.getItem('nyouos_last_restart') || 0);
                    const interval = ((s.autoRestartHours || 0) * 3600 + (s.autoRestartMinutes || 0) * 60 + (s.autoRestartSeconds || 0)) * 1000;
                    if (interval > 0 && now - last >= interval) {
                        shouldRestart = true;
                    }
                }
                if (shouldRestart) {
                    sessionStorage.setItem('nyouos_just_restarted', '1');
                    localStorage.setItem('nyouos_last_restart', String(now));
                    console.log('[AutoRestart] 触发重启');
                    location.reload();
                }
            } catch (e) {
                console.warn('[AutoRestart] 检查失败:', e);
            }
        })();

        // 2. 国际化初始化（依赖 State.settings.language）
        if (typeof I18n !== 'undefined' && typeof I18n.init === 'function') {
            I18n.init();
            console.log('[Core] I18n initialized');
        }

        // 3. 窗口管理器初始化
        if (typeof WindowManager !== 'undefined' && typeof WindowManager.init === 'function') {
            WindowManager.init();
            console.log('[UI] WindowManager initialized');
        }

        // 4. 桌面初始化
        if (typeof Desktop !== 'undefined' && typeof Desktop.init === 'function') {
            Desktop.init();
            console.log('[UI] Desktop initialized');
        }

        // 5. 锁屏初始化
        if (typeof LockScreen !== 'undefined' && typeof LockScreen.init === 'function') {
            LockScreen.init();
            console.log('[UI] LockScreen initialized');
        }

        // 5.5 登录屏初始化
        if (typeof LoginScreen !== 'undefined' && typeof LoginScreen.init === 'function') {
            LoginScreen.init();
            console.log('[UI] LoginScreen initialized');
        }

        // 6. OOBE 初始化（必须在 BootScreen.show 之前）
        if (typeof OOBE !== 'undefined' && typeof OOBE.init === 'function') {
            OOBE.init();
            console.log('[UI] OOBE initialized');
        }

        // 7. 开始菜单初始化
        if (typeof StartMenu !== 'undefined' && typeof StartMenu.init === 'function') {
            StartMenu.init();
            console.log('[UI] StartMenu initialized');
        }

        // 8. 任务栏初始化
        if (typeof Taskbar !== 'undefined' && typeof Taskbar.init === 'function') {
            Taskbar.init();
            console.log('[UI] Taskbar initialized');
        }

        // 9. 控制中心初始化
        if (typeof ControlCenter !== 'undefined' && typeof ControlCenter.init === 'function') {
            ControlCenter.init();
            console.log('[UI] ControlCenter initialized');
        }

        // 10. 通知中心初始化
        if (typeof NotificationCenter !== 'undefined' && typeof NotificationCenter.init === 'function') {
            NotificationCenter.init();
            console.log('[UI] NotificationCenter initialized');
        }

        // 11. 小组件初始化
        if (typeof Widgets !== 'undefined' && typeof Widgets.init === 'function') {
            Widgets.init();
            console.log('[UI] Widgets initialized');
        }

        // 11.5 SurfAi 初始化
        if (typeof SurfAi !== 'undefined' && typeof SurfAi.init === 'function') {
            SurfAi.init();
            console.log('[AI] SurfAi initialized');
        }

        // 12. Supabase 初始化（非阻塞）
        if (typeof SupabaseClient !== 'undefined') {
            SupabaseClient.init().catch(err => console.error('[Supabase] Init error:', err));
        }

        // 13. 启动画面并开始启动流程
        if (typeof BootScreen !== 'undefined') {
            BootScreen.init();
            BootScreen.show();
            console.log('[Boot] Started');
        }
    } catch (error) {
        console.error('[Boot] Fatal error:', error);
    }
});
