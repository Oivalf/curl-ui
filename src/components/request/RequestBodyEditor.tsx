import { Signal } from "@preact/signals";
import { FolderOpen } from 'lucide-preact';
import { open } from '@tauri-apps/plugin-dialog';
import { OverrideIndicator } from "../OverrideIndicator";

interface RequestBodyEditorProps {
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
    formData: Signal<{ key: string, type: 'text' | 'file', values: string[] }[]>;
    isReadOnly?: boolean;
    isOverridden?: boolean;
}

export function RequestBodyEditor({ bodyType, body, formData, isReadOnly, isOverridden }: RequestBodyEditorProps) {
    return (
        <>
            <select
                value={bodyType.value}
                onChange={(e) => bodyType.value = e.currentTarget.value as any}
                disabled={isReadOnly}
                style={{
                    width: '100%',
                    marginBottom: '4px',
                    backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-input)',
                    border: isReadOnly ? '1px solid transparent' : '1px solid var(--border-color)',
                    cursor: isReadOnly ? 'default' : 'pointer'
                }}
            >
                <option value="none">None</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
                <option value="html">HTML</option>
                <option value="form_urlencoded">Form UrlEncoded</option>
                <option value="multipart">Multipart Form</option>
                <option value="text">Text</option>
                <option value="javascript">Javascript</option>
                <option value="yaml">YAML</option>
            </select>

            {bodyType.value === 'multipart' || bodyType.value === 'form_urlencoded' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', padding: '0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ width: '150px' }}>Key</div>
                        <div style={{ width: '80px' }}>Type</div>
                        <div style={{ flex: 1 }}>Values</div>
                        <div style={{ width: '24px' }}></div>
                    </div>
                    {formData.value.map((row, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                            {/* Key Column */}
                            <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input
                                    placeholder="Key"
                                    value={row.key}
                                    readOnly={isReadOnly}
                                    onInput={(e) => {
                                        if (isReadOnly) return;
                                        const newData = [...formData.value];
                                        newData[i].key = e.currentTarget.value;
                                        formData.value = newData;
                                    }}
                                    style={{
                                        backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                        border: isReadOnly ? '1px solid transparent' : '1px solid var(--border-color)',
                                        cursor: isReadOnly ? 'default' : 'text'
                                    }}
                                />
                            </div>

                            {/* Type Selector Column */}
                            <div style={{ width: '80px' }}>
                                <select
                                    value={row.type}
                                    disabled={isReadOnly}
                                    onChange={(e) => {
                                        const newData = [...formData.value];
                                        newData[i].type = e.currentTarget.value as any;
                                        formData.value = newData;
                                    }}
                                    style={{
                                        width: '100%',
                                        backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                        border: isReadOnly ? '1px solid transparent' : '1px solid var(--border-color)',
                                        cursor: isReadOnly ? 'default' : 'pointer',
                                        appearance: isReadOnly ? 'none' : 'auto'
                                    }}
                                >
                                    <option value="text">Text</option>
                                    <option value="file">File</option>
                                </select>
                            </div>

                            {/* Values Column */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {row.values.map((val, valIdx) => (
                                    <div key={valIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        {isOverridden && <OverrideIndicator />}
                                        {/* Value Input */}
                                        <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                                            <input
                                                placeholder={row.type === 'file' ? "File path..." : "Value"}
                                                value={val}
                                                onInput={(e) => {
                                                    const newData = [...formData.value];
                                                    newData[i].values[valIdx] = e.currentTarget.value;
                                                    formData.value = newData;
                                                }}
                                                style={{ flex: 1 }}
                                            />
                                            {row.type === 'file' && (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const selected = await open({
                                                                multiple: false,
                                                                directory: false
                                                            });
                                                            if (selected && typeof selected === 'string') {
                                                                const newData = [...formData.value];
                                                                newData[i].values[valIdx] = selected;
                                                                formData.value = newData;
                                                            }
                                                        } catch (err) {
                                                            console.error('Failed to open dialog', err);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '0 8px',
                                                        backgroundColor: 'var(--bg-input)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-secondary)'
                                                    }}
                                                    title="Choose File"
                                                >
                                                    <FolderOpen size={14} />
                                                </button>
                                            )}
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => {
                                                    const newData = [...formData.value];
                                                    newData[i].values = newData[i].values.filter((_, vIdx) => vIdx !== valIdx);
                                                    formData.value = newData;
                                                }}
                                                style={{ color: 'var(--text-muted)', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                -
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {!isReadOnly && (
                                    <button
                                        onClick={() => {
                                            const newData = [...formData.value];
                                            newData[i].values.push('');
                                            formData.value = newData;
                                        }}
                                        style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        +
                                    </button>
                                )}
                            </div>

                            {/* Remove Group Button */}
                            {!isReadOnly && (
                                <button onClick={() => {
                                    const newData = formData.value.filter((_, idx) => idx !== i);
                                    formData.value = newData;
                                }} style={{ color: 'var(--error)', alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                            )}
                        </div>
                    ))}
                    {!isReadOnly && (
                        <button
                            onClick={() => formData.value = [...formData.value, { key: '', type: 'text', values: [''] }]}
                            style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            + Add Field
                        </button>
                    )}
                </div>
            ) : (
                bodyType.value !== 'none' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {isOverridden && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
                                <OverrideIndicator />
                                <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>Body overridden</span>
                            </div>
                        )}
                        <textarea
                            value={body.value}
                            onInput={(e) => body.value = e.currentTarget.value}
                            style={{
                                flex: 1,
                                width: '100%',
                                resize: 'none',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                padding: '8px',
                                fontFamily: 'var(--font-mono)'
                            }}
                            placeholder={`Enter ${bodyType.value.toUpperCase()} body...`}
                        />
                    </div>
                )
            )}

            {bodyType.value === 'none' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    This request has no body
                </div>
            )}
        </>
    );
}
