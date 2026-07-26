import DashGame from './DashGame'
import type { GameScreenProps } from './DashGame'
import { SAFARI_THEME } from './themes'

export default function SafariDash(props: GameScreenProps) {
  return <DashGame {...props} theme={SAFARI_THEME} />
}
