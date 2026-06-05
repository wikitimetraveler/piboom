/**
 * Injectable learn-hints store (replaces browser localStorage in piBoom parser).
 */
export interface LearnHintsProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class InMemoryLearnHintsProvider implements LearnHintsProvider {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

/** Install a minimal localStorage shim before loading customFieldCalcParser.js */
export function installLearnHintsStorage(provider: LearnHintsProvider = new InMemoryLearnHintsProvider()): void {
  const storage = {
    getItem: (key: string) => provider.getItem(key),
    setItem: (key: string, value: string) => provider.setItem(key, value),
    removeItem: (key: string) => provider.removeItem(key),
    clear: () => {
      if (provider instanceof InMemoryLearnHintsProvider) {
        (provider as InMemoryLearnHintsProvider & { store?: Map<string, string> });
      }
    },
    key: () => null,
    length: 0,
  };
  (globalThis as typeof globalThis & { localStorage?: typeof storage }).localStorage = storage;
}
