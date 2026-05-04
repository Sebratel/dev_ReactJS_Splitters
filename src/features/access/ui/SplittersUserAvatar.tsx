import { useState } from 'react'
import type { SplittersUserProfile } from '@/features/access/model/access.types'
import { userInitials } from '@/features/access/lib/splittersUserRoles'
import { cn } from '@/shared/lib/utils'

type AvatarSize = 'sm' | 'md'

const shellClass: Record<AvatarSize, string> = {
  sm: 'size-10 text-xs',
  md: 'size-11 text-xs',
}

type SplittersUserAvatarProps = {
  user: SplittersUserProfile
  size?: AvatarSize
  className?: string
}

export function SplittersUserAvatar({ user, size = 'sm', className }: SplittersUserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const url = user.photoURL?.trim()

  const fallback = (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200/90 to-amber-400/50 font-bold text-amber-950 ring-2 ring-white',
        shellClass[size],
        className,
      )}
      aria-hidden
    >
      {userInitials(user.displayName, user.email)}
    </div>
  )

  if (!url || imgFailed) {
    return fallback
  }

  return (
    <img
      src={url}
      alt=""
      className={cn(
        'shrink-0 rounded-full object-cover ring-2 ring-white',
        size === 'md' ? 'size-11' : 'size-10',
        className,
      )}
      onError={() => setImgFailed(true)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  )
}
