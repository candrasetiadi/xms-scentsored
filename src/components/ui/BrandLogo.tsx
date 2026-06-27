import Image from 'next/image'

interface BrandLogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { width: 108, height: 32, textClass: 'text-xl tracking-tight' },
  md: { width: 140, height: 42, textClass: 'text-2xl tracking-tight' },
  lg: { width: 180, height: 54, textClass: 'text-[32px] tracking-tight' },
}

export function BrandLogo({ variant = 'light', size = 'md', className = '' }: BrandLogoProps) {
  const { width, height, textClass } = sizes[size]

  if (variant === 'light') {
    return (
      <Image
        src="/brand/logo_web.png"
        alt="Scentsored"
        width={width}
        height={height}
        className={`object-contain ${className}`}
        priority
      />
    )
  }

  // TODO: ganti placeholder dengan logo_white.png setelah aset putih tersedia dari brand owner
  return (
    <span className={`font-display font-semibold text-sand-100 ${textClass} ${className}`}>
      Scentsored
    </span>
  )
}
