import { useState, useEffect } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { UploadCloud, RefreshCw } from 'lucide-preact';
import { collections } from '../store';

interface FileStatus {
    path: string;
    status: string;
}

interface CollectionGitState {
    id: string;
    name: string;
    path: string;
    repoRoot: string | null;
    status: string | null;
    commitMsg: string;
    loading: boolean;
    result: string | null;
}

export function GitPanel() {
    const [collectionStates, setCollectionStates] = useState<CollectionGitState[]>([]);
    const [globalLoading, setGlobalLoading] = useState(false);

    const loadStatus = async () => {
        setGlobalLoading(true);
        try {
            const newStates: CollectionGitState[] = [];

            for (const col of collections.value) {
                if (!col.path) continue;

                try {
                    const root = await invoke<string>('get_git_root', { path: col.path });
                    const statusRes = await invoke<FileStatus[]>('git_status', { path: root });

                    const relativePath = Array.from(statusRes).find(s => {
                        return col.path!.replace(/\\/g, '/').endsWith(s.path);
                    });

                    if (relativePath) {
                        newStates.push({
                            id: col.id,
                            name: col.name,
                            path: col.path,
                            repoRoot: root,
                            status: relativePath.status,
                            commitMsg: "",
                            loading: false,
                            result: null
                        });
                    }

                } catch (e) {
                    // Not a git repo or error
                }
            }
            setCollectionStates(newStates);

        } catch (err) {
            console.error(err);
        } finally {
            setGlobalLoading(false);
        }
    };

    const [globalCommitMsg, setGlobalCommitMsg] = useState("");

    const handleGlobalCommitAndPush = async () => {
        if (!globalCommitMsg) return;
        setGlobalLoading(true);

        try {
            // Group actions by Repo Root
            const repoActions = new Map<string, string[]>(); // root -> paths

            collectionStates.forEach(state => {
                if (state.repoRoot) {
                    if (!repoActions.has(state.repoRoot)) {
                        repoActions.set(state.repoRoot, []);
                    }
                    repoActions.get(state.repoRoot)!.push(state.path);
                }
            });

            for (const [root, paths] of repoActions.entries()) {
                // 1. Stage all files
                for (const path of paths) {
                    await invoke('git_add_file', { path });
                }
                // 2. Commit
                await invoke('git_commit', { args: { path: root, message: globalCommitMsg } });
                // 3. Push
                await invoke('git_push', { path: root });
            }

            setGlobalCommitMsg("");
            alert("Global Commit & Push Successful!");

            // Reload
            loadStatus();
        } catch (err) {
            console.error(err);
            const msg = typeof err === 'string' ? err : (err as any).message || JSON.stringify(err);
            alert("Global Commit/Push Failed: " + msg);
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleCommitAndPush = async (index: number) => {
        const state = collectionStates[index];
        if (!state.commitMsg || !state.repoRoot) return;

        const updateState = (update: Partial<CollectionGitState>) => {
            const newStates = [...collectionStates];
            newStates[index] = { ...newStates[index], ...update };
            setCollectionStates(newStates);
        };

        updateState({ loading: true, result: null });

        try {
            await invoke('git_add_file', { path: state.path });
            await invoke('git_commit', { args: { path: state.repoRoot, message: state.commitMsg } });
            await invoke('git_push', { path: state.repoRoot });

            updateState({ result: "Success!", commitMsg: "" });

            setTimeout(() => {
                loadStatus();
            }, 1000);

        } catch (err) {
            console.error(err);
            const msg = typeof err === 'string' ? err : (err as any).message || JSON.stringify(err);
            updateState({ result: "Error: " + msg });
            alert("Commit/Push Failed: " + msg);
        } finally {
            updateState({ loading: false });
        }
    };

    useEffect(() => {
        loadStatus();
    }, [collections.value]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Git Changes</span>
                <button onClick={loadStatus} disabled={globalLoading} style={{ background: 'none', color: 'var(--accent-primary)', cursor: 'pointer', border: 'none' }}>
                    <RefreshCw size={16} class={globalLoading ? "spin" : ""} />
                </button>
            </div>

            {collectionStates.length > 1 && (
                <div style={{ padding: '8px', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(var(--accent-primary-rgb), 0.1)', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--accent-primary)' }}>Global Commit & Push ({collectionStates.length} modified)</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            placeholder="Global commit message..."
                            value={globalCommitMsg}
                            onInput={(e) => setGlobalCommitMsg(e.currentTarget.value)}
                            style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                        />
                        <button
                            onClick={handleGlobalCommitAndPush}
                            disabled={globalLoading || !globalCommitMsg}
                            title="Commit & Push All"
                            style={{
                                backgroundColor: 'var(--accent-primary)',
                                color: 'var(--bg-base)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: (!globalCommitMsg || globalLoading) ? 0.6 : 1
                            }}
                        >
                            <UploadCloud size={16} /> All
                        </button>
                    </div>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {collectionStates.length === 0 && !globalLoading && (
                    <div style={{ padding: '8px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem' }}>
                        No modified collections found.
                    </div>
                )}

                {collectionStates.map((state, idx) => (
                    <div key={state.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{state.name}</span>
                            <span style={{ fontSize: '0.75rem', color: state.status === 'Modified' ? 'var(--warning)' : 'var(--success)' }}>{state.status}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', wordBreak: 'break-all' }}>
                            {state.repoRoot}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                placeholder="Commit message..."
                                value={state.commitMsg}
                                onInput={(e) => {
                                    const newStates = [...collectionStates];
                                    newStates[idx].commitMsg = e.currentTarget.value;
                                    setCollectionStates(newStates);
                                }}
                                style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                            <button
                                onClick={() => handleCommitAndPush(idx)}
                                disabled={state.loading || !state.commitMsg}
                                title="Commit & Push"
                                style={{
                                    backgroundColor: 'var(--accent-primary)',
                                    color: 'var(--bg-base)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '0 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: (!state.commitMsg || state.loading) ? 0.6 : 1
                                }}
                            >
                                <UploadCloud size={16} />
                            </button>
                        </div>
                        {state.result && <div style={{ fontSize: '0.75rem', color: state.result.startsWith('Error') ? 'var(--error)' : 'var(--success)', marginTop: '4px' }}>{state.result}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
}
