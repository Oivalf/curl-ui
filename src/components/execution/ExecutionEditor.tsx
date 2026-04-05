import { useSignal, useSignalEffect, useComputed, batch } from "@preact/signals";
import { useRef, useEffect, useCallback } from "preact/hooks";
import { ArrowLeft, Play, XCircle } from "lucide-preact";
import { activeExecutionId, activeRequestId, executions, requests, folders, environments, activeEnvName, unsavedItemIds, AuthConfig, resolveAuth, resolveHeaders, ScriptItem, openTabs, activeTabId, executionProgressMap, TableRow } from "../../store";
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

    // --- Helper Functions ---

    // Helper to separate URL and Query Params
    const parseUrl = (fullUrl: string) => {
        if (!fullUrl || !fullUrl.includes('?')) return { base: fullUrl || '', params: [] };
        const [base, query] = fullUrl.split('?', 2);
        const searchParams = new URLSearchParams(query);
        const params: TableRow[] = [];
        const processedKeys = new Set<string>();
        searchParams.forEach((_, key) => {
            if (processedKeys.has(key)) return;
            processedKeys.add(key);
            params.push({ key, values: searchParams.getAll(key), enabled: boolean });
        });
        return { base, params };
    };

    // Helper to merge rows (headers or query params)
    const mergeRows = (parentRows: TableRow[], execOverrides: TableRow[] | undefined): TableRow[] => {
        const merged: TableRow[] = (parentRows || []).map(h => ({
            ...h,
            values: [...h.values],
            enabled: h.enabled ?? true
        }));

        if (execOverrides) {
            execOverrides.forEach(override => {
                const index = merged.findIndex(m => m.key === override.key);
                if (index !== -1) {
                    merged[index] = { ...override, values: [...override.values], enabled: override.enabled ?? true };
                } else {
                    merged.push({ ...override, values: [...override.values], enabled: override.enabled ?? true });
                }
            });
        }
        return merged;
    };

    const getMergedHeaders = () => mergeRows(parentRequest.headers || [], currentExecution.headers);
    
    const getMergedQueryParams = (parentUrl: string, execOverrides?: TableRow[]) => {
        const { params: parentParams } = parseUrl(parentUrl);
        return mergeRows(parentParams, execOverrides);
    };

    // --- Local State Signals ---

    const { base: initialBase } = parseUrl(currentExecution.url ?? parentRequest.url);

    const name = useSignal(currentExecution.name);
    const url = useSignal(initialBase);
    const method = useSignal(currentExecution.method ?? parentRequest.method);
    const body = useSignal(currentExecution.body ?? parentRequest.body ?? '');
    const bodyType = useSignal<'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml'>(
        currentExecution.bodyType || parentRequest.bodyType || ((currentExecution.body ?? parentRequest.body ?? '') !== '' ? 'json' : 'none')
    );
    const preScripts = useSignal<ScriptItem[]>(currentExecution.preScripts ?? parentRequest.preScripts ?? []);
    const postScripts = useSignal<ScriptItem[]>(currentExecution.postScripts ?? parentRequest.postScripts ?? []);
    const auth = useSignal<AuthConfig>(currentExecution.auth ?? parentRequest.auth ?? { type: 'inherit' });
    const headers = useSignal<TableRow[]>(getMergedHeaders());
    const queryParams = useSignal<TableRow[]>(getMergedQueryParams(parentRequest.url, currentExecution.queryParams));
    const pathParams = useSignal<Record<string, string>>(currentExecution.pathParams || {});
    const formData = useSignal<{ key: string, type: 'text' | 'file', values: string[] }[]>(currentExecution.formData ?? parentRequest.formData ?? []);
    const detectedPathKeys = useSignal<string[]>([]);
    const lastLoadedId = useRef<string | null>(null);

    // --- Effects & Sync Logic ---

    // Initial load / Switch execution
    useEffect(() => {
        const execId = activeExecutionId.value;
        if (execId === lastLoadedId.current) return;

        const cExec = executions.peek().find(e => e.id === execId);
        if (!cExec || !parentRequest) return;

        lastLoadedId.current = execId;
        const { base } = parseUrl(cExec.url ?? parentRequest.url);

        batch(() => {
            name.value = cExec.name;
            url.value = base;
            method.value = cExec.method ?? parentRequest.method;
            body.value = cExec.body ?? parentRequest.body ?? '';
            bodyType.value = cExec.bodyType || parentRequest.bodyType || ((cExec.body ?? parentRequest.body ?? '') !== '' ? 'json' : 'none');
            auth.value = cExec.auth ?? parentRequest.auth ?? { type: 'inherit' };
            preScripts.value = cExec.preScripts ?? parentRequest.preScripts ?? [];
            postScripts.value = cExec.postScripts ?? parentRequest.postScripts ?? [];
            queryParams.value = getMergedQueryParams(parentRequest.url, cExec.queryParams);
            pathParams.value = cExec.pathParams ?? {};
            headers.value = getMergedHeaders();
            formData.value = cExec.formData ?? parentRequest.formData ?? [];
        });
    }, [activeExecutionId.value, parentRequest?.id]);

    // Update detected path keys
    useSignalEffect(() => {
        const matches = url.value.match(/(?<!\{)\{[a-zA-Z0-9_]+\}(?!\})/g);
        detectedPathKeys.value = matches ? matches.map(m => m.slice(1, -1)) : [];
    });

    // Reactive sync from parent changes
    useSignalEffect(() => {
        const allRequests = requests.value;
        const execId = activeExecutionId.value;
        if (!execId || execId !== lastLoadedId.current) return;

        const cExec = executions.peek().find(e => e.id === execId);
        if (!cExec) return;

        const parent = allRequests.find(r => r.id === cExec.requestId);
        if (!parent) return;

        batch(() => {
            const { base } = parseUrl(parent.url);
            url.value = base;
            queryParams.value = getMergedQueryParams(parent.url, cExec.queryParams);
            if (!cExec.method) method.value = parent.method;
            headers.value = mergeRows(parent.headers || [], cExec.headers);
        });
    });

    // --- Computed Values ---

    const inheritedAuth = useComputed(() => {
        folders.value; requests.value;
        return parentRequest ? resolveAuth(parentRequest.id) : undefined;
    });

    const inheritedHeaders = useComputed(() => {
        folders.value; requests.value;
        return (parentRequest && parentRequest.parentId) ? resolveHeaders(parentRequest.parentId) : [];
    });

    const progress = useComputed(() => executionProgressMap.value[activeExecutionId.value || ''] || {
        isLoading: false, steps: [], startTime: null, totalTime: null, lastResponseTime: null, responseSize: null, responseStatus: null
    });

    const finalUrlPreview = useComputed(() => {
        let finalUrl = substituteVariables(url.value);
        detectedPathKeys.value.forEach(key => {
            if (pathParams.value?.[key]) finalUrl = finalUrl.replace(`{${key}}`, substituteVariables(pathParams.value[key]));
        });

        if (queryParams.value.length > 0) {
            const searchParams = new URLSearchParams();
            queryParams.value.forEach(p => {
                if (p.key && p.enabled) p.values.forEach(v => searchParams.append(substituteVariables(p.key), substituteVariables(v)));
            });
            const qs = searchParams.toString();
            if (qs) finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs;
        }
        return finalUrl;
    });

    const overriddenHeaders = useComputed(() => {
        const parentHeaders = parentRequest.headers || [];
        return new Set(headers.value.filter(h => {
            const parentMatch = parentHeaders.find(ph => ph.key === h.key);
            if (!h.key || parentMatch === undefined) return false;
            return JSON.stringify(h.values) !== JSON.stringify(parentMatch.values) || !h.enabled;
        }).map(h => h.key));
    });

    const overriddenQueryParams = useComputed(() => {
        const { params: parentParams } = parseUrl(parentRequest.url);
        const overriddenKeys = new Set<string>();
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
    const isReadOnly = useComputed(() => currentExecution.name === 'default');

    // --- Action Handlers ---

    function substituteVariables(text: string | null | undefined): string {
        if (!text) return '';
        const placeholders = Array.from(new Set(text.match(/{{\s*[\S]+?\s*}}/g) || []));
        if (placeholders.length === 0) return text;

        const env = environments.value.find(e => e.name === activeEnvName.value);
        const folderScopes: any[] = [];
        let currentParentId = parentRequest?.parentId;
        while (currentParentId) {
            const f = folders.value.find(x => x.id === currentParentId);
            if (f) { folderScopes.push(f); currentParentId = f.parentId; } else break;
        }

        let result = text;
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            let value: string | null = null;
            for (const folder of folderScopes) {
                if (folder.variables?.[key]) { value = folder.variables[key]; break; }
            }
            if (value === null && env) value = env.variables.find(v => v.key === key)?.value || null;
            if (value === null) value = environments.value.find(e => e.name === 'Global')?.variables.find(v => v.key === key)?.value || null;
            if (value !== null) result = result.split(placeholder).join(value);
        });
        return result;
    }

    const handleSend = () => {
        runExecution(activeExecutionId.peek()!, {
            url: url.peek(), method: method.peek(), headers: headers.peek(), queryParams: queryParams.peek(),
            body: body.peek(), bodyType: bodyType.peek(), auth: auth.peek(), preScripts: preScripts.peek(),
            postScripts: postScripts.peek(), formData: formData.peek(), pathParams: pathParams.peek()
        });
    };

    const handleCancel = () => cancelExecution(activeExecutionId.peek()!);

    const updateUrlFromParams = (newParams: TableRow[]) => { queryParams.value = newParams; };

    const navigateToParent = () => {
        if (!parentRequest) return;
        batch(() => {
            if (!openTabs.value.find(t => t.id === parentRequest.id)) {
                openTabs.value = [...openTabs.value, { id: parentRequest.id, type: 'request', name: parentRequest.name }];
            }
            activeTabId.value = parentRequest.id;
            activeRequestId.value = parentRequest.id;
            activeExecutionId.value = null;
        });
    };

    // --- Auto-Save Sync ---

    useSignalEffect(() => {
        const execId = activeExecutionId.value;
        if (!execId || execId !== lastLoadedId.current) return;

        const allExecs = executions.peek();
        const idx = allExecs.findIndex(e => e.id === execId);
        if (idx === -1) return;

        const exec = allExecs[idx];
        const currentHeaders = headers.value;
        const currentQueryParams = queryParams.value;

        // Save logic: only store what differs from parent
        const parentHeaders = parentRequest.headers || [];
        let matchesParentHeaders = currentHeaders.length === parentHeaders.length;
        if (matchesParentHeaders) {
            for (const h of currentHeaders) {
                const pm = parentHeaders.find(ph => ph.key === h.key);
                if (!h.enabled || !pm || JSON.stringify(pm.values) !== JSON.stringify(h.values)) { matchesParentHeaders = false; break; }
            }
        }
        const finalHeaders = matchesParentHeaders ? undefined : currentHeaders;

        const { params: pParams } = parseUrl(parentRequest.url);
        const overriddenParams = currentQueryParams.filter(cp => {
            const pm = pParams.find(pp => pp.key === cp.key);
            return !pm || JSON.stringify(pm.values) !== JSON.stringify(cp.values) || !cp.enabled;
        });
        const finalQueryParams = overriddenParams.length > 0 ? overriddenParams : undefined;

        const finalBody = body.value === (parentRequest.body ?? '') ? undefined : body.value;
        const finalBodyType = bodyType.value === (parentRequest.bodyType || 'json') ? undefined : bodyType.value;
        const finalAuth = JSON.stringify(auth.value) === JSON.stringify(parentRequest.auth ?? { type: 'inherit' }) ? undefined : auth.value;

        if (exec.name !== name.value || JSON.stringify(exec.headers) !== JSON.stringify(finalHeaders) || JSON.stringify(exec.queryParams) !== JSON.stringify(finalQueryParams) || exec.body !== finalBody || exec.auth !== finalAuth) {
            batch(() => {
                const newExecs = [...allExecs];
                newExecs[idx] = { ...exec, name: name.value, headers: finalHeaders, queryParams: finalQueryParams, body: finalBody, bodyType: finalBodyType, auth: finalAuth };
                executions.value = newExecs;
                const newUnsaved = new Set(unsavedItemIds.peek());
                newUnsaved.add(execId);
                unsavedItemIds.value = newUnsaved;
            });
        }
    });

    // --- Resizer State ---
    const containerRef = useRef<HTMLDivElement>(null);
    const leftPanelWidth = useSignal(50);
    const isResizing = useSignal(false);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing.value && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
            if (newWidth >= 20 && newWidth <= 80) leftPanelWidth.value = newWidth;
        }
    }, [isResizing.value]);

    useEffect(() => {
        const stop = () => isResizing.value = false;
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stop);
        return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stop); };
    }, [resize]);

    return (
        <div style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                    value={name.value}
                    onInput={(e) => name.value = e.currentTarget.value}
                    readOnly={isReadOnly.value}
                    style={{ flex: 1, fontSize: '1.25rem', fontWeight: 'bold', border: 'none', background: 'transparent', outline: 'none', color: isReadOnly.value ? 'var(--text-muted)' : 'var(--text-primary)' }}
                />
                <div onClick={navigateToParent} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>
                    <ArrowLeft size={14} /> based on: <strong style={{ color: 'var(--text-secondary)' }}>{parentRequest.name}</strong>
                </div>
            </div>

            {/* URL Bar */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <MethodSelect value={method.value} onChange={() => {}} disabled={true} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <VariableInput value={url.value} readOnly={true} onInput={() => {}} placeholder="URL" style={{ border: 'none', background: 'transparent' }} />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: '8px', opacity: 0.8 }}>Preview: {finalUrlPreview.value}</div>
                </div>
                <button onClick={progress.value.isLoading ? handleCancel : handleSend} style={{ padding: '8px 24px', backgroundColor: progress.value.isLoading ? 'var(--error)' : 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                    {progress.value.isLoading ? <XCircle size={18} /> : <Play size={18} fill="white" />} {progress.value.isLoading ? 'Cancel' : 'Run'}
                </button>
            </div>

            {/* Progress */}
            {(progress.value.isLoading || progress.value.steps.length > 0) && (
                <ExecutionProgress isLoading={useSignal(progress.value.isLoading)} executionSteps={useSignal(progress.value.steps)} startTime={useSignal(progress.value.startTime)} totalExecutionTime={useSignal(progress.value.totalTime)} lastResponseTime={useSignal(progress.value.lastResponseTime)} responseSize={useSignal(progress.value.responseSize)} responseStatus={useSignal(progress.value.responseStatus)} compact={false} />
            )}

            {/* Dual Panel */}
            <div ref={containerRef} style={{ flex: 1, display: 'flex', minHeight: 0, marginTop: '8px' }}>
                <div style={{ width: `${leftPanelWidth.value}%`, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <ExecutionRequestPanel
                        id={currentExecution.id} headers={headers} bodyType={bodyType} body={body} auth={auth}
                        queryParams={queryParams} pathParams={pathParams} formData={formData} detectedPathKeys={detectedPathKeys}
                        updateUrlFromParams={updateUrlFromParams} inheritedAuth={inheritedAuth.value} inheritedHeaders={inheritedHeaders.value}
                        preScripts={preScripts} postScripts={postScripts} overriddenHeaders={overriddenHeaders.value}
                        overriddenQueryParams={overriddenQueryParams.value} parentHeaderKeys={parentHeaderKeys.value}
                        parentQueryParamKeys={parentQueryParamKeys.value} isBodyOverridden={isBodyOverridden.value}
                        isAuthOverridden={isAuthOverridden.value} isReadOnly={isReadOnly.value}
                    />
                </div>
                <div onMouseDown={() => isResizing.value = true} style={{ width: '4px', cursor: 'col-resize', backgroundColor: 'var(--border-color)', margin: '0 4px', borderRadius: '2px' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <ResponsePanel id={currentExecution.id} response={currentExecution.lastResponse || null} />
                </div>
            </div>
        </div>
    );
}
