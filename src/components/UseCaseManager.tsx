import { useState } from 'preact/hooks';
import { Plus, Trash2, Play, ListTree, Database, Eye, EyeOff, CheckCircle, XCircle, X, Code } from 'lucide-preact';
import { useCases, executions, syncProjectManifest, activeProjectName, activeUseCaseId, UseCase, UseCaseStep, resolveVariables, requests, useCaseBlackboards } from '../store';
import { runExecution } from '../utils/execution';
import { CodeEditor } from './CodeEditor';
import { ResponseData } from '../store';
import { ResponsePanel } from './response/ResponsePanel';


export function UseCaseManager() {
    const activeUseCase = useCases.value.find(u => u.id === activeUseCaseId.value);
    const [isRunning, setIsRunning] = useState<string | null>(null);
    const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
    const [runLogs, setRunLogs] = useState<{ stepIdx: number, status: 'running' | 'success' | 'error', message?: string, response?: ResponseData }[]>([]);
    const [openResponses, setOpenResponses] = useState<Record<number, boolean>>({});
    const [openScripts, setOpenScripts] = useState<Record<string, boolean>>({});
    const blackboard = useCaseBlackboards.value[activeUseCase?.id || ''] || {};

    const groupedExecutions = requests.value.map(req => {
        const reqExecs = executions.value.filter(e => e.requestId === req.id);
        return {
            request: req,
            executions: reqExecs.sort((a, b) => {
                if (a.name === 'default') return -1;
                if (b.name === 'default') return 1;
                return (a.sortIndex || 0) - (b.sortIndex || 0);
            })
        };
    }).filter(group => group.executions.length > 0);

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

    // Removed handleAddExtractionRule as we are moving to Scripts

    const handleRun = async (useCase: UseCase) => {
        if (isRunning) return;
        setIsRunning(useCase.id);
        setCurrentStepIdx(0);
        setRunLogs([]);
        const initialBlackboard = useCaseBlackboards.value[useCase.id] || {};
        let sessionVars: Record<string, string> = { ...initialBlackboard };
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

                logs[i] = { stepIdx: i, status: 'running', response: undefined };
                setRunLogs([...logs]);

                // 1. Run Execution with injected script and blackboard context
                const res = await runExecution(
                    step.executionId,
                    {
                        additionalPreScripts: [{
                            id: 'use-case-step-script',
                            name: 'Use Case Step Script',
                            content: step.script || '',
                            enabled: true
                        }]
                    },
                    variableMap,
                    true,
                    {
                        blackboard: {
                            get: (key: string) => sessionVars[key],
                            set: (key: string, value: any) => {
                                sessionVars[key] = String(value);
                                handleUpdateBlackboard(useCase.id, { ...sessionVars });
                            },
                            delete: (key: string) => {
                                delete sessionVars[key];
                                handleUpdateBlackboard(useCase.id, { ...sessionVars });
                            },
                            getAll: () => ({ ...sessionVars })
                        }
                    }
                );

                if (!res) throw new Error("Execution failed to return a response.");
                lastResponse = res;

                // 2. Validate Success Codes
                const successCodes = step.successCodes || "2xx";
                const isSuccess = successCodes.split(',').map(c => c.trim()).some(c => {
                    if (c.includes('x')) {
                        const prefix = c.replace(/x/g, '');
                        return res.status.toString().startsWith(prefix);
                    }
                    return res.status.toString() === c;
                });

                if (!isSuccess) {
                    throw new Error(`Step failed with status ${res.status}. Expected: ${successCodes}`);
                }

                // Save response to blackboard (automatic variable)
                sessionVars[`step_${i + 1}_response`] = JSON.stringify({
                    status: res.status,
                    headers: res.headers,
                    body: res.body,
                    time: res.time,
                    size: res.size
                });

                logs[i] = { stepIdx: i, status: 'success', response: lastResponse };
                setRunLogs([...logs]);
                handleUpdateBlackboard(useCase.id, { ...sessionVars });
            }
            alert("Use Case completed successfully!");
        } catch (err: any) {
            if (currentStepIdx >= 0) {
                logs[currentStepIdx] = { stepIdx: currentStepIdx, status: 'error', message: err.message, response: lastResponse };
            } else {
                logs.push({ stepIdx: currentStepIdx, status: 'error', message: err.message, response: lastResponse });
            }
            setRunLogs([...logs]);
            alert(`Use Case failed: ${err.message}`);
        } finally {
            setIsRunning(null);
            setCurrentStepIdx(-1);
        }
    };

    const handleUpdateBlackboard = (useCaseId: string, blackboard: Record<string, string>) => {
        useCaseBlackboards.value = {
            ...useCaseBlackboards.value,
            [useCaseId]: blackboard
        };
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

                            {/* Blackboard Section */}
                            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Database size={16} color="var(--accent-primary)" />
                                        <h4 style={{ margin: 0 }}>Blackboard</h4>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const key = prompt("Variable name:");
                                            if (key && activeUseCase) handleUpdateBlackboard(activeUseCase.id, { ...blackboard, [key]: "" });
                                        }}
                                        style={{ background: 'none', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Plus size={14} /> Add Variable
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {Object.entries(blackboard).length === 0 && (
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No variables defined. Extraction rules and step responses will populate this during execution.</span>
                                    )}
                                    {Object.entries(blackboard).map(([key, value]) => (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-base)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{key}:</span>
                                            <input
                                                value={value}
                                                onInput={(e) => {
                                                    if (!activeUseCase) return;
                                                    const newBlackboard = { ...blackboard, [key]: e.currentTarget.value };
                                                    handleUpdateBlackboard(activeUseCase.id, newBlackboard);
                                                }}
                                                disabled={!!isRunning}
                                                style={{ border: 'none', background: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', width: '80px', outline: 'none' }}
                                            />
                                            {!isRunning && (
                                                <button
                                                    onClick={() => {
                                                        if (!activeUseCase) return;
                                                        const newBlackboard = { ...blackboard };
                                                        delete newBlackboard[key];
                                                        handleUpdateBlackboard(activeUseCase.id, newBlackboard);
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
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
                                                    {groupedExecutions.map(group => (
                                                        <optgroup key={group.request.id} label={group.request.name}>
                                                            {group.executions.map(ex => (
                                                                <option key={ex.id} value={ex.id}>
                                                                    {ex.name === 'default' ? 'Default' : ex.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
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

                                                {runLogs.find((l: any) => l.stepIdx === idx)?.status === 'success' && <div style={{ color: 'var(--success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Success</div>}
                                                {runLogs.find((l: any) => l.stepIdx === idx)?.status === 'error' && <div style={{ color: 'var(--error)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><XCircle size={14} /> Error</div>}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {runLogs.find((l: any) => l.stepIdx === idx)?.response && (
                                                    <button
                                                        onClick={() => setOpenResponses((prev: any) => ({ ...prev, [idx]: !prev[idx] }))}
                                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                        title="Toggle Response"
                                                    >
                                                        {openResponses[idx] ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                )}
                                                <button onClick={() => handleRemoveStep(activeUseCase.id, step.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                            </div>
                                        </div>

                                        {openResponses[idx] && runLogs.find((l: any) => l.stepIdx === idx)?.response && (
                                            <div style={{ marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '300px' }}>
                                                <ResponsePanel id={step.id} response={runLogs.find((l: any) => l.stepIdx === idx)!.response!} />
                                            </div>
                                        )}

                                        <div style={{ marginLeft: '32px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Code size={14} /> Script
                                                </div>
                                                <button
                                                    onClick={() => setOpenScripts((prev: any) => ({ ...prev, [step.id]: !prev[step.id] }))}
                                                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    {openScripts[step.id] ? 'Hide Editor' : 'Show Editor'}
                                                </button>
                                            </div>

                                            {openScripts[step.id] && (
                                                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '200px' }}>
                                                    <CodeEditor
                                                        value={step.script || ''}
                                                        onChange={(val) => handleUpdateStep(activeUseCase.id, step.id, { script: val })}
                                                        language="javascript"
                                                        enableScriptAutocompletion={true}
                                                    />
                                                </div>
                                            )}
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
