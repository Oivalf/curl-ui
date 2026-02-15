import { Signal } from "@preact/signals";
import { navigateToItem } from "../../store";
import { OverrideIndicator } from "../OverrideIndicator";
import { VariableInput } from "../VariableInput";

interface ExecutionHeadersEditorProps {
    headers: Signal<{ key: string, value: string, enabled: boolean }[]>;
    inheritedHeaders?: { key: string, value: string, source: string, sourceId?: string }[];
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function ExecutionHeadersEditor({ headers, inheritedHeaders, isReadOnly, overriddenKeys, parentKeys, parentId }: ExecutionHeadersEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

            {/* Headers row */}
            <div style={{ display: 'flex', gap: '8px', paddingBottom: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                <div style={{ width: '24px' }}></div> {/* Checkbox placeholder */}
                <div style={{ flex: 1, minWidth: 0 }}>Key</div>
                <div style={{ flex: 1, minWidth: 0 }}>Value</div>
                {!isReadOnly && <div style={{ width: '24px' }}></div>}
            </div>

            {/* Own Headers */}
            {headers.value.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Enabled Toggle */}
                    <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                        <input
                            type="checkbox"
                            checked={h.enabled}
                            disabled={isReadOnly}
                            onChange={(e) => {
                                const newHeaders = [...headers.value];
                                newHeaders[i] = { ...newHeaders[i], enabled: e.currentTarget.checked };
                                headers.value = newHeaders;
                            }}
                            style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                        />
                    </div>

                    {/* Key Input */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <input
                            placeholder="Key"
                            value={h.key}
                            readOnly={isReadOnly || parentKeys?.has(h.key)}
                            onInput={(e) => {
                                if (isReadOnly || parentKeys?.has(h.key)) return;
                                const newHeaders = [...headers.value];
                                newHeaders[i] = { ...newHeaders[i], key: e.currentTarget.value };
                                headers.value = newHeaders;
                            }}
                            style={{
                                width: '100%',
                                background: (isReadOnly || parentKeys?.has(h.key)) ? 'transparent' : 'var(--bg-input)',
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

                    {/* Value Input */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {overriddenKeys?.has(h.key) && <OverrideIndicator />}
                        <VariableInput
                            placeholder="Value"
                            value={h.value}
                            onInput={(val) => {
                                const newHeaders = [...headers.value];
                                newHeaders[i] = { ...newHeaders[i], value: val };
                                headers.value = newHeaders;
                            }}
                            style={{ flex: 1, minWidth: 0 }}
                            readOnly={isReadOnly}
                            parentId={parentId}
                        />
                    </div>

                    {/* Delete Button - Hidden for inherited keys */}
                    {!isReadOnly && !parentKeys?.has(h.key) && (
                        <button
                            onClick={() => {
                                const newHeaders = headers.value.filter((_, idx) => idx !== i);
                                headers.value = newHeaders;
                            }}
                            style={{ color: 'var(--error)', width: '24px', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            ×
                        </button>
                    )}
                    {/* Placeholder for alignment if the × button is missing */}
                    {!isReadOnly && parentKeys?.has(h.key) && <div style={{ width: '24px' }}></div>}
                </div>
            ))}

            {!isReadOnly && (
                <button
                    onClick={() => headers.value = [...headers.value, { key: '', value: '', enabled: true }]}
                    style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    + Add Header
                </button>
            )}

            {/* Inherited Headers */}
            {inheritedHeaders && inheritedHeaders.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inherited Headers</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Key</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Value</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Source</div>

                        {inheritedHeaders.map((h, i) => (
                            <div key={i} style={{ display: 'contents' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{h.key}</div>
                                <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={h.value}>{h.value}</div>
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
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
