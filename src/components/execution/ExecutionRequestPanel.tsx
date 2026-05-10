import { Signal } from "@preact/signals";
import { RequestPropertyTabs } from "../request/RequestPropertyTabs";
import { AuthConfig, ScriptItem, TableRow, InheritedRow } from "../../store";
import { t } from "../../i18n";

interface ExecutionRequestPanelProps {
    id: string;
    headers: Signal<TableRow[]>;
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
    auth: Signal<AuthConfig | undefined>;
    queryParams: Signal<TableRow[]>;
    pathParams: Signal<Record<string, string>>;
    formData: Signal<{ key: string, type: 'text' | 'file', values: string[], enabled: boolean, contentTypes?: string[] }[]>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: TableRow[]) => void;
    inheritedAuth?: { config: AuthConfig, source: string, sourceId?: string };
    inheritedHeaders?: InheritedRow[];
    preScripts: Signal<ScriptItem[]>;
    postScripts: Signal<ScriptItem[]>;
    isReadOnly?: boolean;
    overriddenHeaders?: Set<string>;
    overriddenQueryParams?: Set<string>;
    parentHeaderKeys?: Set<string>;
    parentQueryParamKeys?: Set<string>;
    isBodyOverridden?: boolean;
    isAuthOverridden?: boolean;
}

export function ExecutionRequestPanel(props: ExecutionRequestPanelProps) {
    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('executionEditor.executionOverrides')}</span>
            </div>
            <RequestPropertyTabs {...props} onUpdateParams={props.updateUrlFromParams} parentId={props.id} />
        </div>
    );
}
