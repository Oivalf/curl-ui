// --- Domain Types ---

export interface TableRow {
    key: string;
    values: string[];
    enabled: boolean;
}

export interface InheritedRow extends TableRow {
    source: string;
    sourceId?: string;
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

export interface MockResponse {
    statusCode: number;
    headers: TableRow[];
    body: string;
    enabled: boolean;
}

export interface ResponseData {
    status: number;
    headers: string[][] | Record<string, any>;
    body: string;
    time?: number;
    size?: number;
    requestRaw?: string;
    requestCurl?: string;
    requestUrl?: string;
    requestMethod?: string;
}

// --- Request/Folders ---

export interface RequestItem {
    id: string;
    collectionId: string;
    name: string;
    method: string;
    url: string;
    headers: TableRow[];
    bodyType?: 'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml';
    body?: string;
    formData?: { key: string, type: 'text' | 'file', values: string[], contentTypes?: string[], enabled: boolean }[];
    preScripts?: ScriptItem[];
    postScripts?: ScriptItem[];
    parentId?: string | null;
    auth?: AuthConfig;
    collapsed?: boolean;
    mockResponse?: MockResponse;
    lastResponse?: ResponseData;
    pathParams?: Record<string, string>;
    sortIndex?: number;
}

export interface Folder {
    id: string;
    collectionId: string;
    name: string;
    parentId?: string | null;
    collapsed?: boolean;
    headers?: TableRow[];
    variables?: Record<string, string>;
    auth?: AuthConfig;
    sortIndex?: number;
}

export interface ExecutionItem {
    id: string;
    requestId: string;
    collectionId: string;
    name: string;
    method?: string;
    url?: string;
    headers?: TableRow[];
    queryParams?: TableRow[];
    pathParams?: Record<string, string>;
    bodyType?: 'none' | 'json' | 'xml' | 'html' | 'form_urlencoded' | 'multipart' | 'text' | 'javascript' | 'yaml';
    body?: string;
    formData?: { key: string, type: 'text' | 'file', values: string[], contentTypes?: string[], enabled: boolean }[];
    auth?: AuthConfig;
    preScripts?: ScriptItem[];
    postScripts?: ScriptItem[];
    lastResponse?: ResponseData;
    resultsVisible?: boolean;
    sortIndex?: number;
}

// --- Environments ---

export interface Environment {
    name: string;
    variables: { key: string, value: string }[];
}

// --- Collections ---

export interface Collection {
    id: string;
    name: string;
    path?: string;
    mockConfig?: {
        port: number;
        enabled: boolean;
    };
}

export interface CollectionData {
    id: string;
    name: string;
    requests: RequestItem[];
    folders: Folder[];
    executions: ExecutionItem[];
    environments: Environment[];
}

// --- External Mocks ---

export interface ExternalMockEndpoint {
    method: string;
    path: string;
    response: {
        statusCode: number;
        headers: TableRow[];
        body: string;
        enabled: boolean;
    };
}

export interface ExternalMock {
    id: string;
    name: string;
    port: number;
    path?: string;
    endpoints: ExternalMockEndpoint[];
    serverStatus: 'running' | 'stopped';
}

// --- Execution & UseCases ---

export interface ExecutionStep {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'error' | 'canceled';
    message?: string;
    duration?: number;
}

export interface ExecutionProgressState {
    isLoading: boolean;
    steps: ExecutionStep[];
    startTime: number | null;
    totalTime: number | null;
    lastResponseTime: number | null;
    responseSize: number | null;
    responseStatus: number | null;
}

export interface ExtractionRule {
    source: string;
    jsonPath?: string;
    regex?: string;
    variableName: string;
}

export interface UseCaseStep {
    id: string;
    executionId: string;
    extractionRules: ExtractionRule[];
    successCodes: string;
    script?: string;
}

export interface UseCase {
    id: string;
    name: string;
    steps: UseCaseStep[];
    variables?: Record<string, string>;
}

// --- UI State ---

export interface Tab {
    id: string;
    type: 'request' | 'folder' | 'execution' | 'collection' | 'external-mock' | 'use-case';
    name: string;
}

export interface ContextMenuState {
    x: number;
    y: number;
    itemId: string;
    type: 'request' | 'folder' | 'collection' | 'execution' | 'tab';
    collectionId: string;
}

export interface UpdateInfo {
    is_available: boolean;
    latest_version: string;
    release_url: string;
}

export interface ImportModalState {
    isOpen: boolean;
    type: 'curl' | 'swagger';
    collectionId: string;
    folderId?: string | null;
    targetType?: 'collection' | 'external-mock' | 'new-external-mock';
    targetId?: string;
}
