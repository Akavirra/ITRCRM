import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});
import { GroupModalsProvider } from '@/components/GroupModalsProvider';
import GroupModalsWrapper from '@/components/GroupModalsWrapper';
import { StudentModalsProvider } from '@/components/StudentModalsProvider';
import StudentModalsWrapper from '@/components/StudentModalsWrapper';
import { CourseModalsProvider } from '@/components/CourseModalsProvider';
import CourseModalsWrapper from '@/components/CourseModalsWrapper';
import { TeacherModalsProvider } from '@/components/TeacherModalsProvider';
import TeacherModalsWrapper from '@/components/TeacherModalsWrapper';
import { LessonModalsProvider } from '@/components/LessonModalsProvider';
import LessonModalsWrapper from '@/components/LessonModalsWrapper';
import { PageTransitionProvider } from '@/components/PageTransitionProvider';
import PageTransitionLoader from '@/components/PageTransitionLoader';
import { ToastProvider } from '@/components/Toast/ToastContext';
import ToastContainer from '@/components/Toast/ToastContainer';
import ErrorBoundary from '@/components/ErrorBoundary';
import { CalculatorProvider } from '@/components/CalculatorProvider';
import { MediaViewerProvider } from '@/components/MediaViewerProvider';

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
    <html lang="uk" className={inter.variable}>
      <body className={inter.className}>
        <ErrorBoundary>
          <MediaViewerProvider>
          <CalculatorProvider>
            <ToastProvider>
              <PageTransitionProvider>
                <GroupModalsProvider>
                  <StudentModalsProvider>
                    <CourseModalsProvider>
                      <TeacherModalsProvider>
                        <LessonModalsProvider>
                          {children}
                          <GroupModalsWrapper />
                          <StudentModalsWrapper />
                          <CourseModalsWrapper />
                          <TeacherModalsWrapper />
                          <LessonModalsWrapper />
                          <PageTransitionLoader />
                          <ToastContainer />
                        </LessonModalsProvider>
                      </TeacherModalsProvider>
                    </CourseModalsProvider>
                  </StudentModalsProvider>
                </GroupModalsProvider>
              </PageTransitionProvider>
            </ToastProvider>
          </CalculatorProvider>
          </MediaViewerProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
