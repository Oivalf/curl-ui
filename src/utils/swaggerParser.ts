import yaml from 'js-yaml';

export interface ParsedSwaggerRequest {
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    tags: string[];
}

export interface ParsedSwagger {
    title: string;
    requests: ParsedSwaggerRequest[];
}

export function parseSwagger(content: string): ParsedSwagger {
    let spec: any;
    try {
        spec = yaml.load(content);
    } catch (e) {
        throw new Error("Failed to parse Swagger/OpenAPI content. Ensure it is valid JSON or YAML.");
    }

    if (!spec || (!spec.swagger && !spec.openapi)) {
        throw new Error("Invalid Swagger/OpenAPI specification. Missing 'swagger' or 'openapi' version.");
    }

    const requests: ParsedSwaggerRequest[] = [];
    const baseUrl = getBaseUrl(spec);
    const paths = spec.paths || {};

    for (const path in paths) {
        const methods = paths[path];
        for (const method in methods) {
            // Skip non-HTTP methods like 'parameters' at path level
            if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) {
                continue;
            }

            const op = methods[method];
            const name = op.summary || op.operationId || `${method.toUpperCase()} ${path}`;
            const tags = op.tags || [];

            const headers: Record<string, string> = {};
            let body = '';

            // Extract headers and body (very basic for now)
            if (op.parameters) {
                for (const p of op.parameters) {
                    if (p.in === 'header') {
                        headers[p.name] = p.example || p.default || '';
                    }
                }
            }

            // OpenAPI 3.x requestBody
            if (op.requestBody) {
                const content = op.requestBody.content || {};
                const firstType = Object.keys(content)[0];
                if (firstType === 'application/json') {
                    headers['Content-Type'] = 'application/json';
                    // We could generate an example from schema here, but keep it simple
                    body = '{}';
                }
            } else if (op.parameters) {
                // Swagger 2.0 body
                const bodyParam = op.parameters.find((p: any) => p.in === 'body');
                if (bodyParam) {
                    headers['Content-Type'] = 'application/json';
                    body = '{}';
                }
            }

            requests.push({
                name,
                method: method.toUpperCase(),
                url: baseUrl + path,
                headers,
                body,
                tags
            });
        }
    }

    return {
        title: spec.info?.title || "Imported API",
        requests
    };
}

function getBaseUrl(spec: any): string {
    // OpenAPI 3.x
    if (spec.servers && spec.servers.length > 0) {
        let url = spec.servers[0].url;
        // Basic variable substitution if exists
        if (spec.servers[0].variables) {
            for (const v in spec.servers[0].variables) {
                url = url.replace(`{${v}}`, spec.servers[0].variables[v].default || spec.servers[0].variables[v]);
            }
        }
        return url;
    }

    // Swagger 2.0
    if (spec.host) {
        const protocol = (spec.schemes && spec.schemes[0]) || 'http';
        const basePath = spec.basePath || '';
        return `${protocol}://${spec.host}${basePath}`;
    }

    return 'http://localhost';
}
