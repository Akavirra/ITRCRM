'use client';

interface CertificateEditorLoadingNoticeProps {
  description: string;
}

export default function CertificateEditorLoadingNotice({
  description,
}: CertificateEditorLoadingNoticeProps) {
  return (
    <div className="empty-state" style={{ minHeight: '180px', marginBottom: '16px' }}>
      <h3 className="empty-state-title">Готуємо редактор…</h3>
      <p className="empty-state-description">{description}</p>
    </div>
  );
}
