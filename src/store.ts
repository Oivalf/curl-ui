import { signal, effect } from "@preact/signals";
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

// --- Interfaces ---

export interface Collection {
    id: string;
    name: string;
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

export interface ExecutionItem {
    id: string;
    requestId: string;        // Parent request ID
    collectionId: string;
    name: string;
    // Override fields (if undefined, inherit from parent request)
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
    auth?: AuthConfig;
    preScripts?: ScriptItem[];
    postScripts?: ScriptItem[];
}

export interface Environment {
    name: string;
    variables: { key: string, value: string }[];
}

export interface Tab {
    id: string;
    type: 'request' | 'folder' | 'execution';
    name: string;
}

export interface ContextMenuState {
    x: number;
    y: number;
    itemId: string;
    type: 'request' | 'folder' | 'collection' | 'execution';
    collectionId: string;
}

export interface CollectionData {
    id: string;
    name: string;
    requests: RequestItem[];
    folders: Folder[];
    executions: ExecutionItem[];
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
export const executions = signal<ExecutionItem[]>([]);
export const environments = signal<Environment[]>([]);

export const activeRequestId = signal<string | null>(null);
export const activeFolderId = signal<string | null>(null);
export const activeExecutionId = signal<string | null>(null);
export const activeEnvironmentName = signal<string | null>(null);
export const activeTabId = signal<string | null>(null);
export const activeProjectName = signal<string>("Default Project");
export const knownProjects = signal<string[]>([]);
export const isInitializing = signal<boolean>(true);

// Initialize activeProjectName from URL search params (set by Sidebar.tsx when opening new window)
const urlParams = new URLSearchParams(window.location.search);
const pName = urlParams.get('projectName');
if (pName) {
    activeProjectName.value = pName;
}

export const loadKnownProjects = async () => {
    try {
        const projects = await invoke<string[]>('list_projects');
        knownProjects.value = projects;

        if (pName) {
            // Project provided in URL (e.g. from Sidebar new window)
            // Check if this project already exists
            if (projects.includes(pName)) {
                await openProject(pName);
            } else {
                // New project - just set the name and enable menu
                activeProjectName.value = pName;
                try {
                    await invoke('enable_window_menu');
                } catch (err) {
                    console.error('Failed to enable menu for new project:', err);
                }
            }
        } else if (projects.length > 0) {
            // Auto-load last modified project
            await openProject(projects[0]);
        } else {
            // First time launch, no projects yet - show WelcomeScreen without menu
        }
    } catch (err) {
        console.error('Failed to list projects:', err);
    } finally {
        isInitializing.value = false;
    }
};

export const updateWindowTitle = async (name: string) => {
    try {
        const title = (name && name !== "Default Project") ? `cURL-UI - ${name}` : 'cURL-UI';
        document.title = title;
        const window = getCurrentWindow();
        await window.setTitle(title);
    } catch (err) {
        console.error('Failed to set window title:', err);
    }
};

// Keep title in sync reactively
effect(() => {
    updateWindowTitle(activeProjectName.value);
});

// Initial load
loadKnownProjects();

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

collections.value = [];
environments.value = [
    { name: 'Global', variables: [] },
    { name: 'Local', variables: [] },
    { name: 'Dev', variables: [] },
    { name: 'Test', variables: [] },
    { name: 'Prod', variables: [] }
];
activeEnvironmentName.value = null;
requests.value = [];
folders.value = [];

export const refreshMenu = async () => {
    try {
        await invoke('refresh_projects_menu');
    } catch (err) {
        console.error('Failed to refresh menu:', err);
    }
};

// --- Persistence Functions ---

export const syncProjectManifest = async (projectName: string) => {
    try {
        const projectCollections = collections.value.filter(c => c.path);
        const paths = projectCollections.map(c => c.path!);
        if (paths.length > 0) {
            await invoke('sync_project_manifest', { name: projectName, collectionPaths: paths });
            await refreshMenu();
        }
    } catch (err) {
        console.error('Failed to sync project manifest:', err);
    }
};

export const openProject = async (name: string) => {
    try {
        const manifest = await invoke<any>('get_project_manifest', { name });
        activeProjectName.value = manifest.name;

        // Clear current state to avoid mixing projects in the same window
        collections.value = [];
        requests.value = [];
        folders.value = [];
        openTabs.value = [];
        activeRequestId.value = null;
        activeFolderId.value = null;

        for (const path of manifest.collections) {
            await loadCollectionFromPath(path);
        }

        // Enable the native menu for this window
        try {
            await invoke('enable_window_menu');
        } catch (err) {
            console.error('Failed to enable menu for project:', name, err);
        }
    } catch (err) {
        console.error('Failed to open project:', err);
    }
};

export const saveCollectionToDisk = async (collectionId: string, saveAs: boolean = false, suppressAlert: boolean = false): Promise<{ success: boolean, message: string }> => {
    try {
        const collection = collections.value.find(c => c.id === collectionId);
        if (!collection) return { success: false, message: 'Collection not found' };

        let path: string | null | undefined = collection.path;

        if (!path || saveAs) {
            path = await save({
                defaultPath: collection.path || `${collection.name}.json`,
                filters: [{
                    name: 'cURL-UI Collection',
                    extensions: ['json']
                }]
            });
        }

        if (path) {
            collections.value = collections.value.map(c =>
                c.id === collectionId ? { ...c, path: path! } : c
            );

            const collectionRequests = requests.value.filter(r => r.collectionId === collectionId);
            const collectionFolders = folders.value.filter(f => f.collectionId === collectionId);
            const collectionExecutions = executions.value.filter(e => e.collectionId === collectionId);

            const data: CollectionData = {
                id: collection.id,
                name: collection.name,
                requests: collectionRequests,
                folders: collectionFolders,
                executions: collectionExecutions,
                environments: environments.value
            };

            await invoke('save_workspace', { path, data: JSON.stringify(data, null, 2) });

            const newUnsaved = new Set(unsavedItemIds.peek());
            collectionRequests.forEach(r => newUnsaved.delete(r.id));
            collectionFolders.forEach(f => newUnsaved.delete(f.id));
            collectionExecutions.forEach(e => newUnsaved.delete(e.id));
            unsavedItemIds.value = newUnsaved;

            // Sync manifest
            await syncProjectManifest(activeProjectName.peek());

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

export const loadCollectionFromPath = async (path: string) => {
    const dataStr = await invoke<string>('load_workspace', { path });
    const data: CollectionData = JSON.parse(dataStr);

    const existingIdx = collections.value.findIndex(c => c.id === data.id);
    if (existingIdx !== -1) {
        const newColls = [...collections.value];
        newColls[existingIdx] = {
            id: data.id,
            name: data.name,
            path
        };
        collections.value = newColls;

        requests.value = requests.value.filter(r => r.collectionId !== data.id);
        folders.value = folders.value.filter(f => f.collectionId !== data.id);
        executions.value = executions.value.filter(e => e.collectionId !== data.id);
    } else {
        collections.value = [...collections.value, {
            id: data.id,
            name: data.name,
            path
        }];
    }

    requests.value = [...requests.value, ...data.requests];
    folders.value = [...folders.value, ...data.folders];
    executions.value = [...executions.value, ...(data.executions || [])];

    if (data.environments) {
        const loadedEnvs = data.environments;
        const currentEnvs = [...environments.peek()];

        loadedEnvs.forEach(loadedEnv => {
            const existingEnvIndex = currentEnvs.findIndex(e => e.name === loadedEnv.name);
            if (existingEnvIndex !== -1) {
                const existingEnv = currentEnvs[existingEnvIndex];
                const newVariables = [...existingEnv.variables];
                loadedEnv.variables.forEach(loadedVar => {
                    const existingVarIndex = newVariables.findIndex(v => v.key === loadedVar.key);
                    if (existingVarIndex !== -1) {
                        newVariables[existingVarIndex] = loadedVar;
                    } else {
                        newVariables.push(loadedVar);
                    }
                });
                currentEnvs[existingEnvIndex] = { ...existingEnv, variables: newVariables };
            } else {
                currentEnvs.push(loadedEnv);
            }
        });
        environments.value = currentEnvs;
    }

    const loadedItemIds = new Set([
        ...data.requests.map(r => r.id),
        ...data.folders.map(f => f.id),
        ...(data.executions || []).map(e => e.id)
    ]);
    const newUnsaved = new Set(unsavedItemIds.peek());
    loadedItemIds.forEach(id => newUnsaved.delete(id));
    unsavedItemIds.value = newUnsaved;

    // Sync manifest
    await syncProjectManifest(activeProjectName.peek());
};

export const loadCollectionFromDisk = async () => {
    try {
        const path = await open({
            multiple: false,
            directory: false,
            filters: [{
                name: 'cURL-UI Collection',
                extensions: ['json']
            }]
        });

        if (path) {
            await loadCollectionFromPath(path);
            const collection = collections.peek().find(c => c.path === path);
            if (collection) {
                alert(`Collection "${collection.name}" loaded!`);
            }
        }
    } catch (err) {
        console.error('Failed to load collection:', err);
        alert('Error loading collection: ' + err);
    }
};

export const saveActiveItemCollection = async () => {
    let itemId = activeRequestId.peek() || activeFolderId.peek();
    if (!itemId) return;

    const req = requests.value.find(r => r.id === itemId);
    const fold = folders.value.find(f => f.id === itemId);
    const collectionId = req?.collectionId || fold?.collectionId;

    if (collectionId) {
        await saveCollectionToDisk(collectionId);
    }
};

export const saveAllCollections = async () => {
    const dirtyItemIds = unsavedItemIds.peek();
    const dirtyCollectionIds = new Set<string>();

    dirtyItemIds.forEach(id => {
        const req = requests.value.find(r => r.id === id);
        if (req) dirtyCollectionIds.add(req.collectionId);
        const fold = folders.value.find(f => f.id === id);
        if (fold) dirtyCollectionIds.add(fold.collectionId);
    });

    if (dirtyCollectionIds.size === 0) return;

    const results: string[] = [];
    for (const colId of dirtyCollectionIds) {
        const result = await saveCollectionToDisk(colId, false, true);
        const collectionName = collections.peek().find(c => c.id === colId)?.name || colId;
        if (result.success) results.push(`✅ ${collectionName}: Saved`);
        else if (result.message === 'Save cancelled') results.push(`⚠️ ${collectionName}: Cancelled`);
        else results.push(`❌ ${collectionName}: ${result.message}`);
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
            isRequest = false;
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
    return undefined;
};

export const isEnvManagerOpen = signal(false);
export const selectedEnvironmentInManager = signal<string | null>(null);

export const navigateToItem = (id: string) => {
    if (id.startsWith('env:')) {
        selectedEnvironmentInManager.value = id.replace('env:', '');
        isEnvManagerOpen.value = true;
        return;
    }

    const req = requests.peek().find(r => r.id === id);
    const fold = folders.peek().find(f => f.id === id);

    if (req) {
        activeRequestId.value = id;
        activeFolderId.value = null;
        if (!openTabs.peek().find(t => t.id === id)) {
            openTabs.value = [...openTabs.peek(), { id, type: 'request', name: req.name }];
        }
    } else if (fold) {
        activeFolderId.value = id;
        activeRequestId.value = null;
        if (!openTabs.peek().find(t => t.id === id)) {
            openTabs.value = [...openTabs.peek(), { id, type: 'folder', name: fold.name }];
        }
    }
};

export const resolveHeaders = (itemId: string): { key: string, value: string, source: string, sourceId: string }[] => {
    const allFolders = folders.peek();
    const allRequests = requests.peek();
    const hierarchy: { id: string, name: string, type: 'folder' | 'request', headers: Record<string, string> }[] = [];

    let currentId: string | null | undefined = itemId;
    let isRequest = true;
    let req = allRequests.find(r => r.id === currentId);
    if (!req) isRequest = false;

    while (currentId) {
        if (isRequest) {
            const r = allRequests.find(x => x.id === currentId);
            if (r) {
                hierarchy.unshift({ id: r.id, name: r.name, type: 'request', headers: r.headers });
                currentId = r.parentId;
                isRequest = false;
            } else break;
        } else {
            const f = allFolders.find(x => x.id === currentId);
            if (f) {
                hierarchy.unshift({ id: f.id, name: f.name, type: 'folder', headers: f.headers || {} });
                currentId = f.parentId;
            } else break;
        }
    }

    const headerMap = new Map<string, { value: string, source: string, sourceId: string }>();
    hierarchy.forEach(item => {
        Object.entries(item.headers).forEach(([key, value]) => {
            headerMap.set(key, { value, source: item.type === 'request' ? 'Request' : `Folder: ${item.name}`, sourceId: item.id });
        });
    });

    return Array.from(headerMap.entries()).map(([key, data]) => ({
        key, value: data.value, source: data.source, sourceId: data.sourceId
    })).sort((a, b) => a.key.localeCompare(b.key));
};
