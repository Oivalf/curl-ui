import { useEffect, useRef, useState } from 'preact/hooks';
import { promptState } from '../store';
import { Modal } from './Modal';

export function PromptModal() {
    const state = promptState.value;
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync input value when modal opens
    useEffect(() => {
        if (state.isOpen) {
            setInputValue(state.defaultValue || '');
            // Focus input after a brief delay to allow modal to render
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [state.isOpen, state.defaultValue]);

    const handleConfirm = () => {
        state.resolve(inputValue);
    };

    const handleCancel = () => {
        state.resolve(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    return (
        <Modal
            isOpen={state.isOpen}
            onClose={handleCancel}
            title={state.title}
            zIndex={1400} // Higher than other modals
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '300px' }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onInput={(e) => setInputValue(e.currentTarget.value)}
                    onKeyDown={handleKeyDown}
                    style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-base)',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        outline: 'none',
                        width: '100%'
                    }}
                    placeholder="Enter value..."
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                        onClick={handleCancel}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            backgroundColor: 'var(--accent-primary)',
                            color: '#000',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        OK
                    </button>
                </div>
            </div>
        </Modal>
    );
}
