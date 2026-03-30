export async function register() {
  // Observability bootstrap disabled in this environment.
}

// Next.js will call this on unhandled request errors.
// We keep it loose-typed to avoid coupling to SDK types.
export const onRequestError = () => {};
