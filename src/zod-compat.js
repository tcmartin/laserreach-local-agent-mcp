import * as zod from "zod";

// Zod 4 removed the v3 one-argument z.record(valueSchema) overload. The
// existing Laserreach tool definitions use that form extensively, so keep the
// migration mechanical and explicit while all schemas move to Zod 4.
export const z = {
  ...zod,
  record(...args) {
    if (args.length === 1) return zod.record(zod.string(), args[0]);
    return zod.record(...args);
  },
};
