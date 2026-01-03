import { useState, useEffect } from 'preact/hooks';
import { Layout, GitBranch, Plus, Settings, FolderPlus, Save, FolderOpen, ChevronRight, ChevronDown } from 'lucide-preact';
import { activeRequestId, requests, folders, collections, saveCollectionToDisk, loadCollectionFromDisk, environments, activeProjectName } from '../store';
import { SidebarItem } from './SidebarItem';
import { SidebarContextMenu } from './SidebarContextMenu';
import { Modal } from './Modal';
import { GitPanel } from './GitPanel';
import { listen } from '@tauri-apps/api/event';
import '../styles/global.css';

export function Sidebar() {
    const [isGitOpen, setGitOpen] = useState(false);

    // Simple local state to track expanded collections. 
    // In a larger app, this might go into store or a persistent local state.
    const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});

    const toggleCollection = (id: string) => {
        setExpandedCollections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Auto-expand all collections by default initially? Or just the first one?
    // For now, default closed unless toggled.
    // Actually, let's default all open
    const isCollectionExpanded = (id: string) => {
        return expandedCollections[id] !== false; // Default true
    };

    const openNewProjectWindow = async () => {
        const projectName = prompt("Enter Project Name:", "New Project");
        if (!projectName) return;

        // Open a new window for a new project/workspace
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const label = `project-${crypto.randomUUID()}`;
        const webview = new WebviewWindow(label, {
            url: `/?projectName=${encodeURIComponent(projectName)}`,
            title: `Curl UI - ${projectName}`
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


    const createNewCollection = () => {
        const name = prompt("New Collection Name:", "New Collection");
        if (name) {
            const newId = crypto.randomUUID();
            collections.value = [...collections.value, {
                id: newId,
                name: name,
                projectName: activeProjectName.value,
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
            setExpandedCollections(prev => ({ ...prev, [newId]: true }));
        }
    };

    return (
        <aside style={{
            width: '250px',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            padding: 'var(--spacing-md)'
        }}>
            <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layout color="var(--accent-primary)" />
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Curl UI</h2>
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
                    <FolderOpen size={14} /> Load
                </button>
                <button
                    onClick={createNewCollection}
                    title="New Collection"
                    style={{ flex: 1, padding: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                >
                    <Plus size={14} /> New
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
                        >
                            <div
                                onClick={() => toggleCollection(collection.id)}
                                style={{ display: 'flex', alignItems: 'center' }}
                            >
                                {isCollectionExpanded(collection.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                            <div onClick={() => toggleCollection(collection.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <span>{collection.name}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{collection.projectName}</span>
                            </div>

                            {/* Collection Actions: Save, Add Folder/Request */}
                            <button
                                onClick={(e) => { e.stopPropagation(); saveCollectionToDisk(collection.id); }}
                                title="Save Collection"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                                <Save size={14} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const name = prompt("Request Name:", "New Request");
                                    if (name) {
                                        const newId = crypto.randomUUID();
                                        requests.value = [...requests.value, {
                                            id: newId,
                                            collectionId: collection.id, // Assign to this collection
                                            name: name,
                                            method: "GET",
                                            url: "https://example.com",
                                            headers: {},
                                            parentId: null
                                        }];
                                        activeRequestId.value = newId;
                                    }
                                }}
                                title="Add Request"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                                <Plus size={14} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const name = prompt("Folder Name:", "New Folder");
                                    if (name) {
                                        const newId = crypto.randomUUID();
                                        folders.value = [...folders.value, {
                                            id: newId,
                                            collectionId: collection.id, // Assign to this collection
                                            name: name,
                                            parentId: null,
                                            collapsed: false
                                        }];
                                    }
                                }}
                                title="Add Folder"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                                <FolderPlus size={14} />
                            </button>
                        </div>

                        {/* Collection Items */}
                        {isCollectionExpanded(collection.id) && (
                            <div style={{ marginLeft: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '4px' }}>
                                {folders.value
                                    .filter(f => f.collectionId === collection.id && !f.parentId)
                                    .map(f => (
                                        <SidebarItem key={f.id} item={f} type="folder" />
                                    ))}
                                {requests.value
                                    .filter(r => r.collectionId === collection.id && !r.parentId)
                                    .map(r => (
                                        <SidebarItem key={r.id} item={r} type="request" />
                                    ))}

                                {folders.value.filter(f => f.collectionId === collection.id && !f.parentId).length === 0 &&
                                    requests.value.filter(r => r.collectionId === collection.id && !r.parentId).length === 0 && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px' }}>Empty</div>
                                    )}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div style={{
                marginTop: 'auto',
                borderTop: '1px solid var(--border-color)',
                paddingTop: 'var(--spacing-md)'
            }}>
                <div
                    onClick={() => setGitOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                >
                    <GitBranch size={16} />
                    <span>Git Status</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}>
                    <Settings size={16} />
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
