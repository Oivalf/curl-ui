import { useState } from 'preact/hooks';
import { useCases, executions, syncProjectManifest, activeProjectName, activeUseCaseId, UseCase, UseCaseStep, ExtractionRule, resolveVariables, substituteVariables, requests } from '../store';
import { Plus, Trash2, Play, ChevronRight, ListTree, Database } from 'lucide-preact';
import { invoke } from '@tauri-apps/api/core';

export function UseCaseManager() {
    const activeUseCase = useCases.value.find(u => u.id === activeUseCaseId.value);
    const [isRunning, setIsRunning] = useState<string | null>(null);
    const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
    const [runLogs, setRunLogs] = useState<{ stepIdx: number, status: 'running' | 'success' | 'error', message?: string }[]>([]);

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
            extractionRules: []
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

        try {
            for (let i = 0; i < useCase.steps.length; i++) {
                const step = useCase.steps[i];
                setCurrentStepIdx(i);

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

                logs.push({ stepIdx: i, status: 'success' });
                setRunLogs([...logs]);
            }
            alert("Use Case completed successfully!");
        } catch (err: any) {
            logs.push({ stepIdx: currentStepIdx, status: 'error', message: err.message });
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: currentStepIdx === idx ? 'var(--warning)' : 'var(--accent-primary)', color: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                    {idx + 1}
                                                </div>
                                                <select
                                                    value={step.executionId}
                                                    onChange={(e) => handleUpdateStep(activeUseCase.id, step.id, { executionId: e.currentTarget.value })}
                                                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                                >
                                                    <option value="">Select Execution...</option>
                                                    {executions.value.map(ex => (
                                                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                                                    ))}
                                                </select>
                                                {runLogs.find(l => l.stepIdx === idx)?.status === 'success' && <div style={{ color: 'var(--success)', fontSize: '0.8rem' }}>✓ Success</div>}
                                                {runLogs.find(l => l.stepIdx === idx)?.status === 'error' && <div style={{ color: 'var(--error)', fontSize: '0.8rem' }}>✗ Error</div>}
                                            </div>
                                            <button onClick={() => handleRemoveStep(activeUseCase.id, step.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                        </div>

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
