interface RequestCurlViewProps {
    curlCommand: string;
}

export function RequestCurlView({ curlCommand }: RequestCurlViewProps) {
    return (
        <div style={{
            flex: 1,
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--spacing-sm)',
            overflow: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
            color: 'var(--text-secondary)'
        }}>
            {curlCommand}
        </div>
    );
}
