import { signal } from "@preact/signals";
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

// --- Interfaces ---

export interface Collection {
    id: string;
    name: string;
    projectName: string; // Workspace/Project name
    path?: string; // File path if saved
}

export type AuthType = 'none' | 'inherit' | 'basic' | 'bearer';

export interface AuthConfig {
    type: AuthType;
    basic?: { username: string; password: string };
    bearer?: { token: string };
}

export interface ScriptItem {
    id: string;
    name: string;
    content: string;
    enabled: boolean;
    executeOnStatusCodes?: string;
}

export interface RequestItem {
    id: string;
    collectionId: string;
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    preScripts?: ScriptItem[];
    postScripts?: ScriptItem[];
    parentId?: string | null;
    auth?: AuthConfig;
}

export interface Folder {
    id: string;
    collectionId: string;
    name: string;
    parentId?: string | null;
    collapsed?: boolean;
    headers?: Record<string, string>;
    variables?: Record<string, string>;
    auth?: AuthConfig;
}

export interface Environment {
    // collectionId removed
    name: string;
    variables: { key: string, value: string }[];
}

export interface Tab {
    id: string;
    type: 'request' | 'folder';
    name: string;
}

export interface ContextMenuState {
    x: number;
    y: number;
    itemId: string;
    type: 'request' | 'folder' | 'collection';
    collectionId: string;
}

export interface CollectionData {
    id: string;
    name: string;
    projectName: string;
    requests: RequestItem[];
    folders: Folder[];
    environments: Environment[];
}

export interface ConfirmationState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

// --- Signals ---

export const collections = signal<Collection[]>([]);
export const requests = signal<RequestItem[]>([]);
export const folders = signal<Folder[]>([]);
export const environments = signal<Environment[]>([]);

export const activeRequestId = signal<string | null>(null);
export const activeFolderId = signal<string | null>(null);
export const activeEnvironmentName = signal<string | null>(null);
export const activeTabId = signal<string | null>('params'); // params, headers, body, auth, raw, curl

// --- Logging ---

export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'error' | 'warn';
    message: string;
    source: string;
}

export const appLogs = signal<LogEntry[]>([]);
export const isConsoleOpen = signal(false);

export const addLog = (level: 'info' | 'error' | 'warn', message: string, source: string) => {
    const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level,
        message,
        source
    };
    appLogs.value = [...appLogs.value, entry];
};

export const responseData = signal<any | null>(null);
export const contextMenu = signal<ContextMenuState | null>(null);
export const openTabs = signal<Tab[]>([]);

export const confirmationState = signal<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
});

export const isAboutOpen = signal(false);

// Track modified request/folder IDs
export const unsavedItemIds = signal<Set<string>>(new Set());

// --- Initialization ---

// Initialize with a default collection
// Initialize with empty state (user request)
collections.value = [];

// Environments: Global always exists, others are defaults for new projects
environments.value = [
    { name: 'Global', variables: [] },
    { name: 'Local', variables: [] },
    { name: 'Dev', variables: [] },
    { name: 'Test', variables: [] },
    { name: 'Prod', variables: [] }
];
activeEnvironmentName.value = null; // Default to "No Environment"

requests.value = [];
folders.value = [];

// --- Persistence Functions ---

export const saveCollectionToDisk = async (collectionId: string, saveAs: boolean = false, suppressAlert: boolean = false): Promise<{ success: boolean, message: string }> => {
    try {
        const collection = collections.value.find(c => c.id === collectionId);
        if (!collection) return { success: false, message: 'Collection not found' };

        let path: string | null | undefined = collection.path;

        if (!path || saveAs) {
            path = await save({
                defaultPath: collection.path || `${collection.name}.json`,
                filters: [{
                    name: 'Curl UI Collection',
                    extensions: ['json']
                }]
            });
        }

        if (path) {
            // Update collection path
            collections.value = collections.value.map(c =>
                c.id === collectionId ? { ...c, path: path! } : c
            );

            // Save environments separately logic is handled by backend or defined in CollectionsData
            // Here we stick to existing logic of saving all envs in the collection file

            const collectionRequests = requests.value.filter(r => r.collectionId === collectionId);
            const collectionFolders = folders.value.filter(f => f.collectionId === collectionId);

            const data: CollectionData = {
                id: collection.id,
                name: collection.name,
                projectName: collection.projectName,
                requests: collectionRequests,
                folders: collectionFolders,
                environments: environments.value // Save all workspace environments
            };

            await invoke('save_workspace', { path, data: JSON.stringify(data, null, 2) });

            // Clear dirty state for saved requests and folders
            const newUnsaved = new Set(unsavedItemIds.value);
            collectionRequests.forEach(r => newUnsaved.delete(r.id));
            collectionFolders.forEach(f => newUnsaved.delete(f.id));
            unsavedItemIds.value = newUnsaved;

            const msg = `Collection "${collection.name}" saved!`;
            if (!suppressAlert) alert(msg);
            return { success: true, message: msg };
        }
        return { success: false, message: 'Save cancelled' };
    } catch (err) {
        console.error('Failed to save collection:', err);
        const errMsg = 'Error saving collection: ' + err;
        if (!suppressAlert) alert(errMsg);
        return { success: false, message: errMsg };
    }
};

