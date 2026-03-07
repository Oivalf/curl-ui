import { ResponseData } from '../../store';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Download } from 'lucide-preact';
import { CodeEditor } from '../CodeEditor';

interface ResponseBodyTabProps {
    response: ResponseData;
}

export function ResponseBodyTab({ response }: ResponseBodyTabProps) {
    const handleSaveBody = async () => {
        if (!response?.body) return;

        try {
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
                <CodeEditor
                    value={content}
                    language={lang}
                    readOnly={true}
                    height="100%"
                />
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
    );
}
