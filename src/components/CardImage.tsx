import { useState } from 'react'

interface Props {
  src: string
  alt: string
  className?: string
  fallbackText?: string
}

export function CardImage({ src, alt, className = '', fallbackText }: Props) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-ink-800 text-parchment-500 text-xs text-center p-1 ${className}`}>
        {fallbackText ?? alt}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setError(true)}
      draggable={false}
    />
  )
}
