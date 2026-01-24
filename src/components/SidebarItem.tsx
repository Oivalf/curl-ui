import { useState } from 'preact/hooks';
import { Folder as FolderIcon, FolderOpen, FileJson, ChevronRight, ChevronDown, Trash2 } from 'lucide-preact';
import { activeRequestId, activeFolderId, activeExecutionId, folders, requests, executions, RequestItem, Folder, contextMenu, openTabs, activeTabId, unsavedItemIds } from '../store';
import { ExecutionSidebarItem } from './ExecutionSidebarItem';

interface SidebarItemProps {
    item: RequestItem | Folder;
    type: 'request' | 'folder';
    depth?: number;
}

export function SidebarItem({ item, type, depth = 0 }: SidebarItemProps) {
    const isFolder = type === 'folder';
    const folder = item as Folder;
    const request = item as RequestItem;

    const [isHovered, setIsHovered] = useState(false);

    // Toggle collapse
    const toggleFolder = (e: MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            folders.value = folders.value.map(f =>
                f.id === folder.id ? { ...f, collapsed: !f.collapsed } : f
            );
        }
    };

    const handleSelect = () => {
        // Add to tabs if not present
        const tabId = item.id;
        const existingTab = openTabs.value.find(t => t.id === tabId);

        if (!existingTab) {
            openTabs.value = [...openTabs.value, {
                id: tabId,
                type: isFolder ? 'folder' : 'request',
                name: item.name
            }];
        }

        activeTabId.value = tabId;

        // Legacy support (sync active request/folder) - purely for components relying on these
        if (!isFolder) {
            activeRequestId.value = request.id;
            activeFolderId.value = null;
            activeExecutionId.value = null;
        } else {
            activeFolderId.value = folder.id;
            activeRequestId.value = null;
            activeExecutionId.value = null;
        }
    };

    const handleDelete = (e: MouseEvent) => {
        e.stopPropagation();
        const itemType = isFolder ? 'folder' : 'request';

        // Helper function for actual deletion logic
        const performDelete = () => {
            let deletedIds = new Set<string>();

            if (isFolder) {
                // Recursive delete
                const idsToDelete = new Set<string>([folder.id]);
                let added = true;

                // Iteratively find all descendant folder IDs
                while (added) {
                    added = false;
                    folders.value.forEach(f => {
                        if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
                            idsToDelete.add(f.id);
                            added = true;
                        }
                    });
                }

                // Track deleted folder IDs
                deletedIds = new Set(idsToDelete);

                // Track and delete all requests in these folders
                requests.value.forEach(r => {
                    if (r.parentId && idsToDelete.has(r.parentId)) {
                        deletedIds.add(r.id);
                    }
                });
                requests.value = requests.value.filter(r => !r.parentId || !idsToDelete.has(r.parentId));

                // Delete the folders
                folders.value = folders.value.filter(f => !idsToDelete.has(f.id));

                if (activeRequestId.value && requests.value.find(r => r.id === activeRequestId.value) === undefined) {
                    activeRequestId.value = null;
                }

            } else {
                requests.value = requests.value.filter(r => r.id !== request.id);
                deletedIds.add(request.id);
                if (activeRequestId.value === request.id) {
                    activeRequestId.value = null;
                }
            }

            // Close tabs for deleted items
            const tabsToClose = openTabs.value.filter(t => deletedIds.has(t.id));
            if (tabsToClose.length > 0) {
                const newTabs = openTabs.value.filter(t => !deletedIds.has(t.id));
                openTabs.value = newTabs;

                // Reset active tab if it was closed
                if (activeTabId.value && deletedIds.has(activeTabId.value)) {
                    if (newTabs.length > 0) {
                        const lastTab = newTabs[newTabs.length - 1];
                        activeTabId.value = lastTab.id;
                        // Legacy sync
                        if (lastTab.type === 'request') {
                            activeRequestId.value = lastTab.id;
                            activeFolderId.value = null;
                        } else {
                            activeFolderId.value = lastTab.id;
                            activeRequestId.value = null;
                        }
                    } else {
                        activeTabId.value = null;
                        activeRequestId.value = null;
                        activeFolderId.value = null;
                    }
                }
            }
        };

        // Trigger Modal
        import('../store').then(({ confirmationState }) => {
            confirmationState.value = {
                isOpen: true,
                title: `Delete ${itemType}?`,
                message: `Are you sure you want to delete "${item.name}"? ${isFolder ? 'This will delete all contents.' : ''}`,
                onConfirm: performDelete
            };
        });
    };

    // Drag and Drop Logic
    const handleDragStart = (e: DragEvent) => {
        e.dataTransfer?.setData('application/json', JSON.stringify({
            id: item.id,
            type: type
        }));
        e.stopPropagation();
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Highlight logic could go here
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isFolder) return; // Can only drop into folders

        const data = e.dataTransfer?.getData('application/json');
        if (!data) return;

        const { id, type: draggedType } = JSON.parse(data);
        if (id === item.id) return; // Can't drop on itself

        if (draggedType === 'request') {
            requests.value = requests.value.map(r =>
                r.id === id ? { ...r, parentId: item.id } : r
            );
        } else if (draggedType === 'folder') {
            // Prevent circular dependency
            // Check if 'item' (target folder) is a child of 'id' (dragged folder)
            // Simple check: don't allow current implementation (too recursive to check quickly without helper),
            // but for now just update parentId
            folders.value = folders.value.map(f =>
                f.id === id ? { ...f, parentId: item.id } : f
            );
        }
    };

    // Render children if it's an open folder
    const renderChildren = () => {
        if (!isFolder || folder.collapsed) return null;

        const childFolders = folders.value.filter(f => f.parentId === folder.id);
        const childRequests = requests.value.filter(r => r.parentId === folder.id);

        return (
            <div>
                {childFolders.map(f => (
                    <SidebarItem key={f.id} item={f} type="folder" depth={depth + 1} />
                ))}
                {childRequests.map(r => {
                    const childExecutions = executions.value.filter(e => e.requestId === r.id);
                    return (
                        <div key={r.id}>
                            <SidebarItem item={r} type="request" depth={depth + 1} />
                            {childExecutions.map(ex => (
                                <ExecutionSidebarItem key={ex.id} execution={ex} depth={depth + 2} />
                            ))}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragOver={isFolder ? handleDragOver : undefined}
            onDrop={handleDrop}
            style={{ select: 'none' }} // avoid text selection while dragging
        >
            <div
                onClick={handleSelect}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    contextMenu.value = {
                        x: e.clientX,
                        y: e.clientY,
                        itemId: item.id,
                        collectionId: item.collectionId,
                        type: type
                    };
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    paddingLeft: `${depth * 12 + 8}px`, // Indentation
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: (!isFolder && activeRequestId.value === item.id) || (isFolder && activeFolderId.value === item.id)
                        ? 'var(--bg-surface)'
                        : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color: (!isFolder && activeRequestId.value === item.id) || (isFolder && activeFolderId.value === item.id)
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                    transition: 'background-color 0.1s'
                }}
            >
                {/* Folder Arrow / Spacer */}
                <div
                    onClick={isFolder ? toggleFolder : undefined}
                    style={{
                        opacity: isFolder ? 1 : 0,
                        width: '16px',
                        display: 'flex',
                        cursor: isFolder ? 'pointer' : 'default',
                        transform: 'translateY(1px)' // visual alignment
                    }}
                >
                    {isFolder && (folder.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />)}
                </div>

                {/* Icon */}
                <div style={{ color: isFolder ? 'var(--accent-primary)' : 'inherit', display: 'flex' }}>
                    {isFolder
                        ? (folder.collapsed ? <FolderIcon size={16} /> : <FolderOpen size={16} />)
                        : <FileJson size={16} />
                    }
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
                    {!isFolder && (
                        <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            // Simple color mapping
                            color: request.method === 'GET' ? 'var(--success)' :
                                request.method === 'POST' ? 'var(--warning)' :
                                    request.method === 'DELETE' ? 'var(--error)' :
                                        request.method === 'PATCH' ? 'var(--yellow)' :
                                            request.method === 'PUT' ? 'var(--accent-primary)' : 'var(--text-muted)',
                            minWidth: '35px'
                        }}>
                            {request.method}
                        </span>
                    )}
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '0.9rem'
                    }}>
                        {item.name}
                    </span>
                    {unsavedItemIds.value.has(item.id) && (
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
                {isHovered && (
                    <div
                        onClick={handleDelete}
                        style={{ opacity: 0.6, padding: '2px', cursor: 'pointer' }}
                        title="Delete"
                    >
                        <Trash2 size={14} />
                    </div>
                )}
            </div>
            {renderChildren()}
        </div>
    );
}
