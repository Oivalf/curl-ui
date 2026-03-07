interface ResponseHeadersTabProps {
    headers: string[][];
}

export function ResponseHeadersTab({ headers }: ResponseHeadersTabProps) {
    return (
        <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Value</th>
                    </tr>
                </thead>
                <tbody>
                    {headers.map(([k, v], i) => (
                        <tr key={i}>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{k}</td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{v}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
