import { Signal } from "@preact/signals";
import { navigateToItem } from "../../store";
import { OverrideIndicator } from "../OverrideIndicator";
import { VariableInput } from "../VariableInput";

interface RequestHeadersEditorProps {
    headers: Signal<{ key: string, values: string[] }[]>;
    inheritedHeaders?: { key: string, values: string[], source: string, sourceId?: string }[];
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
    parentId?: string | null;
}

export function RequestHeadersEditor({ headers, inheritedHeaders, isReadOnly, overriddenKeys, parentId }: RequestHeadersEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Own Headers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {headers.value.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ width: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <input
                                placeholder="Key"
                                value={h.key}
                                readOnly={isReadOnly}
                                onInput={(e) => {
                                    if (isReadOnly) return;
                                    const newHeaders = [...headers.value];
                                    newHeaders[i].key = e.currentTarget.value;
                                    headers.value = newHeaders;
                                }}
                                style={{
                                    width: '100%',
                                    background: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: 'var(--spacing-sm)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {h.values.length === 0 && !isReadOnly && (
                                <button
                                    onClick={() => {
                                        const newHeaders = [...headers.value];
                                        newHeaders[i].values = [''];
                                        headers.value = newHeaders;
                                    }}
                                    style={{ alignSelf: 'flex-start', fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
                                >
                                    + Add Value
                                </button>
                            )}
                            {h.values.map((val, valIdx) => (
                                <div key={valIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {overriddenKeys?.has(h.key) && valIdx === 0 && <OverrideIndicator />}
                                    <VariableInput
                                        placeholder="Value"
                                        value={val}
                                        onInput={(newVal) => {
                                            if (isReadOnly) return;
                                            const newHeaders = [...headers.value];
                                            const newValues = [...newHeaders[i].values];
                                            newValues[valIdx] = newVal;
                                            newHeaders[i].values = newValues;
                                            headers.value = newHeaders;
                                        }}
                                        style={{ flex: 1 }}
                                        readOnly={isReadOnly}
                                        parentId={parentId}
                                    />
                                    {!isReadOnly && (
                                        <button
                                            onClick={() => {
                                                const newHeaders = [...headers.value];
                                                newHeaders[i].values = newHeaders[i].values.filter((_, vIdx) => vIdx !== valIdx);
                                                headers.value = newHeaders;
                                            }}
                                            style={{ color: 'var(--text-muted)', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                        >
                                            -
                                        </button>
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <button
                                    onClick={() => {
                                        const newHeaders = [...headers.value];
                                        newHeaders[i].values = [...newHeaders[i].values, ''];
                                        headers.value = newHeaders;
                                    }}
                                    style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    +
                                </button>
                            )}
                        </div>
                        {!isReadOnly && (
                            <button onClick={() => {
                                const newHeaders = headers.value.filter((_, idx) => idx !== i);
                                headers.value = newHeaders;
                            }} style={{ color: 'var(--error)', alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                        )}
                    </div>
                ))}
                {!isReadOnly && (
                    <button
                        onClick={() => headers.value = [...headers.value, { key: '', values: [''] }]}
                        style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        + Add Header
                    </button>
                )}
            </div>

            {/* Inherited Headers */}
            {inheritedHeaders && inheritedHeaders.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inherited Headers</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Key</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Value</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Source</div>

                        {inheritedHeaders.map((h) => (
                            <>
                                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{h.key}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                                    {h.values.map(v => (
                                        <div key={v} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v}>{v}</div>
                                    ))}
                                </div>
                                <div
                                    style={{
                                        color: h.sourceId ? 'var(--accent-primary)' : 'var(--text-muted)',
                                        fontStyle: 'italic',
                                        cursor: h.sourceId ? 'pointer' : 'default',
                                        textDecoration: h.sourceId ? 'underline' : 'none'
                                    }}
                                    onClick={() => h.sourceId && navigateToItem(h.sourceId)}
                                    title={h.sourceId ? "Go to source" : ""}
                                >
                                    {h.source}
                                </div>
                            </>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
