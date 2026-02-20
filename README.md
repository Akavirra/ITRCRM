# ITRCRM

ITRCrobotCRM is a comprehensive admin panel for managing a robotics and technology course school. The system handles students, groups, lessons, attendance tracking, and payment management with role-based access control.

## Features

- **Authentication**: Session-based login/logout with secure password hashing
- **Role-based Access Control**: Two roles - Admin (full access) and Teacher (limited access)
- **Courses**: Create and manage course catalog with descriptions, age requirements, duration, and program materials
- **Groups**: Manage student groups with scheduling (day of week, time, duration), assigned teachers, and pricing
- **Students**: Comprehensive student records including contact information, parent details, birth dates, and notes
- **Teachers**: Manage teacher profiles with photos, contact information, and group assignments
- **Lessons**: Auto-generation of lessons based on group schedule parameters (8 weeks ahead)
- **Attendance**: Track student attendance with multiple statuses (present, absent, makeup planned, makeup completed)
- **Payments**: Monthly payment tracking with multiple payment methods (cash, account transfer)
- **Reports**: Generate attendance reports, payment history, and debt reports with CSV export functionality

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Database**: SQLite with better-sqlite3
- **Authentication**: Session-based auth with bcrypt password hashing
- **Styling**: Custom CSS (no external UI frameworks)

## Installation

### Prerequisites

- Node.js 18+
- npm

### Windows

```cmd
:: Install dependencies
npm install

:: Initialize database with seed data
npm run db:seed

:: Start development server
npm run dev
```

### Linux/Mac

```bash
# Install dependencies
npm install

# Initialize database with seed data
npm run db:seed

# Start development server
npm run dev
```

After starting the server, open your browser and navigate to `http://localhost:3000/login`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret key used for session token signing. Must be a strong, unique string. |
| `NODE_ENV` | Environment mode: `development` or `production` |
| `DB_PATH` | (Optional) Custom path to SQLite database file |

> ⚠️ **SECURITY WARNING**: Before deploying to production, you MUST replace all default credentials, secret keys, and sensitive configuration values with strong, unique values. This includes database credentials, JWT secrets, API keys, and any other sensitive parameters. Never use default or example values in production.

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Administrators and teachers (id, name, email, password_hash, role, is_active) |
| `courses` | Course catalog (id, title, description, age_min, duration_months, program, flyer_path, is_active) |
| `groups` | Student groups with schedule (id, course_id, teacher_id, title, weekly_day, start_time, duration_minutes, start_date, end_date, capacity, monthly_price, status) |
| `students` | Student records (id, full_name, phone, parent_name, parent_phone, notes, birth_date, photo, school, discount) |
| `student_groups` | Many-to-many relationship linking students to groups (student_id, group_id, join_date, leave_date, is_active) |
| `lessons` | Generated lessons (id, group_id, lesson_date, start_datetime, end_datetime, topic, status, created_by) |
| `attendance` | Student attendance records (id, lesson_id, student_id, status, comment, makeup_lesson_id, updated_by) |
| `payments` | Payment records (id, student_id, group_id, month, amount, method, paid_at, note, created_by) |
| `pricing` | Group pricing history (id, group_id, monthly_price, currency, effective_from, effective_to) |
| `sessions` | Authentication sessions (id, user_id, expires_at) |
| `error_logs` | Error logging (id, error_message, error_stack, user_id, request_path, request_method) |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current authenticated user

### Courses
- `GET /api/courses` - List all active courses
- `POST /api/courses` - Create new course (Admin only)
- `GET /api/courses/[id]` - Get course details
- `PUT /api/courses/[id]` - Update course (Admin only)
- `DELETE /api/courses/[id]` - Archive course (Admin only)
- `GET /api/courses/[id]/groups` - Get groups for a course
- `GET /api/courses/[id]/students` - Get students enrolled in course groups
- `POST /api/courses/[id]/flyer` - Upload course flyer image
- `GET /api/courses/[id]/program-pdf` - Generate program PDF

### Groups
- `GET /api/groups` - List groups (filtered by teacher for teachers)
- `POST /api/groups` - Create new group (Admin only)
- `GET /api/groups/[id]` - Get group details
- `PUT /api/groups/[id]` - Update group (Admin only)
- `DELETE /api/groups/[id]` - Archive group (Admin only)
- `GET /api/groups/[id]/students` - Get students in group
- `POST /api/groups/[id]/students` - Add student to group (Admin only)
- `POST /api/groups/[id]/generate-lessons` - Generate lessons for group
- `GET /api/groups/[id]/payments` - Get payment status for group

### Students
- `GET /api/students` - List all students
- `POST /api/students` - Create new student (Admin only)
- `GET /api/students/[id]` - Get student details
- `PUT /api/students/[id]` - Update student (Admin only)
- `DELETE /api/students/[id]` - Archive student (Admin only)

