import { Signal } from "@preact/signals";
import { OverrideIndicator } from "../OverrideIndicator";

interface ExecutionParamsEditorProps {
    queryParams: Signal<{ key: string, value: string, enabled: boolean }[]>;
    pathParams: Signal<Record<string, string>>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: { key: string, value: string, enabled: boolean }[]) => void;
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
}

export function ExecutionParamsEditor({ queryParams, pathParams, detectedPathKeys, updateUrlFromParams, isReadOnly, overriddenKeys }: ExecutionParamsEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Path Params Section */}
            {detectedPathKeys.value.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Path Variables</div>
                    {detectedPathKeys.value.map(key => (
                        <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: '120px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{`{${key}}`}</div>
                            <input
                                placeholder="Value"
                                value={pathParams.value[key] || ''}
                                onInput={(e) => {
                                    pathParams.value = { ...pathParams.value, [key]: e.currentTarget.value };
                                }}
                                style={{ flex: 1 }}
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

                {queryParams.value.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Enabled Toggle */}
                        <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                            <input
                                type="checkbox"
                                checked={p.enabled}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                    const newParams = [...queryParams.value];
                                    newParams[i] = { ...p, enabled: e.currentTarget.checked };
                                    updateUrlFromParams(newParams);
                                }}
                                style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                            />
                        </div>

                        {/* Key Input */}
                        <div style={{ width: '150px' }}>
                            <input
                                placeholder="Key"
                                value={p.key}
                                readOnly={isReadOnly}
                                onInput={(e) => {
                                    if (isReadOnly) return;
                                    const newParams = [...queryParams.value];
                                    newParams[i] = { ...p, key: e.currentTarget.value };
                                    updateUrlFromParams(newParams);
                                }}
                                style={{
                                    width: '100%',
                                    backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                    border: isReadOnly ? '1px solid transparent' : '1px solid var(--border-color)',
                                    cursor: isReadOnly ? 'default' : 'text'
                                }}
                            />
                        </div>

                        {/* Value Input */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {overriddenKeys?.has(p.key) && <OverrideIndicator />}
                            <input
                                placeholder="Value"
                                value={p.value}
                                readOnly={isReadOnly}
                                onInput={(e) => {
                                    if (isReadOnly) return;
                                    const newParams = [...queryParams.value];
                                    newParams[i] = { ...p, value: e.currentTarget.value };
                                    updateUrlFromParams(newParams);
                                }}
                                style={{
                                    flex: 1,
                                    backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                    border: isReadOnly ? '1px solid transparent' : '1px solid var(--border-color)',
                                    cursor: isReadOnly ? 'default' : 'text'
                                }}
                            />
                        </div>

                        {/* Delete Button */}
                        {!isReadOnly && (
                            <button onClick={() => {
                                const newParams = queryParams.value.filter((_, idx) => idx !== i);
                                updateUrlFromParams(newParams);
                            }} style={{ color: 'var(--error)', width: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                        )}
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
