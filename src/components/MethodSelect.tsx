import { useState, useRef, useEffect } from 'preact/hooks';
import { ChevronDown } from 'lucide-preact';

interface MethodSelectProps {
    value: string;
    onChange: (value: string) => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const getColor = (method: string) => {
    switch (method) {
        case 'GET': return 'var(--success)';
        case 'POST': return 'var(--warning)';
        case 'DELETE': return 'var(--error)';
        case 'PATCH': return 'var(--yellow)';
        case 'PUT': return 'var(--accent-primary)';
        default: return 'var(--text-primary)';
    }
};

export function MethodSelect({ value, onChange }: MethodSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick); // mousedown feels snappier for closing
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '110px' }}>
            {/* Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    color: getColor(value),
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    userSelect: 'none'
                }}
            >
                {value}
                <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    width: '100%',
                    marginTop: '4px',
                    backgroundColor: 'var(--bg-input)', // Match input bg
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    overflow: 'hidden'
                }}>
                    {METHODS.map(method => (
                        <div
                            key={method}
                            onClick={() => {
                                onChange(method);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                color: getColor(method),
                                fontWeight: 'bold',
                                fontSize: '0.9rem',
                                backgroundColor: value === method ? 'rgba(255,255,255,0.05)' : 'transparent',
                                transition: 'background-color 0.1s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value === method ? 'rgba(255,255,255,0.05)' : 'transparent'}
                        >
                            {method}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
