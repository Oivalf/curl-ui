import { useEffect, useRef } from 'preact/hooks';
import { appLogs } from '../store';
import { Trash2, X } from 'lucide-preact';
import { isConsoleOpen } from '../store';

export function ConsolePanel() {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [appLogs.value.length, isConsoleOpen.value]);

    const clearLogs = () => {
        appLogs.value = [];
    };

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    if (!isConsoleOpen.value) return null;

    return (
        <div style={{
            height: '200px', // Fixed height for now, could be resizable
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-console)', // Need to define or use dark bg
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 8px', borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)'
            }}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>Console</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={clearLogs} title="Clear Console" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={14} />
                    </button>
                    <button onClick={() => isConsoleOpen.value = false} title="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Logs */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
                {appLogs.value.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px' }}>No logs yet...</div>
                )}
                {appLogs.value.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '8px', padding: '2px 0', borderBottom: '1px solid #ffffff0d' }}>
                        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>[{formatTime(log.timestamp)}]</span>
                        <span style={{
                            color: log.level === 'error' ? 'var(--error)' : log.level === 'warn' ? 'var(--warning)' : 'var(--text-success)',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            minWidth: '40px'
                        }}>
                            {log.level}
                        </span>
                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {log.message}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.7 }}>
                            ({log.source})
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
