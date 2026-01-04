import { Plus, Layout, BookOpen } from 'lucide-preact';
import { activeProjectName } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'preact/hooks';
import { getVersion, getTauriVersion } from '@tauri-apps/api/app';
import { openUserGuideWindow } from '../utils/window';

export function WelcomeScreen() {
    const [appVersion, setAppVersion] = useState('Loading...');
    const [tauriVersion, setTauriVersion] = useState('Loading...');

    useEffect(() => {
        getVersion().then(setAppVersion).catch(() => setAppVersion('Unknown'));
        getTauriVersion().then(setTauriVersion).catch(() => setTauriVersion('Unknown'));
    }, []);

    const openNewProjectWindow = async () => {
        const projectName = prompt("Enter Project Name:", "New Project");
        if (!projectName) return;

        // Transitions current window to the new project
        activeProjectName.value = projectName;

        // Enable the native menu bar for this window
        try {
            await invoke('enable_window_menu');
        } catch (err) {
            console.error('Failed to enable menu:', err);
        }
    };

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-base)',
            color: 'var(--text-primary)',
            padding: '2rem',
            textAlign: 'center'
        }}>
            <div style={{
                backgroundColor: 'rgba(0, 255, 255, 0.05)',
                padding: '3rem',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '20px',
                    backgroundColor: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    boxShadow: '0 0 30px var(--accent-primary)'
                }}>
                    <Layout size={40} color="#000" />
                </div>

                <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold' }}>Welcome to Curl UI</h1>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.6' }}>
                    It looks like you don't have any projects yet.<br />
                    Start by creating your first project to organize your collections.
                </p>

                <button
                    onClick={openNewProjectWindow}
                    style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: '#000',
                        border: 'none',
                        padding: '1rem 2rem',
                        borderRadius: '12px',
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '1rem',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 0 20px var(--accent-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <Plus size={24} />
                    Create New Project
                </button>

                <button
                    onClick={() => openUserGuideWindow()}
                    style={{
                        backgroundColor: 'transparent',
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--accent-primary)',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '0.5rem',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <BookOpen size={20} />
                    View User Guide
                </button>

                {/* About Section */}
                <div style={{
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid var(--border-color)',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
                        <span>App v{appVersion}</span>
                        <span>Tauri v{tauriVersion}</span>
                    </div>
                    <div style={{ opacity: 0.7 }}>
                        © 2025 Oivalf • MIT License
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                All your project data is stored locally in <code style={{ color: 'var(--accent-primary)' }}>~/.curl-ui</code>
            </div>
        </div>
    );
}
