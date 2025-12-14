import { ComponentChildren } from 'preact';
import { X } from 'lucide-preact';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ComponentChildren;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-sidebar)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                width: '500px',
                maxWidth: '90vw',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                <div style={{
                    padding: 'var(--spacing-md)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h3>
                    <button onClick={onClose} style={{ background: 'none', color: 'var(--text-muted)' }}>
                        <X size={20} />
                    </button>
                </div>
                <div style={{ padding: 'var(--spacing-md)', overflowY: 'auto' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
