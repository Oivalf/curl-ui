export function OverrideIndicator() {
    return (
        <div
            title="This value overrides the default template request"
            style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#2563eb',
                display: 'inline-block',
                flexShrink: 0,
                alignSelf: 'center',
                boxShadow: '0 0 6px #2563eb',
                cursor: 'help'
            }}
        />
    );
}
