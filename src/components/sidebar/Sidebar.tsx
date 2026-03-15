import { useState, useEffect } from 'preact/hooks';
import { Layout, GitBranch, Plus, Settings, FolderPlus, Save, FolderOpen, ChevronRight, ChevronDown, Trash2, X, MoreVertical, ServerCog, FileJson, ListTree } from 'lucide-preact';
import { activeFolderId, activeRequestId, requests, folders, collections, saveCollectionToDisk, loadCollectionFromDisk, environments, activeProjectName, openTabs, activeTabId, showPrompt, externalMocks, activeExternalMockId, createExternalMock, deleteExternalMock, loadExternalMockFromDisk, importModalState, useCases, createNewRequest, isExternalMocksExpanded, expandedCollectionIds, Folder, moveSidebarItem, createNewFolder } from '../../store';
import { FolderSidebarItem } from './FolderSidebarItem';
import { RequestSidebarItem } from './RequestSidebarItem';

import { SidebarContextMenu } from './SidebarContextMenu';
import { Modal } from '../Modal';
import { GitPanel } from '../GitPanel';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import '../../styles/global.css';

// Cast icons to any to avoid Preact/React type conflicts
const LayoutIcon = Layout as any;
const GitBranchIcon = GitBranch as any;
const PlusIcon = Plus as any;
const SettingsIcon = Settings as any;
const FolderPlusIcon = FolderPlus as any;
const SaveIcon = Save as any;
const FolderOpenIcon = FolderOpen as any;
const ChevronRightIcon = ChevronRight as any;
const ChevronDownIcon = ChevronDown as any;
const TrashIcon = Trash2 as any;
const XIcon = X as any;
const MoreVerticalIcon = MoreVertical as any;
const ListTreeIcon = ListTree as any;

interface SidebarProps {
    width?: number; // Optional to prevent breaking updates if parent renders without it temporarily
}

