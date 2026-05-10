import { JSX } from "preact";

interface IconButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
    icon: JSX.Element;
    variant?: 'ghost' | 'danger' | 'success' | 'primary' | 'secondary' | 'error';
    size?: number;
    disabled?: boolean;
    description?: string;
}

export function IconButton({ icon, variant = 'ghost', size = 16, description, style, disabled, ...props }: IconButtonProps) {
    const getVariantColor = () => {
        switch (variant) {
            case 'danger':
            case 'error':
                return 'var(--error)';
            case 'success':
                return 'var(--success)';
            case 'primary':
                return 'var(--accent-primary)';
            case 'secondary':
                return 'var(--text-secondary)';
            case 'ghost':
            default:
                return 'var(--text-muted)';
        }
    };

    const baseStyle: JSX.CSSProperties = {
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        color: getVariantColor(),
        opacity: disabled ? 0.5 : 0.8,
        transition: 'all 0.2s',
        outline: 'none',
        ...style as any,
    };

    return (
        <button 
            disabled={disabled}
            style={baseStyle as any}
            title={description}
            onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; if (!disabled && variant === 'ghost') e.currentTarget.style.backgroundColor = 'var(--bg-input)'; }}
            onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.8'; if (!disabled && variant === 'ghost') e.currentTarget.style.backgroundColor = 'transparent'; }}
            {...props}
        >
            {icon}
        </button>
    );
}
