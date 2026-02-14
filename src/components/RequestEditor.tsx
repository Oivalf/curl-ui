import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { useRef } from "preact/hooks";
import { activeRequestId, requests, folders, environments, activeEnvironmentName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, ScriptItem } from "../store";
import { RequestPanel } from "./RequestPanel";
import { MethodSelect } from "./MethodSelect";
import { VariableInput } from "./VariableInput";

export function RequestEditor() {
    const currentRequest = requests.value.find(r => r.id === activeRequestId.value);

    if (!currentRequest) return null;

    // Helper to separate URL and Query Params
    const parseUrl = (fullUrl: string) => {
        if (!fullUrl || !fullUrl.includes('?')) return { base: fullUrl || '', params: [] };
        const [base, query] = fullUrl.split('?', 2);
        const searchParams = new URLSearchParams(query);
        const params: { key: string, values: string[] }[] = [];
        const processedKeys = new Set<string>();
        searchParams.forEach((_, key) => {
            if (processedKeys.has(key)) return;
            processedKeys.add(key);
            params.push({ key, values: searchParams.getAll(key) });
        });
        return { base, params };
    };

    const { base: initialBase, params: initialParams } = parseUrl(currentRequest.url);

    // Local state for editing
    const name = useSignal(currentRequest.name);
    const url = useSignal(initialBase);
    const method = useSignal(currentRequest.method);
    // Convert headers object to array for easier editing
    const headers = useSignal<{ key: string, value: string }[]>(
        Object.entries(currentRequest.headers).map(([k, v]) => ({ key: k, value: v }))
    );
    const body = useSignal(currentRequest.body || '');
    const bodyType = useSignal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>((currentRequest.body && (currentRequest.body as any).startsWith('{')) ? 'json' : 'none'); // Simple heuristic, todo fix
    const preScripts = useSignal<ScriptItem[]>(currentRequest.preScripts || []);
    const postScripts = useSignal<ScriptItem[]>(currentRequest.postScripts || []);

    // Auth State
    const auth = useSignal<AuthConfig>(currentRequest.auth || { type: 'inherit' });

    // Inherited Auth
    const inheritedAuth = useComputed(() => {
        // Dependencies to ensure reactivity
        folders.value;
        requests.value; // Trigger if requests update (e.g. parent changes)
        const req = requests.peek().find(r => r.id === activeRequestId.value);
        if (!req) return undefined;
        return resolveAuth(req.id);
    });

    // Inherited Headers
    const inheritedHeaders = useComputed(() => {
        folders.value;
        requests.value;
        const req = requests.peek().find(r => r.id === activeRequestId.value);
        if (!req || !req.parentId) return [];
        return resolveHeaders(req.parentId);
    });

    // Params State
    const queryParams = useSignal<{ key: string, values: string[] }[]>(initialParams);
    const pathParams = useSignal<Record<string, string>>({});
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>([]);

    // URL sync effect removed - handled by onInput and initial state

    // Reactive helper to update URL when Query Params change
    const updateUrlFromParams = (newParams: { key: string, values: string[] }[]) => {
        queryParams.value = newParams;
    };

    // Extract Path Params ({param}) - ignore {{env_var}}
    const detectedPathKeys = useComputed(() => {
        // Regex lookbehind/lookahead to avoid matching {{var}}
        const matches = url.value.match(/(?<!\{)\{[a-zA-Z0-9_]+\}(?!\})/g);
        if (!matches) return [];
        return matches.map(m => m.slice(1, -1)); // remove { and }
    });

    const getFinalUrl = (includeQuery = true) => {
        let finalUrl = url.value;
        // Substitute Path Params
        detectedPathKeys.value.forEach(key => {
            if (pathParams.value[key]) {
                finalUrl = finalUrl.replace(`{${key}}`, pathParams.value[key]);
            }
        });

        if (includeQuery && queryParams.value.length > 0) {
            const searchParams = new URLSearchParams();
            queryParams.value.forEach(p => {
                if (p.key) {
                    p.values.forEach(v => searchParams.append(p.key, v));
                }
            });
            const qs = searchParams.toString();
            if (qs) {
                finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
            }
        }
        return finalUrl;
    };

    const finalUrlPreview = useComputed(() => {
        return substituteVariables(getFinalUrl());
    });

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            // handleSend removed
        }
    };

    // Sync Local State to Global Store
    useSignalEffect(() => {
        const currentName = name.value;
        const currentMethod = method.value;
        const currentUrl = getFinalUrl(true);
        const currentHeaders = headers.value;
        const currentBody = body.value;
        const currentAuth = auth.value;
        const currentPreScripts = preScripts.value;
        const currentPostScripts = postScripts.value;

        const reqId = activeRequestId.value;
        if (!reqId) return;

        const allRequests = requests.peek();
        const idx = allRequests.findIndex(r => r.id === reqId);

        if (idx !== -1) {
            const req = allRequests[idx];
            // Reconstruct headers object
            const headersObj: Record<string, string> = {};
            currentHeaders.forEach(h => { if (h.key) headersObj[h.key] = h.value; });

            const headersChanged = JSON.stringify(req.headers) !== JSON.stringify(headersObj);
            const authChanged = JSON.stringify(req.auth) !== JSON.stringify(currentAuth);
            const preScriptsChanged = JSON.stringify(req.preScripts) !== JSON.stringify(currentPreScripts);
            const postScriptsChanged = JSON.stringify(req.postScripts) !== JSON.stringify(currentPostScripts);

            if (req.name !== currentName || req.method !== currentMethod || req.url !== currentUrl || headersChanged || req.body !== currentBody || authChanged || preScriptsChanged || postScriptsChanged) {
                const newRequests = [...allRequests];
                newRequests[idx] = {
                    ...req,
                    name: currentName,
                    method: currentMethod,
                    url: currentUrl,
                    headers: headersObj,
                    body: currentBody,
                    auth: currentAuth,
                    preScripts: currentPreScripts,
                    postScripts: currentPostScripts
                };
                requests.value = newRequests;

                // Mark as dirty
                const newUnsaved = new Set(unsavedItemIds.peek());
                newUnsaved.add(reqId);
                unsavedItemIds.value = newUnsaved;
            }
        }
    });

    const substituteVariables = (text: string): string => {
        if (!text) return text;
        const placeholders = Array.from(new Set(text.match(/{{([\s\S]+?)}}/g) || []));
        if (placeholders.length === 0) return text;

        const env = environments.value.find(e => e.name === activeEnvironmentName.value);

        // Build Scope Chain: [Leaf Folder, ..., Root Folder]
        const folderScopes: typeof folders.value[0][] = [];
        let currentParentId = requests.value.find(r => r.id === activeRequestId.value)?.parentId;

        while (currentParentId) {
            const f = folders.value.find(x => x.id === currentParentId);
            if (f) {
                folderScopes.push(f); // Leaf is at 0, Root at end.
                currentParentId = f.parentId;
            } else break;
        }

        let result = text;
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            let value: string | null = null;

            // 1. Check Folder Scopes (Leaf -> Root)
            for (const folder of folderScopes) {
                if (folder.variables) {
                    const vars = folder.variables as Record<string, string>;
                    if (typeof vars[key] === 'string') {
                        value = vars[key];
                        break; // Found closest!
                    }
                }
            }

            // 2. Check Environment
            if (value === null && env) {
                const envVar = env.variables.find(v => v.key === key);
                if (envVar) value = envVar.value;
            }

            // 3. Check Global Environment Fallback
            if (value === null) {
                const globalEnv = environments.value.find(e => e.name === 'Global');
                if (globalEnv) {
                    const globalVar = globalEnv.variables.find(v => v.key === key);
                    if (globalVar) value = globalVar.value;
                }
            }

            if (value !== null) {
                result = result.split(placeholder).join(value);
            }
        });

        return result;
    };

    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', height: '100%' }}>
            {/* Top Bar */}
            <input
                value={name.value}
                onInput={(e) => name.value = e.currentTarget.value}
                placeholder="Request Name"
                style={{
                    width: '100%',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    marginBottom: '8px'
                }}
            />
            <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <MethodSelect value={method.value} onChange={(v) => method.value = v} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <VariableInput
                        value={url.value}
                        onInput={(val) => {
                            if (val.includes('?')) {
                                const [base, query] = val.split('?', 2);
                                url.value = base;

                                // Extra logic to move params to the table if pasted
                                try {
                                    const searchParams = new URLSearchParams(query);
                                    const nextParams = [...queryParams.peek()];
                                    searchParams.forEach((v, k) => {
                                        const existing = nextParams.find(p => p.key === k);
                                        if (existing) {
                                            existing.values.push(v);
                                        } else {
                                            nextParams.push({ key: k, values: [v] });
                                        }
                                    });
                                    queryParams.value = nextParams;
                                } catch (err) {
                                    console.error("Failed to parse query from input", err);
                                }
                            } else {
                                url.value = val;
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.example.com/v1/users"
                        style={{
                            padding: '8px',
                            background: 'var(--bg-input)',
                        }}
                    />
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        paddingLeft: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }} title={finalUrlPreview.value}>
                        Preview: {finalUrlPreview.value}
                    </div>
                </div>
            </div>

            <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <RequestPanel
                        headers={headers}
                        bodyType={bodyType}
                        body={body}
                        auth={auth}
                        queryParams={queryParams}
                        pathParams={pathParams}
                        formData={formData}
                        detectedPathKeys={detectedPathKeys}
                        updateUrlFromParams={updateUrlFromParams}
                        inheritedAuth={inheritedAuth.value}
                        inheritedHeaders={inheritedHeaders.value}
                        preScripts={preScripts}
                        postScripts={postScripts}
                    />
                </div>
            </div>
        </div>
    );
}
