import { useState, useEffect } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { GitCommit, RefreshCw } from 'lucide-preact';

interface FileStatus {
    path: string;
    status: string;
}

export function GitPanel() {
    const [statuses, setStatuses] = useState<FileStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [commitMsg, setCommitMsg] = useState("");
    const [result, setResult] = useState<string | null>(null);

    // Hardcoded path for now, should be configurable
    const repoPath = "/mnt/d/progetti/tauri/curl-ui";

    const loadStatus = async () => {
        setLoading(true);
        try {
            const res = await invoke<FileStatus[]>('git_status', { path: repoPath });
            setStatuses(res);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        if (!commitMsg) return;
        setLoading(true);
        try {
            await invoke('git_add_all', { path: repoPath });
            const res = await invoke('git_commit', { args: { path: repoPath, message: commitMsg } });
            setResult(res as string);
            setCommitMsg("");
            loadStatus();
            setTimeout(() => setResult(null), 3000);
        } catch (err) {
            console.error(err);
            setResult("Error: " + err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>{statuses.length} changes</span>
                <button onClick={loadStatus} disabled={loading} style={{ background: 'none', color: 'var(--accent-primary)' }}>
                    <RefreshCw size={16} class={loading ? "spin" : ""} />
                </button>
            </div>

            <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-input)'
            }}>
                {statuses.map(s => (
                    <div key={s.path} style={{
                        padding: '4px 8px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.9rem'
                    }}>
                        <span style={{
                            color: s.status === 'Modified' ? 'var(--warning)' : 'var(--success)'
                        }}>{s.status.charAt(0)}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{s.path}</span>
                    </div>
                ))}
                {statuses.length === 0 && !loading && (
                    <div style={{ padding: '8px', color: 'var(--text-muted)', textAlign: 'center' }}>No changes</div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    placeholder="Commit message..."
                    value={commitMsg}
                    onInput={(e) => setCommitMsg(e.currentTarget.value)}
                    style={{ flex: 1 }}
                />
                <button
                    onClick={handleCommit}
                    disabled={loading || !commitMsg}
                    style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--bg-base)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 12px',
                        opacity: (!commitMsg || loading) ? 0.6 : 1
                    }}
                >
                    <GitCommit size={16} />
                </button>
            </div>
            {result && <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>{result}</div>}
        </div>
    );
}
