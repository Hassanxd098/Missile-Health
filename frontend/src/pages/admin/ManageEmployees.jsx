import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import client from "../../api/client";
import Card, { Button, Field, inputClass, Select, StatusBadge, EmptyState, SectionTitle, SkeletonCard, useToast, Modal } from "../../components/ui";
import { IconPlus, IconSearch, IconEdit, IconTrash, IconUsers } from "../../components/Icons";

const CATEGORIES = [
  { key: "all", label: "All Employees" },
  { key: "doctor", label: "Doctors" },
  { key: "nurse", label: "Nurses" },
  { key: "reception", label: "Reception Staff" },
  { key: "management", label: "Management Staff" },
  { key: "security", label: "Security Staff" },
  { key: "other", label: "Other Staff" },
];

const TYPES = [
  { key: "doctor", label: "Doctor" },
  { key: "nurse", label: "Nurse" },
  { key: "reception", label: "Reception Staff" },
  { key: "management", label: "Management Staff" },
  { key: "security", label: "Security Staff" },
  { key: "other", label: "Other Staff" },
];
const LOGIN_TYPES = ["doctor", "reception"];
const GENDERS = ["Male", "Female", "Other"];

const emptyForm = () => ({
  name: "", employeeNumber: "", staffType: "nurse", designation: "", department: "",
  phone: "", email: "", joinDate: "", gender: "", address: "", profilePhoto: "",
  salary: "", status: "active", password: "", hospitalId: "",
  specialty: "", visitingHours: "", consultationFee: "", qualification: "", location: "",
});

const fromEmployee = (e) => {
  const staffType = TYPES.some((t) => t.key === (e.staffType || e.role)) ? (e.staffType || e.role) : "other";
  return {
    name: e.name || "",
    employeeNumber: e.employeeNumber || "",
    staffType,
    designation: e.designation || "",
    department: e.department || "",
    phone: e.phone || "",
    email: e.email || "",
    joinDate: e.joinDate || "",
    gender: e.gender || "",
    address: e.address || "",
    profilePhoto: e.photo || "",
    salary: e.salary || "",
    status: e.active ? "active" : "inactive",
    password: "",
    hospitalId: e.hospitalId?._id || e.hospitalId || "",
    specialty: e.specialty || "",
    visitingHours: e.visitingHours || "",
    consultationFee: e.consultationFee || "",
    qualification: e.qualification || "",
    location: e.location || "",
  };
};

