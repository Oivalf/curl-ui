import { Signal } from "@preact/signals";
import { RequestParamsEditor } from "./RequestParamsEditor";
import { RequestBodyEditor } from "./RequestBodyEditor";
import { RequestHeadersEditor } from "./RequestHeadersEditor";
import { ScriptListEditor } from "./ScriptListEditor";
import { AuthEditor } from "../AuthEditor";
import { Tabs } from "../ui/Tabs";
import { itemRequestTabStates, itemScriptTabStates, AuthConfig, ScriptItem, TableRow, InheritedRow } from "../../store";
import { t } from "../../i18n";

interface RequestPropertyTabsProps {
    id: string;
    headers: Signal<TableRow[]>;
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
    auth: Signal<AuthConfig | undefined>;
    queryParams: Signal<TableRow[]>;
    pathParams: Signal<Record<string, string>>;
    formData: Signal<{ key: string, type: 'text' | 'file', values: string[], enabled: boolean, contentTypes?: string[] }[]>;
    detectedPathKeys: Signal<string[]>;
    onUpdateParams: (newParams: TableRow[]) => void;
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
    parentId?: string | null;
}

export function RequestPropertyTabs(props: RequestPropertyTabsProps) {
    const { id } = props;
    const activeTab = itemRequestTabStates.value[id] || 'params';
    const activeScriptTab = itemScriptTabStates.value[id] || 'pre';

    const tabs = [
        { id: 'params', label: t('requestEditor.tabs.params') },
        { id: 'body', label: t('requestEditor.tabs.body') },
        { id: 'headers', label: t('requestEditor.tabs.headers'), badge: props.headers.value.filter(h => h.key).length || undefined },
        { id: 'auth', label: t('requestEditor.tabs.auth') },
        { id: 'scripts', label: t('requestEditor.tabs.scripts'), badge: (props.preScripts.value.length + props.postScripts.value.length) || undefined },
    ];

    const handleTabChange = (tabId: string) => {
        itemRequestTabStates.value = { ...itemRequestTabStates.value, [id]: tabId };
    };

    const handleScriptTabChange = (tabId: string) => {
        itemScriptTabStates.value = { ...itemScriptTabStates.value, [id]: tabId };
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, minHeight: 0 }}>
            <Tabs items={tabs} activeId={activeTab} onChange={handleTabChange} />

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '8px' }}>
                {activeTab === 'params' && (
                    <RequestParamsEditor
                        queryParams={props.queryParams}
                        pathParams={props.pathParams}
                        detectedPathKeys={props.detectedPathKeys}
                        onUpdateParams={props.onUpdateParams}
                        isReadOnly={props.isReadOnly}
                        overriddenKeys={props.overriddenQueryParams}
                        parentKeys={props.parentQueryParamKeys}
                        parentId={props.parentId}
                    />
                )}
                {activeTab === 'body' && (
                    <RequestBodyEditor
                        bodyType={props.bodyType}
                        body={props.body}
                        formData={props.formData}
                        isReadOnly={props.isReadOnly}
                        isOverridden={props.isBodyOverridden}
                        isTypeReadOnly={false}
                        parentId={props.parentId}
                    />
                )}
                {activeTab === 'headers' && (
                    <RequestHeadersEditor
                        headers={props.headers}
                        inheritedHeaders={props.inheritedHeaders}
                        isReadOnly={props.isReadOnly}
                        overriddenKeys={props.overriddenHeaders}
                        parentKeys={props.parentHeaderKeys}
                        parentId={props.parentId}
                    />
                )}

                {activeTab === 'auth' && (
                    <AuthEditor
                        auth={props.auth}
                        onChange={(v) => props.auth.value = v}
                        inheritedAuth={props.inheritedAuth}
                        isOverridden={props.isAuthOverridden}
                        parentId={props.parentId}
                    />
                )}
                {activeTab === 'scripts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
                        <Tabs
                            variant="pills"
                            items={[
                                { id: 'pre', label: t('requestEditor.tabs.preRequest') },
                                { id: 'post', label: t('requestEditor.tabs.postRequest') }
                            ]}
                            activeId={activeScriptTab}
                            onChange={handleScriptTabChange}
                        />
                        <div style={{ flex: 1 }}>
                            {activeScriptTab === 'pre' && (
                                <ScriptListEditor scripts={props.preScripts} title={t('requestEditor.tabs.preRequest') + " Scripts"} parentId={props.parentId} />
                            )}
                            {activeScriptTab === 'post' && (
                                <ScriptListEditor scripts={props.postScripts} title={t('requestEditor.tabs.postRequest') + " Scripts"} showStatusFilter={true} parentId={props.parentId} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
