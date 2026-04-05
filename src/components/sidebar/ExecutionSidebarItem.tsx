import { Play } from 'lucide-preact';
import { activeExecutionId, activeRequestId, activeFolderId, executions, requests, ExecutionItem, openTabs, activeTabId } from '../../store';
import { BaseSidebarItem } from './BaseSidebarItem';

interface ExecutionSidebarItemProps {
    execution: ExecutionItem;
    depth: number;
}

export function ExecutionSidebarItem({ execution, depth }: ExecutionSidebarItemProps) {
    const parentRequest = requests.value.find(r => r.id === execution.requestId);
    const displayName = parentRequest ? `${parentRequest.name} (${execution.name})` : execution.name;

    const handleSelect = () => {
        const tabId = execution.id;
        if (!openTabs.value.find(t => t.id === tabId)) {
            openTabs.value = [...openTabs.value, {
                id: tabId,
                type: 'execution',
                name: displayName
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

        import('../../store').then(({ confirmationState }) => {
            confirmationState.value = {
                isOpen: true,
                title: 'Delete execution?',
                message: `Are you sure you want to delete "${execution.name}"?`,
                onConfirm: performDelete
            };
        });
    };

    // Drag
    const handleDragStart = (e: DragEvent) => {
        const data = JSON.stringify({ id: execution.id, type: 'execution' });
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', data);
            e.dataTransfer.setData('text/plain', `curl-ui:${data}`);
        }
        e.stopPropagation();
    };

    const handleDropIntelligent = (e: DragEvent, pos: 'before' | 'after' | 'inside') => {
        let data = e.dataTransfer?.getData('application/json');
        if (!data) {
            const plain = e.dataTransfer?.getData('text/plain');
            if (plain?.startsWith('curl-ui:')) {
                data = plain.slice(8);
            }
        }
        if (!data) return;
        const { id, type } = JSON.parse(data);
        if (id === execution.id) return;

        // Restriction: only reorder executions within the same request
        if (type === 'execution') {
            // Prevent dropping BEFORE the default execution
            if (execution.name === 'default' && pos === 'before') {
                pos = 'after';
            }

            import('../../store').then(({ moveExecution }) => {
                moveExecution(id, execution.id, Number(pos));
            });
        }
    };

    return (
        <BaseSidebarItem
            id={execution.id}
            collectionId={execution.collectionId}
            contextMenuType="execution"
            depth={depth}
            isActive={activeExecutionId.value === execution.id}
            icon={<Play size={16} style={{ color: 'var(--accent-secondary)' }} />}
            label={displayName}
            labelStyle={{ fontStyle: 'italic' }}
            onSelect={handleSelect}
            onDelete={execution.name === 'default' ? undefined : handleDelete}
            draggable={execution.name !== 'default'}
            onDragStart={handleDragStart}
            onDropIntelligent={handleDropIntelligent}
        />
    );
}