### Teachers
- `GET /api/teachers` - List all teachers
- `POST /api/teachers` - Create new teacher (Admin only)
- `GET /api/teachers/[id]` - Get teacher details
- `PUT /api/teachers/[id]` - Update teacher (Admin only)
- `DELETE /api/teachers/[id]` - Archive teacher (Admin only)

### Lessons
- `GET /api/lessons` - List lessons (filtered by group access)
- `GET /api/lessons/[id]` - Get lesson details
- `PUT /api/lessons/[id]` - Update lesson (topic, status)
- `GET /api/lessons/[id]/attendance` - Get attendance for lesson
- `POST /api/lessons/[id]/attendance` - Set attendance for lesson

### Reports
- `GET /api/reports/attendance` - Generate attendance report with date range
- `GET /api/reports/payments` - Generate payments report
- `GET /api/reports/debts` - Generate debts report

### Users
- `GET /api/users` - List all users (Admin only)
- `POST /api/users` - Create new user (Admin only)

## Role Permissions

### Admin
- Full access to all modules and features
- Can manage users (create, update, deactivate)
- Can manage courses, groups, and students
- Can manage teachers
- Can access and modify all payment records
- Can view financial reports and export data
- Can archive/restore any entity
- Can upload course materials and flyers

### Teacher
- Limited to assigned groups only
- Can view students in their groups
- Can mark attendance and set lesson topics
- Can view lessons for their groups
- Cannot access payment or financial data
- Cannot create or modify users, courses, groups, or teachers
- Cannot access admin-only settings

## Project Structure

```
ITRobotCRM/
├── public/
│   └── uploads/
│       ├── course-flyers/        # Uploaded course flyer images
│       └── teacher-photos/      # Uploaded teacher photos
├── scripts/
│   ├── backfill-public-ids.js   # Script to generate public IDs
│   ├── migrate-courses.js       # Course migration script
│   ├── migrate-students.js      # Student migration script
│   ├── reset.js                 # Database reset script
│   ├── seed.js                  # Database seeding script
│   ├── start-prod.js            # Production startup script
│   └── verify-public-ids.js     # Public ID verification script
├── src/
│   ├── app/
│   │   ├── (app)/               # Authenticated pages (dashboard, courses, groups, etc.)
│   │   │   ├── courses/         # Course management pages
│   │   │   │   └── [id]/        # Course detail page
│   │   │   ├── dashboard/       # Dashboard overview
│   │   │   ├── groups/          # Group management pages
│   │   │   │   ├── new/         # Create new group
│   │   │   │   └── [id]/        # Group detail page
│   │   │   │       └── edit/    # Edit group page
│   │   │   ├── reports/         # Reports with CSV export
│   │   │   ├── settings/        # Application settings
│   │   │   ├── students/        # Student management pages
│   │   │   │   └── [id]/        # Student detail page
│   │   │   ├── teachers/        # Teacher management pages
│   │   │   │   └── [id]/        # Teacher detail page
│   │   │   └── users/           # User management (Admin only)
│   │   ├── (auth)/              # Authentication pages
│   │   │   └── login/           # Login page
│   │   ├── api/                 # API routes
│   │   │   ├── auth/            # Authentication endpoints
│   │   │   │   ├── login/
│   │   │   │   ├── logout/
│   │   │   │   └── me/
│   │   │   ├── courses/         # Course CRUD endpoints
│   │   │   │   └── [id]/
│   │   │   │       ├── archive/
│   │   │   │       ├── flyer/
│   │   │   │       ├── groups/
│   │   │   │       ├── program-pdf/
│   │   │   │       └── students/
│   │   │   ├── groups/          # Group CRUD endpoints
│   │   │   │   └── [id]/
│   │   │   │       ├── archive/
│   │   │   │       ├── generate-lessons/
│   │   │   │       ├── payments/
│   │   │   │       └── students/
│   │   │   ├── lessons/         # Lesson management endpoints
│   │   │   │   └── [id]/
│   │   │   │       └── attendance/
│   │   │   ├── reports/         # Report generation endpoints
│   │   │   │   ├── attendance/
│   │   │   │   ├── debts/
│   │   │   │   └── payments/
│   │   │   ├── students/        # Student CRUD endpoints
│   │   │   │   └── [id]/
│   │   │   ├── teachers/        # Teacher CRUD endpoints
│   │   │   │   └── [id]/
│   │   │   └── users/           # User management endpoints
│   │   ├── globals.css          # Global styles
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Landing page
│   ├── components/              # Reusable React components
│   │   ├── CourseModalsContext.tsx
│   │   ├── CourseModalsManager.tsx
│   │   ├── CourseModalsProvider.tsx
│   │   ├── CourseModalsWrapper.tsx
│   │   ├── DraggableModal.tsx
│   │   ├── GroupModalsContext.tsx
│   │   ├── GroupModalsManager.tsx
│   │   ├── GroupModalsProvider.tsx
│   │   ├── GroupModalsWrapper.tsx
│   │   ├── Header.tsx
│   │   ├── IconButton.tsx
│   │   ├── Layout.tsx
│   │   ├── Portal.tsx
│   │   ├── SearchInput.tsx
│   │   ├── StudentModalsContext.tsx
│   │   ├── StudentModalsManager.tsx
│   │   ├── StudentModalsProvider.tsx
│   │   ├── StudentModalsWrapper.tsx
│   │   ├── TeacherModalsContext.tsx
│   │   ├── TeacherModalsManager.tsx
│   │   ├── TeacherModalsProvider.tsx
│   │   ├── TeacherModalsWrapper.tsx
│   │   ├── Navbar/
│   │   │   ├── index.ts
│   │   │   ├── Navbar.module.css
│   │   │   └── Navbar.tsx
│   │   └── Sidebar/
│   │       └── Sidebar.tsx
│   ├── db/
│   │   ├── index.ts             # Database operations
│   │   └── schema.sql           # Schema definitions
│   ├── i18n/                    # Internationalization
│   │   ├── pluralUk.ts          # Ukrainian plural forms
│   │   ├── t.ts                 # Translation utilities
│   │   └── uk.ts                # Ukrainian translations
│   └── lib/                     # Business logic utilities
│       ├── api-utils.ts         # API utilities
│       ├── attendance.ts        # Attendance operations
│       ├── auth.ts              # Authentication utilities
│       ├── courses.ts           # Course operations
│       ├── date-utils.ts        # Date manipulation utilities
│       ├── groups.ts            # Group operations
│       ├── lessons.ts           # Lesson operations
│       ├── payments.ts          # Payment processing
│       ├── public-id.ts         # Public ID generation
│       └── students.ts          # Student operations
├── tests/                       # Test files
│   ├── lessons.test.ts          # Lesson tests
│   └── student-status.test.ts   # Student status tests
├── assets/
│   └── fonts/                   # Font files
├── data/                        # Database storage (gitignored)
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── jest.config.js               # Jest configuration
├── next.config.js               # Next.js configuration
├── package.json                 # Project dependencies
├── package-lock.json            # Locked dependencies
├── tsconfig.json                # TypeScript configuration
└── README.md                    # This file
```

