import { batch } from "@preact/signals";
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { CollectionData } from "./types";
import { collections, requests, folders, environments, externalMocks } from "./collections";
import { executions, useCases } from "./executions";
import { 
    activeProjectName, 
    activeTabId, 
    activeRequestId,
    openTabs, 
    itemRequestTabStates, 
    itemScriptTabStates, 
    itemResponseTabStates, 
    isExternalMocksExpanded, 
    expandedCollectionIds, 
    expandedFolderIds,
    unsavedItemIds,
} from "./uiState";

// --- Functions ---

export const syncProjectManifest = async (projectName: string) => {
    try {
        const projectCollections = collections.value.filter(c => c.path);
        const paths = projectCollections.map(c => c.path!);

        if (paths.length > 0 || useCases.value.length > 0) {
            await invoke('sync_project_manifest', {
                name: projectName,
                collectionPaths: paths,
                externalMockPaths: [], 
                useCases: useCases.value.map(u => ({
                    id: u.id,
                    name: u.name,
                    variables: u.variables || {},
                    steps: u.steps.map(s => ({
                        id: s.id,
                        execution_id: s.executionId,
                        extraction_rules: s.extractionRules.map((er: any) => ({
                            source: er.source,
                            json_path: er.jsonPath,
                            regex: er.regex,
                            variable_name: er.variableName
                        })),
                        success_codes: s.successCodes,
                        script: s.script
                    }))
                })),
                openTabs: openTabs.peek(),
                activeTabId: activeTabId.peek(),
                itemRequestTabStates: itemRequestTabStates.peek(),
                itemScriptTabStates: itemScriptTabStates.peek(),
                itemResponseTabStates: itemResponseTabStates.peek(),
                isExternalMocksExpanded: isExternalMocksExpanded.peek(),
                expandedCollectionIds: expandedCollectionIds.peek(),
                expandedFolderIds: expandedFolderIds.peek()
            });
        }
    } catch (err) {
        console.error('Failed to sync project manifest:', err);
    }
};

export const openProject = async (name: string) => {
    try {
        const manifest = await invoke<any>('get_project_manifest', { name });
        activeProjectName.value = manifest.name;

        batch(() => {
            collections.value = [];
            requests.value = [];
            folders.value = [];
            executions.value = [];
            openTabs.value = manifest.open_tabs || [];
            activeTabId.value = manifest.active_tab_id || null;
            
            itemRequestTabStates.value = manifest.item_request_tab_states || {};
            itemScriptTabStates.value = manifest.item_script_tab_states || {};
            itemResponseTabStates.value = manifest.item_response_tab_states || {};
            isExternalMocksExpanded.value = manifest.is_external_mocks_expanded || false;
            expandedCollectionIds.value = manifest.expanded_collection_ids || [];
            expandedFolderIds.value = manifest.expanded_folder_ids || [];
            
            useCases.value = (manifest.use_cases || []).map((u: any) => ({
                id: u.id,
                name: u.name,
                variables: u.variables || {},
                steps: (u.steps || []).map((s: any) => ({
                    id: s.id,
                    executionId: s.execution_id || s.executionId,
                    extractionRules: (s.extraction_rules || s.extractionRules || []).map((er: any) => ({
                        source: er.source,
                        jsonPath: er.json_path || er.jsonPath,
                        regex: er.regex,
                        variableName: er.variable_name || er.variableName
                    })),
                    successCodes: s.success_codes || s.successCodes || "2xx",
                    script: s.script || ""
                }))
            }));
        });

        for (const path of manifest.collections) {
            await loadCollectionFromPath(path);
        }
    } catch (err) {
        console.error('Failed to open project:', err);
    }
};

export const loadCollectionFromPath = async (path: string) => {
    const dataStr = await invoke<string>('load_workspace', { path });
    const data: CollectionData = JSON.parse(dataStr);

    batch(() => {
        const existingIdx = collections.value.findIndex(c => c.id === data.id);
        if (existingIdx !== -1) {
            const newColls = [...collections.value];
            newColls[existingIdx] = { id: data.id, name: data.name, path };
            collections.value = newColls;

            requests.value = requests.value.filter(r => r.collectionId !== data.id);
            folders.value = folders.value.filter(f => f.collectionId !== data.id);
            executions.value = executions.value.filter(e => e.collectionId !== data.id);
        } else {
            collections.value = [...collections.value, { id: data.id, name: data.name, path }];
        }

        requests.value = [...requests.value, ...data.requests];
        folders.value = [...folders.value, ...data.folders];
        executions.value = [...executions.value, ...data.executions];
        
        if (data.environments) {
            environments.value = data.environments;
        }
    });

    const loadedItemIds = new Set([
        ...data.requests.map(r => r.id),
        ...data.folders.map(f => f.id),
        ...data.executions.map(e => e.id)
    ]);
    const newUnsaved = new Set(unsavedItemIds.peek());
    loadedItemIds.forEach(id => newUnsaved.delete(id));
    unsavedItemIds.value = newUnsaved;
};

