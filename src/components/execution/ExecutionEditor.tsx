import { useSignal, useSignalEffect, useComputed, batch } from "@preact/signals";
import { useRef, useEffect, useCallback } from "preact/hooks";
import { ArrowLeft, Play, XCircle } from "lucide-preact";
import { activeExecutionId, activeRequestId, executions, requests, folders, environments, activeEnvironmentName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, ScriptItem, addLog, openTabs, activeTabId, activeFolderId, triggerExecutionRun, executionProgressMap } from "../../store";
import { runExecution, cancelExecution } from "../../utils/execution";
import { ExecutionRequestPanel } from "./ExecutionRequestPanel";
import { ExecutionProgress } from "./ExecutionProgress";
import { ResponsePanel } from "../response/ResponsePanel";
import { MethodSelect } from "../MethodSelect";
import { VariableInput } from "../VariableInput";

export function ExecutionEditor() {
    const currentExecution = executions.value.find((e: any) => e.id === activeExecutionId.value);

    if (!currentExecution) return null;

    // Get parent request for inheriting values
    const parentRequest = requests.value.find((r: any) => r.id === currentExecution.requestId);

    if (!parentRequest) {
        return (
            <div style={{ padding: 'var(--spacing-lg)', color: 'var(--text-muted)' }}>
                Parent request not found. The execution may be orphaned.
            </div>
        );
    }

    // Local state for editing - use execution override or inherit from parent
    const name = useSignal(currentExecution.name);
    // Helper to separate URL and Query Params
    const parseUrl = (fullUrl: string) => {
        if (!fullUrl || !fullUrl.includes('?')) return { base: fullUrl || '', params: [] };
        const [base, query] = fullUrl.split('?', 2);
        const searchParams = new URLSearchParams(query);
        const params: { key: string, value: string, enabled: boolean }[] = [];
        searchParams.forEach((value, key) => {
            params.push({ key, value, enabled: true });
        });
        return { base, params };
    };

    const { base: initialBase } = parseUrl(currentExecution.url ?? parentRequest.url);

    // Re-parsing parent just to have clean start if needed (actually just need parseUrl logic available)
    // We don't need to call it here if we don't use the result immediately, but overriddenQueryParams uses it.

    const url = useSignal(initialBase);
    const method = useSignal(currentExecution.method ?? parentRequest.method);

    // Convert headers object to array for easier editing
    // Merge parent headers with execution overrides
    const getMergedHeaders = () => {
        const parentHeaders = parentRequest.headers || [];
        const execOverrides = currentExecution.headers || [];

        // Start with parent headers (defaults)
        const merged: { key: string, values: string[], enabled: boolean }[] = parentHeaders.map((h: any) => ({
            key: h.key,
            values: [...h.values],
            enabled: true // Inherited default
        }));

        // Apply overrides
        execOverrides.forEach((override: any) => {
            const index = merged.findIndex((m: any) => m.key === override.key);
            if (index !== -1) {
                // Update existing
                merged[index] = { ...override, values: [...override.values] };
            } else {
                // Add new
                merged.push({ ...override, values: [...override.values] });
            }
        });

        return merged;
    };

    // Merge parent query params with execution overrides
    const getMergedQueryParams = (parentUrl: string, execOverrides?: { key: string, values: string[], enabled: boolean }[]) => {
        const { params: parentParamsFlat } = parseUrl(parentUrl);
        // Group flat parent params
        const parentParams: { key: string, values: string[] }[] = [];
        parentParamsFlat.forEach(p => {
            const existing = parentParams.find(x => x.key === p.key);
            if (existing) {
                existing.values.push(p.value);
            } else {
                parentParams.push({ key: p.key, values: [p.value] });
            }
        });

        const overrides = execOverrides || [];

        // Start with parent params (defaults)
        const merged: { key: string, values: string[], enabled: boolean }[] = parentParams.map(p => ({
            key: p.key,
            values: [...p.values],
            enabled: true
        }));

        // Apply overrides
        overrides.forEach((override: any) => {
            const index = merged.findIndex((m: any) => m.key === override.key);
            if (index !== -1) {
                merged[index] = { ...override, values: [...override.values] };
            } else {
                merged.push({ ...override, values: [...override.values] });
            }
        });

        return merged;
    };

    const headers = useSignal<{ key: string, values: string[], enabled: boolean }[]>(getMergedHeaders());
    const body = useSignal(currentExecution.body ?? parentRequest.body ?? '');
    const bodyType = useSignal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>(
        currentExecution.bodyType || parentRequest.bodyType || ((currentExecution.body ?? parentRequest.body ?? '') !== '' ? 'json' : 'none')
    );
    const preScripts = useSignal<ScriptItem[]>(currentExecution.preScripts ?? parentRequest.preScripts ?? []);
    const postScripts = useSignal<ScriptItem[]>(currentExecution.postScripts ?? parentRequest.postScripts ?? []);

    // Auth State - use execution auth or inherit from parent
    const auth = useSignal<AuthConfig>(currentExecution.auth ?? parentRequest.auth ?? { type: 'inherit' });

    // Track last loaded ID to avoid re-sync loops
    const lastLoadedId = useRef<string | null>(null);

    // Initial load / Switch execution
    useEffect(() => {
        if (activeExecutionId.value === lastLoadedId.current) return;

        const cExec = executions.peek().find(e => e.id === activeExecutionId.value);
        if (!cExec || !parentRequest) return;

        lastLoadedId.current = activeExecutionId.value;
        const initialPathParams = cExec.pathParams ?? {};
        // Initialize from override or inherit base
        const { base } = parseUrl(cExec.url ?? parentRequest.url);

        url.value = base;
        method.value = cExec.method ?? parentRequest.method;
        body.value = cExec.body ?? parentRequest.body ?? '';
        auth.value = cExec.auth ?? parentRequest.auth ?? { type: 'inherit' };
        preScripts.value = cExec.preScripts ?? parentRequest.preScripts ?? [];
        postScripts.value = cExec.postScripts ?? parentRequest.postScripts ?? [];

        // Params initialization (merge parent with overrides, like headers)
        queryParams.value = getMergedQueryParams(parentRequest.url, cExec.queryParams);
        pathParams.value = initialPathParams;

        // Headers initialization
        headers.value = getMergedHeaders();
    }, [activeExecutionId.value, parentRequest?.id]);

    // Reactive sync: When parent request changes (e.g. adding params), update inherited fields
    useSignalEffect(() => {
        // Subscribe to requests signal to detect parent changes
        const allRequests = requests.value;
        const execId = lastLoadedId.current;
        if (!execId) return;

        const cExec = executions.peek().find(e => e.id === execId);
        if (!cExec) return;

        const parent = allRequests.find((r: any) => r.id === cExec.requestId);
        if (!parent) return;

        // Always re-merge: parent params + execution overrides (like headers)
        const { base } = parseUrl(parent.url);
        url.value = base;
        queryParams.value = getMergedQueryParams(parent.url, cExec.queryParams);

        // Re-derive method if not overridden
        if (!cExec.method) {
            method.value = parent.method;
        }

        // Re-derive headers (merge parent + overrides)
        const parentHeaders = parent.headers || [];
        const mergedHeaders: { key: string, values: string[], enabled: boolean }[] = parentHeaders.map((h: any) => ({
            key: h.key, values: [...h.values], enabled: true
        }));
        (cExec.headers || []).forEach((override: any) => {
            const index = mergedHeaders.findIndex((m: any) => m.key === override.key);
            if (index !== -1) {
                mergedHeaders[index] = { ...override, values: [...override.values] };
            } else {
                mergedHeaders.push({ ...override, values: [...override.values] });
            }
        });
        headers.value = mergedHeaders;
    });

    // Inherited Auth
    const inheritedAuth = useComputed(() => {
        folders.value;
        requests.value;
        if (!parentRequest) return undefined;
        return resolveAuth(parentRequest.id);
    });

    // Inherited Headers
    const inheritedHeaders = useComputed(() => {
        folders.value;
        requests.value;
        if (!parentRequest || !parentRequest.parentId) return [];
        return resolveHeaders(parentRequest.parentId);
    });

    // Params State
    const queryParams = useSignal<{ key: string, values: string[], enabled: boolean }[]>(getMergedQueryParams(parentRequest.url, currentExecution.queryParams));
    const pathParams = useSignal<Record<string, string>>({});
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>(currentExecution.formData ?? parentRequest.formData ?? []);

    // Global Execution Progress State (Synced from store)
    const progress = useComputed(() => executionProgressMap.value[activeExecutionId.value || ''] || {
        isLoading: false,
        steps: [],
        totalTime: null,
        lastResponseTime: null,
        responseSize: null,
        responseStatus: null
    });

    const isLoadingSignal = useSignal(progress.value.isLoading);
    const stepsSignal = useSignal(progress.value.steps);
    const totalTimeSignal = useSignal(progress.value.totalTime);
    const lastResponseTimeSignal = useSignal(progress.value.lastResponseTime);
    const responseSizeSignal = useSignal(progress.value.responseSize);
    const responseStatusSignal = useSignal(progress.value.responseStatus);

    useSignalEffect(() => {
        isLoadingSignal.value = progress.value.isLoading;
        stepsSignal.value = progress.value.steps as any;
        totalTimeSignal.value = progress.value.totalTime;
        lastResponseTimeSignal.value = progress.value.lastResponseTime;
        responseSizeSignal.value = progress.value.responseSize;
        responseStatusSignal.value = progress.value.responseStatus;
    });


    // URL sync effect removed - handled by sync logic and internal params management

    const updateUrlFromParams = (newParams: { key: string, values: string[], enabled: boolean }[]) => {
        queryParams.value = newParams;
    };

    const detectedPathKeys = useSignal<string[]>([]);

    useSignalEffect(() => {
        const matches = url.value.match(/(?<!\{)\{[a-zA-Z0-9_]+\}(?!\})/g);
        detectedPathKeys.value = matches ? matches.map(m => m.slice(1, -1)) : [];
    });

    const substituteVariables = (text: string | null | undefined): string => {
        if (!text) return '';
        const placeholders = Array.from(new Set(text.match(/{{\s*[\S]+?\s*}}/g) || []));
        if (placeholders.length === 0) return text;

        const env = environments.value.find(e => e.name === activeEnvironmentName.value);

        const folderScopes: typeof folders.value[0][] = [];
        let currentParentId = parentRequest?.parentId;

        while (currentParentId) {
            const f = folders.value.find((x: any) => x.id === currentParentId);
            if (f) {
                folderScopes.push(f);
                currentParentId = f.parentId;
            } else break;
        }

        let result = text;
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            let value: string | null = null;

            for (const folder of folderScopes) {
                if (folder.variables) {
                    const vars = folder.variables as Record<string, string>;
                    if (typeof vars[key] === 'string') {
                        value = vars[key];
                        break;
                    }
                }
            }

            if (value === null && env) {
                const envVar = env.variables.find((v: any) => v.key === key);
                if (envVar) value = envVar.value;
            }

            if (value === null) {
                const globalEnv = environments.value.find(e => e.name === 'Global');
                if (globalEnv) {
                    const globalVar = globalEnv.variables.find((v: any) => v.key === key);
                    if (globalVar) value = globalVar.value;
                }
            }

            if (value !== null) {
                result = result.split(placeholder).join(value);
            }
        });

        return result;
    };

    const getFinalUrl = (includeQuery = true) => {
        let finalUrl = substituteVariables(url.value);
        detectedPathKeys.value.forEach(key => {
            if (pathParams.value[key]) {
                finalUrl = finalUrl.replace(`{${key}}`, substituteVariables(pathParams.value[key]));
            }
        });

        if (includeQuery && queryParams.value.length > 0) {
            const searchParams = new URLSearchParams();
            queryParams.value.forEach(p => {
                if (p.key && p.enabled) {
                    p.values.forEach(v => {
                        searchParams.append(substituteVariables(p.key), substituteVariables(v));
                    });
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
        return getFinalUrl();
    });

    // Detect Overrides for UI highlighting
    const overriddenHeaders = useComputed(() => {
        const parentHeaders = parentRequest.headers || [];
        return new Set(headers.value.filter(h => {
            const parentMatch = parentHeaders.find(ph => ph.key === h.key);
            if (!h.key || parentMatch === undefined) return false;
            // Overridden if values differ or it's disabled
            return JSON.stringify(h.values) !== JSON.stringify(parentMatch.values) || !h.enabled;
        }).map(h => h.key));
    });

    const overriddenQueryParams = useComputed(() => {
        const { params: parentParamsFlat } = parseUrl(parentRequest.url);
        // Group parent params
        const parentParams: { key: string, values: string[] }[] = [];
        parentParamsFlat.forEach(p => {
            const existing = parentParams.find(x => x.key === p.key);
            if (existing) existing.values.push(p.value);
            else parentParams.push({ key: p.key, values: [p.value] });
        });

        const overriddenKeys = new Set<string>();

        // Only mark as overridden if the key exists in parent but value differs
        queryParams.value.forEach(p => {
            const parentMatch = parentParams.find(pp => pp.key === p.key);
            if (parentMatch && (JSON.stringify(parentMatch.values) !== JSON.stringify(p.values) || !p.enabled)) {
                overriddenKeys.add(p.key);
            }
        });
        return overriddenKeys;
    });

    const parentHeaderKeys = useComputed(() => new Set((parentRequest.headers || []).map(h => h.key)));
    const parentQueryParamKeys = useComputed(() => {
        const { params } = parseUrl(parentRequest.url);
        return new Set(params.map(p => p.key));
    });

    const isBodyOverridden = useComputed(() => body.value !== (parentRequest.body ?? ''));
    const isAuthOverridden = useComputed(() => JSON.stringify(auth.value) !== JSON.stringify(parentRequest.auth ?? { type: 'inherit' }));


    // Sync Local State to Global Store
    useSignalEffect(() => {
        const currentName = name.value;
        const currentHeaders = headers.value;
        const currentQueryParams = queryParams.value;
        const currentPathParams = pathParams.value;
        const currentBodyType = bodyType.value;
        const currentBody = body.value;
        const currentFormData = formData.value;
        const currentAuth = auth.value;
        const currentPreScripts = preScripts.value;
        const currentPostScripts = postScripts.value;

        const execId = activeExecutionId.value;
        if (!execId || execId !== lastLoadedId.current) return;

        const allExecutions = executions.peek();
        const idx = allExecutions.findIndex(e => e.id === execId);

        if (idx !== -1) {
            const exec = allExecutions[idx];

            // 1. Headers Inheritance Check
            const parentHeaders = parentRequest.headers || [];
            let matchesParentHeaders = true;
            if (currentHeaders.length !== parentHeaders.length) {
                matchesParentHeaders = false;
            } else {
                for (const h of currentHeaders) {
                    const parentMatch = parentHeaders.find(ph => ph.key === h.key);
                    if (!h.enabled || !parentMatch || JSON.stringify(parentMatch.values) !== JSON.stringify(h.values)) {
                        matchesParentHeaders = false;
                        break;
                    }
                }
            }
            const finalHeaders = matchesParentHeaders ? undefined : currentHeaders;

            // 2. Query Params - save only overrides (params that differ from parent)
            const { params: parentParamsFlat } = parseUrl(parentRequest.url);
            // Group parent params
            const parentParams: { key: string, values: string[] }[] = [];
            parentParamsFlat.forEach(p => {
                const existing = parentParams.find(x => x.key === p.key);
                if (existing) existing.values.push(p.value);
                else parentParams.push({ key: p.key, values: [p.value] });
            });

            const overriddenParams: typeof currentQueryParams = [];
            currentQueryParams.forEach(cp => {
                const parentMatch = parentParams.find(pp => pp.key === cp.key);
                if (!parentMatch || JSON.stringify(parentMatch.values) !== JSON.stringify(cp.values) || !cp.enabled) {
                    // This param was overridden (value changed, disabled, or new key)
                    overriddenParams.push(cp);
                }
            });
            const finalQueryParams = overriddenParams.length > 0 ? overriddenParams : undefined;

            // 3. Path Params Inheritance Check (new)
            const finalPathParams = Object.keys(currentPathParams).length === 0 ? undefined : currentPathParams;

            // 4. Other fields
            const finalBodyType = currentBodyType === (parentRequest.bodyType || 'json') ? undefined : currentBodyType;
            const finalBody = currentBody === (parentRequest.body ?? '') ? undefined : currentBody;
            const finalFormData = JSON.stringify(currentFormData) === JSON.stringify(parentRequest.formData ?? []) ? undefined : currentFormData;
            const finalAuth = JSON.stringify(currentAuth) === JSON.stringify(parentRequest.auth ?? { type: 'inherit' }) ? undefined : currentAuth;
            const finalPreScripts = JSON.stringify(currentPreScripts) === JSON.stringify(parentRequest.preScripts ?? []) ? undefined : currentPreScripts;
            const finalPostScripts = JSON.stringify(currentPostScripts) === JSON.stringify(parentRequest.postScripts ?? []) ? undefined : currentPostScripts;

            // Diff check to avoid noisy updates
            const headersChanged = JSON.stringify(exec.headers) !== JSON.stringify(finalHeaders);
            const paramsChanged = JSON.stringify(exec.queryParams) !== JSON.stringify(finalQueryParams);
            const pathParamsChanged = JSON.stringify(exec.pathParams) !== JSON.stringify(finalPathParams);
            const authChanged = JSON.stringify(exec.auth) !== JSON.stringify(finalAuth);
            const preScriptsChanged = JSON.stringify(exec.preScripts) !== JSON.stringify(finalPreScripts);
            const postScriptsChanged = JSON.stringify(exec.postScripts) !== JSON.stringify(finalPostScripts);
            const bodyTypeChanged = exec.bodyType !== finalBodyType;
            const formDataChanged = JSON.stringify(exec.formData) !== JSON.stringify(finalFormData);

            if (exec.name !== currentName || headersChanged || paramsChanged || pathParamsChanged || exec.body !== finalBody || bodyTypeChanged || formDataChanged || authChanged || preScriptsChanged || postScriptsChanged) {
                batch(() => {
                    const newExecutions = [...allExecutions];
                    newExecutions[idx] = {
                        ...exec,
                        name: currentName,
                        method: undefined, // Always follow parent
                        url: undefined,    // Always follow parent
                        headers: finalHeaders,
                        queryParams: finalQueryParams,
                        pathParams: finalPathParams,
                        bodyType: finalBodyType,
                        body: finalBody,
                        formData: finalFormData,
                        auth: finalAuth,
                        preScripts: finalPreScripts,
                        postScripts: finalPostScripts
                    };
                    executions.value = newExecutions;

                    const newUnsaved = new Set(unsavedItemIds.peek());
                    newUnsaved.add(execId);
                    unsavedItemIds.value = newUnsaved;
                });
            }
        }
    });

    const handleCancel = () => cancelExecution(activeExecutionId.peek()!);

    const handleSend = () => {
        runExecution(activeExecutionId.peek()!, {
            url: url.peek(),
            method: method.peek(),
            headers: headers.peek(),
            queryParams: queryParams.peek(),
            body: body.peek(),
            bodyType: bodyType.peek(),
            auth: auth.peek(),
            preScripts: preScripts.peek(),
            postScripts: postScripts.peek(),
            formData: formData.peek(),
            pathParams: pathParams.peek()
        });
    };

    useSignalEffect(() => {
        if (triggerExecutionRun.value === activeExecutionId.value && activeExecutionId.value !== null) {
            triggerExecutionRun.value = null;
            handleSend();
        }
    });


    const navigateToParent = () => {
        if (!parentRequest) return;

        // Open parent request in a tab
        const existingTab = openTabs.value.find(t => t.id === parentRequest.id);
        if (!existingTab) {
            openTabs.value = [...openTabs.value, {
                id: parentRequest.id,
                type: 'request',
                name: parentRequest.name
            }];
        }

        activeTabId.value = parentRequest.id;
        activeRequestId.value = parentRequest.id;
        activeExecutionId.value = null;
        activeFolderId.value = null;
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const leftPanelWidth = useSignal(50);
    const isResizing = useSignal(false);

    const startResizing = useCallback(() => {
        isResizing.value = true;
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.value = false;
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing.value && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            if (newWidth >= 20 && newWidth <= 80) {
                leftPanelWidth.value = newWidth;
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

    return (
        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', height: '100%' }}>
            {/* Parent Request Link */}
            <div
                onClick={navigateToParent}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginBottom: '-8px'
                }}
            >
                <ArrowLeft size={14} />
                <span>Based on: <strong style={{ color: 'var(--text-secondary)' }}>{parentRequest.name}</strong></span>
            </div>

            {/* Top Bar */}
            <input
                value={name.value}
                onInput={(e) => name.value = e.currentTarget.value}
                placeholder="Execution Name"
                readOnly={currentExecution.name === 'default'}
                style={{
                    width: '100%',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: currentExecution.name === 'default' ? 'var(--text-muted)' : 'var(--text-primary)',
                    marginBottom: '8px'
                }}
            />
            <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <MethodSelect value={method.value} onChange={() => { }} disabled={true} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <VariableInput
                        value={url.value}
                        readOnly={true}
                        onInput={() => { }} // Read-only
                        placeholder="https://api.example.com/v1/users"
                        parentId={parentRequest.parentId}
                        style={{
                            padding: '8px',
                            background: 'transparent',
                            border: '1px solid transparent',
                            cursor: 'default'
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
                {isLoadingSignal.value ? (
                    <button
                        onClick={handleCancel}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: 'var(--error)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        <XCircle size={18} />
                        Cancel
                    </button>
                ) : (
                    <button
                        onClick={handleSend}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        <Play size={18} fill="currentColor" />
                        Run
                    </button>
                )}
            </div>

            {/* Progress Summary */}
            <ExecutionProgress
                isLoading={isLoadingSignal}
                executionSteps={stepsSignal}
                totalExecutionTime={totalTimeSignal}
                lastResponseTime={lastResponseTimeSignal}
                responseSize={responseSizeSignal}
                responseStatus={responseStatusSignal}
            />

            <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: `${leftPanelWidth.value}%`, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                    <ExecutionRequestPanel
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
                        overriddenHeaders={overriddenHeaders.value}
                        overriddenQueryParams={overriddenQueryParams.value}
                        parentHeaderKeys={parentHeaderKeys.value}
                        parentQueryParamKeys={parentQueryParamKeys.value}
                        isBodyOverridden={isBodyOverridden.value}
                        isAuthOverridden={isAuthOverridden.value}
                        parentId={parentRequest.parentId}
                    />
                </div>
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

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', minHeight: 0 }}>
                    <ResponsePanel response={currentExecution.lastResponse || null} />
                </div>
            </div>
        </div>
    );
}
