import { DateTime } from "luxon";
import { randomBytes } from "node:crypto";

export function generateSlug(
  now: DateTime,
  slugExists: (slug: string) => boolean,
): string {
  const base = now.toFormat("yyyy-MM-dd-HHmmss");
  if (!slugExists(base)) {
    return base;
  }
  const suffix = randomBytes(2).toString("hex");
  return `${base}-${suffix}`;
}
