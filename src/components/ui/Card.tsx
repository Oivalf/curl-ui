import { JSX } from "preact";

interface CardProps {
    children: any;
    title?: string | JSX.Element;
    extra?: JSX.Element;
    style?: JSX.CSSProperties;
    padding?: string;
    variant?: 'default' | 'bordered' | 'flat' | 'dashed';
}

export function Card({ children, title, extra, style, padding = '16px', variant = 'default' }: CardProps) {
    const getVariantStyles = () => {
        switch (variant) {
            case 'bordered':
                return { border: '1px solid var(--border-color)', background: 'transparent' };
            case 'flat':
                return { background: 'var(--bg-input)', border: 'none' };
            case 'dashed':
                return { border: '1px dashed var(--border-color)', background: 'transparent' };
            case 'default':
            default:
                return { background: 'var(--bg-card)', border: '1px solid var(--border-color)' };
        }
    };

    const baseStyle: JSX.CSSProperties = {
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...getVariantStyles(),
        ...(style as any),
    };

    return (
        <div style={baseStyle as any}>
            {(title || extra) && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(0,0,0,0.1)'
                }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        {title}
                    </span>
                    {extra}
                </div>
            )}
            <div style={{ padding }}>
                {children}
            </div>
        </div>
    );
}