export function Sidebar({ width = 250 }: SidebarProps) {
    const [isGitOpen, setGitOpen] = useState(false);
    const [openMenuCollectionId, setOpenMenuCollectionId] = useState<string | null>(null);

    // Sidebar expanded state now lives in the store as signals
    const [collectionGitStatus, setCollectionGitStatus] = useState<Record<string, boolean>>({});
    const [isMockMenuOpen, setMockMenuOpen] = useState(false);

    useEffect(() => {
        const checkGitStatus = async () => {
            const statuses: Record<string, boolean> = {};
            for (const collection of collections.value) {
                if (collection.path) {
                    try {
                        const isRepo = await invoke<boolean>('is_git_repo', { path: collection.path });
                        statuses[collection.id] = isRepo;
                    } catch (e) {
                        console.error("Failed to check git status", e);
                    }
                }
            }
            setCollectionGitStatus(statuses);
        };
        checkGitStatus();
    }, [collections.value]);

    const toggleCollection = (id: string) => {
        if (expandedCollectionIds.value.includes(id)) {
            expandedCollectionIds.value = expandedCollectionIds.value.filter(x => x !== id);
        } else {
            expandedCollectionIds.value = [...expandedCollectionIds.value, id];
        }
    };

    const isCollectionExpanded = (id: string) => {
        // If we have no items in expandedCollectionIds and it's a new session,
        // we might want to default to true. But for now, let's respect the list.
        // Actually, let's auto-populate it on load in store.ts if needed, or:
        return expandedCollectionIds.value.includes(id);
    };

    const toggleExternalMocks = () => {
        isExternalMocksExpanded.value = !isExternalMocksExpanded.value;
    };

    const openNewProjectWindow = async () => {
        const projectName = await showPrompt("Enter Project Name:", "New Project");
        if (!projectName) return;

        // Open a new window for a new project/workspace
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const label = `project-${crypto.randomUUID()}`;
        const webview = new WebviewWindow(label, {
            url: `/?projectName=${encodeURIComponent(projectName)}`,
            title: `cURL-UI - ${projectName}`,
            decorations: false
        });
        webview.once('tauri://created', function () {
            // webview window successfully created
        });
        webview.once('tauri://error', function (e) {
            // an error happened creating the webview window
            console.error(e);
            alert('Error creating new window: ' + JSON.stringify(e));
        });
    };

    useEffect(() => {
        const unlisten = listen('open-new-project', () => {
            openNewProjectWindow();
        });
        return () => {
            unlisten.then(f => f());
        };
    }, []);


    const createNewCollection = async () => {
        const name = await showPrompt("New Collection Name:", "New Collection");
        if (name) {
            const newId = crypto.randomUUID();
            collections.value = [...collections.value, {
                id: newId,
                name: name,
                path: undefined // Not saved yet
            }];

            // Ensure default environments exist if it's a fresh start
            const currentEnvs = environments.peek();
            if (currentEnvs.length === 1 && currentEnvs[0].name === 'Global') {
                environments.value = [
                    { name: 'Global', variables: [] },
                    { name: 'Local', variables: [] },
                    { name: 'Dev', variables: [] },
                    { name: 'Test', variables: [] },
                    { name: 'Prod', variables: [] }
                ];
            }

            // Auto expand the new collection
            expandedCollectionIds.value = [...expandedCollectionIds.value, newId];
        }
    };

    const handleDeleteProject = async () => {
        const projectName = activeProjectName.value;

        const performDeleteProject = async () => {
            await invoke('delete_project', { name: projectName });
            // Close the current window
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const currentWindow = getCurrentWindow();
            await currentWindow.close();
        };

        // Trigger Modal
        import('../../store').then(({ confirmationState }) => {
            confirmationState.value = {
                isOpen: true,
                title: `Delete project "${projectName}"?`,
                message: `Are you sure you want to delete project "${projectName}"? This will delete the manifest file and close this window. Collections files will still be kept in the folders they are located in.`,
                onConfirm: performDeleteProject
            };
        });

    };

    return (
        <aside style={{
            width: `${width}px`,
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            padding: 'var(--spacing-md)'
        }}>
            <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <LayoutIcon color="var(--accent-primary)" />
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProjectName.value}</h2>
                </div>
                {activeProjectName.value !== "Default Project" && (
                    <button
                        onClick={handleDeleteProject}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Delete Project"
                    >
                        <TrashIcon size={16} />
                    </button>
                )}
            </div>

            {/* Action Bar: New Request, New Folder - These now need a target collection. 
                For simplicity, let's add them to the FIRST collection or currently active one?
                Or maybe we move "New..." buttons to inside the Collection header?
                Let's keep global buttons but prompt for Collection if multiple exist? 
                Or simply add to the first one for MVP.
            */}
            <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', gap: '8px' }}>
                <button
                    onClick={loadCollectionFromDisk}
                    title="Load Collection"
                    style={{ flex: 1, padding: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                >
                    <FolderOpenIcon size={14} /> Load
                </button>
                <button
                    onClick={createNewCollection}
                    title="New Collection"
                    style={{ flex: 1, padding: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                >
                    <PlusIcon size={14} /> New
                </button>
            </div>

            <nav
                style={{ flex: 1, overflowY: 'auto' }}
            >
                {collections.value.map(collection => (
                    <div key={collection.id} style={{ marginBottom: '16px' }}>
                        {/* Collection Header */}
                        <div
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-primary)' }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                import('../../store').then(({ contextMenu }) => {
                                    contextMenu.value = {
                                        x: e.clientX,
                                        y: e.clientY,
                                        itemId: collection.id,
                                        type: 'collection',
                                        collectionId: collection.id
                                    };
                                });
                            }}
                        >
                            <div
                                onClick={() => toggleCollection(collection.id)}
                                style={{ display: 'flex', alignItems: 'center' }}
                            >
                                {isCollectionExpanded(collection.id) ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                            </div>
                            <div
                                onClick={() => toggleCollection(collection.id)}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (e.dataTransfer) {
                                        e.dataTransfer.dropEffect = 'move';
                                    }
                                    e.stopPropagation();
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    let data = e.dataTransfer?.getData('application/json');
                                    if (!data) {
                                        const plain = e.dataTransfer?.getData('text/plain');
                                        if (plain?.startsWith('curl-ui:')) {
                                            data = plain.slice(8);
                                        }
                                    }
                                    if (!data) return;
                                    const { id, type } = JSON.parse(data);
                                    if (id === collection.id) return;

                                    moveSidebarItem(id, type, collection.id, 'collection', 'inside');
                                }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{collection.name}</span>
                                    {collectionGitStatus[collection.id] && (
                                        <GitBranchIcon size={12} color="var(--text-muted)" title="In Git Repository" />
                                    )}
                                </div>
                                <span
                                    title={collection.path || "Not saved"}
                                    style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        fontWeight: 'normal',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        direction: 'rtl',
                                        textAlign: 'left'
                                    }}
                                >
                                    <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{collection.path || "Not saved"}</span>
                                </span>
                            </div>

                            {/* Collection Actions: Save, Add Folder/Request */}
                            {/* Collection Actions Menu */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuCollectionId(openMenuCollectionId === collection.id ? null : collection.id);
                                    }}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                >
                                    <MoreVerticalIcon size={16} />
                                </button>

                                {openMenuCollectionId === collection.id && (
                                    <>
                                        {/* Backrdrop to close menu */}
                                        <div
                                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                                            onClick={(e) => { e.stopPropagation(); setOpenMenuCollectionId(null); }}
                                        />

                                        <div style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: '100%',
                                            backgroundColor: 'var(--bg-surface)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-sm)',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                            zIndex: 51,
                                            minWidth: '150px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            padding: '4px 0'
                                        }}>
                                            <button
                                                className="menu-item"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    saveCollectionToDisk(collection.id);
                                                    setOpenMenuCollectionId(null);
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <SaveIcon size={14} /> Save
                                            </button>
                                            <button
                                                className="menu-item"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuCollectionId(null);
                                                    const name = await showPrompt("Request Name:", "New Request");
                                                    if (name) {
                                                        const newReq = createNewRequest(name, collection.id, null);
                                                        requests.value = [...requests.value, newReq];
                                                        activeRequestId.value = newReq.id;

                                                        // Ensure default execution exists
                                                        import('../../store').then(({ ensureDefaultExecutions }) => {
                                                            ensureDefaultExecutions([newReq.id]);
                                                        });
                                                    }
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <PlusIcon size={14} /> New Request
                                            </button>
                                            <button
                                                className="menu-item"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuCollectionId(null);
                                                    const name = await showPrompt("Folder Name:", "New Folder");
                                                    if (name) {
                                                        const newFolder = createNewFolder(name, collection.id, null);
                                                        folders.value = [...folders.value, newFolder];
                                                    }
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <FolderPlusIcon size={14} /> New Folder
                                            </button>
                                            <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                                            <button
                                                className="menu-item"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenMenuCollectionId(null);
                                                    const performRemove = () => {
                                                        collections.value = collections.value.filter(c => c.id !== collection.id);
                                                        // Sync manifest to persist removal
                                                        import('../../store').then(({ syncProjectManifest, activeProjectName }) => {
                                                            syncProjectManifest(activeProjectName.peek());
                                                        });
                                                    };

                                                    // Trigger Modal using the store's confirmationState
                                                    import('../../store').then(({ confirmationState }) => {
                                                        confirmationState.value = {
                                                            isOpen: true,
                                                            title: `Remove collection "${collection.name}"?`,
                                                            message: `Are you sure you want to remove collection "${collection.name}" from the project? The file will not be deleted from disk.`,
                                                            onConfirm: performRemove
                                                        };
                                                    });
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 0, 0, 0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <XIcon size={14} /> Remove
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Collection Items */}
                        {isCollectionExpanded(collection.id) && (
                            <div style={{ marginLeft: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '4px' }}>
                                {(() => {
                                    const rootItems = [
                                        ...folders.value.filter(f => f.collectionId === collection.id && !f.parentId).map(f => ({ ...f, itemType: 'folder' as const })),
                                        ...requests.value.filter(r => r.collectionId === collection.id && !r.parentId).map(r => ({ ...r, itemType: 'request' as const }))
                                    ].sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

                                    if (rootItems.length === 0) {
                                        return <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px' }}>Empty</div>;
                                    }

                                    return rootItems.map(item => (
                                        item.itemType === 'folder'
                                            ? <FolderSidebarItem key={item.id} folder={item as Folder} />
                                            : <RequestSidebarItem key={item.id} request={item as any} />
                                    ));
                                })()}
                                {/* Mock Manager node at the top */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const tabId = collection.id;
                                        if (!openTabs.value.find(t => t.id === tabId)) {
                                            openTabs.value = [...openTabs.value, {
                                                id: tabId,
                                                type: 'collection',
                                                name: `Mock: ${collection.name}`
                                            }];
                                        }
                                        activeTabId.value = tabId;
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        import('../../store').then(({ contextMenu }) => {
                                            contextMenu.value = {
                                                x: e.clientX,
                                                y: e.clientY,
                                                itemId: collection.id,
                                                type: 'collection',
                                                collectionId: collection.id
                                            };
                                        });
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '6px 8px',
                                        cursor: 'pointer',
                                        borderRadius: 'var(--radius-sm)',
                                        color: activeTabId.value === collection.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        backgroundColor: activeTabId.value === collection.id ? 'var(--bg-surface)' : 'transparent',
                                        transition: 'background-color 0.1s',
                                        marginBottom: '4px'
                                    }}
                                    onMouseEnter={(e) => !(activeTabId.value === collection.id) && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                                    onMouseLeave={(e) => !(activeTabId.value === collection.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <div style={{ display: 'flex', color: 'var(--text-muted)' }}>
                                        <ServerCog size={14} />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', flex: 1 }}>{collection.name} Mocks</span>
                                    {collection.mockConfig?.enabled && (
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)', boxShadow: '0 0 4px var(--success)' }} />
                                    )}
                                </div>




                            </div>
                        )}
                    </div>
                ))}
            </nav>

            {/* External Mocks Section */}
            <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-color)', marginBottom: '8px' }}>
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', cursor: 'pointer', color: 'var(--text-primary)' }}
                    onClick={toggleExternalMocks}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isExternalMocksExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                        <span style={{ fontWeight: 'bold' }}>External Mocks</span>
                        {externalMocks.value.length > 0 && (
                            <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                marginLeft: '6px',
                                fontWeight: 'normal'
                            }}>
                                {externalMocks.value.length}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); loadExternalMockFromDisk(); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Load External Mock"
                        >
                            <FolderOpen size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setMockMenuOpen(!isMockMenuOpen); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="New External Mock"
                        >
                            <PlusIcon size={14} />
                        </button>

                        {isMockMenuOpen && (
                            <>
                                <div
                                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
                                    onClick={() => setMockMenuOpen(false)}
                                />
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    backgroundColor: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                    zIndex: 101,
                                    minWidth: '150px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '4px 0',
                                    marginTop: '4px'
                                }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMockMenuOpen(false);
                                            createExternalMock();
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <PlusIcon size={14} /> From Scratch
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setMockMenuOpen(false);
                                            importModalState.value = {
                                                isOpen: true,
                                                type: 'swagger',
                                                collectionId: '',
                                                targetType: 'new-external-mock'
                                            };
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <FileJson size={14} /> From Swagger
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {isExternalMocksExpanded.value && (
                    <div style={{ marginLeft: '12px' }}>
                        {externalMocks.value.length === 0 && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px' }}>No External Mocks</div>
                        )}
                        {externalMocks.value.map(mock => (
                            <div
                                key={mock.id}
                                onClick={() => {
                                    activeExternalMockId.value = mock.id;
                                    activeRequestId.value = null;
                                    activeFolderId.value = null;

                                    // Add to tabs if not present (optional, we might treating mocks as tabs?)
                                    // The ExternalMockEditor uses activeTabId OR activeExternalMockId.
                                    // Let's treat it as a tab to be consistent.
                                    if (!openTabs.value.find(t => t.id === mock.id)) {
                                        openTabs.value = [...openTabs.value, {
                                            id: mock.id,
                                            type: 'external-mock',
                                            name: mock.name
                                        }];
                                    }
                                    activeTabId.value = mock.id;
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                    borderRadius: 'var(--radius-sm)',
                                    color: (activeTabId.value === mock.id) ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    backgroundColor: (activeTabId.value === mock.id) ? 'var(--bg-surface)' : 'transparent',
                                    transition: 'background-color 0.1s',
                                    marginBottom: '4px'
                                }}
                            >
                                <div style={{ display: 'flex', color: 'var(--text-muted)' }}>
                                    <ServerCog size={14} />
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: '0.85rem' }}>{mock.name}</span>
                                    <div
                                        style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                        title={mock.path || "Not saved"}
                                    >
                                        {mock.path ? mock.path.split('/').pop() : "Not saved"}
                                    </div>
                                </div>

                                {mock.serverStatus === 'running' && (
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)', boxShadow: '0 0 4px var(--success)' }} />
                                )}

                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteExternalMock(mock.id); }}
                                    className="delete-btn"
                                    style={{
                                        background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                    <Trash2 size={14} />
                                </button>
                                <style>{`
                                    div:hover > .delete-btn { opacity: 1 !important; }
                                `}</style>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* UseCases Section */}
            <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-color)', marginBottom: '8px' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        color: activeTabId.value === 'use-case-manager' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        backgroundColor: activeTabId.value === 'use-case-manager' ? 'var(--bg-surface)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background-color 0.1s'
                    }}
                    onClick={() => {
                        if (!openTabs.value.find(t => t.id === 'use-case-manager')) {
                            openTabs.value = [...openTabs.value, {
                                id: 'use-case-manager',
                                type: 'use-case',
                                name: 'Use Cases'
                            }];
                        }
                        activeTabId.value = 'use-case-manager';
                    }}
                    onMouseEnter={(e) => !(activeTabId.value === 'use-case-manager') && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={(e) => !(activeTabId.value === 'use-case-manager') && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ListTreeIcon size={16} color="var(--accent-primary)" />
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Use Cases</span>
                        {useCases.value.length > 0 && (
                            <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                marginLeft: '6px',
                                fontWeight: 'normal'
                            }}>
                                {useCases.value.length}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div style={{
                marginTop: 'auto',
                borderTop: '1px solid var(--border-color)',
                paddingTop: 'var(--spacing-md)'
            }}>
                <div
                    onClick={() => setGitOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                >
                    <GitBranchIcon size={16} />
                    <span>Git Status</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}>
                    <SettingsIcon size={16} />
                    <span>Settings</span>
                </div>
            </div>

            <Modal isOpen={isGitOpen} onClose={() => setGitOpen(false)} title="Git Control">
                <GitPanel />
            </Modal>

            <SidebarContextMenu />
        </aside>
    );
}
