import { Plus, Trash2 } from 'lucide-preact';
import { environments, activeEnvironmentName, Environment, selectedEnvironmentInManager, confirmationState } from '../store';
import { Modal } from './Modal';


interface EnvironmentManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function EnvironmentManager({ isOpen, onClose }: EnvironmentManagerProps) {
    // If no environment is selected, select the first one or create one?
    // We can use a side effect to ensure selection
    if (isOpen && !selectedEnvironmentInManager.value && environments.value.length > 0) {
        selectedEnvironmentInManager.value = environments.value[0].name;
    }

    // Alias for easier refactoring, though valid to use signal directly
    const selectedEnvName = selectedEnvironmentInManager;

    const createEnvironment = () => {
        const baseName = 'New Environment';
        let newName = baseName;
        let counter = 1;
        while (environments.value.some(e => e.name === newName)) {
            newName = `${baseName} (${counter++})`;
        }

        const newEnv: Environment = {
            name: newName,
            variables: []
        };
        environments.value = [...environments.value, newEnv];
        selectedEnvName.value = newEnv.name;
    };

    const deleteEnvironment = (name: string, e: MouseEvent) => {
        e.stopPropagation();
        confirmationState.value = {
            isOpen: true,
            title: 'Delete Environment',
            message: `Are you sure you want to delete the environment "${name}"?`,
            onConfirm: () => {
                environments.value = environments.value.filter(e => e.name !== name);
                if (selectedEnvName.value === name) {
                    selectedEnvName.value = environments.value[0]?.name || null;
                }
                if (activeEnvironmentName.value === name) {
                    activeEnvironmentName.value = null;
                }
            }
        };
    };

    const updateEnvName = (oldName: string, newName: string) => {
        if (!newName || newName === oldName) return;
        if (environments.value.some(e => e.name === newName)) {
            alert('Environment name must be unique.');
            return;
        }

        environments.value = environments.value.map(e =>
            e.name === oldName ? { ...e, name: newName } : e
        );

        // Update selection states if needed
        if (selectedEnvName.value === oldName) selectedEnvName.value = newName;
        if (activeEnvironmentName.value === oldName) activeEnvironmentName.value = newName;
    };

    const addVariable = (envName: string) => {
        environments.value = environments.value.map(e =>
            e.name === envName ? { ...e, variables: [...e.variables, { key: '', value: '' }] } : e
        );
    };

    const updateVariable = (envName: string, index: number, field: 'key' | 'value', val: string) => {
        environments.value = environments.value.map(e => {
            if (e.name === envName) {
                const newVars = [...e.variables];
                newVars[index] = { ...newVars[index], [field]: val };
                return { ...e, variables: newVars };
            }
            return e;
        });
    };

    const removeVariable = (envName: string, index: number) => {
        environments.value = environments.value.map(e => {
            if (e.name === envName) {
                const newVars = e.variables.filter((_, i) => i !== index);
                return { ...e, variables: newVars };
            }
            return e;
        });
    };

    const currentEnv = environments.value.find(e => e.name === selectedEnvName.value);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Environments">
            <div style={{ display: 'flex', height: '400px', gap: 'var(--spacing-md)' }}>
                {/* Sidebar List */}
                <div style={{ width: '150px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {environments.value.map(env => (
                            <div
                                key={env.name}
                                onClick={() => selectedEnvName.value = env.name}
                                style={{
                                    padding: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: selectedEnvName.value === env.name ? 'var(--bg-surface)' : 'transparent',
                                    color: selectedEnvName.value === env.name ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderRadius: 'var(--radius-sm)'
                                }}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                                {env.name !== 'Global' && (
                                    <div
                                        onClick={(e) => deleteEnvironment(env.name, e)}
                                        style={{ opacity: 0.6, cursor: 'pointer' }}
                                    >
                                        <Trash2 size={12} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={createEnvironment}
                        style={{
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: '1px dashed var(--border-color)',
                            color: 'var(--text-muted)',
                            padding: '4px',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-sm)'
                        }}
                    >
                        <Plus size={14} /> New Env
                    </button>
                </div>

                {/* Editor Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {currentEnv ? (
                        <>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Environment Name</label>
                                <input
                                    value={currentEnv.name}
                                    onChange={(e) => updateEnvName(currentEnv.name, e.currentTarget.value)}
                                    disabled={currentEnv.name === 'Global'}
                                    style={{
                                        width: '100%',
                                        padding: '6px',
                                        backgroundColor: 'var(--bg-input)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)',
                                        opacity: currentEnv.name === 'Global' ? 0.5 : 1
                                    }}
                                />
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <h4 style={{ margin: 0 }}>Variables</h4>
                                    <button
                                        onClick={() => addVariable(currentEnv.name)}
                                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Plus size={14} /> Add
                                    </button>
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {currentEnv.variables.map((v, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <input
                                                placeholder="Key"
                                                value={v.key}
                                                onInput={(e) => updateVariable(currentEnv.name, idx, 'key', e.currentTarget.value)}
                                                style={{ flex: 1, padding: '4px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                                            />
                                            <input
                                                placeholder="Value"
                                                value={v.value}
                                                onInput={(e) => updateVariable(currentEnv.name, idx, 'value', e.currentTarget.value)}
                                                style={{ flex: 1, padding: '4px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                                            />
                                            <button
                                                onClick={() => removeVariable(currentEnv.name, idx)}
                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                            Select an environment
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
