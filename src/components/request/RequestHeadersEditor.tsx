import { Signal } from "@preact/signals";
import { GenericTableEditor } from "../GenericTableEditor";
import { TableRow, InheritedRow } from "../../store";

interface RequestHeadersEditorProps {
    headers: Signal<TableRow[]>;
    inheritedHeaders?: InheritedRow[];
    isReadOnly?: boolean;
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function RequestHeadersEditor({ headers, inheritedHeaders, isReadOnly, overriddenKeys, parentKeys, parentId }: RequestHeadersEditorProps) {
    return (
        <GenericTableEditor
            rows={headers}
            inheritedRows={inheritedHeaders}
            isReadOnly={isReadOnly}
            overriddenKeys={overriddenKeys}
            parentKeys={parentKeys}
            parentId={parentId}
            keyPlaceholder="Header Key"
            valuePlaceholder="Header Value"
            addLabel="Add Header"
            inheritedLabel="Inherited Headers"
        />
    );
}


