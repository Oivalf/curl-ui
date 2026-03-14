import { Folder as FolderIcon, FolderOpen, ChevronRight, ChevronDown } from 'lucide-preact';
import { activeFolderId, activeRequestId, activeExecutionId, folders, requests, Folder, openTabs, activeTabId, expandedFolderIds } from '../../store';
import { BaseSidebarItem } from './BaseSidebarItem';
import { RequestSidebarItem } from './RequestSidebarItem';

interface FolderSidebarItemProps {
    folder: Folder;
    depth?: number;
}

export function FolderSidebarItem({ folder, depth = 0 }: FolderSidebarItemProps) {

    const toggleCollapse = (e: MouseEvent) => {
        e.stopPropagation();
        if (expandedFolderIds.value.includes(folder.id)) {
            expandedFolderIds.value = expandedFolderIds.value.filter(id => id !== folder.id);
        } else {
            expandedFolderIds.value = [...expandedFolderIds.value, folder.id];
        }
    };

    const handleSelect = () => {
        const tabId = folder.id;
        if (!openTabs.value.find(t => t.id === tabId)) {
            openTabs.value = [...openTabs.value, {
                id: tabId,
                type: 'folder',
                name: folder.name
            }];
        }
        activeTabId.value = tabId;
        activeFolderId.value = folder.id;
        activeRequestId.value = null;
        activeExecutionId.value = null;
    };

    const handleDelete = (e: MouseEvent) => {
        e.stopPropagation();

        const performDelete = () => {
            const idsToDelete = new Set<string>([folder.id]);
            let added = true;

            while (added) {
                added = false;
                folders.value.forEach(f => {
                    if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
                        idsToDelete.add(f.id);
                        added = true;
                    }
                });
            }

            const deletedIds = new Set(idsToDelete);
            requests.value.forEach(r => {
                if (r.parentId && idsToDelete.has(r.parentId)) {
                    deletedIds.add(r.id);
                }
            });
            requests.value = requests.value.filter(r => !r.parentId || !idsToDelete.has(r.parentId));
            folders.value = folders.value.filter(f => !idsToDelete.has(f.id));

            if (activeRequestId.value && !requests.value.find(r => r.id === activeRequestId.value)) {
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
                title: 'Delete folder?',
                message: `Are you sure you want to delete "${folder.name}"? This will delete all contents.`,
                onConfirm: performDelete
            };
        });
    };

    // Drag and Drop
    const handleDragStart = (e: DragEvent) => {
        const data = JSON.stringify({ id: folder.id, type: 'folder' });
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
        if (id === folder.id) return;

        import('../../store').then(({ moveSidebarItem }) => {
            moveSidebarItem(id, type, folder.id, 'folder', pos);
        });
    };

    // Children
    const renderChildren = () => {
        if (!expandedFolderIds.value.includes(folder.id)) return null;
        
        const allChildren = [
            ...folders.value.filter(f => f.parentId === folder.id).map(f => ({ ...f, itemType: 'folder' as const })),
            ...requests.value.filter(r => r.parentId === folder.id).map(r => ({ ...r, itemType: 'request' as const }))
        ].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

        if (allChildren.length === 0) return null;

        return (
            <div>
                {allChildren.map(item => (
                    item.itemType === 'folder' 
                        ? <FolderSidebarItem key={item.id} folder={item as Folder} depth={depth + 1} />
                        : <RequestSidebarItem key={item.id} request={item as any} depth={depth + 1} />
                ))}
            </div>
        );
    };

    const isExpanded = expandedFolderIds.value.includes(folder.id);
    const arrowContent = (
        <div onClick={toggleCollapse}>
            {!isExpanded ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </div>
    );

    const icon = !isExpanded
        ? <FolderIcon size={16} style={{ color: 'var(--accent-primary)' }} />
        : <FolderOpen size={16} style={{ color: 'var(--accent-primary)' }} />;

    return (
        <BaseSidebarItem
            id={folder.id}
            collectionId={folder.collectionId}
            contextMenuType="folder"
            depth={depth}
            isActive={activeFolderId.value === folder.id}
            arrowContent={arrowContent}
            icon={icon}
            label={folder.name}
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
