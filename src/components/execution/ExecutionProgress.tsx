import { useState, useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { Signal } from "@preact/signals";
import { Circle, Loader2, CheckCircle, XCircle } from "lucide-preact";
import { formatBytes } from "../../utils/format";

interface ExecutionProgressProps {
    isLoading: Signal<boolean>;
    executionSteps: Signal<{
        id: string;
        name: string;
        status: 'pending' | 'running' | 'completed' | 'error' | 'canceled';
        message?: string;
        duration?: number;
    }[]>;
    startTime: Signal<number | null>;
    totalExecutionTime: Signal<number | null>;
    lastResponseTime: Signal<number | null>;
    responseSize: Signal<number | null>;
    responseStatus: Signal<number | null>;
    compact?: boolean;
}

export function ExecutionProgress({
    isLoading,
    executionSteps,
    startTime,
    totalExecutionTime,
    lastResponseTime,
    responseSize,
    responseStatus,
    compact = false
}: ExecutionProgressProps) {
    const [now, setNow] = useState(Date.now());
    const [selfCompact, setSelfCompact] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading.value) return;

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 50); // Update every 50ms for smooth ticking

        return () => clearInterval(interval);
    }, [isLoading.value]);

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        // Perform an initial synchronous measurement before paint
        setSelfCompact(containerRef.current.clientWidth < 600);

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // If it's less than 600px wide, use compact mode
                setSelfCompact(entry.contentRect.width < 600);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const isActualCompact = compact || selfCompact;

    return (
        <div ref={containerRef} style={{
            padding: isActualCompact ? '4px 8px' : '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: isActualCompact ? '4px' : '12px',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isActualCompact ? '8px' : '12px' }}>
                    {!isActualCompact && <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Execution Progress</span>}
                    {(totalExecutionTime.value !== null || lastResponseTime.value !== null || isLoading.value) && (
                        <div style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            fontSize: isActualCompact ? '0.7rem' : '0.75rem', 
                            color: 'var(--text-muted)', 
                            backgroundColor: 'var(--bg-base)', 
                            padding: isActualCompact ? '1px 6px' : '2px 8px', 
                            borderRadius: '4px' 
                        }}>
                            {totalExecutionTime.value !== null && (
                                <span>Time: <strong style={{ color: 'var(--text-secondary)' }}>{new Intl.NumberFormat('it-IT').format(totalExecutionTime.value)}ms</strong></span>
                            )}
                            {responseSize.value !== null && (
                                <span>Size: <strong style={{ color: 'var(--success)' }}>{formatBytes(responseSize.value)}</strong></span>
                            )}
                            {responseStatus.value !== null && (
                                <span>Status: <strong style={{
                                    color: responseStatus.value >= 200 && responseStatus.value < 300 ? 'var(--success)' :
                                        responseStatus.value >= 400 ? 'var(--error)' : 'var(--warning)'
                                }}>{responseStatus.value}</strong></span>
                            )}
                            {isLoading.value && totalExecutionTime.value === null && (
                                <span style={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Requesting...
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>
                                        {new Intl.NumberFormat('it-IT').format(Math.max(0, now - (startTime.value || now)))}ms
                                    </span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {isLoading.value && <Loader2 size={isActualCompact ? 12 : 16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
            </div>
            {!isActualCompact && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {executionSteps.value.map(step => (
                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step.status === 'pending' ? 0.3 : 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {step.status === 'pending' && <Circle size={16} style={{ color: 'var(--text-muted)' }} />}
                                    {step.status === 'running' && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
                                    {step.status === 'completed' && <CheckCircle size={16} style={{ color: 'var(--success)' }} />}
                                    {step.status === 'error' && <XCircle size={16} style={{ color: 'var(--error)' }} />}
                                    {step.status === 'canceled' && <XCircle size={16} style={{ color: 'var(--warning)' }} />}
                                    <span style={{ fontSize: '0.85rem', fontWeight: step.status === 'running' ? 'bold' : 'normal' }}>{step.name}</span>
                                    {(step.duration !== undefined || step.status === 'running') && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-base)', padding: '0px 4px', borderRadius: '2px', fontVariantNumeric: 'tabular-nums' }}>
                                            {new Intl.NumberFormat('it-IT').format(step.status === 'running' && step.duration !== undefined
                                                ? Math.max(0, now - step.duration)
                                                : step.duration ?? 0)}ms
                                        </span>
                                    )}
                                </div>
                                {step.message && <span style={{ fontSize: '0.7rem', color: 'var(--error)', marginLeft: '22px' }}>{step.message}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {isActualCompact && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', overflow: 'hidden' }}>
                    {executionSteps.value.map(step => (
                        <div key={step.id} title={step.name} style={{ display: 'flex', alignItems: 'center', opacity: step.status === 'pending' ? 0.3 : 1 }}>
                            {step.status === 'pending' && <Circle size={12} style={{ color: 'var(--text-muted)' }} />}
                            {step.status === 'running' && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
                            {step.status === 'completed' && <CheckCircle size={12} style={{ color: 'var(--success)' }} />}
                            {step.status === 'error' && <XCircle size={12} style={{ color: 'var(--error)' }} />}
                            {step.status === 'canceled' && <XCircle size={12} style={{ color: 'var(--warning)' }} />}
                        </div>
                    ))}
                    {executionSteps.value.find(s => s.status === 'running' || s.status === 'error' || s.status === 'canceled') && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {executionSteps.value.find(s => s.status === 'running')?.name || 
                             executionSteps.value.slice().reverse().find(s => s.status === 'error' || s.status === 'canceled')?.name}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
