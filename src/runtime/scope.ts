import { RuntimeScope, GSValue } from './values';

export class ScopeManager {
  private scope: RuntimeScope;

  constructor() {
    this.scope = this.createScope();
  }

  createScope(parent?: RuntimeScope): RuntimeScope {
    return { parent, values: {} };
  }

  pushScope(scope?: RuntimeScope): void {
    this.scope = scope || this.createScope(this.scope);
  }

  popScope(): void {
    if (this.scope.parent) {
      this.scope = this.scope.parent;
    }
  }

  getCurrentScope(): RuntimeScope {
    return this.scope;
  }

  set(name: string, value: GSValue): void {
    this.scope.values[name] = value;
  }

  get(name: string): GSValue | undefined {
    let current: RuntimeScope | undefined = this.scope;
    while (current) {
      if (name in current.values) {
        return current.values[name];
      }
      current = current.parent;
    }
    return undefined;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  getAllValues(): Record<string, GSValue> {
    const result: Record<string, GSValue> = {};
    const seen = new Set<string>();

    let current: RuntimeScope | undefined = this.scope;
    while (current) {
      for (const key of Object.keys(current.values)) {
        if (!seen.has(key)) {
          result[key] = current.values[key];
          seen.add(key);
        }
      }
      current = current.parent;
    }

    return result;
  }
}
