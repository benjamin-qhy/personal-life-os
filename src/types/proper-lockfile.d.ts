declare module "proper-lockfile" {
  export function lock(path: string, options: {
    lockfilePath?: string;
    realpath: boolean; retries: number; stale: number; update: number;
    onCompromised: (error: Error) => void;
  }): Promise<() => Promise<void>>;
}
