import { Signal } from "@preact/signals";
import { OverrideIndicator } from "../OverrideIndicator";
import { VariableInput } from "../VariableInput";

interface ExecutionParamsEditorProps {
    queryParams: Signal<{ key: string, values: string[], enabled: boolean }[]>;
    pathParams: Signal<Record<string, string>>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: { key: string, values: string[], enabled: boolean }[]) => void;
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function ExecutionParamsEditor({ queryParams, pathParams, detectedPathKeys, updateUrlFromParams, isReadOnly, overriddenKeys, parentKeys, parentId }: ExecutionParamsEditorProps) {

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

                {queryParams.value.map((group, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                        {/* Enabled Toggle - Key Level */}
                        <div style={{ width: '24px', marginTop: '4px', display: 'flex', justifyContent: 'center' }}>
                            <input
                                type="checkbox"
                                checked={group.enabled}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                    const newParams = [...queryParams.value];
                                    newParams[i] = { ...newParams[i], enabled: e.currentTarget.checked };
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
                                readOnly={isReadOnly || parentKeys?.has(group.key)}
                                onInput={(e) => {
                                    if (isReadOnly || parentKeys?.has(group.key)) return;
                                    const newParams = [...queryParams.value];
                                    newParams[i] = { ...newParams[i], key: e.currentTarget.value };
                                    updateUrlFromParams(newParams);
                                }}
                                style={{
                                    width: '100%',
                                    background: (isReadOnly || parentKeys?.has(group.key)) ? 'transparent' : 'var(--bg-input)',
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
                            {group.values.map((v, valIdx) => (
                                <div key={valIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {/* Value Input */}
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {overriddenKeys?.has(group.key) && valIdx === 0 && <OverrideIndicator />}
                                        <VariableInput
                                            placeholder="Value"
                                            value={v}
                                            readOnly={isReadOnly}
                                            onInput={(val) => {
                                                if (isReadOnly) return;
                                                const newParams = [...queryParams.value];
                                                const newVals = [...newParams[i].values];
                                                newVals[valIdx] = val;
                                                newParams[i].values = newVals;
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
                                                const newParams = [...queryParams.value];
                                                newParams[i].values = newParams[i].values.filter((_, idx) => idx !== valIdx);
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
                                        newParams[i].values = [...newParams[i].values, ''];
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
                                    const newParams = queryParams.value.filter((_, idx) => idx !== i);
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
                        onClick={() => updateUrlFromParams([...queryParams.value, { key: '', values: [''], enabled: true }])}
                        style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        + Add Param
                    </button>
                )}
            </div>
        </div>
    );
}
