const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

function I({ children, className = "" }) {
  return (
    <svg {...base} width="1em" height="1em" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconDashboard = (p) => <I {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></I>;
export const IconCalendar = (p) => <I {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></I>;
export const IconUsers = (p) => <I {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></I>;
export const IconDoctor = (p) => <I {...p}><path d="M22 9a7 7 0 0 0-14 0v6a7 7 0 0 0 14 0" /><path d="M15 16a7 7 0 0 1-7-7" /><path d="M9 12h2M13 12h2M11 10v2M9 22h4" /></I>;
export const IconPill = (p) => <I {...p}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></I>;
export const IconReceipt = (p) => <I {...p}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8M8 11h8M8 15h5" /></I>;
export const IconWallet = (p) => <I {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></I>;
export const IconChart = (p) => <I {...p}><path d="M3 3v18h18" /><path d="M7 15v-4M12 15V7M17 15v-6" /></I>;
export const IconBell = (p) => <I {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></I>;
export const IconGear = (p) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></I>;
export const IconLogout = (p) => <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></I>;
export const IconMenu = (p) => <I {...p}><path d="M3 6h18M3 12h18M3 18h18" /></I>;
export const IconSun = (p) => <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>;
export const IconMoon = (p) => <I {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></I>;
export const IconSearch = (p) => <I {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></I>;
export const IconX = (p) => <I {...p}><path d="M18 6 6 18M6 6l12 12" /></I>;
export const IconPlus = (p) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconCheck = (p) => <I {...p}><path d="M20 6 9 17l-5-5" /></I>;
export const IconDownload = (p) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></I>;
export const IconPrint = (p) => <I {...p}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></I>;
export const IconEdit = (p) => <I {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></I>;
export const IconTrash = (p) => <I {...p}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></I>;
export const IconHeart = (p) => <I {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" /></I>;
export const IconFile = (p) => <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></I>;
export const IconShield = (p) => <I {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></I>;
export const IconActivity = (p) => <I {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></I>;
export const IconClock = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></I>;
export const IconAlert = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></I>;
export const IconHospital = (p) => <I {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></I>;
export const IconChevronLeft = (p) => <I {...p}><path d="m15 18-6-6 6-6" /></I>;
export const IconChevronRight = (p) => <I {...p}><path d="m9 18 6-6-6-6" /></I>;
export const IconChevronDown = (p) => <I {...p}><path d="m6 9 6 6 6-6" /></I>;
export const IconEye = (p) => <I {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" /><circle cx="12" cy="12" r="3" /></I>;
export const IconEyeOff = (p) => <I {...p}><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a17.3 17.3 0 0 1-3.06 4.14M6.6 6.6C3.55 8.5 1 12 1 12s4 8 11 8a9.7 9.7 0 0 0 4.5-1.1" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></I>;
export const IconSparkle = (p) => <I {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></I>;
export const IconDroplet = (p) => <I {...p}><path d="M12 2s7 8.5 7 13a7 7 0 1 1-14 0c0-4.5 7-13 7-13Z" /></I>;
export const IconWalk = (p) => <I {...p}><circle cx="13" cy="4" r="2" /><path d="m9 20 2-6-2-2 1-5 4 1 2 4h3M6 20l3-6" /></I>;
export const IconMoonStars = (p) => <I {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /><path d="M17 4v2M16 5h2" /></I>;
export const IconStethoscope = (p) => <I {...p}><path d="M4.5 2v6a4.5 4.5 0 0 0 9 0V2M9 12.5V15a5 5 0 0 0 10 0v-1.5" /><circle cx="20" cy="10" r="2" /></I>;
export const IconLock = (p) => <I {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></I>;
export const IconGlobe = (p) => <I {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></I>;