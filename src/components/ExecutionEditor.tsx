import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { useRef, useEffect, useCallback } from "preact/hooks";
import { Play, ArrowLeft } from 'lucide-preact';
import { invoke } from '@tauri-apps/api/core';
import { activeExecutionId, activeRequestId, executions, requests, folders, environments, activeEnvironmentName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, responseData, ScriptItem, addLog, openTabs, activeTabId, activeFolderId } from "../store";
import { RequestPanel } from "./RequestPanel";
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
        const params: { key: string, values: string[] }[] = [];
        const processedKeys = new Set<string>();
        searchParams.forEach((_, key) => {
            if (processedKeys.has(key)) return;
            processedKeys.add(key);
            params.push({ key, values: searchParams.getAll(key) });
        });
        return { base, params };
    };

    const { base: initialBase, params: initialParams } = parseUrl(currentExecution.url ?? parentRequest.url);

    const url = useSignal(initialBase);
    const method = useSignal(currentExecution.method ?? parentRequest.method);

    // Convert headers object to array for easier editing
    // Merge parent headers with execution overrides
    const getMergedHeaders = () => {
        const parentHeaders = Object.entries(parentRequest.headers || {});
        const execOverrides = currentExecution.headers || {};
        return parentHeaders.map(([k, v]) => ({
            key: k,
            value: execOverrides[k] !== undefined ? execOverrides[k] : v
        }));
    };

    const headers = useSignal<{ key: string, value: string }[]>(getMergedHeaders());
    const body = useSignal(currentExecution.body ?? parentRequest.body ?? '');
    const bodyType = useComputed<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>(() => {
        // Body type is inherited from parent request, but we derive it from the content if parent doesn't specify?
        // Actually, the user says the type is fixed but value can change.
        // For now let's derive it from the body content or follow parent if we had a bodyType field (which we don't yet).
        // Best approach: determine type from content of the body (JSON check).
        return (body.value && (body.value.trim().startsWith('{') || body.value.trim().startsWith('['))) ? 'json' : 'none';
    });
    const preScripts = useSignal<ScriptItem[]>(currentExecution.preScripts ?? parentRequest.preScripts ?? []);
    const postScripts = useSignal<ScriptItem[]>(currentExecution.postScripts ?? parentRequest.postScripts ?? []);

    // Auth State - use execution auth or inherit from parent
    const auth = useSignal<AuthConfig>(currentExecution.auth ?? parentRequest.auth ?? { type: 'inherit' });

    // Sync from parent when parent changes and no override exists
    useSignalEffect(() => {
        // This effect reacts to parentRequest changes
        const pReq = parentRequest;
        const cExec = executions.value.find(e => e.id === activeExecutionId.value);
        if (!cExec) return;

        if (cExec.url === undefined) {
            const { base, params } = parseUrl(pReq.url);
            url.value = base;
            queryParams.value = params;
        }
        if (cExec.method === undefined) {
            method.value = pReq.method;
        }
        if (cExec.headers === undefined) {
            headers.value = getMergedHeaders();
        }
        if (cExec.body === undefined) {
            body.value = pReq.body ?? '';
        }
        if (cExec.auth === undefined) {
            auth.value = pReq.auth ?? { type: 'inherit' };
        }
        if (cExec.preScripts === undefined) {
            preScripts.value = pReq.preScripts ?? [];
        }
        if (cExec.postScripts === undefined) {
            postScripts.value = pReq.postScripts ?? [];
        }
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
    const queryParams = useSignal<{ key: string, values: string[] }[]>(initialParams);
    const pathParams = useSignal<Record<string, string>>({});
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>([]);

    // URL sync effect removed - handled by sync logic and internal params management

    const updateUrlFromParams = (newParams: { key: string, values: string[] }[]) => {
        queryParams.value = newParams;
    };

    const detectedPathKeys = useComputed(() => {
        const matches = url.value.match(/(?<!\{)\{[a-zA-Z0-9_]+\}(?!\})/g);
        if (!matches) return [];
        return matches.map(m => m.slice(1, -1));
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

    // Detect Overrides for UI highlighting
    const overriddenHeaders = useComputed(() => {
        const parentHeaderMap = parentRequest.headers || {};
        return new Set(headers.value.filter(h => h.key && parentHeaderMap[h.key] !== undefined && h.value !== parentHeaderMap[h.key]).map(h => h.key));
    });

    const overriddenQueryParams = useComputed(() => {
        const { params: parentParams } = parseUrl(parentRequest.url);
        const overriddenKeys = new Set<string>();
        queryParams.value.forEach(p => {
            const parentP = parentParams.find(pp => pp.key === p.key);
            const parentValues = parentP ? parentP.values : [];
            if (JSON.stringify(p.values) !== JSON.stringify(parentValues)) {
                overriddenKeys.add(p.key);
            }
        });
        return overriddenKeys;
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
        const currentBody = body.value;
        const currentAuth = auth.value;
        const currentPreScripts = preScripts.value;
        const currentPostScripts = postScripts.value;

        const execId = activeExecutionId.value;
        if (!execId) return;

        const allExecutions = executions.peek();
        const idx = allExecutions.findIndex(e => e.id === execId);

        if (idx !== -1) {
            const exec = allExecutions[idx];

            // Determine if values should be saved as overrides or remain inherited (undefined)
            const headersObj: Record<string, string> = {};
            currentHeaders.forEach(h => { if (h.key) headersObj[h.key] = h.value; });

            // Comparison for headers inheritance
            const parentHeaders = parentRequest.headers || {};
            const matchesParentHeaders = JSON.stringify(headersObj) === JSON.stringify(parentHeaders);
            const finalHeaders = matchesParentHeaders ? undefined : headersObj;

            // Comparison for body inheritance
            const parentBody = parentRequest.body ?? '';
            const finalBody = currentBody === parentBody ? undefined : currentBody;

            // Comparison for auth inheritance
            const parentAuth = parentRequest.auth ?? { type: 'inherit' };
            const finalAuth = JSON.stringify(currentAuth) === JSON.stringify(parentAuth) ? undefined : currentAuth;

            // Comparison for scripts inheritance
            const finalPreScripts = JSON.stringify(currentPreScripts) === JSON.stringify(parentRequest.preScripts ?? []) ? undefined : currentPreScripts;
            const finalPostScripts = JSON.stringify(currentPostScripts) === JSON.stringify(parentRequest.postScripts ?? []) ? undefined : currentPostScripts;

            // Checks for changes compared to CURRENT store state to avoid infinite loops and unnecessary updates
            const headersChanged = JSON.stringify(exec.headers) !== JSON.stringify(finalHeaders);
            const authChanged = JSON.stringify(exec.auth) !== JSON.stringify(finalAuth);
            const preScriptsChanged = JSON.stringify(exec.preScripts) !== JSON.stringify(finalPreScripts);
            const postScriptsChanged = JSON.stringify(exec.postScripts) !== JSON.stringify(finalPostScripts);

            if (exec.name !== currentName || headersChanged || exec.body !== finalBody || authChanged || preScriptsChanged || postScriptsChanged) {
                const newExecutions = [...allExecutions];
                newExecutions[idx] = {
                    ...exec,
                    name: currentName,
                    method: undefined, // Always follow parent
                    url: undefined,    // Always follow parent
                    headers: finalHeaders,
                    body: finalBody,
                    auth: finalAuth,
                    preScripts: finalPreScripts,
                    postScripts: finalPostScripts
                };
                executions.value = newExecutions;

                const newUnsaved = new Set(unsavedItemIds.peek());
                newUnsaved.add(execId);
                unsavedItemIds.value = newUnsaved;
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

    const handleSend = async () => {
        if (isLoading.value) return;
        isLoading.value = true;
        responseData.value = null;
        const startTime = Date.now();

        try {
            const activeEnv = environments.peek().find(e => e.name === activeEnvironmentName.peek());

            const scriptContext = {
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

            for (const script of preScripts.peek()) {
                if (script.enabled) {
                    try {
                        console.log(`Executing Pre-Script: ${script.name}`);
                        await executeScript(script.content, scriptContext);
                    } catch (e) {
                        alert(`Error executing Pre-Script "${script.name}":\n${e}`);
                        throw new Error(`Pre-Script failed: ${e}`);
                    }
                }
            }

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

            // Apply execution-specific headers on top
            headers.value.forEach(h => {
                if (h.key && h.value) {
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
            } else if (bodyType.value === 'json' && !finalHeaders['Content-Type']) {
                finalHeaders['Content-Type'] = 'application/json';
            }

            const res = await invoke<{ status: number, headers: Record<string, string>, body: string, time_taken: number }>('http_request', {
                args: {
                    method: method.value,
                    url: finalUrl,
                    headers: finalHeaders,
                    body: finalBody,
                    form_data: formDataArgs
                }
            });

            const duration = Date.now() - startTime;

            responseData.value = {
                ...responseData.peek(), // Preserve snapshots
                status: res.status,
                headers: res.headers,
                body: res.body,
                size: new Blob([res.body]).size,
                time: duration
            };

            const shouldExecuteScript = (pattern: string | undefined, status: number): boolean => {
                if (!pattern || pattern.trim() === '') return true;
                const patterns = pattern.split(',').map(p => p.trim());
                const statusStr = status.toString();

                return patterns.some(p => {
                    if (p === statusStr) return true;
                    if (p.toLowerCase().endsWith('xx')) {
                        const prefix = p.slice(0, -2);
                        return statusStr.startsWith(prefix);
                    }
                    return false;
                });
            };

            const responseContext = {
                status: res.status,
                headers: res.headers,
                body: res.body,
                time: duration
            };

            const postScriptContext = {
                ...scriptContext,
                response: responseContext
            };

            for (const script of postScripts.peek()) {
                if (script.enabled) {
                    if (shouldExecuteScript(script.executeOnStatusCodes, res.status)) {
                        try {
                            console.log(`Executing Post-Script: ${script.name}`);
                            await executeScript(script.content, postScriptContext);
                        } catch (e) {
                            addLog('error', `Post-Script "${script.name}" failed: ${e}`, 'Request');
                        }
                    } else {
                        console.log(`Skipping Post-Script "${script.name}" (Status ${res.status} does not match ${script.executeOnStatusCodes})`);
                    }
                }
            }

        } catch (err) {
            console.error(err);
            responseData.value = {
                status: 0,
                headers: {},
                body: `Error: ${err}`,
                size: 0,
                time: 0
            };
        } finally {
            isLoading.value = false;
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
            if (h.key && h.value) {
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
            if (h.key && h.value) {
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
                <button
                    onClick={handleSend}
                    disabled={isLoading.value}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        opacity: isLoading.value ? 0.7 : 1
                    }}
                >
                    <Play size={16} />
                    {isLoading.value ? 'Sending...' : 'Run'}
                </button>
            </div>

            <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: `${leftPanelWidth.value}%`, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
                        isReadOnly={true}
                        overriddenHeaders={overriddenHeaders.value}
                        overriddenQueryParams={overriddenQueryParams.value}
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
