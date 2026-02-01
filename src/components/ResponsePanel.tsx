import { useSignal } from "@preact/signals";
import { responseData } from '../store';
import { RequestCurlView } from "./request/RequestCurlView";

export function ResponsePanel() {
    const activeResponseTab = useSignal<'body' | 'headers' | 'raw_response' | 'raw_request' | 'curl'>('body');

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>RESPONSE</span>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'body' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'body' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'body'}>Body</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'headers' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'headers' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'headers'}>Headers</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'raw_response' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'raw_response' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'raw_response'}>Raw Response</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'raw_request' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'raw_request' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'raw_request'}>Raw Request</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'curl' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'curl' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'curl'}>Curl</h3>
                {responseData.value && (
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', maxWidth: '50%' }}>
                        <span style={{ color: responseData.value.status > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                            {responseData.value.status === 0 ? '...' : responseData.value.status}
                        </span>
                    </div>
                )}
            </div>

            <div style={{
                flex: 1,
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-sm)',
                overflow: 'auto',
                minHeight: 0
            }}>
                <div style={{ height: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                    {activeResponseTab.value === 'body' && (
                        !responseData.value || responseData.value.status === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                                {responseData.value?.status === 0 ? 'Requesting...' : 'No response'}
                            </div>
                        ) : (
                            // Try to prettify if it looks like JSON, otherwise raw
                            (() => {
                                try {
                                    return JSON.stringify(JSON.parse(responseData.value.body), null, 2);
                                } catch {
                                    return responseData.value.body;
                                }
                            })()
                        )
                    )}

                    {activeResponseTab.value === 'headers' && (
                        !responseData.value || responseData.value.status === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                                {responseData.value?.status === 0 ? 'Requesting...' : 'No response'}
                            </div>
                        ) : (
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
                        )
                    )}

                    {activeResponseTab.value === 'raw_response' && (
                        !responseData.value || responseData.value.status === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                                {responseData.value?.status === 0 ? 'Requesting...' : 'No response'}
                            </div>
                        ) : (
                            `HTTP/1.1 ${responseData.value.status}\n` +
                            Object.entries(responseData.value.headers).map(([k, v]) => `${k}: ${v}`).join('\n') +
                            '\n\n' +
                            responseData.value.body
                        )
                    )}

                    {activeResponseTab.value === 'raw_request' && (
                        responseData.value?.requestRaw ? (
                            <div style={{ color: 'var(--text-secondary)' }}>
                                {responseData.value.requestRaw}
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No request data</div>
                        )
                    )}

                    {activeResponseTab.value === 'curl' && (
                        responseData.value?.requestCurl ? (
                            <RequestCurlView curlCommand={responseData.value.requestCurl} />
                        ) : (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No curl data</div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