function Avatar({ employee, className = "" }) {
  const initials = (employee.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (employee.photo) {
    return <img src={employee.photo} alt={employee.name} className={`object-cover rounded-full bg-[var(--color-primary-soft)] ${className}`} />;
  }
  return (
    <div className={`rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center font-semibold ${className}`}>
      {initials}
    </div>
  );
}

export default function ManageEmployees() {
  const { type: routeType } = useParams();
  const validType = (t) => {
    if (CATEGORIES.some((c) => c.key === t)) return t;
    const singular = String(t || "").replace(/s$/, "");
    if (CATEGORIES.some((c) => c.key === singular)) return singular;
    return "all";
  };
  const lockedType = routeType ? validType(routeType) : null;
  const [type, setType] = useState(lockedType || "all");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const toast = useToast();

  const loadBranches = useCallback(async () => {
    try {
      const { data: bData } = await client.get("/admin/my-branches");
      setBranches(bData.branches || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const resolved = routeType ? validType(routeType) : "all";
    setType(resolved);
  }, [routeType]);

  const load = async () => {
    setError("");
    try {
      const params = new URLSearchParams({ type, status });
      if (branchFilter && branchFilter !== "all") params.set("hospitalId", branchFilter);
      if (search.trim()) params.set("q", search.trim());
      setData((await client.get(`/admin/employees?${params}`)).data);
    } catch (e) { setError(e.response?.data?.error || "Unable to load employees"); setData({ employees: [], total: 0, type }); }
  };
  useEffect(() => { load(); }, [type, status, branchFilter]);
  const searchNow = () => load();

  const openCreate = () => {
    const defaultType = (lockedType && lockedType !== "all") ? lockedType : "nurse";
    const defaultBranch = branches.length ? branches[0]._id : "";
    setForm({ ...emptyForm(), staffType: defaultType, hospitalId: defaultBranch });
    setCreating(true);
  };
  const openEdit = (e) => { setForm(fromEmployee(e)); setEditing(e); };
  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target?.value ?? ev.target?.checked ?? ev }));

  const isLoginType = LOGIN_TYPES.includes(form.staffType);
  const isDoctor = form.staffType === "doctor";
  const typeLabel = TYPES.find((t) => t.key === form.staffType)?.label || "Employee";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = { ...form, salary: Number(form.salary) || 0, consultationFee: Number(form.consultationFee) || 0 };
    try {
      if (editing) {
        await client.patch(`/admin/employees/${editing._id}`, payload);
        toast("Employee updated", "success");
      } else {
        await client.post("/admin/employees", payload);
        toast("Employee added to branch", "success");
      }
      setCreating(false); setEditing(null); load();
    } catch (err) { setError(err.response?.data?.error || "Could not save employee"); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await client.delete(`/admin/employees/${deleting._id}`);
      toast(`${deleting.name} removed`, "success");
      setDeleting(null);
      if (viewing?._id === deleting._id) setViewing(null);
      load();
    } catch (err) { setError(err.response?.data?.error || "Could not delete employee"); setDeleting(null); }
  };

  const activeCategory = CATEGORIES.find((c) => c.key === type);
  if (!data) return <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  const employees = data.employees || [];

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      <Card>
        <SectionTitle
          title={lockedType && lockedType !== "all" ? `${activeCategory?.label || "Employees"} directory` : `Staff directory — ${activeCategory?.label || "Employees"}`}
          subtitle={`${data.total} employee${data.total === 1 ? "" : "s"} · employee numbers, branch location and status`}
          right={<Button onClick={openCreate}><IconPlus /> Add {lockedType && lockedType !== "all" ? (activeCategory?.label || "employee") : "employee"}</Button>}
        />

        {(!lockedType || lockedType === "all") && (
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map((c) => (
              <button key={c.key} onClick={() => setType(c.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${type === c.key ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"}`}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]" />
            <input className={`${inputClass} pl-10`} placeholder="Search by name, employee number, phone or email…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchNow()} />
          </div>

          {branches.length > 1 && (
            <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-52 font-semibold">
              <option value="all">📍 All Locations ({branches.length})</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.isBranch ? `🌿 ${b.name}` : `🏛️ ${b.name} (Main)`}
                </option>
              ))}
            </Select>
          )}

          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Button variant="ghost" onClick={searchNow}>Search</Button>
        </div>

        {employees.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {employees.map((e) => (
              <button key={e._id} onClick={() => setViewing(e)}
                className="text-left border border-[var(--color-line)] rounded-2xl p-4 flex flex-col gap-3 hover:border-[var(--color-primary)] hover:shadow-sm transition-all relative">
                <div className="flex items-start gap-3">
                  <Avatar employee={e} className="w-14 h-14 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[var(--color-ink)] truncate">{e.name}</p>
                      <StatusBadge status={e.active ? "active" : "inactive"} />
                    </div>
                    <p className="font-[var(--font-mono)] text-xs text-[var(--color-primary)] mt-0.5">{e.employeeNumber || "—"}</p>
                    <p className="text-xs text-[var(--color-ink-soft)] mt-0.5 capitalize">{e.staffTypeLabel} · {e.designation || "—"}</p>
                    {e.hospitalId?.name && (
                      <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border mt-1 ${
                        e.hospitalId?.isBranch
                          ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300"
                          : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300"
                      }`}>
                        {e.hospitalId?.isBranch ? `🌿 ${e.hospitalId.name}` : `🏛️ ${e.hospitalId.name}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-ink-soft)] space-y-1 border-t border-[var(--color-line)] pt-2">
                  {(e.department || e.specialty) && <p>{(e.department || e.specialty)}</p>}
                  <p>{e.phone || e.email || "—"}</p>
                  {e.joinDate && <p>Joined {e.joinDate}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}><IconEdit /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={(ev) => { ev.stopPropagation(); setDeleting(e); }}><IconTrash /> Delete</Button>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={<IconUsers className="text-[var(--color-ink-soft)]" />} title="No employees found" hint="Try a different category, location, or search term." />
        )}
      </Card>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? `Edit ${editing.name}` : `Add ${typeLabel}`} wide>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid sm:grid-cols-2 gap-3">
            {branches.length > 1 && (
              <div className="sm:col-span-2">
                <Field label="Assign to Hospital / Branch Location" hint="Select which branch location this employee is assigned to">
                  <Select value={form.hospitalId || ""} onChange={set("hospitalId")}>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.isBranch ? `🌿 ${b.name} (${b.code}${b.city ? ` - ${b.city}` : ""})` : `🏛️ ${b.name} (Main Network)`}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}

            <Field label="Employee name"><input name="name" required className={inputClass} value={form.name} onChange={set("name")} /></Field>
            <Field label="Employee number" hint={editing?.employeeNumber ? "Leave blank to keep the current number" : "Optional — auto-assigned if left blank"}>
              <input name="employeeNumber" className={inputClass} value={form.employeeNumber} onChange={set("employeeNumber")} placeholder="EMP-DOC-0001" />
            </Field>
            {(lockedType && lockedType !== "all") ? (
              <Field label="Staff type">
                <div className={`${inputClass} bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] cursor-not-allowed capitalize`}>
                  {TYPES.find((t) => t.key === form.staffType)?.label || form.staffType}
                </div>
              </Field>
            ) : (
              <Field label="Staff type"><Select name="staffType" value={form.staffType} onChange={set("staffType")}>{TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</Select></Field>
            )}
            {!isDoctor && (
              <Field label="Designation"><input name="designation" className={inputClass} value={form.designation} onChange={set("designation")} placeholder="e.g. Head Nurse, Shift Supervisor" /></Field>
            )}
            <Field label="Department"><input name="department" className={inputClass} value={form.department} onChange={set("department")} placeholder="e.g. Emergency, General Ward" /></Field>
            <Field label="Phone number"><input name="phone" className={inputClass} value={form.phone} onChange={set("phone")} placeholder="e.g. 98765 43210" /></Field>
            <Field label="Email" hint={isLoginType ? "Used for this employee's login" : "Optional for non-login staff"}>
              <input name="email" type="email" required={isLoginType} className={inputClass} value={form.email} onChange={set("email")} placeholder="you@hospital.com" />
            </Field>
            <Field label="Date of joining"><input name="joinDate" type="date" className={inputClass} value={form.joinDate} onChange={set("joinDate")} /></Field>
            <Field label="Gender"><Select name="gender" value={form.gender} onChange={set("gender")}><option value="">Select…</option>{GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}</Select></Field>
            <Field label="Monthly salary (₹)"><input name="salary" type="number" min="0" className={inputClass} value={form.salary} onChange={set("salary")} placeholder="e.g. 20000" /></Field>
            <Field label="Status"><Select name="status" value={form.status} onChange={set("status")}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
            {isLoginType && (
              <Field label="Password" hint={editing ? "Leave blank to keep the current password" : "Minimum 8 characters"}>
                <input name="password" type="password" required={!editing} minLength={8} className={inputClass} value={form.password} onChange={set("password")} />
              </Field>
            )}
          </div>

          {isDoctor && (
            <div className="border border-[var(--color-line)] rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wide">Doctor details</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Specialty"><input className={inputClass} value={form.specialty} onChange={set("specialty")} placeholder="e.g. Cardiologist" /></Field>
                <Field label="Qualification"><input className={inputClass} value={form.qualification} onChange={set("qualification")} placeholder="MBBS, MD" /></Field>
                <Field label="Location"><input className={inputClass} value={form.location} onChange={set("location")} placeholder="e.g. OPD-2, Block A" /></Field>
                <Field label="Consultation fee (₹)"><input type="number" min="0" className={inputClass} value={form.consultationFee} onChange={set("consultationFee")} /></Field>
                <Field label="Visiting hours"><input className={inputClass} value={form.visitingHours} onChange={set("visitingHours")} placeholder="e.g. Mon-Sat, 10 AM-4 PM" /></Field>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Profile photo URL" hint="Paste a link to the employee's photo">
              <input name="profilePhoto" className={inputClass} value={form.profilePhoto} onChange={set("profilePhoto")} placeholder="https://…/photo.jpg" />
            </Field>
            <div className="flex items-end gap-2">
              <Field label="Address"><input className={inputClass} value={form.address} onChange={set("address")} /></Field>
            </div>
          </div>
          {form.profilePhoto && <img src={form.profilePhoto} alt="preview" className="w-14 h-14 rounded-full object-cover border border-[var(--color-line)]" onError={(e) => (e.currentTarget.style.display = "none")} />}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button>
            <Button type="submit">{editing ? "Save changes" : "Add employee"}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name || "Employee details"}>
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar employee={viewing} className="w-20 h-20 text-lg" />
              <div>
                <p className="font-semibold text-lg text-[var(--color-ink)]">{viewing.name}</p>
                <p className="font-[var(--font-mono)] text-sm text-[var(--color-primary)]">{viewing.employeeNumber || "No employee number"}</p>
                <p className="text-sm text-[var(--color-ink-soft)] capitalize mt-0.5">{viewing.staffTypeLabel}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Designation" value={viewing.designation || "—"} />
              <Info label="Department" value={viewing.department || "—"} />
              <Info label="Phone" value={viewing.phone || "—"} />
              <Info label="Email" value={viewing.email || "—"} />
              <Info label="Gender" value={viewing.gender || "—"} />
              <Info label="Joined" value={viewing.joinDate || "—"} />
              <Info label="Salary" value={viewing.salary ? `₹${Number(viewing.salary).toLocaleString("en-IN")}` : "—"} />
              {viewing.specialty && <Info label="Specialty" value={viewing.specialty} />}
              {viewing.location && <Info label="Location" value={viewing.location} />}
              {viewing.visitingHours && <Info label="Visiting hours" value={viewing.visitingHours} />}
              {viewing.qualification && <Info label="Qualification" value={viewing.qualification} />}
              <Info label="Status" value={viewing.active ? "Active" : "Inactive"} />
              <Info label="Account" value={viewing.isLogin ? "Has login" : "Record only"} />
            </div>
            {viewing.address && <p className="text-sm text-[var(--color-ink-soft)]">Address: {viewing.address}</p>}
            <div className="flex justify-end gap-2 border-t border-[var(--color-line)] pt-4">
              <Button variant="danger" onClick={() => { setDeleting(viewing); setViewing(null); }}><IconTrash /> Delete</Button>
              <Button variant="ghost" onClick={() => { setViewing(null); openEdit(viewing); }}><IconEdit /> Edit</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete employee?">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-ink-soft)]">
              You are about to permanently delete <b className="text-[var(--color-ink)]">{deleting.name}</b>{" "}
              (<span className="font-[var(--font-mono)] text-[var(--color-primary)]">{deleting.employeeNumber || "no employee number"}</span>).
              {deleting.isLogin && " Their login account will also be removed."} This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}><IconTrash /> Delete employee</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
      <p className="font-medium text-[var(--color-ink)] mt-0.5 break-words">{value}</p>
    </div>
  );
}