import { describe, it, expect, beforeEach } from 'vitest';
import { batch } from '@preact/signals';
import { 
    collections, requests, folders, 
    createNewFolder, 
    resolveHeaders 
} from '../../src/store/collections';

describe('Header Inheritance', () => {
    beforeEach(() => {
        batch(() => {
            collections.value = [];
            requests.value = [];
            folders.value = [];
        });
    });

    it('should inherit headers from parent folders', () => {
        const collId = 'coll-1';
        const folder1 = createNewFolder('Parent Folder', collId);
        folder1.headers = [{ key: 'X-Parent', values: ['parent-val'], enabled: true }];
        
        folders.value = [folder1];

        const folder2 = createNewFolder('Child Folder', collId, folder1.id);
        folder2.headers = [{ key: 'X-Child', values: ['child-val'], enabled: true }];
        
        folders.value = [...folders.value, folder2];

        const headers = resolveHeaders(folder2.id);

        expect(headers).toHaveLength(2);
        expect(headers.map(h => h.key)).toContain('X-Parent');
        expect(headers.map(h => h.key)).toContain('X-Child');
    });

    it('should override parent headers with the same key from children', () => {
        const collId = 'coll-1';
        const folder1 = createNewFolder('Parent Folder', collId);
        folder1.headers = [{ key: 'X-Override', values: ['parent-val'], enabled: true }];
        
        folders.value = [folder1];

        const folder2 = createNewFolder('Child Folder', collId, folder1.id);
        folder2.headers = [{ key: 'X-Override', values: ['child-val'], enabled: true }];
        
        folders.value = [...folders.value, folder2];

        const headers = resolveHeaders(folder2.id);

        // Header from child should be found first in the while(currentId) loop
        expect(headers).toHaveLength(1);
        expect(headers[0].key).toBe('X-Override');
        expect(headers[0].values[0]).toBe('child-val');
    });
});
