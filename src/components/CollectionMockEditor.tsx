import { useState, useMemo } from 'preact/hooks';
import { Play, Square, Search, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-preact';
import { collections, requests, activeTabId, unsavedItemIds, MockResponse } from '../store';
import { invoke } from '@tauri-apps/api/core';

export function CollectionMockEditor() {
    const collectionId = activeTabId.value;
    const collection = collections.value.find(c => c.id === collectionId);

    if (!collection) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Collection not found.</div>;

    const [search, setSearch] = useState('');
    const [expandedRequestIds, setExpandedRequestIds] = useState<Set<string>>(new Set());

    const collectionRequests = useMemo(() =>
        requests.value.filter(r => r.collectionId === collectionId),
        [requests.value, collectionId]
    );

    const filteredRequests = useMemo(() =>
        collectionRequests.filter(r =>
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.url.toLowerCase().includes(search.toLowerCase())
        ),
        [collectionRequests, search]
    );

    const isRunning = collection.mockConfig?.enabled || false;
    const port = collection.mockConfig?.port || 3000;

    const updateMockConfig = (updates: any) => {
        collections.value = collections.value.map(c =>
            c.id === collectionId ? { ...c, mockConfig: { ...(c.mockConfig || { port: 3000, enabled: false }), ...updates } } : c
        );
        if (collectionId) unsavedItemIds.value = new Set([...unsavedItemIds.value, collectionId]);
    };

    const updateRequestMock = (requestId: string, updates: Partial<MockResponse>) => {
        requests.value = requests.value.map(r =>
            r.id === requestId ? { ...r, mockResponse: { ...(r.mockResponse || { statusCode: 200, headers: {}, body: '', enabled: false }), ...updates } } : r
        );
        unsavedItemIds.value = new Set([...unsavedItemIds.value, requestId]);
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedRequestIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedRequestIds(next);
    };

    const handleStartStop = async () => {
        try {
            if (isRunning) {
                await invoke('stop_mock_server', { collectionId });
                updateMockConfig({ enabled: false });
            } else {
                // Prepare the requests for the backend
                const mockRequests = collectionRequests
                    .filter(r => r.mockResponse?.enabled)
                    .map(r => {
                        // Extract path from URL
                        let path = "/";
                        try {
                            const url = new URL(r.url);
                            path = url.pathname;
                        } catch {
                            path = r.url.startsWith('/') ? r.url : `/${r.url}`;
                        }

                        return {
                            method: r.method,
                            path: path,
                            response: {
                                status_code: r.mockResponse?.statusCode || 200,
                                headers: r.mockResponse?.headers || {},
                                body: r.mockResponse?.body || ''
                            }
                        };
                    });

                await invoke('start_mock_server', {
                    args: {
                        collection_id: collectionId,
                        port: port,
                        requests: mockRequests
                    }
                });
                updateMockConfig({ enabled: true });
            }
        } catch (e) {
            alert("Mock Server Error: " + e);
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%', overflowY: 'auto' }}>
            {/* Header / Config */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-md)', backgroundColor: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Mock Manager: {collection.name}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isRunning ? 'var(--success)' : 'var(--text-muted)' }} />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isRunning ? `Running on port ${port}` : 'Server Stopped'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: 'var(--spacing-lg)' }}>
                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Port:</label>
                        <input
                            type="number"
                            value={port}
                            onInput={(e) => updateMockConfig({ port: parseInt(e.currentTarget.value) || 3000 })}
                            disabled={isRunning}
                            style={{ width: '80px', padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>

                <button
                    onClick={handleStartStop}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 20px',
                        backgroundColor: isRunning ? 'var(--error)' : 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'opacity 0.2s'
                    }}
                >
                    {isRunning ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    {isRunning ? 'Stop Server' : 'Start Server'}
                </button>
            </div>

            {/* List Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search requests..."
                        value={search}
                        onInput={(e) => setSearch(e.currentTarget.value)}
                        style={{ width: '100%', padding: '8px 8px 8px 32px', backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                    />
                </div>
            </div>

            {/* Request List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--bg-sidebar)' }}>
                        {/* Summary Row */}
                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: '12px', cursor: 'pointer' }} onClick={() => toggleExpand(req.id)}>
                            <input
                                type="checkbox"
                                checked={req.mockResponse?.enabled || false}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateRequestMock(req.id, { enabled: e.currentTarget.checked })}
                            />

                            <div style={{ minWidth: '60px', fontWeight: 'bold', fontSize: '0.8rem', color: getMethodColor(req.method) }}>
                                {req.method}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.url}</div>
                            </div>

                            {expandedRequestIds.has(req.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>

                        {/* Expanded Editor */}
                        {expandedRequestIds.has(req.id) && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Code</label>
                                        <input
                                            type="number"
                                            value={req.mockResponse?.statusCode || 200}
                                            onInput={(e) => updateRequestMock(req.id, { statusCode: parseInt(e.currentTarget.value) || 200 })}
                                            style={{ width: '100px', padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Response Body</label>
                                    <textarea
                                        value={req.mockResponse?.body || ''}
                                        onInput={(e) => updateRequestMock(req.id, { body: e.currentTarget.value })}
                                        placeholder='{ "message": "hello" }'
                                        style={{ height: '100px', padding: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Response Headers</label>
                                        <button
                                            onClick={() => {
                                                const h = { ...(req.mockResponse?.headers || {}) };
                                                h['New-Header'] = '';
                                                updateRequestMock(req.id, { headers: h });
                                            }}
                                            style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Plus size={12} /> Add Header
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {Object.entries(req.mockResponse?.headers || {}).map(([key, value]) => (
                                            <div key={key} style={{ display: 'flex', gap: '4px' }}>
                                                <input
                                                    type="text"
                                                    value={key}
                                                    onInput={(e) => {
                                                        const h = { ...(req.mockResponse?.headers || {}) };
                                                        delete h[key];
                                                        h[e.currentTarget.value] = value;
                                                        updateRequestMock(req.id, { headers: h });
                                                    }}
                                                    style={{ flex: 1, padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onInput={(e) => {
                                                        const h = { ...(req.mockResponse?.headers || {}) };
                                                        h[key] = e.currentTarget.value;
                                                        updateRequestMock(req.id, { headers: h });
                                                    }}
                                                    style={{ flex: 1, padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const h = { ...(req.mockResponse?.headers || {}) };
                                                        delete h[key];
                                                        updateRequestMock(req.id, { headers: h });
                                                    }}
                                                    style={{ background: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {filteredRequests.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No requests found in this collection.
                    </div>
                )}
            </div>
        </div>
    );
}

function getMethodColor(method: string) {
    switch (method.toUpperCase()) {
        case 'GET': return 'var(--accent-primary)';
        case 'POST': return 'var(--success)';
        case 'PUT': return 'var(--warning)';
        case 'DELETE': return 'var(--error)';
        case 'PATCH': return '#8b5cf6';
        default: return 'var(--text-muted)';
    }
}
