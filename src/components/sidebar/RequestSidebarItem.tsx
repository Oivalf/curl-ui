import { FileJson, ChevronRight, ChevronDown } from 'lucide-preact';
import { activeRequestId, activeFolderId, activeExecutionId, requests, executions, RequestItem, openTabs, activeTabId } from '../../store';
import { BaseSidebarItem } from './BaseSidebarItem';
import { ExecutionSidebarItem } from './ExecutionSidebarItem';

interface RequestSidebarItemProps {
    request: RequestItem;
    depth?: number;
}

const methodColor = (method: string) => {
    switch (method) {
        case 'GET': return 'var(--success)';
        case 'POST': return 'var(--warning)';
        case 'DELETE': return 'var(--error)';
        case 'PATCH': return 'var(--yellow)';
        case 'PUT': return 'var(--accent-primary)';
        default: return 'var(--text-muted)';
    }
};

export function RequestSidebarItem({ request, depth = 0 }: RequestSidebarItemProps) {

    const childExecutions = executions.value.filter(e => e.requestId === request.id);
    const hasExecutions = childExecutions.length > 0;

    const toggleCollapse = (e: MouseEvent) => {
        e.stopPropagation();
        requests.value = requests.value.map(r =>
            r.id === request.id ? { ...r, collapsed: !r.collapsed } : r
        );
    };

    const handleSelect = () => {
        const tabId = request.id;
        if (!openTabs.value.find(t => t.id === tabId)) {
            openTabs.value = [...openTabs.value, {
                id: tabId,
                type: 'request',
                name: request.name
            }];
        }
        activeTabId.value = tabId;
        activeRequestId.value = request.id;
        activeFolderId.value = null;
        activeExecutionId.value = null;
    };

    const handleDelete = (e: MouseEvent) => {
        e.stopPropagation();

        const performDelete = () => {
            requests.value = requests.value.filter(r => r.id !== request.id);
            const deletedIds = new Set([request.id]);

            if (activeRequestId.value === request.id) {
                activeRequestId.value = null;
            }

            // Close tabs for deleted items
            const newTabs = openTabs.value.filter(t => !deletedIds.has(t.id));
            if (newTabs.length !== openTabs.value.length) {
                openTabs.value = newTabs;
                if (activeTabId.value && deletedIds.has(activeTabId.value)) {
                    if (newTabs.length > 0) {
                        const lastTab = newTabs[newTabs.length - 1];
                        activeTabId.value = lastTab.id;
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

        import('../../store').then(({ confirmationState }) => {
            confirmationState.value = {
                isOpen: true,
                title: 'Delete request?',
                message: `Are you sure you want to delete "${request.name}"?`,
                onConfirm: performDelete
            };
        });
    };

    // Drag
    const handleDragStart = (e: DragEvent) => {
        const data = JSON.stringify({ id: request.id, type: 'request' });
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
        if (id === request.id) return;

        import('../../store').then(({ moveSidebarItem }) => {
            moveSidebarItem(id, type, request.id, 'request', pos);
        });
    };

    // Children (executions)
    const renderChildren = () => {
        if (request.collapsed || !hasExecutions) return null;
        return (
            <div>
                {childExecutions.map(ex => (
                    <ExecutionSidebarItem key={ex.id} execution={ex} depth={depth + 1} />
                ))}
            </div>
        );
    };

    const arrowContent = hasExecutions ? (
        <div onClick={toggleCollapse}>
            {request.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </div>
    ) : undefined;

    const prefixLabel = (
        <span style={{
            fontSize: '0.7rem',
            fontWeight: 'bold',
            color: methodColor(request.method),
            minWidth: '35px'
        }}>
            {request.method}
        </span>
    );

    return (
        <BaseSidebarItem
            id={request.id}
            collectionId={request.collectionId}
            contextMenuType="request"
            depth={depth}
            isActive={activeRequestId.value === request.id}
            arrowContent={arrowContent}
            icon={<FileJson size={16} />}
            prefixLabel={prefixLabel}
            label={request.name}
            onSelect={handleSelect}
            onDelete={handleDelete}
            draggable
            onDragStart={handleDragStart}
            onDropIntelligent={handleDropIntelligent}
        >
            {renderChildren()}
        </BaseSidebarItem>
    );
}
