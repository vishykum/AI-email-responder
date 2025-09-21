// errors/oauth.ts
export class OAuthInvalidGrantError extends Error {
  constructor(message = "invalid_grant") {
    super(message);
    this.name = "OAuthInvalidGrantError";
  }
}


export function isInvalidGrant(err: any) {
  const code = err?.code ?? err?.status;
  const g = err?.response?.data?.error || err?.data?.error;
  return code === 400 && (g === "invalid_grant" || /invalid_grant/i.test(String(err)));
}