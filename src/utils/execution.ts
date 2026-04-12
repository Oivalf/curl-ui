import { invoke } from '@tauri-apps/api/core';
import { 
    executions, requests, folders, environments, 
    activeEnvName, activeProjectName, 
    addLog, ExecutionProgressState, executionProgressMap,
    ResponseData, resolveHeaders, resolveAuth, AuthConfig, ScriptItem, TableRow
} from '../store';

/**
 * Global map of active request IDs for cancellation
 */
export const activeHttpRequests = new Map<string, string>();

/**
 * Helper to substitute variables in text
 */
export const substituteVariables = (text: string, requestId: string, extraVars?: Record<string, string>, maxDepth: number = 10): string => {
    if (!text) return text;
    
    let result = text;
    let iterations = 0;
    
    const env = environments.peek().find(e => e.name === activeEnvName.peek());
    const req = requests.peek().find(r => r.id === requestId);
    if (!req) return text;

    // Build Scope Chain: [Leaf Folder, ..., Root Folder]
    const folderScopes: any[] = [];
    let currentParentId = req.parentId;

    while (currentParentId) {
        const f = folders.peek().find(x => x.id === currentParentId);
        if (f) {
            folderScopes.push(f);
            currentParentId = f.parentId;
        } else break;
    }

    while (result.includes('{{') && iterations < maxDepth) {
        const placeholders = Array.from(new Set(result.match(/{{([\s\S]+?)}}/g) || []));
        if (placeholders.length === 0) break;

        let passResolved = false;
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            let value: string | null = null;

            // 0. Check Extra Variables
            if (extraVars && typeof extraVars[key] === 'string') {
                value = extraVars[key];
            }

            // 1. Check Folder Scopes (Leaf -> Root)
            if (value === null) {
                for (const folder of folderScopes) {
                    if (folder.variables) {
                        const vars = folder.variables as Record<string, string>;
                        if (typeof vars[key] === 'string') {
                            value = vars[key];
                            break;
                        }
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
                const globalEnv = environments.peek().find(e => e.name === 'Global');
                if (globalEnv) {
                    const globalVar = globalEnv.variables.find(v => v.key === key);
                    if (globalVar) value = globalVar.value;
                }
            }

            if (value !== null) {
                const nextResult = result.split(placeholder).join(value);
                if (nextResult !== result) {
                    result = nextResult;
                    passResolved = true;
                }
            }
        });

        if (!passResolved) break;
        iterations++;
    }

    if (iterations >= maxDepth && result.includes('{{')) {
        addLog('warn', `Circular dependency or too many nested variables detected in execution: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, 'Variable Resolver');
    }

    return result;
};

/**
 * Execute a script in a restricted context
 */
export const executeScript = async (scriptContent: string, context: any) => {
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

export interface ExecutionOverrides {
    url?: string;
    method?: string;
    headers?: TableRow[];
    queryParams?: TableRow[];
    body?: string;
    bodyType?: string;
    auth?: AuthConfig;
    preScripts?: ScriptItem[];
    postScripts?: ScriptItem[];
    additionalPreScripts?: ScriptItem[];
    additionalPostScripts?: ScriptItem[];
    formData?: any[];
    pathParams?: Record<string, string>;
}

/**
 * Main execution function
 */
export const runExecution = async (
    executionId: string, 
    overrides?: ExecutionOverrides,
    extraVars?: Record<string, string>,
    isEphemeral?: boolean,
    scriptContextOverrides?: any
): Promise<ResponseData | undefined> => {
    const execution = executions.peek().find(e => e.id === executionId);
    if (!execution) return;

    const parentRequest = requests.peek().find(r => r.id === execution.requestId);
    if (!parentRequest) return;

    // Initialize Progress
    const progress: ExecutionProgressState = {
        isLoading: true,
        steps: [
            { id: 'pre-scripts', name: 'Pre-request Scripts', status: 'pending' },
            { id: 'prep', name: 'Preparing Request', status: 'pending' },
            { id: 'http', name: 'HTTP Request', status: 'pending' },
            { id: 'post-scripts', name: 'Post-request Scripts', status: 'pending' },
        ],
        startTime: Date.now(),
        totalTime: null,
        lastResponseTime: null,
        responseSize: null,
        responseStatus: null
    };

    const activeExecutionId = isEphemeral ? `temp_${executionId}` : executionId;

    const updateProgress = (next: Partial<ExecutionProgressState>) => {
        executionProgressMap.value = {
            ...executionProgressMap.peek(),
            [activeExecutionId]: { ...progress, ...next }
        };
        Object.assign(progress, next); // Sync local copy for easier access
    };

    const setStepStatus = (id: string, status: any, message?: string, duration?: number) => {
        const nextSteps = progress.steps.map(s =>
            s.id === id ? { ...s, status, message, duration } : s
        );
        updateProgress({ steps: nextSteps });
    };

    const updateExecutionResponse = (data: ResponseData) => {
        if (isEphemeral) return;
        executions.value = executions.peek().map(e =>
            e.id === executionId ? { ...e, lastResponse: data, resultsVisible: true } : e
        );
    };

    const tauriRequestId = Math.random().toString(36).substring(7);
    activeHttpRequests.set(activeExecutionId, tauriRequestId);
    updateProgress(progress);

    updateExecutionResponse({
        status: 0,
        headers: {},
        body: 'Initializing...',
        time: 0,
        size: 0
    });

    const startTime = Date.now();

    try {
        const activeEnv = environments.peek().find(e => e.name === activeEnvName.peek());

        const getVal = (key: keyof ExecutionOverrides, fallback: any) => (overrides && (overrides as any)[key] !== undefined) ? (overrides as any)[key] : fallback;

        // Mutable request state for scripts
        const requestState = {
            method: String(getVal('method', (execution.method ?? parentRequest.method) || 'GET')),
            url: String(getVal('url', (execution.url ?? parentRequest.url) || '')).split('?')[0],
            headers: [...(getVal('headers', execution.headers ?? []) as any[])],
            queryParams: [...(getVal('queryParams', execution.queryParams ?? []) as any[])],
            pathParams: { ...(getVal('pathParams', execution.pathParams ?? {}) as Record<string, string>) },
            body: String(getVal('body', execution.body ?? parentRequest.body ?? '')),
            bodyType: String(getVal('bodyType', execution.bodyType ?? parentRequest.bodyType ?? 'none')),
            auth: getVal('auth', execution.auth ?? parentRequest.auth ?? { type: 'inherit' }),
            preScripts: getVal('preScripts', (execution.preScripts ?? parentRequest.preScripts ?? [])),
            postScripts: getVal('postScripts', (execution.postScripts ?? parentRequest.postScripts ?? [])),
            additionalPreScripts: overrides?.additionalPreScripts || [],
            additionalPostScripts: overrides?.additionalPostScripts || [],
            formData: [...(getVal('formData', execution.formData ?? parentRequest.formData ?? []) as any[])]
        };

        // Script Context
        const scriptContext = {
            console: {
                log: (...args: any[]) => addLog('info', args.map(a => String(a)).join(' '), 'Script'),
                error: (...args: any[]) => addLog('error', args.map(a => String(a)).join(' '), 'Script'),
                warn: (...args: any[]) => addLog('warn', args.map(a => String(a)).join(' '), 'Script'),
                info: (...args: any[]) => addLog('info', args.map(a => String(a)).join(' '), 'Script')
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
                    if (existing) existing.value = value;
                    else targetEnv.variables.push({ key, value });
                    environments.value = [...environments.peek()];
                }
            },
            request: {
                get method() { return requestState.method; },
                set method(val) { requestState.method = String(val); },
                get url() { return requestState.url; },
                set url(val) { requestState.url = String(val); },
                get body() { return requestState.body; },
                set body(val) { requestState.body = String(val); },
                headers: {
                    get: (key: string) => {
                        const h = requestState.headers.find(h => h.key.toLowerCase() === key.toLowerCase() && h.enabled);
                        return h ? h.values[0] : undefined;
                    },
                    set: (key: string, value: string) => {
                        const idx = requestState.headers.findIndex(h => h.key.toLowerCase() === key.toLowerCase());
                        if (idx !== -1) {
                            requestState.headers[idx] = { ...requestState.headers[idx], values: [String(value)], enabled: true };
                        } else {
                            requestState.headers.push({ key, values: [String(value)], enabled: true });
                        }
                    },
                    remove: (key: string) => {
                        requestState.headers = requestState.headers.filter(h => h.key.toLowerCase() !== key.toLowerCase());
                    }
                },
                queryParams: {
                    get: (key: string) => {
                        const p = requestState.queryParams.find(p => p.key === key && p.enabled);
                        return p ? p.values[0] : undefined;
                    },
                    set: (key: string, value: string) => {
                        const idx = requestState.queryParams.findIndex(p => p.key === key);
                        if (idx !== -1) {
                            requestState.queryParams[idx] = { ...requestState.queryParams[idx], values: [String(value)], enabled: true };
                        } else {
                            requestState.queryParams.push({ key, values: [String(value)], enabled: true });
                        }
                    },
                    remove: (key: string) => {
                        requestState.queryParams = requestState.queryParams.filter(p => p.key !== key);
                    }
                }
            },
            ...(scriptContextOverrides || {})
        };

        // 1. Pre-scripts
        const preStartTime = Date.now();
        setStepStatus('pre-scripts', 'running', undefined, preStartTime);
        const allPreScripts = [...requestState.preScripts, ...requestState.additionalPreScripts];
        const enabledPreScripts = allPreScripts.filter((s: any) => s.enabled);
        for (const script of enabledPreScripts) {
            try {
                await executeScript(script.content, scriptContext);
            } catch (e) {
                setStepStatus('pre-scripts', 'error', String(e), Date.now() - preStartTime);
                throw new Error(`Pre-Script "${script.name}" failed: ${e}`);
            }
        }
        setStepStatus('pre-scripts', 'completed', undefined, Date.now() - preStartTime);

        // 2. Prep
        const prepStartTime = Date.now();
        setStepStatus('prep', 'running', undefined, prepStartTime);

        // Prep Headers
        const parentHeaders = resolveHeaders(parentRequest.id);
        const finalHeaders: [string, string][] = [];
        parentHeaders.forEach(h => {
            if (h.key && h.values) {
                h.values.forEach(v => finalHeaders.push([h.key, substituteVariables(v, parentRequest.id, extraVars)]));
            }
        });
        // Apply overrides (exec or passed)
        requestState.headers.forEach(h => {
            if (h.key && h.enabled) {
                // Filter out parent headers with same key
                const idxs = finalHeaders.reduce((acc, fh, i) => (fh[0].toLowerCase() === h.key.toLowerCase() ? [i, ...acc] : acc), [] as number[]);
                idxs.forEach(i => finalHeaders.splice(i, 1));
                h.values.forEach((v: string) => finalHeaders.push([h.key, substituteVariables(v, parentRequest.id, extraVars)]));
            }
        });

        // Auth
        let authConfig = requestState.auth;
        if (authConfig.type === 'inherit') {
            const resolved = resolveAuth(parentRequest.id);
            if (resolved) authConfig = resolved.config;
        }
        if (authConfig.type === 'basic' && authConfig.basic) {
            const token = btoa(`${substituteVariables(authConfig.basic.username, parentRequest.id, extraVars)}:${substituteVariables(authConfig.basic.password, parentRequest.id, extraVars)}`);
            finalHeaders.push(['Authorization', `Basic ${token}`]);
        } else if (authConfig.type === 'bearer' && authConfig.bearer) {
            finalHeaders.push(['Authorization', `Bearer ${substituteVariables(authConfig.bearer.token, parentRequest.id, extraVars)}`]);
        }

        // Final URL with Query Params
        let finalUrl = substituteVariables(requestState.url, parentRequest.id, extraVars);
        // Substitute Path Params
        Object.entries(requestState.pathParams).forEach(([k, v]) => {
            finalUrl = finalUrl.replace(`{${k}}`, substituteVariables(String(v), parentRequest.id, extraVars));
        });

        const searchParams = new URLSearchParams();
        requestState.queryParams.forEach(p => {
            if (p.key && p.enabled) {
                p.values.forEach((v: string) => searchParams.append(p.key, substituteVariables(v, parentRequest.id, extraVars)));
            }
        });
        const qs = searchParams.toString();
        if (qs) finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;

        // Body
        let finalBody = requestState.bodyType === 'none' ? null : substituteVariables(requestState.body, parentRequest.id, extraVars);
        let formDataArgs: any = null;

        if (requestState.bodyType === 'form_urlencoded') {
            const params = new URLSearchParams();
            requestState.formData.forEach((group: any) => {
                group.values.forEach((v: string) => params.append(group.key, substituteVariables(v, parentRequest.id, extraVars)));
            });
            finalBody = params.toString();
            if (!finalHeaders.find(fh => fh[0].toLowerCase() === 'content-type')) finalHeaders.push(['Content-Type', 'application/x-www-form-urlencoded']);
        } else if (requestState.bodyType === 'multipart') {
            formDataArgs = requestState.formData.flatMap((group: any) => group.values.map((v: string, idx: number) => ({
                key: group.key,
                value: substituteVariables(v, parentRequest.id, extraVars),
                entry_type: group.type,
                content_type: group.contentTypes ? group.contentTypes[idx] : undefined
            })));
            finalBody = null;
        } else {
            if (!finalHeaders.find(fh => fh[0].toLowerCase() === 'content-type') && requestState.bodyType !== 'none') {
                const map: Record<string, string> = { json: 'application/json', xml: 'application/xml', yaml: 'application/x-yaml' };
                if (map[requestState.bodyType]) finalHeaders.push(['Content-Type', map[requestState.bodyType]]);
            }
        }

        setStepStatus('prep', 'completed', undefined, Date.now() - prepStartTime);

        // Early Request Reconstruction for UI
        try {
            const [raw, curl] = await invoke<[string, string]>('reconstruct_request', {
                args: {
                    method: String(requestState.method || 'GET'),
                    url: String(finalUrl || ''),
                    headers: finalHeaders,
                    body: finalBody,
                    form_data: formDataArgs,
                    project_name: activeProjectName.peek()
                }
            });
            updateExecutionResponse({
                status: 0,
                headers: {},
                body: 'Requesting...',
                time: 0,
                size: 0,
                requestRaw: raw,
                requestCurl: curl
            });
        } catch (e) {
            console.error("Early request reconstruction failed:", e);
        }

        // 3. HTTP Request
        const httpStartTime = Date.now();
        setStepStatus('http', 'running', undefined, httpStartTime);
        const res = await invoke<{ status: number, headers: string[][], body: string, time_taken: number, request_raw: string, request_curl: string }>('http_request', {
            args: {
                method: String(requestState.method || 'GET'),
                url: String(finalUrl || ''),
                headers: finalHeaders,
                body: finalBody,
                form_data: formDataArgs,
                request_id: tauriRequestId,
                project_name: activeProjectName.peek()
            }
        });
        const httpDuration = Date.now() - httpStartTime;
        const finalHttpTime = res.time_taken || httpDuration;
        setStepStatus('http', 'completed', undefined, finalHttpTime);

        // Update Response
        updateProgress({
            lastResponseTime: finalHttpTime,
            responseSize: res.body.length,
            responseStatus: res.status
        });

        const lastResponse: ResponseData = {
            status: res.status,
            headers: res.headers,
            body: res.body,
            time: finalHttpTime,
            size: res.body.length,
            requestUrl: finalUrl,
            requestMethod: requestState.method,
            requestRaw: res.request_raw,
            requestCurl: res.request_curl,
        };
        updateExecutionResponse(lastResponse);

        // 4. Post-scripts
        const postStartTime = Date.now();
        setStepStatus('post-scripts', 'running', undefined, postStartTime);
        const allPostScripts = [...requestState.postScripts, ...requestState.additionalPostScripts];
        const enabledPostScripts = allPostScripts.filter((s: any) => s.enabled);
        if (enabledPostScripts.length > 0) {
            const postScriptContext = {
                ...scriptContext,
                response: {
                    status: res.status,
                    headers: res.headers,
                    body: res.body,
                    json: () => { try { return JSON.parse(res.body); } catch { return null; } }
                }
            };
            for (const script of enabledPostScripts) {
                const statusFilter = script.executeOnStatusCodes || 'all';
                const matchesStatus = statusFilter === 'all' || 
                    statusFilter.split(',').map((s: string) => s.trim()).includes(res.status.toString()) ||
                    (statusFilter === '2xx' && res.status >= 200 && res.status < 300);
                
                if (matchesStatus) {
                    try {
                        await executeScript(script.content, postScriptContext);
                    } catch (e) {
                         addLog('error', `Post-Script "${script.name}" failed: ${e}`, 'Request');
                    }
                }
            }
        }
        setStepStatus('post-scripts', 'completed', undefined, Date.now() - postStartTime);
        updateProgress({ totalTime: Date.now() - startTime });
        return lastResponse;

    } catch (err) {
        console.error("Execution Error:", err);
        const errStr = String(err);
        const isCanceled = errStr.includes('Canceled');
        if (isCanceled) {
            setStepStatus('http', 'canceled');
        } else {
             // Find current running step and mark as error
             const steps = progress.steps.map(s => s.status === 'running' ? { ...s, status: 'error' as const, message: errStr } : s);
             updateProgress({ steps });
        }
        const errorResponse: ResponseData = {
            status: 0,
            headers: {},
            body: isCanceled ? 'Request Canceled' : `Error: ${errStr}`,
            size: 0,
            time: 0
        };
        updateExecutionResponse(errorResponse);
        return errorResponse;
    } finally {
        updateProgress({ isLoading: false });
        activeHttpRequests.delete(activeExecutionId);
    }
};

/**
 * Cancel an active request
 */
export const cancelExecution = async (executionId: string) => {
    const tauriRequestId = activeHttpRequests.get(executionId);
    if (!tauriRequestId) return;
    try {
        await invoke('cancel_http_request', { requestId: tauriRequestId });
        addLog('info', 'Request cancellation requested', 'System');
    } catch (err) {
        console.error('Failed to cancel request', err);
    }
};
