import { ComponentChildren } from 'preact';
import { Sidebar } from './Sidebar';
import { confirmationState, environments, activeEnvironmentName, isAboutOpen, isEnvManagerOpen, isConsoleOpen, saveActiveItemCollection, saveAllCollections, openProject } from '../store';
import { useSignalEffect, useSignal } from '@preact/signals';
import { Modal } from './Modal';
import { EnvironmentManager } from './EnvironmentManager';
import { ConsolePanel } from './ConsolePanel';
import { AboutModal } from './AboutModal';
import { Settings, Terminal } from 'lucide-preact';
import { useEffect } from 'preact/hooks';
import { listen } from '@tauri-apps/api/event';

interface LayoutProps {
    children: ComponentChildren;
}

import { openUserGuideWindow } from '../utils/window';



export function MainLayout({ children }: LayoutProps) {
    // isEnvManagerOpen is imported from store
    const sidebarWidth = useSignal(250);
    const isResizingSidebar = useSignal(false);

    const startResizingSidebar = () => {
        isResizingSidebar.value = true;
    };

    const stopResizingSidebar = () => {
        isResizingSidebar.value = false;
    };

    const resizeSidebar = (e: MouseEvent) => {
        if (isResizingSidebar.value) {
            let newWidth = e.clientX;
            // Clamping
            if (newWidth < 150) newWidth = 150;
            if (newWidth > 600) newWidth = 600;
            sidebarWidth.value = newWidth;
        }
    };

    useEffect(() => {
        window.addEventListener('mousemove', resizeSidebar);
        window.addEventListener('mouseup', stopResizingSidebar);

        const unlisten = listen('open-about', () => {
            isAboutOpen.value = true;
        });

        const unlistenUserGuide = listen('open-user-guide', () => {
            openUserGuideWindow();
        });

        const unlistenSave = listen('trigger-save', async () => {
            await saveActiveItemCollection();
        });
        const unlistenSaveAll = listen('trigger-save-all', async () => {
            await saveAllCollections();
        });

        const unlistenSwitchProject = listen<string>('switch-project', async (event) => {
            await openProject(event.payload);
        });

        // Global Keydown Listener
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                await saveActiveItemCollection();
            } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                await saveAllCollections();
            }
        };

        // Check for active environment validity
        // ... useSignalEffect handled separately if using hooks, but here useSignalEffect is fine inside component if correctly imported

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('mousemove', resizeSidebar);
            window.removeEventListener('mouseup', stopResizingSidebar);
            unlisten.then(f => f());
            unlistenUserGuide.then(f => f());
            unlistenSave.then(f => f());
            unlistenSaveAll.then(f => f());
            unlistenSwitchProject.then(f => f());
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Helper for reactive env check - keeping original logic
    useSignalEffect(() => {
        const selectable = environments.value.filter(e => e.name !== 'Global');
        if (activeEnvironmentName.value && !selectable.some(e => e.name === activeEnvironmentName.value)) {
            activeEnvironmentName.value = null;
        }
    });

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-base)' }}>
            <Sidebar width={sidebarWidth.value} />

            {/* Resize Handle */}
            <div
                onMouseDown={startResizingSidebar}
                style={{
                    width: '4px',
                    cursor: 'col-resize',
                    backgroundColor: isResizingSidebar.value ? 'var(--accent-primary)' : 'transparent',
                    borderLeft: '1px solid var(--border-color)',
                    transition: 'background-color 0.2s',
                    zIndex: 10
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
                onMouseLeave={(e) => {
                    if (!isResizingSidebar.value) e.currentTarget.style.backgroundColor = 'transparent'
                }}
            />

            <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    height: '40px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-sidebar)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    padding: '0 16px'
                }}>
                    {/* Environment Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Env:</div>
                        <select
                            value={activeEnvironmentName.value || ''}
                            onChange={(e) => activeEnvironmentName.value = e.currentTarget.value}
                            style={{
                                backgroundColor: 'transparent',
                                border: 'none',
                                color: 'var(--accent-primary)',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                outline: 'none',
                                fontSize: '0.8rem'
                            }}
                        >
                            <option value="">No Environment</option>
                            {environments.value
                                .filter(env => env.name !== 'Global')
                                .map(env => (
                                    <option key={env.name} value={env.name}>{env.name}</option>
                                ))}
                        </select>
                        <button
                            onClick={() => isEnvManagerOpen.value = true}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            title="Manage Environments"
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {children}
                </div>

                <ConsolePanel />

                <div style={{
                    height: '32px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-sidebar)',
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    padding: '0 16px'
                }}>
                    {/* Console Toggle */}
                    <button
                        onClick={() => isConsoleOpen.value = !isConsoleOpen.value}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: isConsoleOpen.value ? 'var(--accent-primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem'
                        }}
                    >
                        <Terminal size={14} /> Console
                    </button>
                </div>
            </main>

            <EnvironmentManager
                isOpen={isEnvManagerOpen.value}
                onClose={() => isEnvManagerOpen.value = false}
            />
            <AboutModal />

            {/* Global Confirmation Modal - Rendered last with higher z-index to overlay other modals */}
            <Modal
                isOpen={confirmationState.value.isOpen}
                onClose={() => confirmationState.value = { ...confirmationState.value, isOpen: false }}
                title={confirmationState.value.title}
                zIndex={1300}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <p style={{ margin: 0, color: 'var(--text-primary)' }}>{confirmationState.value.message}</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => confirmationState.value = { ...confirmationState.value, isOpen: false }}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent',
                                color: 'var(--text-primary)',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                confirmationState.value.onConfirm();
                                confirmationState.value = { ...confirmationState.value, isOpen: false };
                            }}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                backgroundColor: 'var(--error)',
                                color: 'var(--bg-base)',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
