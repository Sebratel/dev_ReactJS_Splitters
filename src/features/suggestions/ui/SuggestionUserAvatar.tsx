import { useState } from 'react'
import { userInitials } from '@/features/access/lib/splittersUserRoles'
import type { PlatformSuggestionUserSummary } from '@/features/suggestions/api/platformSuggestions'
import { cn } from '@/shared/lib/utils'

type SuggestionAvatarSize = 'xs' | 'sm' | 'md'

const shellClass: Record<SuggestionAvatarSize, string> = {
  xs: 'size-7 text-[10px]',
  sm: 'size-9 text-[11px]',
  md: 'size-11 text-xs',
}

const imageClass: Record<SuggestionAvatarSize, string> = {
  xs: 'size-7',
  sm: 'size-9',
  md: 'size-11',
}

type SuggestionUserAvatarProps = {
  user: PlatformSuggestionUserSummary
  size?: SuggestionAvatarSize
  className?: string
}

export function SuggestionUserAvatar({
  user,
  size = 'sm',
  className,
}: SuggestionUserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const url = user.photoURL?.trim()

  if (!url || imgFailed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200/90 to-amber-400/50 font-bold text-amber-950 ring-2 ring-white',
          shellClass[size],
          className,
        )}
        aria-hidden
      >
        {userInitials(user.name, user.email)}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt=""
      className={cn(
        'shrink-0 rounded-full object-cover ring-2 ring-white',
        imageClass[size],
        className,
      )}
      onError={() => setImgFailed(true)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  )
}
