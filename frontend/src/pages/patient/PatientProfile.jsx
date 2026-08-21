import { useEffect, useState } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, Select, SkeletonCard, StatusBadge } from "../../components/ui";
import { IconUsers, IconHeart, IconShield, IconWallet, IconBell, IconGlobe, IconMenu, IconCheck, IconEye, IconEyeOff, IconLock, IconClock } from "../../components/Icons";

const emptyVitals = {
  bloodGroup: "", heightCm: "", weightKg: "", bmi: "", bloodPressure: "",
  sugarLevel: "", pulse: "", temperature: "", oxygenLevel: "", allergies: "",
  existingDiseases: "", previousDiseases: "", medicalHistory: "", currentMedicines: "",
};

const LANGUAGES = [
  { code: "en", name: "English", native: "English (Default)", flag: "🇬🇧" },
  { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇮🇳" },
  { code: "ar", name: "Arabic", native: "العربية", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", native: "हिंदी", flag: "🇮🇳" },
  { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "fr", name: "French", native: "Français", flag: "🇫🇷" },
  { code: "de", name: "German", native: "Deutsch", flag: "🇩🇪" },
];

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

export default function PatientProfile() {
  const [activeTab, setActiveTab] = useState("account");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [vitals, setVitals] = useState(emptyVitals);

  // Security / Password Form state
  const [passForm, setPassForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [passSaving, setPassSaving] = useState(false);
  const [passMsg, setPassMsg] = useState("");
  const [passError, setPassError] = useState("");

  // Language state
  const [currentLang, setCurrentLang] = useState(() => localStorage.getItem("missile_lang") || "en");
  const [langSavedMsg, setLangSavedMsg] = useState("");

  // Copy state
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const { data } = await client.get("/patients/profile");
      setUser(data.user);
      setVitals({ ...emptyVitals, ...(data.user?.patient || {}) });
    } catch (e) { setError(e.response?.data?.error || "Unable to load profile"); }

    try {
      const homeRes = await client.get("/patients/home");
      setInvoices(homeRes.data?.invoices || []);
    } catch { /* fallback */ }
  };

  useEffect(() => { load(); }, []);

  const v = (k) => (e) => setVitals({ ...vitals, [k]: e.target.value });

  const doPut = async (body) => {
    setError(""); setMsg("");
    try {
      const { data } = await client.put("/patients/profile", body);
      setMsg("Saved successfully.");
      setUser(data.user);
      return true;
    } catch (e) {
      setError(e.response?.data?.error || "Could not save profile changes");
      return false;
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassMsg(""); setPassError("");
    if (!passForm.currentPassword) return setPassError("Please enter your current password");
    if (!passForm.newPassword || passForm.newPassword.length < 8) return setPassError("New password must be at least 8 characters");
    if (passForm.newPassword !== passForm.confirmPassword) return setPassError("New passwords do not match");

    setPassSaving(true);
    try {
      const { data } = await client.put("/patients/change-password", {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword,
      });
      setPassMsg(data.message || "Password updated successfully!");
      setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPassError(err.response?.data?.error || "Failed to change password");
    } finally {
      setPassSaving(false);
    }
  };

  const handlePayInvoice = async (invoiceId) => {
    try {
      await client.post(`/patients/invoices/${invoiceId}/pay`, { method: "online" });
      setMsg("Payment successful!");
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Payment failed");
    }
  };

  const copyPatientId = () => {
    if (user?.patientId) {
      navigator.clipboard.writeText(user.patientId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const saveLanguage = (code) => {
    setCurrentLang(code);
    localStorage.setItem("missile_lang", code);
    const langObj = LANGUAGES.find((l) => l.code === code);
    setLangSavedMsg(`Language preference set to ${langObj?.name || code}`);
    setTimeout(() => setLangSavedMsg(""), 3000);
  };

  if (!user) return <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>;

  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  const paidInvoices = invoices.filter((i) => i.status === "paid");

  const tabs = [
    { id: "account", label: "Account Settings", icon: IconUsers, emoji: "👤" },
    { id: "security", label: "Security & Password", icon: IconShield, emoji: "🔒" },
    { id: "billings", label: "Billings & Payments", icon: IconWallet, emoji: "💳" },
    { id: "notifications", label: "Notifications", icon: IconBell, emoji: "🔔" },
    { id: "language", label: "Language", icon: IconGlobe, emoji: "🌐" },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-4 py-2.5">{error}</p>}
      {msg && <p className="text-xs text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-xl px-4 py-2.5">{msg}</p>}

      {/* Top Title & Responsive Settings Hamburger Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">My Profile</h1>
          <p className="text-xs text-[var(--color-ink-soft)]">Manage your personal info, security, payments and language preferences</p>
        </div>

        {/* Mobile/Tablet Hamburger Toggle Button */}
        <div className="md:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] text-xs font-bold text-[var(--color-ink)] shadow-sm hover:border-[var(--color-primary)] transition-all"
          >
            <IconMenu className="text-base" />
            <span>General Settings</span>
            <span className="text-[10px] bg-[var(--color-primary-soft)] text-[var(--color-primary)] px-2 py-0.5 rounded-full capitalize">{activeTab}</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-2 space-y-1 shadow-lg animate-fade-in">
          <p className="text-[10px] uppercase font-bold text-[var(--color-ink-soft)] px-3 py-1">Select General Setting</p>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === t.id
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow"
                  : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span>{t.emoji}</span> {t.label}
              </span>
              {activeTab === t.id && <IconCheck className="text-sm" />}
            </button>
          ))}
        </div>
      )}

      {/* Main Settings Navigation Horizontal Pills Bar (No Side Gaps) */}
      <div className="hidden md:flex flex-wrap items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-line)] p-2 rounded-2xl shadow-sm">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20 scale-[1.02]"
                  : "text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <Icon className="text-base" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: ACCOUNT SETTINGS
         ========================================================================= */}
      {activeTab === "account" && (
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-blue-600 to-cyan-400 -mx-6 -mt-6 mb-4 px-6 pt-4 flex justify-between items-start">
              <span className="text-white text-xs font-semibold opacity-90">Personal Information & Identity</span>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold text-xl grid place-items-center shadow-md">
                    {user.name ? user.name[0].toUpperCase() : "P"}
                  </div>
                  <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 text-white grid place-items-center text-[10px] border-2 border-white">✓</span>
                </div>
                <div>
                  <h2 className="font-bold text-lg text-[var(--color-ink)] flex items-center gap-1.5">{user.name} <span className="text-blue-600 text-sm">✔</span></h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[var(--color-ink-soft)]">Patient ID:</span>
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                      {user.patientId}
                    </span>
                    <button
                      onClick={copyPatientId}
                      className="text-[10px] text-[var(--color-primary)] font-semibold hover:underline"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <form className="grid md:grid-cols-2 gap-4" onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await doPut({ name: f.get("name"), email: f.get("email"), profile: { address: f.get("address") } });
              load();
            }}>
              <Field label="Full name"><input name="name" defaultValue={user.name} className={inputClass} /></Field>
              <Field label="Mobile Number (fixed)"><input value={user.mobile} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} /></Field>
              <Field label="Email address"><input name="email" type="email" defaultValue={user.email} className={inputClass} /></Field>
              <Field label="Address"><input name="address" defaultValue={user.profile?.address} className={inputClass} /></Field>
              <Button type="submit" className="md:col-span-2 justify-self-start shadow-md shadow-blue-500/20">Save personal info</Button>
            </form>
          </Card>

          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <div className="flex items-center gap-2 mb-4"><IconHeart className="text-xl text-blue-600" /><h2 className="font-bold text-base text-[var(--color-ink)]">Medical Profile & Vitals</h2></div>
            <div className="grid md:grid-cols-3 gap-4">
              <Field label="Blood group"><Select value={vitals.bloodGroup} onChange={v("bloodGroup")}><option value="">Select</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((b) => <option key={b}>{b}</option>)}</Select></Field>
              <Field label="Height (cm)"><input type="number" value={vitals.heightCm || ""} onChange={v("heightCm")} className={inputClass} /></Field>
              <Field label="Weight (kg)"><input type="number" value={vitals.weightKg || ""} onChange={v("weightKg")} className={inputClass} /></Field>
              <Field label="BMI (auto)"><input value={vitals.bmi || ""} readOnly disabled className={`${inputClass} opacity-70`} /></Field>
              <Field label="Blood pressure"><input value={vitals.bloodPressure || ""} onChange={v("bloodPressure")} placeholder="120/80" className={inputClass} /></Field>
              <Field label="Sugar level"><input value={vitals.sugarLevel || ""} onChange={v("sugarLevel")} className={inputClass} /></Field>
              <Field label="Pulse"><input value={vitals.pulse || ""} onChange={v("pulse")} className={inputClass} /></Field>
              <Field label="Temperature"><input value={vitals.temperature || ""} onChange={v("temperature")} className={inputClass} /></Field>
              <Field label="Oxygen level"><input value={vitals.oxygenLevel || ""} onChange={v("oxygenLevel")} className={inputClass} /></Field>
              <Field label="Allergies"><input value={vitals.allergies || ""} onChange={v("allergies")} className={inputClass} /></Field>
              <Field label="Existing diseases"><input value={vitals.existingDiseases || ""} onChange={v("existingDiseases")} className={inputClass} /></Field>
              <Field label="Previous diseases"><input value={vitals.previousDiseases || ""} onChange={v("previousDiseases")} className={inputClass} /></Field>
              <div className="md:col-span-2"><Field label="Medical history"><textarea value={vitals.medicalHistory || ""} onChange={v("medicalHistory")} className={`${inputClass} min-h-20`} /></Field></div>
              <Field label="Current medicines"><input value={vitals.currentMedicines || ""} onChange={v("currentMedicines")} className={inputClass} /></Field>
            </div>
            <Button className="mt-5 shadow-md shadow-blue-500/20" onClick={async () => { if (await doPut({ patient: vitals })) load(); }}>Save medical profile</Button>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
              <h2 className="font-bold text-base text-[var(--color-ink)] mb-4">Emergency Contact</h2>
              <form className="space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                if (await doPut({ emergencyContact: Object.fromEntries(new FormData(e.currentTarget)) })) load();
              }}>
                <Field label="Name"><input name="name" defaultValue={user.emergencyContact?.name} className={inputClass} /></Field>
                <Field label="Relation"><input name="relation" defaultValue={user.emergencyContact?.relation} className={inputClass} /></Field>
                <Field label="Phone"><input name="phone" defaultValue={user.emergencyContact?.phone} className={inputClass} /></Field>
                <Button type="submit">Save contact</Button>
              </form>
            </Card>
            <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
              <h2 className="font-bold text-base text-[var(--color-ink)] mb-4">Insurance Details</h2>
              <form className="space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                if (await doPut({ insurance: Object.fromEntries(new FormData(e.currentTarget)) })) load();
              }}>
                <Field label="Provider"><input name="provider" defaultValue={user.insurance?.provider} className={inputClass} /></Field>
                <Field label="Policy number"><input name="policyNumber" defaultValue={user.insurance?.policyNumber} className={inputClass} /></Field>
                <Field label="Valid until"><input name="expiresOn" type="date" defaultValue={user.insurance?.expiresOn ? user.insurance.expiresOn.slice(0, 10) : ""} className={inputClass} /></Field>
                <Button type="submit">Save insurance</Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SECURITY & PASSWORD SETTINGS
         ========================================================================= */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-fade-in">
          {/* Identity Info Card */}
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center"><IconLock className="text-xl" /></div>
              <div>
                <h2 className="font-bold text-base text-[var(--color-ink)]">Account Credentials & Security</h2>
                <p className="text-xs text-[var(--color-ink-soft)]">Your permanent Patient ID and login credentials</p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-line)]">
                <p className="text-[11px] text-[var(--color-ink-soft)]">Patient User ID</p>
                <p className="font-mono font-bold text-blue-600 text-sm mt-0.5">{user.patientId}</p>
              </div>
              <div className="p-3 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-line)]">
                <p className="text-[11px] text-[var(--color-ink-soft)]">Registered Mobile</p>
                <p className="font-medium text-[var(--color-ink)] text-sm mt-0.5">{user.mobile}</p>
              </div>
              <div className="p-3 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-line)]">
                <p className="text-[11px] text-[var(--color-ink-soft)]">Registered Email</p>
                <p className="font-medium text-[var(--color-ink)] text-sm mt-0.5 truncate">{user.email}</p>
              </div>
            </div>
          </Card>

          {/* Change Password Form Card */}
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <h2 className="font-bold text-base text-[var(--color-ink)] mb-1">Modify Your Password</h2>
            <p className="text-xs text-[var(--color-ink-soft)] mb-5">Update your password to keep your portal account secure</p>

            {passError && <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-4 py-2.5 mb-4">{passError}</p>}
            {passMsg && <p className="text-xs text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-xl px-4 py-2.5 mb-4">{passMsg}</p>}

            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showPass.current ? "text" : "password"}
                    value={passForm.currentPassword}
                    onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass({ ...showPass, current: !showPass.current })}
                    className="absolute right-3 top-2.5 text-[var(--color-ink-soft)] hover:text-[var(--color-primary)]"
                  >
                    {showPass.current ? <IconEyeOff className="text-base" /> : <IconEye className="text-base" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">New Password (min 8 characters)</label>
                <div className="relative">
                  <input
                    type={showPass.new ? "text" : "password"}
                    value={passForm.newPassword}
                    onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass({ ...showPass, new: !showPass.new })}
                    className="absolute right-3 top-2.5 text-[var(--color-ink-soft)] hover:text-[var(--color-primary)]"
                  >
                    {showPass.new ? <IconEyeOff className="text-base" /> : <IconEye className="text-base" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPass.confirm ? "text" : "password"}
                    value={passForm.confirmPassword}
                    onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass({ ...showPass, confirm: !showPass.confirm })}
                    className="absolute right-3 top-2.5 text-[var(--color-ink-soft)] hover:text-[var(--color-primary)]"
                  >
                    {showPass.confirm ? <IconEyeOff className="text-base" /> : <IconEye className="text-base" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={passSaving} className="shadow-md shadow-blue-500/20">
                {passSaving ? "Updating Password…" : "Update Password"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 3: BILLINGS & PAYMENTS
         ========================================================================= */}
      {activeTab === "billings" && (
        <div className="space-y-6 animate-fade-in">
          {/* Billing Stats Summary */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Total Pending Payments</p>
                <p className="text-2xl font-bold text-[var(--color-warning)] mt-1">{money(pendingInvoices.reduce((s, i) => s + (i.total || 0), 0))}</p>
                <p className="text-[11px] text-[var(--color-ink-soft)] mt-0.5">{pendingInvoices.length} bill{pendingInvoices.length === 1 ? "" : "s"} awaiting payment</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-warning-soft)] text-[var(--color-warning)] grid place-items-center text-xl"><IconWallet /></div>
            </Card>

            <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Total Paid Payments</p>
                <p className="text-2xl font-bold text-[var(--color-success)] mt-1">{money(paidInvoices.reduce((s, i) => s + (i.total || 0), 0))}</p>
                <p className="text-[11px] text-[var(--color-ink-soft)] mt-0.5">{paidInvoices.length} bill{paidInvoices.length === 1 ? "" : "s"} paid</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-success-soft)] text-[var(--color-success)] grid place-items-center text-xl"><IconCheck /></div>
            </Card>
          </div>

          {/* Pending Invoices List */}
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-[var(--color-ink)] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pending Payments
              </h2>
              <span className="text-xs font-semibold text-[var(--color-warning)] bg-[var(--color-warning-soft)] px-2.5 py-1 rounded-full">{pendingInvoices.length} Pending</span>
            </div>

            {pendingInvoices.length ? (
              <div className="space-y-3">
                {pendingInvoices.map((inv) => (
                  <div key={inv._id} className="border border-[var(--color-line)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 bg-[var(--color-surface-2)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--color-ink)]">{inv.invoiceNo}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <p className="text-xs text-[var(--color-ink-soft)] mt-1">{inv.type} · Issued by Dr. {inv.doctor?.name || "Hospital Staff"}</p>
                      <p className="text-[11px] text-[var(--color-ink-soft)] mt-0.5 font-mono"><IconClock className="inline text-xs mr-1" />{new Date(inv.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-[var(--color-ink)]">{money(inv.total)}</span>
                      <Button size="sm" onClick={() => handlePayInvoice(inv._id)} className="shadow-md shadow-blue-500/20">
                        Pay {money(inv.total)}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-ink-soft)] text-center py-6">No pending bills. All your payments are up to date!</p>
            )}
          </Card>

          {/* Paid Invoices History */}
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-[var(--color-ink)] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Completed Payments History
              </h2>
              <span className="text-xs font-semibold text-[var(--color-success)] bg-[var(--color-success-soft)] px-2.5 py-1 rounded-full">{paidInvoices.length} Paid</span>
            </div>

            {paidInvoices.length ? (
              <div className="space-y-3">
                {paidInvoices.map((inv) => (
                  <div key={inv._id} className="border border-[var(--color-line)] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--color-ink)]">{inv.invoiceNo}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <p className="text-xs text-[var(--color-ink-soft)] mt-1">{inv.type} · Paid via {inv.paymentMethod || "online"}</p>
                      <p className="text-[11px] text-[var(--color-ink-soft)] mt-0.5 font-mono">Ref: {inv.transactionRef || "TXN-DIRECT"}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-[var(--color-success)]">{money(inv.total)}</span>
                      <p className="text-[10px] text-[var(--color-ink-soft)]">{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-ink-soft)] text-center py-6">No completed payment records found.</p>
            )}
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 4: NOTIFICATIONS PREFERENCES
         ========================================================================= */}
      {activeTab === "notifications" && (
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <h2 className="font-bold text-base text-[var(--color-ink)] mb-1">Notification Preferences</h2>
            <p className="text-xs text-[var(--color-ink-soft)] mb-5">Choose how you receive appointment, prescription, and billing alerts</p>

            <div className="space-y-4 max-w-xl">
              {[
                { title: "Appointment Reminders", desc: "Receive alerts for upcoming consultations and queue updates", default: true },
                { title: "Prescription Updates", desc: "Get notified when a doctor issues a new prescription or pharmacy forwards medicines", default: true },
                { title: "Billing & Payment Receipts", desc: "Receive immediate confirmation when bills are generated or paid", default: true },
                { title: "Portal Security Alerts", desc: "Receive security notifications when logging in from new devices", default: true },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 border border-[var(--color-line)] rounded-2xl bg-[var(--color-surface-2)]">
                  <div>
                    <p className="text-xs font-bold text-[var(--color-ink)]">{item.title}</p>
                    <p className="text-[11px] text-[var(--color-ink-soft)] mt-0.5">{item.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked={item.default} className="w-4 h-4 accent-blue-600 rounded cursor-pointer" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 5: LANGUAGE PREFERENCE
         ========================================================================= */}
      {activeTab === "language" && (
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center"><IconGlobe className="text-xl" /></div>
              <div>
                <h2 className="font-bold text-base text-[var(--color-ink)]">Select Display Language</h2>
                <p className="text-xs text-[var(--color-ink-soft)]">Choose your preferred portal language (Default is English)</p>
              </div>
            </div>

            {langSavedMsg && <p className="text-xs text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-xl px-4 py-2.5 mb-4 animate-fade-in">{langSavedMsg}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 mt-4">
              {LANGUAGES.map((langObj) => {
                const isSelected = currentLang === langObj.code;
                return (
                  <button
                    key={langObj.code}
                    onClick={() => saveLanguage(langObj.code)}
                    className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-500/20"
                        : "border-[var(--color-line)] bg-[var(--color-surface-2)] hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{langObj.flag}</span>
                      <div>
                        <p className="text-xs font-bold text-[var(--color-ink)]">{langObj.name}</p>
                        <p className="text-[11px] text-[var(--color-ink-soft)]">{langObj.native}</p>
                      </div>
                    </div>
                    {isSelected && <span className="w-6 h-6 rounded-full bg-blue-600 text-white grid place-items-center text-xs shadow"><IconCheck /></span>}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}