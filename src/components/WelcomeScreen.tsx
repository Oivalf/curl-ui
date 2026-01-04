import { Plus, Layout, BookOpen, FolderOpen } from 'lucide-preact';
import { activeProjectName, knownProjects, openProject } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'preact/hooks';
import { getVersion, getTauriVersion } from '@tauri-apps/api/app';
import { openUserGuideWindow } from '../utils/window';

// Cast icons to any to avoid Preact/React type conflicts
const PlusIcon = Plus as any;
const LayoutIcon = Layout as any;
const BookIcon = BookOpen as any;
const FolderIcon = FolderOpen as any;

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
            textAlign: 'center',
            overflowY: 'auto'
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
                maxWidth: '600px',
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
                    <LayoutIcon size={40} color="#000" />
                </div>

                <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 'bold' }}>Welcome to cURL-UI</h1>

                {knownProjects.value.length > 0 ? (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FolderIcon size={18} /> Recent Projects
                        </h3>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            padding: '4px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(0,0,0,0.1)'
                        }}>
                            {knownProjects.value.map(project => (
                                <div
                                    key={project}
                                    onClick={() => openProject(project)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        backgroundColor: 'var(--bg-sidebar)',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-sidebar)'}
                                >
                                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{project}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.6' }}>
                        It looks like you don't have any projects yet.<br />
                        Start by creating your first project to organize your collections.
                    </p>
                )}

                <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
                    <button
                        onClick={openNewProjectWindow}
                        style={{
                            flex: 1,
                            backgroundColor: 'var(--accent-primary)',
                            color: '#000',
                            border: 'none',
                            padding: '1rem',
                            borderRadius: '12px',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 5px 15px var(--accent-primary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <PlusIcon size={24} />
                        New Project
                    </button>

                    <button
                        onClick={() => openUserGuideWindow()}
                        style={{
                            flex: 1,
                            backgroundColor: 'transparent',
                            color: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)',
                            padding: '0.75rem',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                    >
                        <BookIcon size={20} />
                        User Guide
                    </button>
                </div>

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
