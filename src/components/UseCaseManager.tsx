import { useState } from 'preact/hooks';
import { Plus, Trash2, Play, ListTree, Database, Eye, EyeOff, CheckCircle, XCircle, X, Code } from 'lucide-preact';
import { useCases, executions, syncProjectManifest, activeProjectName, activeUseCaseId, UseCase, UseCaseStep, resolveVariables, requests, useCaseBlackboards } from '../store';
import { runExecution } from '../utils/execution';
import { CodeEditor } from './CodeEditor';
import { ResponseData } from '../store';
import { ResponsePanel } from './response/ResponsePanel';

const WOW_STYLES = `
    @keyframes breathing {
        0% { box-shadow: 0 0 0 0px rgba(137, 220, 235, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(137, 220, 235, 0); }
        100% { box-shadow: 0 0 0 0px rgba(137, 220, 235, 0); }
    }
    @keyframes slideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

export function UseCaseManager() {
    return (
        <>
            <style>{WOW_STYLES}</style>
            <UseCaseManagerContent />
        </>
    );
}

function UseCaseManagerContent() {
    const activeUseCase = useCases.value.find(u => u.id === activeUseCaseId.value);
    const [isRunning, setIsRunning] = useState<string | null>(null);
    const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
    const [runLogs, setRunLogs] = useState<{ stepIdx: number, status: 'running' | 'success' | 'error', message?: string, response?: ResponseData }[]>([]);
    const [openResponses, setOpenResponses] = useState<Record<number, boolean>>({});
    const [openScripts, setOpenScripts] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const blackboard = useCaseBlackboards.value[activeUseCase?.id || ''] || {};
    const manualVariables = activeUseCase?.variables || {};

    const handleUpdateManualVariables = (useCaseId: string, vars: Record<string, string>) => {
        useCases.value = useCases.value.map(u =>
            u.id === useCaseId ? { ...u, variables: vars } : u
        );
    };

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
        const initialVars = useCase.variables || {};
        let sessionVars: Record<string, string> = { ...initialVars };
        const logs: typeof runLogs = [];
        let lastResponse: ResponseData | undefined = undefined;

        let activeIdx = -1;
        try {
            for (let i = 0; i < useCase.steps.length; i++) {
                activeIdx = i;
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
            if (activeIdx >= 0) {
                logs[activeIdx] = { stepIdx: activeIdx, status: 'error', message: err.message, response: lastResponse };
            } else {
                logs.push({ stepIdx: activeIdx, status: 'error', message: err.message, response: lastResponse });
            }
            setRunLogs([...logs]);
            const stepInfo = activeIdx >= 0 ? ` at step ${activeIdx + 1}` : "";
            alert(`Use Case failed${stepInfo}: ${err.message}`);
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
                <div style={{ 
                    width: '280px', 
                    borderRight: '1px solid var(--border-color)', 
                    overflowY: 'auto', 
                    backgroundColor: 'rgba(var(--bg-sidebar-rgb, 24, 24, 37), 0.7)',
                    backdropFilter: 'blur(10px)'
                }}>
                    {useCases.value.map(u => {
                        const isThisRunning = isRunning === u.id;
                        const isActive = activeUseCaseId.value === u.id;
                        return (
                            <div
                                key={u.id}
                                onClick={() => activeUseCaseId.value = u.id}
                                style={{
                                    padding: '16px',
                                    borderBottom: '1px solid rgba(var(--border-color-rgb, 69, 71, 90), 0.3)',
                                    cursor: 'pointer',
                                    backgroundColor: isActive ? 'rgba(var(--accent-primary-rgb), 0.08)' : 'transparent',
                                    background: isActive ? 'linear-gradient(90deg, rgba(var(--accent-primary-rgb), 0.12) 0%, transparent 100%)' : 'transparent',
                                    borderLeft: isActive ? '4px solid var(--accent-primary)' : '4px solid transparent',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {isThisRunning && (
                                        <div style={{ 
                                            width: '8px', 
                                            height: '8px', 
                                            borderRadius: '50%', 
                                            backgroundColor: 'var(--accent-primary)',
                                            boxShadow: '0 0 8px var(--accent-primary)',
                                            animation: 'breathing 2s infinite ease-in-out'
                                        }} />
                                    )}
                                    <span style={{ 
                                        fontWeight: isActive ? '600' : '400',
                                        fontSize: '0.95rem',
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        letterSpacing: '0.01em'
                                    }}>{u.name}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', opacity: isActive ? 1 : 0.4 }}>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRun(u); }} 
                                        style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', transition: 'transform 0.1s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    ><Play size={16} /></button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }} 
                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', transition: 'transform 0.1s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    ><Trash2 size={16} /></button>
                                </div>
                            </div>
                        );
                    })}
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
                            <div style={{ 
                                marginBottom: '32px', 
                                padding: '24px', 
                                backgroundColor: 'rgba(var(--bg-surface-rgb, 49, 50, 68), 0.4)', 
                                borderRadius: 'var(--radius-lg)', 
                                border: '1px solid rgba(var(--border-color-rgb, 69, 71, 90), 0.5)',
                                backdropFilter: 'blur(5px)',
                                boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ padding: '8px', borderRadius: '12px', background: 'rgba(var(--accent-primary-rgb), 0.1)', display: 'flex' }}>
                                            <Database size={20} color="var(--accent-primary)" />
                                        </div>
                                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Blackboard Control Center</h4>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const key = prompt("Variable name:");
                                            if (key && activeUseCase) {
                                                handleUpdateManualVariables(activeUseCase.id, { ...manualVariables, [key]: "" });
                                                handleUpdateBlackboard(activeUseCase.id, { ...blackboard, [key]: "" });
                                            }
                                        }}
                                        style={{ background: 'rgba(var(--accent-primary-rgb), 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(var(--accent-primary-rgb), 0.3)', padding: '6px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', transition: 'all 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--accent-primary-rgb), 0.2)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(var(--accent-primary-rgb), 0.1)'}
                                    >
                                        <Plus size={16} /> Add Initial Variable
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {Object.entries(blackboard).length === 0 && (
                                        <div style={{ width: '100%', textAlign: 'center', padding: '24px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                                            <span style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>No variables defined. Initial variables and step responses will populate this.</span>
                                        </div>
                                    )}
                                    {Object.entries(blackboard).map(([key, value]) => {
                                        const isManual = key in manualVariables;
                                        return (
                                            <div key={key} style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                backgroundColor: isManual ? 'var(--bg-input)' : 'rgba(var(--accent-primary-rgb), 0.08)', 
                                                padding: '6px 12px', 
                                                borderRadius: '20px', 
                                                border: isManual ? '1px solid var(--border-color)' : '1px solid rgba(var(--accent-primary-rgb), 0.4)',
                                                transition: 'all 0.2s',
                                                boxShadow: isManual ? 'none' : '0 0 12px rgba(var(--accent-primary-rgb), 0.1)'
                                            }}>
                                                <span style={{ 
                                                    fontSize: '0.85rem', 
                                                    fontWeight: '600', 
                                                    color: isManual ? 'var(--accent-primary)' : 'var(--text-primary)'
                                                }}>
                                                    {key}:
                                                </span>
                                                <input
                                                    value={value}
                                                    onInput={(e) => {
                                                        if (!activeUseCase) return;
                                                        const newVal = e.currentTarget.value;
                                                        handleUpdateBlackboard(activeUseCase.id, { ...blackboard, [key]: newVal });
                                                        if (isManual) handleUpdateManualVariables(activeUseCase.id, { ...manualVariables, [key]: newVal });
                                                    }}
                                                    disabled={!!isRunning || !isManual}
                                                    style={{ border: 'none', background: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', width: '90px', outline: 'none', padding: 0 }}
                                                />
                                                {!isRunning && isManual && (
                                                    <button
                                                        onClick={() => {
                                                            if (!activeUseCase) return;
                                                            const newManual = { ...manualVariables };
                                                            delete newManual[key];
                                                            handleUpdateManualVariables(activeUseCase.id, newManual);
                                                            const newRuntime = { ...blackboard };
                                                            delete newRuntime[key];
                                                            handleUpdateBlackboard(activeUseCase.id, newRuntime);
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.6 }}
                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                                {!isManual && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-base)', padding: '2px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 'bold', marginLeft: '4px' }}>
                                                        VOLATILE
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
                                {/* Step Timeline Line */}
                                <div style={{ 
                                    position: 'absolute', 
                                    left: '28px', 
                                    top: '20px', 
                                    bottom: '20px', 
                                    width: '2px', 
                                    background: 'linear-gradient(to bottom, var(--accent-primary) 0%, var(--border-color) 100%)', 
                                    opacity: 0.3,
                                    zIndex: 0
                                }} />

                                {activeUseCase.steps.map((step, idx) => {
                                    const isCurrent = currentStepIdx === idx;
                                    const log = runLogs.find((l: any) => l.stepIdx === idx);
                                    const isSuccess = log?.status === 'success';
                                    const isError = log?.status === 'error';

                                    return (
                                        <div key={step.id} style={{ 
                                            position: 'relative', 
                                            marginBottom: '24px', 
                                            paddingLeft: '60px', 
                                            animation: 'slideIn 0.3s ease-out'
                                        }}>
                                            <div style={{ 
                                                border: '1px solid var(--border-color)', 
                                                borderRadius: 'var(--radius-lg)', 
                                                padding: '20px', 
                                                backgroundColor: 'rgba(var(--bg-surface-rgb), 0.5)',
                                                backdropFilter: 'blur(5px)',
                                                boxShadow: isCurrent ? '0 0 20px rgba(var(--accent-hover-rgb), 0.15)' : 'none',
                                                transition: 'all 0.3s ease',
                                                zIndex: 1,
                                                position: 'relative',
                                                borderLeft: isCurrent ? '4px solid var(--accent-primary)' : 
                                                           isSuccess ? '4px solid var(--success)' :
                                                           isError ? '4px solid var(--error)' : '1px solid var(--border-color)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                        {/* Step Icon / Number */}
                                                        <div style={{ 
                                                            position: 'absolute',
                                                            left: '-46px',
                                                            top: '2px',
                                                            width: '32px', 
                                                            height: '32px', 
                                                            borderRadius: '50%', 
                                                            backgroundColor: isCurrent ? 'var(--accent-primary)' : 
                                                                             isSuccess ? 'var(--success)' : 
                                                                             isError ? 'var(--error)' : 'var(--bg-surface)', 
                                                            color: (isCurrent || isSuccess || isError) ? 'var(--bg-base)' : 'var(--text-muted)', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'center', 
                                                            fontSize: '0.9rem', 
                                                            fontWeight: 'bold',
                                                            boxShadow: (isCurrent || isSuccess || isError) ? '0 0 15px rgba(0,0,0,0.3)' : 'none',
                                                            border: (isCurrent || isSuccess || isError) ? 'none' : '2px solid var(--border-color)',
                                                            zIndex: 2,
                                                            transition: 'all 0.3s'
                                                        }}>
                                                            {isSuccess ? <CheckCircle size={18} /> : 
                                                             isError ? <XCircle size={18} /> : 
                                                             (idx + 1)}
                                                        </div>

                                                        <select
                                                            value={step.executionId}
                                                            onChange={(e) => handleUpdateStep(activeUseCase.id, step.id, { executionId: e.currentTarget.value })}
                                                            style={{ 
                                                                padding: '6px 12px', 
                                                                borderRadius: 'var(--radius-md)', 
                                                                border: '1px solid var(--border-color)', 
                                                                backgroundColor: 'var(--bg-input)', 
                                                                color: 'var(--text-primary)', 
                                                                flex: 1, 
                                                                maxWidth: '220px',
                                                                fontSize: '0.9rem',
                                                                fontWeight: '500'
                                                            }}
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
                                                        
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', padding: '4px 10px', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-sm)' }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Success:</span>
                                                            <input
                                                                value={step.successCodes}
                                                                onInput={(e) => handleUpdateStep(activeUseCase.id, step.id, { successCodes: e.currentTarget.value })}
                                                                placeholder="200,2xx"
                                                                style={{ width: '60px', padding: '0', fontSize: '0.85rem', border: 'none', background: 'none', fontWeight: 'bold', color: 'var(--accent-primary)' }}
                                                            />
                                                        </div>

                                                        {isSuccess && <div style={{ animation: 'fadeIn 0.5s', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 'bold' }}>COMPLETED</div>}
                                                        {isError && <div style={{ animation: 'fadeIn 0.5s', color: 'var(--error)', fontSize: '0.85rem', fontWeight: 'bold' }}>FAILED</div>}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        {log?.response && (
                                                            <button
                                                                onClick={() => setOpenResponses((prev: any) => ({ ...prev, [idx]: !prev[idx] }))}
                                                                style={{ background: 'rgba(var(--accent-primary-rgb), 0.1)', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: 'var(--radius-sm)', transition: 'all 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--accent-primary-rgb), 0.2)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(var(--accent-primary-rgb), 0.1)'}
                                                            >
                                                                {openResponses[idx] ? <EyeOff size={18} /> : <Eye size={18} />}
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleRemoveStep(activeUseCase.id, step.id)} 
                                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-sm)', transition: 'all 0.2s' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                                        ><Trash2 size={18} /></button>
                                                    </div>
                                                </div>

                                                {openResponses[idx] && log?.response && (
                                                    <div style={{ marginBottom: '20px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: '350px', animation: 'fadeIn 0.3s' }}>
                                                        <ResponsePanel id={step.id} response={log.response} />
                                                    </div>
                                                )}

                                                <div style={{ borderTop: '1px solid rgba(var(--border-color-rgb), 0.3)', pt: '16px', marginTop: '4px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <Code size={16} /> Optional Step Script
                                                        </div>
                                                        <button
                                                            onClick={() => setOpenScripts((prev: any) => ({ ...prev, [step.id]: !prev[step.id] }))}
                                                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
                                                        >
                                                            {openScripts[step.id] ? 'Minimize Editor' : 'Edit Script'}
                                                        </button>
                                                    </div>

                                                    {openScripts[step.id] && (
                                                        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: '220px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)', animation: 'slideIn 0.2s' }}>
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
                                        </div>
                                    );
                                })}
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
                    onClick={async () => {
                        await syncProjectManifest(activeProjectName.peek());
                        setIsSaving(true);
                        setTimeout(() => setIsSaving(false), 1500);
                    }}
                    style={{ 
                        backgroundColor: isSaving ? 'var(--success)' : 'var(--bg-surface)', 
                        color: isSaving ? '#fff' : 'var(--text-primary)',
                        border: '1px solid',
                        borderColor: isSaving ? 'var(--success)' : 'var(--border-color)', 
                        padding: '6px 16px', 
                        borderRadius: 'var(--radius-md)', 
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    {isSaving && <CheckCircle size={14} />}
                    {isSaving ? 'Saved!' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
