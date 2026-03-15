import { Signal } from "@preact/signals";
import { FolderOpen } from 'lucide-preact';
import { open } from '@tauri-apps/plugin-dialog';
import { OverrideIndicator } from "../OverrideIndicator";
import { VariableInput } from "../VariableInput";
import { CodeEditor } from "../CodeEditor";

interface RequestBodyEditorProps {
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
    formData: Signal<{ key: string, type: 'text' | 'file', values: string[], contentTypes?: string[] }[]>;
    isReadOnly?: boolean;
    isOverridden?: boolean;
    isTypeReadOnly?: boolean;
    parentId?: string | null;
}

const getMimeType = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'json': return 'application/json';
        case 'xml': return 'application/xml';
        case 'html': return 'text/html';
        case 'txt': return 'text/plain';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'pdf': return 'application/pdf';
        case 'js': return 'application/javascript';
        case 'yaml':
        case 'yml': return 'application/x-yaml';
        case 'zip': return 'application/zip';
        default: return 'application/octet-stream';
    }
};

export function RequestBodyEditor({ bodyType, body, formData, isReadOnly, isOverridden, isTypeReadOnly, parentId }: RequestBodyEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, minWidth: 0, height: '100%' }}>
            <select
                value={bodyType.value}
                onChange={(e) => bodyType.value = e.currentTarget.value as any}
                disabled={isReadOnly || isTypeReadOnly}
                style={{
                    width: '100%',
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
                                        const newType = e.currentTarget.value as any;
                                        newData[i].type = newType;
                                        if (newType === 'file' && !newData[i].contentTypes) {
                                            newData[i].contentTypes = newData[i].values.map(v => getMimeType(v));
                                        }
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
                                        {/* Value Input and Content-Type */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <VariableInput
                                                    value={val}
                                                    onInput={(newVal) => {
                                                        const newData = [...formData.value];
                                                        newData[i].values[valIdx] = newVal;
                                                        if (row.type === 'file') {
                                                            if (!newData[i].contentTypes) newData[i].contentTypes = [];
                                                            newData[i].contentTypes[valIdx] = getMimeType(newVal);
                                                        }
                                                        formData.value = newData;
                                                    }}
                                                    placeholder={row.type === 'file' ? "File path..." : "Value"}
                                                    style={{ flex: 1 }}
                                                    readOnly={isReadOnly}
                                                    parentId={parentId}
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
                                                                    if (!newData[i].contentTypes) newData[i].contentTypes = [];
                                                                    newData[i].contentTypes[valIdx] = getMimeType(selected);
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
                                            {row.type === 'file' && (
                                                <input
                                                    placeholder="Content-Type"
                                                    value={row.contentTypes?.[valIdx] || ''}
                                                    readOnly={isReadOnly}
                                                    onInput={(e) => {
                                                        const newData = [...formData.value];
                                                        if (!newData[i].contentTypes) newData[i].contentTypes = [];
                                                        newData[i].contentTypes[valIdx] = e.currentTarget.value;
                                                        formData.value = newData;
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        fontSize: '0.75rem',
                                                        padding: '4px 8px',
                                                        backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-input)',
                                                        border: isReadOnly ? '1px solid transparent' : '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--text-muted)'
                                                    }}
                                                />
                                            )}
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => {
                                                    const newData = [...formData.value];
                                                    newData[i].values = newData[i].values.filter((_, vIdx) => vIdx !== valIdx);
                                                    if (newData[i].contentTypes) {
                                                        newData[i].contentTypes = newData[i].contentTypes.filter((_, vIdx) => vIdx !== valIdx);
                                                    }
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
                            onClick={() => formData.value = [...formData.value, { key: '', type: 'text', values: [''], contentTypes: [''] }]}
                            style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.9rem', marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                            + Add Field
                        </button>
                    )}
                </div>
            ) : (
                bodyType.value !== 'none' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minHeight: 0, minWidth: 0 }}>
                        {isOverridden && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
                                <OverrideIndicator />
                                <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>Body overridden</span>
                            </div>
                        )}
                        {(bodyType.value === 'json' || bodyType.value === 'yaml' || bodyType.value === 'html' || bodyType.value === 'xml') ? (
                            <CodeEditor
                                value={body.value}
                                onChange={(val) => body.value = val}
                                language={bodyType.value}
                                readOnly={isReadOnly}
                                height="300px"
                                parentId={parentId}
                            />
                        ) : (
                            <VariableInput
                                value={body.value}
                                onInput={(val) => body.value = val}
                                multiline={true}
                                style={{
                                    flex: 1,
                                    width: '100%',
                                }}
                                placeholder={`Enter ${bodyType.value.toUpperCase()} body...`}
                                readOnly={isReadOnly}
                                parentId={parentId}
                            />
                        )}
                    </div>
                )
            )}

            {bodyType.value === 'none' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    This request has no body
                </div>
            )}
        </div>
    );
}
