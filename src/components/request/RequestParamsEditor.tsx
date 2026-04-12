import { Signal } from "@preact/signals";
import { GenericTableEditor } from "../GenericTableEditor";
import { TableRow, InheritedRow } from "../../store";
import { t } from "../../i18n";

interface RequestParamsEditorProps {
    queryParams: Signal<TableRow[]>;
    pathParams?: Signal<Record<string, string>>;
    detectedPathKeys?: Signal<string[]>;
    onUpdateParams: (newParams: TableRow[]) => void;
    isReadOnly?: boolean;
    inheritedParams?: InheritedRow[];
    overriddenKeys?: Set<string>;
    parentKeys?: Set<string>;
    parentId?: string | null;
}

export function RequestParamsEditor({
    queryParams,
    onUpdateParams,
    isReadOnly,
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
            isReadOnly={isReadOnly}
            overriddenKeys={overriddenKeys}
            parentKeys={parentKeys}
            parentId={parentId}
            keyPlaceholder={t('requestEditor.params.keyPlaceholder')}
            valuePlaceholder={t('requestEditor.params.valuePlaceholder')}
            addLabel={t('requestEditor.params.addQueryParam')}
            inheritedLabel={t('requestEditor.params.inheritedQueryParams')}
        />
    );
}
