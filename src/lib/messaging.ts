import { all, get, run } from '@/db';

export type MessageChannel = 'email' | 'telegram' | 'viber';
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed';
export type RecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface MessageTemplate {
  id: number;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  variables: string[];
  is_active: boolean;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface MessagingStudent {
  id: number;
  public_id: string;
  full_name: string;
  photo: string | null;
  email: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  school: string | null;
  is_active: boolean;
  study_status: 'studying' | 'not_studying';
  groups: Array<{
    id: number;
    title: string;
    course_id: number;
    course_title: string;
  }>;
}

export interface AudienceFilter {
  mode?: 'all' | 'manual';
  studentIds?: number[];
  excludedStudentIds?: number[];
  courseIds?: number[];
  groupIds?: number[];
  studyStatuses?: Array<'studying' | 'not_studying'>;
  includeInactive?: boolean;
  requireEmail?: boolean;
  search?: string;
}

export interface AudiencePreview {
  students: MessagingStudent[];
  total: number;
  deliverable: number;
  missingEmail: number;
  suppressed: number;
}

export interface CampaignRecipientInput {
  student: MessagingStudent;
  subject: string;
  body: string;
}

export interface SendCampaignInput {
  name: string;
  channel: MessageChannel;
  provider: string;
  subject: string;
  body: string;
  audienceFilter: AudienceFilter;
  createdBy: number;
  templateId?: number | null;
}

export interface CampaignSummary {
  id: number;
  name: string;
  channel: MessageChannel;
  provider: string | null;
  subject: string | null;
  status: CampaignStatus;
  total_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_by: number | null;
  created_by_name: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface CampaignRecipientDetails {
  id: number;
  campaign_id: number;
  student_id: number | null;
  channel: MessageChannel;
  address: string | null;
  recipient_name: string;
  status: RecipientStatus;
  provider_message_id: string | null;
  error: string | null;
  rendered_subject: string | null;
  rendered_body: string | null;
  sent_at: string | null;
  public_id: string | null;
  full_name: string | null;
  photo: string | null;
  email: string | null;
  is_active: boolean | null;
  study_status: 'studying' | 'not_studying' | null;
}

export interface CampaignDetails extends CampaignSummary {
  template_id: number | null;
  body: string;
  audience_filter: Required<AudienceFilter>;
  recipients: CampaignRecipientDetails[];
}

const DEFAULT_VARIABLES = [
  'studentName',
  'parentName',
  'studentEmail',
  'school',
  'groups',
  'courses',
];

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseStudentGroups(value: unknown): MessagingStudent['groups'] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const group = item as Record<string, unknown>;
        return {
          id: Number(group.id),
          title: String(group.title || ''),
          course_id: Number(group.course_id || 0),
          course_title: String(group.course_title || ''),
        };
      })
      .filter((group): group is MessagingStudent['groups'][number] => Boolean(group && group.id > 0));
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      return parseStudentGroups(JSON.parse(value));
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeTemplate(row: Omit<MessageTemplate, 'variables'> & { variables: unknown }): MessageTemplate {
  return {
    ...row,
    variables: parseJsonArray(row.variables),
  };
}

