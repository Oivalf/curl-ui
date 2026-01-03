import { ComponentChildren } from 'preact';
import { Sidebar } from './Sidebar';
import { confirmationState, environments, activeEnvironmentName, isAboutOpen, isEnvManagerOpen, isConsoleOpen, saveActiveItemCollection, saveAllCollections } from '../store';
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

export function MainLayout({ children }: LayoutProps) {
    // isEnvManagerOpen is imported from store

    useEffect(() => {
        const unlisten = listen('open-about', () => {
            isAboutOpen.value = true;
        });

        const unlistenSave = listen('trigger-save', async () => {
            await saveActiveItemCollection();
        });
        const unlistenSaveAll = listen('trigger-save-all', async () => {
            await saveAllCollections();
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

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            unlisten.then(f => f());
            unlistenSave.then(f => f());
            unlistenSaveAll.then(f => f());
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-base)' }}>
            <Sidebar />
            <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    {children}
                </div>

                <ConsolePanel />

                <div style={{
                    height: '32px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-sidebar)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0 16px'
                }}>
                    {/* Left: Console Toggle */}
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

                    {/* Right: Environment Selector */}
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
                            <option value="" disabled>No Environment</option>
                            {environments.value.map(env => (
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
            </main>

            {/* Global Confirmation Modal */}
            <Modal
                isOpen={confirmationState.value.isOpen}
                onClose={() => confirmationState.value = { ...confirmationState.value, isOpen: false }}
                title={confirmationState.value.title}
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

            <EnvironmentManager
                isOpen={isEnvManagerOpen.value}
                onClose={() => isEnvManagerOpen.value = false}
            />
            <AboutModal />
        </div>
    );
}
