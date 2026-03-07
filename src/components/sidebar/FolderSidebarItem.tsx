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
        e.dataTransfer?.setData('application/json', JSON.stringify({ id: folder.id, type: 'folder' }));
        e.stopPropagation();
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const data = e.dataTransfer?.getData('application/json');
        if (!data) return;
        const { id, type } = JSON.parse(data);
        if (id === folder.id) return;

        if (type === 'request') {
            requests.value = requests.value.map(r => r.id === id ? { ...r, parentId: folder.id } : r);
        } else if (type === 'folder') {
            folders.value = folders.value.map(f => f.id === id ? { ...f, parentId: folder.id } : f);
        }
    };

    // Children
    const renderChildren = () => {
        if (!expandedFolderIds.value.includes(folder.id)) return null;
        const childFolders = folders.value.filter(f => f.parentId === folder.id);
        const childRequests = requests.value.filter(r => r.parentId === folder.id);
        if (childFolders.length === 0 && childRequests.length === 0) return null;

        return (
            <div>
                {childFolders.map(f => (
                    <FolderSidebarItem key={f.id} folder={f} depth={depth + 1} />
                ))}
                {childRequests.map(r => (
                    <RequestSidebarItem key={r.id} request={r} depth={depth + 1} />
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
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {renderChildren()}
        </BaseSidebarItem>
    );
}
