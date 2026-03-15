import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { useSignal } from "@preact/signals";
import { Wand2 } from "lucide-preact";
import * as prettier from "prettier/standalone";
import * as parserBabel from "prettier/plugins/babel";
import * as parserHtml from "prettier/plugins/html";
import * as parserYaml from "prettier/plugins/yaml";
import * as parserEstree from "prettier/plugins/estree";
// @ts-ignore
import * as parserXml from "@prettier/plugin-xml";
import { getScopedVariables } from '../store';

interface CodeEditorProps {
    value: string;
    onChange?: (value: string) => void;
    language?: 'json' | 'yaml' | 'html' | 'xml' | 'javascript' | 'text';
    readOnly?: boolean;
    height?: string;
    style?: React.CSSProperties;
    enableScriptAutocompletion?: boolean;
    parentId?: string | null;
}

const scriptCompletions = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const line = context.state.doc.lineAt(context.pos).text;
    const posInLine = context.pos - context.state.doc.lineAt(context.pos).from;
    const textBefore = line.slice(0, posInLine);

    // Completion for top-level objects
    if (!textBefore.includes('.') || textBefore.endsWith(' ')) {
        return {
            from: word.from,
            options: [
                { label: 'request', type: 'variable', info: 'The request object' },
                { label: 'response', type: 'variable', info: 'The response object (available in post-request scripts)' },
                { label: 'env', type: 'variable', info: 'Environment variables' },
                { label: 'console', type: 'variable', info: 'Console for logging' },
            ]
        };
    }

    // Completion for request object
    if (textBefore.match(/request\.\w*$/)) {
        return {
            from: word.from,
            options: [
                { label: 'method', type: 'property', info: 'HTTP method' },
                { label: 'url', type: 'property', info: 'Request URL' },
                { label: 'body', type: 'property', info: 'Request body' },
                { label: 'headers', type: 'property', info: 'Request headers object' },
                { label: 'queryParams', type: 'property', info: 'Request query parameters object' },
            ]
        };
    }

    // Completion for request.headers
    if (textBefore.match(/request\.headers\.\w*$/)) {
        return {
            from: word.from,
            options: [
                { label: 'get(key)', type: 'method', apply: 'get(', info: 'Get a header value' },
                { label: 'set(key, value)', type: 'method', apply: 'set(', info: 'Set a header value' },
                { label: 'remove(key)', type: 'method', apply: 'remove(', info: 'Remove a header' },
                { label: 'all()', type: 'method', apply: 'all()', info: 'Get all headers' },
            ]
        };
    }

    // Completion for request.queryParams
    if (textBefore.match(/request\.queryParams\.\w*$/)) {
        return {
            from: word.from,
            options: [
                { label: 'get(key)', type: 'method', apply: 'get(', info: 'Get a query param value' },
                { label: 'set(key, value)', type: 'method', apply: 'set(', info: 'Set a query param value' },
                { label: 'add(key, value)', type: 'method', apply: 'add(', info: 'Add a query param value' },
                { label: 'remove(key)', type: 'method', apply: 'remove(', info: 'Remove a query param' },
                { label: 'all()', type: 'method', apply: 'all()', info: 'Get all query params' },
            ]
        };
    }

    // Completion for env object
    if (textBefore.match(/env\.\w*$/)) {
        return {
            from: word.from,
            options: [
                { label: 'get(key)', type: 'method', apply: 'get(', info: 'Get an environment variable' },
                { label: 'set(key, value)', type: 'method', apply: 'set(', info: 'Set an environment variable' },
            ]
        };
    }

    // Completion for response object
    if (textBefore.match(/response\.\w*$/)) {
        return {
            from: word.from,
            options: [
                { label: 'status', type: 'property', info: 'HTTP status code' },
                { label: 'headers', type: 'property', info: 'Response headers' },
                { label: 'body', type: 'property', info: 'Response body' },
                { label: 'json()', type: 'method', apply: 'json()', info: 'Parse response body as JSON' },
            ]
        };
    }

    return null;
};

