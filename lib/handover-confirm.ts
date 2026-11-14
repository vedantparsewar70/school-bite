/**
 * "Mark Given" hands over every child's meal in an order at once. When an order has more than
 * one child, staff confirm first, seeing each child's name and class, so the wrong sibling's meal
 * is never marked as given by mistake. Returns null when no confirmation is needed (one child).
 */
export function handoverConfirmText(
  students: Array<{ name: string; grade?: string | null; division?: string | null; rollNo?: string | null }>
): string | null {
  if (students.length <= 1) return null;
  const known = (v?: string | null) => (v && v.trim() && v.trim() !== '-' ? v.trim() : '');
  const lines = students.map((st) => {
    const cls = [known(st.grade), known(st.division)].filter(Boolean).join('-');
    const roll = known(st.rollNo);
    const details = [cls && `Class ${cls}`, roll && `Roll ${roll}`].filter(Boolean).join(', ');
    return `• ${st.name}${details ? ` (${details})` : ''}`;
  });
  return `Give the meals to all ${students.length} children in this order?\n\n${lines.join('\n')}\n\nOnly continue if every child listed is here.`;
}
