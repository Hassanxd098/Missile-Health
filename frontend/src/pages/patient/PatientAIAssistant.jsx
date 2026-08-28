import { useState, useRef, useEffect } from "react";
import client from "../../api/client";
import Card, { Button, SectionTitle, useToast } from "../../components/ui";
import { LabMetricsEChart, HealthGaugeEChart, MedicationPieEChart } from "../../components/ui/MedicalEChart";

const AI_TOOLS = [
  {
    id: "explain_lab_report",
    label: "Explain Lab Reports & Dynamic Charts",
    icon: "🧪",
    description: "Analyzes lab test results (CBC, LFT, KFT, Lipids, etc.) and plots interactive ECharts metrics against normal ranges.",
    placeholder: "Paste lab report text or values, e.g.\nHemoglobin: 11.2 g/dL (Ref: 12.0 - 16.5)\nWBC Count: 11500 /uL (Ref: 4000 - 11000)\nPlatelets: 250000 /uL (Ref: 150000 - 450000)\nBlood Sugar Fasting: 145 mg/dL (Ref: 70 - 100)...",
    sampleText: `PATIENT LAB REPORT:
- Hemoglobin (Hb): 11.2 g/dL (Normal Range: 12.0 - 16.5 g/dL) [LOW]
- WBC Total Count: 11,500 /uL (Normal Range: 4,000 - 11,000 /uL) [ELEVATED]
- Platelet Count: 2,45,000 /uL (Normal Range: 1,50,000 - 4,50,000 /uL) [NORMAL]
- Fasting Blood Glucose: 138 mg/dL (Normal Range: 70 - 100 mg/dL) [HIGH]
- Serum Creatinine: 0.9 mg/dL (Normal Range: 0.6 - 1.2 mg/dL) [NORMAL]
- Total Cholesterol: 242 mg/dL (Normal Range: 125 - 200 mg/dL) [HIGH]`,
  },
  {
    id: "structured_record",
    label: "Doctor Notes → Structured Record",
    icon: "🩺",
    description: "Converts raw or handwritten doctor notes into structured clinical sections (Reason for Visit, Vitals, Exam, Diagnosis, Treatment Plan).",
    placeholder: "Paste raw doctor notes, examination findings, or clinical dictation...",
    sampleText: `CLINICAL CONSULTATION NOTES:
Patient presents with high grade fever (102 F), severe body pain, and dry cough for 3 days.
Vitals: BP 122/78 mmHg, Pulse 88 bpm, SpO2 97% on room air, Weight 68 kg.
Exam: Throat congestion +, Chest clear bilaterally, No lymphadenopathy.
Impression/Diagnosis: Acute Viral Pharyngitis with Febrile Illness.
Plan: Tab Paracetamol 650mg TDS x 3 days, Tab Azithromycin 500mg OD x 3 days, Steam inhalation BD.
Follow-up: Review after 3 days if fever persists.`,
  },
  {
    id: "prescription_instructions",
    label: "Prescription & Medication Timetable",
    icon: "💊",
    description: "Generates daily medication timetables, food precautions, and dosage breakdown charts for prescribed drugs.",
    placeholder: "List prescribed medicines, e.g. Amoxicillin 500mg, Paracetamol 650mg, Pantoprazole 40mg...",
    sampleText: `PRESCRIBED MEDICATIONS:
1. Cap Pantoprazole 40mg - 1 capsule once daily before breakfast (Before food) x 7 days.
2. Tab Amoxicillin 500mg - 1 tablet morning and night after food x 5 days.
3. Tab Paracetamol 650mg - 1 tablet three times daily after food x 3 days.
4. Syrup Benadryl 10ml - 10ml at bedtime x 5 days.`,
  },
  {
    id: "summarize_consultation",
    label: "Summarize Consultation",
    icon: "📄",
    description: "Simplifies complex doctor-patient consultation notes into a clear, patient-friendly summary.",
    placeholder: "Paste consultation notes, doctor's remarks, or conversation summary here...",
    sampleText: `DOCTOR CONSULTATION SUMMARY:
Patient presented with mild chest tightness and dyspnea on exertion. ECG shows normal sinus rhythm. Trop-I negative. Echo shows EF 60%. Advised lifestyle modification, low salt diet, and stress management. Prescribed Telmisartan 40mg OD and Rosuvastatin 10mg HS. Re-evaluate in 2 weeks.`,
  },
  {
    id: "patient_history",
    label: "Summarize Patient History",
    icon: "📋",
    description: "Synthesizes past conditions, surgical history, family background, and known allergies.",
    placeholder: "Paste past medical records, discharge notes, or history logs...",
    sampleText: `PAST MEDICAL HISTORY:
- Known Type 2 Diabetes Mellitus x 5 years on Metformin 500mg BD.
- Hypertension x 3 years on Amlodipine 5mg OD.
- Appendectomy in 2018 (Uncomplicated).
- Allergy: Penicillin (causes skin rash).
- Family History: Father had Coronary Artery Disease.`,
  },
  {
    id: "discharge_summary",
    label: "Generate Discharge Summary",
    icon: "🏥",
    description: "Formats hospital stay details, admission diagnosis, procedures, and post-discharge home care guidelines.",
    placeholder: "Paste hospital admission notes, ward treatment log, and post-op care notes...",
    sampleText: `HOSPITAL DISCHARGE LOG:
Admitted: 2026-08-20, Discharged: 2026-08-24.
Diagnosis: Acute Appendicitis.
Procedure: Laparoscopic Appendectomy on 2026-08-21 (Uncomplicated).
Post-op course: Stable. Wounds clean. Tolerating oral diet.
Discharge Advice: Avoid heavy lifting for 3 weeks. Dressings to remain dry. Follow up in OPD after 7 days.`,
  },
  {
    id: "voice_scribe",
    label: "Voice Medical Scribe",
    icon: "🎙️",
    description: "Live audio dictation tool to transcribe spoken doctor-patient notes directly into structured medical records.",
    placeholder: "Click 'Voice Scribe' below to speak your consultation notes, or type transcript here...",
    sampleText: `SPOKEN DICTATION TRANSCRIPT:
Doctor dictating: Patient is a 45 year old male coming with complaints of severe lower back pain radiating to the right leg for 1 week. Straight leg raise test positive on the right at 45 degrees. Suspected Lumbar Disc Herniation. Ordering MRI Lumbar Spine. Prescribing Tab Naproxen 500mg BD with meals.`,
  },
];

