// import { useEffect, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import client from "../../api/client";
// import Card, { Button, Field, inputClass, StatusBadge, SkeletonCard, SectionTitle, useToast } from "../../components/ui";
// import { IconTrash } from "../../components/Icons";

// const emptyMed = { name: "", dosage: "", morning: false, afternoon: false, night: false, beforeFood: false, afterFood: false, durationDays: 5, quantity: 1, instructions: "" };

// function IconUser() {
//   return <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
// }

// export default function Consultation() {
//   const { appointmentId } = useParams();
//   const navigate = useNavigate();
//   const toast = useToast();
//   const [data, setData] = useState(null);
//   const [error, setError] = useState("");
//   const [meds, setMeds] = useState([emptyMed]);
//   const [saving, setSaving] = useState(false);
//   const [form, setForm] = useState({ diagnosis: "", clinicalFindings: "", advice: "", followUpDate: "", doctorNotes: "", tests: "" });
//   const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

//   const load = async () => {
//     try { setData((await client.get(`/doctor/consult/${appointmentId}`)).data); }
//     catch (e) { setError(e.response?.data?.error || "Unable to load consultation"); }
//   };
//   useEffect(() => { load(); }, [appointmentId]);

//   const med = (i, k) => (e) => setMeds(meds.map((m, idx) => idx === i ? { ...m, [k]: e.type === "checkbox" ? e.target.checked : e.target.value } : m));

//   if (!data) return <div className="grid lg:grid-cols-3 gap-6"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
//   const { appointment, patient } = data;
//   const p = patient?.patient || {};
//   const vitals = [["Blood group ", p.bloodGroup], ["BP ", p.bloodPressure], ["Sugar ", p.sugarLevel], ["Pulse ", p.pulse], ["Temp ", p.temperature], ["O2 ", p.oxygenLevel], ["Allergies ", p.allergies]];

//   const submit = async () => {
//     setError(""); setSaving(true);
//     const payload = {
//       ...form,
//       labTests: form.tests.split(",").map((t) => t.trim()).filter(Boolean),
//       medicines: meds.filter((m) => m.name),
//       sendToPharmacy: true,
//     };
//     try {
//       await client.put(`/consultations/doctor/consultations/${appointmentId}`, payload);
//       toast("Consultation submitted. Prescription forwarded to pharmacy", "success");
//       navigate("/app/doctor");
//     } catch (e) { setError(e.response?.data?.error || "Could not submit consultation"); }
//     finally { setSaving(false); }
//   };

//   return (
//     <div className="space-y-6 animate-fade-up">
//       {error && <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-xl px-3 py-2">{error}</p>}

//       {/* Patient header */}
//       <Card className="border-[var(--color-primary-soft)]">
//         <div className="flex flex-wrap items-center justify-between gap-4">
//           <div className="flex items-center gap-4">
//             <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center text-xl"><IconUser /></div>
//             <div>
//               <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">{patient?.name}</h1>
//               <p className="text-sm text-[var(--color-ink-soft)]">Patient ID <span className="font-[var(--font-mono)] text-[var(--color-primary)]">{patient?.patientId}</span> · {appointment.token} · {new Date(appointment.scheduledFor).toLocaleString()}</p>
//             </div>
//           </div>
//           <div className="flex gap-2 items-center"><StatusBadge status={appointment.status} /></div>
//         </div>
//         {appointment.reason && <p className="mt-3 text-sm text-[var(--color-ink)]"><b>Complaint:</b> {appointment.reason}</p>}
//       </Card>

//       <div className="grid lg:grid-cols-3 gap-6">
//         {/* Vitals + history */}
//         <div className="space-y-6">
//           <Card>
//             <h2 className="font-semibold text-[var(--color-ink)] mb-3">Current vitals</h2>
//             <div className="grid grid-cols-2 gap-2">
//               {vitals.map(([k, v]) => <div key={k} className="bg-[var(--color-surface-2)] rounded-xl p-2.5"><p className="text-[11px] text-[var(--color-ink-soft)]">{k.trim()}</p><p className="font-medium text-[var(--color-ink)] text-sm">{v || "—"}</p></div>)}
//               </div>
//           </Card>
//           <Card>
//             <h2 className="font-semibold text-[var(--color-ink)] mb-3">Previous visits</h2>
//             {data.visits?.length ? data.visits.slice(0, 6).map((v) => (
//               <div key={v._id} className="py-1.5 text-sm border-b border-[var(--color-line)] last:border-0">
//                 <span className="font-medium text-[var(--color-ink)]">{v.doctor?.name}</span>
//                 <span className="text-[var(--color-ink-soft)]"> · {new Date(v.scheduledFor).toLocaleDateString()} · {v.status}</span>
//               </div>
//             )) : <p className="text-sm text-[var(--color-ink-soft)]">No previous visits.</p>}
//           </Card>
//           <Card>
//             <h2 className="font-semibold text-[var(--color-ink)] mb-3">History & notes</h2>
//             {data.notes?.length ? data.notes.slice(0, 3).map((n) => (
//               <div key={n._id} className="py-2 border-b border-[var(--color-line)] last:border-0">
//                 <p className="text-sm font-medium text-[var(--color-ink)]">{n.doctor?.name} <span className="font-normal text-[var(--color-ink-soft)]">· {new Date(n.createdAt).toLocaleDateString()}</span></p>
//                 <p className="text-sm text-[var(--color-ink-soft)]">{n.diagnosis || n.assessment}</p>
//               </div>
//             )) : <p className="text-sm text-[var(--color-ink-soft)]">No prior notes.</p>}
//           </Card>
//         </div>

