import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { useRef, useCallback, useEffect } from "preact/hooks";
import { activeRequestId, requests, folders, environments, activeEnvironmentName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, ScriptItem, executions, executionProgressMap } from "../store";
import { RequestPanel } from "./RequestPanel";
import { MethodSelect } from "./MethodSelect";
import { VariableInput } from "./VariableInput";
import { Play, XCircle, X } from "lucide-preact";
import { runExecution, cancelExecution } from "../utils/execution";
import { ExecutionProgress } from "./execution/ExecutionProgress";
import { ResponsePanel } from "./response/ResponsePanel";

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
    const headers = useSignal<{ key: string, values: string[] }[]>(
        (currentRequest.headers || []).map(h => ({ key: h.key, values: [...(h.values || [])] }))
    );
    const body = useSignal(currentRequest.body || '');
    const bodyType = useSignal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>(
        currentRequest.bodyType || ((currentRequest.body && (currentRequest.body as any).startsWith('{')) ? 'json' : 'none')
    );
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
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>(currentRequest.formData || []);

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
        const currentBodyType = bodyType.value;
        const currentBody = body.value;
        const currentFormData = formData.value;
        const currentAuth = auth.value;
        const currentPreScripts = preScripts.value;
        const currentPostScripts = postScripts.value;

        const reqId = activeRequestId.value;
        if (!reqId) return;

        const allRequests = requests.peek();
        const idx = allRequests.findIndex(r => r.id === reqId);

        if (idx !== -1) {
            const req = allRequests[idx];
            const headersChanged = JSON.stringify(req.headers) !== JSON.stringify(currentHeaders);
            const authChanged = JSON.stringify(req.auth) !== JSON.stringify(currentAuth);
            const preScriptsChanged = JSON.stringify(req.preScripts) !== JSON.stringify(currentPreScripts);
            const postScriptsChanged = JSON.stringify(req.postScripts) !== JSON.stringify(currentPostScripts);
            const bodyTypeChanged = req.bodyType !== currentBodyType;
            const formDataChanged = JSON.stringify(req.formData || []) !== JSON.stringify(currentFormData);

            if (req.name !== currentName || req.method !== currentMethod || req.url !== currentUrl || headersChanged || req.body !== currentBody || bodyTypeChanged || formDataChanged || authChanged || preScriptsChanged || postScriptsChanged) {
                const newRequests = [...allRequests];
                newRequests[idx] = {
                    ...req,
                    name: currentName,
                    method: currentMethod,
                    url: currentUrl,
                    headers: currentHeaders,
                    bodyType: currentBodyType,
                    body: currentBody,
                    formData: currentFormData,
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
    const resultsPanelWidth = useSignal(40); // Initial results width %
    const isResizing = useSignal(false);
    const defaultExecution = useComputed(() => 
        executions.value.find(e => e.requestId === currentRequest.id && e.name === 'default')
    );

    const progress = useComputed(() => 
        (defaultExecution.value && executionProgressMap.value[defaultExecution.value.id]) || {
            isLoading: false,
            steps: [],
            startTime: null,
            totalTime: null,
            lastResponseTime: null,
            responseSize: null,
            responseStatus: null
        }
    );

    const isLoadingSignal = useSignal(progress.value.isLoading);
    const stepsSignal = useSignal(progress.value.steps);
    const startTimeSignal = useSignal(progress.value.startTime);
    const totalTimeSignal = useSignal(progress.value.totalTime);
    const lastResponseTimeSignal = useSignal(progress.value.lastResponseTime);
    const responseSizeSignal = useSignal(progress.value.responseSize);
    const responseStatusSignal = useSignal(progress.value.responseStatus);

    useSignalEffect(() => {
        isLoadingSignal.value = progress.value.isLoading;
        stepsSignal.value = progress.value.steps as any;
        startTimeSignal.value = progress.value.startTime;
        totalTimeSignal.value = progress.value.totalTime;
        lastResponseTimeSignal.value = progress.value.lastResponseTime;
        responseSizeSignal.value = progress.value.responseSize;
        responseStatusSignal.value = progress.value.responseStatus;
    });

    const showResults = useSignal(defaultExecution.peek()?.resultsVisible || false);

    const startResizing = useCallback(() => {
        isResizing.value = true;
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.value = false;
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing.value && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            // Width from right side
            const newWidth = ((containerRect.right - e.clientX) / containerRect.width) * 100;
            if (newWidth >= 20 && newWidth <= 80) {
                resultsPanelWidth.value = newWidth;
            }
        }
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const handleRunDefault = () => {
        const dExec = defaultExecution.peek();
        if (!dExec) return;

        showResults.value = true;
        
        // Persist visible state in store
        executions.value = executions.peek().map(e => 
            e.id === dExec.id ? { ...e, resultsVisible: true } : e
        );

        runExecution(dExec.id, {
            url: url.peek(),
            method: method.peek(),
            headers: headers.peek().map(h => ({ ...h, enabled: true })), // RequestEditor headers are implied enabled
            queryParams: queryParams.peek().map(p => ({ ...p, enabled: true })),
            body: body.peek(),
            bodyType: bodyType.peek(),
            auth: auth.peek(),
            preScripts: preScripts.peek(),
            postScripts: postScripts.peek(),
            formData: formData.peek(),
            pathParams: pathParams.peek()
        });
    };

    const handleCancelDefault = () => {
        const dExec = defaultExecution.peek();
        if (dExec) cancelExecution(dExec.id);
    };

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
                        parentId={currentRequest.parentId}
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
                {progress.value.isLoading ? (
                    <button
                        onClick={handleCancelDefault}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--error)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.9rem'
                        }}
                    >
                        <XCircle size={16} /> Cancel
                    </button>
                ) : (
                    <button
                        onClick={handleRunDefault}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.9rem'
                        }}
                    >
                        <Play size={16} fill="currentColor" /> Run Default
                    </button>
                )}
            </div>

            <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0, gap: 'var(--spacing-md)' }}>
                    {/* Compact progress shown ONLY when loading and results panel is closed */}
                    {isLoadingSignal.value && !showResults.value && (
                        <ExecutionProgress
                            isLoading={isLoadingSignal}
                            executionSteps={stepsSignal}
                            startTime={startTimeSignal}
                            totalExecutionTime={totalTimeSignal}
                            lastResponseTime={lastResponseTimeSignal}
                            responseSize={responseSizeSignal}
                            responseStatus={responseStatusSignal}
                            compact={true}
                        />
                    )}
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
                        parentId={currentRequest.parentId}
                    />
                </div>

                {showResults.value && (
                    <>
                        {/* Resizer Handle */}
                        <div
                            onMouseDown={startResizing}
                            style={{
                                width: '5px',
                                cursor: 'col-resize',
                                backgroundColor: isResizing.value ? 'var(--accent-secondary)' : 'var(--border-color)',
                                opacity: isResizing.value ? 1 : 0.5,
                                transition: 'background-color 0.2s',
                                margin: '0 4px',
                                borderRadius: '2px',
                                zIndex: 10
                            }}
                        />

                        {/* Results Panel */}
                        <div style={{ 
                            width: `${resultsPanelWidth.value}%`, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            minWidth: '300px',
                            height: '100%', 
                            minHeight: 0,
                            borderLeft: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            position: 'relative',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                zIndex: 20
                            }}>
                                <button
                                    onClick={() => {
                                        showResults.value = false;
                                        // Update store to persist hidden state
                                        const dExec = defaultExecution.peek();
                                        if (dExec) {
                                            executions.value = executions.peek().map(e => 
                                                e.id === dExec.id ? { ...e, resultsVisible: false } : e
                                            );
                                        }
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex'
                                    }}
                                    title="Close Results"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--border-color)' }}>
                                <ExecutionProgress
                                    isLoading={isLoadingSignal}
                                    executionSteps={stepsSignal}
                                    startTime={startTimeSignal}
                                    totalExecutionTime={totalTimeSignal}
                                    lastResponseTime={lastResponseTimeSignal}
                                    responseSize={responseSizeSignal}
                                    responseStatus={responseStatusSignal}
                                    compact={false}
                                />
                            </div>

                            <div style={{ flex: 1, minHeight: 0 }}>
                                <ResponsePanel response={defaultExecution.value?.lastResponse || null} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
