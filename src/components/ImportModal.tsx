import { useState, useEffect, useRef } from 'preact/hooks';
import { Modal } from './Modal';
import { importModalState, requests, folders, activeRequestId } from '../store';
import { parseCurl } from '../utils/curlParser';
import { parseSwagger } from '../utils/swaggerParser';
import { FileUp } from 'lucide-preact';

export function ImportModal() {
    const state = importModalState.value;
    const [importType, setImportType] = useState<'curl' | 'swagger'>(state.type);
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset content and sync type when opening
    useEffect(() => {
        if (state.isOpen) {
            setContent('');
            setError(null);
            setImportType(state.type);
        }
    }, [state.isOpen, state.type]);

    if (!state.isOpen) return null;

    const handleClose = () => {
        importModalState.value = { ...state, isOpen: false };
    };

    const handleFileChange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (text) {
                setContent(text);
                setError(null);
            }
        };
        reader.onerror = () => {
            setError("Failed to read file.");
        };
        reader.readAsText(file);

        // Reset input so same file can be picked again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImport = async () => {
        if (!content.trim()) return;

        try {
            if (importType === 'curl') {
                const parsed = parseCurl(content);
                const newId = crypto.randomUUID();

                let name = "Imported Request";
                try {
                    const url = new URL(parsed.url);
                    name = url.pathname.split('/').pop() || url.hostname;
                    if (name.length > 30) name = name.substring(0, 27) + "...";
                } catch { /* ignore */ }

                requests.value = [...requests.value, {
                    id: newId,
                    name: name,
                    method: parsed.method,
                    url: parsed.url,
                    headers: parsed.headers,
                    body: parsed.body,
                    parentId: state.folderId || null,
                    collectionId: state.collectionId
                }];
                activeRequestId.value = newId;

                // Auto-create sample execution
                const { ensureDefaultExecutions } = await import('../store');
                ensureDefaultExecutions([newId]);

            } else if (importType === 'swagger') {
                const parsed = parseSwagger(content);

                if (state.targetType === 'external-mock' || state.targetType === 'new-external-mock') {
                    const { externalMocks, saveExternalMockToDisk } = await import('../store');
                    let mockId = state.targetId;
                    let mock: any;

                    if (state.targetType === 'new-external-mock') {
                        mockId = crypto.randomUUID();
                        mock = {
                            id: mockId,
                            name: parsed.title || "Imported Mock",
                            port: 4000,
                            endpoints: [],
                            serverStatus: 'stopped'
                        };
                        externalMocks.value = [...externalMocks.value, mock];
                    } else {
                        mock = externalMocks.peek().find(m => m.id === mockId);
                    }

                    if (!mock) throw new Error("Target External Mock not found.");

                    const newEndpoints = [...mock.endpoints];
                    parsed.requests.forEach(pr => {
                        newEndpoints.push({
                            method: pr.method,
                            path: pr.path,
                            response: {
                                statusCode: pr.responseStatus || 200,
                                headers: { ...pr.headers, 'Content-Type': 'application/json' },
                                body: pr.body || '{}',
                                enabled: true
                            }
                        });
                    });

                    externalMocks.value = externalMocks.value.map(m =>
                        m.id === mockId ? { ...m, endpoints: newEndpoints } : m
                    );

                    saveExternalMockToDisk(mockId!, true, true);

                } else {
                    const collectionId = state.collectionId;
                    const tagFolders: Record<string, string> = {};

                    const newFolders = [...folders.value];
                    const allRequests = [...requests.value];

                    const uniqueTags = Array.from(new Set(parsed.requests.flatMap(r => r.tags)));

                    uniqueTags.forEach(tag => {
                        const folderId = crypto.randomUUID();
                        tagFolders[tag] = folderId;
                        newFolders.push({
                            id: folderId,
                            name: tag,
                            collectionId,
                            parentId: state.folderId || null,
                            collapsed: false
                        });
                    });

                    const newRequestIds: string[] = [];
                    parsed.requests.forEach(pr => {
                        const newId = crypto.randomUUID();
                        newRequestIds.push(newId);

                        const parentId = pr.tags.length > 0 ? tagFolders[pr.tags[0]] : (state.folderId || null);

                        allRequests.push({
                            id: newId,
                            collectionId,
                            name: pr.name,
                            method: pr.method,
                            url: pr.url,
                            headers: pr.headers,
                            body: pr.body,
                            parentId
                        });
                    });

                    folders.value = newFolders;
                    requests.value = allRequests;

                    const { ensureDefaultExecutions } = await import('../store');
                    ensureDefaultExecutions(newRequestIds);
                }
            }

            handleClose();
        } catch (e: any) {
            setError(e.message || String(e));
        }
    };

    return (
        <Modal
            isOpen={state.isOpen}
            onClose={handleClose}
            title="Import Requests"
            zIndex={1200}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {/* Type Selector */}
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '2px', alignSelf: 'center' }}>
                    <button
                        onClick={() => setImportType('curl')}
                        style={{
                            padding: '4px 16px',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: importType === 'curl' ? 'var(--accent-primary)' : 'transparent',
                            color: importType === 'curl' ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: importType === 'curl' ? 'bold' : 'normal'
                        }}
                    >
                        cURL
                    </button>
                    <button
                        onClick={() => setImportType('swagger')}
                        style={{
                            padding: '4px 16px',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: importType === 'swagger' ? 'var(--accent-primary)' : 'transparent',
                            color: importType === 'swagger' ? 'white' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: importType === 'swagger' ? 'bold' : 'normal'
                        }}
                    >
                        Swagger / OpenAPI
                    </button>
                </div>

                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {importType === 'curl'
                        ? 'Paste a bash-formatted cURL command below or load from a file.'
                        : 'Paste your Swagger 2.0 or OpenAPI 3.x specification (JSON or YAML) below or load from a file.'}
                </p>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        accept=".json,.yaml,.yml,.txt"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        <FileUp size={14} /> Load from File
                    </button>
                    {content.trim() && (
                        <button
                            onClick={() => setContent('')}
                            style={{
                                padding: '6px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--error)',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                <textarea
                    value={content}
                    onInput={(e) => setContent(e.currentTarget.value)}
                    placeholder={importType === 'curl' ? 'curl -X GET ...' : '{ "openapi": "3.0.0", ... }'}
                    style={{
                        width: '100%',
                        height: '250px',
                        minHeight: '150px',
                        resize: 'vertical',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--spacing-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        outline: 'none'
                    }}
                />

                {error && (
                    <div style={{
                        color: 'var(--error)',
                        fontSize: '0.8rem',
                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                        padding: '8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid rgba(255, 0, 0, 0.2)'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 'var(--spacing-sm)' }}>
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!content.trim()}
                        style={{
                            padding: '6px 16px',
                            backgroundColor: 'var(--accent-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'white',
                            cursor: content.trim() ? 'pointer' : 'not-allowed',
                            opacity: content.trim() ? 1 : 0.5,
                            fontWeight: 'bold'
                        }}
                    >
                        Import
                    </button>
                </div>
            </div>
        </Modal>
    );
}
