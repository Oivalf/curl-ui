import { Signal } from "@preact/signals";
import { ExecutionParamsEditor } from "./ExecutionParamsEditor";
import { RequestBodyEditor } from "../request/RequestBodyEditor";
import { ExecutionHeadersEditor } from "./ExecutionHeadersEditor";
import { ScriptListEditor } from "../request/ScriptListEditor";
import { AuthEditor } from "../AuthEditor";
import { itemRequestTabStates, itemScriptTabStates, AuthConfig, ScriptItem } from "../../store";

interface ExecutionRequestPanelProps {
    id: string;
    headers: Signal<{ key: string, values: string[], enabled: boolean }[]>;
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
    auth: Signal<AuthConfig | undefined>;
    queryParams: Signal<{ key: string, values: string[], enabled: boolean }[]>;
    pathParams: Signal<Record<string, string>>;
    formData: Signal<{ key: string, type: 'text' | 'file', values: string[] }[]>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: { key: string, values: string[], enabled: boolean }[]) => void;
    inheritedAuth?: { config: AuthConfig, source: string, sourceId?: string };
    inheritedHeaders?: { key: string, values: string[], source: string, sourceId?: string }[];
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

export function ExecutionRequestPanel({
    id,
    headers,
    bodyType,
    body,
    auth,
    queryParams,
    pathParams,
    formData,
    detectedPathKeys,
    updateUrlFromParams,
    inheritedAuth,
    inheritedHeaders,
    preScripts,
    postScripts,
    isReadOnly,
    overriddenHeaders,
    overriddenQueryParams,
    parentHeaderKeys,
    parentQueryParamKeys,
    isBodyOverridden,
    isAuthOverridden,
}: ExecutionRequestPanelProps) {
    const activeRequestTab = itemRequestTabStates.value[id] || 'params';
    const activeScriptTab = itemScriptTabStates.value[id] || 'pre';

    const setActiveRequestTab = (tab: string) => {
        itemRequestTabStates.value = { ...itemRequestTabStates.value, [id]: tab };
    };

    const setActiveScriptTab = (tab: string) => {
        itemScriptTabStates.value = { ...itemScriptTabStates.value, [id]: tab };
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>REQUEST</span>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab === 'params' ? 1 : 0.5, borderBottom: activeRequestTab === 'params' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => setActiveRequestTab('params')}>Params</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab === 'body' ? 1 : 0.5, borderBottom: activeRequestTab === 'body' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => setActiveRequestTab('body')}>Body</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab === 'headers' ? 1 : 0.5, borderBottom: activeRequestTab === 'headers' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => setActiveRequestTab('headers')}>Headers</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab === 'auth' ? 1 : 0.5, borderBottom: activeRequestTab === 'auth' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => setActiveRequestTab('auth')}>Auth</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab === 'scripts' ? 1 : 0.5, borderBottom: activeRequestTab === 'scripts' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => setActiveRequestTab('scripts')}>Scripts</h3>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, height: '100%' }}>
                    {activeRequestTab === 'params' && (
                        <ExecutionParamsEditor
                            queryParams={queryParams}
                            pathParams={pathParams}
                            detectedPathKeys={detectedPathKeys}
                            updateUrlFromParams={updateUrlFromParams}
                            isReadOnly={isReadOnly}
                            overriddenKeys={overriddenQueryParams}
                            parentKeys={parentQueryParamKeys}
                            parentId={id}
                        />
                    )}
                    {activeRequestTab === 'body' && (
                        <RequestBodyEditor
                            bodyType={bodyType}
                            body={body}
                            formData={formData}
                            isReadOnly={isReadOnly}
                            isOverridden={isBodyOverridden}
                            parentId={id}
                        />
                    )}
                    {activeRequestTab === 'headers' && (
                        <ExecutionHeadersEditor
                            headers={headers}
                            inheritedHeaders={inheritedHeaders}
                            isReadOnly={isReadOnly}
                            overriddenKeys={overriddenHeaders}
                            parentKeys={parentHeaderKeys}
                            parentId={id}
                        />
                    )}
                    {activeRequestTab === 'auth' && (
                        <AuthEditor
                            auth={auth}
                            onChange={(v) => auth.value = v}
                            inheritedAuth={inheritedAuth}
                            isOverridden={isAuthOverridden}
                        />
                    )}
                    {activeRequestTab === 'scripts' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                <h4 style={{ margin: 0, fontSize: '0.8rem', cursor: 'pointer', opacity: activeScriptTab === 'pre' ? 1 : 0.5, borderBottom: activeScriptTab === 'pre' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => setActiveScriptTab('pre')}>Pre-request</h4>
                                <h4 style={{ margin: 0, fontSize: '0.8rem', cursor: 'pointer', opacity: activeScriptTab === 'post' ? 1 : 0.5, borderBottom: activeScriptTab === 'post' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => setActiveScriptTab('post')}>Post-request</h4>
                            </div>
                            {activeScriptTab === 'pre' && (
                                <ScriptListEditor scripts={preScripts} title="Pre-request Scripts" parentId={id} isReadOnly={isReadOnly} />
                            )}
                            {activeScriptTab === 'post' && (
                                <ScriptListEditor scripts={postScripts} title="Post-request Scripts" showStatusFilter={true} parentId={id} isReadOnly={isReadOnly} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
