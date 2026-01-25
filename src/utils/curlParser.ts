export interface ParsedCurl {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
}

export function parseCurl(curlCommand: string): ParsedCurl {
    const args = tokenize(curlCommand);
    const result: ParsedCurl = {
        method: 'GET',
        url: '',
        headers: {},
        body: ''
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        const nextArg = args[i + 1];

        if (arg === 'curl') {
            i++;
            continue;
        }

        if (arg === '-X' || arg === '--request') {
            if (nextArg) {
                result.method = nextArg.toUpperCase();
                i += 2;
                continue;
            }
        }

        if (arg === '-H' || arg === '--header') {
            if (nextArg) {
                const parts = nextArg.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join(':').trim();
                    result.headers[key] = value;
                }
                i += 2;
                continue;
            }
        }

        if (arg === '-d' || arg === '--data' || arg === '--data-raw' || arg === '--data-binary' || arg === '--data-urlencode') {
            if (nextArg) {
                result.body = result.body ? result.body + '&' + nextArg : nextArg;
                if (result.method === 'GET') result.method = 'POST'; // Default to POST if data is provided
                i += 2;
                continue;
            }
        }

        if (arg === '-u' || arg === '--user') {
            if (nextArg) {
                const auth = btoa(nextArg);
                result.headers['Authorization'] = `Basic ${auth}`;
                i += 2;
                continue;
            }
        }

        // Potential URL (not starting with dash)
        if (!arg.startsWith('-') && !result.url) {
            result.url = arg;
            i++;
            continue;
        }

        i++;
    }

    // Clean up URL if it has quotes (unlikely due to tokenize but safe)
    if (result.url) {
        result.url = result.url.replace(/^['"]|['"]$/g, '');
        // Default to http if no protocol
        if (!result.url.includes('://')) {
            result.url = 'http://' + result.url;
        }
    }

    return result;
}

/**
 * Tokenizes a shell command into arguments, handling quotes and escapes.
 */
function tokenize(input: string): string[] {
    const result: string[] = [];
    let current = '';
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    let escaped = false;

    // Remove line continuations (\)
    const sanitized = input.replace(/\\\n/g, ' ');

    for (let i = 0; i < sanitized.length; i++) {
        const char = sanitized[i];

        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\' && !inSingleQuotes) {
            escaped = true;
            continue;
        }

        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
            continue;
        }

        if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
            continue;
        }

        if (char === ' ' && !inDoubleQuotes && !inSingleQuotes) {
            if (current.length > 0) {
                result.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (current.length > 0) {
        result.push(current);
    }

    return result;
}
