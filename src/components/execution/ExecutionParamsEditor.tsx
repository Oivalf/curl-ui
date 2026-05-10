import { Signal } from "@preact/signals";
import { GenericTableEditor } from "../GenericTableEditor";
import { TableRow } from "../../store";
import { VariableInput } from "../VariableInput";

interface ExecutionParamsEditorProps {
    queryParams: Signal<TableRow[]>;
    pathParams: Signal<Record<string, string>>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: TableRow[]) => void;
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function ExecutionParamsEditor({ queryParams, pathParams, detectedPathKeys, updateUrlFromParams, isReadOnly, overriddenKeys, parentKeys, parentId }: ExecutionParamsEditorProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Path Params Section */}
            {detectedPathKeys.value.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Path Variables</div>
                    {detectedPathKeys.value.map(key => (
                        <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ width: '120px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>{`{${key}}`}</div>
                            <VariableInput
                                placeholder="Value"
                                value={pathParams.value[key] || ''}
                                onInput={(val) => {
                                    pathParams.value = { ...pathParams.value, [key]: val };
                                }}
                                style={{ flex: 1 }}
                                parentId={parentId}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Query Params Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Query Parameters</div>
                <GenericTableEditor
                    rows={queryParams}
                    onUpdate={updateUrlFromParams}
                    isReadOnly={isReadOnly}
                    showEnabledToggle={true}
                    overriddenKeys={overriddenKeys}
                    parentKeys={parentKeys}
                    parentId={parentId}
                    keyPlaceholder="Param Key"
                    valuePlaceholder="Param Value"
                    addLabel="Add Param Override"
                />
            </div>
        </div>
    );
}

