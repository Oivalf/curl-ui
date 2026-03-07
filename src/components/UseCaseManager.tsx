import { useState } from 'preact/hooks';
import { useCases, executions, syncProjectManifest, activeProjectName, activeUseCaseId, UseCase, UseCaseStep, ExtractionRule, resolveVariables, substituteVariables, requests } from '../store';
import { Plus, Trash2, Play, ChevronRight, ListTree, Database, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-preact';
import { invoke } from '@tauri-apps/api/core';
import { ResponseData } from '../store';
import { ResponsePanel } from './response/ResponsePanel';

export function UseCaseManager() {
    const activeUseCase = useCases.value.find(u => u.id === activeUseCaseId.value);
    const [isRunning, setIsRunning] = useState<string | null>(null);
    const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
    const [runLogs, setRunLogs] = useState<{ stepIdx: number, status: 'running' | 'success' | 'error', message?: string, response?: ResponseData }[]>([]);
    const [openResponses, setOpenResponses] = useState<Record<number, boolean>>({});

    const handleCreate = async () => {
        const name = prompt("Enter Use Case Name:", "New Use Case");
        if (!name) return;

        const newUseCase: UseCase = {
            id: crypto.randomUUID(),
            name,
            steps: []
        };

        useCases.value = [...useCases.value, newUseCase];
        activeUseCaseId.value = newUseCase.id;
        await syncProjectManifest(activeProjectName.peek());
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this Use Case?")) return;
        useCases.value = useCases.value.filter(u => u.id !== id);
        if (activeUseCaseId.value === id) activeUseCaseId.value = null;
        await syncProjectManifest(activeProjectName.peek());
    };

    const handleAddStep = (useCaseId: string) => {
        const newStep: UseCaseStep = {
            id: crypto.randomUUID(),
            executionId: "",
            extractionRules: [],
            successCodes: "2xx"
        };

        useCases.value = useCases.value.map(u =>
            u.id === useCaseId ? { ...u, steps: [...u.steps, newStep] } : u
        );
    };

    const handleUpdateStep = (useCaseId: string, stepId: string, update: Partial<UseCaseStep>) => {
        useCases.value = useCases.value.map(u =>
            u.id === useCaseId ? {
                ...u,
                steps: u.steps.map(s => s.id === stepId ? { ...s, ...update } : s)
            } : u
        );
    };

    const handleRemoveStep = (useCaseId: string, stepId: string) => {
        useCases.value = useCases.value.map(u =>
            u.id === useCaseId ? {
                ...u,
                steps: u.steps.filter(s => s.id !== stepId)
            } : u
        );
    };

    const handleAddExtractionRule = (useCaseId: string, stepId: string) => {
        const newRule: ExtractionRule = {
            source: "body",
            variableName: "new_var"
        };
        useCases.value = useCases.value.map(u =>
            u.id === useCaseId ? {
                ...u,
                steps: u.steps.map(s => s.id === stepId ? {
                    ...s,
                    extractionRules: [...s.extractionRules, newRule]
                } : s)
            } : u
        );
    };

    const handleRun = async (useCase: UseCase) => {
        if (isRunning) return;
        setIsRunning(useCase.id);
        setCurrentStepIdx(0);
        setRunLogs([]);

        let sessionVars: Record<string, string> = {};
        const logs: typeof runLogs = [];
        let lastResponse: ResponseData | undefined = undefined;

        try {
            for (let i = 0; i < useCase.steps.length; i++) {
                const step = useCase.steps[i];
                setCurrentStepIdx(i);
                lastResponse = undefined;

                const execution = executions.value.find(ex => ex.id === step.executionId);
                if (!execution) {
                    throw new Error(`Execution ${step.executionId} not found`);
                }

                const parentRequest = requests.value.find(r => r.id === execution.requestId);
                const variableMap = resolveVariables(parentRequest?.parentId || null, sessionVars);

                const finalUrl = substituteVariables(execution.url || parentRequest?.url || "", variableMap);
                const finalHeaders: string[][] = [];

                // Process headers
                const rawHeaders = execution.headers || parentRequest?.headers || [];
                rawHeaders.forEach((h: any) => {
                    // In requests, enabled might not be present (default true)
                    const isEnabled = h.enabled !== false;
                    if (isEnabled) {
                        h.values.forEach((v: string) => finalHeaders.push([h.key, substituteVariables(v, variableMap)]));
                    }
                });

                const res = await invoke<{ status: number, headers: string[][], body: string }>('http_request', {
                    args: {
                        method: execution.method || parentRequest?.method || 'GET',
                        url: finalUrl,
                        headers: finalHeaders,
                        body: substituteVariables(execution.body || parentRequest?.body || "", variableMap),
                        project_name: activeProjectName.peek()
                    }
                });

                lastResponse = {
                    status: res.status,
                    headers: res.headers,
                    body: res.body,
                    time: 0,
                    size: res.body.length
                };

                // Validate Status Code
                const successCodes = step.successCodes || "2xx";
                let isSuccess = false;
                if (successCodes === 'all') {
                    isSuccess = true;
                } else if (successCodes === '2xx' && res.status >= 200 && res.status < 300) {
                    isSuccess = true;
                } else {
                    const allowed = successCodes.split(',').map(s => s.trim());
                    if (allowed.includes(res.status.toString())) {
                        isSuccess = true;
                    }
                }

                if (!isSuccess) {
                    throw new Error(`Step failed with status ${res.status}. Expected: ${successCodes}`);
                }

                // Extraction
                for (const rule of step.extractionRules) {
                    if (rule.source === 'body') {
                        try {
                            const data = JSON.parse(res.body);
                            let val = data;
                            if (rule.jsonPath) {
                                const parts = rule.jsonPath.split('.');
                                for (const part of parts) {
                                    if (part === '$' || part === '') continue;
                                    val = val[part];
                                }
                            }
                            if (val !== undefined) {
                                sessionVars[rule.variableName] = String(val);
                            }
                        } catch (e) {
                            console.error("Extraction failed", e);
                        }
                    }
                }

                logs.push({ stepIdx: i, status: 'success', response: lastResponse });
                setRunLogs([...logs]);
            }
            alert("Use Case completed successfully!");
        } catch (err: any) {
            logs.push({ stepIdx: currentStepIdx, status: 'error', message: err.message, response: lastResponse });
            setRunLogs([...logs]);
            alert(`Use Case failed: ${err.message}`);
        } finally {
            setIsRunning(null);
            setCurrentStepIdx(-1);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ListTree size={20} color="var(--accent-primary)" />
                    <h2 style={{ margin: 0 }}>Use Case Manager</h2>
                </div>
                <button
                    onClick={handleCreate}
                    style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'var(--bg-base)',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'bold'
                    }}
                >
                    <Plus size={16} /> New Use Case
                </button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ width: '250px', borderRight: '1px solid var(--border-color)', overflowY: 'auto', backgroundColor: 'var(--bg-sidebar)' }}>
                    {useCases.value.map(u => (
                        <div
                            key={u.id}
                            onClick={() => activeUseCaseId.value = u.id}
                            style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                backgroundColor: activeUseCaseId.value === u.id ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'transparent',
                                borderLeft: activeUseCaseId.value === u.id ? '4px solid var(--accent-primary)' : '4px solid transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span style={{ fontWeight: activeUseCaseId.value === u.id ? 'bold' : 'normal' }}>{u.name}</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={(e) => { e.stopPropagation(); handleRun(u); }} style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}><Play size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {activeUseCase ? (
                        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>{activeUseCase.name}</h3>
                                <button
                                    onClick={() => handleAddStep(activeUseCase.id)}
                                    style={{ background: 'none', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                    Add Step
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {activeUseCase.steps.map((step, idx) => (
                                    <div key={step.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'var(--bg-surface)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: currentStepIdx === idx ? 'var(--warning)' : 'var(--accent-primary)', color: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                    {idx + 1}
                                                </div>
                                                <select
                                                    value={step.executionId}
                                                    onChange={(e) => handleUpdateStep(activeUseCase.id, step.id, { executionId: e.currentTarget.value })}
                                                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', flex: 1, maxWidth: '200px' }}
                                                >
                                                    <option value="">Select Execution...</option>
                                                    {executions.value.map(ex => (
                                                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                                                    ))}
                                                </select>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Success:</span>
                                                    <input
                                                        value={step.successCodes}
                                                        onInput={(e) => handleUpdateStep(activeUseCase.id, step.id, { successCodes: e.currentTarget.value })}
                                                        placeholder="200,201 or 2xx"
                                                        style={{ width: '80px', padding: '2px 6px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}
                                                    />
                                                </div>

                                                {runLogs.find(l => l.stepIdx === idx)?.status === 'success' && <div style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Success</div>}
                                                {runLogs.find(l => l.stepIdx === idx)?.status === 'error' && <div style={{ color: 'var(--error)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} /> Error</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {runLogs.find(l => l.stepIdx === idx)?.response && (
                                                    <button
                                                        onClick={() => setOpenResponses(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                        title="Toggle Response"
                                                    >
                                                        {openResponses[idx] ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                )}
                                                <button onClick={() => handleRemoveStep(activeUseCase.id, step.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </div>

                                        {openResponses[idx] && runLogs.find(l => l.stepIdx === idx)?.response && (
                                            <div style={{ marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '300px' }}>
                                                <ResponsePanel response={runLogs.find(l => l.stepIdx === idx)!.response!} />
                                            </div>
                                        )}

                                        <div style={{ marginLeft: '32px' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Database size={14} /> Extraction Rules
                                            </div>
                                            {step.extractionRules.map((rule, ruleIdx) => (
                                                <div key={ruleIdx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                    <input
                                                        placeholder="Source (e.g. body)"
                                                        value={rule.source}
                                                        onInput={(e) => {
                                                            const newRules = [...step.extractionRules];
                                                            newRules[ruleIdx].source = e.currentTarget.value;
                                                            handleUpdateStep(activeUseCase.id, step.id, { extractionRules: newRules });
                                                        }}
                                                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}
                                                    />
                                                    <input
                                                        placeholder="JSONPath (e.g. data.id)"
                                                        value={rule.jsonPath}
                                                        onInput={(e) => {
                                                            const newRules = [...step.extractionRules];
                                                            newRules[ruleIdx].jsonPath = e.currentTarget.value;
                                                            handleUpdateStep(activeUseCase.id, step.id, { extractionRules: newRules });
                                                        }}
                                                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}
                                                    />
                                                    <ChevronRight size={14} style={{ alignSelf: 'center' }} />
                                                    <input
                                                        placeholder="Var Name"
                                                        value={rule.variableName}
                                                        onInput={(e) => {
                                                            const newRules = [...step.extractionRules];
                                                            newRules[ruleIdx].variableName = e.currentTarget.value;
                                                            handleUpdateStep(activeUseCase.id, step.id, { extractionRules: newRules });
                                                        }}
                                                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem' }}
                                                    />
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => handleAddExtractionRule(activeUseCase.id, step.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                                            >
                                                + Add Rule
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <ListTree size={48} opacity={0.3} style={{ marginBottom: '16px' }} />
                            <p>Select a Use Case from the list or create a new one.</p>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => syncProjectManifest(activeProjectName.peek())}
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '6px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
}
