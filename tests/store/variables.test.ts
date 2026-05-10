import { describe, it, expect, beforeEach } from 'vitest';
import { batch } from '@preact/signals';
import { environments } from '../../src/store/collections';
import { activeEnvName } from '../../src/store/uiState';
import { resolveVariables } from '../../src/store/variables';

describe('Variable Inheritance', () => {
    beforeEach(() => {
        batch(() => {
            // Reset environments and active environment
            environments.value = [
                {
                    id: 'global-id',
                    name: 'Global',
                    variables: [
                        { key: 'global_var', value: 'global_val', enabled: true }
                    ]
                }
            ];
            activeEnvName.value = 'Global';
        });
    });

    it('should resolve variables from Global when it is the active environment', () => {
        const vars = resolveVariables(null);
        expect(vars['global_var']).toBe('global_val');
    });

    it('should inherit variables from Global in other environments', () => {
        batch(() => {
            environments.value = [
                ...environments.value,
                {
                    id: 'dev-id',
                    name: 'Development',
                    variables: [
                        { key: 'dev_var', value: 'dev_val', enabled: true }
                    ]
                }
            ];
            activeEnvName.value = 'Development';
        });

        const vars = resolveVariables(null);
        
        // Should have both variables
        expect(vars['global_var']).toBe('global_val');
        expect(vars['dev_var']).toBe('dev_val');
    });

    it('should allow active environment to override Global variables', () => {
        batch(() => {
            environments.value = [
                ...environments.value,
                {
                    id: 'prod-id',
                    name: 'Production',
                    variables: [
                        { key: 'global_var', value: 'prod_override', enabled: true }
                    ]
                }
            ];
            activeEnvName.value = 'Production';
        });

        const vars = resolveVariables(null);
        
        // global_var should be overridden by Production environment
        expect(vars['global_var']).toBe('prod_override');
    });

    it('should inherit Global variables even if multiple environments exist', () => {
        batch(() => {
            environments.value = [
                ...environments.value,
                {
                    id: 'env-a',
                    name: 'EnvA',
                    variables: [{ key: 'a', value: '1', enabled: true }]
                },
                {
                    id: 'env-b',
                    name: 'EnvB',
                    variables: [{ key: 'b', value: '2', enabled: true }]
                }
            ];
        });

        // Test EnvA
        activeEnvName.value = 'EnvA';
        let vars = resolveVariables(null);
        expect(vars['global_var']).toBe('global_val');
        expect(vars['a']).toBe('1');
        expect(vars['b']).toBeUndefined();

        // Test EnvB
        activeEnvName.value = 'EnvB';
        vars = resolveVariables(null);
        expect(vars['global_var']).toBe('global_val');
        expect(vars['b']).toBe('2');
        expect(vars['a']).toBeUndefined();
    });
});
