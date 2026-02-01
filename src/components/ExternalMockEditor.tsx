import { useState, useMemo } from 'preact/hooks';
import { Play, Square, Search, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-preact';
import { externalMocks, activeTabId, saveExternalMockToDisk, ExternalMockEndpoint, activeExternalMockId } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { MethodSelect } from './MethodSelect';

export function ExternalMockEditor() {
    const mockId = activeTabId.value || activeExternalMockId.value;
    const mock = externalMocks.value.find(m => m.id === mockId);

    if (!mock) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>External Mock not found.</div>;

    const [search, setSearch] = useState('');
    const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set());

    const filteredEndpoints = useMemo(() =>
        mock.endpoints.map((ep, index) => ({ ep, index })).filter(({ ep }) =>
            ep.path.toLowerCase().includes(search.toLowerCase())
        ),
        [mock.endpoints, search]
    );

    const isRunning = mock.serverStatus === 'running';
    const port = mock.port;

    const updateMock = (updates: Partial<typeof mock>) => {
        externalMocks.value = externalMocks.value.map(m =>
            m.id === mockId ? { ...m, ...updates } : m
        );
        saveExternalMockToDisk(mockId!, false, true);
    };

    const updateEndpoint = (index: number, updates: Partial<ExternalMockEndpoint> | Partial<ExternalMockEndpoint['response']>) => {
        const newEndpoints = [...mock.endpoints];

        // Check if updates belong to response or the endpoint itself
        if ('statusCode' in updates || 'body' in updates || 'headers' in updates) {
            newEndpoints[index] = {
                ...newEndpoints[index],
                response: { ...newEndpoints[index].response, ...updates as any }
            };
        } else {
            newEndpoints[index] = { ...newEndpoints[index], ...updates };
        }

        updateMock({ endpoints: newEndpoints });
    };

    const addEndpoint = () => {
        const newEndpoints = [...mock.endpoints, {
            method: 'GET',
            path: '/new-endpoint',
            response: {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: '{\n  "message": "Hello World"\n}',
                enabled: true
            }
        }];
        updateMock({ endpoints: newEndpoints });
        // Expand the new item
        setExpandedIndexes(new Set([...expandedIndexes, newEndpoints.length - 1]));
    };

    const removeEndpoint = (index: number) => {
        if (!confirm("Remove this endpoint?")) return;
        const newEndpoints = mock.endpoints.filter((_, i) => i !== index);
        updateMock({ endpoints: newEndpoints });
    };

    const toggleExpand = (index: number) => {
        const next = new Set(expandedIndexes);
        if (next.has(index)) next.delete(index); else next.add(index);
        setExpandedIndexes(next);
    };

    const handleStartStop = async () => {
        try {
            if (isRunning) {
                await invoke('stop_mock_server', { collectionId: mockId }); // Reusing collectionId param name for ID
                updateMock({ serverStatus: 'stopped' });
            } else {
                const mockRequests = mock.endpoints.map(ep => ({
                    method: ep.method,
                    path: ep.path,
                    response: {
                        status_code: ep.response.statusCode,
                        headers: ep.response.headers,
                        body: ep.response.body
                    }
                }));

                await invoke('start_mock_server', {
                    args: {
                        collection_id: mockId, // Reusing collection_id for ID
                        port: port,
                        requests: mockRequests
                    }
                });
                updateMock({ serverStatus: 'running' });
            }
        } catch (e) {
            alert("Mock Server Error: " + e);
            updateMock({ serverStatus: 'stopped' });
        }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)', height: '100%', overflowY: 'auto' }}>
            {/* Header / Config */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--spacing-md)', backgroundColor: 'var(--bg-sidebar)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>External Mock: {mock.name}</h2>
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
                            onInput={(e) => updateMock({ port: parseInt(e.currentTarget.value) || 3000 })}
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
                        placeholder="Search endpoints..."
                        value={search}
                        onInput={(e) => setSearch(e.currentTarget.value)}
                        style={{ width: '100%', padding: '8px 8px 8px 32px', backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                    />
                </div>
                <button
                    onClick={addEndpoint}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: 'var(--bg-element)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer'
                    }}
                >
                    <Plus size={16} /> New Endpoint
                </button>
            </div>

            {/* Endpoints List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredEndpoints.map(({ ep, index }) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--bg-sidebar)' }}>
                        {/* Summary Row */}
                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: '12px', cursor: 'pointer' }} onClick={() => toggleExpand(index)}>
                            <div style={{ minWidth: '80px' }} onClick={(e) => e.stopPropagation()}>
                                <MethodSelect
                                    value={ep.method}
                                    onChange={(val) => updateEndpoint(index, { method: val })}
                                />
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={ep.path}
                                    onInput={(e) => updateEndpoint(index, { path: e.currentTarget.value })}
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {ep.response.statusCode}
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); removeEndpoint(index); }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                title="Remove Endpoint"
                            >
                                <Trash2 size={16} />
                            </button>

                            {expandedIndexes.has(index) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>

                        {/* Expanded Editor */}
                        {expandedIndexes.has(index) && (
                            <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                                <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status Code</label>
                                        <input
                                            type="number"
                                            value={ep.response.statusCode}
                                            onInput={(e) => updateEndpoint(index, { statusCode: parseInt(e.currentTarget.value) || 200 })}
                                            style={{ width: '100px', padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Response Body</label>
                                    <textarea
                                        value={ep.response.body}
                                        onInput={(e) => updateEndpoint(index, { body: e.currentTarget.value })}
                                        placeholder='{ "message": "hello" }'
                                        style={{ height: '150px', padding: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Response Headers</label>
                                        <button
                                            onClick={() => {
                                                const h = { ...ep.response.headers };
                                                h['New-Header'] = '';
                                                updateEndpoint(index, { headers: h });
                                            }}
                                            style={{ background: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Plus size={12} /> Add Header
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {Object.entries(ep.response.headers).map(([key, value]) => (
                                            <div key={key} style={{ display: 'flex', gap: '4px' }}>
                                                <input
                                                    type="text"
                                                    value={key}
                                                    onInput={(e) => {
                                                        const h = { ...ep.response.headers };
                                                        delete h[key];
                                                        h[e.currentTarget.value] = value;
                                                        updateEndpoint(index, { headers: h });
                                                    }}
                                                    style={{ flex: 1, padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={value}
                                                    onInput={(e) => {
                                                        const h = { ...ep.response.headers };
                                                        h[key] = e.currentTarget.value;
                                                        updateEndpoint(index, { headers: h });
                                                    }}
                                                    style={{ flex: 1, padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const h = { ...ep.response.headers };
                                                        delete h[key];
                                                        updateEndpoint(index, { headers: h });
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

                {filteredEndpoints.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No endpoints found. Add one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}

