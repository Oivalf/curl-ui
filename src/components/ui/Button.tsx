import { JSX } from "preact";

interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    icon?: JSX.Element;
}

export function Button({ 
    variant = 'secondary', 
    size = 'md', 
    loading = false, 
    icon, 
    children, 
    style, 
    className, 
    disabled, 
    ...props 
}: ButtonProps) {
    const getVariantStyle = () => {
        switch (variant) {
            case 'primary':
                return {
                    backgroundColor: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                };
            case 'danger':
                return {
                    backgroundColor: 'var(--error)',
                    color: 'white',
                    border: 'none',
                };
            case 'success':
                return {
                    backgroundColor: 'var(--success)',
                    color: 'white',
                    border: 'none',
                };
            case 'ghost':
                return {
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    border: 'none',
                };
            case 'secondary':
            default:
                return {
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                };
        }
    };

    const getSizeStyle = () => {
        switch (size) {
            case 'sm':
                return { padding: '4px 8px', fontSize: '0.8rem' };
            case 'lg':
                return { padding: '12px 24px', fontSize: '1rem' };
            case 'md':
            default:
                return { padding: '8px 16px', fontSize: '0.9rem' };
        }
    };

    const baseStyle: JSX.CSSProperties = {
        borderRadius: 'var(--radius-sm)',
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
        opacity: (disabled || loading) ? 0.6 : 1,
        outline: 'none',
        ...getVariantStyle(),
        ...getSizeStyle(),
    };

    return (
        <button 
            disabled={disabled || loading}
            style={{ ...baseStyle, ...(style as any) }}
            className={`btn-${variant} ${className || ''}`}
            {...props}
        >
            {icon && !loading && icon}
            {loading && <span className="animate-spin">⏳</span>}
            {children}
        </button>
    );
}
