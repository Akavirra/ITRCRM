-- Snapshot of current Neon PostgreSQL schema
-- Generated at: 2026-04-06T20:34:26.317Z
-- Source of truth: live database

-- Table: attendance
CREATE TABLE attendance (
  id integer NOT NULL,
  lesson_id integer NOT NULL,
  student_id integer NOT NULL,
  status text DEFAULT 'present'::text,
  comment text,
  makeup_lesson_id integer,
  updated_by integer,
  updated_at timestamp with time zone DEFAULT now()
);

-- Constraints for attendance
-- CHECK: attendance_status_check => CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'makeup_planned'::text, 'makeup_done'::text])))
-- FOREIGN KEY: attendance_lesson_id_fkey => FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
-- FOREIGN KEY: attendance_makeup_lesson_id_fkey => FOREIGN KEY (makeup_lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
-- FOREIGN KEY: attendance_student_id_fkey => FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
-- FOREIGN KEY: attendance_updated_by_fkey => FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
-- PRIMARY KEY: attendance_pkey => PRIMARY KEY (id)
-- UNIQUE: attendance_lesson_id_student_id_key => UNIQUE (lesson_id, student_id)

-- Indexes for attendance
CREATE UNIQUE INDEX attendance_lesson_id_student_id_key ON public.attendance USING btree (lesson_id, student_id);
CREATE UNIQUE INDEX attendance_pkey ON public.attendance USING btree (id);
CREATE INDEX idx_attendance_lesson ON public.attendance USING btree (lesson_id);
CREATE INDEX idx_attendance_status ON public.attendance USING btree (status);
CREATE INDEX idx_attendance_student ON public.attendance USING btree (student_id);

-- Table: courses
CREATE TABLE courses (
  id integer NOT NULL,
  public_id text,
  title text NOT NULL,
  description text,
  age_min integer DEFAULT 6 NOT NULL,
  duration_months integer DEFAULT 1 NOT NULL,
  program text,
  flyer_path text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Constraints for courses
-- PRIMARY KEY: courses_pkey => PRIMARY KEY (id)
-- UNIQUE: courses_public_id_key => UNIQUE (public_id)

-- Indexes for courses
CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id);
CREATE UNIQUE INDEX courses_public_id_key ON public.courses USING btree (public_id);
CREATE INDEX idx_courses_active ON public.courses USING btree (is_active);
CREATE UNIQUE INDEX idx_courses_public_id ON public.courses USING btree (public_id);

-- Table: enrollment_submissions
CREATE TABLE enrollment_submissions (
  id integer DEFAULT nextval('enrollment_submissions_id_seq'::regclass) NOT NULL,
  token_id integer,
  child_first_name text NOT NULL,
  child_last_name text NOT NULL,
  birth_date date,
  school text,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  parent_relation text,
  parent2_name text,
  parent2_relation text,
  notes text,
  interested_courses text,
  source text,
  status text DEFAULT 'pending'::text,
  reviewed_by integer,
  reviewed_at timestamp with time zone,
  student_id integer,
  created_at timestamp with time zone DEFAULT now(),
  parent2_phone text,
  gender text CHECK (gender IN ('male', 'female'))
);

-- Constraints for enrollment_submissions
-- CHECK: enrollment_submissions_status_check => CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
-- FOREIGN KEY: enrollment_submissions_reviewed_by_fkey => FOREIGN KEY (reviewed_by) REFERENCES users(id)
-- FOREIGN KEY: enrollment_submissions_student_id_fkey => FOREIGN KEY (student_id) REFERENCES students(id)
-- FOREIGN KEY: enrollment_submissions_token_id_fkey => FOREIGN KEY (token_id) REFERENCES enrollment_tokens(id)
-- PRIMARY KEY: enrollment_submissions_pkey => PRIMARY KEY (id)

-- Indexes for enrollment_submissions
CREATE UNIQUE INDEX enrollment_submissions_pkey ON public.enrollment_submissions USING btree (id);
CREATE INDEX idx_enrollment_submissions_status ON public.enrollment_submissions USING btree (status);

-- Table: enrollment_tokens
CREATE TABLE enrollment_tokens (
  id integer DEFAULT nextval('enrollment_tokens_id_seq'::regclass) NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_by integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for enrollment_tokens
-- FOREIGN KEY: enrollment_tokens_created_by_fkey => FOREIGN KEY (created_by) REFERENCES users(id)
-- PRIMARY KEY: enrollment_tokens_pkey => PRIMARY KEY (id)
-- UNIQUE: enrollment_tokens_token_key => UNIQUE (token)

-- Indexes for enrollment_tokens
CREATE UNIQUE INDEX enrollment_tokens_pkey ON public.enrollment_tokens USING btree (id);
CREATE UNIQUE INDEX enrollment_tokens_token_key ON public.enrollment_tokens USING btree (token);
CREATE INDEX idx_enrollment_tokens_token ON public.enrollment_tokens USING btree (token);

-- Table: error_logs
CREATE TABLE error_logs (
  id integer NOT NULL,
  error_message text NOT NULL,
  error_stack text,
  user_id integer,
  request_path text,
  request_method text,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for error_logs
-- FOREIGN KEY: error_logs_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
-- PRIMARY KEY: error_logs_pkey => PRIMARY KEY (id)

-- Indexes for error_logs
CREATE UNIQUE INDEX error_logs_pkey ON public.error_logs USING btree (id);
CREATE INDEX idx_error_logs_created ON public.error_logs USING btree (created_at);

-- Table: group_history
CREATE TABLE group_history (
  id integer NOT NULL,
  group_id integer NOT NULL,
  action_type text NOT NULL,
  action_description text NOT NULL,
  old_value text,
  new_value text,
  user_id integer NOT NULL,
  user_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for group_history
-- FOREIGN KEY: group_history_group_id_fkey => FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
-- FOREIGN KEY: group_history_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
-- PRIMARY KEY: group_history_pkey => PRIMARY KEY (id)

-- Indexes for group_history
CREATE UNIQUE INDEX group_history_pkey ON public.group_history USING btree (id);
CREATE INDEX idx_group_history_created ON public.group_history USING btree (created_at);
CREATE INDEX idx_group_history_group ON public.group_history USING btree (group_id);

-- Table: group_teacher_assignments
CREATE TABLE group_teacher_assignments (
  id integer DEFAULT nextval('group_teacher_assignments_id_seq'::regclass) NOT NULL,
  group_id integer NOT NULL,
  teacher_id integer NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  ended_at timestamp with time zone,
  changed_by integer,
  reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Constraints for group_teacher_assignments
-- FOREIGN KEY: group_teacher_assignments_changed_by_fkey => FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
-- FOREIGN KEY: group_teacher_assignments_group_id_fkey => FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
-- FOREIGN KEY: group_teacher_assignments_teacher_id_fkey => FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT
-- PRIMARY KEY: group_teacher_assignments_pkey => PRIMARY KEY (id)

-- Indexes for group_teacher_assignments
CREATE UNIQUE INDEX group_teacher_assignments_pkey ON public.group_teacher_assignments USING btree (id);
CREATE INDEX idx_gta_active ON public.group_teacher_assignments USING btree (group_id) WHERE (ended_at IS NULL);
CREATE INDEX idx_gta_group_id ON public.group_teacher_assignments USING btree (group_id);
CREATE INDEX idx_gta_teacher_id ON public.group_teacher_assignments USING btree (teacher_id);

-- Table: groups
CREATE TABLE groups (
  id integer NOT NULL,
  public_id text,
  course_id integer NOT NULL,
  title text NOT NULL,
  teacher_id integer NOT NULL,
  weekly_day integer NOT NULL,
  start_time text NOT NULL,
  duration_minutes integer DEFAULT 90 NOT NULL,
  timezone text DEFAULT 'Europe/Uzhgorod'::text,
  start_date date,
  end_date date,
  capacity integer,
  monthly_price integer DEFAULT 0,
  status text DEFAULT 'active'::text NOT NULL,
  note text,
  photos_folder_url text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by integer,
  updated_by integer
);

-- Constraints for groups
-- CHECK: groups_status_check => CHECK ((status = ANY (ARRAY['active'::text, 'graduate'::text, 'inactive'::text])))
-- CHECK: groups_weekly_day_check => CHECK (((weekly_day >= 1) AND (weekly_day <= 7)))
-- FOREIGN KEY: groups_course_id_fkey => FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT
-- FOREIGN KEY: groups_created_by_fkey => FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
-- FOREIGN KEY: groups_teacher_id_fkey => FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT
-- FOREIGN KEY: groups_updated_by_fkey => FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
-- PRIMARY KEY: groups_pkey => PRIMARY KEY (id)
-- UNIQUE: groups_public_id_key => UNIQUE (public_id)

-- Indexes for groups
CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);
CREATE UNIQUE INDEX groups_public_id_key ON public.groups USING btree (public_id);
CREATE INDEX idx_groups_active ON public.groups USING btree (is_active);
CREATE INDEX idx_groups_course ON public.groups USING btree (course_id);
CREATE INDEX idx_groups_course_active ON public.groups USING btree (course_id, is_active);
CREATE UNIQUE INDEX idx_groups_public_id ON public.groups USING btree (public_id);
CREATE INDEX idx_groups_status ON public.groups USING btree (status);
CREATE INDEX idx_groups_teacher ON public.groups USING btree (teacher_id);
CREATE INDEX idx_groups_teacher_status ON public.groups USING btree (teacher_id, status);

-- Table: individual_balances
CREATE TABLE individual_balances (
  id integer DEFAULT nextval('individual_balances_id_seq'::regclass) NOT NULL,
  student_id integer NOT NULL,
  lessons_paid integer DEFAULT 0 NOT NULL,
  lessons_used integer DEFAULT 0 NOT NULL
);

-- Constraints for individual_balances
-- FOREIGN KEY: individual_balances_student_id_fkey => FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
-- PRIMARY KEY: individual_balances_pkey => PRIMARY KEY (id)
-- UNIQUE: individual_balances_student_id_key => UNIQUE (student_id)

-- Indexes for individual_balances
CREATE UNIQUE INDEX individual_balances_pkey ON public.individual_balances USING btree (id);
CREATE UNIQUE INDEX individual_balances_student_id_key ON public.individual_balances USING btree (student_id);

-- Table: individual_payments
CREATE TABLE individual_payments (
  id integer DEFAULT nextval('individual_payments_id_seq'::regclass) NOT NULL,
  student_id integer NOT NULL,
  lessons_count integer NOT NULL,
  amount integer NOT NULL,
  method text NOT NULL,
  paid_at timestamp with time zone DEFAULT now() NOT NULL,
  note text,
  created_by integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for individual_payments
-- CHECK: individual_payments_method_check => CHECK ((method = ANY (ARRAY['cash'::text, 'account'::text])))
-- FOREIGN KEY: individual_payments_created_by_fkey => FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
-- FOREIGN KEY: individual_payments_student_id_fkey => FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
-- PRIMARY KEY: individual_payments_pkey => PRIMARY KEY (id)

-- Indexes for individual_payments
CREATE INDEX idx_individual_payments_paid_at ON public.individual_payments USING btree (paid_at DESC);
CREATE INDEX idx_individual_payments_student ON public.individual_payments USING btree (student_id);
CREATE UNIQUE INDEX individual_payments_pkey ON public.individual_payments USING btree (id);

-- Table: lesson_change_logs
CREATE TABLE lesson_change_logs (
  id integer DEFAULT nextval('lesson_change_logs_id_seq'::regclass) NOT NULL,
  lesson_id integer NOT NULL,
  field_name character varying(50) NOT NULL,
  old_value text,
  new_value text,
  changed_by integer,
  changed_by_name character varying(255),
  changed_by_telegram_id character varying(50),
  changed_via character varying(20) DEFAULT 'admin'::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for lesson_change_logs
-- FOREIGN KEY: lesson_change_logs_changed_by_fkey => FOREIGN KEY (changed_by) REFERENCES users(id)
-- FOREIGN KEY: lesson_change_logs_lesson_id_fkey => FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
-- PRIMARY KEY: lesson_change_logs_pkey => PRIMARY KEY (id)

-- Indexes for lesson_change_logs
CREATE INDEX idx_lesson_change_logs_created_at ON public.lesson_change_logs USING btree (created_at DESC);
CREATE INDEX idx_lesson_change_logs_lesson_id ON public.lesson_change_logs USING btree (lesson_id);
CREATE UNIQUE INDEX lesson_change_logs_pkey ON public.lesson_change_logs USING btree (id);

-- Table: lesson_teacher_replacements
CREATE TABLE lesson_teacher_replacements (
  id integer NOT NULL,
  lesson_id integer NOT NULL,
  original_teacher_id integer NOT NULL,
  replacement_teacher_id integer NOT NULL,
  replaced_by integer NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for lesson_teacher_replacements
-- FOREIGN KEY: lesson_teacher_replacements_lesson_id_fkey => FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
-- FOREIGN KEY: lesson_teacher_replacements_original_teacher_id_fkey => FOREIGN KEY (original_teacher_id) REFERENCES users(id) ON DELETE RESTRICT
-- FOREIGN KEY: lesson_teacher_replacements_replaced_by_fkey => FOREIGN KEY (replaced_by) REFERENCES users(id) ON DELETE RESTRICT
-- FOREIGN KEY: lesson_teacher_replacements_replacement_teacher_id_fkey => FOREIGN KEY (replacement_teacher_id) REFERENCES users(id) ON DELETE RESTRICT
-- PRIMARY KEY: lesson_teacher_replacements_pkey => PRIMARY KEY (id)

-- Indexes for lesson_teacher_replacements
CREATE INDEX idx_lesson_teacher_replacements_lesson ON public.lesson_teacher_replacements USING btree (lesson_id);
CREATE INDEX idx_lesson_teacher_replacements_replacement_teacher ON public.lesson_teacher_replacements USING btree (replacement_teacher_id);
CREATE UNIQUE INDEX lesson_teacher_replacements_pkey ON public.lesson_teacher_replacements USING btree (id);

-- Table: lessons
CREATE TABLE lessons (
  id integer NOT NULL,
  group_id integer,
  lesson_date date NOT NULL,
  start_datetime timestamp with time zone NOT NULL,
  end_datetime timestamp with time zone NOT NULL,
  topic text,
  status text DEFAULT 'scheduled'::text NOT NULL,
  created_by integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  teacher_id integer,
  notes text,
  topic_set_by integer,
  topic_set_at timestamp without time zone,
  notes_set_by integer,
  notes_set_at timestamp without time zone,
  public_id text,
  telegram_user_info jsonb,
  reported_by integer,
  reported_at timestamp with time zone,
  reported_via text,
  course_id integer,
  original_date date,
  is_makeup boolean DEFAULT false NOT NULL,
  is_trial boolean DEFAULT false NOT NULL
);

-- Constraints for lessons
-- CHECK: lessons_reported_via_check => CHECK ((reported_via = ANY (ARRAY['telegram'::text, 'web'::text, NULL::text])))
-- CHECK: lessons_status_check => CHECK ((status = ANY (ARRAY['scheduled'::text, 'done'::text, 'canceled'::text])))
-- FOREIGN KEY: lessons_course_id_fkey => FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
-- FOREIGN KEY: lessons_created_by_fkey => FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
-- FOREIGN KEY: lessons_group_id_fkey => FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
-- FOREIGN KEY: lessons_notes_set_by_fkey => FOREIGN KEY (notes_set_by) REFERENCES users(id)
-- FOREIGN KEY: lessons_reported_by_fkey => FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL
-- FOREIGN KEY: lessons_teacher_id_fkey => FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
-- FOREIGN KEY: lessons_topic_set_by_fkey => FOREIGN KEY (topic_set_by) REFERENCES users(id)
-- PRIMARY KEY: lessons_pkey => PRIMARY KEY (id)
-- UNIQUE: lessons_public_id_key => UNIQUE (public_id)

-- Indexes for lessons
CREATE INDEX idx_lessons_date ON public.lessons USING btree (lesson_date);
CREATE INDEX idx_lessons_group_billable_date ON public.lessons USING btree (group_id, lesson_date) WHERE ((status <> 'canceled'::text) AND (is_makeup = false) AND (is_trial = false));
CREATE INDEX idx_lessons_group_date ON public.lessons USING btree (group_id, lesson_date);
CREATE INDEX idx_lessons_group_status_date ON public.lessons USING btree (group_id, status, lesson_date);
CREATE INDEX idx_lessons_scheduled_date ON public.lessons USING btree (lesson_date) WHERE (status = 'scheduled'::text);
CREATE INDEX idx_lessons_status ON public.lessons USING btree (status);
CREATE INDEX idx_lessons_teacher_date ON public.lessons USING btree (teacher_id, lesson_date);
CREATE UNIQUE INDEX lessons_pkey ON public.lessons USING btree (id);
CREATE UNIQUE INDEX lessons_public_id_key ON public.lessons USING btree (public_id);

-- Table: media_files
CREATE TABLE media_files (
  id integer DEFAULT nextval('media_files_id_seq'::regclass) NOT NULL,
  topic_id integer,
  telegram_file_id text NOT NULL,
  telegram_message_id bigint,
  file_name text,
  file_type text,
  file_size integer,
  drive_file_id text NOT NULL,
  drive_view_url text,
  drive_download_url text,
  uploaded_by_telegram_id bigint,
  uploaded_by_name text,
  created_at timestamp with time zone DEFAULT now(),
  media_width integer,
  media_height integer
);

-- Constraints for media_files
-- FOREIGN KEY: media_files_topic_id_fkey => FOREIGN KEY (topic_id) REFERENCES media_topics(id) ON DELETE SET NULL
-- PRIMARY KEY: media_files_pkey => PRIMARY KEY (id)

-- Indexes for media_files
CREATE INDEX idx_media_files_created_at ON public.media_files USING btree (created_at DESC);
CREATE INDEX idx_media_files_file_name_trgm ON public.media_files USING gin (file_name gin_trgm_ops);
CREATE INDEX idx_media_files_topic_created_at ON public.media_files USING btree (topic_id, created_at DESC);
CREATE INDEX idx_media_files_topic_id ON public.media_files USING btree (topic_id);
CREATE UNIQUE INDEX media_files_pkey ON public.media_files USING btree (id);

-- Table: media_topics
CREATE TABLE media_topics (
  id integer DEFAULT nextval('media_topics_id_seq'::regclass) NOT NULL,
  thread_id bigint NOT NULL,
  name text NOT NULL,
  drive_folder_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for media_topics
-- PRIMARY KEY: media_topics_pkey => PRIMARY KEY (id)
-- UNIQUE: media_topics_thread_id_key => UNIQUE (thread_id)

-- Indexes for media_topics
CREATE UNIQUE INDEX media_topics_pkey ON public.media_topics USING btree (id);
CREATE UNIQUE INDEX media_topics_thread_id_key ON public.media_topics USING btree (thread_id);

-- Table: notes
CREATE TABLE notes (
  id integer DEFAULT nextval('notes_id_seq'::regclass) NOT NULL,
  user_id integer NOT NULL,
  type text DEFAULT 'note'::text NOT NULL,
  title text DEFAULT ''::text NOT NULL,
  content text DEFAULT ''::text NOT NULL,
  tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
  color text,
  is_pinned boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  tags ARRAY DEFAULT '{}'::text[] NOT NULL,
  deadline date,
  is_archived boolean DEFAULT false NOT NULL,
  remind_at timestamp with time zone,
  reminded boolean DEFAULT false NOT NULL,
  linked_student_id integer,
  linked_group_id integer
);

-- Constraints for notes
-- FOREIGN KEY: notes_linked_group_id_fkey => FOREIGN KEY (linked_group_id) REFERENCES groups(id) ON DELETE SET NULL
-- FOREIGN KEY: notes_linked_student_id_fkey => FOREIGN KEY (linked_student_id) REFERENCES students(id) ON DELETE SET NULL
-- FOREIGN KEY: notes_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- PRIMARY KEY: notes_pkey => PRIMARY KEY (id)

-- Indexes for notes
CREATE INDEX notes_linked_group_idx ON public.notes USING btree (linked_group_id) WHERE (linked_group_id IS NOT NULL);
CREATE INDEX notes_linked_student_idx ON public.notes USING btree (linked_student_id) WHERE (linked_student_id IS NOT NULL);
CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (id);
CREATE INDEX notes_user_id_idx ON public.notes USING btree (user_id);

-- Table: notification_clears
CREATE TABLE notification_clears (
  user_id integer NOT NULL,
  cleared_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Constraints for notification_clears
-- FOREIGN KEY: notification_clears_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- PRIMARY KEY: notification_clears_pkey => PRIMARY KEY (user_id)

-- Indexes for notification_clears
CREATE UNIQUE INDEX notification_clears_pkey ON public.notification_clears USING btree (user_id);

-- Table: notification_reads
CREATE TABLE notification_reads (
  notification_id integer NOT NULL,
  user_id integer NOT NULL,
  read_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Constraints for notification_reads
-- FOREIGN KEY: notification_reads_notification_id_fkey => FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
-- FOREIGN KEY: notification_reads_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- PRIMARY KEY: notification_reads_pkey => PRIMARY KEY (notification_id, user_id)

-- Indexes for notification_reads
CREATE INDEX idx_notif_reads_user ON public.notification_reads USING btree (user_id);
CREATE UNIQUE INDEX notification_reads_pkey ON public.notification_reads USING btree (notification_id, user_id);

-- Table: notifications
CREATE TABLE notifications (
  id integer DEFAULT nextval('notifications_id_seq'::regclass) NOT NULL,
  type character varying(50) NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  data jsonb,
  is_global boolean DEFAULT true NOT NULL,
  target_user_id integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  dedup_key text
);

-- Constraints for notifications
-- FOREIGN KEY: notifications_target_user_id_fkey => FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
-- PRIMARY KEY: notifications_pkey => PRIMARY KEY (id)

-- Indexes for notifications
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE UNIQUE INDEX idx_notifications_dedup_key ON public.notifications USING btree (dedup_key) WHERE (dedup_key IS NOT NULL);
CREATE INDEX idx_notifications_target_user ON public.notifications USING btree (target_user_id);
CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);
CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

-- Table: payments
CREATE TABLE payments (
  id integer NOT NULL,
  student_id integer NOT NULL,
  group_id integer NOT NULL,
  month date NOT NULL,
  amount integer NOT NULL,
  method text NOT NULL,
  paid_at timestamp with time zone DEFAULT now() NOT NULL,
  note text,
  created_by integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for payments
-- CHECK: payments_method_check => CHECK ((method = ANY (ARRAY['cash'::text, 'account'::text])))
-- FOREIGN KEY: payments_created_by_fkey => FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
-- FOREIGN KEY: payments_group_id_fkey => FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
-- FOREIGN KEY: payments_student_id_fkey => FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
-- PRIMARY KEY: payments_pkey => PRIMARY KEY (id)
-- UNIQUE: payments_student_id_group_id_month_method_paid_at_key => UNIQUE (student_id, group_id, month, method, paid_at)

-- Indexes for payments
CREATE INDEX idx_payments_group ON public.payments USING btree (group_id);
CREATE INDEX idx_payments_group_month_student ON public.payments USING btree (group_id, month, student_id);
CREATE INDEX idx_payments_month ON public.payments USING btree (month);
CREATE INDEX idx_payments_paid_at ON public.payments USING btree (paid_at DESC);
CREATE INDEX idx_payments_student ON public.payments USING btree (student_id);
CREATE INDEX idx_payments_student_group_month ON public.payments USING btree (student_id, group_id, month);
CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);
CREATE UNIQUE INDEX payments_student_id_group_id_month_method_paid_at_key ON public.payments USING btree (student_id, group_id, month, method, paid_at);

-- Table: pricing
CREATE TABLE pricing (
  id integer NOT NULL,
  group_id integer NOT NULL,
  monthly_price integer NOT NULL,
  currency text DEFAULT 'UAH'::text,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for pricing
-- FOREIGN KEY: pricing_group_id_fkey => FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
-- PRIMARY KEY: pricing_pkey => PRIMARY KEY (id)

-- Indexes for pricing
CREATE INDEX idx_pricing_group ON public.pricing USING btree (group_id, effective_from);
CREATE UNIQUE INDEX pricing_pkey ON public.pricing USING btree (id);

-- Table: salary_extra_items
CREATE TABLE salary_extra_items (
  id integer DEFAULT nextval('salary_extra_items_id_seq'::regclass) NOT NULL,
  teacher_id integer NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_by integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for salary_extra_items
-- FOREIGN KEY: salary_extra_items_created_by_fkey => FOREIGN KEY (created_by) REFERENCES users(id)
-- FOREIGN KEY: salary_extra_items_teacher_id_fkey => FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
-- PRIMARY KEY: salary_extra_items_pkey => PRIMARY KEY (id)

-- Indexes for salary_extra_items
CREATE UNIQUE INDEX salary_extra_items_pkey ON public.salary_extra_items USING btree (id);
CREATE INDEX salary_extra_items_teacher_month ON public.salary_extra_items USING btree (teacher_id, year, month);

-- Table: sessions
CREATE TABLE sessions (
  id text NOT NULL,
  user_id integer NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for sessions
-- FOREIGN KEY: sessions_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- PRIMARY KEY: sessions_pkey => PRIMARY KEY (id)

-- Indexes for sessions
CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires_at);
CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);
CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id);

-- Table: student_groups
CREATE TABLE student_groups (
  id integer NOT NULL,
  student_id integer NOT NULL,
  group_id integer NOT NULL,
  join_date date DEFAULT CURRENT_DATE NOT NULL,
  leave_date date,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active'::text NOT NULL
);

-- Constraints for student_groups
-- CHECK: student_groups_status_check => CHECK ((status = ANY (ARRAY['active'::text, 'graduated'::text, 'removed'::text])))
-- FOREIGN KEY: student_groups_group_id_fkey => FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
-- FOREIGN KEY: student_groups_student_id_fkey => FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
-- PRIMARY KEY: student_groups_pkey => PRIMARY KEY (id)
-- UNIQUE: student_groups_student_id_group_id_join_date_key => UNIQUE (student_id, group_id, join_date)

-- Indexes for student_groups
CREATE INDEX idx_student_groups_active ON public.student_groups USING btree (is_active);
CREATE INDEX idx_student_groups_group ON public.student_groups USING btree (group_id);
CREATE INDEX idx_student_groups_group_active ON public.student_groups USING btree (group_id, is_active);
CREATE INDEX idx_student_groups_status ON public.student_groups USING btree (status);
CREATE INDEX idx_student_groups_student ON public.student_groups USING btree (student_id);
CREATE INDEX idx_student_groups_student_active ON public.student_groups USING btree (student_id, is_active);
CREATE INDEX idx_student_groups_student_group_active ON public.student_groups USING btree (student_id, group_id, is_active);
CREATE UNIQUE INDEX student_groups_pkey ON public.student_groups USING btree (id);
CREATE UNIQUE INDEX student_groups_student_id_group_id_join_date_key ON public.student_groups USING btree (student_id, group_id, join_date);

-- Table: student_history
CREATE TABLE student_history (
  id integer DEFAULT nextval('student_history_id_seq'::regclass) NOT NULL,
  student_id integer NOT NULL,
  action_type text NOT NULL,
  action_description text NOT NULL,
  old_value text,
  new_value text,
  user_id integer NOT NULL,
  user_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Constraints for student_history
-- FOREIGN KEY: student_history_student_id_fkey => FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
-- FOREIGN KEY: student_history_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
-- PRIMARY KEY: student_history_pkey => PRIMARY KEY (id)

-- Indexes for student_history
CREATE INDEX idx_student_history_created ON public.student_history USING btree (created_at);
CREATE INDEX idx_student_history_student ON public.student_history USING btree (student_id);
CREATE UNIQUE INDEX student_history_pkey ON public.student_history USING btree (id);

-- Table: students
CREATE TABLE students (
  id integer NOT NULL,
  public_id text,
  full_name text NOT NULL,
  phone text,
  email text,
  parent_name text,
  parent_phone text,
  notes text,
  birth_date date,
  photo text,
  school text,
  discount integer DEFAULT 0,
  parent_relation text,
  parent2_name text,
  parent2_relation text,
  interested_courses text,
  source text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  parent2_phone text
);

-- Constraints for students
-- PRIMARY KEY: students_pkey => PRIMARY KEY (id)
-- UNIQUE: students_public_id_key => UNIQUE (public_id)

-- Indexes for students
CREATE INDEX idx_students_active ON public.students USING btree (is_active);
CREATE INDEX idx_students_full_name_trgm ON public.students USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_students_name ON public.students USING btree (full_name);
CREATE INDEX idx_students_parent_name_trgm ON public.students USING gin (parent_name gin_trgm_ops);
CREATE INDEX idx_students_parent_phone_trgm ON public.students USING gin (parent_phone gin_trgm_ops);
CREATE INDEX idx_students_phone_trgm ON public.students USING gin (phone gin_trgm_ops);
CREATE UNIQUE INDEX idx_students_public_id ON public.students USING btree (public_id);
CREATE UNIQUE INDEX students_pkey ON public.students USING btree (id);
CREATE UNIQUE INDEX students_public_id_key ON public.students USING btree (public_id);

-- Table: completion_certificates
CREATE TABLE completion_certificates (
  id SERIAL PRIMARY KEY,
  student_id integer NOT NULL,
  course_id integer,
  group_id integer,
  issue_date date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  template_url text,
  created_by integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_completion_certificates_student_id ON public.completion_certificates USING btree (student_id);
CREATE INDEX idx_completion_certificates_course_id ON public.completion_certificates USING btree (course_id);

-- Table: system_settings
CREATE TABLE system_settings (
  key text NOT NULL,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Constraints for system_settings
-- PRIMARY KEY: system_settings_pkey => PRIMARY KEY (key)

-- Indexes for system_settings
CREATE UNIQUE INDEX system_settings_pkey ON public.system_settings USING btree (key);

-- Table: user_settings
CREATE TABLE user_settings (
  user_id integer NOT NULL,
  language text DEFAULT 'uk'::text,
  timezone text DEFAULT 'Europe/Kyiv'::text,
  date_format text DEFAULT 'DD.MM.YYYY'::text,
  currency text DEFAULT 'UAH'::text,
  email_notifications integer DEFAULT 1,
  push_notifications integer DEFAULT 1,
  lesson_reminders integer DEFAULT 1,
  payment_alerts integer DEFAULT 1,
  weekly_report integer DEFAULT 1,
  weather_city text DEFAULT 'Kyiv'::text
);

-- Constraints for user_settings
-- FOREIGN KEY: user_settings_user_id_fkey => FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- PRIMARY KEY: user_settings_pkey => PRIMARY KEY (user_id)

-- Indexes for user_settings
CREATE UNIQUE INDEX user_settings_pkey ON public.user_settings USING btree (user_id);

-- Table: users
CREATE TABLE users (
  id integer NOT NULL,
  public_id text,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  phone text,
  telegram_id text,
  photo_url text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_owner boolean DEFAULT false NOT NULL,
  must_change_password boolean DEFAULT false NOT NULL
);

-- Constraints for users
-- CHECK: users_role_check => CHECK ((role = ANY (ARRAY['admin'::text, 'teacher'::text])))
-- PRIMARY KEY: users_pkey => PRIMARY KEY (id)
-- UNIQUE: users_email_key => UNIQUE (email)
-- UNIQUE: users_public_id_key => UNIQUE (public_id)

-- Indexes for users
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE UNIQUE INDEX idx_users_public_id ON public.users USING btree (public_id);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);
CREATE UNIQUE INDEX users_public_id_key ON public.users USING btree (public_id);
