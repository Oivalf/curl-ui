import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { activeFolderId, folders, environments, activeEnvironmentName, type Folder, unsavedItemIds, AuthConfig, navigateToItem, resolveHeaders } from "../store";
import { Folder as FolderIcon } from "lucide-preact";
import { AuthEditor } from "./AuthEditor";

export function FolderEditor() {
    const currentFolder = folders.value.find(f => f.id === activeFolderId.value);

    if (!currentFolder) return null;

    // Local signals
    const name = useSignal(currentFolder.name);
    const headers = useSignal<{ key: string, values: string[] }[]>(
        (currentFolder.headers || []).map(h => ({ key: h.key, values: [...(h.values || [])] }))
    );
    const variables = useSignal<{ key: string, value: string }[]>(
        Object.entries(currentFolder.variables || {}).map(([k, v]) => ({ key: k, value: v }))
    );
    const auth = useSignal<AuthConfig>(currentFolder.auth || { type: 'inherit' });

    // Compute inherited variables
    const inheritedVariables = useSignal<{ key: string, value: string, source: string, sourceId?: string }[]>([]);

    // Compute inherited Headers
    const inheritedHeaders = useComputed(() => {
        let parentId = currentFolder?.parentId;
        if (!parentId) return [];
        return resolveHeaders(parentId);
    });

    // Compute inherited Auth
    const inheritedAuth = useComputed(() => {
        let parentId = currentFolder?.parentId;
        while (parentId) {
            const parent = folders.value.find(f => f.id === parentId);
            if (!parent) break;
            if (parent.auth && parent.auth.type !== 'inherit') {
                return { config: parent.auth, source: `Folder: ${parent.name}`, sourceId: parent.id };
            }
            parentId = parent.parentId;
        }
        return undefined;
    });

    useSignalEffect(() => {
        const folderId = activeFolderId.value;
        const currentEnv = environments.value.find(e => e.name === activeEnvironmentName.value);
        const map = new Map<string, { value: string, source: string, sourceId?: string }>();

        // 0. Global Environment Fallback (Lowest Priority)
        const globalEnv = environments.value.find(e => e.name === 'Global');
        if (globalEnv) {
            globalEnv.variables.forEach(v => map.set(v.key, { value: v.value, source: 'Global', sourceId: 'env:Global' }));
        }

        // 1. Environment
        if (currentEnv) {
            currentEnv.variables.forEach(v => map.set(v.key, { value: v.value, source: `Env: ${currentEnv.name}`, sourceId: `env:${currentEnv.name}` }));
        }

        // 2. Parent Folders (Root -> Parent)
        if (folderId) {
            const allFolders = folders.value;
            const hierarchy: Folder[] = [];
            let curr = allFolders.find(f => f.id === folderId);

            // Go up to parents
            let parentId = curr?.parentId;
            while (parentId) {
                const parent = allFolders.find(f => f.id === parentId);
                if (parent) {
                    hierarchy.unshift(parent); // Add to start to maintain Root -> Parent order
                    parentId = parent.parentId;
                } else break;
            }

            // Apply in order
            hierarchy.forEach(f => {
                if (f.variables) {
                    Object.entries(f.variables).forEach(([k, v]) => {
                        if (typeof v === 'string') {
                            map.set(k, { value: v, source: `Folder: ${f.name}`, sourceId: f.id });
                        }
                    });
                }
            });
        }

        inheritedVariables.value = Array.from(map.entries())
            .map(([k, v]) => ({ key: k, value: v.value, source: v.source, sourceId: v.sourceId }))
            .sort((a, b) => a.key.localeCompare(b.key));
    });

    // ... (Sync back to store)
    useSignalEffect(() => {
        const currentName = name.value;
        const currentHeaders = headers.value;
        const currentVars = variables.value;
        const currentAuth = auth.value;
        const folderId = activeFolderId.value;

        if (!folderId) return;

        const allFolders = folders.peek();
        const idx = allFolders.findIndex(f => f.id === folderId);

        if (idx !== -1) {
            const folder = allFolders[idx];

            const headersChanged = JSON.stringify(folder.headers || []) !== JSON.stringify(currentHeaders);

            const varsObj: Record<string, string> = {};
            currentVars.forEach(v => { if (v.key) varsObj[v.key] = v.value; });

            const varsChanged = JSON.stringify(folder.variables || {}) !== JSON.stringify(varsObj);
            const authChanged = JSON.stringify(folder.auth) !== JSON.stringify(currentAuth);

            if (folder.name !== currentName || headersChanged || varsChanged || authChanged) {
                const newFolders = [...allFolders];
                newFolders[idx] = {
                    ...folder,
                    name: currentName,
                    headers: currentHeaders,
                    variables: varsObj,
                    auth: currentAuth
                };
                folders.value = newFolders;

                // Mark as dirty
                const newUnsaved = new Set(unsavedItemIds.peek());
                newUnsaved.add(folderId);
                unsavedItemIds.value = newUnsaved;
            }
        }
    });

    const addHeader = () => {
        headers.value = [...headers.value, { key: '', values: [''] }];
    };

    const removeHeader = (index: number) => {
        headers.value = headers.value.filter((_, i) => i !== index);
    };

    const updateHeaderKey = (index: number, val: string) => {
        const newHeaders = [...headers.value];
        newHeaders[index].key = val;
        headers.value = newHeaders;
    };

    const updateHeaderValue = (index: number, valIndex: number, val: string) => {
        const newHeaders = [...headers.value];
        const newValues = [...newHeaders[index].values];
        newValues[valIndex] = val;
        newHeaders[index].values = newValues;
        headers.value = newHeaders;
    };

    const addVariable = () => {
        variables.value = [...variables.value, { key: '', value: '' }];
    };

    const removeVariable = (index: number) => {
        variables.value = variables.value.filter((_, i) => i !== index);
    };

    const updateVariable = (index: number, field: 'key' | 'value', val: string) => {
        const newVars = [...variables.value];
        newVars[index] = { ...newVars[index], [field]: val };
        variables.value = newVars;
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%', overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--border-color)' }}>
                <FolderIcon size={32} color="var(--accent-primary)" />
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Folder Name</label>
                    <input
                        value={name.value}
                        onInput={(e) => name.value = e.currentTarget.value}
                        style={{ fontSize: '1.5rem', fontWeight: 'bold', width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Shared Headers Section (unchanged) */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Shared Headers</h3>
                    <button onClick={addHeader} style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>+ Add Header</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {headers.value.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No headers defined.</div>}
                    {headers.value.map((header, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ width: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <input
                                    placeholder="Key"
                                    value={header.key}
                                    onInput={(e) => updateHeaderKey(index, e.currentTarget.value)}
                                    style={{ width: '100%', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {header.values.length === 0 && (
                                    <button onClick={() => {
                                        const newHeaders = [...headers.value];
                                        newHeaders[index].values = [''];
                                        headers.value = newHeaders;
                                    }} style={{ alignSelf: 'flex-start', fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}>+ Add Value</button>
                                )}
                                {header.values.map((val, valIdx) => (
                                    <div key={valIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <input
                                            placeholder="Value"
                                            value={val}
                                            onInput={(e) => updateHeaderValue(index, valIdx, e.currentTarget.value)}
                                            style={{ flex: 1, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-sm)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                        <button onClick={() => {
                                            const newHeaders = [...headers.value];
                                            newHeaders[index].values = newHeaders[index].values.filter((_, vIdx) => vIdx !== valIdx);
                                            headers.value = newHeaders;
                                        }} style={{ color: 'var(--text-muted)', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}>-</button>
                                    </div>
                                ))}
                                <button onClick={() => {
                                    const newHeaders = [...headers.value];
                                    newHeaders[index].values = [...newHeaders[index].values, ''];
                                    headers.value = newHeaders;
                                }} style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>+</button>
                            </div>
                            <button
                                onClick={() => removeHeader(index)}
                                style={{ color: 'var(--error)', alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Inherited Headers */}
            {inheritedHeaders.value.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inherited Headers</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Key</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Value</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Source</div>

                        {inheritedHeaders.value.map((h, i) => (
                            <div key={i} style={{ display: 'contents' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{h.key}</div>
                                <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={h.values.join(', ')}>{h.values.join(', ')}</div>
                                <div
                                    style={{
                                        color: h.sourceId ? 'var(--accent-primary)' : 'var(--text-muted)',
                                        fontStyle: 'italic',
                                        cursor: h.sourceId ? 'pointer' : 'default',
                                        textDecoration: h.sourceId ? 'underline' : 'none'
                                    }}
                                    onClick={() => h.sourceId && navigateToItem(h.sourceId)}
                                >
                                    {h.source}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Variables Section */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Variables</h3>
                    <button onClick={addVariable} style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>+ Add Variable</button>
                </div>
                <p style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Variables defined here can be used in requests within this folder using <code>{'{{variable_name}}'}</code> syntax.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {variables.value.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No variables defined.</div>}
                    {variables.value.map((variable, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px' }}>
                            <input
                                placeholder="Variable Name"
                                value={variable.key}
                                onInput={(e) => updateVariable(index, 'key', e.currentTarget.value)}
                                style={{ flex: 1, minWidth: 0 }}
                            />
                            <input
                                placeholder="Value"
                                value={variable.value}
                                onInput={(e) => updateVariable(index, 'value', e.currentTarget.value)}
                                style={{ flex: 1, minWidth: 0 }}
                            />
                            <button
                                onClick={() => removeVariable(index)}
                                style={{ padding: '4px 8px', color: 'var(--text-muted)', cursor: 'pointer', background: 'transparent', border: 'none' }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                {/* Inherited Variables */}
                {inheritedVariables.value.length > 0 && (
                    <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inherited Variables</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Key</div>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Value</div>
                            <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Source</div>

                            {inheritedVariables.value.map(v => (
                                <>
                                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{v.key}</div>
                                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={v.value}>{v.value}</div>
                                    <div
                                        style={{
                                            color: v.sourceId ? 'var(--accent-primary)' : 'var(--text-muted)',
                                            fontStyle: 'italic',
                                            cursor: v.sourceId ? 'pointer' : 'default',
                                            textDecoration: v.sourceId ? 'underline' : 'none'
                                        }}
                                        onClick={() => v.sourceId && navigateToItem(v.sourceId)}
                                    >
                                        {v.source}
                                    </div>
                                </>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Authentication Section */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Authentication</h3>
                </div>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <AuthEditor auth={auth} onChange={(newAuth) => auth.value = newAuth} inheritedAuth={inheritedAuth.value} />
                </div>
            </div>
        </div>
    );
}
