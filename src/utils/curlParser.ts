export interface ParsedCurl {
    method: string;
    url: string;
    headers: { key: string, values: string[] }[];
    body: string;
}

export function parseCurl(curlCommand: string): ParsedCurl {
    const args = tokenize(curlCommand);
    const result: ParsedCurl = {
        method: 'GET',
        url: '',
        headers: [],
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
                    const existing = result.headers.find(h => h.key === key);
                    if (existing) {
                        existing.values.push(value);
                    } else {
                        result.headers.push({ key, values: [value] });
                    }
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
                result.headers.push({ key: 'Authorization', values: [`Basic ${auth}`] });
                i += 2;
                continue;
            }
        }

        // Known flags that take a value argument — skip them so the value isn't treated as URL
        const flagsWithValue = new Set([
            '--connect-timeout', '--max-time', '-m', '--retry', '--retry-delay', '--retry-max-time',
            '-o', '--output', '-w', '--write-out', '-e', '--referer', '-A', '--user-agent',
            '--proxy', '-x', '--resolve', '--cert', '--key', '--cacert', '-b', '--cookie',
            '-c', '--cookie-jar', '--interface', '--dns-servers', '--limit-rate', '-T', '--upload-file'
        ]);
        if (flagsWithValue.has(arg)) {
            i += 2; // skip flag + value
            continue;
        }

        // Known boolean flags (no value) — skip them
        const booleanFlags = new Set([
            '--compressed', '-L', '--location', '-k', '--insecure', '-s', '--silent',
            '-S', '--show-error', '-v', '--verbose', '-i', '--include', '-f', '--fail',
            '-N', '--no-buffer', '--raw', '--globoff', '-G', '--get'
        ]);
        if (booleanFlags.has(arg)) {
            i++;
            continue;
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
