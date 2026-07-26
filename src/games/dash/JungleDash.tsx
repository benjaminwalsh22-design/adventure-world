import DashGame from './DashGame'
import type { GameScreenProps } from './DashGame'
import { JUNGLE_THEME } from './themes'

export default function JungleDash(props: GameScreenProps) {
  return <DashGame {...props} theme={JUNGLE_THEME} />
}
