import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export async function openUserGuideWindow() {
    const label = 'user-guide';

    // Check if window already exists
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
        await existing.setFocus();
        return;
    }

    const webview = new WebviewWindow(label, {
        url: '/?view=user-guide',
        title: 'cURL-UI - User Guide',
        width: 1000,
        height: 800,
        resizable: true,
        decorations: false,
        transparent: true
    });

    webview.once('tauri://error', (e) => {
        console.error('Failed to create guide window:', e);
    });
}
