// utils/gmail.ts
export async function getGmailMailboxEmail(accessToken: string): Promise<string | null> {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null; // often 403 if you didn't request a Gmail scope
  const j = await r.json();
  return (j && typeof j.emailAddress === "string") ? j.emailAddress : null;
}

export async function listGmailSendAs(accessToken: string): Promise<string[]> {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j.sendAs) ? j.sendAs.map((s: any) => s.sendAsEmail).filter(Boolean) : [];
}
