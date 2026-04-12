import { openTabs, activeTabId, requests, folders, executions, activeRequestId, activeFolderId, activeExecutionId, Tab, unsavedItemIds, contextMenu, moveTab } from "../store";
import { X, FileJson, Folder, ChevronDown, ChevronLeft, ChevronRight, Play, ServerCog } from 'lucide-preact';
import { useSignal } from "@preact/signals";
import { useEffect, useRef, useCallback } from "preact/hooks";

export function TabBar() {
    const isMenuOpen = useSignal(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const canScrollLeft = useSignal(false);
    const canScrollRight = useSignal(false);

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const leftOk = el.scrollLeft > 0;
        const rightOk = Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 1;
        canScrollLeft.value = leftOk;
        canScrollRight.value = rightOk;

        // Force stop interval if bounds are hit and interval is running
        if (scrollIntervalRef.current) {
            if ((!leftOk && scrollIntervalRef.current[1] === 'left') || 
                (!rightOk && scrollIntervalRef.current[1] === 'right')) {
                clearInterval(scrollIntervalRef.current[0]);
                scrollIntervalRef.current = null;
            }
        }
    }, []);

    // Update scroll state on tab changes and resize
    useEffect(() => {
        updateScrollState();
        const el = scrollRef.current;
        if (el) {
            el.addEventListener('scroll', updateScrollState);
            const ro = new ResizeObserver(updateScrollState);
            ro.observe(el);
            return () => {
                el.removeEventListener('scroll', updateScrollState);
                ro.disconnect();
            };
        }
    }, [openTabs.value.length]);



    // Auto-scroll active tab into view when selection changes (e.g. from sidebar)
    useEffect(() => {
        if (!activeTabId.value) return;
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (!el) return;
            const tabEl = el.querySelector(`[data-tab-id="${activeTabId.value}"]`) as HTMLElement;
            if (tabEl) {
                tabEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
            }
        });
    }, [activeTabId.value]);

    const scrollIntervalRef = useRef<[ReturnType<typeof setInterval>, 'left' | 'right'] | null>(null);

    const startScrolling = (delta: number, direction: 'left' | 'right') => {
        // Scroll once immediately
        scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
        // Then keep scrolling while held
        const id = setInterval(() => {
            scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
        }, 200);
        scrollIntervalRef.current = [id, direction];
    };

    const stopScrolling = () => {
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current[0]);
            scrollIntervalRef.current = null;
        }
    };

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

    const handleContextMenu = (e: MouseEvent, tabId: string) => {
        e.preventDefault();
        e.stopPropagation();
        contextMenu.value = {
            x: e.clientX,
            y: e.clientY,
            itemId: tabId,
            type: 'tab',
            collectionId: '' // Not strictly needed for tabs
        };
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
        if (tab.type === 'execution') {
            const exec = executions.value.find(e => e.id === tab.id);
            if (exec) {
                const parentReq = requests.value.find(r => r.id === exec.requestId);
                return parentReq ? `${parentReq.name} (${exec.name})` : exec.name;
            }
            return tab.name;
        }
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
        const extMocks = sorted.filter(t => t.type === 'external-mock');
        return { reqs, folds, execs, colls, extMocks };
    };

    const { reqs, folds, execs, colls, extMocks } = getGroupedTabs();

    const dragOverTabId = useSignal<string | null>(null);
    const dropPosition = useSignal<'before' | 'after' | null>(null);

    if (openTabs.value.length === 0) return null;

    const scrollBtnStyle = {
        height: '100%',
        padding: '0 6px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        backgroundColor: 'var(--bg-base)',
        border: 'none',
        borderLeft: '1px solid var(--border-color)',
        borderRight: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        flexShrink: 0,
        transition: 'color 0.15s, background-color 0.15s'
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)', height: '40px' }}>
            {/* Scroll Left */}
            {canScrollLeft.value && (
                <div
                    onMouseDown={() => startScrolling(-150, 'left')}
                    onMouseUp={stopScrolling}
                    onMouseLeave={stopScrolling}
                    style={scrollBtnStyle}
                    title="Scroll Left"
                >
                    <ChevronLeft size={16} />
                </div>
            )}

            {/* Scrollable Tabs */}
            <div ref={scrollRef} style={{ display: 'flex', flex: 1, overflowX: 'auto', height: '100%', scrollbarWidth: 'none' }}>
                {openTabs.value.map((tab, index) => {
                    const isActive = activeTabId.value === tab.id;
                    const freshName = getTabName(tab);
                    const isDragOver = dragOverTabId.value === tab.id;

                    const handleDragStart = (e: DragEvent) => {
                        if (e.dataTransfer) {
                            e.dataTransfer.setData('text/plain', index.toString());
                            e.dataTransfer.effectAllowed = 'move';
                        }
                    };

                    const handleDragOver = (e: DragEvent) => {
                        e.preventDefault();
                        if (e.dataTransfer) {
                            e.dataTransfer.dropEffect = 'move';
                        }
                        
                        // Calculate if before or after
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const pos = x < rect.width / 2 ? 'before' : 'after';
                        
                        dragOverTabId.value = tab.id;
                        dropPosition.value = pos;
                    };

                    const handleDragLeave = () => {
                        dragOverTabId.value = null;
                        dropPosition.value = null;
                    };

                    const handleDrop = (e: DragEvent) => {
                        e.preventDefault();
                        const fromIndexStr = e.dataTransfer?.getData('text/plain');
                        
                        const targetPos = dropPosition.value;
                        dragOverTabId.value = null;
                        dropPosition.value = null;

                        if (fromIndexStr !== undefined) {
                            const fromIndex = parseInt(fromIndexStr, 10);
                            let toIndex = index;
                            
                            // Adjust toIndex based on before/after
                            if (targetPos === 'after' && fromIndex < index) {
                                // moving forward, dropping after
                            } else if (targetPos === 'before' && fromIndex > index) {
                                // moving backward, dropping before
                            } else if (targetPos === 'after' && fromIndex > index) {
                                toIndex++;
                            } else if (targetPos === 'before' && fromIndex < index) {
                                toIndex--;
                            }
                            
                            if (fromIndex !== toIndex && toIndex >= 0 && toIndex < openTabs.value.length) {
                                moveTab(fromIndex, toIndex);
                            }
                        }
                    };

                    return (
                        <div
                            key={tab.id}
                            data-tab-id={tab.id}
                            draggable={true}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDragEnd={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => activateTab(tab)}
                            onContextMenu={(e) => handleContextMenu(e, tab.id)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.maxWidth = '600px';
                                e.currentTarget.style.flexShrink = '0';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.maxWidth = '200px';
                                e.currentTarget.style.flexShrink = '';
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0 16px',
                                cursor: 'pointer',
                                backgroundColor: isActive ? 'var(--bg-base)' : 'transparent',
                                borderTop: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                borderLeft: isDragOver && dropPosition.value === 'before' ? '2px solid var(--accent-primary)' : 'none',
                                borderRight: isDragOver && dropPosition.value === 'after' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                minWidth: '120px',
                                maxWidth: '200px',
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                height: '100%',
                                transition: 'all 0.1s ease',
                                userSelect: 'none',
                                boxSizing: 'border-box'
                            }}
                        >
                            {tab.type === 'request' ? <FileJson size={14} /> : tab.type === 'execution' ? <Play size={14} /> : (tab.type === 'collection' || tab.type === 'external-mock') ? <ServerCog size={14} /> : <Folder size={14} />}
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

            {/* Scroll Right */}
            {canScrollRight.value && (
                <div
                    onMouseDown={() => startScrolling(150, 'right')}
                    onMouseUp={stopScrolling}
                    onMouseLeave={stopScrolling}
                    style={scrollBtnStyle}
                    title="Scroll Right"
                >
                    <ChevronRight size={16} />
                </div>
            )}

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
                                        <ServerCog size={14} />
                                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getTabName(tab)}</span>
                                        {activeTabId.value === tab.id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                                    </div>
                                ))}
                            </div>
                        )}

                        {(colls.length > 0 || execs.length > 0 || reqs.length > 0 || folds.length > 0) && extMocks.length > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />}

                        {extMocks.length > 0 && (
                            <div>
                                <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    External Mocks
                                </div>
                                {extMocks.map((tab: Tab) => (
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
                                        <ServerCog size={14} />
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
