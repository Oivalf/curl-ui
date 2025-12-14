import { Signal } from "@preact/signals";

interface RequestParamsEditorProps {
    queryParams: Signal<{ key: string, values: string[] }[]>;
    pathParams: Signal<Record<string, string>>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: { key: string, values: string[] }[]) => void;
}

export function RequestParamsEditor({ queryParams, pathParams, detectedPathKeys, updateUrlFromParams }: RequestParamsEditorProps) {
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
                {queryParams.value.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ width: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <input
                                placeholder="Key"
                                value={p.key}
                                onInput={(e) => {
                                    const newParams = queryParams.value.map((param, idx) =>
                                        idx === i ? { ...param, key: e.currentTarget.value } : param
                                    );
                                    updateUrlFromParams(newParams);
                                }}
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {p.values.length === 0 && (
                                <button
                                    onClick={() => {
                                        const newParams = queryParams.value.map((param, idx) =>
                                            idx === i ? { ...param, values: [''] } : param
                                        );
                                        updateUrlFromParams(newParams);
                                    }}
                                    style={{ alignSelf: 'flex-start', fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
                                >
                                    + Add Value
                                </button>
                            )}
                            {p.values.map((val, valIdx) => (
                                <div key={valIdx} style={{ display: 'flex', gap: '4px' }}>
                                    <input
                                        placeholder="Value"
                                        value={val}
                                        onInput={(e) => {
                                            const newParams = queryParams.value.map((param, idx) => {
                                                if (idx !== i) return param;
                                                const newValues = [...param.values];
                                                newValues[valIdx] = e.currentTarget.value;
                                                return { ...param, values: newValues };
                                            });
                                            updateUrlFromParams(newParams);
                                        }}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        onClick={() => {
                                            const newParams = queryParams.value.map((param, idx) => {
                                                if (idx !== i) return param;
                                                const newValues = param.values.filter((_, vIdx) => vIdx !== valIdx);
                                                return { ...param, values: newValues };
                                            });
                                            updateUrlFromParams(newParams);
                                        }}
                                        style={{ color: 'var(--text-muted)', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        -
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const newParams = queryParams.value.map((param, idx) =>
                                        idx === i ? { ...param, values: [...param.values, ''] } : param
                                    );
                                    updateUrlFromParams(newParams);
                                }}
                                style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                +
                            </button>
                        </div>
                        <button onClick={() => {
                            const newParams = queryParams.value.filter((_, idx) => idx !== i);
                            updateUrlFromParams(newParams);
                        }} style={{ color: 'var(--error)', alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                ))}
                <button
                    onClick={() => updateUrlFromParams([...queryParams.value, { key: '', values: [''] }])}
                    style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    + Add Param
                </button>
            </div>
        </div>
    );
}
