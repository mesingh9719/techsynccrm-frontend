/** Fills {{placeholders}} in a template for this lead. Unknown placeholders are dropped. */
export function fillTemplate(
  text: string,
  values: { firstName?: string | null; ownerName?: string | null; workspaceName?: string | null; requirement?: string | null },
) {
  const vars: Record<string, string> = {
    firstName: values.firstName?.trim() || 'there',
    ownerName: values.ownerName?.trim() || 'our team',
    workspaceName: values.workspaceName?.trim() || 'us',
    requirementClause: values.requirement?.trim() ? ` about ${values.requirement.trim().replace(/[.\s]+$/, '').slice(0, 80)}` : '',
  }
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? '')
}
