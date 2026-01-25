import { openTabs, activeTabId, requests, folders, executions, activeRequestId, activeFolderId, activeExecutionId, Tab, unsavedItemIds } from "../store";
import { X, FileJson, Folder, ChevronDown, Play, Settings, ServerCog } from 'lucide-preact';
import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

export function TabBar() {
    const isMenuOpen = useSignal(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const closeTab = (id: string, e: MouseEvent) => {
        e.stopPropagation();
        const tabs = openTabs.value;
        const newTabs = tabs.filter(t => t.id !== id);

        if (activeTabId.value === id) {
            // activate neighbor
            const idx = tabs.findIndex(t => t.id === id);
            if (newTabs.length > 0) {
                const newIdx = Math.min(idx, newTabs.length - 1);
                activeTabId.value = newTabs[newIdx].id;

                // Sync legacy stores
                const newTab = newTabs[newIdx];
                if (newTab.type === 'request') {
                    activeRequestId.value = newTab.id;
                    activeFolderId.value = null;
                    activeExecutionId.value = null;
                } else if (newTab.type === 'execution') {
                    activeExecutionId.value = newTab.id;
                    activeRequestId.value = null;
                    activeFolderId.value = null;
                } else {
                    activeFolderId.value = newTab.id;
                    activeRequestId.value = null;
                    activeExecutionId.value = null;
                }
            } else {
                activeTabId.value = null;
                activeRequestId.value = null;
                activeFolderId.value = null;
            }
        }
        openTabs.value = newTabs;
    };

    const activateTab = (tab: Tab) => {
        activeTabId.value = tab.id;
        if (tab.type === 'request') {
            activeRequestId.value = tab.id;
            activeFolderId.value = null;
            activeExecutionId.value = null;
        } else if (tab.type === 'execution') {
            activeExecutionId.value = tab.id;
            activeRequestId.value = null;
            activeFolderId.value = null;
        } else {
            activeFolderId.value = tab.id;
            activeRequestId.value = null;
            activeExecutionId.value = null;
        }
        isMenuOpen.value = false;
    };

    const toggleMenu = (e: MouseEvent) => {
        e.stopPropagation();
        isMenuOpen.value = !isMenuOpen.value;
    };

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                isMenuOpen.value = false;
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Helper to get fresh name
    const getTabName = (tab: Tab) => {
        if (tab.type === 'request') return requests.value.find(r => r.id === tab.id)?.name || tab.name;
        if (tab.type === 'folder') return folders.value.find(f => f.id === tab.id)?.name || tab.name;
        if (tab.type === 'execution') return executions.value.find(e => e.id === tab.id)?.name || tab.name;
        if (tab.type === 'collection') return tab.name;
        return tab.name;
    };

    // Grouping for Menu
    const getGroupedTabs = () => {
        const sorted = [...openTabs.value].sort((a, b) => getTabName(a).localeCompare(getTabName(b)));
        const reqs = sorted.filter(t => t.type === 'request');
        const folds = sorted.filter(t => t.type === 'folder');
        const execs = sorted.filter(t => t.type === 'execution');
        const colls = sorted.filter(t => t.type === 'collection');
        return { reqs, folds, execs, colls };
    };

    const { reqs, folds, execs, colls } = getGroupedTabs();

    if (openTabs.value.length === 0) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', height: '40px' }}>
            {/* Scrollable Tabs */}
            <div style={{ display: 'flex', flex: 1, overflowX: 'auto', height: '100%', scrollbarWidth: 'none' }}>
                {openTabs.value.map(tab => {
                    const isActive = activeTabId.value === tab.id;
                    const freshName = getTabName(tab);

                    return (
                        <div
                            key={tab.id}
                            onClick={() => activateTab(tab)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0 16px',
                                cursor: 'pointer',
                                backgroundColor: isActive ? 'var(--bg-base)' : 'transparent',
                                borderRight: '1px solid var(--border-color)',
                                borderTop: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                minWidth: '120px',
                                maxWidth: '200px',
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                height: '100%'
                            }}
                        >
                            {tab.type === 'request' ? <FileJson size={14} /> : tab.type === 'execution' ? <Play size={14} /> : tab.type === 'collection' ? <ServerCog size={14} /> : <Folder size={14} />}
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, fontSize: '0.9rem' }}>
                                {freshName}
                                {unsavedItemIds.value.has(tab.id) && (
                                    <span style={{ color: 'var(--accent-primary)', marginLeft: '4px', fontSize: '1.2rem', lineHeight: 0 }}>•</span>
                                )}
                            </span>
                            <div
                                onClick={(e) => closeTab(tab.id, e)}
                                style={{ opacity: 0.6, cursor: 'pointer', display: 'flex', padding: '2px' }}
                                title="Close Tab"
                            >
                                <X size={14} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Overflow Menu Button */}
            <div style={{ position: 'relative', height: '100%' }} ref={menuRef}>
                <div
                    onClick={toggleMenu}
                    style={{
                        height: '100%',
                        padding: '0 12px',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderLeft: '1px solid var(--border-color)',
                        backgroundColor: isMenuOpen.value ? 'var(--bg-surface)' : 'transparent',
                        color: 'var(--text-secondary)'
                    }}
                    title="List Open Tabs"
                >
                    <ChevronDown size={16} />
                </div>

                {isMenuOpen.value && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        zIndex: 50,
                        minWidth: '200px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        borderRadius: '0 0 var(--radius-sm) var(--radius-sm)'
                    }}>
                        {folds.length > 0 && (
                            <div>
                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Folders
                                </div>
                                {folds.map(tab => (
                                    <div
                                        key={tab.id}
                                        onClick={() => activateTab(tab)}
                                        style={{
                                            padding: '8px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: activeTabId.value === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            color: activeTabId.value === tab.id ? 'var(--accent-primary)' : 'var(--text-primary)'
                                        }}
                                    >
                                        <Folder size={14} />
                                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getTabName(tab)}</span>
                                        {activeTabId.value === tab.id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                                    </div>
                                ))}
                            </div>
                        )}

                        {folds.length > 0 && reqs.length > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />}

                        {reqs.length > 0 && (
                            <div>
                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Requests
                                </div>
                                {reqs.map(tab => (
                                    <div
                                        key={tab.id}
                                        onClick={() => activateTab(tab)}
                                        style={{
                                            padding: '8px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: activeTabId.value === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            color: activeTabId.value === tab.id ? 'var(--accent-primary)' : 'var(--text-primary)'
                                        }}
                                    >
                                        <FileJson size={14} />
                                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getTabName(tab)}</span>
                                        {activeTabId.value === tab.id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                                    </div>
                                ))}
                            </div>
                        )}

                        {reqs.length > 0 && execs.length > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />}

                        {execs.length > 0 && (
                            <div>
                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Executions
                                </div>
                                {execs.map(tab => (
                                    <div
                                        key={tab.id}
                                        onClick={() => activateTab(tab)}
                                        style={{
                                            padding: '8px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: activeTabId.value === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            color: activeTabId.value === tab.id ? 'var(--accent-primary)' : 'var(--text-primary)'
                                        }}
                                    >
                                        <Play size={14} />
                                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getTabName(tab)}</span>
                                        {activeTabId.value === tab.id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                                    </div>
                                ))}
                            </div>
                        )}

                        {execs.length > 0 && colls.length > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />}

                        {colls.length > 0 && (
                            <div>
                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Mocks
                                </div>
                                {colls.map((tab: Tab) => (
                                    <div
                                        key={tab.id}
                                        onClick={() => activateTab(tab)}
                                        style={{
                                            padding: '8px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: activeTabId.value === tab.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            color: activeTabId.value === tab.id ? 'var(--accent-primary)' : 'var(--text-primary)'
                                        }}
                                    >
                                        <Settings size={14} />
                                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getTabName(tab)}</span>
                                        {activeTabId.value === tab.id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
