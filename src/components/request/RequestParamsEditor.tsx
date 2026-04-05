import { Signal } from "@preact/signals";
import { GenericTableEditor } from "../GenericTableEditor";
import { TableRow, InheritedRow } from "../../store";

interface RequestParamsEditorProps {
    queryParams: Signal<TableRow[]>;
    pathParams?: Signal<Record<string, string>>;
    detectedPathKeys?: Signal<string[]>;
    onUpdateParams: (newParams: TableRow[]) => void;
    inheritedParams?: InheritedRow[];
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function RequestParamsEditor({
    queryParams,
    onUpdateParams,
    inheritedParams = [],
    overriddenKeys = new Set(),
    parentKeys = new Set(),
    parentId
}: RequestParamsEditorProps) {
    return (
        <GenericTableEditor
            rows={queryParams}
            onUpdate={onUpdateParams}
            inheritedRows={inheritedParams}
            overriddenKeys={overriddenKeys}
            parentKeys={parentKeys}
            parentId={parentId}
            keyPlaceholder="Param Key"
            valuePlaceholder="Param Value"
            addLabel="Add Query Param"
            inheritedLabel="Inherited Query Params"
        />
    );
}