const variableCompletions = (parentId: string | null) => (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/{{[\w]*$/);
    if (!word) {
        // Also support triggering inside an existing {{ }} block or just after {{
        const before = context.matchBefore(/{{[\w\s]*/);
        if (!before) return null;

        const variables = getScopedVariables(parentId);
        return {
            from: before.to,
            options: variables.map(v => ({
                label: v.name,
                type: 'variable',
                detail: v.source,
                apply: v.name + '}}'
            }))
        };
    }

    const variables = getScopedVariables(parentId);
    return {
        from: word.from + 2,
        options: variables.map(v => ({
            label: v.name,
            type: 'variable',
            detail: v.source,
            apply: v.name + '}}'
        }))
    };
};

export function CodeEditor({ value, onChange, language = 'text', readOnly = false, height = '100%', style, enableScriptAutocompletion = false, parentId = null }: CodeEditorProps) {
    const isFormatting = useSignal(false);
    const extensions = [];

    const handleFormat = async () => {
        if (!onChange || readOnly) return;
        isFormatting.value = true;
        try {
            let parser = "";
            let plugins = [];

            switch (language) {
                case "json":
                    parser = "json";
                    plugins = [parserBabel, parserEstree];
                    break;
                case "javascript":
                    parser = "babel";
                    plugins = [parserBabel, parserEstree];
                    break;
                case "html":
                    parser = "html";
                    plugins = [parserHtml];
                    break;
                case "yaml":
                    parser = "yaml";
                    plugins = [parserYaml];
                    break;
                case "xml":
                    parser = "xml";
                    plugins = [parserXml];
                    break;
                default:
                    isFormatting.value = false;
                    return;
            }

            const formatted = await prettier.format(value, {
                parser,
                plugins: plugins as any,
                semi: true,
                singleQuote: false,
                tabWidth: 4,
                printWidth: 100,
            });

            onChange(formatted);
        } catch (err) {
            console.error("Formatting error:", err);
        } finally {
            isFormatting.value = false;
        }
    };

    if (language === 'json') extensions.push(json());
    if (language === 'yaml') extensions.push(yaml());
    if (language === 'html') extensions.push(html());
    if (language === 'xml') extensions.push(xml());
    const completionSources = [];
    if (!readOnly) {
        completionSources.push(variableCompletions(parentId));
    }
    if (language === 'javascript') {
        extensions.push(javascript());
        if (enableScriptAutocompletion) {
            completionSources.push(scriptCompletions);
        }
    }

    if (completionSources.length > 0) {
        extensions.push(autocompletion({ override: completionSources }));
    }

    return (
        <div style={{ minWidth: 0, ...style, height, borderRadius: 'var(--radius-md)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!readOnly && language !== 'text' && (
                <button
                    onClick={handleFormat}
                    disabled={isFormatting.value}
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '25px', // Avoid overlapping with scrollbar
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 8px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        opacity: isFormatting.value ? 0.6 : 0.8,
                        transition: 'opacity 0.2s, background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = isFormatting.value ? '0.6' : '0.8')}
                    title="Format Code"
                >
                    <Wand2 size={12} className={isFormatting.value ? 'animate-spin' : ''} />
                    {isFormatting.value ? 'Formatting...' : 'Format'}
                </button>
            )}
            <CodeMirror
                value={value}
                height={height}
                theme={vscodeDark}
                extensions={extensions}
                onChange={onChange}
                editable={!readOnly}
                style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: true,
                    dropCursor: true,
                    allowMultipleSelections: true,
                    indentOnInput: true,
                    bracketMatching: true,
                    autocompletion: true,
                    rectangularSelection: true,
                    crosshairCursor: true,
                    highlightSelectionMatches: true,
                    closeBrackets: true,
                    tabSize: 4,
                }}
            />
        </div>
    );
}
