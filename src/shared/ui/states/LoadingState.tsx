import { LottieAnimation } from '@/shared/ui/LottieAnimation'
import loadingAnim from '@/shared/assets/animations/loading3.json'

type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-8 text-sm font-medium text-on-surface-variant"
      role="status"
      aria-live="polite"
    >
      <div className="h-16 w-16">
        <LottieAnimation animationData={loadingAnim} loop={true} />
      </div>
      {label && <span className="tracking-wide">{label}</span>}
    </div>
  )
}

