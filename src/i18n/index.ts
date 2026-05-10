import { signal, computed } from "@preact/signals";
import { en } from "./en";

// Future proofing for multiple languages
const dictionaries: Record<string, any> = {
    en
};

export const currentLanguage = signal<string>("en");

// Reactive dictionary based on current language
const currentDictionary = computed(() => {
    return dictionaries[currentLanguage.value] || dictionaries['en'];
});

// Translation function
export function t(key: string, variables?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value = currentDictionary.value;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`Translation key not found: ${key}`);
            return key; // Fallback to key if not found
        }
    }

    if (typeof value !== 'string') {
        console.warn(`Translation key does not point to a string: ${key}`);
        return key;
    }

    // Replace variables if provided (e.g. "Hello {{name}}" -> "Hello World")
    let result = value;
    if (variables) {
        for (const [varKey, varValue] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${varKey}}}`, 'g'), String(varValue));
        }
    }

    return result;
}
