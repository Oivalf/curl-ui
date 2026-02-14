import yaml from 'js-yaml';

export interface ParsedSwaggerRequest {
    name: string;
    method: string;
    url: string;
    path: string;
    headers: Record<string, string>;
    body: string;
    responseStatus?: number;
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
                }
            } else if (op.parameters) {
                // Swagger 2.0 body
                const bodyParam = op.parameters.find((p: any) => p.in === 'body');
                if (bodyParam) {
                    headers['Content-Type'] = 'application/json';
                }
            }

            // Try to extract a response body (for mocks)
            let responseBody = '{}';
            let responseStatus = 200;
            if (op.responses) {
                const successCode = Object.keys(op.responses).find(code => code.startsWith('2')) || '200';
                responseStatus = parseInt(successCode) || 200;
                const resp = op.responses[successCode];
                if (resp.content && resp.content['application/json']) {
                    const jsonContent = resp.content['application/json'];
                    if (jsonContent.example) {
                        responseBody = JSON.stringify(jsonContent.example, null, 2);
                    } else if (jsonContent.examples) {
                        const firstExample = Object.values(jsonContent.examples)[0] as any;
                        responseBody = JSON.stringify(firstExample.value || firstExample, null, 2);
                    } else if (jsonContent.schema) {
                        const example = generateExampleFromSchema(jsonContent.schema, spec);
                        responseBody = JSON.stringify(example, null, 2);
                    }
                } else if (resp.examples && resp.examples['application/json']) {
                    // Swagger 2.0 examples
                    responseBody = JSON.stringify(resp.examples['application/json'], null, 2);
                } else if (resp.schema) {
                    // Swagger 2.0 schema
                    const example = generateExampleFromSchema(resp.schema, spec);
                    responseBody = JSON.stringify(example, null, 2);
                }
            }

            requests.push({
                name,
                method: method.toUpperCase(),
                url: baseUrl + path,
                path: path,
                headers,
                body: responseBody,
                responseStatus,
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

function generateExampleFromSchema(schema: any, spec: any): any {
    if (!schema) return null;

    if (schema.$ref) {
        // Simple resolution for #/components/schemas/... or #/definitions/...
        const parts = schema.$ref.split('/');
        let current = spec;
        for (let i = 1; i < parts.length; i++) {
            current = current?.[parts[i]];
        }
        return generateExampleFromSchema(current, spec);
    }

    if (schema.example) return schema.example;
    if (schema.default) return schema.default;

    const type = schema.type;
    switch (type) {
        case 'string':
            return schema.enum ? schema.enum[0] : (schema.format === 'date-time' ? new Date().toISOString() : 'string');
        case 'number':
        case 'integer':
            return 0;
        case 'boolean':
            return true;
        case 'array':
            return [generateExampleFromSchema(schema.items, spec)];
        case 'object':
            const obj: any = {};
            const props = schema.properties || {};
            for (const key in props) {
                obj[key] = generateExampleFromSchema(props[key], spec);
            }
            return obj;
        default:
            // Fallback for when type is missing but properties exist
            if (schema.properties) {
                const obj: any = {};
                for (const key in schema.properties) {
                    obj[key] = generateExampleFromSchema(schema.properties[key], spec);
                }
                return obj;
            }
            return null;
    }
}