export const loadCollectionFromDisk = async () => {
    try {
        const path = await open({
            multiple: false,
            directory: false,
            filters: [{
                name: 'Curl UI Collection',
                extensions: ['json']
            }]
        });

        if (path) {
            const dataStr = await invoke<string>('load_workspace', { path });
            const data: CollectionData = JSON.parse(dataStr);

            const existingIdx = collections.value.findIndex(c => c.id === data.id);
            if (existingIdx !== -1) {
                // Update existing
                const newColls = [...collections.value];
                newColls[existingIdx] = {
                    id: data.id,
                    name: data.name,
                    projectName: data.projectName || "Default Project",
                    path
                };
                collections.value = newColls;

                // Remove old items for this collection before adding new ones
                requests.value = requests.value.filter(r => r.collectionId !== data.id);
                folders.value = folders.value.filter(f => f.collectionId !== data.id);
                // Environments are not filtered/removed as they are not mapped to collection anymore
            } else {
                collections.value = [...collections.value, {
                    id: data.id,
                    name: data.name,
                    projectName: data.projectName || "Default Project",
                    path
                }];
            }

            // Add new items
            requests.value = [...requests.value, ...data.requests];
            folders.value = [...folders.value, ...data.folders];

            // If the loaded file DOES have environments (from older versions or if we decide to change policy),
            // should we load them?
            // If we load them, we push them to global environments.
            const loadedEnvs = data.environments.map((e: any) => ({
                // id and collectionId are ignored/removed
                name: e.name,
                variables: e.variables
            }));

            // Logic:
            // 1. If environment exists (by name), merge variables (loaded vars overwrite existing ones if key matches, or append if new).
            // 2. If environment does not exist, add it.

            const currentEnvs = [...environments.value];

            loadedEnvs.forEach(loadedEnv => {
                const existingEnvIndex = currentEnvs.findIndex(e => e.name === loadedEnv.name);

                if (existingEnvIndex !== -1) {
                    // Merge variables
                    const existingEnv = currentEnvs[existingEnvIndex];
                    const newVariables = [...existingEnv.variables];

                    loadedEnv.variables.forEach((loadedVar: any) => {
                        const existingVarIndex = newVariables.findIndex(v => v.key === loadedVar.key);
                        if (existingVarIndex !== -1) {
                            // Overwrite value
                            newVariables[existingVarIndex] = loadedVar;
                        } else {
                            // Add new variable
                            newVariables.push(loadedVar);
                        }
                    });

                    currentEnvs[existingEnvIndex] = { ...existingEnv, variables: newVariables };
                } else {
                    // Add new environment
                    currentEnvs.push(loadedEnv);
                }
            });

            environments.value = currentEnvs;

            // Clear dirty state for requests and folders that are being overwritten/loaded
            const loadedItemIds = new Set([
                ...data.requests.map(r => r.id),
                ...data.folders.map(f => f.id)
            ]);

            const newUnsaved = new Set(unsavedItemIds.value);
            loadedItemIds.forEach(id => newUnsaved.delete(id));
            unsavedItemIds.value = newUnsaved;

            alert(`Collection "${data.name}" loaded!`);
        }
    } catch (err) {
        console.error('Failed to load collection:', err);
        alert('Error loading collection: ' + err);
    }
};

export const saveActiveItemCollection = async () => {
    // Determine active item (request or folder)
    let itemId = activeTabId.value;
    if (!itemId) return;

    // Find if it's a request or folder
    const req = requests.value.find(r => r.id === itemId);
    const fold = folders.value.find(f => f.id === itemId);

    const collectionId = req?.collectionId || fold?.collectionId;

    if (collectionId) {
        await saveCollectionToDisk(collectionId);
    }
};

export const saveAllCollections = async () => {
    // Identify all collections with dirty items
    const dirtyItemIds = unsavedItemIds.value;
    const dirtyCollectionIds = new Set<string>();

    dirtyItemIds.forEach(id => {
        const req = requests.value.find(r => r.id === id);
        if (req) dirtyCollectionIds.add(req.collectionId);

        const fold = folders.value.find(f => f.id === id);
        if (fold) dirtyCollectionIds.add(fold.collectionId);
    });

    if (dirtyCollectionIds.size === 0) {
        // alert('No changes to save.'); // Optional: maybe too noisy
        return;
    }

    const results: string[] = [];

    // Save each
    for (const colId of dirtyCollectionIds) {
        const result = await saveCollectionToDisk(colId, false, true);
        const collectionName = collections.peek().find(c => c.id === colId)?.name || colId;

        if (result.success) {
            results.push(`✅ ${collectionName}: Saved`);
        } else if (result.message === 'Save cancelled') {
            results.push(`⚠️ ${collectionName}: Cancelled`);
        } else {
            results.push(`❌ ${collectionName}: ${result.message}`);
        }
    }

    if (results.length > 0) {
        alert(`Save All Results:\n\n${results.join('\n')}`);
    }
};

