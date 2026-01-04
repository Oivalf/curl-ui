import { useSignal, useSignalEffect } from '@preact/signals';
import { invoke } from '@tauri-apps/api/core';
import { Book, ChevronRight } from 'lucide-preact';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Cast to any to avoid Preact/React type conflicts
const Markdown = ReactMarkdown as any;
const BookIcon = Book as any;
const ChevronIcon = ChevronRight as any;

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

    const MarkdownComponents: any = {
        h1: ({ children }: any) => (
            <h1 style={{ color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '24px' }}>
                {children}
            </h1>
        ),
        h2: ({ children }: any) => (
            <h2 style={{ marginTop: '20px', fontSize: '1.4rem' }}>{children}</h2>
        ),
        h3: ({ children }: any) => (
            <h3 style={{ marginTop: '16px', fontSize: '1.1rem' }}>{children}</h3>
        ),
        p: ({ children }: any) => (
            <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>{children}</p>
        ),
        li: ({ children }: any) => (
            <li style={{ marginLeft: '20px', marginBottom: '4px' }}>{children}</li>
        ),
        a: ({ href, children }: any) => {
            if (href && href.endsWith('.md')) {
                const target = href.replace('.md', '');
                return (
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); currentPage.value = target; }}
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}
                    >
                        {children}
                    </a>
                );
            }
            return (
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
                    {children}
                </a>
            );
        },
        table: ({ children }: any) => (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                {children}
            </table>
        ),
        thead: ({ children }: any) => (
            <thead style={{ borderBottom: '2px solid var(--border-color)' }}>
                {children}
            </thead>
        ),
        th: ({ children }: any) => (
            <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>{children}</th>
        ),
        td: ({ children }: any) => (
            <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{children}</td>
        ),
    };

    const navItems = [
        { id: 'index', label: 'Introduction', icon: <BookIcon size={16} /> },
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
                    <BookIcon size={24} /> Guide
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
                        {currentPage.value === item.id && <ChevronIcon size={14} />}
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
                            <Markdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                {content.value}
                            </Markdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
