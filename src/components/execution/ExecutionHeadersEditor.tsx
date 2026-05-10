import { Signal } from "@preact/signals";
import { GenericTableEditor } from "../GenericTableEditor";
import { TableRow, InheritedRow } from "../../store";

interface ExecutionHeadersEditorProps {
    headers: Signal<TableRow[]>;
    inheritedHeaders?: InheritedRow[];
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function ExecutionHeadersEditor({ headers, inheritedHeaders, isReadOnly, overriddenKeys, parentKeys, parentId }: ExecutionHeadersEditorProps) {
    return (
        <GenericTableEditor
            rows={headers}
            inheritedRows={inheritedHeaders}
            isReadOnly={isReadOnly}
            showEnabledToggle={true}
            overriddenKeys={overriddenKeys}
            parentKeys={parentKeys}
            parentId={parentId}
            keyPlaceholder="Header Key"
            valuePlaceholder="Header Value"
            addLabel="Add Header Override"
            inheritedLabel="Inherited Headers"
        />
    );
}

