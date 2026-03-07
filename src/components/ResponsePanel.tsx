import { useSignal } from "@preact/signals";
import { ResponseData } from '../store';
import { RequestCurlView } from "./request/RequestCurlView";
import { formatBytes } from "../utils/format";
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Download } from 'lucide-preact';
import { CodeEditor } from "./CodeEditor";

interface ResponsePanelProps {
    response: ResponseData | null;
}

export function ResponsePanel({ response }: ResponsePanelProps) {
    const activeResponseTab = useSignal<'body' | 'headers' | 'raw_response' | 'raw_request' | 'curl'>('body');

    const handleSaveBody = async () => {
        if (!response?.body) return;

        try {
            // Try to determine extension from content-type header
            let extension = 'bin';
            const headers = response.headers as string[][];
            const contentType = headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '';

            if (contentType.includes('json')) extension = 'json';
            else if (contentType.includes('xml')) extension = 'xml';
            else if (contentType.includes('html')) extension = 'html';
            else if (contentType.includes('text')) extension = 'txt';
            else if (contentType.includes('javascript')) extension = 'js';
            else if (contentType.includes('yaml')) extension = 'yaml';

            const filePath = await save({
                defaultPath: `response_body.${extension}`,
                filters: [{
                    name: 'Response Body',
                    extensions: [extension, 'txt', 'bin', '*']
                }]
            });

            if (filePath) {
                let content = response.body;
                // If it's JSON, maybe the user wants it prettified as shown in UI?
                // Let's stick to the raw body for accuracy, or whatever is currently displayed.
                // In the UI we try to JSON.parse(body), let's do the same for the file if it's JSON.
                if (extension === 'json') {
                    try {
                        content = JSON.stringify(JSON.parse(content), null, 2);
                    } catch { /* ignore if parse fails */ }
                }

                await invoke('save_workspace', { path: filePath, data: content });
                alert(`Body saved to ${filePath}`);
            }
        } catch (err) {
            console.error('Failed to save body:', err);
            alert('Error saving body: ' + err);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>RESPONSE</span>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'body' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'body' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'body'}>Body</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'headers' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'headers' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'headers'}>Headers</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'raw_response' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'raw_response' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'raw_response'}>Raw Response</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'raw_request' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'raw_request' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'raw_request'}>Raw Request</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeResponseTab.value === 'curl' ? 1 : 0.5, borderBottom: activeResponseTab.value === 'curl' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeResponseTab.value = 'curl'}>Curl</h3>
                {response && (
                    <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', maxWidth: '50%' }}>
                        <span style={{
                            color: response.status >= 200 && response.status < 300 ? 'var(--success)' :
                                response.status >= 400 ? 'var(--error)' :
                                    response.status === 0 ? 'var(--text-muted)' : 'var(--warning)',
                            fontWeight: 'bold'
                        }}>
                            {response.status === 0 ? '...' : response.status}
                        </span>
                        {response.size !== undefined && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {formatBytes(response.size)}
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div style={{
                flex: 1,
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-sm)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0
            }}>
                <div style={{ height: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                    {activeResponseTab.value === 'body' && (
                        !response || response.status === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                                {response?.status === 0 ? 'Requesting...' : 'No response'}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ flex: 1, minHeight: 0 }}>
                                    {(() => {
                                        const headers = response.headers as string[][];
                                        const contentType = headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '';
                                        let lang: 'json' | 'yaml' | 'html' | 'xml' | 'text' = 'text';

                                        if (contentType.includes('json')) lang = 'json';
                                        else if (contentType.includes('yaml')) lang = 'yaml';
                                        else if (contentType.includes('html')) lang = 'html';
                                        else if (contentType.includes('xml')) lang = 'xml';

                                        let content = response.body;
                                        if (lang === 'json') {
                                            try {
                                                content = JSON.stringify(JSON.parse(content), null, 2);
                                            } catch { /* ignore */ }
                                        }

                                        return (
                                            <CodeEditor
                                                value={content}
                                                language={lang}
                                                readOnly={true}
                                                height="100%"
                                            />
                                        );
                                    })()}
                                </div>
                                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                                    <button
                                        onClick={handleSaveBody}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 16px',
                                            backgroundColor: 'var(--accent-primary)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover, var(--accent-primary))')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
                                    >
                                        <Download size={16} />
                                        Save Body to File
                                    </button>
                                </div>
                            </div>
                        )
                    )}

                    {activeResponseTab.value === 'headers' && (
                        !response || response.status === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                                {response?.status === 0 ? 'Requesting...' : 'No response'}
                            </div>
                        ) : (
                            <div style={{ flex: 1, overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Name</th>
                                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(response.headers as string[][]).map(([k, v], i) => (
                                            <tr key={i}>
                                                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{k}</td>
                                                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{v}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {activeResponseTab.value === 'raw_response' && (
                        !response || response.status === 0 ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
                                {response?.status === 0 ? 'Requesting...' : 'No response'}
                            </div>
                        ) : (
                            <CodeEditor
                                value={
                                    `HTTP/1.1 ${response.status}\n` +
                                    (response.headers as string[][]).map(([k, v]) => `${k}: ${v}`).join('\n') +
                                    '\n\n' +
                                    response.body
                                }
                                language="text"
                                readOnly={true}
                                height="100%"
                            />
                        )
                    )}

                    {activeResponseTab.value === 'raw_request' && (
                        response?.requestRaw ? (
                            <CodeEditor
                                value={response.requestRaw}
                                language="text"
                                readOnly={true}
                                height="100%"
                            />
                        ) : (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No request data</div>
                        )
                    )}

                    {activeResponseTab.value === 'curl' && (
                        response?.requestCurl ? (
                            <RequestCurlView curlCommand={response.requestCurl} />
                        ) : (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No curl data</div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
