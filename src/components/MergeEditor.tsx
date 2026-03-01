import { useEffect, useRef } from 'preact/hooks';
import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView, basicSetup } from "codemirror";
import { json } from "@codemirror/lang-json";
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { X, Check } from 'lucide-preact';

interface MergeEditorProps {
    local: string;
    remote: string;
    onResolve: (merged: string) => void;
    onCancel: () => void;
    filename: string;
}

export function MergeEditor({ local, remote, onResolve, onCancel, filename }: MergeEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MergeView | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear container
        containerRef.current.innerHTML = '';

        const view = new MergeView({
            a: {
                doc: local,
                extensions: [
                    basicSetup,
                    json(),
                    vscodeDark,
                    EditorView.editable.of(false),
                    EditorState.readOnly.of(true)
                ]
            },
            b: {
                doc: remote,
                extensions: [
                    basicSetup,
                    json(),
                    vscodeDark,
                    // The right side will be our "editor" for the result in this simple implementation
                    // Or we could have a 3rd pane, but CM6 merge is primarily 2-way with a result.
                ]
            },
            parent: containerRef.current,
            orientation: "a-b"
        });

        viewRef.current = view;

        return () => {
            view.destroy();
        };
    }, [local, remote]);

    const handleApply = () => {
        if (viewRef.current) {
            // In a 2-way merge view, 'b' is usually the one we edit or the 'current' one
            const mergedContent = viewRef.current.b.state.doc.toString();
            onResolve(mergedContent);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: 'var(--bg-base)',
            color: 'var(--text-primary)',
            zIndex: 1000,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-sidebar)'
            }}>
                <div style={{ display: 'flex', flexDirecton: 'column' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Resolve Conflict</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filename}</div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                            color: 'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        <X size={16} /> Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--bg-base)',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        <Check size={16} /> Mark as Resolved
                    </button>
                </div>
            </div>

            {/* Sub-header labels */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '8px 20px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <div style={{ borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>LOCAL (OURS)</div>
                <div style={{ textAlign: 'center' }}>REMOTE (THEIRS / RESULT)</div>
            </div>

            {/* Editor Container */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div
                    ref={containerRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        overflow: 'auto'
                    }}
                />
            </div>

            <style>{`
                .cm-mergeView { height: 100%; }
                .cm-mergeViewEditors { height: 100%; }
                .cm-editor { height: 100%; }
                .cm-merge-spacer { background-color: rgba(var(--accent-primary-rgb), 0.05); }
                .cm-deletedCode { background-color: rgba(255, 0, 0, 0.1); }
                .cm-insertedCode { background-color: rgba(0, 255, 0, 0.1); }
            `}</style>
        </div>
    );
}
