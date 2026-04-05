import { JSX } from "preact";

interface TabItem {
    id: string;
    label: string;
    icon?: JSX.Element;
    badge?: string | number;
}

interface TabsProps {
    items: TabItem[];
    activeId: string;
    onChange: (id: string) => void;
    variant?: 'underline' | 'pills';
    style?: JSX.CSSProperties;
}

export function Tabs({ items, activeId, onChange, variant = 'underline', style }: TabsProps) {
    const isUnderline = variant === 'underline';

    return (
        <div style={{
            display: 'flex',
            gap: isUnderline ? '16px' : '8px',
            borderBottom: isUnderline ? '1px solid var(--border-color)' : 'none',
            padding: isUnderline ? '0 4px' : '4px',
            backgroundColor: isUnderline ? 'transparent' : 'var(--bg-input)',
            borderRadius: isUnderline ? 0 : 'var(--radius-md)',
            ...(style as any)
        }}>
            {items.map((item) => {
                const isActive = item.id === activeId;
                const baseStyle: JSX.CSSProperties = {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: isUnderline ? '8px 4px' : '6px 12px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    borderBottom: isUnderline && isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    backgroundColor: !isUnderline && isActive ? 'var(--bg-surface)' : 'transparent',
                    borderRadius: !isUnderline ? 'var(--radius-sm)' : 0,
                    transition: 'all 0.2s',
                    position: 'relative',
                    marginBottom: isUnderline ? '-1px' : 0,
                };

                return (
                    <div
                        key={item.id}
                        onClick={() => onChange(item.id)}
                        style={baseStyle as any}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        {item.icon}
                        {item.label}
                        {item.badge !== undefined && (
                            <span style={{
                                fontSize: '0.7rem',
                                background: isActive ? 'var(--accent-primary)' : 'var(--bg-input)',
                                color: isActive ? 'white' : 'var(--text-muted)',
                                padding: '1px 5px',
                                borderRadius: '10px',
                                minWidth: '14px',
                                textAlign: 'center'
                            }}>
                                {item.badge}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
