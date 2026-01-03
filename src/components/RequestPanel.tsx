import { Signal, useSignal } from "@preact/signals";
import { RequestParamsEditor } from "./request/RequestParamsEditor";
import { RequestBodyEditor } from "./request/RequestBodyEditor";
import { RequestHeadersEditor } from "./request/RequestHeadersEditor";
import { RequestRawView } from "./request/RequestRawView";
import { RequestCurlView } from "./request/RequestCurlView";
import { ScriptListEditor } from "./request/ScriptListEditor";
import { AuthEditor } from "./AuthEditor";
import { AuthConfig, ScriptItem } from "../store";

interface RequestPanelProps {
    method: Signal<string>;
    headers: Signal<{ key: string, value: string }[]>;
    bodyType: Signal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>;
    body: Signal<string>;
    auth?: Signal<AuthConfig>;
    queryParams: Signal<{ key: string, values: string[] }[]>;
    pathParams: Signal<Record<string, string>>;
    formData: Signal<{ key: string, type: 'text' | 'file', values: string[] }[]>;
    detectedPathKeys: Signal<string[]>;
    updateUrlFromParams: (newParams: { key: string, values: string[] }[]) => void;
    getFinalUrl: () => string;
    generateCurl: () => string;
    inheritedAuth?: { config: AuthConfig, source: string, sourceId?: string };
    inheritedHeaders?: { key: string, value: string, source: string, sourceId?: string }[];
    preScripts: Signal<ScriptItem[]>;
    postScripts: Signal<ScriptItem[]>;
}

export function RequestPanel({
    method,
    headers,
    bodyType,
    body,
    auth,
    queryParams,
    pathParams,
    formData,
    detectedPathKeys,
    updateUrlFromParams,
    getFinalUrl,
    generateCurl,
    inheritedAuth,
    inheritedHeaders,
    preScripts,
    postScripts
}: RequestPanelProps) {
    const activeRequestTab = useSignal<'params' | 'body' | 'headers' | 'auth' | 'pre-script' | 'post-script' | 'raw' | 'curl'>('params');

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>REQUEST</span>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'params' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'params' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'params'}>Params</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'body' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'body' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'body'}>Body</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'headers' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'headers' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'headers'}>Headers</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'auth' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'auth' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'auth'}>Auth</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'pre-script' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'pre-script' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'pre-script'}>Pre-script</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'post-script' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'post-script' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'post-script'}>Post-script</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'raw' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'raw' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'raw'}>Raw</h3>
                <h3 style={{ margin: 0, fontSize: '0.9rem', cursor: 'pointer', opacity: activeRequestTab.value === 'curl' ? 1 : 0.5, borderBottom: activeRequestTab.value === 'curl' ? '2px solid var(--accent-primary)' : 'none' }} onClick={() => activeRequestTab.value = 'curl'}>Curl</h3>
            </div>

            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeRequestTab.value === 'params' ? (
                    <RequestParamsEditor
                        queryParams={queryParams}
                        pathParams={pathParams}
                        detectedPathKeys={detectedPathKeys}
                        updateUrlFromParams={updateUrlFromParams}
                    />
                ) : activeRequestTab.value === 'body' ? (
                    <RequestBodyEditor
                        bodyType={bodyType}
                        body={body}
                        formData={formData}
                    />
                ) : activeRequestTab.value === 'headers' ? (
                    <RequestHeadersEditor headers={headers} inheritedHeaders={inheritedHeaders} />
                ) : activeRequestTab.value === 'auth' ? (
                    <AuthEditor auth={auth!} onChange={(newAuth) => auth!.value = newAuth} inheritedAuth={inheritedAuth} />
                ) : activeRequestTab.value === 'pre-script' ? (
                    <ScriptListEditor scripts={preScripts} title="Pre-request Scripts" />
                ) : activeRequestTab.value === 'post-script' ? (
                    <ScriptListEditor scripts={postScripts} title="Post-request Scripts" showStatusFilter={true} />
                ) : activeRequestTab.value === 'raw' ? (
                    <RequestRawView
                        method={method}
                        url={getFinalUrl()}
                        headers={headers}
                        bodyType={bodyType}
                        body={body}
                    />
                ) : (
                    <RequestCurlView curlCommand={generateCurl()} />
                )}
            </div>
        </div>
    );
}
