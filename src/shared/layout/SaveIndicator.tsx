import { useI18n } from '@/shared/i18n/i18n'
import { useSaveStatus } from '@/shared/persistence/library'

export default function SaveIndicator() {
  const { t } = useI18n()
  const status = useSaveStatus()
  return (
    <span className="muted" role="status" aria-live="polite" style={{ fontSize: 13, color: status === 'error' ? 'var(--mantine-color-red-6, #c92a2a)' : undefined }}>
      {t(`save.${status}`)}
    </span>
  )
}
