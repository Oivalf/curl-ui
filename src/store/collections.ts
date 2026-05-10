import { signal, batch } from "@preact/signals";
import { Collection, RequestItem, Folder, Environment, AuthConfig, InheritedRow, ExternalMock } from "./types";
import { activeTabId, activeRequestId, activeFolderId, openTabs } from "./uiState";

// --- Collection Resources ---
export const collections = signal<Collection[]>([]);
export const requests = signal<RequestItem[]>([]);
export const folders = signal<Folder[]>([]);

// --- Environment Management ---
export const environments = signal<Environment[]>([]);
export const activeEnvironmentId = signal<string | null>(null);

// --- External Mocks ---
export const externalMocks = signal<ExternalMock[]>([]);

export function createExternalMock(name: string = "New External Mock") {
    const newMock: ExternalMock = {
        id: crypto.randomUUID(),
        name,
        port: 3000,
        endpoints: [],
        serverStatus: 'stopped'
    };
    externalMocks.value = [...externalMocks.peek(), newMock];
    return newMock;
}

export function deleteExternalMock(id: string) {
    batch(() => {
        externalMocks.value = externalMocks.peek().filter(m => m.id !== id);
        openTabs.value = openTabs.peek().filter(t => t.id !== id);
        if (activeTabId.peek() === id) activeTabId.value = openTabs.peek()[0]?.id || null;
    });
}

// --- Functions (Helpers) ---
export function createNewRequest(name: string, collectionId: string, parentId: string | null = null): RequestItem {
    return {
        id: crypto.randomUUID(),
        collectionId,
        parentId,
        name,
        method: 'GET',
        url: 'https://api.example.com',
        headers: [],
        bodyType: 'none',
        body: '',
        preScripts: [],
        postScripts: [],
        auth: { type: 'inherit' },
        sortIndex: 0
    };
}

export function createNewFolder(name: string, collectionId: string, parentId: string | null = null): Folder {
    return {
        id: crypto.randomUUID(),
        collectionId,
        parentId,
        name,
        auth: { type: 'inherit' },
        variables: {},
        headers: [],
        collapsed: false,
        sortIndex: 0
    };
}

export function findRequest(id: string) {
    return requests.value.find(r => r.id === id);
}

export function findFolder(id: string) {
    return folders.value.find(f => f.id === id);
}

export function getProjectStructure(collectionId: string) {
    return {
        requests: requests.value.filter(r => r.collectionId === collectionId),
        folders: folders.value.filter(f => f.collectionId === collectionId)
    };
}

// --- Navigation Helpers ---

export function navigateToItem(id: string) {
    const req = findRequest(id);
    const folder = findFolder(id);

    batch(() => {
        if (req) {
            activeRequestId.value = id;
            activeTabId.value = id;
            if (!openTabs.value.find(t => t.id === id)) {
                openTabs.value = [...openTabs.value, { id, type: 'request', name: req.name }];
            }
        } else if (folder) {
            activeFolderId.value = id;
            activeTabId.value = id;
            if (!openTabs.value.find(t => t.id === id)) {
                openTabs.value = [...openTabs.value, { id, type: 'folder', name: folder.name }];
            }
        }
    });
}

// --- Inheritance Resolution ---

export function resolveAuth(parentId: string | null): { config: AuthConfig, source: string, sourceId?: string } | undefined {
    let currentId = parentId;
    while (currentId) {
        const folder = findFolder(currentId);
        if (folder && folder.auth && folder.auth.type !== 'inherit') {
            return { config: folder.auth, source: folder.name, sourceId: folder.id };
        }
        currentId = folder?.parentId || null;
    }
    return undefined;
}

export function resolveHeaders(parentId: string | null): InheritedRow[] {
    const headers: InheritedRow[] = [];
    let currentId = parentId;
    while (currentId) {
        const folder = findFolder(currentId);
        if (folder && folder.headers) {
            folder.headers.forEach(h => {
                if (!headers.find(xh => xh.key === h.key)) {
                    headers.push({ ...h, source: folder.name, sourceId: folder.id });
                }
            });
        }
        currentId = folder?.parentId || null;
    }
    return headers;
}

export function deleteItem(id: string, type: 'request' | 'folder' | 'collection') {
    batch(() => {
        if (type === 'request') {
            requests.value = requests.value.filter(r => r.id !== id);
            if (activeRequestId.value === id) activeRequestId.value = null;
        } else if (type === 'folder') {
            const folderIds = new Set([id]);
            let added = true;
            while (added) {
                added = false;
                folders.value.forEach(f => {
                    if (f.parentId && folderIds.has(f.parentId) && !folderIds.has(f.id)) {
                        folderIds.add(f.id);
                        added = true;
                    }
                });
            }
            requests.value = requests.value.filter(r => !r.parentId || !folderIds.has(r.parentId));
            folders.value = folders.value.filter(f => !folderIds.has(f.id));
            if (activeFolderId.value && folderIds.has(activeFolderId.value)) activeFolderId.value = null;
        } else if (type === 'collection') {
            const collection = collections.value.find(c => c.id === id);
            if (collection) {
                requests.value = requests.value.filter(r => r.collectionId !== id);
                folders.value = folders.value.filter(f => f.collectionId !== id);
                collections.value = collections.value.filter(c => c.id !== id);
            }
        }
        
        // Remove from tabs
        openTabs.value = openTabs.value.filter(t => t.id !== id);
        if (activeTabId.value === id) activeTabId.value = openTabs.value[0]?.id || null;
    });
}

export function moveSidebarItem(id: string, type: 'request' | 'folder', targetId: string, targetType: 'request' | 'folder' | 'collection', position: 'before' | 'after' | 'inside') {
    batch(() => {
        const allRequests = [...requests.peek()];
        const allFolders = [...folders.peek()];

        let item: RequestItem | Folder | undefined;
        if (type === 'request') item = allRequests.find(r => r.id === id);
        else item = allFolders.find(f => f.id === id);

        if (!item) return;

        let newCollectionId = item.collectionId;
        let newParentId: string | null = item.parentId || null;

        if (targetType === 'collection') {
            newCollectionId = targetId;
            newParentId = null;
        } else {
            const target = targetType === 'request' 
                ? allRequests.find(r => r.id === targetId)
                : allFolders.find(f => f.id === targetId);
            
            if (!target) return;

            newCollectionId = target.collectionId;
            if (position === 'inside') {
                if (targetType === 'folder') newParentId = targetId;
                else return; // Cannot move inside a request
            } else {
                newParentId = target.parentId || null;
            }
        }

        // Prevent moving a folder inside itself or its children
        if (type === 'folder') {
            let curr = newParentId;
            while (curr) {
                if (curr === id) return;
                curr = allFolders.find(f => f.id === curr)?.parentId || null;
            }
        }

        // Update the item
        if (type === 'request') {
            requests.value = allRequests.map(r => r.id === id ? { ...r, collectionId: newCollectionId, parentId: newParentId } : r);
        } else {
            folders.value = allFolders.map(f => f.id === id ? { ...f, collectionId: newCollectionId, parentId: newParentId } : f);
        }
    });
}
