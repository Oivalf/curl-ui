import { Signal } from "@preact/signals";
import { OverrideIndicator } from "../OverrideIndicator";
import { VariableInput } from "../VariableInput";

interface ExecutionParamsEditorProps {
    queryParams: Signal<{ key: string, value: string, enabled: boolean }[]>;
    pathParams: Signal<Record<string, string>>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: { key: string, value: string, enabled: boolean }[]) => void;
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function ExecutionParamsEditor({ queryParams, pathParams, detectedPathKeys, updateUrlFromParams, isReadOnly, overriddenKeys, parentKeys, parentId }: ExecutionParamsEditorProps) {
    // Group the flat queryParams by key for rendering
    const groupParams = () => {
        const groups: { key: string, items: { value: string, enabled: boolean, originalIndex: number }[] }[] = [];
        const keyToGroupIdx = new Map<string, number>();

        queryParams.value.forEach((p, i) => {
            if (keyToGroupIdx.has(p.key)) {
                groups[keyToGroupIdx.get(p.key)!].items.push({ ...p, originalIndex: i });
            } else {
                keyToGroupIdx.set(p.key, groups.length);
                groups.push({ key: p.key, items: [{ ...p, originalIndex: i }] });
            }
        });
        return groups;
    };

    const grouped = groupParams();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Path Params Section */}
            {detectedPathKeys.value.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Path Variables</div>
                    {detectedPathKeys.value.map(key => (
                        <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: '120px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{`{${key}}`}</div>
                            <VariableInput
                                placeholder="Value"
                                value={pathParams.value[key] || ''}
                                onInput={(val) => {
                                    pathParams.value = { ...pathParams.value, [key]: val };
                                }}
                                style={{ flex: 1 }}
                                parentId={parentId}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Query Params Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Query Parameters</div>

                {/* Headers row */}
                <div style={{ display: 'flex', gap: '8px', paddingBottom: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    <div style={{ width: '24px' }}></div> {/* Checkbox placeholder */}
                    <div style={{ width: '150px' }}>Key</div>
                    <div style={{ flex: 1 }}>Value</div>
                    {!isReadOnly && <div style={{ width: '24px' }}></div>}
                </div>

                {grouped.map((group) => (
                    <div key={group.key} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                        {/* Enabled Toggle - Key Level */}
                        <div style={{ width: '24px', marginTop: '4px', display: 'flex', justifyContent: 'center' }}>
                            <input
                                type="checkbox"
                                checked={group.items.every(it => it.enabled)}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                    const newEnabled = e.currentTarget.checked;
                                    const newParams = [...queryParams.value];
                                    group.items.forEach(item => {
                                        newParams[item.originalIndex] = { ...newParams[item.originalIndex], enabled: newEnabled };
                                    });
                                    updateUrlFromParams(newParams);
                                }}
                                style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                            />
                        </div>

                        {/* Key Input */}
                        <div style={{ width: '150px', marginTop: '4px' }}>
                            <input
                                placeholder="Key"
                                value={group.key}
                                readOnly={isReadOnly}
                                onInput={(e) => {
                                    if (isReadOnly) return;
                                    const newParams = [...queryParams.value];
                                    group.items.forEach(item => {
                                        newParams[item.originalIndex] = { ...newParams[item.originalIndex], key: e.currentTarget.value };
                                    });
                                    updateUrlFromParams(newParams);
                                }}
                                style={{
                                    width: '100%',
                                    background: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '6px 8px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    lineHeight: '1.5rem',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Values List */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {group.items.map((item) => (
                                <div key={item.originalIndex} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {/* Value Input */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {overriddenKeys?.has(group.key) && item.originalIndex === group.items[0].originalIndex && <OverrideIndicator />}
                                        <VariableInput
                                            placeholder="Value"
                                            value={item.value}
                                            readOnly={isReadOnly}
                                            onInput={(val) => {
                                                if (isReadOnly) return;
                                                const newParams = [...queryParams.value];
                                                newParams[item.originalIndex] = { ...newParams[item.originalIndex], value: val };
                                                updateUrlFromParams(newParams);
                                            }}
                                            style={{
                                                flex: 1,
                                                background: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                            }}
                                            parentId={parentId}
                                        />
                                    </div>

                                    {/* Individual Value Remove Button */}
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => {
                                                const newParams = queryParams.value.filter((_, idx) => idx !== item.originalIndex);
                                                updateUrlFromParams(newParams);
                                            }}
                                            style={{ color: 'var(--text-muted)', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            -
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* Add Value Button */}
                            {!isReadOnly && (
                                <button
                                    onClick={() => {
                                        const newParams = [...queryParams.value];
                                        // Insert after the last item of this group for better UX? 
                                        // Simple append for now.
                                        newParams.push({ key: group.key, value: '', enabled: true });
                                        updateUrlFromParams(newParams);
                                    }}
                                    style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    +
                                </button>
                            )}
                        </div>

                        {/* Whole Group Delete Button - Hidden for inherited keys */}
                        {!isReadOnly && !parentKeys?.has(group.key) && (
                            <button
                                onClick={() => {
                                    const indexesToRemove = new Set(group.items.map(it => it.originalIndex));
                                    const newParams = queryParams.value.filter((_, idx) => !indexesToRemove.has(idx));
                                    updateUrlFromParams(newParams);
                                }}
                                style={{ color: 'var(--error)', width: '24px', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'center' }}
                            >
                                ×
                            </button>
                        )}
                        {/* Placeholder for alignment if the × button is missing */}
                        {!isReadOnly && parentKeys?.has(group.key) && <div style={{ width: '24px' }}></div>}
                    </div>
                ))}

                {!isReadOnly && (
                    <button
                        onClick={() => updateUrlFromParams([...queryParams.value, { key: '', value: '', enabled: true }])}
                        style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        + Add Param
                    </button>
                )}
            </div>
        </div>
    );
}
