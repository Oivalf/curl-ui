import { signal } from "@preact/signals";

export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'error' | 'warn';
    message: string;
    source: string;
}

export const appLogs = signal<LogEntry[]>([]);
export const isConsoleOpen = signal(false);

export const addLog = (level: 'info' | 'error' | 'warn', message: string, source: string) => {
    const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level,
        message,
        source
    };
    appLogs.value = [...appLogs.value, entry];
};
