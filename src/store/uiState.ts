import { signal } from "@preact/signals";
import { Tab, ContextMenuState, ImportModalState, UpdateInfo } from "./types";

// --- Project/Persistence State ---
export const activeProjectName = signal<string>("Default Project");
export const knownProjects = signal<string[]>([]);
export const isInitializing = signal<boolean>(true);

// --- Active IDs ---
export const activeTabId = signal<string | null>(null);
export const activeRequestId = signal<string | null>(null);
export const activeFolderId = signal<string | null>(null);
export const activeExecutionId = signal<string | null>(null);
export const activeCollectionId = signal<string | null>(null);
export const activeExternalMockId = signal<string | null>(null);
export const activeUseCaseId = signal<string | null>(null);
export const activeEnvName = signal<string | 'Global'>('Global');

// --- Layout & Navigation ---
export const sidebarWidth = signal<number>(300);
export const openTabs = signal<Tab[]>([]);
export const contextMenu = signal<ContextMenuState | null>(null);
export const importModal = signal<ImportModalState | null>(null);
export const expandedCollectionIds = signal<string[]>([]);
export const expandedFolderIds = signal<string[]>([]);
export const isExternalMocksExpanded = signal(false);
export const isAboutOpen = signal<boolean>(false);
export const confirmationState = signal<{
    isOpen: boolean,
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>
}>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
});

// --- State Tracking ---
export const unsavedItemIds = signal<Set<string>>(new Set());
export const isProjectModified = signal<boolean>(false);

// --- Component Persistence ---
export const itemRequestTabStates = signal<Record<string, string>>({}); 
export const itemScriptTabStates = signal<Record<string, string>>({});  
export const itemResponseTabStates = signal<Record<string, string>>({}); 
export const requestEditorPanelSizes = signal<Record<string, number>>({}); 

// --- Triggers ---
export const triggerExecutionRun = signal<string | null>(null);

// --- Prompt Logic ---
let resolvePrompt: ((value: string | null) => void) | null = null;
export const promptState = signal<{ isOpen: boolean, title: string, defaultValue: string }>({ isOpen: false, title: '', defaultValue: '' });

export function showPrompt(title: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
        resolvePrompt = resolve;
        promptState.value = { isOpen: true, title, defaultValue };
    });
}

export function handlePromptSubmit(value: string | null) {
    promptState.value = { ...promptState.value, isOpen: false };
    if (resolvePrompt) {
        resolvePrompt(value);
        resolvePrompt = null;
    }
}

// --- About & Updates ---
export const updateInfo = signal<UpdateInfo | null>(null);

// --- Visibility Toggles ---
export const isEnvManagerOpen = signal<boolean>(false);
