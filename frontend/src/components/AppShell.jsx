import { useEffect, useState, useCallback, useMemo } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { usePatient } from "../context/PatientContext";
import client from "../api/client";
import { IconDashboard, IconCalendar, IconUsers, IconDoctor, IconPill, IconReceipt, IconWallet, IconChart, IconBell, IconLogout, IconMenu, IconSun, IconMoon, IconHeart, IconShield, IconActivity, IconHospital, IconChevronLeft, IconChevronRight, IconChevronDown } from "./Icons";
import MissileAIAssistant from "./ai/MissileAIAssistant";

// Navigation items keyed by role.
const NAV = {
  patient: [
    { to: "/app/patient", label: "Dashboard", icon: IconDashboard },
    { to: "/app/patient/profile", label: "My Profile", icon: IconUsers },
    { to: "/app/patient/appointments", label: "Appointments", icon: IconCalendar },
    { to: "/app/patient/prescriptions", label: "Prescriptions", icon: IconPill },
    { to: "/app/patient/bills", label: "Bills & Payments", icon: IconWallet },
    { to: "/app/patient/ai-assistant", label: "AI Medical Assistant", icon: IconActivity },
  ],
  doctor: [
    { to: "/app/doctor", label: "Today & Queue", icon: IconDashboard },
    { to: "/app/doctor/prescriptions", label: "My Prescriptions", icon: IconPill },
  ],
  pharmacy: [
    { to: "/app/pharmacy", label: "Prescriptions", icon: IconDashboard },
    { to: "/app/pharmacy/invoices", label: "Invoices & Billing", icon: IconReceipt },
  ],
  reception: [
    { to: "/app/reception", label: "Reception Desk", icon: IconDashboard },
  ],
  admin: [
    { to: "/app/admin", label: "Dashboard", icon: IconDashboard },
    { to: "/app/admin/appointments", label: "Appointments", icon: IconCalendar },
    { to: "/app/admin/patients", label: "Patients", icon: IconUsers },
    {
      label: "Staff / Employees", icon: IconUsers,
      children: [
        { to: "/app/admin/employees", label: "All Employees", icon: IconUsers },
        { to: "/app/admin/employees/doctor", label: "Doctors", icon: IconDoctor },
        { to: "/app/admin/employees/nurse", label: "Nurses", icon: IconActivity },
        { to: "/app/admin/employees/reception", label: "Reception Staff", icon: IconUsers },
        { to: "/app/admin/employees/management", label: "Management Staff", icon: IconChart },
        { to: "/app/admin/employees/security", label: "Security Staff", icon: IconShield },
        { to: "/app/admin/employees/other", label: "Other Staff", icon: IconHospital },
        { to: "/app/admin/pharmacy", label: "Pharmacy Staff", icon: IconPill },
        { to: "/app/admin/attendance", label: "Attendance", icon: IconCalendar },
      ],
    },
    { to: "/app/admin/reports", label: "Reports & Revenue", icon: IconChart },
  ],
  hospital_admin: [
    { to: "/app/hospital/dashboard", label: "Dashboard", icon: IconDashboard },
    { to: "/app/hospital/branch-requests", label: "Branch Requests", icon: IconHospital },
    { to: "/app/hospital/appointments", label: "Appointments", icon: IconCalendar },
    { to: "/app/hospital/patients", label: "Patients", icon: IconUsers },
    {
      label: "Staff / Employees", icon: IconUsers,
      children: [
        { to: "/app/hospital/employees", label: "All Employees", icon: IconUsers },
        { to: "/app/hospital/employees/doctor", label: "Doctors", icon: IconDoctor },
        { to: "/app/hospital/employees/nurse", label: "Nurses", icon: IconActivity },
        { to: "/app/hospital/employees/reception", label: "Reception Staff", icon: IconUsers },
        { to: "/app/hospital/employees/management", label: "Management Staff", icon: IconChart },
        { to: "/app/hospital/employees/security", label: "Security Staff", icon: IconShield },
        { to: "/app/hospital/employees/other", label: "Other Staff", icon: IconHospital },
        { to: "/app/hospital/pharmacy", label: "Pharmacy Staff", icon: IconPill },
        { to: "/app/hospital/attendance", label: "Attendance", icon: IconCalendar },
      ],
    },
    { to: "/app/hospital/reports", label: "Reports & Revenue", icon: IconChart },
  ],
  superadmin: [
    { to: "/super-admin/dashboard", label: "Command Overview", icon: IconDashboard },
    { to: "/super-admin/hospitals", label: "Hospitals & Branches", icon: IconHospital },
    { to: "/super-admin/branch-requests", label: "Branch Requests", icon: IconHospital },
    { to: "/super-admin/employees", label: "Branch Staff Directory", icon: IconUsers },
    { to: "/app/admin/admins", label: "Admins", icon: IconShield },
    { to: "/app/admin/reports", label: "Revenue & Reports", icon: IconChart },
  ],
};

