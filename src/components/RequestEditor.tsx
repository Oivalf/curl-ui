import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { useRef, useEffect, useCallback } from "preact/hooks";
import { Play } from 'lucide-preact';
import { invoke } from '@tauri-apps/api/core';
import { activeRequestId, requests, responseData, environments, activeEnvironmentName, folders } from '../store';
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
    const bodyType = useSignal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>('json');





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

    // Sync Local State to Global Store
    useSignalEffect(() => {
        const currentName = name.value;
        const currentMethod = method.value;
        const currentUrl = url.value;
        const currentHeaders = headers.value;
        const currentBody = body.value;
        const reqId = activeRequestId.value;

        if (!reqId) return;

        const currentRequests = requests.peek();
        const reqIndex = currentRequests.findIndex(r => r.id === reqId);

        if (reqIndex !== -1) {
            const req = currentRequests[reqIndex];

            // Reconstruct headers object
            const headersObj: Record<string, string> = {};
            currentHeaders.forEach(h => {
                if (h.key) headersObj[h.key] = h.value;
            });

            // Check if anything changed
            const headersChanged = JSON.stringify(req.headers) !== JSON.stringify(headersObj);

            if (req.name !== currentName || req.method !== currentMethod || req.url !== currentUrl || req.body !== currentBody || headersChanged) {
                const newRequests = [...currentRequests];
                newRequests[reqIndex] = {
                    ...req,
                    name: currentName,
                    method: currentMethod,
                    url: currentUrl,
                    body: currentBody,
                    headers: headersObj
                };
                requests.value = newRequests;
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

    const handleSend = async () => {
        try {
            // Reconstruct headers object
            const headersObj: Record<string, string> = {};
            headers.value.forEach(h => {
                if (h.key) headersObj[h.key] = substituteVariables(h.value);
            });

            // Set Content-Type automatically if not present
            if (!headersObj['Content-Type']) {
                switch (bodyType.value) {
                    case 'json': headersObj['Content-Type'] = 'application/json'; break;
                    case 'xml': headersObj['Content-Type'] = 'application/xml'; break;
                    case 'html': headersObj['Content-Type'] = 'text/html'; break;
                    case 'form_urlencoded': headersObj['Content-Type'] = 'application/x-www-form-urlencoded'; break;
                    case 'multipart': break;
                    case 'text': headersObj['Content-Type'] = 'text/plain'; break;
                    case 'javascript': headersObj['Content-Type'] = 'application/javascript'; break;
                    case 'yaml': headersObj['Content-Type'] = 'application/x-yaml'; break;
                }
            }

            const finalUrl = substituteVariables(getFinalUrl());

            let finalBody = bodyType.value === 'none' ? null : substituteVariables(body.value);
            let formDataArgs = null;

            if (bodyType.value === 'form_urlencoded') {
                // Convert formData to urlencoded string
                const params = new URLSearchParams();
                formData.value.forEach(group => {
                    group.values.forEach(v => {
                        params.append(group.key, substituteVariables(v));
                    });
                });
                finalBody = params.toString();
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
            }

            const res = await invoke('http_request', {
                args: {
                    method: method.value,
                    url: finalUrl,
                    headers: headersObj,
                    body: finalBody,
                    form_data: formDataArgs
                }
            });
            console.log(res);
            responseData.value = { ...res as any, requestUrl: finalUrl, requestMethod: method.value };
        } catch (err) {
            console.error(err);
            responseData.value = { error: err };
        }
    };

    const generateCurl = () => {
        const finalUrl = substituteVariables(getFinalUrl());
        let cmd = `curl -X ${method.value} "${finalUrl}"`;

        // Headers
        headers.value.forEach(h => {
            if (h.key) cmd += ` \\\n  -H "${h.key}: ${substituteVariables(h.value)}"`;
        });

        // Auto Content-Type
        if (!headers.value.find(h => h.key.toLowerCase() === 'content-type')) {
            let contentType = '';
            switch (bodyType.value) {
                case 'json': contentType = 'application/json'; break;
                // ... same switch ...
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
            <div style={{ display: 'flex', gap: '8px' }}>
                <MethodSelect
                    value={method.value}
                    onChange={(val) => method.value = val}
                />

                <input
                    style={{ flex: 1 }}
                    value={url.value}
                    onInput={(e) => url.value = e.currentTarget.value}
                    placeholder="Enter URL..."
                />

                <button
                    onClick={handleSend}
                    style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--bg-base)',
                        padding: '0 var(--spacing-lg)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold'
                    }}
                >
                    <Play size={16} />
                    Send
                </button>
            </div>

            <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: `${leftPanelWidth.value}%`, display: 'flex', flexDirection: 'column' }}>
                    <RequestPanel
                        method={method}
                        headers={headers}
                        bodyType={bodyType}
                        body={body}
                        queryParams={queryParams}
                        pathParams={pathParams}
                        formData={formData}
                        detectedPathKeys={detectedPathKeys}
                        updateUrlFromParams={updateUrlFromParams}
                        getFinalUrl={getFinalUrl}
                        generateCurl={generateCurl}
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
