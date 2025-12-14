import { Signal } from "@preact/signals";

interface RequestRawViewProps {
    method: Signal<string>;
    url: string;
    headers: Signal<{ key: string, value: string }[]>;
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
}

export function RequestRawView({ method, url, headers, bodyType, body }: RequestRawViewProps) {
    return (
        <div style={{
            flex: 1,
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-sm)',
            overflow: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
            color: 'var(--text-secondary)'
        }}>
            {`${method.value} ${url} HTTP/1.1\n`}
            {headers.value.filter(h => h.key).map(h => `${h.key}: ${h.value}`).join('\n')}
            {(() => {
                let ct = '';
                if (!headers.value.find(h => h.key.toLowerCase() === 'content-type')) {
                    switch (bodyType.value) {
                        case 'json': ct = 'application/json'; break;
                        case 'xml': ct = 'application/xml'; break;
                        case 'html': ct = 'text/html'; break;
                        case 'form_urlencoded': ct = 'application/x-www-form-urlencoded'; break;
                        case 'multipart': ct = 'multipart/form-data'; break;
                        case 'text': ct = 'text/plain'; break;
                    }
                }
                return ct ? `\nContent-Type: ${ct}` : '';
            })()}
            {'\n\n'}
            {bodyType.value === 'none' ? '' : body.value}
        </div>
    );
}