export default function AppShell({ children }) {
  const { patient, logout } = usePatient();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("missile_sidebar") === "collapsed");
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("missile_theme");
    if (saved) return saved === "dark";
    return document.documentElement.classList.contains("dark");
  });
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  const role = patient?.role || "patient";
  const items = NAV[role] || NAV.patient;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("missile_theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("missile_sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  const loadNotifs = useCallback(async () => {
    try { setNotifs((await client.get("/notifications")).data || []); } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  const close = () => setOpen(false);

  // Derive a lightweight breadcrumb from the current route + nav config, purely presentational.
  const currentLabel = useMemo(() => {
    for (const it of items) {
      if (it.to && location.pathname === it.to) return it.label;
      if (it.children) {
        const match = it.children.find((c) => location.pathname.startsWith(c.to));
        if (match) return `${it.label} / ${match.label}`;
      }
      if (it.to && it.to !== "/app/patient" && it.to !== "/app/doctor" && it.to !== "/app/reception" && it.to !== "/app/pharmacy" && it.to !== "/app/admin" && location.pathname.startsWith(it.to)) return it.label;
    }
    return "Dashboard";
  }, [items, location.pathname]);

  const nav = (
    <nav className="flex-1 px-2.5 space-y-2 overflow-y-auto no-scrollbar flex flex-col items-center py-2">
      {items.map((it, gi) => {
        if (it.children) {
          const HeadIcon = it.icon;
          return (
            <details key={gi} className="group w-full flex flex-col items-center">
              <summary className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] cursor-pointer list-none transition-all duration-200 ${collapsed ? "justify-center w-11 h-11 rounded-full p-0" : "w-full"}`}>
                <HeadIcon className="text-base shrink-0" />
                {!collapsed && (<><span className="flex-1 text-left">{it.label}</span><IconChevronDown className="text-xs opacity-60 transition-transform group-open:rotate-180" /></>)}
              </summary>
              {!collapsed && (
                <div className="pl-3 pr-1 pt-1 space-y-1 w-full">
                  {it.children.map((c) => {
                    const CIcon = c.icon;
                    return (
                      <NavLink key={c.to} to={c.to} end onClick={close}
                        className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${isActive ? "bg-[var(--color-primary)] text-white shadow-md shadow-blue-500/25" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"}`}>
                        <CIcon className="text-sm" /> {c.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </details>
          );
        }
        const Icon = it.icon;
        return (
          <NavLink key={it.to} to={it.to} end onClick={close} title={collapsed ? it.label : undefined}
            className={({ isActive }) => `flex items-center gap-3 transition-all duration-200 ${
              collapsed
                ? `w-11 h-11 rounded-full justify-center ${isActive ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30 scale-105" : "bg-white text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] shadow-sm hover:shadow"}`
                : `w-full px-3.5 py-2.5 rounded-2xl text-xs font-semibold ${isActive ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/25" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"}`
            }`}>
            <Icon className="text-base shrink-0" /> {!collapsed && it.label}
          </NavLink>
        );
      })}
    </nav>
  );

  const sidebarInner = (isMobile = false) => (
    <>
      <div className={`flex flex-col items-center py-4 px-3 ${collapsed && !isMobile ? "justify-center" : ""}`}>
        {/* Top Floating Logo Capsule */}
        <div className="w-12 h-16 rounded-[22px] bg-gradient-to-b from-[#00C6FF] to-[#1B74E4] grid place-items-center text-white shadow-md shadow-blue-500/20 shrink-0">
          <IconHeart className="text-xl animate-pulse" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="min-w-0 text-center mt-2">
            <p className="font-[var(--font-display)] font-bold text-[var(--color-ink)] leading-tight text-sm truncate">Missile Health</p>
            <p className="text-[10px] font-semibold text-[var(--color-ink-soft)] capitalize truncate">{role.replace("_", " ")} portal</p>
          </div>
        )}
      </div>
      {nav}
      <div className="px-2 pb-4 mt-auto pt-2 border-t border-[var(--color-line)] flex flex-col items-center">
        {!isMobile && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex items-center justify-center w-10 h-10 rounded-full text-xs font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] transition-all duration-200 mb-2 border border-[var(--color-line)]"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <IconChevronRight className="text-sm" /> : <IconChevronLeft className="text-sm" />}
          </button>
        )}
        <button onClick={() => { logout(); navigate("/login", { replace: true }); }}
          className={`flex items-center justify-center transition-all duration-200 ${
            collapsed && !isMobile
              ? "w-10 h-10 rounded-full bg-red-50 text-red-500 hover:bg-red-100"
              : "w-full px-3 py-2 rounded-2xl text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
          }`}
          title="Sign out"
        >
          <IconLogout className="text-sm shrink-0" /> {(!collapsed || isMobile) && <span className="ml-2">Sign out</span>}
        </button>
      </div>
    </>
  );

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const greetingName = patient?.name ? (patient.role === "doctor" ? `Dr. ${patient.name}` : patient.name) : "User";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] transition-colors duration-200">
      {/* Desktop Floating Capsule Sidebar */}
      <aside className={`hidden lg:flex fixed inset-y-4 left-4 glass-card border border-[var(--color-line)] flex-col rounded-[32px] z-30 transition-[width] duration-300 ease-[var(--ease-soft)] shadow-md ${collapsed ? "w-20" : "w-60"}`}>
        {sidebarInner(false)}
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-64 glass-card flex flex-col rounded-r-3xl animate-slide-in-right">{sidebarInner(true)}</aside>
        </div>
      )}

      <div className={`transition-[padding] duration-300 ease-[var(--ease-soft)] ${collapsed ? "lg:pl-24" : "lg:pl-64"}`}>
        {/* Top Header Bar with Pill Search and Greeting */}
        <header className="sticky top-0 z-[60] backdrop-blur-md bg-[var(--color-bg)]/80 px-4 md:px-6 py-4 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3">
              <button onClick={() => setOpen(true)} className="lg:hidden p-2.5 rounded-full bg-[var(--color-surface)] shadow-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"><IconMenu /></button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-[var(--color-ink)] tracking-tight">
                  {timeGreeting}, {greetingName} <span className="inline-block animate-bounce">👋</span>
                </h1>
                <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">Your progress this week is Awesome.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Central Pill Search Input */}
              <div className="relative hidden sm:block">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-56 md:w-80 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm px-4 py-2 pl-9 text-xs outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 text-[var(--color-ink)] transition-all"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>

              {/* Action Circle Buttons */}
              <button onClick={() => setDark((d) => !d)} className="w-10 h-10 rounded-full bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] shadow-sm border border-[var(--color-line)] grid place-items-center transition-all" title="Toggle theme">
                {dark ? <IconSun className="text-amber-400 text-base" /> : <IconMoon className="text-[var(--color-primary)] text-base" />}
              </button>

              {/* Notifications Dropdown */}
              <div className="relative">
                <button onClick={() => { setBellOpen((b) => !b); if (!bellOpen) loadNotifs(); }} className="relative w-10 h-10 rounded-full bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] shadow-sm border border-[var(--color-line)] grid place-items-center transition-all">
                  <IconBell className="text-base" />
                  {notifs.unread > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-danger)]" />}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto glass-card rounded-3xl shadow-[var(--shadow-xl)] z-[70] animate-blur-in">
                    <div className="p-4 border-b border-[var(--color-line)] flex items-center justify-between">
                      <span className="font-bold text-xs text-[var(--color-ink)]">Notifications</span>
                      <button onClick={async () => { await client.post("/notifications/read-all"); loadNotifs(); }} className="text-xs text-[var(--color-primary)] font-semibold hover:underline">Read all</button>
                    </div>
                    {notifs.notifications?.length ? notifs.notifications.map((n) => (
                      <button key={n._id} onClick={() => client.patch(`/notifications/${n._id}/read`)} className={`block w-full text-left px-4 py-3 border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-surface-2)] transition-all duration-200 ${n.read ? "opacity-60" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[var(--color-ink)]">{n.title}</span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-soft)] mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-[var(--color-ink-soft)] mt-1 font-mono">{new Date(n.createdAt).toLocaleDateString()}</p>
                      </button>
                    )) : <p className="p-4 text-xs text-[var(--color-ink-soft)] text-center">No notifications</p>}
                  </div>
                )}
              </div>

              {/* User Avatar Circle */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold grid place-items-center text-sm shadow-md shadow-blue-500/20 shrink-0">
                {patient?.name ? patient.name[0].toUpperCase() : "M"}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:px-6 lg:py-4 w-full">{children}</main>
      </div>

      {/* Floating Missile AI assistant (authenticated dashboards) - UNTOUCHED LOGIC */}
      <MissileAIAssistant />
    </div>
  );
}
