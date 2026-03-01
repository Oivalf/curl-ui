import { useState, useEffect } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { UploadCloud, RefreshCw, Download } from 'lucide-preact';
import { collections } from '../store';
import { MergeEditor } from './MergeEditor';

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
    hasConflict: boolean;
    gitPath: string | null;
}

interface MergeData {
    id: string;
    local: string;
    remote: string;
    filename: string;
}

export function GitPanel() {
    const [collectionStates, setCollectionStates] = useState<CollectionGitState[]>([]);
    const [globalLoading, setGlobalLoading] = useState(false);
    const [mergeData, setMergeData] = useState<MergeData | null>(null);

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
                            result: null,
                            hasConflict: relativePath.status === 'Conflict' || relativePath.status === 'Unmerged',
                            gitPath: relativePath.path
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

    const handleCommitAndPush = async (id: string) => {
        const state = collectionStates.find(s => s.id === id);
        if (!state || !state.commitMsg || !state.repoRoot) return;

        const updateState = (update: Partial<CollectionGitState>) => {
            setCollectionStates(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
        };

        updateState({ loading: true, result: null });

        try {
            await invoke('git_add_file', { path: state.path });
            await invoke('git_commit', { args: { path: state.repoRoot, message: state.commitMsg } });
            await invoke('git_push', { path: state.repoRoot });

            updateState({ result: "Success!", commitMsg: "" });
            setTimeout(() => loadStatus(), 1000);
        } catch (err) {
            console.error(err);
            const msg = typeof err === 'string' ? err : (err as any).message || JSON.stringify(err);
            updateState({ result: "Error: " + msg });

            if (msg.includes("fetch first") || msg.includes("rejected")) {
                if (confirm("Push was rejected because the remote contains changes you don't have. Would you like to Pull and Merge now?")) {
                    handlePull(id);
                }
            } else {
                alert("Commit/Push Failed: " + msg);
            }
        } finally {
            updateState({ loading: false });
        }
    };

    const handlePull = async (id: string) => {
        const state = collectionStates.find(s => s.id === id);
        if (!state || !state.repoRoot) return;

        const updateState = (update: Partial<CollectionGitState>) => {
            setCollectionStates(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
        };

        updateState({ loading: true, result: null });

        try {
            const pullResult = await invoke<string>('git_pull', { path: state.repoRoot });

            if (pullResult === "Conflict") {
                updateState({ result: "Conflict detected!", hasConflict: true });
                await loadStatus();
                // We trigger merge start after a short delay to ensure state has propagated
                setTimeout(() => handleStartMerge(id), 200);
            } else {
                updateState({ result: pullResult });
                loadStatus();
            }
        } catch (err) {
            console.error(err);
            updateState({ result: "Pull failed" });
        } finally {
            updateState({ loading: false }); // ensure loading labels are cleared
        }
    };

    const handleStartMerge = async (id: string) => {
        // Find latest state by ID from current collectionStates
        // NOTE: we use the latest state directly from the list as it might have been updated by loadStatus
        setCollectionStates(current => {
            const state = current.find(s => s.id === id);
            if (!state?.repoRoot || !state?.gitPath) {
                console.warn("State not ready for merge", id);
                return current;
            }

            invoke<{ local: string, remote: string, base: string }>('get_conflicted_versions', {
                repoPath: state.repoRoot,
                filePath: state.gitPath
            }).then(versions => {
                if (versions.local && versions.remote) {
                    setMergeData({
                        id, // Use ID here too
                        local: versions.local,
                        remote: versions.remote,
                        filename: state.name
                    });
                } else {
                    console.error("Conflict data missing in index", versions);
                    alert(`Could not retrieve conflicted versions for ${state.gitPath}.\n\nThis happens if the file has merge markers but Git doesn't report it as 'Unmerged' in the index.\nPlease resolve manually or check the file.`);
                }
            }).catch(err => {
                console.error(err);
                alert("Error loading merge data: " + err);
            });

            return current;
        });
    };

    const handleResolve = async (mergedContent: string) => {
        if (!mergeData) return;
        const state = collectionStates.find(s => s.id === mergeData.id);
        if (!state || !state.gitPath) return;

        try {
            await invoke('save_workspace', { path: state.path, data: mergedContent });
            await invoke('git_resolve_conflict', {
                repoPath: state.repoRoot,
                filePath: state.gitPath
            });

            setMergeData(null);
            loadStatus();
        } catch (err) {
            console.error(err);
            alert("Error resolving conflict: " + err);
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

                {collectionStates.map((state) => (
                    <div key={state.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{state.name}</span>
                            <span style={{ fontSize: '0.75rem', color: state.status === 'Conflict' || state.hasConflict ? 'var(--error)' : state.status === 'Modified' ? 'var(--warning)' : 'var(--success)' }}>{state.status}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', wordBreak: 'break-all' }}>
                            {state.repoRoot}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            {!state.hasConflict && (
                                <input
                                    placeholder="Commit message..."
                                    value={state.commitMsg}
                                    onInput={(e) => {
                                        setCollectionStates(prev => prev.map(s => s.id === state.id ? { ...s, commitMsg: e.currentTarget.value } : s));
                                    }}
                                    style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                />
                            )}

                            <button
                                onClick={() => handlePull(state.id)}
                                disabled={state.loading}
                                title="Pull from Remote"
                                style={{
                                    backgroundColor: 'transparent',
                                    color: 'var(--accent-primary)',
                                    border: '1px solid var(--accent-primary)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '0 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: state.loading ? 0.6 : 1
                                }}
                            >
                                <Download size={16} />
                            </button>

                            {state.hasConflict ? (
                                <button
                                    onClick={() => handleStartMerge(state.id)}
                                    style={{
                                        backgroundColor: 'var(--error)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '0 12px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        flex: 1
                                    }}
                                >
                                    RESOLVE CONFLICT
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleCommitAndPush(state.id)}
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
                            )}
                        </div>
                        {state.result && <div style={{ fontSize: '0.75rem', color: state.result.startsWith('Error') || state.result.includes('Conflict') ? 'var(--error)' : 'var(--success)', marginTop: '4px' }}>{state.result}</div>}
                    </div>
                ))}
            </div>

            {mergeData && (
                <MergeEditor
                    local={mergeData.local}
                    remote={mergeData.remote}
                    filename={mergeData.filename}
                    onCancel={() => setMergeData(null)}
                    onResolve={handleResolve}
                />
            )}
        </div>
    );
}
