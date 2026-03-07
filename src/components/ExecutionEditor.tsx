import { useSignal, useSignalEffect, useComputed, batch } from "@preact/signals";
import { useRef, useEffect, useCallback } from "preact/hooks";
import { ArrowLeft, Play, XCircle, Loader2, Circle, CheckCircle } from "lucide-preact";
import { formatBytes } from "../utils/format";
import { invoke } from '@tauri-apps/api/core';
import { activeExecutionId, activeRequestId, executions, requests, folders, environments, activeEnvironmentName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, ScriptItem, addLog, openTabs, activeTabId, activeFolderId, activeProjectName, ResponseData } from "../store";
import { ExecutionRequestPanel } from "./ExecutionRequestPanel";
import { ResponsePanel } from "./response/ResponsePanel";
import { MethodSelect } from "./MethodSelect";
import { VariableInput } from "./VariableInput";

export function ExecutionEditor() {
    const currentExecution = executions.value.find(e => e.id === activeExecutionId.value);

    if (!currentExecution) return null;

    // Get parent request for inheriting values
    const parentRequest = requests.value.find(r => r.id === currentExecution.requestId);

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
        const merged: { key: string, values: string[], enabled: boolean }[] = parentHeaders.map(h => ({
            key: h.key,
            values: [...h.values],
            enabled: true // Inherited default
        }));

        // Apply overrides
        execOverrides.forEach(override => {
            const index = merged.findIndex(m => m.key === override.key);
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
        overrides.forEach(override => {
            const index = merged.findIndex(m => m.key === override.key);
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

        const parent = allRequests.find(r => r.id === cExec.requestId);
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
        const mergedHeaders: { key: string, values: string[], enabled: boolean }[] = parentHeaders.map(h => ({
            key: h.key, values: [...h.values], enabled: true
        }));
        (cExec.headers || []).forEach(override => {
            const index = mergedHeaders.findIndex(m => m.key === override.key);
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

    // Loading State
    const isLoading = useSignal(false);

    // Params State
    const queryParams = useSignal<{ key: string, values: string[], enabled: boolean }[]>(getMergedQueryParams(parentRequest.url, currentExecution.queryParams));
    const pathParams = useSignal<Record<string, string>>({});
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>(currentExecution.formData ?? parentRequest.formData ?? []);

    // Execution Progress State
    const currentRequestId = useSignal<string | null>(null);
    const executionSteps = useSignal<{
        id: string;
        name: string;
        status: 'pending' | 'running' | 'completed' | 'error' | 'canceled';
        message?: string;
        duration?: number;
    }[]>([]);

    const totalExecutionTime = useSignal<number | null>(null);
    const lastResponseTime = useSignal<number | null>(null);
    const responseSize = useSignal<number | null>(null);
    const responseStatus = useSignal<number | null>(null);


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
            const f = folders.value.find(x => x.id === currentParentId);
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
                const envVar = env.variables.find(v => v.key === key);
                if (envVar) value = envVar.value;
            }

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

    const executeScript = async (scriptContent: string, context: any) => {
        try {
            const keys = Object.keys(context);
            const values = Object.values(context);
            const func = new Function(...keys, scriptContent);
            await func(...values);
        } catch (err) {
            console.error("Script Execution Error:", err);
            throw err;
        }
    };

    const updateExecutionResponse = (data: ResponseData) => {
        const id = activeExecutionId.peek();
        if (!id) return;
        executions.value = executions.peek().map(e =>
            e.id === id ? { ...e, lastResponse: data } : e
        );
    };

    const handleCancel = async () => {
        if (!currentRequestId.value) return;
        try {
            await invoke('cancel_http_request', { requestId: currentRequestId.value });
            addLog('info', 'Request cancellation requested', 'System');
        } catch (err) {
            console.error('Failed to cancel request', err);
        }
    };

    const handleSend = async () => {
        if (isLoading.value) return;

        const requestId = Math.random().toString(36).substring(7);
        currentRequestId.value = requestId;
        isLoading.value = true;
        updateExecutionResponse({
            status: 0,
            headers: {},
            body: 'Initializing...',
            time: 0,
            size: 0
        });
        totalExecutionTime.value = null;
        lastResponseTime.value = null;
        responseSize.value = null;
        responseStatus.value = null;

        // Initialize Steps
        const steps = [
            { id: 'pre-scripts', name: 'Pre-request Scripts', status: 'pending' as const },
            { id: 'prep', name: 'Preparing Request', status: 'pending' as const },
            { id: 'http', name: 'HTTP Request', status: 'pending' as const },
            { id: 'post-scripts', name: 'Post-request Scripts', status: 'pending' as const },
        ];
        executionSteps.value = steps;

        const setStepStatus = (id: string, status: 'pending' | 'running' | 'completed' | 'error' | 'canceled', message?: string, duration?: number) => {
            executionSteps.value = executionSteps.peek().map(s =>
                s.id === id ? { ...s, status, message, duration } : s
            );
        };

        const startTime = Date.now();

        try {
            const activeEnv = environments.peek().find(e => e.name === activeEnvironmentName.peek());

            const scriptContext = {
                // ... same script context ...
                console: {
                    ...console,
                    log: (...args: any[]) => {
                        console.log(...args);
                        addLog('info', args.map(a => String(a)).join(' '), 'Script');
                    },
                    error: (...args: any[]) => {
                        console.error(...args);
                        addLog('error', args.map(a => String(a)).join(' '), 'Script');
                    },
                    warn: (...args: any[]) => {
                        console.warn(...args);
                        addLog('warn', args.map(a => String(a)).join(' '), 'Script');
                    },
                    info: (...args: any[]) => {
                        console.info(...args);
                        addLog('info', args.map(a => String(a)).join(' '), 'Script');
                    }
                },
                env: {
                    get: (key: string) => {
                        const fromActive = activeEnv?.variables.find(v => v.key === key)?.value;
                        if (fromActive !== undefined) return fromActive;
                        const globalEnv = environments.peek().find(e => e.name === 'Global');
                        return globalEnv?.variables.find(v => v.key === key)?.value;
                    },
                    set: (key: string, value: string) => {
                        const targetEnv = activeEnv || environments.peek().find(e => e.name === 'Global');
                        if (!targetEnv) return;

                        const existing = targetEnv.variables.find(v => v.key === key);
                        if (existing) {
                            existing.value = value;
                        } else {
                            targetEnv.variables.push({ key, value });
                        }
                        environments.value = [...environments.peek()];
                    }
                },
                request: {
                    get method() { return method.peek(); },
                    set method(v) { method.value = v; },
                    get url() { return url.peek(); },
                    set url(v) { url.value = v; },
                    get body() { return body.peek(); },
                    set body(v) { body.value = v; },
                    headers: {
                        get: (key: string) => headers.peek().find(h => h.key === key)?.values[0],
                        set: (key: string, value: string) => {
                            const current = headers.peek();
                            const idx = current.findIndex(h => h.key === key);
                            if (idx !== -1) {
                                const next = [...current];
                                next[idx] = { ...next[idx], values: [value], enabled: true };
                                headers.value = next;
                            } else {
                                headers.value = [...current, { key, values: [value], enabled: true }];
                            }
                        },
                        remove: (key: string) => {
                            headers.value = headers.peek().filter(h => h.key !== key);
                        },
                        all: () => {
                            return headers.peek().reduce((acc, h) => {
                                if (h.key) acc[h.key] = h.values[0];
                                return acc;
                            }, {} as Record<string, string>);
                        }
                    },
                    queryParams: {
                        get: (key: string) => queryParams.peek().find(p => p.key === key)?.values[0],
                        set: (key: string, value: string) => {
                            const current = queryParams.peek();
                            const idx = current.findIndex(p => p.key === key);
                            if (idx !== -1) {
                                const next = [...current];
                                next[idx] = { ...next[idx], values: [value], enabled: true };
                                queryParams.value = next;
                            } else {
                                queryParams.value = [...current, { key, values: [value], enabled: true }];
                            }
                        },
                        add: (key: string, value: string) => {
                            queryParams.value = [...queryParams.peek(), { key, values: [value], enabled: true }];
                        },
                        remove: (key: string) => {
                            queryParams.value = queryParams.peek().filter(p => p.key !== key);
                        },
                        all: () => {
                            return queryParams.peek().reduce((acc, p) => {
                                if (p.key) acc[p.key] = p.values[0];
                                return acc;
                            }, {} as Record<string, string>);
                        }
                    }
                }
            };

            // 1. Pre-scripts
            setStepStatus('pre-scripts', 'running');
            const preStartTime = Date.now();
            const enabledPreScripts = preScripts.peek().filter(s => s.enabled);
            if (enabledPreScripts.length > 0) {
                for (const script of enabledPreScripts) {
                    try {
                        console.log(`Executing Pre-Script: ${script.name}`);
                        await executeScript(script.content, scriptContext);
                    } catch (e) {
                        setStepStatus('pre-scripts', 'error', String(e), Date.now() - preStartTime);
                        throw new Error(`Pre-Script "${script.name}" failed: ${e}`);
                    }
                }
            }
            setStepStatus('pre-scripts', 'completed', undefined, Date.now() - preStartTime);

            // 2. Prep
            setStepStatus('prep', 'running');
            const prepStartTime = Date.now();
            // Snapshot Request Data
            const requestRaw = generateRawRequest();
            const requestCurl = generateCurl();
            const finalRequestUrl = getFinalUrl(true);
            const finalRequestMethod = method.value;

            updateExecutionResponse({
                status: 0, // Loading
                headers: {},
                body: 'Requesting...',
                requestRaw,
                requestCurl,
                requestUrl: finalRequestUrl,
                requestMethod: finalRequestMethod
            });

            const startHeaders = parentRequest ? resolveHeaders(parentRequest.id) : [];
            const finalHeaders: string[][] = [];

            startHeaders.forEach(h => {
                if (h.key && h.values) {
                    h.values.forEach(v => {
                        finalHeaders.push([h.key, substituteVariables(v)]);
                    });
                }
            });

            headers.value.forEach(h => {
                if (h.key && h.values.length > 0 && h.enabled) {
                    // Remove any existing header with this key (override)
                    const existingIdxs = finalHeaders.reduce((acc, fh, idx) => {
                        if (fh[0] === h.key) acc.push(idx);
                        return acc;
                    }, [] as number[]);

                    // Remove from backwards to keep indexes valid
                    existingIdxs.reverse().forEach(idx => finalHeaders.splice(idx, 1));

                    h.values.forEach(v => {
                        finalHeaders.push([h.key, substituteVariables(v)]);
                    });
                }
            });

            let authConfig = auth.value;
            if (authConfig.type === 'inherit' && inheritedAuth.value) {
                authConfig = inheritedAuth.value.config;
            }

            if (authConfig.type === 'basic' && authConfig.basic) {
                const token = btoa(`${substituteVariables(authConfig.basic.username)}:${substituteVariables(authConfig.basic.password)}`);
                finalHeaders.push(['Authorization', `Basic ${token}`]);
            } else if (authConfig.type === 'bearer' && authConfig.bearer) {
                finalHeaders.push(['Authorization', `Bearer ${substituteVariables(authConfig.bearer.token)}`]);
            }

            const finalUrl = getFinalUrl();
            let finalBody = bodyType.value === 'none' ? null : substituteVariables(body.value);
            let formDataArgs: any = null;

            if (bodyType.value === 'form_urlencoded') {
                const params = new URLSearchParams();
                formData.value.forEach(group => {
                    group.values.forEach(v => {
                        params.append(group.key, substituteVariables(v));
                    });
                });
                finalBody = params.toString();
                if (!finalHeaders.find(fh => fh[0] === 'Content-Type')) {
                    finalHeaders.push(['Content-Type', 'application/x-www-form-urlencoded']);
                }
            } else if (bodyType.value === 'multipart') {
                formDataArgs = [];
                formData.value.forEach(group => {
                    group.values.forEach(v => {
                        formDataArgs.push({
                            key: group.key,
                            value: substituteVariables(v),
                            entry_type: group.type
                        });
                    });
                });
                finalBody = null;
            } else {
                if (!finalHeaders.find(fh => fh[0] === 'Content-Type') && bodyType.value !== 'none') {
                    switch (bodyType.value) {
                        case 'json': finalHeaders.push(['Content-Type', 'application/json']); break;
                        case 'xml': finalHeaders.push(['Content-Type', 'application/xml']); break;
                        case 'yaml': finalHeaders.push(['Content-Type', 'application/x-yaml']); break;
                    }
                }
            }
            setStepStatus('prep', 'completed', undefined, Date.now() - prepStartTime);

            // 3. HTTP Request
            setStepStatus('http', 'running');
            const httpStartTime = Date.now();
            const res = await invoke<{ status: number, headers: string[][], body: string, time_taken: number }>('http_request', {
                args: {
                    method: String(method.value || 'GET'),
                    url: String(finalUrl || ''),
                    headers: finalHeaders,
                    body: finalBody,
                    form_data: formDataArgs,
                    request_id: requestId,
                    project_name: activeProjectName.peek()
                }
            });
            const httpDuration = Date.now() - httpStartTime;
            setStepStatus('http', 'completed', undefined, res.time_taken || httpDuration);

            // Handle Response...
            const endTime = Date.now();
            const respTime = res.time_taken || (endTime - startTime);
            lastResponseTime.value = respTime;
            responseSize.value = res.body.length;
            responseStatus.value = res.status;

            updateExecutionResponse({
                ...currentExecution.lastResponse!,
                status: res.status,
                headers: res.headers,
                body: res.body,
                time: respTime,
                size: res.body.length
            });

            // 4. Post-scripts
            setStepStatus('post-scripts', 'running');
            const postStartTime = Date.now();
            const enabledPostScripts = postScripts.peek().filter(s => s.enabled);
            if (enabledPostScripts.length > 0) {
                // Post-script Context
                const postScriptContext = {
                    ...scriptContext,
                    response: {
                        status: res.status,
                        headers: res.headers,
                        body: res.body,
                        json: () => {
                            try { return JSON.parse(res.body); }
                            catch (e) { return null; }
                        }
                    }
                };

                for (const script of enabledPostScripts) {
                    const statusFilter = script.executeOnStatusCodes || 'all';
                    const matchesStatus = statusFilter === 'all' ||
                        statusFilter.split(',').map(s => s.trim()).includes(res.status.toString()) ||
                        (statusFilter === '2xx' && res.status >= 200 && res.status < 300);

                    if (matchesStatus) {
                        try {
                            console.log(`Executing Post-Script: ${script.name}`);
                            await executeScript(script.content, postScriptContext);
                        } catch (e) {
                            addLog('error', `Post-Script "${script.name}" failed: ${e}`, 'Request');
                        }
                    }
                }
            }
            setStepStatus('post-scripts', 'completed', undefined, Date.now() - postStartTime);
            totalExecutionTime.value = Date.now() - startTime;

        } catch (err) {
            console.error(err);
            const errStr = String(err);
            const isCanceled = errStr.includes('Canceled');

            if (isCanceled) {
                setStepStatus('http', 'canceled');
                executionSteps.value = executionSteps.peek().map(s =>
                    s.status === 'pending' || s.status === 'running' ? { ...s, status: s.id === 'http' ? 'canceled' : s.status } : s
                );
            } else {
                // Find current running step and mark as error
                executionSteps.value = executionSteps.peek().map(s =>
                    s.status === 'running' ? { ...s, status: 'error', message: errStr } : s
                );
            }

            updateExecutionResponse({
                status: 0,
                headers: {},
                body: isCanceled ? 'Request Canceled' : `Error: ${err}`,
                size: 0,
                time: 0
            });
        } finally {
            isLoading.value = false;
            currentRequestId.value = null;
        }
    };

    const generateRawRequest = () => {
        const urlWithQuery = getFinalUrl(true);
        const methodStr = method.value;

        const startHeaders = parentRequest ? resolveHeaders(parentRequest.id) : [];
        const finalHeadersFlat: [string, string][] = [];

        startHeaders.forEach(h => {
            if (h.key && h.values) {
                h.values.forEach(v => {
                    finalHeadersFlat.push([h.key, substituteVariables(v)]);
                });
            }
        });

        headers.value.forEach(h => {
            if (h.key && h.values.length > 0 && h.enabled) {
                // For raw display, we usually show overrides by removing parent and adding ours
                const existingIdxs = finalHeadersFlat.reduce((acc, fh, idx) => {
                    if (fh[0] === h.key) acc.push(idx);
                    return acc;
                }, [] as number[]);
                existingIdxs.reverse().forEach(idx => finalHeadersFlat.splice(idx, 1));

                h.values.forEach(v => {
                    finalHeadersFlat.push([h.key, substituteVariables(v)]);
                });
            }
        });

        let authConfig = auth.value;
        if (authConfig.type === 'inherit' && inheritedAuth.value) {
            authConfig = inheritedAuth.value.config;
        }

        if (authConfig.type === 'basic' && authConfig.basic) {
            const token = btoa(`${substituteVariables(authConfig.basic.username)}:${substituteVariables(authConfig.basic.password)}`);
            finalHeadersFlat.push(['Authorization', `Basic ${token}`]);
        } else if (authConfig.type === 'bearer' && authConfig.bearer) {
            finalHeadersFlat.push(['Authorization', `Bearer ${substituteVariables(authConfig.bearer.token)}`]);
        }

        let raw = `${methodStr} ${urlWithQuery} HTTP/1.1\n`;

        // Add content-type if missing
        if (!finalHeadersFlat.find(fh => fh[0] === 'Content-Type') && bodyType.value !== 'none') {
            let contentType: string | null = null;
            switch (bodyType.value) {
                case 'json': contentType = 'application/json'; break;
                case 'xml': contentType = 'application/xml'; break;
                case 'html': contentType = 'text/html'; break;
                case 'form_urlencoded': contentType = 'application/x-www-form-urlencoded'; break;
                case 'text': contentType = 'text/plain'; break;
                case 'javascript': contentType = 'application/javascript'; break;
                case 'yaml': contentType = 'application/x-yaml'; break;
            }
            if (contentType) finalHeadersFlat.push(['Content-Type', contentType]);
        }

        finalHeadersFlat.forEach(([key, val]) => {
            raw += `${key}: ${val}\n`;
        });

        raw += '\n';
        if (bodyType.value !== 'none') {
            raw += substituteVariables(body.value);
        }

        return raw;
    };

    const generateCurl = () => {
        let cmd = `curl -X ${method.value} '${getFinalUrl()}'`;

        const startHeaders = parentRequest ? resolveHeaders(parentRequest.id) : [];
        const finalHeadersFlat: [string, string][] = [];

        startHeaders.forEach(h => {
            if (h.key && h.values) {
                h.values.forEach(v => {
                    finalHeadersFlat.push([h.key, substituteVariables(v)]);
                });
            }
        });

        headers.value.forEach(h => {
            if (h.key && h.values.length > 0 && h.enabled) {
                // Remove parent ones
                const existingIdxs = finalHeadersFlat.reduce((acc, fh, idx) => {
                    if (fh[0] === h.key) acc.push(idx);
                    return acc;
                }, [] as number[]);
                existingIdxs.reverse().forEach(idx => finalHeadersFlat.splice(idx, 1));

                h.values.forEach(v => {
                    finalHeadersFlat.push([h.key, substituteVariables(v)]);
                });
            }
        });

        let authConfig = auth.value;
        if (authConfig.type === 'inherit' && inheritedAuth.value) {
            authConfig = inheritedAuth.value.config;
        }

        if (authConfig.type === 'basic' && authConfig.basic) {
            const token = btoa(`${substituteVariables(authConfig.basic.username)}:${substituteVariables(authConfig.basic.password)}`);
            finalHeadersFlat.push(['Authorization', `Basic ${token}`]);
        } else if (authConfig.type === 'bearer' && authConfig.bearer) {
            finalHeadersFlat.push(['Authorization', `Bearer ${substituteVariables(authConfig.bearer.token)}`]);
        }

        finalHeadersFlat.forEach(([key, val]) => {
            cmd += ` \\\n  -H "${key}: ${val}"`;
        });

        if (!finalHeadersFlat.find(fh => fh[0] === 'Content-Type')) {
            let contentType: string | null = null;
            switch (bodyType.value) {
                case 'json': contentType = 'application/json'; break;
                case 'xml': contentType = 'application/xml'; break;
                case 'html': contentType = 'text/html'; break;
                case 'form_urlencoded': contentType = 'application/x-www-form-urlencoded'; break;
                case 'text': contentType = 'text/plain'; break;
                case 'javascript': contentType = 'application/javascript'; break;
                case 'yaml': contentType = 'application/x-yaml'; break;
            }
            if (contentType) {
                cmd += ` \\\n  -H "Content-Type: ${contentType}"`;
            }
        }

        if (bodyType.value === 'multipart') {
            formData.value.forEach(group => {
                group.values.forEach(v => {
                    const subV = substituteVariables(v);
                    if (group.type === 'file') {
                        cmd += ` \\\n  -F "${group.key}=@${subV}"`;
                    } else {
                        cmd += ` \\\n  -F "${group.key}=${subV}"`;
                    }
                });
            });
        } else if (bodyType.value === 'form_urlencoded') {
            formData.value.forEach(group => {
                group.values.forEach(v => {
                    const subV = substituteVariables(v);
                    cmd += ` \\\n  -d "${group.key}=${subV}"`;
                });
            });
        } else if (bodyType.value !== 'none' && body.value) {
            const escapedBody = substituteVariables(body.value).replace(/'/g, "'\\''");
            cmd += ` \\\n  -d '${escapedBody}'`;
        }

        return cmd;
    };

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
                {isLoading.value ? (
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
            {(isLoading.value || executionSteps.value.length > 0) && (
                <div style={{
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Execution Progress</span>
                            {(totalExecutionTime.value !== null || lastResponseTime.value !== null) && (
                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-base)', padding: '2px 8px', borderRadius: '4px' }}>
                                    {totalExecutionTime.value !== null && (
                                        <span>Total Time: <strong style={{ color: 'var(--text-secondary)' }}>{totalExecutionTime.value}ms</strong></span>
                                    )}
                                    {responseSize.value !== null && (
                                        <span>Size: <strong style={{ color: 'var(--success)' }}>{formatBytes(responseSize.value)}</strong></span>
                                    )}
                                    {responseStatus.value !== null && (
                                        <span>Status: <strong style={{
                                            color: responseStatus.value >= 200 && responseStatus.value < 300 ? 'var(--success)' :
                                                responseStatus.value >= 400 ? 'var(--error)' : 'var(--warning)'
                                        }}>{responseStatus.value}</strong></span>
                                    )}
                                </div>
                            )}
                        </div>
                        {isLoading.value && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        {executionSteps.value.map(step => (
                            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step.status === 'pending' ? 0.5 : 1 }}>
                                {step.status === 'pending' && <Circle size={16} style={{ color: 'var(--text-muted)' }} />}
                                {step.status === 'running' && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
                                {step.status === 'completed' && <CheckCircle size={16} style={{ color: 'var(--success)' }} />}
                                {step.status === 'error' && <XCircle size={16} style={{ color: 'var(--error)' }} />}
                                {step.status === 'canceled' && <XCircle size={16} style={{ color: 'var(--warning)' }} />}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: step.status === 'running' ? 'bold' : 'normal' }}>{step.name}</span>
                                        {step.duration !== undefined && (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-base)', padding: '0px 4px', borderRadius: '2px' }}>
                                                {step.duration}ms
                                            </span>
                                        )}
                                    </div>
                                    {step.message && <span style={{ fontSize: '0.7rem', color: 'var(--error)' }}>{step.message}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