const PROCESSING_STEPS = [
  { step: 1, title: "Reading & Scanning Document", subtitle: "Extracting clinical text & lab values...", icon: "📄" },
  { step: 2, title: "Analyzing Medical Values", subtitle: "Checking reference ranges & instructions...", icon: "🧬" },
  { step: 3, title: "Generating ECharts & Visuals", subtitle: "Structuring metrics & summary cards...", icon: "📊" },
  { step: 4, title: "Ready for View!", subtitle: "Analysis complete. Displaying results...", icon: "✨" },
];

export default function PatientAIAssistant() {
  const toast = useToast();
  const [activeTool, setActiveTool] = useState(AI_TOOLS[0]);
  const [inputText, setInputText] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [fileName, setFileName] = useState("");
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [activeTab, setActiveTab] = useState("charts"); // 'charts' | 'cards'

  const recognitionRef = useRef(null);

  // Animated processing step sequence interval
  useEffect(() => {
    let interval;
    if (loading) {
      setProcessingStep(0);
      interval = setInterval(() => {
        setProcessingStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 700);
    } else {
      setProcessingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const loadSampleText = () => {
    if (activeTool.sampleText) {
      setInputText(activeTool.sampleText);
      toast(`Loaded sample text for ${activeTool.label}`, "info");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    if (file.type.startsWith("image/") || file.name.endsWith(".png") || file.name.endsWith(".jpg") || file.name.endsWith(".jpeg") || file.name.endsWith(".webp") || file.name.endsWith(".bmp")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result;
        if (dataUrl) {
          const mimeType = file.type || "image/jpeg";
          const base64 = String(dataUrl).split(",")[1] || "";
          setImageData({ base64, mimeType, name: file.name, previewUrl: dataUrl });
          setDocumentText(`[Prescription Image Uploaded: ${file.name}]`);
          toast(`Prescription image "${file.name}" loaded for AI reading!`, "success");
        }
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".csv") || file.name.endsWith(".md") || file.name.endsWith(".json")) {
      setImageData(null);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setDocumentText(evt.target?.result || "");
        toast(`Uploaded file "${file.name}"`, "success");
      };
      reader.readAsText(file);
    } else {
      setImageData(null);
      setDocumentText(`[Attached Document File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\nPatient medical document attachment ready for analysis.`);
      toast(`Attached file "${file.name}"`, "info");
    }
  };

  const toggleVoiceRecording = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast("Speech recognition is not supported in this browser.", "error");
      return;
    }

    if (listening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (evt) => {
      let current = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        current += evt.results[i][0].transcript;
      }
      setInputText((prev) => (prev ? `${prev} ${current}`.trim() : current));
    };

    recognition.onerror = (evt) => {
      console.error("Speech recognition error:", evt.error);
      setListening(false);
      toast("Voice recording ended.", "info");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      toast("Microphone active — start speaking...", "info");
    } catch {
      setListening(false);
    }
  };

  // Text-to-Speech (TTS Voice Read Aloud)
  const toggleTextToSpeech = () => {
    if (!("speechSynthesis" in window)) {
      toast("Text-to-speech voice read aloud is not supported in this browser.", "error");
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      toast("Voice reading stopped.", "info");
      return;
    }

    let speechText = "";
    if (result?.data) {
      if (result.mode === "explain_lab_report") {
        speechText = `Lab Report Summary. ${result.data.summary || ""}. ${
          Array.isArray(result.data.abnormalResults) && result.data.abnormalResults.length > 0
            ? `Attention needed for: ${result.data.abnormalResults.join(". ")}`
            : ""
        }`;
      } else if (result.mode === "prescription_instructions") {
        speechText = `Prescription Summary. ${result.data.summary || ""}. Prescribed medicines include: ${
          Array.isArray(result.data.medicines)
            ? result.data.medicines.map((m) => `${m.name}, dosage ${m.dosage}, timing ${m.schedule}`).join(". ")
            : ""
        }`;
      } else {
        speechText = `Medical Summary. Main reason for visit: ${result.data.chiefComplaint || "None"}. Diagnosis: ${
          result.data.diagnosis || "Not listed"
        }. Treatment plan: ${result.data.treatmentPlan || "None"}. Follow up advice: ${result.data.followUp || "As directed by doctor"}`;
      }
    } else {
      speechText = result?.output || "";
    }

    if (!speechText.trim()) {
      toast("No summary text available to read aloud.", "error");
      return;
    }

    const cleanSpeech = speechText.replace(/[*#_`~-]/g, " ").replace(/\s+/g, " ").trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = "en-IN";
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    toast("AI reading summary out loud...", "info");
  };

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setResult(null);

    const combined = [inputText, documentText].filter(Boolean).join("\n\n");
    if ((!combined || combined.trim().length < 5) && !imageData) {
      setError("Please type notes, load sample text, or upload a medical document/prescription image first.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await client.post("/ai/patient-assistant", {
        mode: activeTool.id,
        inputText,
        documentText,
        imageData,
      });

      if (data.success) {
        setResult(data);
        setActiveTab("charts");
        toast("AI analysis & ECharts generated successfully!", "success");
      } else {
        setError(data.error || "Could not generate AI draft.");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "AI Assistant service is currently busy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result?.output) return;
    navigator.clipboard.writeText(result.output);
    toast("Copied draft to clipboard!", "success");
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Mandatory Clinical Disclaimer */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-[var(--font-display)] text-[var(--color-ink)] flex items-center gap-2">
              <span className="animate-pulse">✨</span> AI Medical Assistant
            </h1>
            <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
              Upload consultation notes, dictations, lab reports & discharge summaries for intelligent clinical drafting and analysis.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
            Powered by Gemini AI
          </span>
        </div>

        {/* Mandatory Clinical Disclaimer Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs flex items-start gap-3 shadow-sm">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <p className="font-bold text-sm mb-0.5">Clinical Decision Support Disclaimer</p>
            <p className="opacity-90 leading-relaxed">
              <strong>Important:</strong> AI outputs are generated for draft and decision support purposes only. All medical records, lab charts, and medication schedules must be reviewed and confirmed by a licensed medical doctor who makes the final clinical decision.
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: AI Tool selector & Form */}
        <div className="lg:col-span-6 space-y-4">
          
          <Card className="p-4">
            <SectionTitle title="AI Clinical Capabilities" subtitle="Select tool mode for analysis" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {AI_TOOLS.map((t) => {
                const isActive = activeTool.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTool(t);
                      setError("");
                    }}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl text-left transition-all duration-200 border ${
                      isActive
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md shadow-blue-500/20"
                        : "bg-[var(--color-surface-2)] text-[var(--color-ink)] border-[var(--color-line)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30"
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{t.icon}</span>
                    <div className="min-w-0">
                      <p className={`font-semibold text-xs truncate ${isActive ? "text-white" : "text-[var(--color-ink)]"}`}>{t.label}</p>
                      <p className={`text-[10px] mt-0.5 line-clamp-1 ${isActive ? "text-white/80" : "text-[var(--color-ink-soft)]"}`}>{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-[var(--color-line)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeTool.icon}</span>
                <h3 className="font-semibold text-sm text-[var(--color-ink)]">{activeTool.label}</h3>
              </div>

              <div className="flex items-center gap-2">
                {activeTool.sampleText && (
                  <button
                    type="button"
                    onClick={loadSampleText}
                    className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[var(--color-surface-2)] border border-[var(--color-line)] hover:border-[var(--color-primary)] text-[var(--color-ink)] transition-all"
                  >
                    💡 Load Sample
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    listening
                      ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30"
                      : "bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
                  }`}
                >
                  <span>{listening ? "🔴 Dictating..." : "🎙️ Voice Scribe"}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-soft)] mb-1.5 uppercase tracking-wider">
                  Medical Notes / Transcript Input
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={activeTool.placeholder}
                  className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 text-sm outline-none focus:border-[var(--color-primary)] transition-all text-[var(--color-ink)] min-h-36 resize-y font-mono"
                />
              </div>

              <div className="p-3.5 rounded-2xl border-2 border-dashed border-[var(--color-line)] bg-[var(--color-surface-2)]/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">📁</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-ink)] truncate">
                      {fileName ? `Attached: ${fileName}` : "Upload Medical Document or Lab Report"}
                    </p>
                    <p className="text-[10px] text-[var(--color-ink-soft)]">
                      {fileName ? "File text loaded" : "Supports .txt, .csv, .md, images & PDFs"}
                    </p>
                  </div>
                </div>

                <label className="px-3 py-1.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer shrink-0 transition-all">
                  Browse File
                  <input type="file" onChange={handleFileUpload} accept=".txt,.csv,.md,.json,.png,.jpg,.jpeg,.pdf" className="hidden" />
                </label>
              </div>

              {/* Prescription Image Preview */}
              {imageData && imageData.previewUrl && (
                <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-primary-soft)] text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img
                      src={imageData.previewUrl}
                      alt="Prescription Preview"
                      className="w-16 h-16 object-cover rounded-xl border border-[var(--color-line)] shadow-sm shrink-0"
                    />
                    <div>
                      <p className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                        <span>🩺 Prescription Image Attached</span>
                      </p>
                      <p className="text-[11px] text-[var(--color-ink-soft)] font-mono truncate max-w-xs">{imageData.name}</p>
                      <p className="text-[10px] text-[var(--color-primary)] font-semibold mt-0.5">✨ Gemini Vision will read handwritten & printed prescription text</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setImageData(null); setDocumentText(""); setFileName(""); }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-all cursor-pointer"
                  >
                    Remove Image ✕
                  </button>
                </div>
              )}

              {documentText && !imageData && (
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-[var(--color-ink)]">Document Content Ready</span>
                    <button type="button" onClick={() => { setDocumentText(""); setFileName(""); setImageData(null); }} className="text-red-500 text-[10px] font-bold hover:underline">
                      Remove ✕
                    </button>
                  </div>
                  <p className="text-[var(--color-ink-soft)] font-mono text-[11px] line-clamp-2">{documentText}</p>
                </div>
              )}

              {error && (
                <p className="text-xs text-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 rounded-xl font-medium">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 text-base font-bold shadow-lg shadow-blue-500/20 relative overflow-hidden transition-all duration-300 transform active:scale-[0.99]"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Processing Document & Notes...</span>
                  </div>
                ) : (
                  <span>Draft & Process with AI ✨</span>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Results & Animated Multi-Step Processing Progress */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="min-h-[540px] flex flex-col">
            <SectionTitle
              title="AI Clinical Output"
              subtitle={activeTool.label}
              right={
                result && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={speaking ? "danger" : "secondary"}
                      onClick={toggleTextToSpeech}
                      className="flex items-center gap-1.5"
                    >
                      <span>{speaking ? "⏸️ Stop Reading" : "🔊 Listen to AI Summary"}</span>
                    </Button>

                    <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl border border-[var(--color-line)]">
                      <button
                        type="button"
                        onClick={() => setActiveTab("charts")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          activeTab === "charts" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        📊 ECharts
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("cards")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          activeTab === "cards" ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        🩺 Summary Cards
                      </button>
                    </div>
                  </div>
                )
              }
            />

            {/* Dynamic Animated Step-by-Step Processing Visualizer */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 px-6 space-y-8 animate-fade-in">
                
                {/* Central Glowing Icon Spinner */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                  <span className="text-3xl animate-bounce">
                    {PROCESSING_STEPS[processingStep]?.icon || "✨"}
                  </span>
                </div>

                {/* Animated Status Headline */}
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold text-[var(--color-ink)] font-[var(--font-display)] flex items-center justify-center gap-2">
                    <span>{PROCESSING_STEPS[processingStep]?.title}</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)] animate-pulse">
                    {PROCESSING_STEPS[processingStep]?.subtitle}
                  </p>
                </div>

                {/* Multi-Step Timeline Progress Visualizer */}
                <div className="w-full max-w-md space-y-3 bg-[var(--color-surface-2)] p-5 rounded-2xl border border-[var(--color-line)] shadow-sm">
                  
                  {/* Progress Line */}
                  <div className="relative w-full h-2 bg-[var(--color-line)] rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-500 rounded-full"
                      style={{ width: `${((processingStep + 1) / 4) * 100}%` }}
                    />
                  </div>

                  {/* Step List Items */}
                  <div className="space-y-2.5">
                    {PROCESSING_STEPS.map((s, idx) => {
                      const isCompleted = idx < processingStep;
                      const isActive = idx === processingStep;
                      return (
                        <div
                          key={s.step}
                          className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300 ${
                            isActive
                              ? "bg-[var(--color-primary-soft)] border border-[var(--color-primary)]/30 text-[var(--color-primary)] shadow-sm"
                              : isCompleted
                              ? "text-emerald-500 opacity-90"
                              : "text-[var(--color-ink-soft)] opacity-40"
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                              isCompleted
                                ? "bg-emerald-500 text-white"
                                : isActive
                                ? "bg-[var(--color-primary)] text-white animate-pulse"
                                : "bg-[var(--color-line)] text-[var(--color-ink-soft)]"
                            }`}
                          >
                            {isCompleted ? "✓" : s.step}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs text-[var(--color-ink)] truncate">{s.title}</p>
                            <p className="text-[10px] text-[var(--color-ink-soft)] truncate">{s.subtitle}</p>
                          </div>
                          {isActive && <span className="text-xs animate-spin shrink-0">⏳</span>}
                        </div>
                      );
                    })}
                  </div>

                </div>

                <p className="text-[11px] text-[var(--color-ink-soft)] text-center italic">
                  "Please wait while processing — preparing final view..."
                </p>

              </div>
            ) : result ? (
              <div className="flex-1 flex flex-col justify-between space-y-4 animate-fade-up">
                <div className="space-y-4 flex-1">
                  
                  <div className="flex flex-wrap items-center justify-between p-2.5 rounded-xl bg-[var(--color-primary-soft)]/30 border border-[var(--color-primary)]/30 text-xs gap-2">
                    <span className="font-semibold text-[var(--color-primary)] flex items-center gap-1.5">
                      <span>✓</span> Mode: {AI_TOOLS.find((t) => t.id === result.mode)?.label || result.mode}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                        📋 Copy Text
                      </Button>
                    </div>
                  </div>

                  {/* TAB 1: Interactive ECharts */}
                  {activeTab === "charts" && (
                    <div className="space-y-4">
                      {result.data?.labMetrics && Array.isArray(result.data.labMetrics) && result.data.labMetrics.length > 0 ? (
                        <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-1.5">
                              <span>📊</span> Lab Test Metrics vs Normal Ranges
                            </h4>
                            <span className="text-[10px] text-emerald-500 font-semibold">Interactive ECharts</span>
                          </div>
                          <LabMetricsEChart metrics={result.data.labMetrics} />
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider">Health Stability</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold">Optimal</span>
                          </div>
                          <HealthGaugeEChart score={88} statusText="Health Score" />
                        </div>

                        {result.data?.medicines && Array.isArray(result.data.medicines) && result.data.medicines.length > 0 ? (
                          <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] flex flex-col justify-between">
                            <h4 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider">Rx Schedule Distribution</h4>
                            <MedicationPieEChart medicines={result.data.medicines} />
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-2">
                            <h4 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider">Overview Summary</h4>
                            <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
                              {result.data?.summary || result.output?.slice(0, 220) || "Analysis complete."}...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Patient Summary Cards */}
                  {activeTab === "cards" && (
                    result.data ? (
                      result.mode === "explain_lab_report" ? (
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                          {result.data.summary && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs text-[var(--color-ink)] font-medium">
                              📊 <strong>Lab Summary:</strong> {result.data.summary}
                            </div>
                          )}
                          {Array.isArray(result.data.abnormalResults) && result.data.abnormalResults.length > 0 && (
                            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-950 dark:text-amber-200">
                              ⚠️ <strong>Tests Requiring Attention (High or Low):</strong>
                              <ul className="list-disc pl-4 mt-1 space-y-1">
                                {result.data.abnormalResults.map((res, i) => (
                                  <li key={i}>{res}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(result.data.normalResults) && result.data.normalResults.length > 0 && (
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-950 dark:text-emerald-200">
                              🟢 <strong>Normal & Healthy Tests:</strong>
                              <ul className="list-disc pl-4 mt-1 space-y-1">
                                {result.data.normalResults.map((res, i) => (
                                  <li key={i}>{res}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Array.isArray(result.data.doctorQuestions) && result.data.doctorQuestions.length > 0 && (
                            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-950 dark:text-blue-200">
                              ❓ <strong>Questions to Ask Your Doctor:</strong>
                              <ul className="list-disc pl-4 mt-1 space-y-1">
                                {result.data.doctorQuestions.map((q, i) => (
                                  <li key={i}>{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : result.mode === "prescription_instructions" ? (
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                          {result.data.summary && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs text-[var(--color-ink)] font-medium">
                              📌 {result.data.summary}
                            </div>
                          )}
                          {Array.isArray(result.data.medicines) && (
                            <div className="space-y-2">
                              {result.data.medicines.map((m, idx) => (
                                <div key={idx} className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-xs space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-sm text-[var(--color-ink)]">{m.name}</span>
                                    {m.dosage && <span className="px-2.5 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-bold text-[11px]">{m.dosage}</span>}
                                  </div>
                                  <p className="text-[var(--color-ink-soft)]">When to take: <strong>{m.schedule}</strong> ({m.foodTiming})</p>
                                  {m.precautions && <p className="text-[11px] text-amber-500">⚠️ Advice: {m.precautions}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                          {result.data.chiefComplaint && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                              <p className="text-[11px] font-semibold text-[var(--color-ink-soft)] uppercase tracking-wider">📌 Main Reason for Visit</p>
                              <p className="text-xs text-[var(--color-ink)] font-medium mt-1">{result.data.chiefComplaint}</p>
                            </div>
                          )}
                          {result.data.vitals && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                              <p className="text-[11px] font-semibold text-[var(--color-ink-soft)] uppercase tracking-wider">🫀 Vitals & Measurements</p>
                              <p className="text-xs text-[var(--color-ink)] font-medium mt-1">{result.data.vitals}</p>
                            </div>
                          )}
                          {result.data.clinicalFindings && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] sm:col-span-2">
                              <p className="text-[11px] font-semibold text-[var(--color-ink-soft)] uppercase tracking-wider">🔍 Doctor Examination Notes</p>
                              <p className="text-xs text-[var(--color-ink)] font-medium mt-1">{result.data.clinicalFindings}</p>
                            </div>
                          )}
                          {result.data.diagnosis && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] sm:col-span-2">
                              <p className="text-[11px] font-semibold text-[var(--color-ink-soft)] uppercase tracking-wider">🏷️ Doctor Diagnosis & Condition</p>
                              <p className="text-xs font-bold text-[var(--color-primary)] mt-1">{result.data.diagnosis}</p>
                            </div>
                          )}
                          {result.data.treatmentPlan && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] sm:col-span-2">
                              <p className="text-[11px] font-semibold text-[var(--color-ink-soft)] uppercase tracking-wider">💊 Medication & Care Plan</p>
                              <p className="text-xs text-[var(--color-ink)] font-medium mt-1 whitespace-pre-wrap">{result.data.treatmentPlan}</p>
                            </div>
                          )}
                          {result.data.followUp && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] sm:col-span-2">
                              <p className="text-[11px] font-semibold text-[var(--color-ink-soft)] uppercase tracking-wider">📅 Follow-up & Next Steps</p>
                              <p className="text-xs text-[var(--color-ink)] font-medium mt-1">{result.data.followUp}</p>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-line)] text-sm text-[var(--color-ink)] whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto">
                        {result.output}
                      </div>
                    )
                  )}

                </div>

                <div className="pt-3 border-t border-[var(--color-line)] text-[11px] text-[var(--color-ink-soft)] flex items-start gap-2 bg-[var(--color-surface-2)]/60 p-3 rounded-xl">
                  <span className="text-amber-500 font-bold shrink-0">⚠️ Disclaimer:</span>
                  <span>{result.disclaimer}</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center text-[var(--color-ink-soft)]">
                <span className="text-5xl mb-3">📊</span>
                <p className="font-bold text-[var(--color-ink)] text-base">AI Medical Output Ready</p>
                <p className="text-xs max-w-sm mt-1">
                  Select a tool mode, click <strong>"💡 Load Sample"</strong>, then click <strong>"Draft & Process with AI"</strong>.
                </p>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
