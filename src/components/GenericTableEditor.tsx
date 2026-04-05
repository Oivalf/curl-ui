import { Signal } from "@preact/signals";
import { VariableInput } from "./VariableInput";
import { OverrideIndicator } from "./OverrideIndicator";
import { navigateToItem, TableRow, InheritedRow } from "../store";
import { IconButton } from "./ui/IconButton";
import { Plus, Minus, X } from "lucide-preact";
import { Card } from "./ui/Card";


interface GenericTableEditorProps {
    rows: Signal<TableRow[]>;
    onUpdate?: (newRows: TableRow[]) => void;
    inheritedRows?: InheritedRow[];
    isReadOnly?: boolean;
    showEnabledToggle?: boolean;
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    addLabel?: string;
    inheritedLabel?: string;
}

export function GenericTableEditor({
    rows,
    onUpdate,
    inheritedRows,
    isReadOnly,
    showEnabledToggle = false,
    overriddenKeys,
    parentKeys,
    parentId,
    keyPlaceholder = "Key",
    valuePlaceholder = "Value",
    addLabel = "Add Item",
    inheritedLabel = "Inherited Items"
}: GenericTableEditorProps) {
    
    const handleAddRow = () => {
        const newRow: TableRow = { key: '', values: [''], enabled: boolean };
        if (showEnabledToggle) newRow.enabled = true;
        const next = [...rows.value, newRow];
        rows.value = next;
        onUpdate?.(next);
    };

    const handleUpdateRow = (index: number, updates: Partial<TableRow>) => {
        const next = [...rows.value];
        next[index] = { ...next[index], ...updates };
        rows.value = next;
        onUpdate?.(next);
    };

    const handleDeleteRow = (index: number) => {
        const next = rows.value.filter((_, i) => i !== index);
        rows.value = next;
        onUpdate?.(next);
    };

    const handleAddValue = (rowIndex: number) => {
        const next = [...rows.value];
        next[rowIndex].values = [...next[rowIndex].values, ''];
        rows.value = next;
        onUpdate?.(next);
    };

    const handleUpdateValue = (rowIndex: number, valIndex: number, newVal: string) => {
        const next = [...rows.value];
        next[rowIndex] = { ...next[rowIndex] };
        const nextValues = [...next[rowIndex].values];
        nextValues[valIndex] = newVal;
        next[rowIndex].values = nextValues;
        rows.value = next;
        onUpdate?.(next);
    };

    const handleDeleteValue = (rowIndex: number, valIndex: number) => {
        const next = [...rows.value];
        next[rowIndex] = { ...next[rowIndex] };
        next[rowIndex].values = next[rowIndex].values.filter((_, i) => i !== valIndex);
        rows.value = next;
        onUpdate?.(next);
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Header Labels */}
            <div style={{ display: 'flex', gap: '8px', padding: '0 4px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {showEnabledToggle && <div style={{ width: '24px' }}></div>}
                <div style={{ width: '150px' }}>{keyPlaceholder}</div>
                <div style={{ flex: 1 }}>{valuePlaceholder}</div>
                {!isReadOnly && <div style={{ width: '24px' }}></div>}
            </div>

            {/* List of Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {rows.value.map((row, i) => {
                    const isKeyInherited = parentKeys?.has(row.key);
                    const canEditKey = !isReadOnly && !isKeyInherited;

                    return (
                        <div key={i} style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            alignItems: 'flex-start', 
                            paddingBottom: '8px', 
                            borderBottom: '1px solid var(--border-color)',
                            opacity: row.enabled === false ? 0.6 : 1
                        }}>
                            {/* Toggle */}
                            {showEnabledToggle && (
                                <div style={{ width: '24px', marginTop: '6px', display: 'flex', justifyContent: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={row.enabled ?? true}
                                        disabled={isReadOnly}
                                        onChange={(e) => handleUpdateRow(i, { enabled: e.currentTarget.checked })}
                                        style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                                    />
                                </div>
                            )}

                            {/* Key Input */}
                            <div style={{ width: '150px', marginTop: '4px' }}>
                                <input
                                    placeholder={keyPlaceholder}
                                    value={row.key}
                                    readOnly={!canEditKey}
                                    onInput={(e) => handleUpdateRow(i, { key: e.currentTarget.value })}
                                    style={{
                                        width: '100%',
                                        background: canEditKey ? 'var(--bg-input)' : 'transparent',
                                        color: 'var(--text-primary)',
                                        border: canEditKey ? '1px solid var(--border-color)' : '1px solid transparent',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '5px 8px',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Values List */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {row.values.map((val, valIdx) => (
                                    <div key={valIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        {overriddenKeys?.has(row.key) && valIdx === 0 && <OverrideIndicator />}
                                        <VariableInput
                                            placeholder={valuePlaceholder}
                                            value={val}
                                            onInput={(newVal) => handleUpdateValue(i, valIdx, newVal)}
                                            style={{ flex: 1 }}
                                            readOnly={isReadOnly}
                                            parentId={parentId}
                                        />
                                        {!isReadOnly && (
                                            <IconButton 
                                                icon={<Minus size={12} />} 
                                                size={12} 
                                                onClick={() => handleDeleteValue(i, valIdx)}
                                                variant="ghost"
                                            />
                                        )}
                                    </div>
                                ))}
                                {!isReadOnly && (
                                    <button
                                        onClick={() => handleAddValue(i)}
                                        style={{ alignSelf: 'flex-start', color: 'var(--accent-primary)', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                    >
                                        + Add Value
                                    </button>
                                )}
                            </div>

                            {/* Delete Row Button */}
                            {!isReadOnly && !isKeyInherited && (
                                <IconButton 
                                    icon={<X size={16} />} 
                                    onClick={() => handleDeleteRow(i)} 
                                    variant="error" 
                                    style={{ alignSelf: 'center' }} 
                                />
                            )}
                            {/* Placeholder for alignment */}
                            {!isReadOnly && isKeyInherited && <div style={{ width: '24px' }}></div>}
                        </div>
                    );
                })}
            </div>

            {/* Add Button */}
            {!isReadOnly && (
                <button
                    onClick={handleAddRow}
                    style={{ 
                        alignSelf: 'flex-start', 
                        color: 'var(--accent-primary)', 
                        fontSize: '0.85rem', 
                        marginTop: '4px', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    <Plus size={14} /> {addLabel}
                </button>
            )}

            {/* Inherited Items Section */}
            {inheritedRows && inheritedRows.length > 0 && (
                <Card variant="dashed" title={inheritedLabel} style={{ marginTop: '16px' }} padding="12px">
                    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: '12px', fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>{keyPlaceholder}</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>{valuePlaceholder}</div>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Source</div>

                        {inheritedRows.map((h, idx) => (
                            <div key={idx} style={{ display: 'contents' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.key}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                                    {h.values.map((v, vIdx) => (
                                        <div key={vIdx} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v}>{v}</div>
                                    ))}
                                </div>
                                <div
                                    style={{
                                        color: h.sourceId ? 'var(--accent-primary)' : 'var(--text-muted)',
                                        fontStyle: 'italic',
                                        cursor: h.sourceId ? 'pointer' : 'default',
                                        textDecoration: h.sourceId ? 'underline' : 'none',
                                        fontSize: '0.75rem',
                                        alignSelf: 'center'
                                    }}
                                    onClick={() => h.sourceId && navigateToItem(h.sourceId)}
                                    title={h.sourceId ? "Go to source" : ""}
                                >
                                    {h.source}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
