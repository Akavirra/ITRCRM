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
      <button className="btn btn-secondary" onClick={onClose}>
        Закрити
      </button>
      <button className="btn btn-primary" onClick={onSaveSettings} disabled={settingsDisabled}>
        {savingSettings ? 'Зберігаємо…' : 'Зберегти вигляд'}
      </button>
      <button className="btn btn-primary" onClick={onPrimaryAction} disabled={primaryDisabled}>
        {primaryLoading ? primaryLoadingLabel : primaryLabel}
      </button>
    </div>
  );
}
