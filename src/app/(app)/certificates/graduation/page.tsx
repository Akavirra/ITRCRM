import { redirect } from 'next/navigation';

export default function GraduationCertificatesPage() {
  redirect('/certificates?tab=completion');
}
