import { JSX } from "preact";

interface InputProps extends JSX.HTMLAttributes<HTMLInputElement> {
    variant?: 'default' | 'mono' | 'transparent';
    error?: string;
    label?: string;
}

export function Input({ variant = 'default', error, label, style, onInput, ...props }: InputProps) {
    const getVariantStyles = () => {
        switch (variant) {
            case 'mono':
                return {
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                };
            case 'transparent':
                return {
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                };
            case 'default':
            default:
                return {
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                };
        }
    };

    const baseStyle: JSX.CSSProperties = {
        width: '100%',
        color: 'var(--text-primary)',
        outline: 'none',
        display: 'block',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
        ...getVariantStyles(),
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            {label && <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>{label}</label>}
            <input 
                onInput={onInput}
                style={{ 
                    ...baseStyle, 
                    borderColor: error ? 'var(--error)' : 'var(--border-color)',
                    ...(style as any) 
                }}
                {...props}
            />
            {error && <span style={{ fontSize: '0.7rem', color: 'var(--error)' }}>{error}</span>}
        </div>
    );
}
