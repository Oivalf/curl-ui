import { useSignal, useSignalEffect, useComputed, batch } from "@preact/signals";
import { useRef, useEffect, useCallback } from "preact/hooks";
import { ArrowLeft, Play, XCircle, Loader2, Circle, CheckCircle } from "lucide-preact";
import { formatBytes } from "../utils/format";
import { invoke } from '@tauri-apps/api/core';
import { activeExecutionId, activeRequestId, executions, requests, folders, environments, activeEnvironmentName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, responseData, ScriptItem, addLog, openTabs, activeTabId, activeFolderId } from "../store";
import { ExecutionRequestPanel } from "./ExecutionRequestPanel";
import { ResponsePanel } from "./ResponsePanel";
import { MethodSelect } from "./MethodSelect";

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

    const { base: initialBase, params: derivedParams } = parseUrl(currentExecution.url ?? parentRequest.url);

    // Logic: 
    // 1. If execution has `queryParams`, use them.
    // 2. Else parse `currentExecution.url` (if set) or `parentRequest.url`.
    const initialParams = currentExecution.queryParams && currentExecution.queryParams.length > 0
        ? currentExecution.queryParams
        : derivedParams;

    // Re-parsing parent just to have clean start if needed (actually just need parseUrl logic available)
    // We don't need to call it here if we don't use the result immediately, but overriddenQueryParams uses it.

    const url = useSignal(initialBase);
    const method = useSignal(currentExecution.method ?? parentRequest.method);

    // Convert headers object to array for easier editing
    // Merge parent headers with execution overrides
    const getMergedHeaders = () => {
        const parentHeaders = Object.entries(parentRequest.headers || {});
        // e.headers is now KeyValueItem[] | undefined
        const execOverrides = currentExecution.headers || [];

        // Start with parent headers (defaults)
        const merged: { key: string, value: string, enabled: boolean }[] = parentHeaders.map(([k, v]) => ({
            key: k,
            value: v,
            enabled: true // Inherited default
        }));

        // Apply overrides
        execOverrides.forEach(override => {
            const index = merged.findIndex(m => m.key === override.key);
            if (index !== -1) {
                // Update existing
                merged[index] = { ...override };
            } else {
                // Add new
                merged.push({ ...override });
            }
        });

        return merged;
    };

    const headers = useSignal<{ key: string, value: string, enabled: boolean }[]>(getMergedHeaders());
    const body = useSignal(currentExecution.body ?? parentRequest.body ?? '');
    const bodyType = useSignal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>('none');

    // Auto-detect body type
    useSignalEffect(() => {
        const content = body.value;
        if (content && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
            bodyType.value = 'json';
        } else if (!content) {
            bodyType.value = 'none';
        }
    });
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
        const { base, params: pParams } = parseUrl(cExec.url ?? parentRequest.url);

        url.value = base;
        method.value = cExec.method ?? parentRequest.method;
        body.value = cExec.body ?? parentRequest.body ?? '';
        auth.value = cExec.auth ?? parentRequest.auth ?? { type: 'inherit' };
        preScripts.value = cExec.preScripts ?? parentRequest.preScripts ?? [];
        postScripts.value = cExec.postScripts ?? parentRequest.postScripts ?? [];

        // Params initialization
        queryParams.value = cExec.queryParams && cExec.queryParams.length > 0 ? cExec.queryParams : pParams;
        pathParams.value = initialPathParams;

        // Headers initialization
        headers.value = getMergedHeaders();
    }, [activeExecutionId.value, parentRequest?.id]);

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
    const queryParams = useSignal<{ key: string, value: string, enabled: boolean }[]>(initialParams);
    const pathParams = useSignal<Record<string, string>>({});
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>([]);

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

    const updateUrlFromParams = (newParams: { key: string, value: string, enabled: boolean }[]) => {
        queryParams.value = newParams;
    };

    const detectedPathKeys = useSignal<string[]>([]);

    useSignalEffect(() => {
        const matches = url.value.match(/(?<!\{)\{[a-zA-Z0-9_]+\}(?!\})/g);
        detectedPathKeys.value = matches ? matches.map(m => m.slice(1, -1)) : [];
    });

    const getFinalUrl = (includeQuery = true) => {
        let finalUrl = url.value;
        detectedPathKeys.value.forEach(key => {
            if (pathParams.value[key]) {
                finalUrl = finalUrl.replace(`{${key}}`, pathParams.value[key]);
            }
        });

        if (includeQuery && queryParams.value.length > 0) {
            const searchParams = new URLSearchParams();
            queryParams.value.forEach(p => {
                if (p.key && p.enabled) {
                    searchParams.append(p.key, p.value);
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

    // Detect Overrides for UI highlighting
    const overriddenHeaders = useComputed(() => {
        const parentHeaderMap = parentRequest.headers || {};
        return new Set(headers.value.filter(h => h.key && parentHeaderMap[h.key] !== undefined && h.value !== parentHeaderMap[h.key]).map(h => h.key));
    });

    const overriddenQueryParams = useComputed(() => {
        const { params: parentParams } = parseUrl(parentRequest.url);
        const overriddenKeys = new Set<string>();
        // Simple override check: if key exists in execution but value diffs from parent's *first* occurrence?
        // Or if the whole set for that key differs?
        // Since we moved to flat list for Execution, let's just check if p is strictly equal to any parent param.
        // Actually, highlighting might be complex with duplicates.
        // Let's simplify: Mark as overridden if it doesn't exist exactly in parent.

        queryParams.value.forEach(p => {
            const inParent = parentParams.some(pp => pp.key === p.key && pp.value === p.value);
            if (!inParent) {
                overriddenKeys.add(p.key);
            }
        });
        return overriddenKeys;
    });

    const parentHeaderKeys = useComputed(() => new Set(Object.keys(parentRequest.headers || {})));
    const parentQueryParamKeys = useComputed(() => {
        const { params } = parseUrl(parentRequest.url);
        return new Set(params.map(p => p.key));
    });

    const isBodyOverridden = useComputed(() => body.value !== (parentRequest.body ?? ''));
    const isAuthOverridden = useComputed(() => JSON.stringify(auth.value) !== JSON.stringify(parentRequest.auth ?? { type: 'inherit' }));

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    // Sync Local State to Global Store
    useSignalEffect(() => {
        const currentName = name.value;
        const currentHeaders = headers.value;
        const currentQueryParams = queryParams.value;
        const currentPathParams = pathParams.value;
        const currentBody = body.value;
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
            const parentHeaders = parentRequest.headers || {};
            const parentHeaderKeysList = Object.keys(parentHeaders);
            let matchesParentHeaders = true;
            if (currentHeaders.length !== parentHeaderKeysList.length) {
                matchesParentHeaders = false;
            } else {
                for (const h of currentHeaders) {
                    if (!h.enabled || parentHeaders[h.key] !== h.value) {
                        matchesParentHeaders = false;
                        break;
                    }
                }
            }
            const finalHeaders = matchesParentHeaders ? undefined : currentHeaders;

            // 2. Query Params Inheritance Check
            const { params: parentParams } = parseUrl(parentRequest.url);
            let matchesParentParams = true;
            if (currentQueryParams.length !== parentParams.length) {
                matchesParentParams = false;
            } else {
                for (let i = 0; i < currentQueryParams.length; i++) {
                    const c = currentQueryParams[i];
                    const p = parentParams[i];
                    if (!c.enabled || c.key !== p.key || c.value !== p.value) {
                        matchesParentParams = false;
                        break;
                    }
                }
            }
            const finalQueryParams = matchesParentParams ? undefined : currentQueryParams;

            // 3. Path Params Inheritance Check (new)
            const finalPathParams = Object.keys(currentPathParams).length === 0 ? undefined : currentPathParams;

            // 4. Other fields
            const finalBody = currentBody === (parentRequest.body ?? '') ? undefined : currentBody;
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

            if (exec.name !== currentName || headersChanged || paramsChanged || pathParamsChanged || exec.body !== finalBody || authChanged || preScriptsChanged || postScriptsChanged) {
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
                        body: finalBody,
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

    const substituteVariables = (text: string): string => {
        if (!text) return text;
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
        responseData.value = null;
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
            const finalRequestUrl = substituteVariables(getFinalUrl(true));
            const finalRequestMethod = method.value;

            responseData.value = {
                status: 0, // Loading
                headers: {},
                body: 'Requesting...',
                requestRaw,
                requestCurl,
                requestUrl: finalRequestUrl,
                requestMethod: finalRequestMethod
            };

            // Use parent request ID to resolve headers hierarchy
            const startHeaders = parentRequest ? resolveHeaders(parentRequest.id) : [];
            const finalHeaders: Record<string, string> = {};

            startHeaders.forEach(h => {
                if (h.key && h.value) {
                    finalHeaders[h.key] = substituteVariables(h.value);
                }
            });

            headers.value.forEach(h => {
                if (h.key && h.value && h.enabled) {
                    finalHeaders[h.key] = substituteVariables(h.value);
                }
            });

            let authConfig = auth.value;
            if (authConfig.type === 'inherit' && inheritedAuth.value) {
                authConfig = inheritedAuth.value.config;
            }

            if (authConfig.type === 'basic' && authConfig.basic) {
                const token = btoa(`${substituteVariables(authConfig.basic.username)}:${substituteVariables(authConfig.basic.password)}`);
                finalHeaders['Authorization'] = `Basic ${token}`;
            } else if (authConfig.type === 'bearer' && authConfig.bearer) {
                finalHeaders['Authorization'] = `Bearer ${substituteVariables(authConfig.bearer.token)}`;
            }

            const finalUrl = substituteVariables(getFinalUrl());
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
                if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
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
                if (!finalHeaders['Content-Type'] && bodyType.value !== 'none') {
                    switch (bodyType.value) {
                        case 'json': finalHeaders['Content-Type'] = 'application/json'; break;
                        case 'xml': finalHeaders['Content-Type'] = 'application/xml'; break;
                        case 'yaml': finalHeaders['Content-Type'] = 'application/x-yaml'; break;
                    }
                }
            }
            setStepStatus('prep', 'completed', undefined, Date.now() - prepStartTime);

            // 3. HTTP Request
            setStepStatus('http', 'running');
            const httpStartTime = Date.now();
            const res = await invoke<{ status: number, headers: Record<string, string>, body: string, time_taken: number }>('http_request', {
                args: {
                    method: method.value,
                    url: finalUrl,
                    headers: finalHeaders,
                    body: finalBody,
                    form_data: formDataArgs,
                    request_id: requestId
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

            responseData.value = {
                ...responseData.value!,
                status: res.status,
                headers: res.headers,
                body: res.body,
                time: respTime,
                size: res.body.length
            };

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

            responseData.value = {
                status: 0,
                headers: {},
                body: isCanceled ? 'Request Canceled' : `Error: ${err}`,
                size: 0,
                time: 0
            };
        } finally {
            isLoading.value = false;
            currentRequestId.value = null;
        }
    };

    const generateRawRequest = () => {
        const urlWithQuery = substituteVariables(getFinalUrl(true));
        const methodStr = method.value;

        const startHeaders = parentRequest ? resolveHeaders(parentRequest.id) : [];
        const finalHeaders: Record<string, string> = {};

        startHeaders.forEach(h => {
            if (h.key && h.value) {
                finalHeaders[h.key] = substituteVariables(h.value);
            }
        });

        headers.value.forEach(h => {
            if (h.key && h.value && h.enabled) {
                finalHeaders[h.key] = substituteVariables(h.value);
            }
        });

        let authConfig = auth.value;
        if (authConfig.type === 'inherit' && inheritedAuth.value) {
            authConfig = inheritedAuth.value.config;
        }

        if (authConfig.type === 'basic' && authConfig.basic) {
            const token = btoa(`${substituteVariables(authConfig.basic.username)}:${substituteVariables(authConfig.basic.password)}`);
            finalHeaders['Authorization'] = `Basic ${token}`;
        } else if (authConfig.type === 'bearer' && authConfig.bearer) {
            finalHeaders['Authorization'] = `Bearer ${substituteVariables(authConfig.bearer.token)}`;
        }

        let raw = `${methodStr} ${urlWithQuery} HTTP/1.1\n`;

        // Add content-type if missing
        if (!finalHeaders['Content-Type'] && bodyType.value !== 'none') {
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
            if (contentType) finalHeaders['Content-Type'] = contentType;
        }

        for (const key in finalHeaders) {
            raw += `${key}: ${finalHeaders[key]}\n`;
        }

        raw += '\n';
        if (bodyType.value !== 'none') {
            raw += substituteVariables(body.value);
        }

        return raw;
    };

    const generateCurl = () => {
        let cmd = `curl -X ${method.value} '${substituteVariables(getFinalUrl())}'`;

        const startHeaders = parentRequest ? resolveHeaders(parentRequest.id) : [];
        const finalHeaders: Record<string, string> = {};

        startHeaders.forEach(h => {
            if (h.key && h.value) {
                finalHeaders[h.key] = substituteVariables(h.value);
            }
        });

        headers.value.forEach(h => {
            if (h.key && h.value && h.enabled) {
                finalHeaders[h.key] = substituteVariables(h.value);
            }
        });

        let authConfig = auth.value;
        if (authConfig.type === 'inherit' && inheritedAuth.value) {
            authConfig = inheritedAuth.value.config;
        }

        if (authConfig.type === 'basic' && authConfig.basic) {
            const token = btoa(`${substituteVariables(authConfig.basic.username)}:${substituteVariables(authConfig.basic.password)}`);
            finalHeaders['Authorization'] = `Basic ${token}`;
        } else if (authConfig.type === 'bearer' && authConfig.bearer) {
            finalHeaders['Authorization'] = `Bearer ${substituteVariables(authConfig.bearer.token)}`;
        }

        for (const key in finalHeaders) {
            cmd += ` \\\n  -H "${key}: ${finalHeaders[key]}"`;
        }

        if (!finalHeaders['Content-Type']) {
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
                    <input
                        type="text"
                        value={url.value}
                        readOnly={true}
                        onInput={() => { }} // Read-only
                        onKeyDown={handleKeyDown}
                        placeholder="https://api.example.com/v1/users"
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: 'transparent',
                            border: '1px solid transparent',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.9rem',
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
                    <ResponsePanel />
                </div>
            </div>
        </div>
    );
}
