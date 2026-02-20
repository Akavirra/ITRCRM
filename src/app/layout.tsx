import type { Metadata } from 'next';
import './globals.css';
import { GroupModalsProvider } from '@/components/GroupModalsProvider';
import GroupModalsWrapper from '@/components/GroupModalsWrapper';
import { StudentModalsProvider } from '@/components/StudentModalsProvider';
import StudentModalsWrapper from '@/components/StudentModalsWrapper';
import { CourseModalsProvider } from '@/components/CourseModalsProvider';
import CourseModalsWrapper from '@/components/CourseModalsWrapper';
import { TeacherModalsProvider } from '@/components/TeacherModalsProvider';
import TeacherModalsWrapper from '@/components/TeacherModalsWrapper';

export const metadata: Metadata = {
  title: 'Адміністрування школи',
  description: 'Панель керування школою курсів',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        <GroupModalsProvider>
          <StudentModalsProvider>
            <CourseModalsProvider>
              <TeacherModalsProvider>
                {children}
                <GroupModalsWrapper />
                <StudentModalsWrapper />
                <CourseModalsWrapper />
                <TeacherModalsWrapper />
              </TeacherModalsProvider>
            </CourseModalsProvider>
          </StudentModalsProvider>
        </GroupModalsProvider>
      </body>
    </html>
  );
}
