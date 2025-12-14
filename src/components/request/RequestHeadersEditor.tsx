import { Signal } from "@preact/signals";

interface RequestHeadersEditorProps {
    headers: Signal<{ key: string, value: string }[]>;
}

export function RequestHeadersEditor({ headers }: RequestHeadersEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                        style={{ flex: 1 }}
                    />
                    <input
                        placeholder="Value"
                        value={h.value}
                        onInput={(e) => {
                            const newHeaders = [...headers.value];
                            newHeaders[i].value = e.currentTarget.value;
                            headers.value = newHeaders;
                        }}
                        style={{ flex: 1 }}
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
        </div>
    );
}
