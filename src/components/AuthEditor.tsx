import { Signal } from "@preact/signals";
import { AuthConfig, AuthType, navigateToItem } from "../store";
import { OverrideIndicator } from "./OverrideIndicator";
import { VariableInput } from "./VariableInput";

interface AuthEditorProps {
    auth: Signal<AuthConfig | undefined>;
    onChange: (newAuth: AuthConfig) => void;
    showInherit?: boolean;
    inheritedAuth?: { config: AuthConfig, source: string, sourceId?: string };
    isReadOnly?: boolean;
    isOverridden?: boolean;
    parentId?: string | null;
}

export function AuthEditor({ auth, onChange, showInherit = true, inheritedAuth, isReadOnly = false, isOverridden, parentId }: AuthEditorProps) {
    const currentAuth = auth.value || { type: showInherit ? 'inherit' : 'none' };

    const handleTypeChange = (type: AuthType) => {
        onChange({ ...currentAuth, type });
    };

    const updateBasic = (field: 'username' | 'password', value: string) => {
        onChange({
            ...currentAuth,
            basic: { ...(currentAuth.basic || { username: '', password: '' }), [field]: value }
        });
    };

    const updateBearer = (token: string) => {
        onChange({
            ...currentAuth,
            bearer: { token }
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auth Type</label>
                <select
                    value={currentAuth.type}
                    onChange={(e) => handleTypeChange(e.currentTarget.value as AuthType)}
                    disabled={isReadOnly}
                    style={{
                        padding: '8px',
                        backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-input)',
                        border: isReadOnly ? '1px solid transparent' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        cursor: isReadOnly ? 'default' : 'pointer'
                    }}
                >
                    {showInherit && <option value="inherit">Inherit from Parent</option>}
                    <option value="none">No Auth</option>
                    <option value="basic">Basic Auth</option>
                    <option value="bearer">Bearer Token</option>
                </select>
            </div>

            {currentAuth.type === 'basic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Username</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {isOverridden && <OverrideIndicator />}
                            <VariableInput
                                placeholder="Username"
                                value={currentAuth.basic?.username || ''}
                                readOnly={isReadOnly}
                                onInput={(v) => updateBasic('username', v)}
                                parentId={parentId}
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Password</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {isOverridden && <OverrideIndicator />}
                            <VariableInput
                                type="password"
                                placeholder="Password"
                                value={currentAuth.basic?.password || ''}
                                readOnly={isReadOnly}
                                onInput={(v) => updateBasic('password', v)}
                                parentId={parentId}
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {currentAuth.type === 'bearer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Token</label>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {isOverridden && <OverrideIndicator />}
                        <VariableInput
                            value={currentAuth.bearer?.token || ''}
                            readOnly={isReadOnly}
                            onInput={(v) => updateBearer(v)}
                            placeholder="e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            parentId={parentId}
                            style={{ flex: 1 }}
                        />
                    </div>
                </div>
            )}

            {currentAuth.type === 'inherit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                    {inheritedAuth ? (
                        <>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                Inheriting <strong>{inheritedAuth.config.type === 'basic' ? 'Basic Auth' : inheritedAuth.config.type === 'bearer' ? 'Bearer Token' : inheritedAuth.config.type}</strong> from{' '}
                                <span
                                    style={{
                                        fontStyle: 'italic',
                                        cursor: inheritedAuth.sourceId ? 'pointer' : 'default',
                                        textDecoration: inheritedAuth.sourceId ? 'underline' : 'none',
                                        color: inheritedAuth.sourceId ? 'var(--accent-primary)' : 'inherit'
                                    }}
                                    onClick={() => inheritedAuth.sourceId && navigateToItem(inheritedAuth.sourceId)}
                                    title={inheritedAuth.sourceId ? "Go to source" : ""}
                                >
                                    {inheritedAuth.source}
                                </span>
                            </div>

                            {inheritedAuth.config.type === 'basic' && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Username: {inheritedAuth.config.basic?.username}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            No authentication inherited (using No Auth).
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
