import { Link } from 'react-router-dom'
import { BRAND_NAME, Logo } from '@/shared/theme/design'
import HeaderControls from './HeaderControls'
import SaveIndicator from './SaveIndicator'
import type { AppHeaderProps } from '@/interfaces/components/AppHeaderProps'

export default function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <Logo size={26} /> <span>{BRAND_NAME}</span>
      </Link>
      <div className="header-extra">{children}</div>
      <div className="header-actions">
        <HeaderControls />
        <SaveIndicator />
      </div>
    </header>
  )
}
