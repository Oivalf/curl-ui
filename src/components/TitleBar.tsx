import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, Copy, Menu, ChevronRight } from 'lucide-preact';
import { saveActiveItemCollection, saveAllCollections, isAboutOpen, activeProjectName, showPrompt } from '../store';
import { openUserGuideWindow } from '../utils/window';
import { t } from '../i18n';

export function TitleBar() {
    const isMaximized = useSignal(false);
    const isMenuOpen = useSignal(false);
    const activeSubmenu = useSignal<string | null>(null);
    const recentProjects = useSignal<string[]>([]);
    const appWindow = getCurrentWindow();

    const url = new URL(window.location.href);
    const view = url.searchParams.get('view');
    const isUserGuide = view === 'user-guide';
    const displayTitle = isUserGuide ? t('titleBar.userGuideTitle') : t('titleBar.title', { name: activeProjectName.value });

    useEffect(() => {
        // Check initial maximized state
        appWindow.isMaximized().then(m => isMaximized.value = m);

        // Listen for resize to track maximized state
        const unlisten = appWindow.onResized(async () => {
            isMaximized.value = await appWindow.isMaximized();
        });

        return () => { unlisten.then(f => f()); };
    }, []);

    const openMenu = async () => {
        isMenuOpen.value = !isMenuOpen.value;
        activeSubmenu.value = null;
        if (!isMenuOpen.value) return;

        // Pre-fetch recent projects
        try {
            const projects = await invoke<string[]>('list_recent_projects');
            recentProjects.value = projects.filter(p => p !== activeProjectName.value);
        } catch (err) {
            console.error('Failed to list recent projects:', err);
        }
    };

    const closeMenu = () => {
        isMenuOpen.value = false;
        activeSubmenu.value = null;
    };

    const openNewProjectWindow = async () => {
        const projectName = await showPrompt(t('prompt.enterProjectName'), t('welcome.newProject'));
        if (!projectName) return;

        // Open a new window for a new project/workspace
        const label = `project-${crypto.randomUUID()}`;
        const webview = new WebviewWindow(label, {
            url: `/?projectName=${encodeURIComponent(projectName)}`,
            title: `cURL-UI - ${projectName}`,
            decorations: false,
            transparent: false,
            dragDropEnabled: false
        });
        webview.once('tauri://error', function (e) {
            console.error(e);
        });
    };

    const handleAction = async (action: string) => {
        closeMenu();
        switch (action) {
            case 'new_project':
                await openNewProjectWindow();
                break;
            case 'save':
                await saveActiveItemCollection();
                break;
            case 'save_all':
                await saveAllCollections();
                break;
            case 'quit':
                await appWindow.close();
                break;
            case 'user_guide':
                await openUserGuideWindow();
                break;
            case 'about':
                isAboutOpen.value = true;
                break;
        }
    };

    const switchProject = async (projectName: string) => {
        closeMenu();
        const label = `project-${crypto.randomUUID()}`;
        const webview = new WebviewWindow(label, {
            url: `/?projectName=${encodeURIComponent(projectName)}`,
            title: `cURL-UI - ${projectName}`,
            decorations: false,
            transparent: false,
            dragDropEnabled: false
        });
        webview.once('tauri://error', function (e) {
            console.error(e);
        });
    };

    return (
        <div class="titlebar" data-tauri-drag-region>
            <div class="titlebar-left" data-tauri-drag-region>
                <img
                    src="/icons/32x32.png"
                    alt="cURL-UI"
                    class="titlebar-icon"
                    draggable={false}
                />

                {/* Burger Menu Button */}
                <button
                    class="titlebar-burger"
                    onClick={openMenu}
                    title="Menu"
                >

                    <Menu size={16} />
                </button>
            </div>

            <div class="titlebar-title" data-tauri-drag-region>{displayTitle}</div>

            {/* Burger Dropdown */}
            {isMenuOpen.value && (
                <>
                    <div class="burger-backdrop" onClick={closeMenu} />
                    <div class="burger-dropdown">
                        {/* File Section */}
                        <div class="burger-section-label">{t('titleBar.menu.file')}</div>
                        <button class="burger-menu-item" onClick={() => handleAction('new_project')}>
                            <span>{t('titleBar.menu.newProject')}</span>
                        </button>
                        <button class="burger-menu-item" onClick={() => handleAction('save')}>
                            <span>{t('common.save')}</span>
                            <span class="burger-shortcut">Ctrl+S</span>
                        </button>
                        <button class="burger-menu-item" onClick={() => handleAction('save_all')}>
                            <span>{t('common.saveAll')}</span>
                            <span class="burger-shortcut">Ctrl+Shift+S</span>
                        </button>

                        {/* Recent Projects Submenu */}
                        <div
                            class={`burger-menu-item burger-submenu-trigger ${activeSubmenu.value === 'recent' ? 'active' : ''}`}
                            onMouseEnter={() => activeSubmenu.value = 'recent'}
                        >
                            <span>{t('titleBar.menu.recentProjects')}</span>
                            <ChevronRight size={14} />

                            {activeSubmenu.value === 'recent' && (
                                <div class="burger-submenu">
                                    {recentProjects.value.length === 0 ? (
                                        <div class="burger-menu-item disabled">
                                            <span>{t('titleBar.menu.noOtherProjects')}</span>
                                        </div>
                                    ) : (
                                        recentProjects.value.map(project => (
                                            <button
                                                key={project}
                                                class="burger-menu-item"
                                                onClick={() => switchProject(project)}
                                            >
                                                <span>{project}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div class="burger-separator" />

                        <button class="burger-menu-item" onClick={() => handleAction('quit')}>
                            <span>{t('titleBar.menu.quit')}</span>
                        </button>

                        <div class="burger-separator" />

                        {/* Help Section */}
                        <div class="burger-section-label">{t('titleBar.menu.help')}</div>
                        <button class="burger-menu-item" onClick={() => handleAction('user_guide')}>
                            <span>{t('titleBar.menu.userGuide')}</span>
                        </button>
                        <button class="burger-menu-item" onClick={() => handleAction('about')}>
                            <span>{t('titleBar.menu.about')}</span>
                        </button>
                    </div>
                </>
            )}

            <div class="titlebar-controls">
                <button
                    class="titlebar-btn"
                    onClick={() => appWindow.minimize()}
                    title={t('titleBar.controls.minimize')}
                >
                    <Minus size={14} />
                </button>
                <button
                    class="titlebar-btn"
                    onClick={() => appWindow.toggleMaximize()}
                    title={isMaximized.value ? t('titleBar.controls.restore') : t('titleBar.controls.maximize')}
                >
                    {isMaximized.value ? <Copy size={12} /> : <Square size={12} />}
                </button>
                <button
                    class="titlebar-btn titlebar-btn-close"
                    onClick={() => appWindow.close()}
                    title={t('titleBar.controls.close')}
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