//         {/* Consultation form */}
//         <Card className="lg:col-span-2">
//           <SectionTitle title="Consultation & prescription" subtitle={patient?.name} />
//           <div className="grid md:grid-cols-2 gap-4">
//             <div className="md:col-span-2"><Field label="Diagnosis"><textarea value={form.diagnosis} onChange={set("diagnosis")} className={`${inputClass} min-h-16`} /></Field></div>
//             <div className="md:col-span-2"><Field label="Clinical findings"><textarea value={form.clinicalFindings} onChange={set("clinicalFindings")} className={`${inputClass} min-h-16`} /></Field></div>
//             <div className="md:col-span-2"><Field label="Advice / instructions"><textarea value={form.advice} onChange={set("advice")} className={`${inputClass} min-h-16`} /></Field></div>
//             <Field label="Follow-up date"><input type="date" value={form.followUpDate} onChange={set("followUpDate")} className={inputClass} /></Field>
//             <Field label="Lab tests (comma separated)"><input value={form.tests} onChange={set("tests")} placeholder="CBC, X-Ray Chest" className={inputClass} /></Field>
//             <div className="md:col-span-2"><Field label="Doctor notes"><textarea value={form.doctorNotes} onChange={set("doctorNotes")} className={`${inputClass} min-h-14`} /></Field></div>
//           </div>

//           <div className="mt-6">
//             <div className="flex items-center justify-between mb-3">
//               <h3 className="font-semibold text-[var(--color-ink)]">Medicines</h3>
//               <Button size="sm" variant="ghost" onClick={() => setMeds([...meds, { ...emptyMed }])}>+ Add medicine</Button>
//             </div>
//             <div className="space-y-3">
//               {meds.map((m, i) => (
//                 <div key={i} className="border border-[var(--color-line)] rounded-xl p-3 bg-[var(--color-surface-2)]">
//                   <div className="grid md:grid-cols-4 gap-2">
//                     <Field label="Medicine"><input value={m.name} onChange={med(i, "name")} placeholder="e.g. Paracetamol" className={inputClass} /></Field>
//                     <Field label="Dosage"><input value={m.dosage} onChange={med(i, "dosage")} placeholder="e.g. 500 mg" className={inputClass} /></Field>
//                     <Field label="Duration (days)"><input type="number" min="1" value={m.durationDays} onChange={med(i, "durationDays")} className={inputClass} /></Field>
//                     <Field label="Qty"><input type="number" min="1" value={m.quantity} onChange={med(i, "quantity")} className={inputClass} /></Field>
//                   </div>
//                   <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs">
//                     {[["morning", "Morning"], ["afternoon", "Afternoon"], ["night", "Night"], ["beforeFood", "Before food"], ["afterFood", "After food"]].map(([k, label]) => (
//                       <label key={k} className="flex items-center gap-1.5 text-[var(--color-ink-soft)]"><input type="checkbox" checked={m[k]} onChange={med(i, k)} className="accent-[var(--color-primary)]" /> {label}</label>
//                     ))}
//                     <button type="button" onClick={() => setMeds(meds.filter((_, idx) => idx !== i))} className="col-span-2 md:col-span-1 flex items-center gap-1 text-[var(--color-danger)] justify-end"><IconTrash /> Remove</button>
//                   </div>
//                 </div>
//               ))}
//               {!meds.length && <p className="text-sm text-[var(--color-ink-soft)]">No medicines added. You can forward the prescription without medicines.</p>}
//             </div>
//           </div>

//           <div className="flex gap-3 mt-6">
//             <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit consultation & forward to pharmacy"}</Button>
//             <Button variant="ghost" onClick={() => navigate("/app/doctor")}>Cancel</Button>
//           </div>
//         </Card>
//       </div>
//     </div>
//   );
// }

// import { useEffect, useState } from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import client from "../../api/client";

import Card, {
  Button,
  Field,
  inputClass,
  Select,
  StatusBadge,
  SkeletonCard,
  SectionTitle,
  useToast,
} from "../../components/ui";

import { IconTrash } from "../../components/Icons";

/* =========================================================
   ICONS
========================================================= */

function IconUser() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconMic({ active = false }) {
  return (
    <svg
      width="1.2em"
      height="1.2em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "animate-pulse" : ""}
    >
      <rect
        x="9"
        y="2"
        width="6"
        height="12"
        rx="3"
      />

      <path d="M5 10a7 7 0 0 0 14 0" />

      <path d="M12 19v3" />

      <path d="M8 22h8" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg
      width="1.15em"
      height="1.15em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />

      <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
    </svg>
  );
}

/* =========================================================
   DEFAULT MEDICINE
========================================================= */

const emptyMed = {
  name: "",
  dosage: "",
  frequency: "",
  morning: false,
  afternoon: false,
  night: false,
  beforeFood: false,
  afterFood: false,
  durationDays: 5,
  quantity: 1,
  instructions: "",
};

/* =========================================================
   HELPERS
========================================================= */

const dateValue = (value) => {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
};

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

/* =========================================================
   CONSULTATION
========================================================= */

