import { useEffect, useRef } from 'preact/hooks';
import { contextMenu, requests, folders, activeRequestId } from '../store';
import { Edit2, Trash2, FilePlus, FolderPlus } from 'lucide-preact';

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
            <div
                className="context-menu-item"
                onClick={handleRename}
                style={itemStyle}
            >
                <Edit2 size={14} /> Rename
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
