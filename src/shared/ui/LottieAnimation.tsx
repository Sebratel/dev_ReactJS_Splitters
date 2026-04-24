import Lottie from 'lottie-react'

interface LottieAnimationProps {
  animationData: unknown
  loop?: boolean
  autoplay?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * Componente genérico para paridade de animações com o Flutter.
 */
export function LottieAnimation({
  animationData,
  loop = true,
  autoplay = true,
  className,
  style,
}: LottieAnimationProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', ...style }}>
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
      />
    </div>
  )
}

