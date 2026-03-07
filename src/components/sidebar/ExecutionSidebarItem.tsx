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
            onDelete={handleDelete}
        />
    );
}
