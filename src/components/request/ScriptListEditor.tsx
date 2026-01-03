import { Signal, useSignal } from "@preact/signals";
import { Plus, Trash2, CheckSquare, Square, ChevronRight, ChevronDown, ArrowUp, ArrowDown } from 'lucide-preact';
import { ScriptItem } from "../../store";

interface ScriptListEditorProps {
    scripts: Signal<ScriptItem[]>;
    title: string;
    showStatusFilter?: boolean;
}

export function ScriptListEditor({ scripts, title, showStatusFilter = false }: ScriptListEditorProps) {
    const expandedScriptId = useSignal<string | null>(null);

    const addScript = () => {
        const newScript: ScriptItem = {
            id: crypto.randomUUID(),
            name: "New Script",
            content: "console.log('Script');",
            enabled: true,
            executeOnStatusCodes: ""
        };
        scripts.value = [...scripts.value, newScript];
        expandedScriptId.value = newScript.id;
    };

    const deleteScript = (id: string) => {
        scripts.value = scripts.value.filter(s => s.id !== id);
        if (expandedScriptId.value === id) expandedScriptId.value = null;
    };

    const toggleScript = (id: string) => {
        scripts.value = scripts.value.map(s =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
        );
    };

    const updateScript = (id: string, updates: Partial<ScriptItem>) => {
        scripts.value = scripts.value.map(s =>
            s.id === id ? { ...s, ...updates } : s
        );
    };

    const moveScript = (index: number, direction: 'up' | 'down') => {
        const newScripts = [...scripts.value];
        if (direction === 'up') {
            if (index === 0) return;
            [newScripts[index - 1], newScripts[index]] = [newScripts[index], newScripts[index - 1]];
        } else {
            if (index === newScripts.length - 1) return;
            [newScripts[index], newScripts[index + 1]] = [newScripts[index + 1], newScripts[index]];
        }
        scripts.value = newScripts;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{title}</span>
                <button
                    onClick={addScript}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'none', border: 'none', color: 'var(--accent-primary)',
                        cursor: 'pointer', fontSize: '0.8rem'
                    }}
                >
                    <Plus size={14} /> Add Script
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {scripts.value.length === 0 && (
                    <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '8px' }}>
                        No scripts defined.
                    </div>
                )}
                {scripts.value.map((script, index) => (
                    <div key={script.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', padding: '4px 8px', gap: '8px' }}>
                            <div onClick={() => expandedScriptId.value = expandedScriptId.value === script.id ? null : script.id} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                {expandedScriptId.value === script.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>

                            <div onClick={() => toggleScript(script.id)} style={{ cursor: 'pointer', color: script.enabled ? 'var(--accent-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                {script.enabled ? <CheckSquare size={16} /> : <Square size={16} />}
                            </div>

                            <input
                                value={script.name}
                                onInput={(e) => updateScript(script.id, { name: e.currentTarget.value })}
                                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.9rem' }}
                            />

                            {/* Reorder Buttons */}
                            <div style={{ display: 'flex', gap: '2px' }}>
                                <button
                                    disabled={index === 0}
                                    onClick={() => moveScript(index, 'up')}
                                    style={{ background: 'none', border: 'none', color: index === 0 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, padding: '2px' }}
                                >
                                    <ArrowUp size={14} />
                                </button>
                                <button
                                    disabled={index === scripts.value.length - 1}
                                    onClick={() => moveScript(index, 'down')}
                                    style={{ background: 'none', border: 'none', color: index === scripts.value.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: index === scripts.value.length - 1 ? 'default' : 'pointer', opacity: index === scripts.value.length - 1 ? 0.3 : 1, padding: '2px' }}
                                >
                                    <ArrowDown size={14} />
                                </button>
                            </div>

                            <button onClick={() => deleteScript(script.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}>
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Editor */}
                        {expandedScriptId.value === script.id && (
                            <div style={{ padding: '8px', borderTop: '1px solid var(--border-color)', height: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {showStatusFilter && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                                        <label style={{ color: 'var(--text-muted)' }}>Run on Status:</label>
                                        <input
                                            value={script.executeOnStatusCodes || ''}
                                            onInput={(e) => updateScript(script.id, { executeOnStatusCodes: e.currentTarget.value })}
                                            placeholder="e.g. 200, 201, 2xx, 4xx (Empty = Always)"
                                            style={{
                                                flex: 1,
                                                padding: '4px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-input)',
                                                color: 'var(--text-primary)',
                                                fontFamily: 'var(--font-mono)'
                                            }}
                                        />
                                    </div>
                                )}
                                <textarea
                                    value={script.content}
                                    onInput={(e) => updateScript(script.id, { content: e.currentTarget.value })}
                                    style={{
                                        flex: 1,
                                        resize: 'none',
                                        fontFamily: 'var(--font-mono)',
                                        padding: '8px',
                                        backgroundColor: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}
                                    placeholder="// Enter script here..."
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
