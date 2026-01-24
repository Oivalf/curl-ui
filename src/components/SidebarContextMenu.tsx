import { useEffect, useRef } from 'preact/hooks';
import { contextMenu, requests, folders, activeRequestId } from '../store';
import { Edit2, Trash2, FilePlus, FolderPlus, Copy, Save, X } from 'lucide-preact';

const SaveIcon = Save as any;
const XIcon = X as any;

export function SidebarContextMenu() {
    const menuRef = useRef<HTMLDivElement>(null);
    const menu = contextMenu.value;

    // Close on click outside
    useEffect(() => {
        const handleClick = () => contextMenu.value = null;
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    if (!menu) return null;

    const handleDuplicate = () => {
        if (menu.type === 'folder') {
            const folderToDup = folders.value.find(f => f.id === menu.itemId);
            if (!folderToDup) return;

            const idMap = new Map<string, string>();
            const newFolders = [...folders.value];
            const newRequests = [...requests.value];

            const duplicateFolderRecursive = (folderId: string, newParentId: string | null | undefined) => {
                const folder = folders.value.find(f => f.id === folderId);
                if (!folder) return;

                const newId = crypto.randomUUID();
                idMap.set(folderId, newId);

                newFolders.push({
                    ...folder,
                    id: newId,
                    name: folderId === menu.itemId ? `${folder.name} (copy)` : folder.name,
                    parentId: newParentId
                });

                // Duplicate sub-folders
                folders.value.filter(f => f.parentId === folderId).forEach(subFolder => {
                    duplicateFolderRecursive(subFolder.id, newId);
                });

                // Duplicate sub-requests
                requests.value.filter(r => r.parentId === folderId).forEach(subReq => {
                    newRequests.push({
                        ...subReq,
                        id: crypto.randomUUID(),
                        parentId: newId
                    });
                });
            };

            duplicateFolderRecursive(menu.itemId, folderToDup.parentId);
            folders.value = newFolders;
            requests.value = newRequests;
        } else {
            const reqToDup = requests.value.find(r => r.id === menu.itemId);
            if (!reqToDup) return;

            const newId = crypto.randomUUID();
            requests.value = [...requests.value, {
                ...reqToDup,
                id: newId,
                name: `${reqToDup.name} (copy)`
            }];
            activeRequestId.value = newId;
        }
        contextMenu.value = null;
    };

    const handleRename = () => {
        const item = menu.type === 'folder'
            ? folders.value.find(f => f.id === menu.itemId)
            : requests.value.find(r => r.id === menu.itemId);

        if (!item) return;

        const newName = prompt("Rename to:", item.name);
        if (newName && newName !== item.name) {
            if (menu.type === 'folder') {
                folders.value = folders.value.map(f => f.id === menu.itemId ? { ...f, name: newName } : f);
            } else {
                requests.value = requests.value.map(r => r.id === menu.itemId ? { ...r, name: newName } : r);
            }
        }
        contextMenu.value = null;
    };

    const handleDelete = () => {
        const item = menu.type === 'folder'
            ? folders.value.find(f => f.id === menu.itemId)
            : requests.value.find(r => r.id === menu.itemId);

        if (!item) return;

        if (confirm(`Delete ${menu.type} "${item.name}"? ${menu.type === 'folder' ? 'This will delete all contents.' : ''}`)) {
            if (menu.type === 'folder') {
                // Recursive delete logic (duplicated from SidebarItem for now, could be shared)
                const idsToDelete = new Set<string>([menu.itemId]);
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
                requests.value = requests.value.filter(r => !r.parentId || !idsToDelete.has(r.parentId));
                folders.value = folders.value.filter(f => !idsToDelete.has(f.id));

                if (activeRequestId.value && requests.value.find(r => r.id === activeRequestId.value) === undefined) {
                    activeRequestId.value = null;
                }
            } else {
                requests.value = requests.value.filter(r => r.id !== menu.itemId);
                if (activeRequestId.value === menu.itemId) {
                    activeRequestId.value = null;
                }
            }
        }
        contextMenu.value = null;
    };

    const handleAddRequest = () => {
        const name = prompt("Enter request name:", "New Request");
        if (name === null) return;

        const newId = crypto.randomUUID();
        requests.value = [...requests.value, {
            id: newId,
            name: name || "New Request",
            method: "GET",
            url: "https://example.com",
            headers: {},
            parentId: menu.itemId,
            collectionId: menu.collectionId
        }];
        activeRequestId.value = newId;
        contextMenu.value = null;
    };

    const handleAddFolder = () => {
        const name = prompt("Enter folder name:", "New Folder");
        if (name === null) return;

        const newId = crypto.randomUUID();
        folders.value = [...folders.value, {
            id: newId,
            name: name || "New Folder",
            parentId: menu.itemId,
            collectionId: menu.collectionId,
            collapsed: false
        }];
        contextMenu.value = null;
    };

    return (
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                top: menu.y,
                left: menu.x,
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                padding: '4px',
                zIndex: 1000,
                minWidth: '150px'
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
            {menu.type === 'collection' ? (
                <>
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            import('../store').then(({ saveCollectionToDisk }) => {
                                saveCollectionToDisk(menu.collectionId);
                            });
                            contextMenu.value = null;
                        }}
                        style={itemStyle}
                    >
                        <SaveIcon size={14} /> Save
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            const name = prompt("Enter request name:", "New Request");
                            if (name) {
                                const newId = crypto.randomUUID();
                                requests.value = [...requests.value, {
                                    id: newId,
                                    name: name,
                                    method: "GET",
                                    url: "https://example.com",
                                    headers: {},
                                    parentId: null, // Root of collection
                                    collectionId: menu.collectionId
                                }];
                                activeRequestId.value = newId;
                            }
                            contextMenu.value = null;
                        }}
                        style={itemStyle}
                    >
                        <FilePlus size={14} /> New Request
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            const name = prompt("Enter folder name:", "New Folder");
                            if (name) {
                                const newId = crypto.randomUUID();
                                folders.value = [...folders.value, {
                                    id: newId,
                                    name: name,
                                    parentId: null, // Root of collection
                                    collectionId: menu.collectionId,
                                    collapsed: false
                                }];
                            }
                            contextMenu.value = null;
                        }}
                        style={itemStyle}
                    >
                        <FolderPlus size={14} /> New Folder
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                    <div
                        className="context-menu-item"
                        onClick={() => {
                            contextMenu.value = null;
                            import('../store').then(({ collections, syncProjectManifest, activeProjectName, confirmationState }) => {
                                const collection = collections.peek().find(c => c.id === menu.collectionId);
                                if (!collection) return;

                                const performRemove = () => {
                                    collections.value = collections.value.filter(c => c.id !== collection.id);
                                    syncProjectManifest(activeProjectName.peek());
                                };

                                confirmationState.value = {
                                    isOpen: true,
                                    title: `Remove collection "${collection.name}"?`,
                                    message: `Are you sure you want to remove collection "${collection.name}" from the project? The file will not be deleted from disk.`,
                                    onConfirm: performRemove
                                };
                            });
                        }}
                        style={{ ...itemStyle, color: 'var(--error)' }}
                    >
                        <XIcon size={14} /> Remove
                    </div>
                </>
            ) : (
                <>
                    <div
                        className="context-menu-item"
                        onClick={handleRename}
                        style={itemStyle}
                    >
                        <Edit2 size={14} /> Rename
                    </div>

                    <div
                        className="context-menu-item"
                        onClick={handleDuplicate}
                        style={itemStyle}
                    >
                        <Copy size={14} /> Duplicate
                    </div>

                    <div
                        className="context-menu-item"
                        onClick={handleDelete}
                        style={{ ...itemStyle, color: 'var(--error)' }}
                    >
                        <Trash2 size={14} /> Delete
                    </div>

                    {menu.type === 'folder' && (
                        <>
                            <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                            <div
                                className="context-menu-item"
                                onClick={handleAddRequest}
                                style={itemStyle}
                            >
                                <FilePlus size={14} /> Add Request
                            </div>
                            <div
                                className="context-menu-item"
                                onClick={handleAddFolder}
                                style={itemStyle}
                            >
                                <FolderPlus size={14} /> Add Folder
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    color: 'var(--text-primary)',
    transition: 'background-color 0.1s',
};
