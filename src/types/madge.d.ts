// @types/madge on npm is frozen at madge v5's API while this project installs
// v8 — using it would type-check against a signature that no longer matches
// what's actually installed. This local declaration covers only the surface
// this project calls (verified against node_modules/madge/lib/api.js).
declare module "madge" {
  export interface MadgeInstance {
    /** Dependency graph: module path -> array of module paths it depends on. */
    obj(): Record<string, string[]>;
    /** Modules that participate in a circular dependency, one chain per entry. */
    circular(): string[][];
  }

  export interface MadgeConfig {
    fileExtensions?: string[];
    excludeRegExp?: RegExp[];
    /** Path to a tsconfig.json, or a pre-parsed config object. */
    tsConfig?: string | Record<string, unknown>;
    includeNpm?: boolean;
    [key: string]: unknown;
  }

  function madge(path: string | string[], config?: MadgeConfig): Promise<MadgeInstance>;
  export default madge;
}
