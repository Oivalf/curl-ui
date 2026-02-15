import { addLog } from '../store';
import { listen } from '@tauri-apps/api/event';

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

export function initConsoleRedirect() {
    console.log = (...args: any[]) => {
        originalLog(...args);
        addLog('info', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'System');
    };

    console.warn = (...args: any[]) => {
        originalWarn(...args);
        addLog('warn', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'System');
    };

    console.error = (...args: any[]) => {
        originalError(...args);
        addLog('error', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'System');
    };

    console.info = (...args: any[]) => {
        originalInfo(...args);
        addLog('info', args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '), 'System');
    };

    // Listen for Rust-side log events
    listen<{ level: string; message: string }>('rust-log', (event) => {
        const { level, message } = event.payload;
        const logLevel = (level === 'warn' || level === 'error') ? level : 'info';
        addLog(logLevel, message, 'Rust');
    });
}
