import { Router } from "express";
import { requireAuth } from "../middleware/authJwt.js";
import Notification from "../models/Notification.js";

const router = Router();
router.use(requireAuth);

// A user's notification feed.
router.get("/", async (req, res, next) => {
  try {
    const { unreadOnly = "false", limit = 30 } = req.query;
    const query = { user: req.user._id };
    if (unreadOnly === "true") query.read = false;
    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    const unread = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ notifications, unread });
  } catch (error) { next(error); }
});

// Mark a single notification read, or all.
router.patch("/:id/read", async (req, res, next) => {
  try {
    await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/read-all", async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

export default router;