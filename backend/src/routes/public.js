import { Router } from "express";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";

const router = Router();

const doctorFields = "name email profile.specialty profile.consultationFee profile.visitingHours profile.visitngHours profile.location profile.availableToday";

// Public: list all active hospitals (name + code) for patient self-registration.
router.get("/hospitals", async (req, res, next) => {
  try {
    const hospitals = await Hospital.find({ status: { $ne: "inactive" } })
      .select("hospitalId name code city state status")
      .sort({ name: 1 })
      .lean();
    res.json({ hospitals: hospitals || [] });
  } catch (error) { next(error); }
});

// Public: list active doctors for a hospital code.
router.get("/hospitals/:code/doctors", async (req, res, next) => {
  try {
    const hospital = await Hospital.findOne({ code: String(req.params.code).toUpperCase(), status: { $ne: "inactive" } }).lean();
    if (!hospital) return res.status(404).json({ doctors: [] });
    const doctors = await User.find({ hospitalId: hospital._id, role: "doctor", active: true })
      .select(doctorFields)
      .sort({ name: 1 })
      .lean();
    res.json({ hospital: { name: hospital.name, code: hospital.code }, doctors: doctors || [] });
  } catch (error) { next(error); }
});

export default router;
