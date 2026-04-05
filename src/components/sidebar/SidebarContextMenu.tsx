import { useEffect, useRef } from 'preact/hooks';
import { contextMenu, requests, folders, executions, activeRequestId, activeExecutionId, activeFolderId, openTabs, activeTabId, importModal, collections, showPrompt, createNewRequest, environments } from '../../store';
import { Edit2, Trash2, FilePlus, FolderPlus, Copy, Save, X, Play, Download, ServerCog, ExternalLink } from 'lucide-preact';
import { exportToPostman } from '../../utils/postmanUtils';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

const SaveIcon = Save as any;
const XIcon = X as any;
const PlayIcon = Play as any;

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

            // Ensure duplicated requests have executions
            const duplicatedRequestIds = newRequests.filter(r => !requests.peek().some(old => old.id === r.id)).map(r => r.id);
            import('../../store').then(({ ensureDefaultExecutions }) => {
                ensureDefaultExecutions(duplicatedRequestIds);
            });
        } else if (menu.type === 'request') {
            const reqToDup = requests.value.find(r => r.id === menu.itemId);
            if (!reqToDup) return;

            const newId = crypto.randomUUID();
            requests.value = [...requests.value, {
                ...reqToDup,
                id: newId,
                name: `${reqToDup.name} (copy)`
            }];
            activeRequestId.value = newId;

            // Ensure default execution exists
            import('../../store').then(({ ensureDefaultExecutions }) => {
                ensureDefaultExecutions([newId]);
            });
        } else if (menu.type === 'execution') {
            const execToDup = executions.value.find(e => e.id === menu.itemId);
            if (!execToDup) return;

            const newId = crypto.randomUUID();
            const newName = execToDup.name === 'default' ? 'Default copy' : `${execToDup.name} copy`;
            const siblingsCount = executions.value.filter(e => e.requestId === execToDup.requestId).length;

            const newExec = {
                ...execToDup,
                id: newId,
                name: newName,
                sortIndex: siblingsCount
            };

            executions.value = [...executions.value, newExec];

            // Open in tab
            openTabs.value = [...openTabs.value, {
                id: newId,
                type: 'execution',
                name: newName
            }];
            activeTabId.value = newId;
            activeExecutionId.value = newId;
            activeRequestId.value = null;
            activeFolderId.value = null;
        }
        contextMenu.value = null;
    };

    const handleRename = async () => {
        let item;
        if (menu.type === 'folder') {
            item = folders.value.find(f => f.id === menu.itemId);
        } else if (menu.type === 'request') {
            item = requests.value.find(r => r.id === menu.itemId);
        } else if (menu.type === 'execution') {
            item = executions.value.find(e => e.id === menu.itemId);
            if (item?.name === 'default') return; // Cannot rename default
        }

        if (!item) return;

        const newName = await showPrompt("Rename to:", item.name);
        if (newName && newName !== item.name) {
            if (menu.type === 'folder') {
                folders.value = folders.value.map(f => f.id === menu.itemId ? { ...f, name: newName } : f);
            } else if (menu.type === 'request') {
                requests.value = requests.value.map(r => r.id === menu.itemId ? { ...r, name: newName } : r);
            } else if (menu.type === 'execution') {
                executions.value = executions.value.map(e => e.id === menu.itemId ? { ...e, name: newName } : e);
                // Update tab name if open
                openTabs.value = openTabs.value.map(t => t.id === menu.itemId ? { ...t, name: newName } : t);
            }
        }
        contextMenu.value = null;
    };

    const handleDelete = () => {
        if (menu.type === 'folder') {
            const item = folders.value.find(f => f.id === menu.itemId);
            if (!item) return;

            if (confirm(`Delete folder "${item.name}"? This will delete all contents.`)) {
                // Recursive delete logic
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
            }
        } else if (menu.type === 'request') {
            const item = requests.value.find(r => r.id === menu.itemId);
            if (!item) return;
            if (confirm(`Delete request "${item.name}"?`)) {
                requests.value = requests.value.filter(r => r.id !== menu.itemId);
                if (activeRequestId.value === menu.itemId) {
                    activeRequestId.value = null;
                }
            }
        } else if (menu.type === 'execution') {
            const execution = executions.value.find(e => e.id === menu.itemId);
            if (!execution || execution.name === 'default') return;

            import('../../store').then(({ confirmationState }) => {
                confirmationState.value = {
                    isOpen: true,
                    title: 'Delete execution?',
                    message: `Are you sure you want to delete "${execution.name}"?`,
                    onConfirm: () => {
                        executions.value = executions.value.filter(e => e.id !== menu.itemId);

                        // Close tab if open
                        if (openTabs.value.find(t => t.id === menu.itemId)) {
                            const newTabs = openTabs.value.filter(t => t.id !== menu.itemId);
                            openTabs.value = newTabs;

                            if (activeTabId.value === menu.itemId) {
                                if (newTabs.length > 0) {
                                    const lastTab = newTabs[newTabs.length - 1];
                                    activeTabId.value = lastTab.id;
                                    activeExecutionId.value = lastTab.type === 'execution' ? lastTab.id : null;
                                    activeRequestId.value = lastTab.type === 'request' ? lastTab.id : null;
                                    activeFolderId.value = lastTab.type === 'folder' ? lastTab.id : null;
                                } else {
                                    activeTabId.value = null;
                                    activeExecutionId.value = null;
                                    activeRequestId.value = null;
                                    activeFolderId.value = null;
                                }
                            }
                        }
                    }
                };
            });
        }
        contextMenu.value = null;
    };

    const handleAddRequest = async () => {
        const name = await showPrompt("Enter request name:", "New Request");
        if (name === null) return;

        const newReq = createNewRequest(name || "New Request", menu.collectionId, menu.itemId);
        requests.value = [...requests.value, newReq];
        activeRequestId.value = newReq.id;

        // Ensure default execution exists
        import('../../store').then(({ ensureDefaultExecutions }) => {
            ensureDefaultExecutions([newReq.id]);
        });

        contextMenu.value = null;
    };

    const handleAddFolder = async () => {
        const name = await showPrompt("Enter folder name:", "New Folder");
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

    const handleImport = (type: 'curl' | 'swagger') => {
        importModal.value = {
            isOpen: true,
            type,
            collectionId: menu.collectionId,
            folderId: menu.type === 'folder' ? menu.itemId : null
        };
        contextMenu.value = null;
    };

    const handleOpenMockManager = () => {
        const collection = collections.value.find(c => c.id === menu.collectionId);
        if (collection) {
            const tabId = collection.id;
            if (!openTabs.value.find(t => t.id === tabId)) {
                openTabs.value = [...openTabs.value, {
                    id: tabId,
                    type: 'collection',
                    name: `Mock: ${collection.name}`
                }];
            }
            activeTabId.value = tabId;
        }
        contextMenu.value = null;
    };

    const handleAddExecution = async () => {
        const name = await showPrompt("Enter execution name:", "New Execution");
        if (name === null) return;

        const parentRequest = requests.value.find(r => r.id === menu.itemId);
        if (!parentRequest) return;

        const siblingsCount = executions.value.filter(e => e.requestId === parentRequest.id).length;
        const newId = crypto.randomUUID();
        executions.value = [...executions.value, {
            id: newId,
            requestId: parentRequest.id,
            collectionId: parentRequest.collectionId,
            name: name || "New Execution",
            sortIndex: siblingsCount
            // All other fields undefined = inherit from parent request
        }];

        // Open the new execution in a tab
        openTabs.value = [...openTabs.value, {
            id: newId,
            type: 'execution',
            name: name || "New Execution"
        }];
        activeTabId.value = newId;
        activeExecutionId.value = newId;
        activeRequestId.value = null;
        activeFolderId.value = null;

        contextMenu.value = null;
    };



    const handleCloseAllTabs = () => {
        openTabs.value = [];
        activeTabId.value = null;
        activeExecutionId.value = null;
        activeRequestId.value = null;
        activeFolderId.value = null;
        contextMenu.value = null;
    };

    const handleCloseOthersTabs = () => {
        const tabToKeep = openTabs.value.find(t => t.id === menu.itemId);
        if (tabToKeep) {
            openTabs.value = [tabToKeep];
            activeTabId.value = tabToKeep.id;
            // Activate the tab to sync legacy stores
            if (tabToKeep.type === 'request') {
                activeRequestId.value = tabToKeep.id;
                activeFolderId.value = null;
                activeExecutionId.value = null;
            } else if (tabToKeep.type === 'execution') {
                activeExecutionId.value = tabToKeep.id;
                activeRequestId.value = null;
                activeFolderId.value = null;
            } else if (tabToKeep.type === 'folder') {
                activeFolderId.value = tabToKeep.id;
                activeRequestId.value = null;
                activeExecutionId.value = null;
            }
        }
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
                            import('../../store').then(({ saveCollectionToDisk }) => {
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
                        onClick={async () => {
                            const name = await showPrompt("Enter request name:", "New Request");
                            if (name) {
                                const newReq = createNewRequest(name, menu.collectionId, null);
                                requests.value = [...requests.value, newReq];
                                activeRequestId.value = newReq.id;

                                // Ensure default execution exists
                                import('../../store').then(({ ensureDefaultExecutions }) => {
                                    ensureDefaultExecutions([newReq.id]);
                                });
                            }
                            contextMenu.value = null;
                        }}
                        style={itemStyle}
                    >
                        <FilePlus size={14} /> New Request
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={() => handleImport('curl')}
                        style={itemStyle}
                    >
                        <Download size={14} /> Import...
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={handleOpenMockManager}
                        style={itemStyle}
                    >
                        <ServerCog size={14} /> Mock Manager
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={async () => {
                            const collection = collections.value.find(c => c.id === menu.collectionId);
                            if (!collection) return;

                            const path = await save({
                                defaultPath: `${collection.name}.postman_collection.json`,
                                filters: [{
                                    name: 'Postman Collection',
                                    extensions: ['json']
                                }]
                            });

                            if (path) {
                                const collectionRequests = requests.value.filter(r => r.collectionId === menu.collectionId);
                                const collectionFolders = folders.value.filter(f => f.collectionId === menu.collectionId);
                                const collectionExecutions = executions.value.filter(e => e.collectionId === menu.collectionId);

                                const data = {
                                    id: collection.id,
                                    name: collection.name,
                                    requests: collectionRequests,
                                    folders: collectionFolders,
                                    executions: collectionExecutions,
                                    environments: environments.value
                                };

                                const postmanCollection = exportToPostman(data as any);
                                await invoke('save_workspace', { path, data: JSON.stringify(postmanCollection, null, 2) });
                                alert(`Collection exported to ${path}`);
                            }
                            contextMenu.value = null;
                        }}
                        style={itemStyle}
                    >
                        <ExternalLink size={14} /> Export to Postman
                    </div>
                    <div
                        className="context-menu-item"
                        onClick={async () => {
                            const name = await showPrompt("Enter folder name:", "New Folder");
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
                            import('../../store').then(({ collections, syncProjectManifest, activeProjectName, confirmationState }) => {
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
                    {(() => {
                        const isExecution = menu.type === 'execution';
                        const execution = isExecution ? executions.value.find(e => e.id === menu.itemId) : null;
                        const isDefault = execution?.name === 'default';

                        return (
                            <>
                                {(!isExecution || !isDefault) && (
                                    <div
                                        className="context-menu-item"
                                        onClick={handleRename}
                                        style={itemStyle}
                                    >
                                        <Edit2 size={14} /> Rename
                                    </div>
                                )}

                                <div
                                    className="context-menu-item"
                                    onClick={handleDuplicate}
                                    style={itemStyle}
                                >
                                    <Copy size={14} /> Duplicate
                                </div>

                                {(!isExecution || !isDefault) && (
                                    <div
                                        className="context-menu-item"
                                        onClick={handleDelete}
                                        style={{ ...itemStyle, color: 'var(--error)' }}
                                    >
                                        <Trash2 size={14} /> Delete
                                    </div>
                                )}
                            </>
                        );
                    })()}

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
                            <div
                                className="context-menu-item"
                                onClick={() => handleImport('curl')}
                                style={itemStyle}
                            >
                                <Download size={14} /> Import...
                            </div>
                        </>
                    )}

                    {menu.type === 'request' && (
                        <>
                            <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                            <div
                                className="context-menu-item"
                                onClick={handleAddExecution}
                                style={itemStyle}
                            >
                                <PlayIcon size={14} /> New Execution
                            </div>
                        </>
                    )}

                    {menu.type === 'tab' && (
                        <>
                            <div
                                className="context-menu-item"
                                onClick={handleCloseOthersTabs}
                                style={itemStyle}
                            >
                                <XIcon size={14} /> Close Others
                            </div>
                            <div
                                className="context-menu-item"
                                onClick={handleCloseAllTabs}
                                style={{ ...itemStyle, color: 'var(--error)' }}
                            >
                                <XIcon size={14} /> Close All
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
