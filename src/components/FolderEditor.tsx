import { useSignal, useSignalEffect } from "@preact/signals";
import { activeFolderId, folders, environments, activeEnvironmentName, type Folder } from "../store";
import { Folder as FolderIcon } from "lucide-preact";

export function FolderEditor() {
    const currentFolder = folders.value.find(f => f.id === activeFolderId.value);

    if (!currentFolder) return null;

    // Local signals
    const name = useSignal(currentFolder.name);
    const headers = useSignal<{ key: string, value: string }[]>(
        Object.entries(currentFolder.headers || {}).map(([k, v]) => ({ key: k, value: v }))
    );
    const variables = useSignal<{ key: string, value: string }[]>(
        Object.entries(currentFolder.variables || {}).map(([k, v]) => ({ key: k, value: v }))
    );

    // Compute inherited variables
    const inheritedVariables = useSignal<{ key: string, value: string, source: string }[]>([]);

    useSignalEffect(() => {
        const folderId = activeFolderId.value;
        const currentEnv = environments.value.find(e => e.name === activeEnvironmentName.value);
        const map = new Map<string, { value: string, source: string }>();

        // 1. Environment
        if (currentEnv) {
            currentEnv.variables.forEach(v => map.set(v.key, { value: v.value, source: `Env: ${currentEnv.name}` }));
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
                            map.set(k, { value: v, source: `Folder: ${f.name}` });
                        }
                    });
                }
            });
        }

        inheritedVariables.value = Array.from(map.entries())
            .map(([k, v]) => ({ key: k, value: v.value, source: v.source }))
            .sort((a, b) => a.key.localeCompare(b.key));
    });

    // Sync back to store
    useSignalEffect(() => {
        const currentName = name.value;
        const currentHeaders = headers.value;
        const currentVars = variables.value;
        const folderId = activeFolderId.value;

        if (!folderId) return;

        const allFolders = folders.peek();
        const idx = allFolders.findIndex(f => f.id === folderId);

        if (idx !== -1) {
            const folder = allFolders[idx];

            // Reconstruct objects
            const headersObj: Record<string, string> = {};
            currentHeaders.forEach(h => { if (h.key) headersObj[h.key] = h.value; });

            const varsObj: Record<string, string> = {};
            currentVars.forEach(v => { if (v.key) varsObj[v.key] = v.value; });

            const headersChanged = JSON.stringify(folder.headers || {}) !== JSON.stringify(headersObj);
            const varsChanged = JSON.stringify(folder.variables || {}) !== JSON.stringify(varsObj);

            if (folder.name !== currentName || headersChanged || varsChanged) {
                const newFolders = [...allFolders];
                newFolders[idx] = {
                    ...folder,
                    name: currentName,
                    headers: headersObj,
                    variables: varsObj
                };
                folders.value = newFolders;
            }
        }
    });

    const addHeader = () => {
        headers.value = [...headers.value, { key: '', value: '' }];
    };

    const removeHeader = (index: number) => {
        headers.value = headers.value.filter((_, i) => i !== index);
    };

    const updateHeader = (index: number, field: 'key' | 'value', val: string) => {
        const newHeaders = [...headers.value];
        newHeaders[index] = { ...newHeaders[index], [field]: val };
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
        <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%', overflow: 'auto' }}>
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

            {/* Shared Headers Section */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Shared Headers</h3>
                    <button onClick={addHeader} style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>+ Add Header</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {headers.value.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No headers defined.</div>}
                    {headers.value.map((header, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px' }}>
                            <input
                                placeholder="Key"
                                value={header.key}
                                onInput={(e) => updateHeader(index, 'key', e.currentTarget.value)}
                                style={{ flex: 1, minWidth: 0 }}
                            />
                            <input
                                placeholder="Value"
                                value={header.value}
                                onInput={(e) => updateHeader(index, 'value', e.currentTarget.value)}
                                style={{ flex: 1, minWidth: 0 }}
                            />
                            <button
                                onClick={() => removeHeader(index)}
                                style={{ padding: '4px 8px', color: 'var(--text-muted)', cursor: 'pointer', background: 'transparent', border: 'none' }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

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
                                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{v.source}</div>
                                </>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
