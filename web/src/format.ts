/** "2026-10-06" -> "6 Oct". Parsed as UTC so the label never shifts a day. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
