let pending: File | null = null;

export const pendingScan = {
  set(f: File): void {
    pending = f;
  },
  take(): File | null {
    const f = pending;
    pending = null;
    return f;
  },
};
