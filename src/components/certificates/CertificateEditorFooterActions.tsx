'use client';

interface CertificateEditorFooterActionsProps {
  className: string;
  onClose: () => void;
  onSaveSettings: () => void;
  onPrimaryAction: () => void;
  settingsDisabled: boolean;
  primaryDisabled: boolean;
  savingSettings: boolean;
  primaryLoading: boolean;
  primaryLabel: string;
  primaryLoadingLabel: string;
}

export default function CertificateEditorFooterActions({
  className,
  onClose,
  onSaveSettings,
  onPrimaryAction,
  settingsDisabled,
  primaryDisabled,
  savingSettings,
  primaryLoading,
  primaryLabel,
  primaryLoadingLabel,
}: CertificateEditorFooterActionsProps) {
  return (
    <div className={className}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button className="btn btn-secondary btn-close" onClick={onClose}>
          Закрити
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="btn btn-secondary" onClick={onSaveSettings} disabled={settingsDisabled}>
          {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд'}
        </button>
        <button className="btn btn-primary btn-generate" onClick={onPrimaryAction} disabled={primaryDisabled}>
          {primaryLoading ? primaryLoadingLabel : primaryLabel}
        </button>
      </div>
    </div>
  );
}
