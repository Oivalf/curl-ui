import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { useRef, useEffect, useCallback } from "preact/hooks";
import { Play } from 'lucide-preact';
import { invoke } from '@tauri-apps/api/core';
import { activeRequestId, requests, folders, environments, activeEnvironmentName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, responseData, ScriptItem, addLog } from "../store";
import { RequestPanel } from "./RequestPanel";
import { ResponsePanel } from "./ResponsePanel";
import { MethodSelect } from "./MethodSelect";

export function RequestEditor() {
    const currentRequest = requests.value.find(r => r.id === activeRequestId.value);

    if (!currentRequest) return null;

    // Local state for editing
    const name = useSignal(currentRequest.name);
    const url = useSignal(currentRequest.url);
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

    // Loading State
    const isLoading = useSignal(false);

    // Params State
    const queryParams = useSignal<{ key: string, values: string[] }[]>([]);
    const pathParams = useSignal<Record<string, string>>({});
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>([]);

    // Sync Query Params from URL on init
    useSignalEffect(() => {
        try {
            const urlObj = new URL(url.value);
            const params: { key: string, values: string[] }[] = [];
            const processedKeys = new Set<string>();

            // Group by key
            urlObj.searchParams.forEach((_, key) => {
                if (processedKeys.has(key)) return;
                processedKeys.add(key);

                const values = urlObj.searchParams.getAll(key);
                params.push({ key, values });
            });

            // Only update if different to avoid loops
            if (JSON.stringify(params) !== JSON.stringify(queryParams.peek())) {
                queryParams.value = params;
            }
        } catch {
            // Invalid URL, ignore
        }
    });

    // Reactive helper to update URL when Query Params change
    const updateUrlFromParams = (newParams: { key: string, values: string[] }[]) => {
        try {
            // We use a dummy base if relative, to parsing work
            const currentUrlStr = url.value.includes('://') ? url.value : 'http://dummy/' + url.value;
            const urlObj = new URL(currentUrlStr);

            // Clear existing
            const keys = Array.from(urlObj.searchParams.keys());
            keys.forEach(k => urlObj.searchParams.delete(k));

            // Add new
            newParams.forEach(p => {
                if (p.key) {
                    p.values.forEach(v => {
                        urlObj.searchParams.append(p.key, v);
                    });
                }
            });

            let newUrl = urlObj.toString();
            if (!url.value.includes('://')) {
                newUrl = newUrl.replace('http://dummy/', '');
            }

            url.value = newUrl;
            queryParams.value = newParams;
        } catch (e) {
            // fallback
            queryParams.value = newParams;
        }
    };

    // Extract Path Params ({param}) - ignore {{env_var}}
    const detectedPathKeys = useComputed(() => {
        // Regex lookbehind/lookahead to avoid matching {{var}}
        const matches = url.value.match(/(?<!\{)\{[a-zA-Z0-9_]+\}(?!\})/g);
        if (!matches) return [];
        return matches.map(m => m.slice(1, -1)); // remove { and }
    });

    const getFinalUrl = () => {
        let finalUrl = url.value;
        // Substitute Path Params
        detectedPathKeys.value.forEach(key => {
            if (pathParams.value[key]) {
                finalUrl = finalUrl.replace(`{${key}}`, pathParams.value[key]);
            }
        });
        return finalUrl;
    };

    const finalUrlPreview = useComputed(() => {
        return substituteVariables(getFinalUrl());
    });

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    // Sync Local State to Global Store
    useSignalEffect(() => {
        const currentName = name.value;
        const currentMethod = method.value;
        const currentUrl = url.value;
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

            if (value !== null) {
                result = result.split(placeholder).join(value);
            }
        });

        return result;
    };

    // Import store values directly inside component to ensure reactivity if needed, 
    // but they are imported at top level.

    const executeScript = async (scriptContent: string, context: any) => {
        try {
            // Function constructor to create a sandboxed-ish scope
            // We pass keys of context as arguments
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
        responseData.value = null; // Clear previous
        const startTime = Date.now();

        try {
            // 1. Execute Pre-Scripts
            const activeEnv = environments.peek().find(e => e.name === activeEnvironmentName.peek());

            // Script Context
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
                        return activeEnv?.variables.find(v => v.key === key)?.value;
                    },
                    set: (key: string, value: string) => {
                        if (!activeEnv) return;
                        const existing = activeEnv.variables.find(v => v.key === key);
                        if (existing) {
                            existing.value = value;
                        } else {
                            activeEnv.variables.push({ key, value });
                        }
                        // Trigger reactivity (brute force for deep nested changes if needed, but array mutation might be enough for preact signals if reference changes or if we force update. Preact signals on array methods usually trigger. If not, we re-assign.)
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
                        throw new Error(`Pre-Script failed: ${e}`); // Stop execution
                    }
                }
            }

            // Prepare headers
            const startHeaders = resolveHeaders(activeRequestId.value!);
            const finalHeaders: Record<string, string> = {};

            startHeaders.forEach(h => {
                if (h.key && h.value) {
                    finalHeaders[h.key] = substituteVariables(h.value);
                }
            });

            // Auth (resolve inherit)
            let authConfig = auth.value;
            if (authConfig.type === 'inherit' && inheritedAuth.value) {
                authConfig = inheritedAuth.value.config;
            }

            // Apply Auth to Headers
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
                // Convert formData to urlencoded string
                const params = new URLSearchParams();
                formData.value.forEach(group => {
                    group.values.forEach(v => {
                        params.append(group.key, substituteVariables(v));
                    });
                });
                finalBody = params.toString();
                // Ensure Content-Type is set if not already
                if (!finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';

            } else if (bodyType.value === 'multipart') {
                // Pass structured formData to backend
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
                finalBody = null; // backend handles multipart via form_data arg
            } else if (bodyType.value === 'json' && !finalHeaders['Content-Type']) {
                finalHeaders['Content-Type'] = 'application/json';
            }
            // Add other content types defaults if needed

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
                status: res.status,
                headers: res.headers,
                body: res.body,
                size: new Blob([res.body]).size,
                time: duration
            };

            // 2. Execute Post-Scripts
            const shouldExecuteScript = (pattern: string | undefined, status: number): boolean => {
                if (!pattern || pattern.trim() === '') return true; // Always execute if no pattern

                const patterns = pattern.split(',').map(p => p.trim());
                const statusStr = status.toString();

                return patterns.some(p => {
                    if (p === statusStr) return true;
                    // Check for wildcards e.g. 2xx
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

            // Re-create context to include response
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
                            // We don't abort the request flow here as response is already received
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

    const generateCurl = () => {
        let cmd = `curl -X ${method.value} '${substituteVariables(getFinalUrl())}'`;

        // Add headers
        const startHeaders = resolveHeaders(activeRequestId.value!);
        const finalHeaders: Record<string, string> = {};

        startHeaders.forEach(h => {
            if (h.key && h.value) {
                finalHeaders[h.key] = substituteVariables(h.value);
            }
        });

        // Auth (resolve inherit)
        let authConfig = auth.value;
        if (authConfig.type === 'inherit' && inheritedAuth.value) {
            authConfig = inheritedAuth.value.config;
        }

        // Apply Auth to Headers
        if (authConfig.type === 'basic' && authConfig.basic) {
            const token = btoa(`${substituteVariables(authConfig.basic.username)}:${substituteVariables(authConfig.basic.password)}`);
            finalHeaders['Authorization'] = `Basic ${token}`;
        } else if (authConfig.type === 'bearer' && authConfig.bearer) {
            finalHeaders['Authorization'] = `Bearer ${substituteVariables(authConfig.bearer.token)}`;
        }

        for (const key in finalHeaders) {
            cmd += ` \\\n  -H "${key}: ${finalHeaders[key]}"`;
        }

        // Add Content-Type header if not present and body type implies it
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
            // Basic escaping for single quotes
            const escapedBody = substituteVariables(body.value).replace(/'/g, "'\\''");
            cmd += ` \\\n  -d '${escapedBody}'`;
        }

        return cmd;
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const leftPanelWidth = useSignal(50); // percentage
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
            // Clamp between 20% and 80%
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
                <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{
                            position: 'absolute',
                            left: '8px',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            pointerEvents: 'none'
                        }}>
                            {finalUrlPreview.value.split(url.value)[0]}
                        </span>
                        <input
                            type="text"
                            value={url.value}
                            onInput={(e) => url.value = e.currentTarget.value}
                            onKeyDown={handleKeyDown}
                            placeholder="https://api.example.com/v1/users"
                            style={{
                                flex: 1,
                                padding: '8px',
                                paddingLeft: url.value ? '8px' : '8px', // TODO: improve overlay logic if needed
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.9rem'
                            }}
                        />
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
                    {isLoading.value ? 'Sending...' : 'Send'}
                </button>
            </div>

            <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: `${leftPanelWidth.value}%`, display: 'flex', flexDirection: 'column' }}>
                    <RequestPanel
                        method={method}
                        headers={headers}
                        bodyType={bodyType}
                        body={body}
                        auth={auth}
                        queryParams={queryParams}
                        pathParams={pathParams}
                        formData={formData}
                        detectedPathKeys={detectedPathKeys}
                        updateUrlFromParams={updateUrlFromParams}
                        getFinalUrl={getFinalUrl}
                        generateCurl={generateCurl}
                        inheritedAuth={inheritedAuth.value}
                        inheritedHeaders={inheritedHeaders.value}
                        preScripts={preScripts}
                        postScripts={postScripts}
                    />
                </div>
                {/* Resizer Handle */}
                <div
                    onMouseDown={startResizing}
                    style={{
                        width: '5px',
                        cursor: 'col-resize',
                        backgroundColor: isResizing.value ? 'var(--accent-primary)' : 'var(--border-color)',
                        opacity: isResizing.value ? 1 : 0.5,
                        transition: 'background-color 0.2s',
                        margin: '0 4px',
                        borderRadius: '2px',
                        zIndex: 10
                    }}
                />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <ResponsePanel />
                </div>
            </div>
        </div>
    );
}
