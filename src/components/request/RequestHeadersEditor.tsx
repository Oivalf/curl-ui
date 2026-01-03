import { Signal } from "@preact/signals";
import { navigateToItem } from "../../store";

interface RequestHeadersEditorProps {
    headers: Signal<{ key: string, value: string }[]>;
    inheritedHeaders?: { key: string, value: string, source: string, sourceId?: string }[];
}

export function RequestHeadersEditor({ headers, inheritedHeaders }: RequestHeadersEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Own Headers */}
            {headers.value.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px' }}>
                    <input
                        placeholder="Key"
                        value={h.key}
                        onInput={(e) => {
                            const newHeaders = [...headers.value];
                            newHeaders[i].key = e.currentTarget.value;
                            headers.value = newHeaders;
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <input
                        placeholder="Value"
                        value={h.value}
                        onInput={(e) => {
                            const newHeaders = [...headers.value];
                            newHeaders[i].value = e.currentTarget.value;
                            headers.value = newHeaders;
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                    />
                    <button onClick={() => {
                        const newHeaders = headers.value.filter((_, idx) => idx !== i);
                        headers.value = newHeaders;
                    }} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
            ))}
            <button
                onClick={() => headers.value = [...headers.value, { key: '', value: '' }]}
                style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
                + Add Header
            </button>

            {/* Inherited Headers */}
            {inheritedHeaders && inheritedHeaders.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inherited Headers</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Key</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Value</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Source</div>

                        {inheritedHeaders.map((h, i) => (
                            <>
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
                            </>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
