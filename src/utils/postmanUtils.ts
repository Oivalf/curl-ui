import { CollectionData, RequestItem, AuthConfig, Environment } from '../store';

// --- Export Functions ---

export function exportToPostman(data: CollectionData): any {
    const collection = {
        info: {
            name: data.name,
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        item: buildItems(data, null)
    };

    return collection;
}

function buildItems(data: CollectionData, parentId: string | null | undefined): any[] {
    const items: any[] = [];

    // Add folders
    const subFolders = data.folders.filter(f => f.parentId === parentId);
    for (const folder of subFolders) {
        items.push({
            name: folder.name,
            item: buildItems(data, folder.id)
        });
    }

    // Add requests
    const subRequests = data.requests.filter(r => r.parentId === parentId);
    for (const req of subRequests) {
        items.push(mapRequestToPostman(req));
    }

    return items;
}

function mapRequestToPostman(req: RequestItem): any {
    return {
        name: req.name,
        request: {
            method: req.method,
            header: mapHeadersToPostman(req.headers),
            body: mapBodyToPostman(req),
            url: mapUrlToPostman(req.url),
            auth: mapAuthToPostman(req.auth)
        }
    };
}

function mapHeadersToPostman(headers: { key: string, values: string[] }[]): any[] {
    const result: any[] = [];
    for (const h of headers) {
        for (const v of h.values) {
            result.push({
                key: h.key,
                value: v
            });
        }
    }
    return result;
}

function mapUrlToPostman(urlString: string): any {
    if (!urlString) return { raw: "", protocol: "", host: [], path: [] };

    let protocol = "";
    let host: string[] = [];
    let path: string[] = [];
    let query: any[] = [];

    try {
        const url = new URL(urlString);
        protocol = url.protocol.replace(':', '');
        host = url.hostname.split('.');
        path = url.pathname.split('/').filter(p => p !== '');
        
        url.searchParams.forEach((value, key) => {
            query.push({ key, value });
        });
    } catch (e) {
        return { raw: urlString };
    }

    return {
        raw: urlString,
        protocol,
        host,
        path,
        query
    };
}

function mapBodyToPostman(req: RequestItem): any {
    if (!req.bodyType || req.bodyType === 'none') return undefined;

    const body: any = { mode: "" };

    if (req.bodyType === 'multipart') {
        body.mode = 'formdata';
        body.formdata = (req.formData || []).map(item => {
            const entry: any = {
                key: item.key,
                type: item.type === 'file' ? 'file' : 'text'
            };
            if (item.type === 'file') {
                entry.src = item.values[0] || "";
            } else {
                entry.value = item.values[0] || "";
            }
            if (item.contentTypes?.[0]) {
                entry.contentType = item.contentTypes[0];
            }
            return entry;
        });
    } else if (req.bodyType === 'form_urlencoded') {
        body.mode = 'urlencoded';
        body.urlencoded = (req.formData || []).map(item => ({
            key: item.key,
            value: item.values[0] || ""
        }));
    } else {
        body.mode = 'raw';
        body.raw = req.body || "";
        body.options = {
            raw: {
                language: mapLanguageToPostman(req.bodyType)
            }
        };
    }

    return body;
}

function mapLanguageToPostman(type: string): string {
    switch (type) {
        case 'json': return 'json';
        case 'xml': return 'xml';
        case 'javascript': return 'javascript';
        case 'html': return 'html';
        default: return 'text';
    }
}

function mapAuthToPostman(auth?: AuthConfig): any {
    if (!auth || auth.type === 'none') return undefined;
    if (auth.type === 'inherit') return { type: "noauth" };

    if (auth.type === 'basic' && auth.basic) {
        return {
            type: 'basic',
            basic: [
                { key: 'username', value: auth.basic.username, type: 'string' },
                { key: 'password', value: auth.basic.password, type: 'string' }
            ]
        };
    }

    if (auth.type === 'bearer' && auth.bearer) {
        return {
            type: 'bearer',
            bearer: [
                { key: 'token', value: auth.bearer.token, type: 'string' }
            ]
        };
    }

    return undefined;
}

// --- Import Functions ---

export interface ParsedRequest {
    name: string;
    method: string;
    url: string;
    headers: { key: string, values: string[] }[];
    bodyType?: RequestItem['bodyType'];
    body?: string;
    formData?: RequestItem['formData'];
    auth?: AuthConfig;
}

export interface ParsedFolder {
    name: string;
    items: (ParsedFolder | ParsedRequest)[];
}

export function parsePostmanCollection(content: string): { name: string, items: (ParsedFolder | ParsedRequest)[] } {
    const json = JSON.parse(content);
    if (!json.info || !json.item) {
        throw new Error("Invalid Postman Collection format.");
    }

    return {
        name: json.info.name,
        items: parseItems(json.item)
    };
}

function parseItems(items: any[]): (ParsedFolder | ParsedRequest)[] {
    const result: (ParsedFolder | ParsedRequest)[] = [];

    for (const item of items) {
        if (item.item) {
            // It's a folder
            result.push({
                name: item.name,
                items: parseItems(item.item)
            });
        } else if (item.request) {
            // It's a request
            result.push(mapRequestFromPostman(item));
        }
    }

    return result;
}

function mapRequestFromPostman(item: any): ParsedRequest {
    const r = item.request;
    const url = typeof r.url === 'string' ? r.url : (r.url?.raw || "");

    const parsed: ParsedRequest = {
        name: item.name,
        method: r.method || "GET",
        url: url,
        headers: mapHeadersFromPostman(r.header || []),
        auth: mapAuthFromPostman(r.auth)
    };

    if (r.body) {
        if (r.body.mode === 'raw') {
            parsed.bodyType = mapLanguageFromPostman(r.body.options?.raw?.language) || 'text';
            parsed.body = r.body.raw;
        } else if (r.body.mode === 'formdata') {
            parsed.bodyType = 'multipart';
            parsed.formData = r.body.formdata.map((fd: any) => ({
                key: fd.key,
                type: fd.type === 'file' ? 'file' : 'text',
                values: [fd.value || fd.src || ""],
                contentTypes: fd.contentType ? [fd.contentType] : undefined
            }));
        } else if (r.body.mode === 'urlencoded') {
            parsed.bodyType = 'form_urlencoded';
            parsed.formData = r.body.urlencoded.map((ue: any) => ({
                key: ue.key,
                type: 'text',
                values: [ue.value || ""],
            }));
        }
    }

    return parsed;
}

function mapHeadersFromPostman(headers: any[]): { key: string, values: string[] }[] {
    const map = new Map<string, string[]>();
    for (const h of headers) {
        if (h.disabled) continue;
        const key = h.key;
        const current = map.get(key) || [];
        current.push(h.value || "");
        map.set(key, current);
    }
    return Array.from(map.entries()).map(([key, values]) => ({ key, values }));
}

function mapLanguageFromPostman(lang?: string): RequestItem['bodyType'] {
    switch (lang) {
        case 'json': return 'json';
        case 'xml': return 'xml';
        case 'javascript': return 'javascript';
        case 'html': return 'html';
        default: return 'text';
    }
}

function mapAuthFromPostman(auth?: any): AuthConfig | undefined {
    if (!auth) return undefined;

    if (auth.type === 'basic') {
        const username = auth.basic.find((p: any) => p.key === 'username')?.value || "";
        const password = auth.basic.find((p: any) => p.key === 'password')?.value || "";
        return { type: 'basic', basic: { username, password } };
    }

    if (auth.type === 'bearer') {
        const token = auth.bearer.find((p: any) => p.key === 'token')?.value || "";
        return { type: 'bearer', bearer: { token } };
    }

    return { type: 'none' };
}

export function parsePostmanEnvironment(content: string): Environment {
    const json = JSON.parse(content);
    if (!json.name || !json.values) {
        throw new Error("Invalid Postman Environment format.");
    }

    return {
        name: json.name,
        variables: json.values
            .filter((v: any) => v.enabled !== false)
            .map((v: any) => ({ key: v.key, value: v.value || "" }))
    };
}

export function exportEnvironmentToPostman(env: Environment): any {
    return {
        name: env.name,
        values: env.variables.map(v => ({
            key: v.key,
            value: v.value,
            enabled: true,
            type: 'text'
        })),
        _postman_variable_scope: "environment",
        _postman_exported_at: new Date().toISOString(),
        _postman_exported_using: "cURL-UI"
    };
}
