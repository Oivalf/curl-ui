import { Plus, Trash2 } from 'lucide-preact';
import { environments, activeEnvironmentName, Environment, selectedEnvironmentInManager, confirmationState } from '../store';
import { Modal } from './Modal';


interface EnvironmentManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function EnvironmentManager({ isOpen, onClose }: EnvironmentManagerProps) {
    // If no environment is selected, select the first one
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
        if (envName === 'Global') {
            environments.value = environments.value.map(e =>
                e.name === 'Global' ? { ...e, variables: [...e.variables, { key: '', value: '' }] } : e
            );
            return;
        }

        // Add to all non-Global environments to maintain synchronized indices
        environments.value = environments.value.map(e => {
            if (e.name !== 'Global') {
                return { ...e, variables: [...e.variables, { key: '', value: '' }] };
            }
            return e;
        });
    };

    const updateVariable = (envName: string, index: number, field: 'key' | 'value', val: string) => {
        const targetEnv = environments.peek().find(e => e.name === envName);
        if (!targetEnv || !targetEnv.variables[index]) return;
        const oldKey = targetEnv.variables[index].key;

        if (field === 'value') {
            // Value updates are ALWAYS local to the current environment
            environments.value = environments.value.map(e => {
                if (e.name === envName) {
                    const newVars = [...e.variables];
                    newVars[index] = { ...newVars[index], value: val };
                    return { ...e, variables: newVars };
                }
                return e;
            });
            return;
        }

        // Key updates (field === 'key')
        if (envName === 'Global') {
            // Renaming a Global key updates it in Global AND renames matching overrides in other envs
            environments.value = environments.value.map(e => {
                const newVars = [...e.variables];
                if (e.name === 'Global') {
                    newVars[index] = { ...newVars[index], key: val };
                } else {
                    const matchIdx = newVars.findIndex(v => v.key === oldKey);
                    if (matchIdx !== -1) {
                        newVars[matchIdx] = { ...newVars[matchIdx], key: val };
                    }
                }
                return { ...e, variables: newVars };
            });
        } else {
            // Renaming a Local key in a non-Global environment
            // If this key is an override of a Global variable, it's local (though UI disables editing it)
            // If it's a Normal variable, sync the name to all other non-Global envs by OLD KEY
            const allEnvs = environments.peek();
            const gEnv = allEnvs.find(e => e.name === 'Global');
            const isOverride = gEnv?.variables.some(gv => gv.key === oldKey && oldKey !== '');

            environments.value = allEnvs.map(e => {
                if (e.name === 'Global') return e; // Don't touch Global
                if (isOverride && e.name !== envName) return e; // Don't touch other envs if it's a local override

                const newVars = [...e.variables];
                const matchIdx = (e.name === envName) ? index : newVars.findIndex(v => v.key === oldKey);

                if (matchIdx !== -1) {
                    newVars[matchIdx] = { ...newVars[matchIdx], key: val };
                }
                return { ...e, variables: newVars };
            });
        }
    };

    const removeVariable = (envName: string, index: number) => {
        const targetEnv = environments.peek().find(e => e.name === envName);
        if (!targetEnv || !targetEnv.variables[index]) return;
        const keyToRemove = targetEnv.variables[index].key;

        if (envName === 'Global') {
            // Removing from Global: remove from Global AND remove any overrides in other environments
            environments.value = environments.value.map(e => ({
                ...e,
                variables: e.variables.filter(v => e.name === 'Global' ? e.variables.indexOf(v) !== index : v.key !== keyToRemove)
            }));
            return;
        }

        // Removing from a non-Global environment
        const allEnvs = environments.peek();
        const gEnv = allEnvs.find(e => e.name === 'Global');
        const isOverride = gEnv?.variables.some(gv => gv.key === keyToRemove && keyToRemove !== '');

        if (isOverride) {
            // It's an override: only remove from the current environment
            environments.value = allEnvs.map(e => {
                if (e.name === envName) {
                    return { ...e, variables: e.variables.filter((_, i) => i !== index) };
                }
                return e;
            });
        } else {
            // It's a Normal variable: remove by key from all non-Global environments
            if (keyToRemove === '') {
                // If key is empty, we must use index for the current env and can't reliably sync to others
                environments.value = allEnvs.map(e => {
                    if (e.name === 'Global') return e;
                    if (e.name === envName) return { ...e, variables: e.variables.filter((_, i) => i !== index) };
                    return e;
                });
            } else {
                environments.value = allEnvs.map(e => {
                    if (e.name === 'Global') return e;
                    return { ...e, variables: e.variables.filter(v => v.key !== keyToRemove) };
                });
            }
        }
    };

    const overrideGlobalVariable = (key: string, value: string) => {
        if (!selectedEnvName.value || selectedEnvName.value === 'Global') return;

        environments.value = environments.value.map(e => {
            if (e.name !== selectedEnvName.value) return e;

            const newVars = [...e.variables];
            const existingIdx = newVars.findIndex(v => v.key === key);

            if (existingIdx !== -1) {
                newVars[existingIdx] = { ...newVars[existingIdx], value };
            } else {
                newVars.push({ key, value });
            }
            return { ...e, variables: newVars };
        });
    };

    const currentEnv = environments.value.find(e => e.name === selectedEnvName.value);
    const globalEnv = environments.value.find(e => e.name === 'Global');

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
                                </div>

                                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                                    {/* Global Inherited Variables */}
                                    {currentEnv.name !== 'Global' && globalEnv && globalEnv.variables.length > 0 && (
                                        <div style={{ marginBottom: '16px', padding: '8px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', opacity: 0.8 }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                                                Inherited from Global
                                            </div>
                                            {globalEnv.variables
                                                .filter(gv => !currentEnv.variables.some(lv => lv.key === gv.key))
                                                .map((v, idx) => (
                                                    <div key={`global-${idx}`} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                                        <div style={{ flex: 1, padding: '4px 8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.6 }}>
                                                            {v.key || <span style={{ fontStyle: 'italic' }}>(empty key)</span>}
                                                        </div>
                                                        <input
                                                            placeholder="Override Value"
                                                            value={v.value}
                                                            onInput={(e) => overrideGlobalVariable(v.key, e.currentTarget.value)}
                                                            style={{ flex: 1, padding: '4px 8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                                                        />
                                                        <div style={{ width: '14px' }} />
                                                    </div>
                                                ))}
                                        </div>
                                    )}

                                    {/* Add Button - specifically after Global box if it exists */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                                        <button
                                            onClick={() => addVariable(currentEnv.name)}
                                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                                        >
                                            <Plus size={14} /> Add Variable
                                        </button>
                                    </div>

                                    {/* Local Variables */}
                                    {currentEnv.variables.map((v, idx) => {
                                        const isOverride = currentEnv.name !== 'Global' && globalEnv?.variables.some(gv => gv.key === v.key && v.key !== '');
                                        return (
                                            <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                                                    <input
                                                        placeholder="Key"
                                                        value={v.key}
                                                        onInput={(e) => updateVariable(currentEnv.name, idx, 'key', e.currentTarget.value)}
                                                        disabled={isOverride}
                                                        style={{ width: '100%', padding: '4px', paddingRight: isOverride ? '24px' : '4px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', opacity: isOverride ? 0.7 : 1 }}
                                                    />
                                                    {isOverride && (
                                                        <div
                                                            title="Overrides Global variable"
                                                            style={{
                                                                position: 'absolute',
                                                                right: '6px',
                                                                width: '14px',
                                                                height: '14px',
                                                                borderRadius: '50%',
                                                                backgroundColor: 'var(--accent-primary)',
                                                                color: '#000',
                                                                fontSize: '9px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 'bold',
                                                                cursor: 'help',
                                                                boxShadow: '0 0 4px rgba(0,0,0,0.3)'
                                                            }}
                                                        >
                                                            G
                                                        </div>
                                                    )}
                                                </div>
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
                                        );
                                    })}
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