export const resolveAuth = (requestId: string): { config: AuthConfig, source: string, sourceId: string } | undefined => {
    let currentId: string | null | undefined = requestId;
    let isRequest = true;

    while (currentId) {
        let auth: AuthConfig | undefined;
        let parentId: string | undefined | null;
        let name: string = '';
        let id: string = '';

        if (isRequest) {
            const req = requests.peek().find(r => r.id === currentId);
            if (!req) return undefined;
            auth = req.auth;
            parentId = req.parentId;
            name = req.name;
            id = req.id;
            isRequest = false; // Next iterations will be folders
        } else {
            const folder = folders.peek().find(f => f.id === currentId);
            if (!folder) return undefined;
            auth = folder.auth;
            parentId = folder.parentId;
            name = folder.name;
            id = folder.id;
        }

        if (auth && auth.type !== 'inherit') {
            return { config: auth, source: isRequest ? 'Request' : `Folder: ${name}`, sourceId: id };
        }

        currentId = parentId;
    }
    return undefined; // Default to undefined (None) if root is reached and still inherit
};

export const isEnvManagerOpen = signal(false);
export const selectedEnvironmentInManager = signal<string | null>(null);

export const navigateToItem = (id: string) => {
    // Check if it's an environment
    if (id.startsWith('env:')) {
        const envName = id.replace('env:', '');
        // Just open the manager, we don't necessarily select it unless we want to
        // But EnvironmentManager likely uses a separate internal selection state or activeEnvironmentName
        // Let's see EnvironmentManager usage... it has a local useSignal for selection.
        // We probably can't control the internal selection easily without another signal or prop.
        // However, opening the manager is the first step.
        // If we want to Select the environment in the manager, we might need a store signal for "selectedEnvironmentInManager".

        selectedEnvironmentInManager.value = envName;
        isEnvManagerOpen.value = true;
        return;
    }

    // Check if it's a request or folder
    const req = requests.peek().find(r => r.id === id);
    const fold = folders.peek().find(f => f.id === id);

    if (req) {
        activeTabId.value = id;
        activeRequestId.value = id;
        activeFolderId.value = null;

        // Ensure tab is open
        if (!openTabs.peek().find(t => t.id === id)) {
            openTabs.value = [...openTabs.peek(), { id, type: 'request', name: req.name }];
        }
    } else if (fold) {
        activeTabId.value = id;
        activeFolderId.value = id;
        activeRequestId.value = null;

        // Ensure tab is open
        if (!openTabs.peek().find(t => t.id === id)) {
            openTabs.value = [...openTabs.peek(), { id, type: 'folder', name: fold.name }];
        }
    }
};

export const resolveHeaders = (itemId: string): { key: string, value: string, source: string, sourceId: string }[] => {
    const allFolders = folders.peek();
    const allRequests = requests.peek();

    const hierarchy: { id: string, name: string, type: 'folder' | 'request', headers: Record<string, string> }[] = [];

    // 1. Identify item and build hierarchy upwards
    let currentId: string | null | undefined = itemId;
    let isRequest = true;

    // First check if it is a request
    let req = allRequests.find(r => r.id === currentId);
    if (!req) {
        // Only folders?
        isRequest = false;
        // Verify it is a folder
        if (!allFolders.find(f => f.id === currentId)) return [];
    }

    while (currentId) {
        if (isRequest) {
            const r = allRequests.find(x => x.id === currentId);
            if (r) {
                hierarchy.unshift({ id: r.id, name: r.name, type: 'request', headers: r.headers });
                currentId = r.parentId;
                isRequest = false;
            } else {
                break;
            }
        } else {
            const f = allFolders.find(x => x.id === currentId);
            if (f) {
                hierarchy.unshift({ id: f.id, name: f.name, type: 'folder', headers: f.headers || {} });
                currentId = f.parentId;
            } else {
                break;
            }
        }
    }

    // 2. Merge headers (Top-down: Root -> Child)
    const headerMap = new Map<string, { value: string, source: string, sourceId: string }>();

    hierarchy.forEach(item => {
        Object.entries(item.headers).forEach(([key, value]) => {
            headerMap.set(key, {
                value,
                source: item.type === 'request' ? 'Request' : `Folder: ${item.name}`,
                sourceId: item.id
            });
        });
    });

    return Array.from(headerMap.entries()).map(([key, data]) => ({
        key,
        value: data.value,
        source: data.source,
        sourceId: data.sourceId
    })).sort((a, b) => a.key.localeCompare(b.key));
};
