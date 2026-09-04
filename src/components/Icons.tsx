import React from 'react'

interface IconProps {
  size?: number
  className?: string
}

const p = (d: string) => <path d={d} />
const l = (x1: number, y1: number, x2: number, y2: number) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} />
)

function Icon({ size = 16, className = '', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export function IconMic(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z')}
      {p('M19 10v2a7 7 0 0 1-14 0v-2')}
      {l(12, 19, 12, 22)}
      {l(8, 22, 16, 22)}
    </Icon>
  )
}

export function IconMicOff(props: IconProps) {
  return (
    <Icon {...props}>
      {l(1, 1, 23, 23)}
      {p('M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6')}
      {p('M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23')}
      {l(12, 19, 12, 22)}
      {l(8, 22, 16, 22)}
    </Icon>
  )
}

export function IconHeadphones(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M3 18v-6a9 9 0 0 1 18 0v6')}
      {p('M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z')}
    </Icon>
  )
}

export function IconHeadphonesOff(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3zm0 0a9 9 0 0 0-15-6.7')}
      {p('M3 14v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3a9.03 9.03 0 0 1 .6-3.15')}
      {l(1, 1, 23, 23)}
    </Icon>
  )
}

export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z')}
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function IconPhoneOff(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.25 8.76 16.57 8.1 15.9m-1.8-6.3a12.84 12.84 0 0 1-.7-2.81 2 2 0 0 0-2-1.72H1a2 2 0 0 0-2 2.18 19.79 19.79 0 0 0 3.07 8.63 16 16 0 0 0 2.6 3.41')}
      {l(1, 1, 23, 23)}
    </Icon>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2')}
      <circle cx="9" cy="7" r="4" />
      {p('M23 21v-2a4 4 0 0 0-3-3.87')}
      {p('M16 3.13a4 4 0 0 1 0 7.75')}
    </Icon>
  )
}

export function IconHash(props: IconProps) {
  return (
    <Icon {...props}>
      {l(4, 9, 20, 9)}
      {l(4, 15, 20, 15)}
      {l(10, 3, 8, 21)}
      {l(16, 3, 14, 21)}
    </Icon>
  )
}

export function IconMessageSquare(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')}
    </Icon>
  )
}

export function IconMusic(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M9 18V5l12-2v13')}
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </Icon>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      {l(12, 5, 12, 19)}
      {l(5, 12, 19, 12)}
    </Icon>
  )
}

export function IconX(props: IconProps) {
  return (
    <Icon {...props}>
      {l(18, 6, 6, 18)}
      {l(6, 6, 18, 18)}
    </Icon>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      {p('M7 11V7a5 5 0 0 1 10 0v4')}
    </Icon>
  )
}

export function IconCrown(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M3 20h18M5 20V9l7-5 7 5v11')}
      {p('M9 20v-5h6v5')}
    </Icon>
  )
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Icon {...props}>
      {p('m15 18-6-6 6-6')}
    </Icon>
  )
}

export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      {p('m9 18 6-6-6-6')}
    </Icon>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      {p('m6 9 6 6 6-6')}
    </Icon>
  )
}

export function IconSend(props: IconProps) {
  return (
    <Icon {...props}>
      {p('m22 2-7 20-4-9-9-4z')}
      {p('M22 2 11 13')}
    </Icon>
  )
}

export function IconPlay(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M5 3l14 9-14 9V3z')}
    </Icon>
  )
}

export function IconPause(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </Icon>
  )
}

export function IconSkipBack(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M19 20 9 12l10-8v16z')}
      {l(5, 19, 5, 5)}
    </Icon>
  )
}

export function IconSkipForward(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M5 4l10 8-10 8V4z')}
      {l(19, 5, 19, 19)}
    </Icon>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="8" />
      {l(21, 21, 16.65, 16.65)}
    </Icon>
  )
}

export function IconMoreHorizontal(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </Icon>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M20 6 9 17l-5-5')}
    </Icon>
  )
}

export function IconBell(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9')}
      {p('M13.73 21a2 2 0 0 1-3.46 0')}
    </Icon>
  )
}

export function IconShield(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')}
    </Icon>
  )
}

export function IconEye(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z')}
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function IconUser(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      {p('M20 21a8 8 0 1 0-16 0')}
    </Icon>
  )
}

export function IconVolume2(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M11 5 6 9H2v6h4l5 4V5z')}
      {p('M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07')}
    </Icon>
  )
}

export function IconWifiOff(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0')}
      <circle cx="12" cy="20" r="1" />
    </Icon>
  )
}

export function IconMonitor(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      {l(8, 21, 16, 21)}
      {l(12, 17, 12, 21)}
    </Icon>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2')}
    </Icon>
  )
}

export function IconLogOut(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4')}
      {p('m16 17 5-5-5-5')}
      {l(21, 12, 9, 12)}
    </Icon>
  )
}

export function IconEyeOff(props: IconProps) {
  return (
    <Icon {...props}>
      {p('M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24')}
      {l(1, 1, 23, 23)}
    </Icon>
  );
}


export function IconPhoneHangup(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M2.5 14.5c2.5-3 6.5-5 9.5-5s7 2 9.5 5c.4.5.3 1.2-.2 1.6l-2.4 1.9c-.4.3-1 .3-1.4-.1l-2.8-2.3c-.3-.2-.5-.6-.5-1v-2.1c-.8-.2-1.7-.3-2.7-.3s-1.9.1-2.7.3v2.1c0 .4-.2.8-.5 1l-2.8 2.3c-.4.4-1 .4-1.4.1l-2.4-1.9c-.5-.4-.6-1.1-.2-1.6z"
        fill="currentColor"
      />
    </Icon>
  );
}

export function IconShare(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      {l(8.59, 13.51, 15.42, 17.49)}
      {l(15.41, 6.51, 8.59, 10.49)}
    </Icon>
  );
}

export function IconWave(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12c2.5-7 4.5-7 7 0s4.5 7 7 0 4-5 6 0" />
    </Icon>
  );
}