export const loadExternalMockFromDisk = async () => {
    try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const path = await open({
            multiple: false,
            filters: [{ name: 'External Mock', extensions: ['mock.json', 'json'] }]
        });
        if (path && typeof path === 'string') {
            const dataStr = await invoke<string>('load_workspace', { path });
            const data = JSON.parse(dataStr);
            batch(() => {
                const existingIdx = externalMocks.peek().findIndex(m => m.id === data.id);
                if (existingIdx !== -1) {
                    const newMocks = [...externalMocks.peek()];
                    newMocks[existingIdx] = { ...data, path };
                    externalMocks.value = newMocks;
                } else {
                    externalMocks.value = [...externalMocks.peek(), { ...data, path }];
                }
            });
        }
    } catch (err) {
        console.error('Failed to load external mock:', err);
    }
};

export const saveExternalMockToDisk = async (id: string, saveAs: boolean = false, autoSave: boolean = false) => {
    try {
        const mock = externalMocks.peek().find(m => m.id === id);
        if (!mock) return;

        let path = mock.path;
        if ((!path || saveAs) && !autoSave) {
            const { save } = await import('@tauri-apps/plugin-dialog');
            path = (await save({
                defaultPath: `${mock.name}.mock.json`,
                filters: [{ name: 'External Mock', extensions: ['mock.json', 'json'] }]
            })) as string | undefined;
        }

        if (path) {
            const dataToSave = { ...mock };
            delete (dataToSave as any).path;
            delete (dataToSave as any).serverStatus;
            
            await invoke('save_workspace', { path, data: JSON.stringify(dataToSave, null, 2) });
            
            externalMocks.value = externalMocks.peek().map(m => m.id === id ? { ...m, path: path! } : m);
        }
    } catch (err) {
        console.error('Failed to save external mock:', err);
    }
};

export const loadCollectionFromDisk = async () => {
    try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const path = await open({
            multiple: false,
            filters: [{ name: 'cURL-UI Collection', extensions: ['collection.json', 'json'] }]
        });
        if (path && typeof path === 'string') {
            await loadCollectionFromPath(path);
        }
    } catch (err) {
        console.error('Failed to load collection from disk:', err);
    }
};

export const saveCollectionToDisk = async (collectionId: string, saveAs: boolean = false): Promise<{ success: boolean, message: string }> => {
    try {
        const collection = collections.value.find(c => c.id === collectionId);
        if (!collection) return { success: false, message: 'Collection not found' };

        let path: string | null | undefined = collection.path;

        if (!path || saveAs) {
            const newPath = await save({
                defaultPath: collection.path || `${collection.name}.collection.json`,
                filters: [{ name: 'cURL-UI Collection', extensions: ['collection.json', 'json'] }]
            });
            if (newPath) path = newPath;
        }

        if (path) {
            const data: CollectionData = {
                id: collection.id,
                name: collection.name,
                requests: requests.value.filter(r => r.collectionId === collectionId),
                folders: folders.value.filter(f => f.collectionId === collectionId),
                executions: executions.value.filter(e => e.collectionId === collectionId),
                environments: environments.value
            };

            await invoke('save_workspace', { path, data: JSON.stringify(data, null, 2) });

            batch(() => {
                collections.value = collections.value.map(c => c.id === collectionId ? { ...c, path: path! } : c);
                const newUnsaved = new Set(unsavedItemIds.peek());
                data.requests.forEach(r => newUnsaved.delete(r.id));
                data.folders.forEach(f => newUnsaved.delete(f.id));
                data.executions.forEach(e => newUnsaved.delete(e.id));
                unsavedItemIds.value = newUnsaved;
            });

            return { success: true, message: `Collection "${collection.name}" saved!` };
        }
        return { success: false, message: 'Save cancelled' };
    } catch (err) {
        console.error('Failed to save collection:', err);
        return { success: false, message: 'Error saving collection: ' + err };
    }
};

export const saveActiveItemCollection = async (saveAs: boolean = false) => {
    const activeReq = requests.peek().find(r => r.id === activeRequestId.peek());
    const activeFolder = folders.peek().find(f => f.id === activeRequestId.peek()); // activeRequestId often holds folder ID too in some contexts
    const collectionId = activeReq?.collectionId || activeFolder?.collectionId;

    if (collectionId) {
        return await saveCollectionToDisk(collectionId, saveAs);
    }
    return { success: false, message: 'No active item found to save' };
};

export const saveAllCollections = async (): Promise<{ success: boolean, results: string[] }> => {
    const results: string[] = [];
    const allCollections = collections.peek();
    
    for (const coll of allCollections) {
        if (coll.path) {
            const res = await saveCollectionToDisk(coll.id);
            if (res.success) results.push(coll.name);
        }
    }
    
    return { success: !!results.length, results };
};
