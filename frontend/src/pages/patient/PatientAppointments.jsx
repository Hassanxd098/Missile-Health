import { useEffect, useState, useMemo } from "react";
import client from "../../api/client";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchPatientAppointments, bookAppointment as bookAppointmentThunk, cancelAppointment as cancelAppointmentThunk } from "../../store/slices/patientSlice";
import Card, { Button, Field, inputClass, Select, StatusBadge, EmptyState, SkeletonCard, SectionTitle, DonutChart } from "../../components/ui";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const pad = (x) => String(x).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const MEDICAL_SPECIALTIES = [
  "All Specialties",
  "General Physician",
  "Gynecology & Obstetrics",
  "Orthopedics",
  "Physiotherapy",
  "ENT (Ear, Nose, Throat)",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Neurology",
  "Psychiatry",
  "Dental & Oral Care",
  "Gastroenterology",
  "Urology",
  "Pulmonology",
  "Endocrinology",
  "Oncology",
  "Nephrology",
  "General Surgery",
  "Ophthalmology",
];

export default function PatientAppointments() {
  const dispatch = useAppDispatch();
  const { appointments: rtkAppointments, loading: rtkLoading } = useAppSelector((state) => state.patient);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedHospitalId, setSelectedHospitalId] = useState("all");

  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Booking Flow State
  const [activeDoctor, setActiveDoctor] = useState(null);
  const [dateStr, setDateStr] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [meta, setMeta] = useState({ slotMinutes: 15, breakMinutes: 15, visitingHours: "", hasAvailability: true });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadHome = async () => {
    try {
      const { data } = await client.get("/patients/home");
      setData(data);
      dispatch(fetchPatientAppointments());
    } catch (e) { setError(e.response?.data?.error || "Unable to load patient data"); }
  };
  useEffect(() => { loadHome(); }, []);
  const emptyLine = () => { setError(""); setMsg(""); };

  // Load Active Hospitals
  useEffect(() => {
    let cancelled = false;
    client.get("/patients/hospitals")
      .then(({ data }) => { if (!cancelled) setHospitals(data.hospitals || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Extract unique cities list
  const cities = useMemo(() => {
    const set = new Set();
    hospitals.forEach((h) => { if (h.city) set.add(h.city); });
    return Array.from(set).sort();
  }, [hospitals]);

  // Fetch Doctors whenever Specialty or Hospital filter changes
  useEffect(() => {
    let cancelled = false;
    setLoadingDoctors(true);

    const params = new URLSearchParams();
    if (selectedHospitalId && selectedHospitalId !== "all") params.append("hospital", selectedHospitalId);
    else params.append("hospital", "all");

    if (specialty && specialty !== "all") params.append("specialty", specialty);

    client.get(`/patients/doctors?${params.toString()}`)
      .then(({ data }) => {
        if (!cancelled) {
          setDoctors(data.doctors || []);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.error || "Unable to load doctors"); })
      .finally(() => { if (!cancelled) setLoadingDoctors(false); });

    return () => { cancelled = true; };
  }, [selectedHospitalId, specialty]);

  // Filter Doctors on Frontend by City and Search Keyword
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const hosp = typeof doc.hospitalId === "object" && doc.hospitalId ? doc.hospitalId : {};

      if (selectedCity !== "all" && hosp.city && hosp.city.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const docName = (doc.name || "").toLowerCase();
        const docSpec = (doc.profile?.specialty || "").toLowerCase();
        const hospName = (hosp.name || "").toLowerCase();
        const hospCity = (hosp.city || "").toLowerCase();
        if (!docName.includes(q) && !docSpec.includes(q) && !hospName.includes(q) && !hospCity.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [doctors, selectedCity, searchQuery]);

  // Group Doctors by Hospital for intuitiveness
  const groupedHospitals = useMemo(() => {
    const groups = {};
    filteredDoctors.forEach((doc) => {
      const hosp = typeof doc.hospitalId === "object" && doc.hospitalId
        ? doc.hospitalId
        : { _id: doc.hospitalId || "default", name: "Hospital Facility", code: "HOSP", city: "Local" };

      const hospId = String(hosp._id || "default");
      if (!groups[hospId]) {
        groups[hospId] = {
          hospital: hosp,
          doctors: [],
        };
      }
      groups[hospId].doctors.push(doc);
    });
    return Object.values(groups);
  }, [filteredDoctors]);

  // Handle selecting a doctor for slot booking
  const handleSelectDoctorForBooking = (doc) => {
    emptyLine();
    setActiveDoctor(doc);
    setSelectedSlot("");
    setSlots([]);
  };

  // Fetch Available Slots for Selected Doctor
  useEffect(() => {
    let cancelled = false;
    if (!activeDoctor) { setSlots([]); setSelectedSlot(""); return; }
    setLoadingSlots(true); setSlots([]); setSelectedSlot("");

    const targetHospId = typeof activeDoctor.hospitalId === "object" ? activeDoctor.hospitalId._id : activeDoctor.hospitalId;

    client.get(`/patients/doctors/${activeDoctor._id}/slots?date=${dateStr}&hospital=${targetHospId}`)
      .then(({ data }) => { if (!cancelled) { setSlots(data.slots || []); setMeta(data); } })
      .catch((e) => { if (!cancelled) setError(e.response?.data?.error || "Unable to load slots"); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });

    return () => { cancelled = true; };
  }, [activeDoctor, dateStr]);

  const currentData = data || { user: {}, appointments: rtkAppointments || [], doctors: [] };
  const apptsList = currentData.appointments || [];

  // Submit Appointment Booking
  const book = async (e) => {
    e.preventDefault();
    emptyLine();
    if (!activeDoctor || !selectedSlot || submitting) return;

    const targetHospitalId = typeof activeDoctor.hospitalId === "object" ? activeDoctor.hospitalId._id : activeDoctor.hospitalId;

    setSubmitting(true);
    try {
      const result = await dispatch(bookAppointmentThunk({
        doctorId: activeDoctor._id,
        scheduledFor: selectedSlot,
        reason,
        symptoms: [],
        hospital: targetHospitalId,
      }));

      if (bookAppointmentThunk.fulfilled.match(result)) {
        setMsg(`Appointment booked with Dr. ${activeDoctor.name} for ${fmtTime(selectedSlot)}. Check your notifications for your token.`);
        setSelectedSlot(""); setReason("");
        loadHome().catch(() => {});
        const { data: fresh } = await client.get(`/patients/doctors/${activeDoctor._id}/slots?date=${dateStr}&hospital=${targetHospitalId}`);
        setSlots(fresh.slots || []); setMeta(fresh);
      } else {
        setError(result.payload || "Could not book appointment");
      }
    } catch (err) {
      setError("Could not book appointment");
    } finally { setSubmitting(false); }
  };

  const cancel = async (id) => {
    emptyLine();
    try {
      await dispatch(cancelAppointmentThunk(id));
      loadHome();
    } catch (e) { setError("Could not cancel appointment"); }
  };

  const statusCount = apptsList.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});
  const chartData = Object.entries(statusCount).map(([label, value]) => ({ label, value }));

  const currentSpecialtyLabel = specialty === "all" ? "All Specialties" : specialty;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-4 py-3 font-medium">{error}</p>}
      {msg && <p className="text-sm text-[var(--color-success)] bg-[var(--color-success-soft)] rounded-xl px-4 py-3 font-medium">{msg}</p>}

      {/* ==================== SEARCH & FILTER HEADER BAR ==================== */}
      <Card className="bg-gradient-to-r from-[var(--color-surface)] via-[var(--color-surface-2)] to-[var(--color-surface)] border border-[var(--color-line)] shadow-sm">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">Find Specialist & Nearby Hospitals</h2>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Select a medical specialty or search to see which hospitals have specialists available and book your appointment.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="text-xs font-medium text-[var(--color-ink-soft)] mb-1 block">Search Keyword</label>
              <input
                type="text"
                placeholder="Search Doctor, Specialty, Hospital..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-ink-soft)] mb-1 block">Medical Specialty</label>
              <Select value={specialty} onChange={(e) => { setSpecialty(e.target.value); setActiveDoctor(null); }}>
                {MEDICAL_SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec === "All Specialties" ? "all" : spec}>
                    {spec}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-ink-soft)] mb-1 block">City / Location</label>
              <Select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                <option value="all">All Cities / Locations</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-ink-soft)] mb-1 block">Specific Hospital</label>
              <Select value={selectedHospitalId} onChange={(e) => setSelectedHospitalId(e.target.value)}>
                <option value="all">All Hospitals</option>
                {hospitals.map((h) => (
                  <option key={String(h._id)} value={String(h._id)}>
                    {h.name}{h.city ? ` · ${h.city}` : ""} ({h.code})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* ==================== MAIN CONTENT: HOSPITALS & BOOKING ==================== */}
      <div className="grid lg:grid-cols-5 gap-6">
        
        {/* Left Column: Grouped Hospital List with Doctors */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg text-[var(--color-ink)]">
                Hospitals offering {currentSpecialtyLabel}
              </h3>
              <p className="text-xs text-[var(--color-ink-soft)]">
                {loadingDoctors
                  ? "Searching available hospitals & doctors..."
                  : `Found ${filteredDoctors.length} doctor(s) across ${groupedHospitals.length} hospital(s)`}
              </p>
            </div>
            {specialty !== "all" && (
              <button
                onClick={() => setSpecialty("all")}
                className="text-xs text-[var(--color-primary)] hover:underline font-medium"
              >
                Clear Specialty Filter
              </button>
            )}
          </div>

          {loadingDoctors ? (
            <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
          ) : groupedHospitals.length ? (
            groupedHospitals.map(({ hospital, doctors: hospDoctors }) => (
              <Card key={String(hospital._id || hospital.code)} className="border border-[var(--color-line)] hover:border-[var(--color-primary-soft)] transition-all">
                {/* Hospital Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--color-line)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-ink)] text-base">{hospital.name}</span>
                      {hospital.code && <span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2 py-0.5 rounded-full">{hospital.code}</span>}
                    </div>
                    {hospital.city && <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">📍 Location: {hospital.city}{hospital.state ? `, ${hospital.state}` : ""}</p>}
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 bg-[var(--color-success-soft)] text-[var(--color-success)] rounded-full">
                    {hospDoctors.length} {hospDoctors.length === 1 ? "Doctor" : "Doctors"} Available
                  </span>
                </div>

                {/* Hospital Doctors List */}
                <div className="divide-y divide-[var(--color-line)] mt-3">
                  {hospDoctors.map((doc) => {
                    const isSelected = activeDoctor && String(activeDoctor._id) === String(doc._id);
                    return (
                      <div key={doc._id} className={`py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl transition-all ${isSelected ? "bg-[var(--color-primary-soft)]/20 border border-[var(--color-primary)]" : "hover:bg-[var(--color-surface-2)]"}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[var(--color-ink)]">{doc.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium">
                              {doc.profile?.specialty || "Specialist"}
                            </span>
                          </div>
                          <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                            {doc.profile?.qualification ? `${doc.profile.qualification} · ` : ""}
                            {doc.profile?.experienceYears ? `${doc.profile.experienceYears} yrs exp · ` : ""}
                            Fee: <strong className="text-[var(--color-primary)]">{money(doc.profile?.consultationFee)}</strong>
                          </p>
                          {doc.profile?.visitingHours && (
                            <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">🕒 Hours: {doc.profile.visitingHours}</p>
                          )}
                        </div>

                        <Button
                          variant={isSelected ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => handleSelectDoctorForBooking(doc)}
                        >
                          {isSelected ? "Selected ✓" : "Book Slot"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))
          ) : (
            <EmptyState
              title="No doctors or hospitals found"
              hint="Try selecting 'All Specialties' or choosing a different city/keyword search."
            />
          )}
        </div>

        {/* Right Column: Time Slot Picker & Booking Form OR Appointment History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Doctor Booking Card */}
          <Card className={`border-2 transition-all ${activeDoctor ? "border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary-soft)]/20" : "border-[var(--color-line)]"}`}>
            <SectionTitle
              title={activeDoctor ? `Book with ${activeDoctor.name}` : "Select a Doctor"}
              subtitle={activeDoctor ? `${typeof activeDoctor.hospitalId === "object" ? activeDoctor.hospitalId.name : "Hospital"} · ${activeDoctor.profile?.specialty || ""}` : "Click 'Book Slot' on any doctor card to open time slots"}
            />

            {activeDoctor ? (
              <form className="space-y-4 mt-3" onSubmit={book}>
                <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs space-y-1">
                  <p className="font-semibold text-sm text-[var(--color-ink)]">{activeDoctor.name}</p>
                  <p className="text-[var(--color-ink-soft)]">{activeDoctor.profile?.specialty} · Fee: {money(activeDoctor.profile?.consultationFee)}</p>
                  <p className="text-[var(--color-primary)] font-medium">🏥 {typeof activeDoctor.hospitalId === "object" ? `${activeDoctor.hospitalId.name} (${activeDoctor.hospitalId.city || "Facility"})` : "Hospital Facility"}</p>
                </div>

                <Field label="Select Date">
                  <input
                    type="date"
                    min={todayStr()}
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <div>
                  <p className="text-xs font-medium text-[var(--color-ink-soft)] mb-1.5">Available Time Slots</p>
                  {loadingSlots ? (
                    <p className="text-sm text-[var(--color-ink-soft)]">Loading available slots for {dateStr}…</p>
                  ) : !meta.hasAvailability ? (
                    <p className="text-sm text-[var(--color-warning)]">Doctor has not set availability for this date. Try picking another date.</p>
                  ) : slots.length ? (
                    <>
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                        {slots.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSelectedSlot(s)}
                            className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                              selectedSlot === s
                                ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-soft)] scale-105 font-medium"
                                : "bg-[var(--color-surface-2)] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                            }`}
                          >
                            {fmtTime(s)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--color-ink-soft)] mt-2">
                        {meta.slotMinutes}-min slots · {meta.breakMinutes}-min hourly rest
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--color-warning)]">No slots available on this date. Choose another date.</p>
                  )}
                </div>

                <Field label="Reason for Visit / Symptoms">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className={`${inputClass} min-h-16`}
                    placeholder="Briefly describe your symptoms or reason for visit..."
                  />
                </Field>

                <div className="flex gap-2">
                  <Button type="submit" disabled={!selectedSlot || submitting} className="flex-1">
                    {submitting ? "Booking Token…" : selectedSlot ? "Confirm & Book Token" : "Select Slot Above"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setActiveDoctor(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="py-8 text-center text-sm text-[var(--color-ink-soft)]">
                👈 Please select a doctor from the hospital list on the left to view available booking slots.
              </div>
            )}
          </Card>

          {/* Patient Appointments Overview Card */}
          <Card>
            <SectionTitle title="Your Recent Appointments" subtitle={`${apptsList.length} total`} />
            {apptsList.length ? (
              <div className="space-y-3 mt-3">
                <div className="divide-y divide-[var(--color-line)] max-h-80 overflow-y-auto">
                  {apptsList.slice(0, 5).map((a) => (
                    <div key={a._id} className="py-2.5 first:pt-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-[var(--color-ink)] truncate">{a.doctor?.name}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">
                          {a.doctor?.profile?.specialty} · {new Date(a.scheduledFor).toLocaleDateString()} {fmtTime(a.scheduledFor)}
                        </p>
                        {a.token && <span className="text-xs font-[var(--font-mono)] text-[var(--color-primary)]">Token {a.token}</span>}
                      </div>
                      {["requested", "confirmed", "in-progress"].includes(a.status) && (
                        <Button variant="danger" size="sm" onClick={() => cancel(a._id)}>Cancel</Button>
                      )}
                    </div>
                  ))}
                </div>
                {chartData.length ? <DonutChart data={chartData} /> : null}
              </div>
            ) : (
              <EmptyState title="No appointments yet" hint="Select a doctor above to book your first appointment." />
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}