export default function Consultation() {
  const { appointmentId } = useParams();

  const navigate = useNavigate();

  const toast = useToast();

  /* =======================================================
     CONSULTATION STATE
  ======================================================= */

  const [data, setData] = useState(null);

  const [error, setError] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [meds, setMeds] = useState([
    {
      ...emptyMed,
    },
  ]);

  const [form, setForm] = useState({
    chiefComplaint: "",
    diagnosis: "",
    clinicalFindings: "",
    advice: "",
    followUpDate: "",
    doctorNotes: "",
    tests: "",
  });

  /* =======================================================
     AI SCRIBE STATE

     IMPORTANT:
     These are declared ONLY ONCE.
  ======================================================= */

  const [transcript, setTranscript] =
    useState("");

  const [interim, setInterim] =
    useState("");

  const [listening, setListening] =
    useState(false);

  const [processing, setProcessing] =
    useState(false);

  const [aiReady, setAiReady] =
    useState(false);

  const [voiceError, setVoiceError] =
    useState("");

  const [language, setLanguage] =
    useState("en-IN");

  /* =======================================================
     SPEECH RECOGNITION REFS
  ======================================================= */

  const recognitionRef =
    useRef(null);

  const finalTranscriptRef =
    useRef("");

  const shouldRestartRef =
    useRef(false);

  /* =======================================================
     BROWSER SPEECH API
  ======================================================= */

  const SpeechRecognition =
    useMemo(() => {
      if (
        typeof window ===
        "undefined"
      ) {
        return null;
      }

      return (
        window.SpeechRecognition ||
        window.webkitSpeechRecognition ||
        null
      );
    }, []);

  /* =======================================================
     LOAD CONSULTATION
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadConsultation =
      async () => {
        try {
          setError("");

          const response =
            await client.get(
              `/doctor/consult/${appointmentId}`,
            );

          if (!mounted) {
            return;
          }

          const result =
            response.data;

          setData(result);

          /*
           * If backend already contains
           * consultation data, populate form.
           */
          const consultation =
            result.consultation ||
            result.existingConsultation ||
            null;

          if (consultation) {
            setForm({
              chiefComplaint:
                consultation.chiefComplaint ||
                consultation.reason ||
                "",

              diagnosis:
                consultation.diagnosis ||
                consultation.assessment ||
                "",

              clinicalFindings:
                consultation.clinicalFindings ||
                consultation.findings ||
                "",

              advice:
                consultation.advice ||
                "",

              followUpDate:
                dateValue(
                  consultation.followUpDate,
                ),

              doctorNotes:
                consultation.doctorNotes ||
                consultation.notes ||
                "",

              tests:
                Array.isArray(
                  consultation.labTests,
                )
                  ? consultation.labTests.join(
                      ", ",
                    )
                  : consultation.tests ||
                    "",
            });

            if (
              Array.isArray(
                consultation.medicines,
              ) &&
              consultation.medicines.length
            ) {
              setMeds(
                consultation.medicines.map(
                  (medicine) => ({
                    ...emptyMed,
                    ...medicine,

                    durationDays:
                      safeNumber(
                        medicine.durationDays,
                        1,
                      ),

                    quantity:
                      safeNumber(
                        medicine.quantity,
                        1,
                      ),
                  }),
                ),
              );
            }
          }
        } catch (err) {
          if (!mounted) {
            return;
          }

          setError(
            err?.response?.data
              ?.error ||
              "Unable to load consultation",
          );
        }
      };

    if (appointmentId) {
      loadConsultation();
    }

    return () => {
      mounted = false;
    };
  }, [appointmentId]);

  /* =======================================================
     CLEANUP MICROPHONE
  ======================================================= */

  useEffect(() => {
    return () => {
      shouldRestartRef.current =
        false;

      try {
        recognitionRef.current?.stop?.();
      } catch {
        // Ignore browser cleanup errors.
      }
    };
  }, []);

  /* =======================================================
     FORM UPDATE
  ======================================================= */

  const setFormValue =
    (field) =>
    (event) => {
      setForm(
        (previous) => ({
          ...previous,

          [field]:
            event.target.value,
        }),
      );
    };

  /* =======================================================
     START VOICE
  ======================================================= */

  const startVoice = () => {
    setVoiceError("");

    if (!SpeechRecognition) {
      setVoiceError(
        "Voice recognition is not supported in this browser. Please use the latest Google Chrome or Microsoft Edge.",
      );

      return;
    }

    /*
     * Stop any existing recognition instance.
     */
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // Ignore.
    }

    const recognition =
      new SpeechRecognition();

    recognition.continuous = true;

    recognition.interimResults =
      true;

    recognition.maxAlternatives = 1;

    recognition.lang = language;

    /*
     * Keep previous final text.
     */
    finalTranscriptRef.current =
      transcript;

    shouldRestartRef.current =
      true;

    /* -------------------------------------------------------
       ON START
    ------------------------------------------------------- */

    recognition.onstart = () => {
      setListening(true);
      setVoiceError("");
    };

    /* -------------------------------------------------------
       ON RESULT
    ------------------------------------------------------- */

    recognition.onresult = (
      event,
    ) => {
      let finalText = "";
      let interimText = "";

      for (
        let index =
          event.resultIndex;
        index <
        event.results.length;
        index += 1
      ) {
        const result =
          event.results[index];

        const text =
          result?.[0]?.transcript ||
          "";

        if (result.isFinal) {
          finalText +=
            `${text} `;
        } else {
          interimText +=
            `${text} `;
        }
      }

      /*
       * Save final speech.
       */
      if (
        finalText.trim()
      ) {
        finalTranscriptRef.current =
          `${finalTranscriptRef.current} ${finalText}`
            .trim();

        setTranscript(
          finalTranscriptRef.current,
        );
      }

      /*
       * Show live interim speech.
       */
      setInterim(
        interimText.trim(),
      );
    };

    /* -------------------------------------------------------
       ON ERROR
    ------------------------------------------------------- */

    recognition.onerror = (
      event,
    ) => {
      console.error(
        "Speech recognition error:",
        event.error,
      );

      if (
        event.error ===
          "not-allowed" ||
        event.error ===
          "service-not-allowed"
      ) {
        shouldRestartRef.current =
          false;

        setListening(false);

        setVoiceError(
          "Microphone permission was blocked. Please allow microphone access in your browser.",
        );

        return;
      }

      if (
        event.error ===
        "audio-capture"
      ) {
        shouldRestartRef.current =
          false;

        setListening(false);

        setVoiceError(
          "No microphone was detected. Please check your microphone.",
        );

        return;
      }

      if (
        event.error ===
        "network"
      ) {
        setVoiceError(
          "Speech recognition needs an internet connection.",
        );

        return;
      }

      /*
       * no-speech can happen naturally
       * when doctor pauses.
       */
      if (
        event.error !==
        "no-speech"
      ) {
        setVoiceError(
          `Voice recognition error: ${event.error}`,
        );
      }
    };

    /* -------------------------------------------------------
       ON END
    ------------------------------------------------------- */

    recognition.onend = () => {
      setInterim("");

      if (
        shouldRestartRef.current
      ) {
        try {
          recognition.start();

          return;
        } catch {
          /*
           * Browser may already be
           * restarting.
           */
        }
      }

      setListening(false);
    };

    recognitionRef.current =
      recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error(
        "Unable to start recognition:",
        err,
      );

      setListening(false);

      setVoiceError(
        err?.message ||
          "Could not start microphone.",
      );
    }
  };

  /* =======================================================
     STOP VOICE
  ======================================================= */

  const stopVoice = () => {
    shouldRestartRef.current =
      false;

    try {
      recognitionRef.current?.stop?.();
    } catch {
      // Ignore.
    }

    recognitionRef.current =
      null;

    setListening(false);

    setInterim("");
  };

  /* =======================================================
     CLEAR TRANSCRIPT
  ======================================================= */

  const clearTranscript = () => {
    stopVoice();

    finalTranscriptRef.current =
      "";

    setTranscript("");

    setInterim("");

    setAiReady(false);

    setVoiceError("");
  };

  /* =======================================================
     PROCESS TRANSCRIPT WITH GEMINI
  ======================================================= */

 const processAI = async () => {
  const cleanTranscript =
    transcript.trim();

  if (cleanTranscript.length < 5) {
    setVoiceError(
      "Please enter or record the consultation first.",
    );

    return;
  }

  stopVoice();

  setProcessing(true);
  setVoiceError("");
  setError("");

  try {
    const response =
      await client.post(
        "/ai/medical-scribe",
        {
          appointmentId,
          transcript:
            cleanTranscript,
        },
      );

    console.log(
      "AI response:",
      response.data,
    );

    const ai =
      response?.data?.data;

    if (!ai) {
      throw new Error(
        "AI returned no consultation data.",
      );
    }

    setForm((previous) => ({
      ...previous,

      chiefComplaint:
        ai.chiefComplaint ||
        previous.chiefComplaint,

      diagnosis:
        ai.diagnosis ||
        previous.diagnosis,

      clinicalFindings:
        ai.clinicalFindings ||
        previous.clinicalFindings,

      advice:
        [
          ai.advice,
          ai.followUpInstruction,
        ]
          .filter(Boolean)
          .join("\n") ||
        previous.advice,

      followUpDate:
        ai.followUpDate ||
        previous.followUpDate,

      doctorNotes:
        ai.doctorNotes ||
        previous.doctorNotes,

      tests:
        Array.isArray(
          ai.labTests,
        )
          ? ai.labTests.join(", ")
          : previous.tests,
    }));

    if (
      Array.isArray(
        ai.medicines,
      ) &&
      ai.medicines.length > 0
    ) {
      setMeds(
        ai.medicines.map(
          (medicine) => ({
            ...emptyMed,

            name:
              medicine.name ||
              "",

            dosage:
              medicine.dosage ||
              "",

            frequency:
              medicine.frequency ||
              "",

            morning:
              Boolean(
                medicine.morning,
              ),

            afternoon:
              Boolean(
                medicine.afternoon,
              ),

            night:
              Boolean(
                medicine.night,
              ),

            beforeFood:
              Boolean(
                medicine.beforeFood,
              ),

            afterFood:
              Boolean(
                medicine.afterFood,
              ),

            durationDays:
              Number(
                medicine.durationDays,
              ) || 0,

            quantity:
              Number(
                medicine.quantity,
              ) || 0,

            instructions:
              medicine.instructions ||
              "",
          }),
        ),
      );
    }

    setAiReady(true);

    toast(
      "AI draft generated successfully. Please review the fields.",
      "success",
    );
  } catch (error) {
    console.error(
      "AI medical scribe error:",
      error,
    );

    console.error(
      "AI server response:",
      error?.response?.data,
    );

    setVoiceError(
      error?.response?.data?.error ||
        error?.message ||
        "Gemini could not process the consultation.",
    );
  } finally {
    setProcessing(false);
  }
};

  /* =======================================================
     MEDICINE UPDATE
  ======================================================= */

  const updateMedicine =
    (index, field) =>
    (event) => {
      const value =
        event.target.type ===
        "checkbox"
          ? event.target.checked
          : event.target.value;

      setMeds(
        (previous) =>
          previous.map(
            (
              medicine,
              medicineIndex,
            ) =>
              medicineIndex ===
              index
                ? {
                    ...medicine,

                    [field]:
                      value,
                  }
                : medicine,
          ),
      );
    };

  /* =======================================================
     ADD MEDICINE
  ======================================================= */

  const addMedicine = () => {
    setMeds(
      (previous) => [
        ...previous,

        {
          ...emptyMed,
        },
      ],
    );
  };

  /* =======================================================
     REMOVE MEDICINE
  ======================================================= */

  const removeMedicine =
    (index) => {
      setMeds(
        (previous) =>
          previous.filter(
            (
              _,
              medicineIndex,
            ) =>
              medicineIndex !==
              index,
          ),
      );
    };

  /* =======================================================
     SUBMIT CONSULTATION
  ======================================================= */

  const submit = async () => {
    setError("");

    /*
     * Diagnosis is required.
     */
    if (
      !form.diagnosis.trim()
    ) {
      setError(
        "Please enter the diagnosis / assessment before completing the consultation.",
      );

      return;
    }

    setSaving(true);

    const payload = {
      ...form,

      /*
       * Convert comma separated
       * tests to array.
       */
      labTests:
        form.tests
          .split(",")
          .map(
            (test) =>
              test.trim(),
          )
          .filter(Boolean),

      /*
       * Only submit medicines
       * which have a name.
       */
      medicines:
        meds.filter(
          (medicine) =>
            medicine.name &&
            medicine.name.trim(),
        ),

      /*
       * Existing pharmacy flow.
       */
      sendToPharmacy: true,
    };

    try {
      await client.put(
        `/consultations/doctor/consultations/${appointmentId}`,
        payload,
      );

      toast(
        "Consultation approved. Prescription forwarded to pharmacy.",
        "success",
      );

      navigate(
        "/app/doctor",
      );
    } catch (err) {
      console.error(
        "Consultation submission error:",
        err,
      );

      setError(
        err?.response?.data
          ?.error ||
          "Could not submit consultation",
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (!data) {
    if (error) {
      return (
        <div className="max-w-xl mx-auto py-12 animate-fade-up">
          <div className="rounded-3xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 p-8 text-center space-y-4 shadow-lg backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 grid place-items-center mx-auto text-2xl shadow-sm">🔒</div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Consultation Room Locked</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">{error}</p>
            <div className="pt-2">
              <Button onClick={() => navigate("/app/doctor")} className="shadow-md shadow-blue-500/20">
                ← Back to Doctor Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  /* =======================================================
     DATA
  ======================================================= */

  const {
    appointment,
    patient,
  } = data;

  const p =
    patient?.patient || {};

  const vitals = [
    [
      "Blood group",
      p.bloodGroup || patient?.profile?.bloodGroup,
    ],

    [
      "BP",
      p.bloodPressure || patient?.profile?.bloodPressure,
    ],

    [
      "Sugar",
      p.sugarLevel || patient?.profile?.sugarLevel,
    ],

    [
      "Pulse",
      p.pulse,
    ],

    [
      "Temp",
      p.temperature,
    ],

    [
      "O2",
      p.oxygenLevel,
    ],

    [
      "Height",
      (p.heightCm || patient?.profile?.heightCm) ? `${p.heightCm || patient?.profile?.heightCm} cm` : "",
    ],

    [
      "Weight",
      (p.weightKg || patient?.profile?.weightKg) ? `${p.weightKg || patient?.profile?.weightKg} kg` : "",
    ],

    [
      "BMI",
      p.bmi || patient?.profile?.bmi,
    ],

    [
      "Allergies",
      p.allergies,
    ],
  ];

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="space-y-6 animate-fade-up pb-10">

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="rounded-xl bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* =====================================================
          PATIENT HEADER
      ===================================================== */}

      <Card className="border-[var(--color-primary-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-4">

            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-primary)] text-xl text-white shadow-[0_10px_25px_-8px_var(--color-primary)]">
              <IconUser />
            </div>

            <div>

              <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">
                {patient?.name}
              </h1>

              <p className="text-sm text-[var(--color-ink-soft)]">

                Patient ID{" "}

                <span className="font-[var(--font-mono)] text-[var(--color-primary)]">
                  {patient?.patientId || "—"}
                </span>

                {" · "}

                Token{" "}

                {appointment?.token}

                {" · "}

                {appointment?.scheduledFor
                  ? new Date(
                      appointment.scheduledFor,
                    ).toLocaleString()
                  : "—"}

              </p>
            </div>
          </div>

          <StatusBadge
            status={
              appointment?.status
            }
          />

        </div>

        {appointment?.reason && (
          <p className="mt-3 text-sm text-[var(--color-ink)]">

            <b>
              Chief complaint:
            </b>{" "}

            {appointment.reason}

          </p>
        )}
      </Card>

      {/* =====================================================
          AI MEDICAL SCRIBE
      ===================================================== */}

      <Card className="overflow-hidden border-[var(--color-accent)]/30 p-0">

        {/* HEADER */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-accent-soft)] px-5 py-4">

          <div className="flex items-center gap-3">

            <div
              className={`
                grid h-10 w-10 place-items-center rounded-xl text-white
                ${
                  listening
                    ? "animate-pulse-ring bg-[var(--color-danger)]"
                    : "bg-[var(--color-accent)]"
                }
              `}
            >
              <IconMic
                active={
                  listening
                }
              />
            </div>

            <div>

              <div className="flex flex-wrap items-center gap-2">

                <h2 className="font-bold text-[var(--color-ink)]">
                  AI Medical Scribe
                </h2>

                <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">
                  Gemini assisted
                </span>

                {listening && (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-600">
                    Listening
                  </span>
                )}

              </div>

              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                Speak naturally. AI structures your words — you approve the final record.
              </p>

            </div>

          </div>

          {/* VOICE CONTROLS */}

          <div className="flex items-center gap-2">

            <Select
              value={language}
              disabled={
                listening
              }
              onChange={(
                event,
              ) =>
                setLanguage(
                  event.target.value,
                )
              }
              className="!w-auto"
            >
              <option value="en-IN">
                English (India)
              </option>

              <option value="en-US">
                English (US)
              </option>
            </Select>

            {!listening ? (
              <Button
                size="sm"
                onClick={
                  startVoice
                }
                icon={
                  <IconMic />
                }
              >
                Start voice
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={
                  stopVoice
                }
              >
                ■ Stop listening
              </Button>
            )}

          </div>
        </div>

        {/* SCRIBE BODY */}

        <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_.8fr]">

          {/* TRANSCRIPT */}

          <div className="min-h-40 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4">

            <div className="mb-3 flex items-center justify-between">

              <div>

                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink-soft)]">
                  Live transcript
                </p>

                <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">
                  {listening
                    ? "Listening… speak clearly and pause naturally."
                    : "Ready when you are."}
                </p>

              </div>

              {transcript && (
                <button
                  type="button"
                  onClick={
                    clearTranscript
                  }
                  className="text-xs font-semibold text-[var(--color-danger)] hover:underline"
                >
                  Clear
                </button>
              )}

            </div>

            {transcript ||
            interim ? (
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--color-ink)]">

                {transcript}

                {interim && (
                  <span className="text-[var(--color-primary)]">
                    {" "}
                    {interim}
                  </span>
                )}

              </p>
            ) : (
              <div className="grid h-24 place-items-center text-center text-sm text-[var(--color-ink-soft)]">

                <div>

                  <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-accent)]">
                    <IconMic />
                  </div>

                  Start the microphone and dictate the consultation.

                </div>

              </div>
            )}

          </div>

          {/* AI PROCESSING */}

          <div className="flex flex-col justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">

            <div>

              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink-soft)]">
                AI extraction
              </p>

              <p className="mt-2 text-sm text-[var(--color-ink)]">
                Gemini extracts only what the doctor says into editable clinical fields.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">

                {[
                  "Findings",
                  "Assessment",
                  "Prescription",
                  "Follow-up",
                ].map(
                  (item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-ink-soft)]"
                    >

                      <span className="mr-1 text-[var(--color-accent)]">
                        ✓
                      </span>

                      {item}

                    </div>
                  ),
                )}

              </div>

            </div>

            <Button
              className="mt-4 w-full"
              disabled={
                processing ||
                listening ||
                transcript.trim()
                  .length < 5
              }
              onClick={
                processAI
              }
              icon={
                processing
                  ? "…"
                  : <IconSparkles />
              }
            >
              {processing
                ? "Gemini is structuring…"
                : "Process with Gemini"}
            </Button>

          </div>

        </div>

        {/* AI RESULT / ERROR */}

        {(voiceError ||
          aiReady) && (
          <div className="px-5 pb-5">

            <div
              className={`
                rounded-xl px-3 py-2 text-xs
                ${
                  voiceError
                    ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                    : "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                }
              `}
            >
              {voiceError ||
                "AI draft ready — review every field below before approving."}
            </div>

          </div>
        )}

        {/* SAFETY */}

        <div className="border-t border-[var(--color-line)] bg-[var(--color-warning-soft)] px-5 py-3 text-[11px] font-medium text-[var(--color-warning)]">
          AI is a documentation assistant. It does not diagnose or prescribe independently. The doctor remains responsible for reviewing and approving the final consultation.
        </div>

      </Card>

      {/* =====================================================
          CONSULTATION
      ===================================================== */}

      <div className="grid gap-6 lg:grid-cols-3">

        {/* ===================================================
            LEFT SIDE
        =================================================== */}

        <div className="space-y-6">

          {/* VITALS */}

          <Card>

            <h2 className="mb-3 font-semibold text-[var(--color-ink)]">
              Current vitals
            </h2>

            <div className="grid grid-cols-2 gap-2">

              {vitals.map(
                ([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5"
                  >

                    <p className="text-[11px] text-[var(--color-ink-soft)]">
                      {label}
                    </p>

                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      {value ||
                        "—"}
                    </p>

                  </div>
                ),
              )}

            </div>

          </Card>

          {/* PATIENT FILLED MEDICAL INTAKE */}
          <Card>
            <h2 className="mb-3 font-semibold text-[var(--color-ink)]">
              Patient Medical Intake
            </h2>
            <div className="space-y-2 text-xs">
              <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-line)]">
                <p className="font-semibold text-[var(--color-ink)]">⚠️ Allergies</p>
                <p className="text-[var(--color-ink-soft)] mt-0.5">{p.allergies || "None declared"}</p>
              </div>
              <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-line)]">
                <p className="font-semibold text-[var(--color-ink)]">💊 Current Medicines</p>
                <p className="text-[var(--color-ink-soft)] mt-0.5">{p.currentMedicines || "None declared"}</p>
              </div>
              <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-line)]">
                <p className="font-semibold text-[var(--color-ink)]">🏥 Existing Diseases</p>
                <p className="text-[var(--color-ink-soft)] mt-0.5">{p.existingDiseases || "None declared"}</p>
              </div>
              <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-line)]">
                <p className="font-semibold text-[var(--color-ink)]">📜 Past Medical History</p>
                <p className="text-[var(--color-ink-soft)] mt-0.5">{p.medicalHistory || p.previousDiseases || "None declared"}</p>
              </div>
              {patient?.emergencyContact?.name && (
                <div className="bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[var(--color-line)]">
                  <p className="font-semibold text-[var(--color-ink)]">📞 Emergency Contact</p>
                  <p className="text-[var(--color-ink-soft)] mt-0.5">{patient.emergencyContact.name} ({patient.emergencyContact.relation || "Contact"}) · {patient.emergencyContact.phone || "—"}</p>
                </div>
              )}
            </div>
          </Card>

          {/* PREVIOUS VISITS */}

          <Card>

            <h2 className="mb-3 font-semibold text-[var(--color-ink)]">
              Previous visits
            </h2>

            {data.visits?.length ? (
              data.visits
                .slice(
                  0,
                  6,
                )
                .map(
                  (visit) => (
                    <div
                      key={
                        visit._id
                      }
                      className="border-b border-[var(--color-line)] py-1.5 text-sm last:border-0"
                    >

                      <span className="font-medium text-[var(--color-ink)]">
                        {
                          visit
                            .doctor
                            ?.name
                        }
                      </span>

                      <span className="text-[var(--color-ink-soft)]">
                        {" · "}

                        {visit.scheduledFor
                          ? new Date(
                              visit.scheduledFor,
                            ).toLocaleDateString()
                          : "—"}

                        {" · "}

                        {
                          visit.status
                        }

                      </span>

                    </div>
                  ),
                )
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">
                No previous visits.
              </p>
            )}

          </Card>

          {/* HISTORY */}

          <Card>

            <h2 className="mb-3 font-semibold text-[var(--color-ink)]">
              History & notes
            </h2>

            {data.notes?.length ? (
              data.notes
                .slice(
                  0,
                  3,
                )
                .map(
                  (note) => (
                    <div
                      key={
                        note._id
                      }
                      className="border-b border-[var(--color-line)] py-2 last:border-0"
                    >

                      <p className="text-sm font-medium text-[var(--color-ink)]">

                        {
                          note
                            .doctor
                            ?.name
                        }

                        <span className="font-normal text-[var(--color-ink-soft)]">
                          {" · "}

                          {note.createdAt
                            ? new Date(
                                note.createdAt,
                              ).toLocaleDateString()
                            : "—"}
                        </span>

                      </p>

                      <p className="text-sm text-[var(--color-ink-soft)]">
                        {note.diagnosis ||
                          note.assessment ||
                          "Clinical note"}
                      </p>

                    </div>
                  ),
                )
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">
                No prior notes.
              </p>
            )}

          </Card>

        </div>

        {/* ===================================================
            RIGHT SIDE
        =================================================== */}

        <Card className="lg:col-span-2">

          <SectionTitle
            title="Consultation & prescription"
            subtitle={
              patient?.name
            }
            right={
              aiReady ? (
                <span className="rounded-full bg-[var(--color-success-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-success)]">
                  ✓ AI draft ready
                </span>
              ) : null
            }
          />

          {/* =================================================
              CONSULTATION FIELDS
          ================================================= */}

          <div className="grid gap-4 md:grid-cols-2">

            {/* CHIEF COMPLAINT / REASON */}

            <div className="md:col-span-2">

              <Field label="Reason / chief complaint">

                <textarea
                  value={
                    form.chiefComplaint
                  }
                  onChange={setFormValue(
                    "chiefComplaint",
                  )}
                  placeholder="Why the patient came — symptoms and duration"
                  className={`${inputClass} min-h-16`}
                />

              </Field>

            </div>

            {/* DIAGNOSIS */}

            <div className="md:col-span-2">

              <Field label="Diagnosis / assessment">

                <textarea
                  value={
                    form.diagnosis
                  }
                  onChange={setFormValue(
                    "diagnosis",
                  )}
                  placeholder="Doctor's assessment only"
                  className={`${inputClass} min-h-16`}
                />

              </Field>

            </div>

            {/* CLINICAL FINDINGS */}

            <div className="md:col-span-2">

              <Field label="Clinical findings">

                <textarea
                  value={
                    form.clinicalFindings
                  }
                  onChange={setFormValue(
                    "clinicalFindings",
                  )}
                  placeholder="Findings, symptoms and observed vitals"
                  className={`${inputClass} min-h-16`}
                />

              </Field>

            </div>

            {/* ADVICE */}

            <div className="md:col-span-2">

              <Field label="Advice / instructions">

                <textarea
                  value={
                    form.advice
                  }
                  onChange={setFormValue(
                    "advice",
                  )}
                  placeholder="Doctor's advice and patient instructions"
                  className={`${inputClass} min-h-16`}
                />

              </Field>

            </div>

            {/* FOLLOW UP */}

            <Field label="Follow-up date">

              <input
                type="date"
                value={
                  form.followUpDate
                }
                onChange={setFormValue(
                  "followUpDate",
                )}
                className={
                  inputClass
                }
              />

            </Field>

            {/* TESTS */}

            <Field label="Lab tests (comma separated)">

              <input
                value={
                  form.tests
                }
                onChange={setFormValue(
                  "tests",
                )}
                placeholder="CBC, X-Ray Chest"
                className={
                  inputClass
                }
              />

            </Field>

            {/* DOCTOR NOTES */}

            <div className="md:col-span-2">

              <Field label="Doctor notes">

                <textarea
                  value={
                    form.doctorNotes
                  }
                  onChange={setFormValue(
                    "doctorNotes",
                  )}
                  placeholder="Additional clinical documentation"
                  className={`${inputClass} min-h-14`}
                />

              </Field>

            </div>

          </div>

          {/* =================================================
              PRESCRIPTION
          ================================================= */}

          <div className="mt-6">

            <div className="mb-3 flex items-center justify-between gap-3">

              <div>

                <h3 className="font-semibold text-[var(--color-ink)]">
                  Smart prescription
                </h3>

                <p className="text-xs text-[var(--color-ink-soft)]">
                  Verify every medicine, dose and duration before approval.
                </p>

              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={
                  addMedicine
                }
              >
                + Add medicine
              </Button>

            </div>

            <div className="space-y-3">

              {meds.map(
                (
                  medicine,
                  index,
                ) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3"
                  >

                    {/* MEDICINE TOP */}

                    <div className="grid gap-2 md:grid-cols-4">

                      <Field label="Medicine">

                        <input
                          value={
                            medicine.name
                          }
                          onChange={updateMedicine(
                            index,
                            "name",
                          )}
                          placeholder="e.g. Paracetamol"
                          className={
                            inputClass
                          }
                        />

                      </Field>

                      <Field label="Dosage">

                        <input
                          value={
                            medicine.dosage
                          }
                          onChange={updateMedicine(
                            index,
                            "dosage",
                          )}
                          placeholder="e.g. 500 mg"
                          className={
                            inputClass
                          }
                        />

                      </Field>

                      <Field label="Frequency">

                        <input
                          value={
                            medicine.frequency
                          }
                          onChange={updateMedicine(
                            index,
                            "frequency",
                          )}
                          placeholder="e.g. Twice daily"
                          className={
                            inputClass
                          }
                        />

                      </Field>

                      <Field label="Duration (days)">

                        <input
                          type="number"
                          min="1"
                          value={
                            medicine.durationDays
                          }
                          onChange={updateMedicine(
                            index,
                            "durationDays",
                          )}
                          className={
                            inputClass
                          }
                        />

                      </Field>

                    </div>

                    {/* MEDICINE OPTIONS */}

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">

                      {[
                        [
                          "morning",
                          "Morning",
                        ],

                        [
                          "afternoon",
                          "Afternoon",
                        ],

                        [
                          "night",
                          "Night",
                        ],

                        [
                          "beforeFood",
                          "Before food",
                        ],

                        [
                          "afterFood",
                          "After food",
                        ],
                      ].map(
                        ([
                          key,
                          label,
                        ]) => (
                          <label
                            key={
                              key
                            }
                            className="flex cursor-pointer items-center gap-1.5 text-[var(--color-ink-soft)]"
                          >

                            <input
                              type="checkbox"
                              checked={
                                Boolean(
                                  medicine[
                                    key
                                  ],
                                )
                              }
                              onChange={updateMedicine(
                                index,
                                key,
                              )}
                              className="accent-[var(--color-primary)]"
                            />

                            {
                              label
                            }

                          </label>
                        ),
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          removeMedicine(
                            index,
                          )
                        }
                        className="ml-auto flex items-center gap-1 text-[var(--color-danger)]"
                      >
                        <IconTrash />

                        Remove
                      </button>

                    </div>

                    {/* INSTRUCTIONS */}

                    <div className="mt-3">

                      <Field label="Instructions">

                        <input
                          value={
                            medicine.instructions
                          }
                          onChange={updateMedicine(
                            index,
                            "instructions",
                          )}
                          placeholder="e.g. Take after meals"
                          className={
                            inputClass
                          }
                        />

                      </Field>

                    </div>

                  </div>
                ),
              )}

              {!meds.length && (
                <p className="text-sm text-[var(--color-ink-soft)]">
                  No medicines added.
                </p>
              )}

            </div>

          </div>

          {/* =================================================
              FINAL APPROVAL
          ================================================= */}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)] p-4">

            <div>

              <p className="font-semibold text-[var(--color-ink)]">
                Ready to finalize?
              </p>

              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                Review the AI draft, prescription and notes before approving.
              </p>

            </div>

            <div className="flex gap-3">

              <Button
                onClick={
                  submit
                }
                disabled={
                  saving ||
                  !form.diagnosis.trim()
                }
              >
                {saving
                  ? "Approving…"
                  : "✓ Approve & complete"}
              </Button>

              <Button
                variant="ghost"
                onClick={() =>
                  navigate(
                    "/app/doctor",
                  )
                }
              >
                Cancel
              </Button>

            </div>

          </div>

        </Card>

      </div>

    </div>
  );
}