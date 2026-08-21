import mongoose from "mongoose";

const invoiceLineSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

// A single bill generated for a patient — either a consultation invoice
// (auto-generated after the doctor submits) or a pharmacy medicine invoice.
const invoiceSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true, index: true },
    invoiceNo: { type: String, unique: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription" },

    type: { type: String, enum: ["consultation", "pharmacy", "combined"], default: "consultation", index: true },

    consultationFee: { type: Number, min: 0, default: 0 },
    opdCharges: { type: Number, min: 0, default: 0 },

    lines: [invoiceLineSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    gstPercent: { type: Number, min: 0, default: 0 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    status: { type: String, enum: ["pending", "paid", "cancelled", "refunded"], default: "pending", index: true },

    paymentMethod: { type: String, enum: ["cash", "upi", "card", "insurance", "online", null], default: null },
    paidAt: Date,
    paidBy: { type: String, enum: ["patient", "pharmacy", "admin", null], default: null },
    transactionRef: String,

    preparedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

invoiceSchema.index({ hospitalId: 1, patient: 1, status: 1 });
invoiceSchema.index({ hospitalId: 1, doctor: 1, status: 1 });
invoiceSchema.index({ hospitalId: 1, type: 1, status: 1 });
export default mongoose.model("Invoice", invoiceSchema);