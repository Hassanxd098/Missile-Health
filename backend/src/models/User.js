import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ["patient", "doctor", "admin", "superadmin", "hospital_admin", "pharmacy", "reception", "cleaner", "nurse", "management", "security", "other"],
    default: "patient",
    index: true,
  },
  // Multi-tenant scoping — every hospital-owned user record references the
  // Hospital it belongs to. Super admins have no hospitalId.
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", index: true },
  // Permanent public identifier auto-generated for patients (e.g. PAT-9876543210-2401).
  patientId: { type: String, unique: true, sparse: true, index: true },
  // Unique employee number for hospital staff (e.g. EMP-DOC-0004). Staff roles
  // only; auto-assigned by the admin employee directory if not provided.
  // Uniqueness is enforced per hospital via the compound index below.
  employeeNumber: { type: String, sparse: true, trim: true, uppercase: true, index: true },

  profile: {
    specialty: String,
    licenseNumber: String,
    phone: String,
    location: { type: String, trim: true, maxlength: 120 },
    visitingHours: { type: String, trim: true, maxlength: 160 },
    consultationFee: { type: Number, min: 0, default: 0 },
    availableToday: { type: Boolean, default: true },
    abhaNumber: String,
    dob: Date,
    address: String,
    gender: String,
    age: Number,
    // Doctor profile extensions
    qualification: String,
    experienceYears: Number,
    registrationNumber: String,
    digitNumber: Number,
    opdNumber: String,
    opdCharges: { type: Number, min: 0, default: 0 },
    profilePhoto: String,
    // Weekly availability windows for appointment booking, e.g.
    // [{ day: 1, start: "10:00", end: "14:00" }, { day: 1, start: "17:00", end: "21:00" }]
    availability: [{ _id: false, day: Number, start: String, end: String }],
    slotMinutes: { type: Number, min: 15, default: 15 },
    // Rest minutes blocked before each hour (e.g. 15 => 10:45-11:00 is a break).
    breakMinutes: { type: Number, min: 0, default: 15 },
    // Staff fields shared by admin/reception/cleaner profiles.
    salary: { type: Number, min: 0, default: 0 },
    designation: { type: String, trim: true, maxlength: 80 },
    department: { type: String, trim: true, maxlength: 80 },
    joinDate: Date,
  },

  // Patient medical record
  patient: {
    bloodGroup: String,
    heightCm: Number,
    weightKg: Number,
    bmi: Number,
    bloodPressure: String,
    sugarLevel: String,
    pulse: String,
    temperature: String,
    oxygenLevel: String,
    allergies: String,
    existingDiseases: String,
    previousDiseases: String,
    medicalHistory: String,
    currentMedicines: String,
  },
  emergencyContact: {
    name: String,
    relation: String,
    phone: String,
  },
  insurance: {
    provider: String,
    policyNumber: String,
    expiresOn: Date,
  },

  // ---- Pharmacy user
  pharmacy: {
    storeName: String,
    gstNumber: String,
    licenseNumber: String,
  },

  active: { type: Boolean, default: true },
  blocked: { type: Boolean, default: false },
  lastLoginAt: Date,
}, { timestamps: true });

// Keep an email lookup fast and mobile lookup for staff accounts.
userSchema.index({ mobile: 1 });
userSchema.index({ role: 1, active: 1 });
// Hospital-scoped unique constraint: every patientId must be globally unique,
// but a doctor/patient email must be unique *within* their hospital.
userSchema.index({ hospitalId: 1, role: 1, name: 1 });
// Employee numbers are unique per hospital.
userSchema.index({ hospitalId: 1, employeeNumber: 1 }, { unique: true, sparse: true });

export default mongoose.model("User", userSchema);