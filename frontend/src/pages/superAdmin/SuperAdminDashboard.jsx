import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, Button, Field, inputClass, Select, EmptyState, SkeletonCard, SectionTitle, Modal, useToast, DonutChart } from "../../components/ui";
import { IconPlus, IconShield, IconUsers, IconHospital, IconCalendar, IconCheck, IconDoctor, IconChart, IconPill, IconActivity, IconChevronLeft, IconChevronRight, IconClock, IconWallet } from "../../components/Icons";

export default function SuperAdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // Sync activeTab with current route URL
  const activeTab = useMemo(() => {
    const path = location.pathname;
    if (path.endsWith("/hospitals")) return "hospitals";
    if (path.endsWith("/branch-requests")) return "branch_requests";
    if (path.endsWith("/employees")) return "employees";
    return "dashboard";
  }, [location.pathname]);

  const changeTab = (tabId) => {
    if (tabId === "hospitals") navigate("/super-admin/hospitals");
    else if (tabId === "branch_requests") navigate("/super-admin/branch-requests");
    else if (tabId === "employees") navigate("/super-admin/employees");
    else navigate("/super-admin/dashboard");
  };

  const [platform, setPlatform] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const toast = useToast();

  // Branch Requests State
  const [branchRequests, setBranchRequests] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branchStatusFilter, setBranchStatusFilter] = useState("all");
  const [rejectingBranch, setRejectingBranch] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // All Employees & Staff Profiles State
  const [employees, setEmployees] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [empPage, setEmpPage] = useState(1);
  const [empSearch, setEmpSearch] = useState("");
  const [empRoleFilter, setEmpRoleFilter] = useState("all");
  const [empHospitalFilter, setEpHospitalFilter] = useState("all");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const PAGE_SIZE = 10;

  const loadHospitals = useCallback(async (p = page, s = search) => {
    try {
      const params = new URLSearchParams({ page: String(p), search: s, limit: String(PAGE_SIZE) });
      setData((await client.get(`/super-admin/hospitals?${params}`)).data);
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || "Unable to load hospitals");
    }
  }, [page, search]);

  const loadPlatform = useCallback(async () => {
    try {
      setPlatform((await client.get("/super-admin/dashboard")).data);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadBranchRequests = useCallback(async () => {
    setLoadingBranches(true);
    try {
      const { data: resData } = await client.get("/super-admin/branch-requests");
      setBranchRequests(resData.branchRequests || []);
    } catch (err) {
      console.error("Failed to load branch requests", err);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const params = new URLSearchParams({
        page: String(empPage),
        search: empSearch,
        role: empRoleFilter,
        hospitalId: empHospitalFilter,
        limit: "25",
      });
      const { data: resData } = await client.get(`/super-admin/all-employees?${params}`);
      setEmployees(resData.employees || []);
      setTotalEmployees(resData.total || 0);
    } catch (err) {
      console.error("Failed to load employees", err);
    } finally {
      setLoadingEmployees(false);
    }
  }, [empPage, empSearch, empRoleFilter, empHospitalFilter]);

  useEffect(() => {
    loadHospitals(1, "");
    loadPlatform();
    loadBranchRequests();
  }, [loadHospitals, loadPlatform, loadBranchRequests]);

  useEffect(() => {
    if (activeTab === "employees") {
      loadEmployees();
    }
  }, [activeTab, loadEmployees]);

  const createHospital = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await client.post("/super-admin/hospitals", {
        name: f.get("name"),
        code: f.get("code"),
        email: f.get("email"),
        phone: f.get("phone"),
        address: f.get("address"),
        city: f.get("city"),
        state: f.get("state"),
        country: f.get("country"),
        status: f.get("status"),
        adminName: f.get("adminName"),
        adminEmail: f.get("adminEmail"),
        adminMobile: f.get("adminMobile"),
        adminPassword: f.get("adminPassword"),
      });
      setCreating(false);
      toast("Hospital created successfully", "success");
      loadHospitals(1, search);
      loadPlatform();
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || "Could not create hospital", "error");
    }
  };

  const approveBranch = async (branchId) => {
    try {
      await client.post(`/super-admin/branch-requests/${branchId}/approve`);
      toast("Hospital branch approved and activated!", "success");
      loadBranchRequests();
      loadHospitals(page, search);
      loadPlatform();
    } catch (err) {
      toast(err.response?.data?.message || "Could not approve branch request", "error");
    }
  };

  const rejectBranchSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingBranch) return;
    try {
      await client.post(`/super-admin/branch-requests/${rejectingBranch._id}/reject`, { rejectionReason });
      toast("Branch request declined", "info");
      setRejectingBranch(null);
      setRejectionReason("");
      loadBranchRequests();
    } catch (err) {
      toast(err.response?.data?.message || "Could not reject branch request", "error");
    }
  };

  const toggleStatus = async (h, status) => {
    try {
      await client.patch(`/super-admin/hospitals/${h._id}/status`, { status });
      toast(`Hospital ${status === "active" ? "activated" : "deactivated"}`, "success");
      loadHospitals(page, search);
      loadPlatform();
    } catch (err) {
      toast(err.response?.data?.message || "Could not update hospital", "error");
    }
  };

  const deleteHospital = async (h) => {
    if (h.code === "DEFAULT") {
      toast("Default system hospital cannot be deleted", "error");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${h.name}"? This will deactivate all staff accounts associated with this hospital.`)) {
      return;
    }
    try {
      await client.delete(`/super-admin/hospitals/${h._id}`);
      toast("Hospital deleted successfully", "success");
      loadHospitals(page, search);
      loadPlatform();
    } catch (err) {
      toast(err.response?.data?.message || "Could not delete hospital", "error");
    }
  };

  const openHospital = async (h) => {
    setViewing({ hospital: h });
    setViewLoading(true);
    try {
      const { data: detail } = await client.get(`/super-admin/hospitals/${h._id}`);
      setViewing(detail);
    } catch (err) {
      toast(err.response?.data?.message || "Could not load hospital details", "error");
      setViewing(null);
    } finally {
      setViewLoading(false);
    }
  };

  const pendingCount = useMemo(() => {
    return branchRequests.filter((b) => b.approvalStatus === "pending").length;
  }, [branchRequests]);

  const filteredBranchRequests = useMemo(() => {
    return branchRequests.filter((b) => branchStatusFilter === "all" || b.approvalStatus === branchStatusFilter);
  }, [branchRequests, branchStatusFilter]);

  if (!data) return <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-300 bg-blue-800/40 px-3 py-1 rounded-full border border-blue-400/30">
              👑 SuperAdmin Command Center
            </span>
            <h1 className="text-2xl font-extrabold mt-2 font-[var(--font-display)]">
              Multi-Hospital Network & Branch Portal
            </h1>
            <p className="text-sm text-blue-200 mt-1 max-w-2xl">
              Oversee hospital network expansion, approve branch requests, and inspect employee profiles across all locations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => changeTab("branch_requests")}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md transition-all flex items-center gap-1.5 animate-bounce"
              >
                <span>📬</span>
                <span>{pendingCount} Pending Branch Request{pendingCount > 1 ? "s" : ""}</span>
              </button>
            )}
            <Button onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold">
              <IconPlus /> Add Main Hospital
            </Button>
          </div>
        </div>
      </div>

      {/* ==================== SECTION 1: COMMAND DASHBOARD OVERVIEW ==================== */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Hospitals & Branches" value={platform?.hospitals ?? data.total} icon={<IconHospital className="text-xl" />} tint="primary" />
            <StatCard label="Active Locations" value={platform?.activeHospitals ?? "—"} icon={<IconCheck className="text-xl" />} tint="success" />
            <StatCard label="Pending Branch Requests" value={pendingCount} icon={<IconClock className="text-xl" />} tint="warning" />
            <StatCard label="Today's Appointments" value={platform?.todayAppointments ?? "—"} icon={<IconCalendar className="text-xl" />} tint="accent" />
            <StatCard label="Total Doctors" value={platform?.totalDoctors ?? "—"} icon={<IconDoctor className="text-xl" />} tint="violet" />
            <StatCard label="Total Patients" value={platform?.totalPatients ?? "—"} icon={<IconUsers className="text-xl" />} tint="teal" />
            <StatCard label="Reception Staff" value={platform?.totalReception ?? "—"} icon={<IconActivity className="text-xl" />} tint="primary" />
            <StatCard label="Pharmacy Staff" value={platform?.totalPharmacy ?? "—"} icon={<IconPill className="text-xl" />} tint="accent" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <SectionTitle title="Hospital Distribution" subtitle="Active vs inactive locations" />
              {platform ? (
                <DonutChart
                  size={120}
                  data={[
                    { label: "Active", value: platform.activeHospitals },
                    { label: "Inactive", value: platform.inactiveHospitals },
                  ]}
                />
              ) : <div className="h-28 oskeleton rounded-2xl" />}
            </Card>
            <Card>
              <SectionTitle title="Platform Workforce" subtitle="Staff composition across all branches" />
              {platform ? (
                <DonutChart
                  size={120}
                  data={[
                    { label: "Doctors", value: platform.totalDoctors },
                    { label: "Reception", value: platform.totalReception },
                    { label: "Pharmacy", value: platform.totalPharmacy },
                    { label: "Cleaning", value: platform.totalCleaners },
                  ]}
                />
              ) : <div className="h-28 oskeleton rounded-2xl" />}
            </Card>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: HOSPITALS & BRANCHES LIST ==================== */}
      {activeTab === "hospitals" && (
        <Card>
          <SectionTitle
            title="Registered Hospitals & Branches"
            subtitle={`${data.total} location(s) registered on platform`}
            right={
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); loadHospitals(1, e.target.value); }}
                  placeholder="Search hospitals, branches, city…"
                  className={`${inputClass} w-60`}
                />
                <Button onClick={() => setCreating(true)}><IconPlus /> Add Hospital</Button>
              </div>
            }
          />
          {data.hospitals.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--color-ink-soft)] uppercase border-b border-[var(--color-line)] bg-[var(--color-surface-2)]">
                      <th className="p-3">Hospital / Branch</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Code</th>
                      <th className="p-3">Hospital Admin</th>
                      <th className="p-3">Staff Breakdown</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-line)]">
                    {data.hospitals.map((h) => (
                      <tr key={h._id} className="align-top hover:bg-[var(--color-surface-2)]/50 transition-all">
                        <td className="p-3">
                          <div className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                            <span>{h.name}</span>
                          </div>
                          <div className="text-xs text-[var(--color-ink-soft)] font-mono">{h.hospitalId}</div>
                          {h.city && <p className="text-[11px] text-[var(--color-ink-soft)]">📍 {h.city}{h.state ? `, ${h.state}` : ""}</p>}
                        </td>
                        <td className="p-3">
                          {h.isBranch ? (
                            <span className="text-[10px] font-extrabold uppercase bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-300/40">
                              🌿 Branch
                            </span>
                          ) : (
                            <span className="text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-300/40">
                              🏛️ Main Network
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-xs font-mono font-bold text-[var(--color-primary)]">{h.code}</td>
                        <td className="p-3">
                          <div className="text-sm font-semibold">{h.admin?.name || "—"}</div>
                          <div className="text-xs text-[var(--color-ink-soft)]">{h.admin?.email || ""}</div>
                        </td>
                        <td className="p-3 text-xs text-[var(--color-ink-soft)]">
                          Dr: {h.stats?.doctors || 0} · Pt: {h.stats?.patients || 0} · Rx: {h.stats?.pharmacies || 0}
                        </td>
                        <td className="p-3"><StatusBadge status={h.status} /></td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end flex-wrap">
                            <Button size="sm" variant="ghost" onClick={() => openHospital(h)}>View</Button>
                            <Button size="sm" variant={h.status === "active" ? "ghost" : "success"} onClick={() => toggleStatus(h, h.status === "active" ? "inactive" : "active")}>
                              {h.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                            {h.code !== "DEFAULT" && (
                              <Button size="sm" variant="danger" onClick={() => deleteHospital(h)}>Delete</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-line)]">
                <p className="text-xs text-[var(--color-ink-soft)]">Page {data.page || page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" icon={<IconChevronLeft />} disabled={(data.page || page) <= 1} onClick={() => { setPage(page - 1); loadHospitals(page - 1, search); }}>Prev</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPage(page + 1); loadHospitals(page + 1, search); }} disabled={(data.page || page) >= totalPages}>
                    Next <IconChevronRight />
                  </Button>
                </div>
              </div>
            </>
          ) : <EmptyState icon={<IconHospital className="text-3xl text-[var(--color-ink-soft)]" />} title="No hospitals found" hint="Try a different search term." />}
        </Card>
      )}

      {/* ==================== TAB 3: BRANCH REQUESTS APPROVAL WORKFLOW ==================== */}
      {activeTab === "branch_requests" && (
        <Card>
          <SectionTitle
            title="Hospital Branch Approval Requests"
            subtitle="Review & approve branch expansion requests submitted by Hospital Admins"
            right={
              <div className="flex items-center gap-2">
                <Select value={branchStatusFilter} onChange={(e) => setBranchStatusFilter(e.target.value)}>
                  <option value="all">All Request Statuses</option>
                  <option value="pending">⏳ Pending Approval</option>
                  <option value="approved">✅ Approved Branches</option>
                  <option value="rejected">❌ Rejected Requests</option>
                </Select>
                <Button size="sm" variant="ghost" onClick={loadBranchRequests}>🔄 Refresh</Button>
              </div>
            }
          />

          {loadingBranches ? (
            <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
          ) : filteredBranchRequests.length ? (
            <div className="space-y-3 mt-3">
              {filteredBranchRequests.map((b) => (
                <div key={b._id} className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/40 hover:bg-[var(--color-surface-2)] transition-all flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-base text-[var(--color-ink)]">{b.name}</span>
                      <span className="text-xs font-mono bg-[var(--color-primary-soft)] text-[var(--color-primary)] px-2 py-0.5 rounded-full font-bold">
                        {b.code}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                        b.approvalStatus === "approved"
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                          : b.approvalStatus === "pending"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 animate-pulse"
                          : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300"
                      }`}>
                        {b.approvalStatus === "pending" ? "⏳ Pending Approval" : b.approvalStatus === "approved" ? "✅ Approved" : "❌ Rejected"}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--color-ink-soft)]">
                      Main Network: <strong className="text-[var(--color-ink)]">{b.parentHospital?.name || "Hospital Network"}</strong> ({b.parentHospital?.city || "Network"})
                    </p>

                    <p className="text-xs text-[var(--color-ink-soft)]">
                      Requested Location: 📍 {[b.city, b.state, b.country].filter(Boolean).join(", ") || "Location specified"} · Address: {b.address || "N/A"}
                    </p>

                    <p className="text-xs text-[var(--color-ink-soft)]">
                      Hospital Admin Contact: <span className="font-semibold text-[var(--color-ink)]">{b.requestedBy?.name || b.admin?.name || "Hospital Admin"}</span> ({b.requestedBy?.email || b.admin?.email})
                    </p>

                    {b.rejectionReason && (
                      <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg mt-1">
                        <b>Rejection Reason:</b> {b.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {b.approvalStatus === "pending" ? (
                      <>
                        <Button size="sm" onClick={() => approveBranch(b._id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                          ✅ Approve Branch
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejectingBranch(b)}>
                          ❌ Decline
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => openHospital(b)}>
                        View Branch Profile
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<IconHospital className="text-3xl text-[var(--color-ink-soft)]" />} title="No branch requests found" hint="When hospital admins submit branch expansion requests, they will appear here." />
          )}
        </Card>
      )}

      {/* ==================== TAB 4: ALL BRANCH STAFF & PROFILES ==================== */}
      {activeTab === "employees" && (
        <Card>
          <SectionTitle
            title="Platform Branch Staff Directory"
            subtitle={`View employee records & profiles across all hospitals (${totalEmployees} staff)`}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={empSearch}
                  onChange={(e) => { setEmpSearch(e.target.value); setEmpPage(1); }}
                  placeholder="Search staff name, email, ID…"
                  className={`${inputClass} w-52`}
                />
                <Select value={empRoleFilter} onChange={(e) => { setEmpRoleFilter(e.target.value); setEmpPage(1); }}>
                  <option value="all">All Roles</option>
                  <option value="doctor">Doctors</option>
                  <option value="nurse">Nurses</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="reception">Reception</option>
                  <option value="cleaner">Cleaners</option>
                  <option value="management">Management</option>
                  <option value="security">Security</option>
                </Select>
                <Select value={empHospitalFilter} onChange={(e) => { setEpHospitalFilter(e.target.value); setEmpPage(1); }}>
                  <option value="all">All Hospital Locations</option>
                  {data.hospitals.map((h) => (
                    <option key={h._id} value={h._id}>{h.name} ({h.code})</option>
                  ))}
                </Select>
              </div>
            }
          />

          {loadingEmployees ? (
            <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
          ) : employees.length ? (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] uppercase text-xs">
                    <th className="p-3">Employee Name</th>
                    <th className="p-3">Emp ID</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Hospital / Branch Location</th>
                    <th className="p-3">Specialty / Qualification</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {employees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-[var(--color-surface-2)]/50 transition-all">
                      <td className="p-3 font-bold text-[var(--color-ink)]">
                        <div>{emp.name}</div>
                        <div className="text-xs font-normal text-[var(--color-ink-soft)]">{emp.email}</div>
                      </td>
                      <td className="p-3 font-mono text-xs font-semibold text-[var(--color-primary)]">
                        {emp.employeeNumber || "—"}
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                          {emp.role}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-[var(--color-ink)]">
                        {emp.hospitalId?.name || "Main Network"} ({emp.hospitalId?.code || "HQ"})
                      </td>
                      <td className="p-3 text-xs text-[var(--color-ink-soft)]">
                        {emp.profile?.specialty || emp.profile?.qualification || "Hospital Staff"}
                      </td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedStaff(emp)}>
                          View Profile
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<IconUsers className="text-3xl text-[var(--color-ink-soft)]" />} title="No staff members found" hint="Try adjusting your role or hospital location filters." />
          )}
        </Card>
      )}

      {/* Reject Branch Reason Modal */}
      <Modal open={!!rejectingBranch} onClose={() => setRejectingBranch(null)} title={`Decline Branch Request: ${rejectingBranch?.name || ""}`}>
        <form onSubmit={rejectBranchSubmit} className="space-y-4">
          <p className="text-xs text-[var(--color-ink-soft)]">
            Please enter a reason for declining this branch setup request. The hospital admin will be notified.
          </p>
          <Field label="Reason for Decline">
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Incomplete licensing documents or location conflict..."
              className={inputClass}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setRejectingBranch(null)}>Cancel</Button>
            <Button variant="danger" type="submit">Confirm Decline</Button>
          </div>
        </form>
      </Modal>

      {/* Employee Profile View Modal */}
      <Modal open={!!selectedStaff} onClose={() => setSelectedStaff(null)} title="Employee Profile Record">
        {selectedStaff && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xl shadow-inner shrink-0">
                {selectedStaff.name?.[0]}
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--color-ink)]">{selectedStaff.name}</h3>
                <p className="text-[var(--color-ink-soft)]">{selectedStaff.email} · 📱 {selectedStaff.mobile || "N/A"}</p>
                <p className="text-[var(--color-primary)] font-semibold mt-0.5">
                  ID: {selectedStaff.employeeNumber || "Staff Member"} · Role: <span className="uppercase">{selectedStaff.role}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1">
                <p className="font-bold text-[var(--color-ink)]">🏥 Hospital Assignment</p>
                <p className="text-[var(--color-ink-soft)]">{selectedStaff.hospitalId?.name || "Main Hospital"}</p>
                <p className="text-[var(--color-ink-soft)]">Code: {selectedStaff.hospitalId?.code || "HQ"} · {selectedStaff.hospitalId?.city || "Facility"}</p>
              </div>

              <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1">
                <p className="font-bold text-[var(--color-ink)]">🩺 Clinical / Specialty Profile</p>
                <p className="text-[var(--color-ink-soft)]">Specialty: {selectedStaff.profile?.specialty || "N/A"}</p>
                <p className="text-[var(--color-ink-soft)]">Qualification: {selectedStaff.profile?.qualification || "N/A"}</p>
              </div>
            </div>

            {selectedStaff.role === "doctor" && (
              <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1.5">
                <p className="font-bold text-[var(--color-ink)]">💊 Doctor OPD & Fee Information</p>
                <p className="text-[var(--color-ink-soft)]">Consultation Fee: ₹{selectedStaff.profile?.consultationFee || 0}</p>
                <p className="text-[var(--color-ink-soft)]">OPD Hours: {selectedStaff.profile?.visitingHours || "OPD Hours"}</p>
                <p className="text-[var(--color-ink-soft)]">License No: {selectedStaff.profile?.licenseNumber || "Verified"}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Hospital Modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Create Main Hospital Network" wide>
        <form className="grid grid-cols-2 gap-4" onSubmit={createHospital}>
          <Field label="Hospital name"><input name="name" required className={inputClass} placeholder="e.g. New Life Hospital" /></Field>
          <Field label="Hospital code"><input name="code" required className={inputClass} placeholder="e.g. NLH" /></Field>
          <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
          <Field label="Phone"><input name="phone" className={inputClass} /></Field>
          <div className="col-span-2"><Field label="Address"><input name="address" className={inputClass} /></Field></div>
          <Field label="City"><input name="city" className={inputClass} /></Field>
          <Field label="State"><input name="state" className={inputClass} /></Field>
          <Field label="Country"><input name="country" className={inputClass} /></Field>
          <Field label="Status">
            <Select name="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <div className="col-span-2 border-t border-[var(--color-line)] pt-4 mt-2">
            <h3 className="font-medium text-[var(--color-ink)] mb-3">Hospital Admin Account</h3>
          </div>
          <Field label="Admin name"><input name="adminName" required className={inputClass} /></Field>
          <Field label="Admin email"><input name="adminEmail" type="email" required className={inputClass} /></Field>
          <Field label="Admin mobile"><input name="adminMobile" className={inputClass} /></Field>
          <Field label="Admin password" hint="Minimum 8 characters"><input name="adminPassword" type="password" required minLength={8} className={inputClass} /></Field>
          <div className="col-span-2 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit">Create Hospital</Button>
          </div>
        </form>
      </Modal>

      {/* Hospital detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.hospital?.name || "Hospital details"} wide>
        {viewLoading ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 oskeleton rounded-2xl" /><div className="h-20 oskeleton rounded-2xl" />
          </div>
        ) : viewing?.stats ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={viewing.hospital.status} />
              <span className="text-xs font-mono text-[var(--color-ink-soft)]">{viewing.hospital.hospitalId}</span>
              <span className="text-xs text-[var(--color-ink-soft)]">Created {new Date(viewing.hospital.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Doctors" value={viewing.stats.doctors} icon={<IconDoctor className="text-lg" />} tint="primary" />
              <StatCard label="Patients" value={viewing.stats.patients} icon={<IconUsers className="text-lg" />} tint="teal" />
              <StatCard label="Reception" value={viewing.stats.receptionists} icon={<IconActivity className="text-lg" />} tint="accent" />
              <StatCard label="Pharmacy" value={viewing.stats.pharmacies} icon={<IconPill className="text-lg" />} tint="violet" />
            </div>
          </div>
        ) : <EmptyState title="Couldn't load hospital details" hint="Please try again." />}
      </Modal>
    </div>
  );
}
