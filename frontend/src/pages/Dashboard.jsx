import { useEffect, useMemo, useState } from "react";
import { usePatient } from "../context/PatientContext";
import client from "../api/client";
import Topbar from "../components/Topbar";
import Card, { Button, Field, inputClass, Select, StatusBadge } from "../components/ui";

const specialties = [
  "All specialties",
  "General Physician",
  "Physiotherapist",
  "ENT Specialist",
  "Dermatologist",
  "Pediatrician",
];
const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);

function Prescription({ report }) {
  const download = () => {
    const lines = [
      `MISSILE HEALTH - PRESCRIPTION`,
      `Patient prescription`,
      `Doctor: ${report.doctor?.name || ""}`,
      `Specialty: ${report.doctor?.profile?.specialty || ""}`,
      `Issued: ${new Date(report.createdAt).toLocaleDateString()}`,
      "",
      "Assessment",
      report.assessment,
      "",
      "Medicines",
      ...report.prescription.map(
        (p, i) =>
          `${i + 1}. ${p.name} - ${p.dosage}; ${p.frequency}; ${p.durationDays} days`,
      ),
      report.sentToPharmacy
        ? `\nSent to pharmacy: ${report.pharmacyName || "Selected pharmacy"}`
        : "",
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "prescription.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex justify-between gap-3">
        <div>
          <b>{report.doctor?.name}</b>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {report.doctor?.profile?.specialty} ·{" "}
            {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Button variant="ghost" onClick={download}>
          Download
        </Button>
      </div>
      <p className="text-sm mt-2">{report.assessment}</p>
      {report.prescription?.length > 0 && (
        <p className="text-xs mt-2 text-[var(--color-ink-soft)]">
          {report.prescription.map((p) => p.name).join(", ")}
        </p>
      )}
      {report.sentToPharmacy && (
        <p className="text-xs text-[var(--color-success)] mt-2">
          Sent to {report.pharmacyName || "pharmacy"}
        </p>
      )}
    </div>
  );
}

function Patient() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [specialty, setSpecialty] = useState("All specialties");
  const [location, setLocation] = useState("");
  const load = async () => {
    try {
      setData((await client.get("/dashboard/patient")).data);
    } catch (e) {
      setError(e.response?.data?.error || "Unable to load dashboard");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const doctors = useMemo(
    () =>
      (data?.doctors || []).filter(
        (d) =>
          (specialty === "All specialties" ||
            d.profile?.specialty === specialty) &&
          (!location ||
            d.profile?.location
              ?.toLowerCase()
              .includes(location.toLowerCase())),
      ),
    [data, specialty, location],
  );
  const book = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await client.post("/dashboard/patient/appointments", {
        doctorId: f.get("doctorId"),
        scheduledFor: f.get("scheduledFor"),
        reason: f.get("reason"),
      });
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not book appointment");
    }
  };
  const cancel = async (id) => {
    try {
      await client.patch(`/dashboard/patient/appointments/${id}/cancel`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Could not cancel appointment");
    }
  };
  if (!data) return <p className="p-8">Loading your care dashboard...</p>;
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <Card>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-medium">Find your doctor</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Choose a specialty and preferred clinic location.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-80">
            <Select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            >
              {specialties.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Preferred location"
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
          {doctors.map((d) => (
            <div
              key={d._id}
              className="border border-[var(--color-line)] rounded-lg p-4"
            >
              <div className="flex justify-between gap-2">
                <b>{d.name}</b>
                {d.profile?.availableToday ? (
                  <span className="text-xs text-[var(--color-success)]">
                    Available today
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-ink-soft)]">
                    Unavailable
                  </span>
                )}
              </div>
              <p className="text-sm mt-1">{d.profile?.specialty}</p>
              <p className="text-xs text-[var(--color-ink-soft)] mt-2">
                {d.profile?.location} · {d.profile?.visitingHours}
              </p>
              <p className="text-sm font-medium mt-2">
                {money(d.profile?.consultationFee)}
              </p>
            </div>
          ))}
          {!doctors.length && (
            <p className="text-sm text-[var(--color-ink-soft)]">
              No doctors match your filters.
            </p>
          )}
        </div>
      </Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium mb-4">Book appointment</h2>
          <form className="space-y-3" onSubmit={book}>
            <Field label="Doctor">
              <Select name="doctorId" required>
                <option value="">Choose an available doctor</option>
                {doctors
                  .filter((d) => d.profile?.availableToday)
                  .map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} — {d.profile?.specialty} ({d.profile?.location})
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Date and time">
              <input
                name="scheduledFor"
                required
                type="datetime-local"
                className={inputClass}
              />
            </Field>
            <Field label="Reason for visit">
              <input name="reason" required className={inputClass} />
            </Field>
            <Button type="submit">Book appointment</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-medium mb-3">Your appointments</h2>
          {data.appointments.length ? (
            data.appointments.map((a) => (
              <div key={a._id} className="py-3 border-b last:border-0">
                <div className="flex justify-between gap-2">
                  <span>
                    <b>{a.doctor?.name}</b> ·{" "}
                    {new Date(a.scheduledFor).toLocaleString()}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                  {a.doctor?.profile?.specialty} · {a.doctor?.profile?.location}{" "}
                  · Fee {money(a.consultationFee)}
                </p>
                {["requested", "confirmed"].includes(a.status) && (
                  <Button
                    variant="ghost"
                    className="mt-2"
                    onClick={() => cancel(a._id)}
                  >
                    Cancel appointment
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--color-ink-soft)]">
              No appointments yet.
            </p>
          )}
        </Card>
      </div>
      <Card>
        <h2 className="font-medium mb-3">Prescriptions and reports</h2>
        {data.reports.length ? (
          data.reports.map((r) => <Prescription key={r._id} report={r} />)
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Your doctor’s published prescriptions will appear here.
          </p>
        )}
      </Card>
    </div>
  );
}

function Doctor() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const load = async () => {
    try {
      setData((await client.get("/dashboard/doctor")).data);
    } catch (e) {
      setError(e.response?.data?.error || "Unable to load appointments");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const update = async (id, status) => {
    try {
      await client.patch(`/dashboard/doctor/appointments/${id}`, { status });
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Could not update appointment");
    }
  };
  const prescribe = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const meds = [
      {
        name: f.get("medicine"),
        dosage: f.get("dosage"),
        frequency: f.get("frequency"),
        durationDays: Number(f.get("days")),
      },
    ].filter((x) => x.name);
    try {
      await client.put(`/dashboard/doctor/appointments/${selected._id}/note`, {
        assessment: f.get("assessment"),
        prescription: meds,
        publish: true,
        sendToPharmacy: f.get("sendToPharmacy") === "on",
        pharmacyName: f.get("pharmacyName"),
      });
      setSelected(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Could not publish prescription");
    }
  };
  if (!data) return <p className="p-8">Loading doctor dashboard...</p>;
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <Card>
        <h2 className="font-medium">Dr. {data.profile?.name}</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {data.profile?.profile?.specialty} · {data.profile?.profile?.location}{" "}
          · Visiting hours: {data.profile?.profile?.visitingHours}
        </p>
      </Card>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium mb-3">Appointment queue</h2>
          {data.appointments.length ? (
            data.appointments.map((a) => (
              <div key={a._id} className="py-3 border-b last:border-0">
                <div className="flex justify-between gap-2">
                  <span>
                    <b>{a.patient?.name}</b> ·{" "}
                    {new Date(a.scheduledFor).toLocaleString()}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  {a.reason}
                </p>
                {["requested", "confirmed"].includes(a.status) && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="ghost"
                      onClick={() => update(a._id, "confirmed")}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => update(a._id, "cancelled")}
                    >
                      Decline
                    </Button>
                    <Button onClick={() => setSelected(a)}>Prescription</Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-[var(--color-ink-soft)]">
              No appointments booked.
            </p>
          )}
        </Card>
        <Card>
          <h2 className="font-medium mb-3">
            {selected
              ? `Prescription for ${selected.patient?.name}`
              : "Prescription workspace"}
          </h2>
          {selected ? (
            <form className="space-y-3" onSubmit={prescribe}>
              <Field label="Assessment / diagnosis">
                <textarea
                  name="assessment"
                  required
                  className={`${inputClass} min-h-24`}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Medicine">
                  <input name="medicine" className={inputClass} />
                </Field>
                <Field label="Dose">
                  <input
                    name="dosage"
                    placeholder="e.g. 500 mg"
                    className={inputClass}
                  />
                </Field>
                <Field label="Frequency">
                  <input
                    name="frequency"
                    placeholder="e.g. Twice daily"
                    className={inputClass}
                  />
                </Field>
                <Field label="Days">
                  <input
                    name="days"
                    type="number"
                    min="1"
                    className={inputClass}
                  />
                </Field>
              </div>
              <label className="flex gap-2 text-sm">
                <input name="sendToPharmacy" type="checkbox" /> Send
                prescription to pharmacy
              </label>
              <input
                name="pharmacyName"
                placeholder="Pharmacy name"
                className={inputClass}
              />
              <div className="flex gap-2">
                <Button type="submit">Publish prescription</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-[var(--color-ink-soft)]">
              Select an active appointment to prepare and send a prescription.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Admin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setData((await client.get("/dashboard/admin")).data);
    } catch (e) {
      setError(e.response?.data?.error || "Unable to load administration");
    }
  };
  useEffect(() => {
    load();
  }, []);
  const addDoctor = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await client.post("/dashboard/admin/doctors", Object.fromEntries(f));
      e.currentTarget.reset();
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not add doctor");
    }
  };
  const cancel = async (id) => {
    try {
      await client.patch(`/dashboard/admin/appointments/${id}/cancel`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || "Could not cancel appointment");
    }
  };
  if (!data) return <p className="p-8">Loading administration...</p>;
  const patientCount = data.users.find((x) => x._id === "patient")?.count || 0;
  return (
    <div className="p-6 md:p-8 max-w-6xl space-y-6">
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Doctors available today
          </p>
          <p className="text-3xl font-[var(--font-display)]">
            {data.availableToday}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Patient visits today
          </p>
          <p className="text-3xl font-[var(--font-display)]">
            {data.todayAppointments}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--color-ink-soft)]">
            Registered patients
          </p>
          <p className="text-3xl font-[var(--font-display)]">{patientCount}</p>
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-medium mb-4">Add doctor</h2>
          <form onSubmit={addDoctor} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                name="name"
                required
                placeholder="Doctor name"
                className={inputClass}
              />
              <input
                name="email"
                required
                type="email"
                placeholder="Email"
                className={inputClass}
              />
              <input
                name="password"
                required
                minLength="8"
                type="password"
                placeholder="Temporary password"
                className={inputClass}
              />
              <Select name="specialty" required>
                <option value="">Specialty</option>
                {specialties.slice(1).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <input
                name="location"
                required
                placeholder="Clinic location"
                className={inputClass}
              />
              <input
                name="visitingHours"
                required
                placeholder="e.g. Mon-Sat, 10 AM-4 PM"
                className={inputClass}
              />
              <input
                name="consultationFee"
                required
                type="number"
                min="0"
                placeholder="Consultation fee (₹)"
                className={inputClass}
              />
            </div>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="availableToday" defaultChecked />{" "}
              Available today
            </label>
            <Button type="submit">Create doctor account</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-medium mb-3">Doctor directory</h2>
          {data.doctors.map((d) => (
            <div key={d._id} className="py-2 border-b last:border-0">
              <b>{d.name}</b>
              <p className="text-xs text-[var(--color-ink-soft)]">
                {d.profile?.specialty} · {d.profile?.location} ·{" "}
                {d.profile?.visitingHours}
              </p>
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <h2 className="font-medium mb-3">Appointments — admin control</h2>
        {data.recentAppointments.map((a) => (
          <div
            key={a._id}
            className="py-3 border-b last:border-0 flex flex-wrap justify-between gap-2"
          >
            <div>
              <b>{a.patient?.name}</b> → {a.doctor?.name}
              <p className="text-xs text-[var(--color-ink-soft)]">
                {new Date(a.scheduledFor).toLocaleString()} ·{" "}
                {money(a.consultationFee)}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <StatusBadge status={a.status} />
              {["requested", "confirmed"].includes(a.status) && (
                <Button variant="ghost" onClick={() => cancel(a._id)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="font-medium mb-3">Fees by patient</h2>
        {data.patientFees.map((f) => (
          <div
            key={f._id}
            className="py-2 border-b last:border-0 flex justify-between"
          >
            <span>
              {f.patientName}{" "}
              <span className="text-xs text-[var(--color-ink-soft)]">
                ({f.visits} visits)
              </span>
            </span>
            <b>{money(f.totalFees)}</b>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { patient } = usePatient();
  return (
    <div className="flex-1">
      <Topbar
        title={`${patient?.role || ""} dashboard`}
        subtitle="Clinic appointments, prescriptions and care coordination"
      />
      {patient?.role === "admin" ? (
        <Admin />
      ) : patient?.role === "doctor" ? (
        <Doctor />
      ) : (
        <Patient />
      )}
    </div>
  );
}
