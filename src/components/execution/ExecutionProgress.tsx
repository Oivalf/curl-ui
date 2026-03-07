import { useState, useEffect } from "preact/hooks";
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
    totalExecutionTime: Signal<number | null>;
    lastResponseTime: Signal<number | null>;
    responseSize: Signal<number | null>;
    responseStatus: Signal<number | null>;
}

export function ExecutionProgress({
    isLoading,
    executionSteps,
    totalExecutionTime,
    lastResponseTime,
    responseSize,
    responseStatus
}: ExecutionProgressProps) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!isLoading.value) return;

        const interval = setInterval(() => {
            setNow(Date.now());
        }, 50); // Update every 50ms for smooth ticking

        return () => clearInterval(interval);
    }, [isLoading.value]);
    if (!isLoading.value && executionSteps.value.length === 0) {
        return null;
    }

    return (
        <div style={{
            padding: '12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Execution Progress</span>
                    {(totalExecutionTime.value !== null || lastResponseTime.value !== null) && (
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-base)', padding: '2px 8px', borderRadius: '4px' }}>
                            {totalExecutionTime.value !== null && (
                                <span>Total Time: <strong style={{ color: 'var(--text-secondary)' }}>{new Intl.NumberFormat('it-IT').format(totalExecutionTime.value)}ms</strong></span>
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
                        </div>
                    )}
                </div>
                {isLoading.value && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {executionSteps.value.map(step => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: step.status === 'pending' ? 0.5 : 1 }}>
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
        </div>
    );
}
