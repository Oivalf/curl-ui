import { useRef, useEffect } from "preact/hooks";

interface VariableInputProps {
    value: string;
    onInput: (value: string) => void;
    placeholder?: string;
    style?: any;
    className?: string;
    multiline?: boolean;
    readOnly?: boolean;
    onKeyDown?: (e: any) => void;
}

export function VariableInput({ value, onInput, placeholder, style = {}, className = "", multiline = false, readOnly = false, onKeyDown }: VariableInputProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const highlighterRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const highlight = (text: string) => {
        if (!text) return " "; // Needs a character to maintain height

        // Escape HTML
        const escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Highlight {{vars}}
        return escaped.replace(/({{\s*[\S]+?\s*}})/g, '<span style="color: var(--accent-primary); font-weight: bold;">$1</span>');
    };

    const syncScroll = () => {
        if (inputRef.current && highlighterRef.current) {
            highlighterRef.current.scrollTop = inputRef.current.scrollTop;
            highlighterRef.current.scrollLeft = inputRef.current.scrollLeft;
        }
    };

    useEffect(() => {
        syncScroll();
    }, [value]);

    const commonStyles: any = {
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9rem',
        lineHeight: '1.5',
        padding: 'var(--spacing-sm)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        width: '100%',
        margin: 0,
        boxSizing: 'border-box',
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        wordWrap: multiline ? 'break-word' : 'normal',
        overflow: multiline ? 'auto' : 'hidden',
        ...style
    };

    const inputBaseStyles: any = {
        ...commonStyles,
        background: 'transparent',
        color: 'transparent',
        caretColor: 'var(--text-primary)',
        position: 'relative',
        zIndex: 2,
        outline: 'none',
        resize: multiline ? 'vertical' : 'none'
    };

    const highlighterStyles: any = {
        ...commonStyles,
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
        color: 'var(--text-primary)',
        pointerEvents: 'none',
        backgroundColor: readOnly ? 'transparent' : 'var(--bg-input)',
        borderColor: readOnly ? 'transparent' : 'var(--border-color)',
        overflow: 'hidden' // Scrolling is synced via JS
    };

    const InputTag = multiline ? 'textarea' : 'input';

    return (
        <div ref={containerRef} style={{ position: 'relative', width: style.width || '100%', flex: style.flex }}>
            <div
                ref={highlighterRef}
                style={highlighterStyles}
                dangerouslySetInnerHTML={{ __html: highlight(value) + (multiline && value.endsWith('\n') ? '<br/>' : '') }}
            />
            <InputTag
                ref={inputRef as any}
                value={value}
                onInput={(e: any) => onInput(e.currentTarget.value)}
                onScroll={syncScroll}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                readOnly={readOnly}
                style={inputBaseStyles}
                className={className}
                wrap={multiline ? "soft" : "off"}
            />
        </div>
    );
}
