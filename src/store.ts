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

export interface RequestItem {
    id: string;
    collectionId: string;
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    parentId?: string | null;
}

export interface Folder {
    id: string;
    collectionId: string;
    name: string;
    parentId?: string | null;
    collapsed?: boolean;
    headers?: Record<string, string>;
    variables?: Record<string, string>;
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
export const activeTabId = signal<string | null>('params'); // params, headers, body, auth

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

// --- Initialization ---

// Initialize with a default collection
// Initialize with empty state (user request)
collections.value = [];

// Environments: Global always exists? Or maybe empty?
// Application usually assumes at least one environment or handles empty.
// Let's keep Global for now as it is "Workspace" level.
environments.value = [
    { name: 'Global', variables: [] }
];
activeEnvironmentName.value = 'Global';

requests.value = [];
folders.value = [];

// --- Persistence Functions ---

export const saveCollectionToDisk = async (collectionId: string) => {
    try {
        const collection = collections.value.find(c => c.id === collectionId);
        if (!collection) return;

        const path = await save({
            defaultPath: collection.path || `${collection.name}.json`,
            filters: [{
                name: 'Curl UI Collection',
                extensions: ['json']
            }]
        });

        if (path) {
            // Update collection path
            collections.value = collections.value.map(c =>
                c.id === collectionId ? { ...c, path } : c
            );

            // Since environments are now global (no collectionId), we strictly probably shouln't save them 
            // with a specific collection unless the user intends "save workspace".
            // However, existing CollectionData interface expects them.
            // We will save an empty array for now to avoid duplications or ambiguity,
            // OR we save ALL environments? 
            // Given the user removed the link, let's assume environments are separate.
            // We will save NO environments in the collection file.

            const data: CollectionData = {
                id: collection.id,
                name: collection.name,
                projectName: collection.projectName,
                requests: requests.value.filter(r => r.collectionId === collectionId),
                folders: folders.value.filter(f => f.collectionId === collectionId),
                environments: environments.value // Save all workspace environments
            };

            await invoke('save_workspace', { path, data: JSON.stringify(data, null, 2) });
            alert(`Collection "${collection.name}" saved!`);
        }
    } catch (err) {
        console.error('Failed to save collection:', err);
        alert('Error saving collection: ' + err);
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

            alert(`Collection "${data.name}" loaded!`);
        }
    } catch (err) {
        console.error('Failed to load collection:', err);
        alert('Error loading collection: ' + err);
    }
};
