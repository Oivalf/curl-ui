import { computed } from "@preact/signals";
import { environments, folders } from "./collections";
import { activeEnvName } from "./uiState";
import { addLog } from "./logging";

export interface VariableInfo {
    name: string;
    source: string;
}

export const getScopedVariables = (parentId?: string | null): VariableInfo[] => {
    const varsMap = new Map<string, string>(); // name -> source

    // 1. Global
    const globalEnv = environments.value.find(e => e.name === 'Global');
    if (globalEnv) {
        globalEnv.variables.forEach(v => {
            if (v.key) varsMap.set(v.key, 'Global');
        });
    }

    // 2. Active Environment
    const activeEnv = environments.value.find(e => e.name === activeEnvName.value);
    if (activeEnv && activeEnv.name !== 'Global') {
        activeEnv.variables.forEach(v => {
            if (v.key) varsMap.set(v.key, `Env: ${activeEnv.name || 'Environment'}`);
        });
    }

    // 3. Parent Hierarchy
    let currentId = parentId;
    while (currentId) {
        const folder = folders.value.find(f => f.id === currentId);
        if (folder) {
            if (folder.variables) {
                Object.keys(folder.variables).forEach(k => {
                    varsMap.set(k, `Folder: ${folder.name || 'Folder'}`);
                });
            }
            currentId = folder.parentId;
        } else {
            break;
        }
    }

    return Array.from(varsMap.entries())
        .map(([name, source]) => ({ name, source }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const resolveVariables = (parentId: string | null, sessionVars: Record<string, string> = {}): Record<string, string> => {
    const vars: Record<string, string> = {};

    // 1. Global
    const globalEnv = environments.value.find(e => e.name === 'Global');
    if (globalEnv) {
        globalEnv.variables.forEach(v => {
            if (v.key) vars[v.key] = v.value;
        });
    }

    // 2. Active Environment
    const activeEnv = environments.value.find(e => e.name === activeEnvName.value);
    if (activeEnv && activeEnv.name !== 'Global') {
        activeEnv.variables.forEach(v => {
            if (v.key) vars[v.key] = v.value;
        });
    }

    // 3. Parent Hierarchy
    let currentId = parentId;
    while (currentId) {
        const folder = folders.value.find(f => f.id === currentId);
        if (folder) {
            if (folder.variables) {
                Object.entries(folder.variables as Record<string, string>).forEach(([k, v]) => {
                    vars[k] = v;
                });
            }
            currentId = folder.parentId as string | null;
        } else {
            break;
        }
    }

    // 4. Session Variables (highest priority)
    Object.entries(sessionVars as Record<string, string>).forEach(([k, v]) => {
        vars[k] = v;
    });

    return vars;
};

export const substituteVariables = (text: string | null | undefined, variableMap: Record<string, string>, maxDepth: number = 10): string => {
    if (!text) return '';
    
    let result = text;
    let iterations = 0;
    
    while (result.includes('{{') && iterations < maxDepth) {
        const placeholders = Array.from(new Set(result.match(/{{\s*[\S]+?\s*}}/g) || []));
        if (placeholders.length === 0) break;
        
        let passResolved = false;
        placeholders.forEach(placeholder => {
            const key = placeholder.slice(2, -2).trim();
            const value = variableMap[key];
            if (value !== undefined) {
                const nextResult = result.split(placeholder).join(value);
                if (nextResult !== result) {
                    result = nextResult;
                    passResolved = true;
                }
            }
        });
        
        if (!passResolved) break;
        iterations++;
    }

    if (iterations >= maxDepth && result.includes('{{')) {
        addLog('warn', `Circular dependency or too many nested variables detected: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`, 'Variable Resolver');
    }

    return result;
};

export const allVariableNames = computed(() => getScopedVariables(null));
