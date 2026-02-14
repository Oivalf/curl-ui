import { Modal } from './Modal';
import { isAboutOpen, updateInfo } from '../store';
import { getVersion, getTauriVersion } from '@tauri-apps/api/app';
import { useSignal, useSignalEffect } from '@preact/signals';
import { openUrl } from '@tauri-apps/plugin-opener';

export function AboutModal() {
    const appVersion = useSignal('Loading...');
    const tauriVersion = useSignal('Loading...');

    useSignalEffect(() => {
        if (isAboutOpen.value) {
            getVersion().then(v => appVersion.value = v).catch(() => appVersion.value = 'Unknown');
            getTauriVersion().then(v => tauriVersion.value = v).catch(() => tauriVersion.value = 'Unknown');
        }
    });

    return (
        <Modal
            isOpen={isAboutOpen.value}
            onClose={() => isAboutOpen.value = false}
            title="About cURL-UI"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '16px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                    cURL-UI
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                    A modern HTTP client built with Tauri.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '8px 16px', marginTop: '16px', fontSize: '0.9rem' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>App Version:</div>
                    <div>{appVersion}</div>

                    <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>Tauri Version:</div>
                    <div>{tauriVersion}</div>

                    <div style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>License:</div>
                    <div>MIT</div>
                </div>

                {updateInfo.value?.is_available && (
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid var(--accent-primary)'
                    }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                            New version available: {updateInfo.value.latest_version}
                        </div>
                        <button
                            onClick={() => openUrl(updateInfo.value!.release_url)}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: 'var(--accent-primary)',
                                color: 'var(--bg-base)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            View on GitHub
                        </button>
                    </div>
                )}

                <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    © 2025 Oivalf
                </div>
            </div>
        </Modal>
    );
}
