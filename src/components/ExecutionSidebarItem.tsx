import { useState } from 'preact/hooks';
import { Play, Trash2 } from 'lucide-preact';
import { activeExecutionId, activeRequestId, activeFolderId, executions, ExecutionItem, contextMenu, openTabs, activeTabId, unsavedItemIds, requests } from '../store';

interface ExecutionSidebarItemProps {
    execution: ExecutionItem;
    depth: number;
}

export function ExecutionSidebarItem({ execution, depth }: ExecutionSidebarItemProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Get parent request for display info
    const parentRequest = requests.value.find(r => r.id === execution.requestId);
    const displayMethod = execution.method || parentRequest?.method || 'GET';

    const handleSelect = () => {
        const tabId = execution.id;
        const existingTab = openTabs.value.find(t => t.id === tabId);

        if (!existingTab) {
            openTabs.value = [...openTabs.value, {
                id: tabId,
                type: 'execution',
                name: execution.name
            }];
        }

        activeTabId.value = tabId;
        activeExecutionId.value = execution.id;
        activeRequestId.value = null;
        activeFolderId.value = null;
    };

    const handleDelete = (e: MouseEvent) => {
        e.stopPropagation();

        const performDelete = () => {
            executions.value = executions.value.filter(ex => ex.id !== execution.id);

            // Close tab if open
            const tabToClose = openTabs.value.find(t => t.id === execution.id);
            if (tabToClose) {
                const newTabs = openTabs.value.filter(t => t.id !== execution.id);
                openTabs.value = newTabs;

                if (activeTabId.value === execution.id) {
                    if (newTabs.length > 0) {
                        const lastTab = newTabs[newTabs.length - 1];
                        activeTabId.value = lastTab.id;
                        if (lastTab.type === 'request') {
                            activeRequestId.value = lastTab.id;
                            activeFolderId.value = null;
                            activeExecutionId.value = null;
                        } else if (lastTab.type === 'folder') {
                            activeFolderId.value = lastTab.id;
                            activeRequestId.value = null;
                            activeExecutionId.value = null;
                        } else {
                            activeExecutionId.value = lastTab.id;
                            activeRequestId.value = null;
                            activeFolderId.value = null;
                        }
                    } else {
                        activeTabId.value = null;
                        activeRequestId.value = null;
                        activeFolderId.value = null;
                        activeExecutionId.value = null;
                    }
                }
            }
        };

        import('../store').then(({ confirmationState }) => {
            confirmationState.value = {
                isOpen: true,
                title: 'Delete execution?',
                message: `Are you sure you want to delete "${execution.name}"?`,
                onConfirm: performDelete
            };
        });
    };

    return (
        <div
            onClick={handleSelect}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                contextMenu.value = {
                    x: e.clientX,
                    y: e.clientY,
                    itemId: execution.id,
                    collectionId: execution.collectionId,
                    type: 'execution'
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
                backgroundColor: activeExecutionId.value === execution.id
                    ? 'var(--bg-surface)'
                    : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: activeExecutionId.value === execution.id
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                transition: 'background-color 0.1s'
            }}
        >
            {/* Spacer for alignment with folders */}
            <div style={{ width: '16px' }} />

            {/* Play Icon */}
            <div style={{ color: 'var(--accent-secondary)', display: 'flex' }}>
                <Play size={16} />
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
                <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    color: displayMethod === 'GET' ? 'var(--success)' :
                        displayMethod === 'POST' ? 'var(--warning)' :
                            displayMethod === 'DELETE' ? 'var(--error)' :
                                displayMethod === 'PATCH' ? 'var(--yellow)' :
                                    displayMethod === 'PUT' ? 'var(--accent-primary)' : 'var(--text-muted)',
                    minWidth: '35px'
                }}>
                    {displayMethod}
                </span>
                <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '0.9rem',
                    fontStyle: 'italic'
                }}>
                    {execution.name}
                </span>
                {unsavedItemIds.value.has(execution.id) && (
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
    );
}
