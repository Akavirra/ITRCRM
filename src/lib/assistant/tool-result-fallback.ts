interface ToolResultLike {
  toolName?: string;
  output?: unknown;
}

function formatNumber(value: string | number) {
  return new Intl.NumberFormat('uk-UA')
    .format(Number(value || 0))
    .replace(/\u00a0/g, ' ');
}

function formatCurrency(value: string | number) {
  return `${formatNumber(value)} грн`;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatAbsences(result: ToolResultLike) {
  const rows = asArray<{
    student_name?: string;
    group_title?: string;
    absent_count?: string | number;
    total_lessons?: string | number;
  }>(result.output);

  if (rows.length === 0) {
    return 'За вибраний період пропусків не знайдено.';
  }

  const lines = rows.slice(0, 5).map((row) => {
    const studentName = row.student_name || 'Без імені';
    const groupTitle = row.group_title || 'Без групи';
    return `- ${studentName} — ${groupTitle}: ${formatNumber(row.absent_count || 0)} пропуск(и) із ${formatNumber(row.total_lessons || 0)} занять`;
  });

  return [
    `За вибраний період пропуски є у ${formatNumber(rows.length)} учнів.`,
    ...lines,
  ].join('\n');
}

function formatAttendance(result: ToolResultLike) {
  const row = asRecord(result.output);
  if (!row) {
    return null;
  }

  return [
    `За вибраний період відвідуваність така:`,
    `Присутні: ${formatNumber(row.present as string | number)}, відсутні: ${formatNumber(row.absent as string | number)}, запізнення: ${formatNumber(row.late as string | number)}, поважні причини: ${formatNumber(row.excused as string | number)}.`,
    `Усього відміток: ${formatNumber(row.total as string | number)}.`,
  ].join('\n');
}

function formatDebts(result: ToolResultLike) {
  const rows = asArray<{
    student_name?: string;
    group_title?: string;
    debt?: string | number;
    month?: string;
  }>(result.output);

  if (rows.length === 0) {
    return 'За вибраний місяць боржників не знайдено.';
  }

  const totalDebt = rows.reduce((sum, row) => sum + Number(row.debt || 0), 0);
  const lines = rows.slice(0, 5).map((row) => {
    const studentName = row.student_name || 'Без імені';
    const groupTitle = row.group_title || 'Без групи';
    return `- ${studentName} — ${groupTitle}: борг ${formatCurrency(row.debt || 0)}`;
  });

  return [
    `Знайдено ${formatNumber(rows.length)} боржників. Загальний борг: ${formatCurrency(totalDebt)}.`,
    ...lines,
  ].join('\n');
}

function formatStudents(result: ToolResultLike) {
  const rows = asArray<{
    full_name?: string;
    phone?: string;
    is_active?: boolean;
  }>(result.output);

  if (rows.length === 0) {
    return 'За цим запитом учнів не знайдено.';
  }

  const lines = rows.slice(0, 5).map((row) => {
    const status = row.is_active === false ? 'неактивний' : 'активний';
    const phone = row.phone ? `, ${row.phone}` : '';
    return `- ${row.full_name || 'Без імені'} — ${status}${phone}`;
  });

  return [`Знайдено ${formatNumber(rows.length)} учнів.`, ...lines].join('\n');
}

function formatStats(result: ToolResultLike) {
  const row = asRecord(result.output);
  if (!row) {
    return null;
  }

  return [
    `Зараз у CRM ${formatNumber(row.active_students as string | number)} активних учнів.`,
    `Груп: ${formatNumber(row.active_groups as string | number)}, курсів: ${formatNumber(row.total_courses as string | number)}, викладачів: ${formatNumber(row.total_teachers as string | number)}.`,
    `Занять за період: ${formatNumber(row.lessons_count as string | number)}, проведено: ${formatNumber(row.done_count as string | number)}.`,
    `Оплат за період: ${formatCurrency(row.total_payments as string | number)}.`,
  ].join('\n');
}

export function formatAssistantToolResults(toolResults: ToolResultLike[]): string | null {
  for (const result of toolResults) {
    switch (result.toolName) {
      case 'query_absences':
        return formatAbsences(result);
      case 'query_attendance':
        return formatAttendance(result);
      case 'query_debts':
        return formatDebts(result);
      case 'query_students':
        return formatStudents(result);
      case 'query_stats':
        return formatStats(result);
      default:
        break;
    }
  }

  return null;
}
