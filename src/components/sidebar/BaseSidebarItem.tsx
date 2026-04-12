import { useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { unsavedItemIds, contextMenu } from '../../store';
import { ComponentChildren } from 'preact';
import { t } from '../../i18n';

export interface BaseSidebarItemProps {
    /** Unique ID of this item */
    id: string;
    /** Collection ID for context menu */
    collectionId: string;
    /** Context menu type identifier */
    contextMenuType: 'request' | 'folder' | 'execution' | 'collection';
    /** Nesting depth for indentation */
    depth: number;
    /** Whether this item is currently active/selected */
    isActive: boolean;
    /** Content for the collapse arrow area (16px wide) */
    arrowContent?: ComponentChildren;
    /** Icon element to display */
    icon: ComponentChildren;
    /** Optional prefix label (e.g. HTTP method badge) */
    prefixLabel?: ComponentChildren;
    /** Display name */
    label: string;
    /** Optional extra style for the label text */
    labelStyle?: Record<string, string | number>;
    /** Called when the item row is clicked */
    onSelect: () => void;
    /** Called when delete is confirmed */
    onDelete?: (e: MouseEvent) => void;
    /** Whether this item is draggable */
    draggable?: boolean;
    /** Drag start handler */
    onDragStart?: (e: DragEvent) => void;
    /** Drag over handler (for drop targets) */
    onDragOver?: (e: DragEvent) => void;
    /** Drop handler with calculated position */
    onDropIntelligent?: (e: DragEvent, position: 'before' | 'after' | 'inside') => void;
    /** Child items rendered below this row (e.g. sub-folders, executions) */
    children?: ComponentChildren;
}

export function BaseSidebarItem({
    id,
    collectionId,
    contextMenuType,
    depth,
    isActive,
    arrowContent,
    icon,
    prefixLabel,
    label,
    labelStyle,
    onSelect,
    onDelete,
    draggable: isDraggable = false,
    onDragStart,
    onDragOver,
    onDropIntelligent,
    children
}: BaseSidebarItemProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [dropPos, setDropPos] = useState<'before' | 'after' | 'inside' | null>(null);

    const handleDragOverBase = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        let newPos: 'before' | 'after' | 'inside' = 'inside';

        if (contextMenuType === 'folder') {
            if (y < height * 0.25) newPos = 'before';
            else if (y > height * 0.75) newPos = 'after';
            else newPos = 'inside';
        } else {
            if (y < height * 0.5) newPos = 'before';
            else newPos = 'after';
        }

        if (dropPos !== newPos) setDropPos(newPos);
        if (onDragOver) onDragOver(e);
    };

    const handleDragLeave = () => {
        setDropPos(null);
    };

    const handleDropBase = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const finalPos = dropPos;
        setDropPos(null);
        if (onDropIntelligent && finalPos) {
            onDropIntelligent(e, finalPos);
        }
    };

    return (
        <div
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragOver={handleDragOverBase}
            onDragLeave={handleDragLeave}
            onDrop={handleDropBase}
            style={{ userSelect: 'none', position: 'relative' }}
        >
            {dropPos === 'before' && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: 'var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
            )}
            {dropPos === 'after' && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: 'var(--accent-primary)', zIndex: 10, pointerEvents: 'none' }} />
            )}
            <div
                onClick={onSelect}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    contextMenu.value = {
                        x: e.clientX,
                        y: e.clientY,
                        itemId: id,
                        collectionId,
                        type: contextMenuType
                    };
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    paddingLeft: `${depth * 12 + 8}px`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: dropPos === 'inside'
                        ? 'rgba(var(--accent-primary-rgb), 0.2)'
                        : isActive
                            ? 'var(--bg-surface)'
                            : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'background-color 0.1s',
                    border: dropPos === 'inside' ? '1px solid var(--accent-primary)' : '1px solid transparent'
                }}
            >
                {/* Arrow / Spacer */}
                <div style={{
                    width: '16px',
                    display: 'flex',
                    cursor: 'pointer',
                    transform: 'translateY(1px)'
                }}>
                    {arrowContent ?? <div style={{ width: '14px' }} />}
                </div>

                {/* Icon */}
                <div style={{ display: 'flex' }}>
                    {icon}
                </div>

                {/* Name */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    overflow: 'hidden',
                    marginLeft: '4px'
                }}>
                    {prefixLabel}
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '0.9rem',
                        ...labelStyle
                    }}>
                        {label}
                    </span>
                    {unsavedItemIds.value.has(id) && (
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-primary)',
                            marginLeft: '4px'
                        }} />
                    )}
                </div>

                {/* Actions */}
                {isHovered && onDelete && (
                    <div
                        onClick={onDelete}
                        style={{ opacity: 0.6, padding: '2px', cursor: 'pointer' }}
                        title={t('common.delete')}
                    >
                        <Trash2 size={14} />
                    </div>
                )}
            </div>
            {children}
        </div>
    );
}
