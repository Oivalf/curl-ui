import { useSignal, useSignalEffect } from '@preact/signals';
import { invoke } from '@tauri-apps/api/core';
import { Book, ChevronRight } from 'lucide-preact';

export function UserGuideView() {
    const content = useSignal('');
    const isLoading = useSignal(false);
    const currentPage = useSignal('index');

    useSignalEffect(() => {
        isLoading.value = true;
        invoke<string>('get_user_guide_content', { page: currentPage.value })
            .then(res => {
                content.value = res;
                isLoading.value = false;
            })
            .catch(err => {
                content.value = `# Error\n\nFailed to load guide: ${err}`;
                isLoading.value = false;
            });
    });

    const renderMarkdown = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} style={{ color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '24px' }}>{line.slice(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} style={{ marginTop: '20px', fontSize: '1.4rem' }}>{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} style={{ marginTop: '16px', fontSize: '1.1rem' }}>{line.slice(4)}</h3>;
            if (line.startsWith('- ')) return <li key={i} style={{ marginLeft: '20px', marginBottom: '4px' }}>{processInlines(line.slice(2))}</li>;

            if (line.includes('|') && line.trim().startsWith('|')) {
                const cells = line.split('|').filter(c => c.trim().length > 0);
                if (line.includes('---')) return null;
                return (
                    <div key={i} style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
                        {cells.map((cell, ci) => (
                            <div key={ci} style={{ flex: 1, padding: '0 8px' }}>{processInlines(cell.trim())}</div>
                        ))}
                    </div>
                );
            }

            if (line.trim().length === 0) return <br key={i} />;
            return <p key={i} style={{ marginBottom: '12px', lineHeight: '1.6' }}>{processInlines(line)}</p>;
        });
    };

    const processInlines = (text: string) => {
        const parts = [];
        let currentPos = 0;
        const regex = /\[([^\]]+)\]\(([^)]+)\.md\)|(\*\*([^*]+)\*\*)/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > currentPos) {
                parts.push(text.slice(currentPos, match.index));
            }

            if (match[1]) {
                const label = match[1];
                const target = match[2];
                parts.push(
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); currentPage.value = target; }}
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}
                    >
                        {label}
                    </a>
                );
            } else if (match[3]) {
                parts.push(<strong key={match.index}>{match[4]}</strong>);
            }
            currentPos = regex.lastIndex;
        }

        if (currentPos < text.length) {
            parts.push(text.slice(currentPos));
        }

        return parts.length > 0 ? parts : text;
    };

    const navItems = [
        { id: 'index', label: 'Introduction', icon: <Book size={16} /> },
        { id: 'projects', label: 'Projects' },
        { id: 'collections', label: 'Collections' },
        { id: 'requests', label: 'Requests' },
        { id: 'environments', label: 'Environments' },
        { id: 'scripting', label: 'Scripting' },
    ];

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            {/* Sidebar */}
            <div style={{
                width: '240px',
                borderRight: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-sidebar)',
                padding: '24px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}>
                <div style={{ padding: '0 12px 16px', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Book size={24} /> Guide
                </div>
                {navItems.map(item => (
                    <div
                        key={item.id}
                        onClick={() => currentPage.value = item.id}
                        style={{
                            padding: '10px 16px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '0.95rem',
                            backgroundColor: currentPage.value === item.id ? 'rgba(0, 255, 255, 0.15)' : 'transparent',
                            color: currentPage.value === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'all 0.2s',
                            fontWeight: currentPage.value === item.id ? '600' : '400'
                        }}
                    >
                        {currentPage.value === item.id && <ChevronRight size={14} />}
                        {item.label}
                    </div>
                ))}
            </div>

            {/* Content Area */}
            <div style={{
                flex: 1,
                padding: '40px 60px',
                overflowY: 'auto',
                backgroundColor: 'rgba(255, 255, 255, 0.01)'
            }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {isLoading.value ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)' }}>
                            Loading guide...
                        </div>
                    ) : (
                        <div style={{ textAlign: 'left' }}>
                            {renderMarkdown(content.value)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
