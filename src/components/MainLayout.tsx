import { ComponentChildren } from 'preact';
import { Sidebar } from './Sidebar';
import { confirmationState, environments, activeEnvironmentName, isAboutOpen } from '../store';
import { Modal } from './Modal';
import { EnvironmentManager } from './EnvironmentManager';
import { AboutModal } from './AboutModal';
import { Settings } from 'lucide-preact';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { listen } from '@tauri-apps/api/event';

interface LayoutProps {
    children: ComponentChildren;
}

export function MainLayout({ children }: LayoutProps) {
    const isEnvManagerOpen = useSignal(false);

    useEffect(() => {
        const unlisten = listen('open-about', () => {
            isAboutOpen.value = true;
        });
        return () => {
            unlisten.then(f => f());
        };
    }, []);

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-base)' }}>
            <Sidebar />
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
                                outline: 'none'
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
                            <Settings size={16} />
                        </button>
                    </div>
                </div>

                {children}
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
