import { useRef, useEffect, useState, useMemo } from "preact/hooks";
import { getScopedVariables, activeEnvironmentName } from "../store";

interface VariableInputProps {
    value: string;
    onInput: (value: string) => void;
    placeholder?: string;
    style?: any;
    className?: string;
    multiline?: boolean;
    readOnly?: boolean;
    onKeyDown?: (e: any) => void;
    parentId?: string | null;
}

export function VariableInput({ value, onInput, placeholder, style = {}, className = "", multiline = false, readOnly = false, onKeyDown, parentId }: VariableInputProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const highlighterRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filterText, setFilterText] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [suggestionsPos, setSuggestionsPos] = useState({ top: 0, left: 0 });

    const suggestions = useMemo(() => {
        const allVars = getScopedVariables(parentId);
        if (!filterText) return allVars;
        return allVars.filter(v => v.name.toLowerCase().includes(filterText.toLowerCase()));
    }, [filterText, parentId, activeEnvironmentName.value]);

    const highlight = (text: string) => {
        if (!text) return "&nbsp;"; // Needs a character to maintain height

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

    const handleSelect = (varName: string) => {
        if (!inputRef.current) return;
        const cursor = inputRef.current.selectionStart || 0;
        const before = value.slice(0, cursor);
        const openIdx = before.lastIndexOf("{{");

        if (openIdx !== -1) {
            const newValue = value.slice(0, openIdx) + `{{${varName}}}` + value.slice(cursor);
            onInput(newValue);
            setShowSuggestions(false);

            // Set cursor after the inserted variable
            setTimeout(() => {
                if (inputRef.current) {
                    const newPos = openIdx + varName.length + 4;
                    inputRef.current.setSelectionRange(newPos, newPos);
                    inputRef.current.focus();
                }
            }, 0);
        }
    };

    const handleKeyDownInternal = (e: any) => {
        if (showSuggestions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                if (suggestions.length > 0) {
                    e.preventDefault();
                    handleSelect(suggestions[selectedIndex].name);
                } else {
                    setShowSuggestions(false);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSuggestions(false);
                return;
            }
        }
        if (onKeyDown) onKeyDown(e);
    };

    const handleInputInternal = (e: any) => {
        const newVal = e.currentTarget.value;
        onInput(newVal);

        const cursor = e.currentTarget.selectionStart || 0;
        const before = newVal.slice(0, cursor);
        const openIdx = before.lastIndexOf("{{");
        const closeIdx = before.lastIndexOf("}}");

        if (openIdx !== -1 && openIdx >= closeIdx) {
            const query = before.slice(openIdx + 2);
            setFilterText(query);
            setSelectedIndex(0);
            setShowSuggestions(true);

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setSuggestionsPos({ top: rect.height, left: 0 });
            }
        } else {
            setShowSuggestions(false);
        }
    };

    // Close suggestions on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Helper to split layout styles from visual styles
    const splitStyles = (s: any) => {
        const container: any = {};
        const input: any = {};

        const layoutKeys = new Set([
            'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
            'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
            'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
            'position', 'top', 'bottom', 'left', 'right', 'zIndex',
            'display'
        ]);

        Object.keys(s).forEach(key => {
            if (layoutKeys.has(key)) {
                container[key] = s[key];
            } else {
                input[key] = s[key];
            }
        });

        return { container, input };
    };

    const { container: containerStyle, input: inputStyle } = splitStyles(style);

    const commonStyles: any = {
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9rem',
        lineHeight: '1.5rem', // Use explicit unit
        padding: '6px 8px', // Explicit padding
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        width: '100%',
        minHeight: multiline ? 'auto' : '38px', // Consistent height (1.5rem + 12px padding + 2px border)
        height: multiline ? '100%' : 'auto',
        margin: 0,
        boxSizing: 'border-box',
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        wordWrap: multiline ? 'break-word' : 'normal',
        overflow: multiline ? 'auto' : 'hidden',
        ...inputStyle // Only apply visual/input styles here
    };

    const inputBaseStyles: any = {
        ...commonStyles,
        background: 'transparent',
        color: 'transparent',
        caretColor: 'var(--text-primary)',
        position: 'relative',
        zIndex: 2,
        outline: 'none',
        resize: multiline ? 'vertical' : 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        boxShadow: 'none',
        margin: 0,
        verticalAlign: 'top' // Ensure alignment
    };

    const highlighterStyles: any = {
        ...commonStyles,
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
        color: 'var(--text-primary)',
        pointerEvents: 'none',
        // Use user provided bg or default, but handle readOnly
        backgroundColor: readOnly ? 'transparent' : (inputStyle.background || inputStyle.backgroundColor || 'var(--bg-input)'),
        // Do not override borderColor if not readonly, to allow user style to persist
        borderColor: readOnly ? 'transparent' : undefined,
        overflow: 'hidden', // Scrolling is synced via JS
        verticalAlign: 'top',
        display: 'block' // Ensure it behaves like a block
    };

    const InputTag = multiline ? 'textarea' : 'input';

    return (
        <div ref={containerRef} style={{
            ...containerStyle, // Only layout styles
            position: 'relative',
            width: style.width || '100%',
            flex: style.flex,
            height: multiline ? (style.height || '100%') : 'auto',
            // Ensure no border/padding on container to avoid doubling
            border: 'none',
            padding: 0,
            background: 'transparent'
        }}>
            <div
                ref={highlighterRef}
                style={highlighterStyles}
                dangerouslySetInnerHTML={{ __html: highlight(value) + (multiline && value.endsWith('\n') ? '<br/>' : '') }}

            />
            <InputTag
                ref={inputRef as any}
                value={value}
                onInput={handleInputInternal}
                onScroll={syncScroll}
                onKeyDown={handleKeyDownInternal}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click on suggestion
                placeholder={placeholder}
                readOnly={readOnly}
                style={inputBaseStyles}
                className={className}
                wrap={multiline ? "soft" : "off"}
            />

            {showSuggestions && suggestions.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: suggestionsPos.top + 'px',
                    left: suggestionsPos.left + 'px',
                    zIndex: 100,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    minWidth: '200px',
                    marginTop: '4px'
                }}>
                    {suggestions.map((sug, idx) => (
                        <div
                            key={sug.name}
                            onClick={() => handleSelect(sug.name)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            style={{
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                cursor: 'pointer',
                                backgroundColor: idx === selectedIndex ? 'var(--bg-base)' : 'transparent',
                                color: idx === selectedIndex ? 'var(--accent-primary)' : 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)',
                                fontSize: '0.85rem'
                            }}
                        >
                            <span style={{ color: 'var(--accent-primary)', opacity: 0.7 }}>{"{{"}</span>
                            <span style={{ flex: 1 }}>{sug.name}</span>
                            <span style={{ color: 'var(--accent-primary)', opacity: 0.7 }}>{"}}"}</span>
                            <span style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                backgroundColor: 'var(--bg-base)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                marginLeft: '8px'
                            }}>
                                {sug.source}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
