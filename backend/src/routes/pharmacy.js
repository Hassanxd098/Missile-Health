import { Router } from "express";
import { requireAuth, allowRoles, hospitalScope } from "../middleware/authJwt.js";
import User from "../models/User.js";
import Prescription from "../models/Prescription.js";
import Invoice from "../models/Invoice.js";
import Appointment from "../models/Appointment.js";
import { generateInvoiceNo } from "../services/idService.js";
import { notify } from "../services/notificationService.js";
import { logAudit } from "../services/auditService.js";

const router = Router();
router.use(requireAuth, allowRoles("pharmacy", "admin", "hospital_admin"));

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const GST_RATE = 0.05; // 5% GST (India standard)

// Pharmacy's incoming prescription queue — scoped to the pharmacy's hospital.
router.get("/prescriptions", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { status, search = "", page = 1, limit = 20 } = req.query;
    const query = { ...scope };
    if (status && status !== "all") query.status = status;
    if (search) {
      const patient = await User.findOne({ ...scope, $or: [{ patientId: new RegExp(search, "i") }, { name: new RegExp(search, "i") }, { mobile: new RegExp(search, "i") }] }).select("_id").lean();
      if (patient) query.patient = patient._id;
    }
    const total = await Prescription.countDocuments(query);
    const prescriptionList = await Prescription.find(query)
      .populate("patient", "name patientId mobile")
      .populate("doctor", "name profile.specialty")
      .sort({ createdAt: -1 })
      .skip((Math.max(Number(page), 1) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    const pendingMedicines = await Prescription.countDocuments({ ...scope, status: { $in: ["new", "sent-to-pharmacy"] } });
    res.json({ prescriptions: prescriptionList, total: prescriptionList.length, totalCount: total, pendingMedicines, page: Number(page) });
  } catch (error) { next(error); }
});

// Advance a prescription through its workflow status — scoped to pharmacy's hospital.
router.patch("/prescriptions/:id/status", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { status } = req.body;
    if (!["preparing", "ready", "dispensed"].includes(status)) {
      return res.status(400).json({ error: "Invalid pharmacy status" });
    }
    if (status === "dispensed") {
      return res.status(400).json({ error: "Medicines must be billed and paid before being dispensed" });
    }
    const rx = await Prescription.findOneAndUpdate(
      { ...scope, _id: req.params.id, status: { $in: ["new", "sent-to-pharmacy", "preparing", "ready"] } },
      { $set: { status } },
      { new: true },
    );
    if (!rx) return res.status(404).json({ error: "Prescription not found or status not updatable" });
    if (status === "ready") {
      await notify(rx.patient, { title: "Medicine ready", body: `Your medicines are ready for collection/delivery (${rx.prescriptionId}).`, type: "medicine", entity: "prescription", entityId: rx._id });
    }
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "rx.status", entity: "prescription", entityId: rx._id, meta: { status, hospitalId: req.user.hospitalId } });
    res.json({ prescription: rx });
  } catch (error) { next(error); }
});

// Generate the pharmacy invoice — scoped to pharmacy's hospital.
router.post("/prescriptions/:id/invoice", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const rx = await Prescription.findOne({ ...scope, _id: req.params.id }).populate("patient", "_id name mobile patientId").lean();
    if (!rx) return res.status(404).json({ error: "Prescription not found" });

    const pricedLines = req.body.lines || [];
    const byName = new Map(pricedLines.map((l) => [l.name, l]));
    const lines = (rx.medicines || []).map((m) => {
      const price = money(byName.get(m.name)?.unitPrice);
      const qty = Number(m.quantity) || Number(m.durationDays) || 1;
      return { name: m.name, description: m.dosage || "", quantity: qty, unitPrice: price, amount: money(price * qty) };
    });
    const medicinesSubtotal = money(lines.reduce((s, l) => s + l.amount, 0));
    const gstAmount = money(medicinesSubtotal * GST_RATE);

    const existingConsult = await Invoice.findOne({ ...scope, appointment: rx.appointment, type: "consultation", patient: rx.patient, status: "pending" }).select("_id total").lean();

    const subtotal = money(medicinesSubtotal + (existingConsult?.total || 0));
    const total = money(subtotal + gstAmount);

    const invoice = await Invoice.create({
      hospitalId: req.user.hospitalId,
      invoiceNo: generateInvoiceNo(),
      patient: rx.patient._id,
      doctor: rx.doctor,
      appointment: rx.appointment,
      prescription: rx._id,
      type: "pharmacy",
      consultationFee: existingConsult?.total || 0,
      lines,
      subtotal,
      discount: 0,
      gstPercent: Math.round(GST_RATE * 100),
      gstAmount,
      total,
      status: "pending",
      preparedBy: req.user._id,
    });

    if (existingConsult) {
      await Invoice.updateOne(
        { ...scope, _id: existingConsult._id, status: "pending" },
        { $set: { status: "cancelled", transactionRef: `included-in-${invoice.invoiceNo}` } },
      );
    }

    await Prescription.updateOne({ ...scope, _id: rx._id }, { $set: { status: "ready", medicineCost: medicinesSubtotal } });

    await notify(rx.patient, {
      title: "Invoice ready",
      body: `Your pharmacy invoice ${invoice.invoiceNo} for ₹${money(total)} is pending payment.`,
      type: "invoice",
      entity: "invoice",
      entityId: invoice._id,
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "invoice.generate", entity: "invoice", entityId: invoice._id, meta: { total, hospitalId: req.user.hospitalId } });
    res.status(201).json({ invoice, total });
  } catch (error) { next(error); }
});

// Pharmacy invoices & payment log — scoped to pharmacy's hospital.
router.get("/invoices", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { status = "all", type, page = 1, limit = 25 } = req.query;
    const query = { ...scope };
    if (status && status !== "all") query.status = status;
    if (type && type !== "all") query.type = type; else query.type = { $ne: "consultation" };
    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .populate("patient", "name mobile patientId")
      .populate("doctor", "name profile.specialty")
      .populate("prescription", "prescriptionId")
      .sort({ createdAt: -1 })
      .skip((Math.max(Number(page), 1) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
    res.json({ invoices, total, page: Number(page) });
  } catch (error) { next(error); }
});

// Mark an invoice + its prescription as paid and delivered — scoped to pharmacy's hospital.
router.post("/invoices/:id/pay", async (req, res, next) => {
  try {
    const scope = hospitalScope(req.user);
    const { method = "cash" } = req.body;
    const invoice = await Invoice.findOneAndUpdate(
      { ...scope, _id: req.params.id, status: "pending" },
      {
        $set: {
          status: "paid",
          paymentMethod: ["cash", "upi", "card", "insurance", "online"].includes(method) ? method : "cash",
          paidAt: new Date(),
          paidBy: "pharmacy",
          transactionRef: `TXN-${Date.now()}`,
        },
      },
      { new: true },
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found or already settled" });

    if (invoice.prescription) {
      await Prescription.updateOne({ ...scope, _id: invoice.prescription }, { $set: { status: "dispensed" } });
    }
    await notify(invoice.patient, {
      title: "Payment successful",
      body: `Payment for ${invoice.invoiceNo} (₹${money(invoice.total)}) confirmed. Medicines dispensed.`,
      type: "payment",
      entity: "invoice",
      entityId: invoice._id,
    });
    logAudit({ actor: req.user._id, actorRole: req.user.role, action: "invoice.pay", entity: "invoice", entityId: invoice._id, meta: { method, hospitalId: req.user.hospitalId } });
    res.json({ invoice });
  } catch (error) { next(error); }
});

export default router;
