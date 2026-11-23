import { Button } from '@mantine/core'
import { useEffect, useState } from 'react'
import { useI18n } from '@/shared/i18n/i18n'
import { useDialogs } from '@/shared/ui/Dialogs'
import { downloadText, startEmpty, startLibrary } from './library'
import type { ChildrenProps } from '@/interfaces/components/ChildrenProps'
import type { StartResult } from '@/interfaces/persistence/StartResult'

let starting: Promise<StartResult> | null = null

export default function LibraryGate({ children }: ChildrenProps) {
  const { t } = useI18n()
  const { confirm } = useDialogs()
  const [result, setResult] = useState<StartResult | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    starting ??= startLibrary()
    starting.then((r) => {
      setResult(r)
      setReady(r.ok)
    })
  }, [])

  if (ready) return <>{children}</>
  if (!result) return <p className="muted" style={{ padding: 24 }}>{t('common.loading')}</p>
  if (result.ok) return null

  const failure = result
  const startOver = async () => {
    if (!(await confirm({ title: t('library.startEmpty'), message: t('library.startEmptyConfirm'), confirmLabel: t('library.startEmpty'), danger: true }))) return
    await startEmpty(failure.raw)
    setReady(true)
  }

  return (
    <main className="page" style={{ maxWidth: 640, margin: '48px auto' }}>
      <h1>{t('library.errorTitle')}</h1>
      <div className="error">{failure.message}</div>
      <p className="muted">{t('library.errorHelp')}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => window.location.reload()}>{t('library.retry')}</Button>
        {failure.raw !== null && (
          <Button variant="default" onClick={() => downloadText(failure.raw ?? '', 'bibliotheque-illisible.arbora.bak', 'application/json')}>
            {t('library.downloadRaw')}
          </Button>
        )}
        <Button variant="default" color="red" onClick={startOver}>
          {t('library.startEmpty')}
        </Button>
      </div>
    </main>
  )
}
