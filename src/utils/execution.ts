import { invoke } from '@tauri-apps/api/core';
import { 
    executions, requests, folders, environments, 
    activeEnvironmentName, activeProjectName, 
    addLog, ExecutionProgressState, executionProgressMap,
    ResponseData, resolveHeaders, resolveAuth, AuthConfig, ScriptItem
} from '../store';

/**
 * Global map of active request IDs for cancellation
 */
export const activeHttpRequests = new Map<string, string>();

/**
 * Helper to substitute variables in text
 */
export const substituteVariables = (text: string, requestId: string, extraVars?: Record<string, string>): string => {
    if (!text) return text;
    const placeholders = Array.from(new Set(text.match(/{{([\s\S]+?)}}/g) || []));
    if (placeholders.length === 0) return text;

    const env = environments.peek().find(e => e.name === activeEnvironmentName.peek());
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

    let result = text;
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
            result = result.split(placeholder).join(value);
        }
    });

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
    headers?: { key: string, values: string[], enabled: boolean }[];
    queryParams?: { key: string, values: string[], enabled: boolean }[];
    body?: string;
    bodyType?: string;
    auth?: AuthConfig;
    preScripts?: ScriptItem[];
    postScripts?: ScriptItem[];
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
    isEphemeral?: boolean
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
        const activeEnv = environments.peek().find(e => e.name === activeEnvironmentName.peek());

        // Helper to get effective values (override or inherit)
        const getVal = (key: keyof ExecutionOverrides, fallback: any) => (overrides && (overrides as any)[key] !== undefined) ? (overrides as any)[key] : fallback;

        const effectiveMethod = getVal('method', execution.method ?? parentRequest.method);
        const effectiveUrlBase = getVal('url', execution.url ?? parentRequest.url).split('?')[0];
        const effectiveHeaders = getVal('headers', execution.headers ?? []) as any[];
        const effectiveQueryParams = getVal('queryParams', execution.queryParams ?? []) as any[];
        const effectivePathParams = getVal('pathParams', execution.pathParams ?? {});
        const effectiveBody = getVal('body', execution.body ?? parentRequest.body ?? '');
        const effectiveBodyType = getVal('bodyType', execution.bodyType ?? parentRequest.bodyType ?? 'none');
        const effectiveAuth = getVal('auth', execution.auth ?? parentRequest.auth ?? { type: 'inherit' });
        const effectivePreScripts = getVal('preScripts', execution.preScripts ?? parentRequest.preScripts ?? []);
        const effectivePostScripts = getVal('postScripts', execution.postScripts ?? parentRequest.postScripts ?? []);
        const effectiveFormData = getVal('formData', execution.formData ?? parentRequest.formData ?? []);

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
            }
            // Note: In store.ts version, we don't allow scripts to update transient UI signals (like RequestEditor state)
            // but they can still interact with the env. 
            // If we wanted to allow them to change request headers, we'd need more complex callback.
        };

        // 1. Pre-scripts
        const preStartTime = Date.now();
        setStepStatus('pre-scripts', 'running', undefined, preStartTime);
        const enabledPreScripts = effectivePreScripts.filter((s: any) => s.enabled);
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
        effectiveHeaders.forEach(h => {
            if (h.key && h.enabled) {
                // Filter out parent headers with same key
                const idxs = finalHeaders.reduce((acc, fh, i) => (fh[0] === h.key ? [i, ...acc] : acc), [] as number[]);
                idxs.forEach(i => finalHeaders.splice(i, 1));
                h.values.forEach((v: string) => finalHeaders.push([h.key, substituteVariables(v, parentRequest.id, extraVars)]));
            }
        });

        // Auth
        let authConfig = effectiveAuth;
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
        let finalUrl = substituteVariables(effectiveUrlBase, parentRequest.id, extraVars);
        // Substitute Path Params
        Object.entries(effectivePathParams).forEach(([k, v]) => {
            finalUrl = finalUrl.replace(`{${k}}`, substituteVariables(String(v), parentRequest.id, extraVars));
        });

        const searchParams = new URLSearchParams();
        // Resolve parent query params from URL if not already processed? 
        // Actually ExecutionEditor logic for merging queryParams is better.
        // For simplicity here, we assume effectiveQueryParams contains the merged state (handled by UI components).
        effectiveQueryParams.forEach(p => {
            if (p.key && p.enabled) {
                p.values.forEach((v: string) => searchParams.append(p.key, substituteVariables(v, parentRequest.id, extraVars)));
            }
        });
        const qs = searchParams.toString();
        if (qs) finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;

        // Body
        let finalBody = effectiveBodyType === 'none' ? null : substituteVariables(effectiveBody, parentRequest.id, extraVars);
        let formDataArgs: any = null;

        if (effectiveBodyType === 'form_urlencoded') {
            const params = new URLSearchParams();
            effectiveFormData.forEach((group: any) => {
                group.values.forEach((v: string) => params.append(group.key, substituteVariables(v, parentRequest.id, extraVars)));
            });
            finalBody = params.toString();
            if (!finalHeaders.find(fh => fh[0] === 'Content-Type')) finalHeaders.push(['Content-Type', 'application/x-www-form-urlencoded']);
        } else if (effectiveBodyType === 'multipart') {
            formDataArgs = effectiveFormData.flatMap((group: any) => group.values.map((v: string, idx: number) => ({
                key: group.key,
                value: substituteVariables(v, parentRequest.id, extraVars),
                entry_type: group.type,
                content_type: group.contentTypes ? group.contentTypes[idx] : undefined
            })));
            finalBody = null;
        } else {
            if (!finalHeaders.find(fh => fh[0] === 'Content-Type') && effectiveBodyType !== 'none') {
                const map: Record<string, string> = { json: 'application/json', xml: 'application/xml', yaml: 'application/x-yaml' };
                if (map[effectiveBodyType]) finalHeaders.push(['Content-Type', map[effectiveBodyType]]);
            }
        }

        setStepStatus('prep', 'completed', undefined, Date.now() - prepStartTime);

        // Early Request Reconstruction for UI
        try {
            const [raw, curl] = await invoke<[string, string]>('reconstruct_request', {
                args: {
                    method: String(effectiveMethod || 'GET'),
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
                method: String(effectiveMethod || 'GET'),
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
            requestMethod: effectiveMethod,
            requestRaw: res.request_raw,
            requestCurl: res.request_curl,
        };
        updateExecutionResponse(lastResponse);

        // 4. Post-scripts
        const postStartTime = Date.now();
        setStepStatus('post-scripts', 'running', undefined, postStartTime);
        const enabledPostScripts = effectivePostScripts.filter((s: any) => s.enabled);
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
