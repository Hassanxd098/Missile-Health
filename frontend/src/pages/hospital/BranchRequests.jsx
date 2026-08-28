import { useEffect, useState, useCallback } from "react";
import client from "../../api/client";
import Card, { Button, Field, inputClass, SectionTitle, EmptyState, SkeletonCard, Modal, useToast } from "../../components/ui";
import { IconPlus, IconHospital, IconCheck, IconClock, IconShield } from "../../components/Icons";

export default function BranchRequests() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await client.get("/admin/branch-requests");
      setBranches(data.branchRequests || []);
    } catch (err) {
      toast(err.response?.data?.error || "Unable to load branch requests", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleCreateBranchRequest = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setSubmitting(true);

    try {
      await client.post("/admin/branch-requests", {
        name: f.get("name"),
        code: f.get("code"),
        email: f.get("email"),
        phone: f.get("phone"),
        address: f.get("address"),
        city: f.get("city"),
        state: f.get("state"),
        country: f.get("country"),
      });

      toast("Branch setup request submitted! Awaiting Superadmin approval.", "success");
      setCreating(false);
      loadBranches();
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || "Failed to submit branch request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-purple-300 bg-purple-800/40 px-3 py-1 rounded-full border border-purple-400/30">
              🌿 Multi-Branch Network Management
            </span>
            <h1 className="text-2xl font-extrabold mt-2 font-[var(--font-display)]">
              Hospital Branch Requests & Expansion
            </h1>
            <p className="text-sm text-purple-200 mt-1 max-w-2xl">
              Request new branch locations for your hospital network. Once approved by Superadmin, your new branch becomes active under your admin control.
            </p>
          </div>

          <Button onClick={() => setCreating(true)} className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
            <IconPlus /> Request New Branch
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <SectionTitle
          title="Submitted Branch Setup Requests"
          subtitle="Track approval status for your hospital expansion locations"
          right={
            <Button size="sm" variant="ghost" onClick={loadBranches}>
              🔄 Refresh Status
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-3 mt-3"><SkeletonCard /><SkeletonCard /></div>
        ) : branches.length ? (
          <div className="space-y-3 mt-4">
            {branches.map((b) => (
              <div key={b._id} className="p-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/40 hover:bg-[var(--color-surface-2)] transition-all flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
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
                      {b.approvalStatus === "pending" ? "⏳ Pending Superadmin Approval" : b.approvalStatus === "approved" ? "✅ Approved & Active" : "❌ Request Declined"}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--color-ink-soft)]">
                    Main Network: <strong className="text-[var(--color-ink)]">{b.parentHospital?.name || "Main Hospital"}</strong> ({b.parentHospital?.city || "Network"})
                  </p>

                  <p className="text-xs text-[var(--color-ink-soft)]">
                    Location: 📍 {[b.city, b.state, b.country].filter(Boolean).join(", ") || "Location specified"} · Address: {b.address || "N/A"}
                  </p>

                  {b.rejectionReason && (
                    <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg mt-1">
                      <b>Decline Reason:</b> {b.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="text-xs text-right text-[var(--color-ink-soft)]">
                  <p>Requested: {new Date(b.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IconHospital className="text-3xl text-[var(--color-ink-soft)]" />}
            title="No branch requests yet"
            hint="Opening a new branch location (e.g. Ambur branch)? Click 'Request New Branch' to submit for Superadmin approval."
          />
        )}
      </Card>

      {/* Request New Branch Modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Request New Hospital Branch Setup" wide>
        <form className="grid grid-cols-2 gap-4" onSubmit={handleCreateBranchRequest}>
          <div className="col-span-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs text-blue-800 dark:text-blue-300 font-medium">
            💡 Branch Setup Note: Once Superadmin approves your branch request, the new location will be activated under your admin management automatically.
          </div>

          <Field label="Branch Hospital Name">
            <input name="name" required className={inputClass} placeholder="e.g. New Life Hospital - Ambur Branch" />
          </Field>

          <Field label="Branch Code">
            <input name="code" required className={inputClass} placeholder="e.g. NLH-AMB" />
          </Field>

          <Field label="Branch Email">
            <input name="email" type="email" className={inputClass} placeholder="ambur@newlife.com" />
          </Field>

          <Field label="Branch Contact Phone">
            <input name="phone" className={inputClass} placeholder="+91 9876543210" />
          </Field>

          <div className="col-span-2">
            <Field label="Branch Address">
              <input name="address" className={inputClass} placeholder="Main Road, Ambur Town" />
            </Field>
          </div>

          <Field label="City">
            <input name="city" required className={inputClass} placeholder="Ambur" />
          </Field>

          <Field label="State">
            <input name="state" className={inputClass} placeholder="Tamil Nadu" />
          </Field>

          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-[var(--color-line)]">
            <Button variant="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              {submitting ? "Submitting Request..." : "Submit Branch Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
