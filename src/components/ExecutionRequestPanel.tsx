import { Signal, useSignal } from "@preact/signals";
import { ExecutionParamsEditor } from "./request/ExecutionParamsEditor";
import { RequestBodyEditor } from "./request/RequestBodyEditor";
import { ExecutionHeadersEditor } from "./request/ExecutionHeadersEditor";
import { ScriptListEditor } from "./request/ScriptListEditor";
import { AuthEditor } from "./AuthEditor";
import { AuthConfig, ScriptItem } from "../store";

interface ExecutionRequestPanelProps {
    headers: Signal<{ key: string, value: string, enabled: boolean }[]>;
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
    auth: Signal<AuthConfig | undefined>;
    queryParams: Signal<{ key: string, value: string, enabled: boolean }[]>;
    pathParams: Signal<Record<string, string>>;
    formData: Signal<{ key: string, type: 'text' | 'file', values: string[] }[]>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: { key: string, value: string, enabled: boolean }[]) => void;
    inheritedAuth?: { config: AuthConfig, source: string, sourceId?: string };
    inheritedHeaders?: { key: string, value: string, source: string, sourceId?: string }[];
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
    isAuthOverridden
}: ExecutionRequestPanelProps) {
    const activeRequestTab = useSignal<'params' | 'body' | 'headers' | 'auth' | 'scripts'>('params');
    const activeScriptTab = useSignal<'pre' | 'post'>('pre');

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>REQUEST</span>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'params' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'params' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'params'}>Params</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'body' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'body' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'body'}>Body</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'headers' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'headers' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'headers'}>Headers</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'auth' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'auth' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'auth'}>Auth</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'scripts' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'scripts' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'scripts'}>Scripts</h3>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, height: '100%' }}>
                    {activeRequestTab.value === 'params' && (
                        <ExecutionParamsEditor
                            queryParams={queryParams}
                            pathParams={pathParams}
                            detectedPathKeys={detectedPathKeys}
                            updateUrlFromParams={updateUrlFromParams}
                            isReadOnly={isReadOnly}
                            overriddenKeys={overriddenQueryParams}
                            parentKeys={parentQueryParamKeys}
                        />
                    )}
                    {activeRequestTab.value === 'body' && (
                        <RequestBodyEditor
                            bodyType={bodyType}
                            body={body}
                            formData={formData}
                            isReadOnly={isReadOnly}
                            isOverridden={isBodyOverridden}
                            isTypeReadOnly={true}
                        />
                    )}
                    {activeRequestTab.value === 'headers' && (
                        <ExecutionHeadersEditor
                            headers={headers}
                            inheritedHeaders={inheritedHeaders}
                            isReadOnly={isReadOnly}
                            overriddenKeys={overriddenHeaders}
                            parentKeys={parentHeaderKeys}
                        />
                    )}
                    {activeRequestTab.value === 'auth' && (
                        <AuthEditor
                            auth={auth}
                            onChange={(v) => auth.value = v}
                            inheritedAuth={inheritedAuth}
                            isReadOnly={isReadOnly}
                            isOverridden={isAuthOverridden}
                        />
                    )}
                    {activeRequestTab.value === 'scripts' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Sub-tabs for Scripts */}
                            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '8px' }}>
                                <span
                                    onClick={() => activeScriptTab.value = 'pre'}
                                    style={{
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: activeScriptTab.value === 'pre' ? 'bold' : 'normal',
                                        color: activeScriptTab.value === 'pre' ? 'var(--accent-primary)' : 'var(--text-muted)'
                                    }}
                                >
                                    Pre-request
                                </span>
                                <span
                                    onClick={() => activeScriptTab.value = 'post'}
                                    style={{
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: activeScriptTab.value === 'post' ? 'bold' : 'normal',
                                        color: activeScriptTab.value === 'post' ? 'var(--accent-primary)' : 'var(--text-muted)'
                                    }}
                                >
                                    Post-request
                                </span>
                            </div>

                            {activeScriptTab.value === 'pre' ? (
                                <ScriptListEditor scripts={preScripts} title="Pre-request Scripts" />
                            ) : (
                                <ScriptListEditor scripts={postScripts} title="Post-request Scripts" showStatusFilter={true} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
