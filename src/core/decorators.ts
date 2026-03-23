import { HttpError } from "../http/fetch.js";

/**
 * One retry on deranged network — skips if the server already said "nah" (4xx/5xx as HttpError).
 * Mid for flaky Wi‑Fi, not for fixing your API key lol
 */
export function retryNetworkOnce(
  _target: object,
  _key: string | symbol,
  descriptor: PropertyDescriptor,
) {
  const orig = descriptor.value as (...args: unknown[]) => Promise<unknown>;
  descriptor.value = async function (this: unknown, ...args: unknown[]) {
    try {
      return await orig.apply(this, args);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      return await orig.apply(this, args);
    }
  };
  return descriptor;
}