function uniqueNumbers(values?: number[]): number[] {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

function normalizeSearch(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function emailLooksValid(email: string | null): boolean {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
}

function parseAudienceFilter(value: unknown): Required<AudienceFilter> {
  if (!value || typeof value !== 'object') {
    return normalizeAudienceFilter({});
  }

  return normalizeAudienceFilter(value as AudienceFilter);
}

export function normalizeAudienceFilter(filter: AudienceFilter = {}): Required<AudienceFilter> {
    return {
      mode: filter.mode === 'manual' ? 'manual' : 'all',
      studentIds: uniqueNumbers(filter.studentIds),
      excludedStudentIds: uniqueNumbers(filter.excludedStudentIds),
      courseIds: uniqueNumbers(filter.courseIds),
      groupIds: uniqueNumbers(filter.groupIds),
    studyStatuses: (filter.studyStatuses || []).filter(
      (status): status is 'studying' | 'not_studying' => status === 'studying' || status === 'not_studying'
    ),
    includeInactive: Boolean(filter.includeInactive),
    requireEmail: filter.requireEmail !== false,
    search: filter.search || '',
  };
}

export async function getMessageTemplates(channel: MessageChannel = 'email'): Promise<MessageTemplate[]> {
  const rows = await all<Omit<MessageTemplate, 'variables'> & { variables: unknown }>(
    `SELECT *
     FROM message_templates
     WHERE channel = $1 AND is_active = TRUE
     ORDER BY updated_at DESC, name ASC`,
    [channel]
  );

  return rows.map(normalizeTemplate);
}

export async function createMessageTemplate(input: {
  name: string;
  channel?: MessageChannel;
  subject?: string | null;
  body: string;
  variables?: string[];
  userId: number;
}): Promise<MessageTemplate> {
  const row = await get<Omit<MessageTemplate, 'variables'> & { variables: unknown }>(
    `INSERT INTO message_templates (name, channel, subject, body, variables, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
     RETURNING *`,
    [
      input.name.trim(),
      input.channel || 'email',
      input.subject?.trim() || null,
      input.body,
      JSON.stringify(input.variables || DEFAULT_VARIABLES),
      input.userId,
    ]
  );

  if (!row) {
    throw new Error('Template was not created');
  }

  return normalizeTemplate(row);
}

export async function updateMessageTemplate(
  id: number,
  input: {
    name: string;
    subject?: string | null;
    body: string;
    variables?: string[];
    userId: number;
  }
): Promise<MessageTemplate | null> {
  const row = await get<Omit<MessageTemplate, 'variables'> & { variables: unknown }>(
    `UPDATE message_templates
     SET name = $1,
         subject = $2,
         body = $3,
         variables = $4::jsonb,
         updated_by = $5,
         updated_at = NOW()
     WHERE id = $6 AND is_active = TRUE
     RETURNING *`,
    [
      input.name.trim(),
      input.subject?.trim() || null,
      input.body,
      JSON.stringify(input.variables || DEFAULT_VARIABLES),
      input.userId,
      id,
    ]
  );

  return row ? normalizeTemplate(row) : null;
}

export async function archiveMessageTemplate(id: number, userId: number): Promise<boolean> {
  const rows = await run(
    `UPDATE message_templates
     SET is_active = FALSE, updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND is_active = TRUE
     RETURNING id`,
    [userId, id]
  );
  return rows.length > 0;
}

export async function getAudiencePreview(inputFilter: AudienceFilter): Promise<AudiencePreview> {
  const filter = normalizeAudienceFilter(inputFilter);
  const hasSegmentFilters = filter.groupIds.length > 0 || filter.courseIds.length > 0 || Boolean(filter.search.trim());
  if (filter.mode === 'manual' && filter.studentIds.length === 0 && !hasSegmentFilters) {
    return {
      students: [],
      total: 0,
      deliverable: 0,
      missingEmail: 0,
      suppressed: 0,
    };
  }

  const suppressedRows = await all<{ address: string }>(
    `SELECT address FROM message_suppression_list WHERE channel = 'email'`
  );
  const suppressed = new Set(suppressedRows.map((row) => row.address.toLowerCase()));

  const students = await all<{
    id: number;
    public_id: string;
    full_name: string;
    photo: string | null;
    email: string | null;
    parent_name: string | null;
    parent_phone: string | null;
    school: string | null;
    is_active: boolean;
    study_status: 'studying' | 'not_studying';
    groups_json: unknown;
  }>(
    `SELECT
       s.id,
       s.public_id,
       s.full_name,
       s.photo,
       s.email,
       s.parent_name,
       s.parent_phone,
       s.school,
       s.is_active,
       CASE WHEN EXISTS (
              SELECT 1
              FROM student_groups sg2
              WHERE sg2.student_id = s.id
                AND sg2.is_active = TRUE
            )
            OR EXISTS (
              SELECT 1
              FROM attendance a2
              JOIN lessons l2 ON a2.lesson_id = l2.id
              WHERE a2.student_id = s.id
                AND l2.group_id IS NULL
                AND l2.status = 'scheduled'
                AND l2.lesson_date >= CURRENT_DATE
            )
            THEN 'studying' ELSE 'not_studying' END AS study_status,
       COALESCE(
         jsonb_agg(
           DISTINCT jsonb_build_object(
             'id', g.id,
             'title', g.title,
             'course_id', c.id,
             'course_title', c.title
           )
         ) FILTER (WHERE g.id IS NOT NULL AND sg.is_active = TRUE),
         '[]'::jsonb
       ) AS groups_json
     FROM students s
     LEFT JOIN student_groups sg ON sg.student_id = s.id AND sg.is_active = TRUE
     LEFT JOIN groups g ON g.id = sg.group_id AND g.is_active = TRUE
     LEFT JOIN courses c ON c.id = g.course_id
     WHERE ($1::boolean = TRUE OR s.is_active = TRUE)
     GROUP BY s.id
     ORDER BY s.full_name ASC`,
    [filter.includeInactive]
  );

  const search = normalizeSearch(filter.search);
  const selectedStudents = new Set(filter.studentIds);
  const excludedStudents = new Set(filter.excludedStudentIds);
  const selectedGroups = new Set(filter.groupIds);
  const selectedCourses = new Set(filter.courseIds);
  const selectedStatuses = new Set(filter.studyStatuses);

  const filtered = students
    .map((student) => ({
      id: student.id,
      public_id: student.public_id,
      full_name: student.full_name,
      photo: student.photo,
      email: student.email,
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      school: student.school,
      is_active: student.is_active,
      study_status: student.study_status,
      groups: parseStudentGroups(student.groups_json),
    }))
    .filter((student) => {
      if (filter.mode === 'manual' && selectedStudents.size > 0 && !selectedStudents.has(student.id)) {
        return false;
      }

      if (excludedStudents.has(student.id)) {
        return false;
      }

      if (selectedStatuses.size > 0 && !selectedStatuses.has(student.study_status)) {
        return false;
      }

      if (selectedGroups.size > 0 && !student.groups.some((group) => selectedGroups.has(group.id))) {
        return false;
      }

      if (selectedCourses.size > 0 && !student.groups.some((group) => selectedCourses.has(group.course_id))) {
        return false;
      }

      if (search) {
        const haystack = [
          student.full_name,
          student.email || '',
          student.parent_name || '',
          student.parent_phone || '',
          student.school || '',
          student.groups.map((group) => group.title).join(' '),
        ].join(' ').toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      if (filter.requireEmail && !emailLooksValid(student.email)) {
        return false;
      }

      return true;
    });

  const missingEmail = filtered.filter((student) => !emailLooksValid(student.email)).length;
  const suppressedCount = filtered.filter(
    (student) => student.email && suppressed.has(student.email.toLowerCase())
  ).length;

  return {
    students: filtered,
    total: filtered.length,
    deliverable: filtered.filter(
      (student) => emailLooksValid(student.email) && !suppressed.has(String(student.email).toLowerCase())
    ).length,
    missingEmail,
    suppressed: suppressedCount,
  };
}

export function renderMessageTemplate(
  template: string,
  student: MessagingStudent,
  extra: Record<string, string> = {}
): string {
  const courses = Array.from(new Set(student.groups.map((group) => group.course_title).filter(Boolean)));
  const values: Record<string, string> = {
    studentName: student.full_name,
    parentName: student.parent_name || '',
    studentEmail: student.email || '',
    school: student.school || '',
    groups: student.groups.map((group) => group.title).join(', '),
    courses: courses.join(', '),
    ...extra,
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? '');
}

async function sendEmailViaResend(input: {
  to: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME || 'ITRobotics';

  if (!apiKey || !fromEmail) {
    throw new Error('Resend не налаштовано: потрібні RESEND_API_KEY та RESEND_FROM_EMAIL');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [`${input.toName} <${input.to}>`],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || data?.error || 'Не вдалося надіслати email через Resend';
    throw new Error(String(message));
  }

  return { id: String(data?.id || '') };
}

export async function createAndSendCampaign(input: SendCampaignInput): Promise<CampaignSummary> {
  const preview = await getAudiencePreview(input.audienceFilter);
  const normalizedFilter = normalizeAudienceFilter(input.audienceFilter);

  const campaign = await get<{ id: number }>(
    `INSERT INTO message_campaigns (
       name, channel, provider, template_id, subject, body, audience_filter,
       status, total_count, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'sending', $8, $9)
     RETURNING id`,
    [
      input.name.trim(),
      input.channel,
      input.provider,
      input.templateId || null,
      input.subject,
      input.body,
      JSON.stringify(normalizedFilter),
      preview.students.length,
      input.createdBy,
    ]
  );

  if (!campaign) {
    throw new Error('Campaign was not created');
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const suppressedRows = await all<{ address: string }>(
    `SELECT address FROM message_suppression_list WHERE channel = $1`,
    [input.channel]
  );
  const suppressedAddresses = new Set(suppressedRows.map((row) => row.address.toLowerCase()));

  for (const student of preview.students) {
    const address = student.email?.trim() || '';
    const renderedSubject = renderMessageTemplate(input.subject, student);
    const renderedBody = renderMessageTemplate(input.body, student);

    if (input.channel !== 'email' || !emailLooksValid(address)) {
      skipped++;
      await insertRecipient({
        campaignId: campaign.id,
        student,
        channel: input.channel,
        address: address || null,
        subject: renderedSubject,
        body: renderedBody,
        status: 'skipped',
        error: input.channel !== 'email' ? 'Канал ще не підключено' : 'Немає валідного email',
      });
      continue;
    }

    if (suppressedAddresses.has(address.toLowerCase())) {
      skipped++;
      await insertRecipient({
        campaignId: campaign.id,
        student,
        channel: input.channel,
        address,
        subject: renderedSubject,
        body: renderedBody,
        status: 'skipped',
        error: 'Адреса у списку виключень',
      });
      continue;
    }

    try {
      const result = await sendEmailViaResend({
        to: address,
        toName: student.full_name,
        subject: renderedSubject,
        html: renderedBody.replace(/\n/g, '<br />'),
        text: renderedBody,
      });
      sent++;
      await insertRecipient({
        campaignId: campaign.id,
        student,
        channel: input.channel,
        address,
        subject: renderedSubject,
        body: renderedBody,
        status: 'sent',
        providerMessageId: result.id,
      });
    } catch (error) {
      failed++;
      await insertRecipient({
        campaignId: campaign.id,
        student,
        channel: input.channel,
        address,
        subject: renderedSubject,
        body: renderedBody,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Невідома помилка',
      });
    }
  }

  const finalStatus: CampaignStatus = failed > 0 && sent === 0 ? 'failed' : 'sent';
  await run(
    `UPDATE message_campaigns
     SET status = $1,
         sent_count = $2,
         failed_count = $3,
         skipped_count = $4,
         sent_at = NOW(),
         updated_at = NOW()
     WHERE id = $5`,
    [finalStatus, sent, failed, skipped, campaign.id]
  );

  const summary = await getCampaignById(campaign.id);
  if (!summary) {
    throw new Error('Campaign summary was not found');
  }

  return summary;
}

async function insertRecipient(input: {
  campaignId: number;
  student: MessagingStudent;
  channel: MessageChannel;
  address: string | null;
  subject: string;
  body: string;
  status: RecipientStatus;
  providerMessageId?: string | null;
  error?: string | null;
}): Promise<void> {
  await run(
    `INSERT INTO message_recipients (
       campaign_id, student_id, channel, address, recipient_name, status,
       provider_message_id, error, rendered_subject, rendered_body, sent_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $6 = 'sent' THEN NOW() ELSE NULL END)`,
    [
      input.campaignId,
      input.student.id,
      input.channel,
      input.address,
      input.student.full_name,
      input.status,
      input.providerMessageId || null,
      input.error || null,
      input.subject,
      input.body,
    ]
  );
}

export async function getCampaigns(limit = 25): Promise<CampaignSummary[]> {
  return all<CampaignSummary>(
    `SELECT
       c.id,
       c.name,
       c.channel,
       c.provider,
       c.subject,
       c.status,
       c.total_count,
       c.sent_count,
       c.failed_count,
       c.skipped_count,
       c.created_by,
       u.name AS created_by_name,
       c.sent_at,
       c.created_at
     FROM message_campaigns c
     LEFT JOIN users u ON u.id = c.created_by
     ORDER BY c.created_at DESC
     LIMIT $1`,
    [limit]
  );
}

export async function getCampaignById(id: number): Promise<CampaignSummary | null> {
  const row = await get<CampaignSummary>(
    `SELECT
       c.id,
       c.name,
       c.channel,
       c.provider,
       c.subject,
       c.status,
       c.total_count,
       c.sent_count,
       c.failed_count,
       c.skipped_count,
       c.created_by,
       u.name AS created_by_name,
       c.sent_at,
       c.created_at
     FROM message_campaigns c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = $1`,
    [id]
  );

  return row || null;
}

export async function getCampaignDetails(id: number): Promise<CampaignDetails | null> {
  const campaign = await get<
    Omit<CampaignDetails, 'audience_filter' | 'recipients'> & { audience_filter: unknown }
  >(
    `SELECT
       c.id,
       c.name,
       c.channel,
       c.provider,
       c.template_id,
       c.subject,
       c.body,
       c.audience_filter,
       c.status,
       c.total_count,
       c.sent_count,
       c.failed_count,
       c.skipped_count,
       c.created_by,
       u.name AS created_by_name,
       c.sent_at,
       c.created_at
     FROM message_campaigns c
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = $1`,
    [id]
  );

  if (!campaign) {
    return null;
  }

  const recipients = await all<CampaignRecipientDetails>(
    `SELECT
       r.id,
       r.campaign_id,
       r.student_id,
       r.channel,
       r.address,
       r.recipient_name,
       r.status,
       r.provider_message_id,
       r.error,
       r.rendered_subject,
       r.rendered_body,
       r.sent_at,
       s.public_id,
       s.full_name,
       s.photo,
       s.email,
       s.is_active,
       CASE
         WHEN s.id IS NULL THEN NULL
         WHEN EXISTS (
           SELECT 1
           FROM student_groups sg2
           WHERE sg2.student_id = s.id
             AND sg2.is_active = TRUE
         )
         OR EXISTS (
           SELECT 1
           FROM attendance a2
           JOIN lessons l2 ON a2.lesson_id = l2.id
           WHERE a2.student_id = s.id
             AND l2.group_id IS NULL
             AND l2.status = 'scheduled'
             AND l2.lesson_date >= CURRENT_DATE
         )
         THEN 'studying'
         ELSE 'not_studying'
       END AS study_status
     FROM message_recipients r
     LEFT JOIN students s ON s.id = r.student_id
     WHERE r.campaign_id = $1
     ORDER BY
       CASE r.status
         WHEN 'failed' THEN 0
         WHEN 'skipped' THEN 1
         WHEN 'sent' THEN 2
         ELSE 3
       END,
       r.sent_at DESC NULLS LAST,
       r.id DESC`,
    [id]
  );

  return {
    ...campaign,
    audience_filter: parseAudienceFilter(campaign.audience_filter),
    recipients,
  };
}

export async function getMessagingBootstrap(): Promise<{
  templates: MessageTemplate[];
  campaigns: CampaignSummary[];
  variables: string[];
}> {
  const [templates, campaigns] = await Promise.all([
    getMessageTemplates('email'),
    getCampaigns(10),
  ]);

  return {
    templates,
    campaigns,
    variables: DEFAULT_VARIABLES,
  };
}
