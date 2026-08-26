import { useEffect, useState, useCallback } from "react";
import client from "../../api/client";
import Card, { StatCard, StatusBadge, Button, Field, inputClass, Select, EmptyState, SkeletonCard, SectionTitle, Modal, useToast, DonutChart } from "../../components/ui";
import { IconPlus, IconShield, IconUsers, IconHospital, IconCalendar, IconCheck, IconDoctor, IconChart, IconPill, IconActivity, IconChevronLeft, IconChevronRight, IconClock, IconWallet } from "../../components/Icons";

export default function SuperAdminDashboard() {
  const [platform, setPlatform] = useState(null); // /super-admin/dashboard totals
  const [data, setData] = useState(null); // /super-admin/hospitals list + pagination
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null); // hospital detail being viewed
  const [viewLoading, setViewLoading] = useState(false);
  const toast = useToast();

  const PAGE_SIZE = 10;

  const load = useCallback(async (p = page, s = search) => {
    try {
      const params = new URLSearchParams({ page: String(p), search: s, limit: String(PAGE_SIZE) });
      setData((await client.get(`/super-admin/hospitals?${params}`)).data);
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || "Unable to load hospitals");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlatform = useCallback(async () => {
    try {
      setPlatform((await client.get("/super-admin/dashboard")).data);
    } catch {
      // Non-fatal -- the hospital list below still renders without platform totals.
    }
  }, []);

  useEffect(() => { load(1, ""); loadPlatform(); }, [load, loadPlatform]);

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
      load(1, search);
      loadPlatform();
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || "Could not create hospital", "error");
    }
  };

  const toggleStatus = async (h, status) => {
    try {
      await client.patch(`/super-admin/hospitals/${h._id}/status`, { status });
      toast(`Hospital ${status === "active" ? "activated" : "deactivated"}`, "success");
      load(page, search);
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
      load(page, search);
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

  const runSearch = (value) => {
    setSearch(value);
    setPage(1);
    load(1, value);
  };

  const changePage = (next) => {
    setPage(next);
    load(next, search);
  };

  if (!data) return <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

      <SectionTitle title="Platform Overview" subtitle="Real-time snapshot across every hospital on Missile Health" />

      {/* Platform-level stat cards -- backed by /super-admin/dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Hospitals" value={platform?.hospitals ?? data.total} icon={<IconHospital className="text-xl" />} tint="primary" />
        <StatCard label="Active Hospitals" value={platform?.activeHospitals ?? "\u2014"} icon={<IconCheck className="text-xl" />} tint="success" />
        <StatCard label="Inactive Hospitals" value={platform?.inactiveHospitals ?? "\u2014"} icon={<IconShield className="text-xl" />} tint="warning" />
        <StatCard label="Today's Appointments" value={platform?.todayAppointments ?? "\u2014"} icon={<IconCalendar className="text-xl" />} tint="accent" />
        <StatCard label="Total Doctors" value={platform?.totalDoctors ?? "\u2014"} icon={<IconDoctor className="text-xl" />} tint="violet" />
        <StatCard label="Total Patients" value={platform?.totalPatients ?? "\u2014"} icon={<IconUsers className="text-xl" />} tint="teal" />
        <StatCard label="Reception Staff" value={platform?.totalReception ?? "\u2014"} icon={<IconActivity className="text-xl" />} tint="primary" />
        <StatCard label="Pharmacy Staff" value={platform?.totalPharmacy ?? "\u2014"} icon={<IconPill className="text-xl" />} tint="accent" />
      </div>

      {/* Analytics: only shows what the API actually provides -- no fabricated trend lines */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="Hospital Distribution" subtitle="Active vs inactive tenants" />
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
          <SectionTitle title="Platform Workforce" subtitle="Staff composition across all hospitals" />
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

      {/* Growth trend charts require date-bucketed backend aggregation that doesn't
          exist yet -- rather than fabricate numbers, we say so plainly. */}
      <Card>
        <SectionTitle title="Growth Trends" subtitle="Hospital, patient & appointment growth over time" right={<span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-warning)] bg-[var(--color-warning-soft)] px-2.5 py-1 rounded-full">Needs backend support</span>} />
        <EmptyState
          icon={<IconChart className="text-3xl text-[var(--color-ink-soft)]" />}
          title="Trend analytics aren't wired up yet"
          hint="This needs a backend endpoint that buckets hospitals, patients, and appointments by month. Once that exists, this card will show real growth lines instead of placeholder data."
        />
      </Card>

      {/* Hospital management table */}
      <Card>
        <SectionTitle
          title="Hospitals"
          subtitle={`${data.total} hospital${data.total === 1 ? "" : "s"} registered`}
          right={
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => runSearch(e.target.value)}
                placeholder={"Search hospitals\u2026"}
                className={`${inputClass} w-56`}
              />
              <Button onClick={() => setCreating(true)}><IconPlus /> Add hospital</Button>
            </div>
          }
        />
        {data.hospitals.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-ink-soft)] uppercase sticky top-0 bg-[var(--color-surface)]">
                    <th className="pb-3">Hospital</th>
                    <th className="pb-3">Code</th>
                    <th className="pb-3">Admin</th>
                    <th className="pb-3">Staff</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Created</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {data.hospitals.map((h) => (
                    <tr key={h._id} className="align-top hover:bg-[var(--color-surface-2)] transition-colors duration-150">
                      <td className="py-3">
                        <div className="font-medium text-[var(--color-ink)]">{h.name}</div>
                        <div className="text-xs text-[var(--color-ink-soft)] font-[var(--font-mono)]">{h.hospitalId}</div>
                      </td>
                      <td className="py-3 text-xs font-[var(--font-mono)] text-[var(--color-primary)]">{h.code}</td>
                      <td className="py-3">
                        <div className="text-sm">{h.admin?.name || "\u2014"}</div>
                        <div className="text-xs text-[var(--color-ink-soft)]">{h.admin?.email || ""}</div>
                      </td>
                      <td className="py-3 text-xs text-[var(--color-ink-soft)]">
                        Dr: {h.stats?.doctors || 0}, Pt: {h.stats?.patients || 0}, Rx: {h.stats?.pharmacies || 0}
                      </td>
                      <td className="py-3"><StatusBadge status={h.status} /></td>
                      <td className="py-3 text-xs text-[var(--color-ink-soft)]">{new Date(h.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 text-right">
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

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-line)]">
              <p className="text-xs text-[var(--color-ink-soft)]">Page {data.page || page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" icon={<IconChevronLeft />} disabled={(data.page || page) <= 1} onClick={() => changePage((data.page || page) - 1)}>Prev</Button>
                <Button size="sm" variant="ghost" onClick={() => changePage((data.page || page) + 1)} disabled={(data.page || page) >= totalPages}>
                  Next <IconChevronRight />
                </Button>
              </div>
            </div>
          </>
        ) : <EmptyState icon={<IconHospital className="text-3xl text-[var(--color-ink-soft)]" />} title="No hospitals found" hint={search ? "Try a different search term." : "Create the first hospital to get started."} />}
      </Card>

      {/* Create Hospital Modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Create hospital" wide>
        <form className="grid grid-cols-2 gap-4" onSubmit={createHospital}>
          <Field label="Hospital name"><input name="name" required className={inputClass} /></Field>
          <Field label="Hospital code"><input name="code" required className={inputClass} placeholder="e.g. CITY" /></Field>
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
            <Button type="submit">Create hospital</Button>
          </div>
        </form>
      </Modal>

      {/* Hospital detail modal -- wired to the real GET /super-admin/hospitals/:id endpoint */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.hospital?.name || "Hospital details"} wide>
        {viewLoading ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 oskeleton rounded-2xl" /><div className="h-20 oskeleton rounded-2xl" />
            <div className="h-20 oskeleton rounded-2xl" /><div className="h-20 oskeleton rounded-2xl" />
          </div>
        ) : viewing?.stats ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={viewing.hospital.status} />
              <span className="text-xs font-[var(--font-mono)] text-[var(--color-ink-soft)]">{viewing.hospital.hospitalId}</span>
              <span className="text-xs text-[var(--color-ink-soft)]">Created {new Date(viewing.hospital.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Doctors" value={viewing.stats.doctors} icon={<IconDoctor className="text-lg" />} tint="primary" />
              <StatCard label="Patients" value={viewing.stats.patients} icon={<IconUsers className="text-lg" />} tint="teal" />
              <StatCard label="Reception" value={viewing.stats.receptionists} icon={<IconActivity className="text-lg" />} tint="accent" />
              <StatCard label="Pharmacy" value={viewing.stats.pharmacies} icon={<IconPill className="text-lg" />} tint="violet" />
              <StatCard label="Cleaning Staff" value={viewing.stats.cleaners} icon={<IconUsers className="text-lg" />} tint="warning" />
              <StatCard label="Total Appointments" value={viewing.stats.appointments} icon={<IconCalendar className="text-lg" />} tint="primary" />
              <StatCard label="Today's Appointments" value={viewing.stats.todayAppointments} icon={<IconClock className="text-lg" />} tint="accent" />
              <StatCard label="Pending Bills" value={viewing.stats.pendingBills} icon={<IconWallet className="text-lg" />} tint="danger" />
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)] mb-2">Hospital Admin</p>
                <p className="text-sm font-medium text-[var(--color-ink)]">{viewing.hospital.admin?.name || "\u2014"}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">{viewing.hospital.admin?.email || "No admin assigned"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-soft)] mb-2">Location</p>
                <p className="text-sm text-[var(--color-ink)]">{[viewing.hospital.city, viewing.hospital.state, viewing.hospital.country].filter(Boolean).join(", ") || "\u2014"}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">{viewing.hospital.address || ""}</p>
              </div>
            </div>
          </div>
        ) : <EmptyState title="Couldn't load this hospital" hint="Please try again." />}
      </Modal>
    </div>
  );
}
