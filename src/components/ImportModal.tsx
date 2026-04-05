import { useState, useEffect, useRef } from 'preact/hooks';
import { Modal } from './Modal';
import { importModal, requests, folders, activeRequestId, environments, ensureDefaultExecutions, externalMocks, saveExternalMockToDisk, createNewRequest, createNewFolder } from '../store';
import { parseCurl } from '../utils/curlParser';
import { parseSwagger } from '../utils/swaggerParser';
import { parsePostmanCollection, parsePostmanEnvironment, ParsedFolder, ParsedRequest } from '../utils/postmanUtils';
import { FileUp } from 'lucide-preact';

export function ImportModal() {
    const state = importModal.value;
    const [importType, setImportType] = useState<'curl' | 'swagger' | 'postman-collection' | 'postman-environment'>(state?.type as any);
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset content and sync type when opening
    useEffect(() => {
        if (state?.isOpen) {
            setContent('');
            setError(null);
            setImportType(state.type);
        }
    }, [state?.isOpen, state?.type]);

    if (!state || !state.isOpen) return null;

    const handleClose = () => {
        importModal.value = { ...state, isOpen: false };
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

                const newRequest = createNewRequest(name, state.collectionId, state.folderId || null);
                newRequest.id = newId;
                newRequest.method = parsed.method;
                newRequest.url = parsed.url;
                newRequest.headers = parsed.headers.map(h => ({ key: h.key, values: [...h.values], enabled: boolean }));
                newRequest.body = parsed.body;
                newRequest.bodyType = parsed.body ? 'json' : 'none';

                requests.value = [...requests.value, newRequest];
                activeRequestId.value = newId;

                // Auto-create sample execution
                ensureDefaultExecutions([newId]);

            } else if (importType === 'swagger') {
                const parsed = parseSwagger(content);

                if (state.targetType === 'external-mock' || state.targetType === 'new-external-mock') {
                    let mockId = state.targetId;
                    let mock: any;

                    if (state.targetType === 'new-external-mock') {
                        mockId = crypto.randomUUID();
                        mock = {
                            id: mockId,
                            name: parsed.title || "Imported Mock",
                            port: 4000,
                            endpoints: [],
                            serverStatus: 'stopped' as const
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
                                headers: [...pr.headers, { key: 'Content-Type', values: ['application/json'], enabled: boolean }],
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
                        const newFolder = createNewFolder(tag, collectionId, state.folderId || null);
                        tagFolders[tag] = newFolder.id;
                        newFolders.push(newFolder);
                    });

                    const newRequestIds: string[] = [];
                    parsed.requests.forEach(pr => {
                        const parentId = pr.tags.length > 0 ? tagFolders[pr.tags[0]] : (state.folderId || null);
                        const newReq = createNewRequest(pr.name, collectionId, parentId);
                        newRequestIds.push(newReq.id);

                        newReq.method = pr.method;
                        newReq.url = pr.url;
                        newReq.headers = pr.headers.map(h => ({ key: h.key, values: [...h.values], enabled: boolean }));
                        newReq.body = pr.requestBody || '';
                        newReq.bodyType = pr.requestBody ? 'json' : 'none';
                        
                        allRequests.push(newReq);
                    });

                    folders.value = newFolders;
                    requests.value = allRequests;

                    ensureDefaultExecutions(newRequestIds);
                }
            } else if (importType === 'postman-collection') {
                const parsed = parsePostmanCollection(content);
                const collectionId = state.collectionId;
                const newRequestIds: string[] = [];

                const allRequests = [...requests.value];
                const newFolders = [...folders.value];

                const processItems = (items: (ParsedFolder | ParsedRequest)[], parentId: string | null) => {
                    for (const item of items) {
                        if ('items' in item) {
                            const newFolder = createNewFolder(item.name, collectionId, parentId);
                            newFolders.push(newFolder);
                            processItems(item.items, newFolder.id);
                        } else {
                            // Request
                            const newReq = createNewRequest(item.name, collectionId, parentId);
                            newRequestIds.push(newReq.id);
                            
                            newReq.method = item.method;
                            newReq.url = item.url;
                            newReq.headers = item.headers.map(h => ({ ...h, enabled: boolean }));
                            newReq.bodyType = item.bodyType;
                            newReq.body = item.body;
                            newReq.formData = item.formData;
                            newReq.auth = item.auth;

                            allRequests.push(newReq);
                        }
                    }
                };

                processItems(parsed.items, state.folderId || null);

                folders.value = newFolders;
                requests.value = allRequests;

                ensureDefaultExecutions(newRequestIds);

            } else if (importType === 'postman-environment') {
                const parsed = parsePostmanEnvironment(content);
                const envs = [...environments.value];
                const existingIdx = envs.findIndex(e => e.name === parsed.name);

                if (existingIdx !== -1) {
                    // Update existing
                    const mergedVars = [...envs[existingIdx].variables];
                    parsed.variables.forEach(v => {
                        const vIdx = mergedVars.findIndex(mv => mv.key === v.key);
                        if (vIdx !== -1) {
                            mergedVars[vIdx].value = v.value;
                        } else {
                            mergedVars.push(v);
                        }
                    });
                    envs[existingIdx] = { ...envs[existingIdx], variables: mergedVars };
                } else {
                    // Add new
                    envs.push(parsed);
                }
                environments.value = envs;
                alert(`Environment "${parsed.name}" imported successfully.`);
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
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '2px', alignSelf: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: '2px' }}>
                    {[
                        { id: 'curl', label: 'cURL' },
                        { id: 'swagger', label: 'Swagger / OpenAPI' },
                        { id: 'postman-collection', label: 'Postman Collection' },
                        { id: 'postman-environment', label: 'Postman Environment' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setImportType(tab.id as any)}
                            style={{
                                padding: '4px 12px',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: importType === tab.id ? 'var(--accent-primary)' : 'transparent',
                                color: importType === tab.id ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: importType === tab.id ? 'bold' : 'normal'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {importType === 'curl' && 'Paste a bash-formatted cURL command below or load from a file.'}
                    {importType === 'swagger' && 'Paste your Swagger 2.0 or OpenAPI 3.x specification (JSON or YAML) below or load from a file.'}
                    {importType === 'postman-collection' && 'Paste your Postman Collection v2.1 JSON below or load from a file.'}
                    {importType === 'postman-environment' && 'Paste your Postman Environment JSON below or load from a file.'}
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
