# School Admin Panel

Admin panel for managing a school of courses. Ukrainian language interface.

## Features

- **Authentication**: Login/logout with session-based auth
- **Role-based access**: Admin (full access) and Teacher (limited access)
- **Courses**: CRUD operations for courses
- **Groups**: Manage groups with schedule, teacher, and pricing
- **Students**: Student management with group assignments
- **Lessons**: Auto-generation of lessons based on schedule
- **Attendance**: Track student attendance with multiple statuses
- **Payments**: Monthly payment tracking with debt calculation
- **Reports**: Attendance, payments, and debts reports with CSV export

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Database**: SQLite (better-sqlite3)
- **Auth**: Session-based with bcrypt password hashing
- **Styling**: Custom CSS (no external dependencies)

## Installation

```bash
# Install dependencies
npm install

# Initialize database and seed demo data
npm run db:seed

# Start development server
npm run dev
```

## Demo Credentials

- **Admin**: admin@school.ua / admin123
- **Teacher**: teacher@school.ua / teacher123

## Database Schema

### Tables

1. **users** - Administrators and teachers
2. **courses** - Course catalog
3. **groups** - Student groups with schedule
4. **students** - Student records
5. **student_groups** - Many-to-many student-group relationship
6. **lessons** - Generated lessons
7. **attendance** - Student attendance records
8. **payments** - Payment records
9. **pricing** - Group pricing history
10. **sessions** - Auth sessions
11. **error_logs** - Error logging

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course (admin)
- `GET /api/courses/[id]` - Get course
- `PUT /api/courses/[id]` - Update course (admin)
- `DELETE /api/courses/[id]` - Archive course (admin)

### Groups
- `GET /api/groups` - List groups (filtered by teacher for teachers)
- `POST /api/groups` - Create group (admin)
- `GET /api/groups/[id]` - Get group
- `PUT /api/groups/[id]` - Update group (admin)
- `DELETE /api/groups/[id]` - Archive group (admin)
- `GET /api/groups/[id]/students` - Get students in group
- `POST /api/groups/[id]/students` - Add student to group (admin)
- `POST /api/groups/[id]/generate-lessons` - Generate lessons
- `GET /api/groups/[id]/payments` - Get payment status

### Students
- `GET /api/students` - List students
- `POST /api/students` - Create student (admin)
- `GET /api/students/[id]` - Get student
- `PUT /api/students/[id]` - Update student (admin)
- `DELETE /api/students/[id]` - Archive student (admin)

### Lessons
- `GET /api/lessons` - List lessons
- `GET /api/lessons/[id]` - Get lesson
- `PUT /api/lessons/[id]` - Update lesson (topic, status)
- `GET /api/lessons/[id]/attendance` - Get attendance
- `POST /api/lessons/[id]/attendance` - Set attendance

### Reports
- `GET /api/reports/attendance` - Attendance report
- `GET /api/reports/payments` - Payments report
- `GET /api/reports/debts` - Debts report

### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user

## Project Structure

```
src/
  app/
    (app)/           # Authenticated pages
      dashboard/
      courses/
      groups/
      students/
      lessons/
      reports/
      users/
    (auth)/          # Auth pages
      login/
    api/             # API routes
      auth/
      courses/
      groups/
      students/
      lessons/
      reports/
      users/
    globals.css
    layout.tsx
    page.tsx
  components/
    Layout.tsx
  db/
    index.ts
    schema.sql
  lib/
    auth.ts
    courses.ts
    groups.ts
    students.ts
    lessons.ts
    attendance.ts
    payments.ts
    api-utils.ts
scripts/
  seed.js
```

## Role Permissions

### Admin
- Full access to all modules
- Can manage users, courses, groups, students
- Can manage payments and view financial reports
- Can archive/restore entities

### Teacher
- Can only see their assigned groups
- Can mark attendance and lesson topics
- Cannot access payments or financial data
- Cannot modify system settings

## Lesson Generation

Lessons are auto-generated based on group schedule:
- Weekly day (0-6, Sunday-Saturday)
- Start time (HH:MM)
- Duration in minutes
- Group start/end dates

Generate 8 weeks ahead with the "Generate Lessons" button.

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
```

## Environment Variables

Create `.env` file:
```
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

## Database Troubleshooting (Windows)

### How to Reset the Development Database

If you encounter SQLITE_ERROR or database schema issues, follow these steps:

#### Method 1: Manual Reset (Recommended)

1. **Stop the dev server** (press `Ctrl+C` in the terminal running `npm run dev`)

2. **Delete the database file**:
   ```cmd
   del data\school.db
   ```
   
3. **Delete the .next cache folder** (optional, for clean rebuild):
   ```cmd
   rmdir /s /q .next
   ```

4. **Restart the dev server**:
   ```cmd
   npm run dev
   ```

5. **Open browser** and navigate to `http://localhost:3000/login`

6. **Log in with demo credentials**:
   - Admin: `admin@school.ua` / `admin123`
   - Teacher: `teacher@school.ua` / `teacher123`

#### Method 2: Using npm script (if available)

```cmd
npm run db:reset
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| SQLITE_ERROR: no such table | Missing table | Delete `data\school.db` and restart |
| SQLITE_ERROR: table has no column | Schema mismatch | Delete `data\school.db` and restart |
| Refresh loop on login | Session table missing | Delete `data\school.db` and restart |
| "Database is locked" | Another process using DB | Close all terminals, restart |

### Database File Location

- **Default**: `data\school.db` (relative to project root)
- **Custom**: Set `DB_PATH` environment variable

### Automatic Recovery

In development mode, the app will automatically:
1. Create missing tables on startup
2. Seed demo users if they don't exist
3. Run schema migrations if needed

**Warning**: In production, the database is never auto-deleted. Schema changes require proper migrations.

## License

MIT