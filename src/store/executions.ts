import { signal } from "@preact/signals";
import { ExecutionItem, ExecutionProgressState, UseCase } from "./types";

// --- Executions Management ---
export const executions = signal<ExecutionItem[]>([]);
export const executionProgressMap = signal<Record<string, ExecutionProgressState>>({});

// --- Use Cases & Persistence ---
export const useCases = signal<UseCase[]>([]);
export const useCaseBlackboards = signal<Record<string, Record<string, any>>>({});

// --- Functions (Helpers) ---
export function findExecution(id: string) {
    return executions.value.find(e => e.id === id);
}

export function deleteExecution(id: string) {
    executions.value = executions.value.filter(e => e.id !== id);
}

export function ensureDefaultExecutions(requestIds: string[]) {
    const currentExecutions = executions.peek();
    const newExecutions = [...currentExecutions];
    let changed = false;

    requestIds.forEach(requestId => {
        const hasExec = currentExecutions.some(e => e.requestId === requestId);
        if (!hasExec) {
            const req = (import('./collections') as any).requests.peek().find((r: any) => r.id === requestId);
            newExecutions.push({
                id: crypto.randomUUID(),
                requestId,
                collectionId: req?.collectionId || '',
                name: 'default',
                sortIndex: 0
            });
            changed = true;
        }
    });

    if (changed) {
        executions.value = newExecutions;
    }
}

export function moveExecution(id: string, requestId: string, newIndex: number) {
    const current = executions.peek();
    const filtered = current.filter(e => e.id !== id && e.requestId === requestId);
    const otherReqs = current.filter(e => e.requestId !== requestId);
    const item = current.find(e => e.id === id);
    if (item) {
        filtered.splice(newIndex, 0, item);
        // Update sortIndex for all in this request
        const updated = filtered.map((e, idx) => ({ ...e, sortIndex: idx }));
        executions.value = [...otherReqs, ...updated];
    }
}