## Development

```bash
# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run production build with custom start script
npm run prod

# Run tests
npm test

# Run database migration
npm run db:migrate

# Reset database (delete and reinitialize)
npm run db:reset

# Seed database with initial data
npm run db:seed
```

## Database Troubleshooting

### Windows

#### Reset Database

1. Stop the development server (press `Ctrl+C`)
2. Delete the database file:
   ```cmd
   del data\school.db
   ```
3. (Optional) Clear Next.js cache for clean rebuild:
   ```cmd
   rmdir /s /q .next
   ```
4. Restart the development server:
   ```cmd
   npm run dev
   ```
5. Reinitialize with seed data:
   ```cmd
   npm run db:seed
   ```

#### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `SQLITE_ERROR: no such table` | Missing database tables | Delete `data\school.db` and restart |
| `SQLITE_ERROR: table has no column` | Schema mismatch | Delete `data\school.db` and restart |
| Login refresh loop | Missing sessions table | Delete `data\school.db` and restart |
| "Database is locked" | Concurrent database access | Close all terminals and applications using the DB |

### Linux/Mac

#### Reset Database

1. Stop the development server (`Ctrl+C`)
2. Delete the database file:
   ```bash
   rm data/school.db
   ```
3. (Optional) Clear Next.js cache:
   ```bash
   rm -rf .next
   ```
4. Restart the development server:
   ```bash
   npm run dev
   ```
5. Reinitialize with seed data:
   ```bash
   npm run db:seed
   ```

#### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `SQLITE_ERROR: no such table` | Missing database tables | Delete `data/school.db` and restart |
| `SQLITE_ERROR: table has no column` | Schema mismatch | Delete `data/school.db` and restart |
| Login refresh loop | Missing sessions table | Delete `data/school.db` and restart |
| "Database is locked" | Concurrent database access | Close all processes using the DB |

### Database File Location

- **Default**: `data/school.db` (relative to project root)
- **Custom**: Set `DB_PATH` environment variable

### Automatic Recovery

During development, the application automatically:
- Creates missing tables on startup
- Seeds demo users if they don't exist
- Runs schema migrations when needed

> ⚠️ **Production Note**: In production, the database is never auto-deleted. Schema changes require proper migration scripts to preserve data.

## License

MIT
