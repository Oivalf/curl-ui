import { useSignal } from "@preact/signals";
import { responseData } from '../store';

export function ResponsePanel() {
    const activeResponseTab = useSignal<'body' | 'headers' | 'raw'>('body');

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>RESPONSE</span>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'body' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'body' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'body'}>Body</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'headers' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'headers' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'headers'}>Headers</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'raw' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'raw' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'raw'}>Raw</h3>
                {responseData.value && (
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', maxWidth: '50%' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{responseData.value.status}</span>
                        {responseData.value.requestUrl && (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', maxWidth: '100%', overflow: 'hidden' }}>
                                {responseData.value.requestMethod && (
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        color: responseData.value.requestMethod === 'GET' ? 'var(--success)' :
                                            responseData.value.requestMethod === 'POST' ? 'var(--warning)' :
                                                responseData.value.requestMethod === 'PUT' ? 'var(--accent-primary)' :
                                                    responseData.value.requestMethod === 'PATCH' ? 'var(--yellow)' :
                                                        responseData.value.requestMethod === 'DELETE' ? 'var(--error)' : 'var(--text-muted)'
                                    }}>
                                        {responseData.value.requestMethod}
                                    </span>
                                )}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={responseData.value.requestUrl}>
                                    {responseData.value.requestUrl}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{
                flex: 1,
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-sm)',
                overflow: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                whiteSpace: 'pre-wrap'
            }}>
                {!responseData.value ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No response</div>
                ) : (
                    activeResponseTab.value === 'body' ? (
                        // Try to prettify if it looks like JSON, otherwise raw
                        (() => {
                            try {
                                return JSON.stringify(JSON.parse(responseData.value.body), null, 2);
                            } catch {
                                return responseData.value.body;
                            }
                        })()
                    ) : activeResponseTab.value === 'headers' ? (
                        // Headers
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(responseData.value.headers).map(([k, v]) => (
                                    <tr key={k}>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{k}</td>
                                        <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{v as any}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        // Raw HTTP reconstruction
                        `HTTP/1.1 ${responseData.value.status}\n` +
                        Object.entries(responseData.value.headers).map(([k, v]) => `${k}: ${v}`).join('\n') +
                        '\n\n' +
                        responseData.value.body
                    )
                )}
            </div>
        </div>
    );
}
