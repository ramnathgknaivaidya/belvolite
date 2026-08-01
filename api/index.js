// Vercel Serverless Function — Catch-all API handler

import express from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { TOOLS_CATALOG } from "../server/data/tools.js";
import { authenticateToken, getJWTSecret, authLimiter, otpLimiter } from "../server/middleware/auth.js";
import { getDb, isDbReady, ObjectId } from "../server/db.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

const isVercel = !!process.env.VERCEL;
const uploadsDir = isVercel ? path.join(os.tmpdir(), "uploads") : path.join(__dirname, "..", "uploads");

try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (err) {
  console.warn("Could not create uploads dir, uploads may not persist:", err.message);
}

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"), false);
  }
};

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `member-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const otpStore = new Map();
const checklistStore = new Map();

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const HR_EMAIL = process.env.HR_EMAIL;

const emailTransporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

app.post("/admin/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    const token = jwt.sign({ username, role: "admin" }, getJWTSecret(), { expiresIn: "7d" });
    res.json({ success: true, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const ALLOWED_INTERN_EMAIL = process.env.ALLOWED_INTERN_EMAIL;

app.post("/intern/send-otp", otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "Valid email is required" });
    }
    if (email.toLowerCase() !== ALLOWED_INTERN_EMAIL) {
      return res.status(403).json({ success: false, message: "This email is not authorized for intern access" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 60000;
    otpStore.set(email.toLowerCase(), { otp, expiresAt });
    await emailTransporter.sendMail({
      from: `"BELVO Intern Portal" <${SMTP_USER}>`,
      to: email,
      subject: "Your BELVO Verification Code",
      html: `<div style="font-family:Inter,Arial;max-width:480px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#7B2FBE,#9D4EDD);padding:32px 28px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">Verification Code</h1><p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">BELVO Intern Portal</p></div><div style="padding:32px;text-align:center;"><p style="color:#555;font-size:14px;margin:0 0 16px;">Your 6-digit verification code is:</p><div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#7B2FBE;padding:16px;background:#f5f0ff;border-radius:12px;margin:0 0 16px;">${otp}</div><p style="color:#999;font-size:12px;margin:0;">This code expires in 1 minute.</p></div><div style="text-align:center;padding:16px;background:#fafafa;font-size:12px;color:#aaa;">BELVO — belvo.buzz</div></div>`,
    });
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
  }
});

app.post("/intern/verify-otp", otpLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }
    const stored = otpStore.get(email.toLowerCase());
    if (!stored) {
      return res.status(400).json({ success: false, message: "No OTP found. Please request a new one." });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }
    if (stored.otp !== otp.toString()) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }
    otpStore.delete(email.toLowerCase());
    checklistStore.delete(email.toLowerCase());
    const token = jwt.sign({ email: email.toLowerCase(), role: "intern" }, getJWTSecret(), { expiresIn: "7d" });
    res.json({ success: true, token, email: email.toLowerCase() });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/intern/submit-offer-letter", async (req, res) => {
  try {
    const { email, name, age, aadharNumber, designation, tenure, address } = req.body;
    if (!email || !name || !age || !aadharNumber || !designation || !tenure || !address) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    await emailTransporter.sendMail({
      from: `"BELVO Intern Portal" <${SMTP_USER}>`,
      to: HR_EMAIL,
      subject: `New Offer Letter Request — ${name}`,
      html: `<div style="font-family:Inter,Arial;max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#7B2FBE,#9D4EDD);padding:32px 28px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">New Offer Letter Request</h1><p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">BELVO Intern Portal</p></div><div style="padding:28px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">Name</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${name}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Email</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${email}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Age</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${age}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Aadhar Number</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${aadharNumber}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Designation</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${designation}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Tenure</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${tenure}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Address</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${address}</td></tr></table></div><div style="text-align:center;padding:16px;background:#fafafa;font-size:12px;color:#aaa;">BELVO — belvo.buzz</div></div>`,
    });
    const key = email.toLowerCase();
    const current = checklistStore.get(key) || { watchedLms: false, offerLetter: false, idCard: false, instagram: false, linkedin: false, whatsapp: false, nda: false };
    current.offerLetter = true;
    checklistStore.set(key, current);
    res.json({ success: true, message: "Offer letter request submitted successfully" });
  } catch (err) {
    console.error("Submit offer letter error:", err);
    res.status(500).json({ success: false, message: "Failed to submit request. Please try again." });
  }
});

app.post("/intern/submit-id-card", async (req, res) => {
  try {
    const { email, name, department, photoBase64 } = req.body;
    if (!email || !name || !department) {
      return res.status(400).json({ success: false, message: "Name and department are required" });
    }
    const mailOptions = {
      from: `"BELVO Intern Portal" <${SMTP_USER}>`,
      to: HR_EMAIL,
      subject: `New ID Card Request — ${name}`,
      html: `<div style="font-family:Inter,Arial;max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#7B2FBE,#9D4EDD);padding:32px 28px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:22px;">New ID Card Request</h1><p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">BELVO Intern Portal</p></div><div style="padding:28px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;">Name</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${name}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Email</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${email}</td></tr><tr><td style="padding:10px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.1em;border-top:1px solid #eee;">Department</td></tr><tr><td style="padding:0 0 16px;font-size:16px;font-weight:600;color:#222;">${department}</td></tr></table></div><div style="text-align:center;padding:16px;background:#fafafa;font-size:12px;color:#aaa;">BELVO — belvo.buzz</div></div>`,
      attachments: [],
    };
    if (photoBase64) {
      const matches = photoBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        const ext = mimeType.split("/")[1] || "jpg";
        mailOptions.attachments.push({
          filename: `photo-${name.replace(/\s+/g, "-")}.${ext}`,
          content: buffer,
          contentType: mimeType,
        });
      }
    }
    await emailTransporter.sendMail(mailOptions);
    const key = email.toLowerCase();
    const current = checklistStore.get(key) || { watchedLms: false, offerLetter: false, idCard: false, instagram: false, linkedin: false, whatsapp: false, nda: false };
    current.idCard = true;
    checklistStore.set(key, current);
    res.json({ success: true, message: "ID card request submitted successfully" });
  } catch (err) {
    console.error("Submit ID card error:", err);
    res.status(500).json({ success: false, message: "Failed to submit request. Please try again." });
  }
});

app.get("/intern/checklist-status", (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    const status = checklistStore.get(email.toLowerCase()) || {
      watchedLms: false, offerLetter: false, idCard: false, instagram: false, linkedin: false, whatsapp: false, nda: false,
    };
    res.json({ success: true, status });
  } catch (err) {
    console.error("Checklist status error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/intern/submit-nda", async (req, res) => {
  try {
    const { email, name, pdfBase64 } = req.body;
    if (!email || !pdfBase64) {
      return res.status(400).json({ success: false, message: "Email and PDF file are required" });
    }
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"BELVO Intern Portal" <${SMTP_USER}>`,
      to: HR_EMAIL,
      subject: `NDA Signed — ${name || email}`,
      html: `<h2>NDA Submission</h2><p><strong>Name:</strong> ${name || "N/A"}</p><p><strong>Email:</strong> ${email}</p>`,
      attachments: [{ filename: `NDA_${(name || email).replace(/[^a-zA-Z0-9]/g, "_")}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    });
    const key = email.toLowerCase();
    const current = checklistStore.get(key) || { watchedLms: false, offerLetter: false, idCard: false, instagram: false, linkedin: false, whatsapp: false, nda: false };
    current.nda = true;
    checklistStore.set(key, current);
    res.json({ success: true, message: "NDA submitted successfully" });
  } catch (err) {
    console.error("Submit NDA error:", err);
    res.status(500).json({ success: false, message: "Failed to submit NDA. Please try again." });
  }
});

app.post("/intern/mark-checklist", (req, res) => {
  try {
    const { email, item } = req.body;
    if (!email || !item) {
      return res.status(400).json({ success: false, message: "Email and item are required" });
    }
    const validItems = ["watchedLms", "offerLetter", "idCard"];
    if (!validItems.includes(item)) {
      return res.status(400).json({ success: false, message: "Invalid checklist item" });
    }
    const key = email.toLowerCase();
    const current = checklistStore.get(key) || { watchedLms: false, offerLetter: false, idCard: false, instagram: false, linkedin: false, whatsapp: false, nda: false };
    current[item] = !current[item];
    checklistStore.set(key, current);
    res.json({ success: true, message: "Item updated", value: current[item] });
  } catch (err) {
    console.error("Mark checklist error:", err);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

app.post("/intern/mark-social", (req, res) => {
  try {
    const { email, item } = req.body;
    if (!email || !item) {
      return res.status(400).json({ success: false, message: "Email and item are required" });
    }
    const validItems = ["instagram", "linkedin", "whatsapp"];
    if (!validItems.includes(item)) {
      return res.status(400).json({ success: false, message: "Invalid social item" });
    }
    const key = email.toLowerCase();
    const current = checklistStore.get(key) || { watchedLms: false, offerLetter: false, idCard: false, instagram: false, linkedin: false, whatsapp: false, nda: false };
    current[item] = true;
    checklistStore.set(key, current);
    res.json({ success: true, message: "Item marked as complete" });
  } catch (err) {
    console.error("Mark social error:", err);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
});

app.post("/intern/submit-onboarding", async (req, res) => {
  try {
    const { email, offerLetter, idCard, nda, social } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    const socialChecked = [];
    if (social?.instagram) socialChecked.push("Instagram");
    if (social?.linkedin) socialChecked.push("LinkedIn");
    if (social?.whatsapp) socialChecked.push("WhatsApp Community");
    const checklistItems = [];
    if (offerLetter) checklistItems.push("Offer Letter Request");
    if (idCard) checklistItems.push("ID Card Request");
    if (nda) checklistItems.push("NDA Signed");
    await emailTransporter.sendMail({
      from: `"BELVO Intern Portal" <${SMTP_USER}>`,
      to: HR_EMAIL,
      subject: `Onboarding Complete — ${offerLetter?.name || email}`,
      html: `<div>...</div>`,
    });
    res.json({ success: true, message: "Onboarding summary sent to HR" });
  } catch (err) {
    console.error("Submit onboarding error:", err);
    res.status(500).json({ success: false, message: "Failed to send summary" });
  }
});

app.get("/api/health", async (req, res) => {
  const ready = await isDbReady();
  res.json({ success: true, db: ready ? "connected" : "not configured", timestamp: new Date().toISOString() });
});

app.get("/api/team", async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const members = await db.collection("team_members").find({}).sort({ sort_order: 1, name: 1 }).toArray();
    res.json({ success: true, members });
  } catch (err) {
    console.error("GET /api/team error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch team members" });
  }
});

app.post("/api/team", authenticateToken, async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const { name, teamId, teamName, responsibilities, sortOrder, imageUrl } = req.body;
    if (!name || !teamId) {
      return res.status(400).json({ success: false, message: "Name and team are required" });
    }
    const now = new Date().toISOString();
    const db = await getDb();
    const member = {
      name: name.trim(),
      team_id: teamId,
      team_name: teamName || "",
      responsibilities: responsibilities || [],
      image_url: imageUrl || null,
      sort_order: sortOrder || 0,
      created_at: now,
      updated_at: now,
    };
    const result = await db.collection("team_members").insertOne(member);
    member.id = result.insertedId;
    res.status(201).json({ success: true, member });
  } catch (err) {
    console.error("POST /api/team error:", err);
    res.status(500).json({ success: false, message: "Failed to create member" });
  }
});

app.put("/api/team/:id", authenticateToken, async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const { id } = req.params;
    const { name, teamId, teamName, responsibilities, sortOrder, imageUrl } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (teamId !== undefined) updates.team_id = teamId;
    if (teamName !== undefined) updates.team_name = teamName;
    if (responsibilities !== undefined) updates.responsibilities = responsibilities;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    if (imageUrl !== undefined) updates.image_url = imageUrl;
    updates.updated_at = new Date().toISOString();
    const { ObjectId } = await import("mongodb");
    const db = await getDb();
    const member = await db.collection("team_members").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: "after", includeResultMetadata: false }
    );
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    res.json({ success: true, member });
  } catch (err) {
    console.error("PUT /api/team/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to update member" });
  }
});

app.delete("/api/team/:id", authenticateToken, async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const { id } = req.params;
    const { ObjectId } = await import("mongodb");
    const db = await getDb();
    const result = await db.collection("team_members").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Member not found" });
    }
    res.json({ success: true, message: "Member deleted" });
  } catch (err) {
    console.error("DELETE /api/team/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to delete member" });
  }
});

app.post("/api/tools-register", authLimiter, async (req, res) => {
  try {
    const { toolId, name, email, whatsapp } = req.body;
    if (!toolId || !name || !email || !whatsapp) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const selectedTool = TOOLS_CATALOG[toolId];
    if (!selectedTool || !selectedTool.active) {
      return res.status(400).json({ success: false, message: "Invalid or unavailable tool" });
    }
    const db = await getDb();
    const result = await db.collection("tool_orders").insertOne({
      customer_name: name.trim(),
      customer_email: email.trim().toLowerCase(),
      whatsapp: whatsapp.trim(),
      tool_name: selectedTool.name,
      plan_name: selectedTool.plan,
      amount: selectedTool.amount,
      currency: selectedTool.currency,
      payment_status: "pending",
      fulfilment_status: "pending",
      created_at: new Date().toISOString(),
    });
    const order = {
      id: result.insertedId,
      toolId: selectedTool.id,
      toolName: selectedTool.name,
      planName: selectedTool.plan,
      amount: selectedTool.amount,
      currency: selectedTool.currency,
      paymentStatus: "pending",
      fulfilmentStatus: "pending",
    };
    return res.status(201).json({ success: true, message: "Registration received", order });
  } catch (err) {
    console.error("POST /api/tools-register error:", err);
    return res.status(500).json({ success: false, message: "Failed to save registration" });
  }
});

app.get("/api/departments", async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const departments = await db.collection("departments").find({}).sort({ sort_order: 1, name: 1 }).toArray();
    res.json({ success: true, departments });
  } catch (err) {
    console.error("GET /api/departments error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch departments" });
  }
});

app.post("/api/departments", authenticateToken, async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const { id, name, color, lightColor, sortOrder } = req.body;
    if (!id || !name) {
      return res.status(400).json({ success: false, message: "ID and name are required" });
    }
    const now = new Date().toISOString();
    const db = await getDb();
    const department = {
      _id: id,
      id,
      name,
      color: color || "#7B2FBE",
      light_color: lightColor || color || "#9D4EDD",
      sort_order: sortOrder || 0,
      created_at: now,
      updated_at: now,
    };
    await db.collection("departments").insertOne(department);
    res.status(201).json({ success: true, department });
  } catch (err) {
    console.error("POST /api/departments error:", err);
    res.status(500).json({ success: false, message: "Failed to create department" });
  }
});

app.put("/api/departments/:id", authenticateToken, async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const { id } = req.params;
    const { name, color, lightColor, sortOrder } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (lightColor !== undefined) updates.light_color = lightColor;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;
    updates.updated_at = new Date().toISOString();
    const db = await getDb();
    const department = await db.collection("departments").findOneAndUpdate(
      { _id: id },
      { $set: updates },
      { returnDocument: "after", includeResultMetadata: false }
    );
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }
    res.json({ success: true, department });
  } catch (err) {
    console.error("PUT /api/departments/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to update department" });
  }
});

app.delete("/api/departments/:id", authenticateToken, async (req, res) => {
  try {
    if (!(await isDbReady())) {
      return res.status(500).json({ success: false, message: "Database not configured" });
    }
    const { id } = req.params;
    const db = await getDb();
    const count = await db.collection("team_members").countDocuments({ team_id: id });
    if (count > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete — ${count} member(s) still in this department` });
    }
    const result = await db.collection("departments").deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }
    res.json({ success: true, message: "Department deleted" });
  } catch (err) {
    console.error("DELETE /api/departments/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to delete department" });
  }
});

app.post("/api/upload", authenticateToken, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, message: "File too large. Max 5MB." });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  });
});

app.post("/api/upload/verification", authenticatePortal, (req, res) => {
  upload.array("files", 10)(req, res, async (err) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ success: false, message: err.code === "LIMIT_FILE_SIZE" ? "File too large. Max 5MB per file." : err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      const files = req.files || [];
      if (files.length === 0) {
        return res.status(400).json({ success: false, message: "No files uploaded" });
      }
      const documentType = String(req.body?.documentType || "other");
      const now = new Date().toISOString();
      const docs = files.map((file) => ({
        client_id: req.user.userId,
        document_type: documentType,
        status: "pending",
        file_name: file.originalname,
        file_path: `verification/${req.user.userId}/${file.filename}`,
        file_url: `/uploads/${file.filename}`,
        mime_type: file.mimetype,
        file_size: file.size,
        created_at: now,
      }));
      if (await isDbReady()) {
        const db = await getDb();
        await db.collection("verification_documents").insertMany(docs);
      }
      res.status(201).json({ success: true, count: files.length, message: "Documents uploaded for review" });
    } catch (error) {
      console.error("POST /api/upload/verification error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
});

function parseCookies(req) {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const idx = c.indexOf('=');
      if (idx === -1) return [c.trim(), ''];
      return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
    })
  );
}

const PORTAL_JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "portal-dev-secret-change-in-prod";

function authenticatePortal(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies.belvo_session;
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  try {
    const decoded = jwt.verify(token, PORTAL_JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const profile = await db.collection("profiles").findOne({ email: email.toLowerCase().trim() });
    if (!profile) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: profile._id.toString(), email: profile.email, role: profile.role || "client" }, PORTAL_JWT_SECRET, { expiresIn: "7d" });
    res.cookie("belvo_session", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/",
    });
    res.json({ success: true, user: { id: profile._id.toString(), email: profile.email, fullName: profile.full_name, role: profile.role || "client" } });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const existing = await db.collection("profiles").findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }
    const password_hash = await bcrypt.hash(password, 12);
    const profile = {
      email: email.toLowerCase().trim(),
      full_name: fullName || null,
      password_hash,
      role: "client",
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("profiles").insertOne(profile);
    profile._id = result.insertedId;
    const token = jwt.sign({ userId: profile._id.toString(), email: profile.email, role: profile.role }, PORTAL_JWT_SECRET, { expiresIn: "7d" });
    res.cookie("belvo_session", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/",
    });
    res.status(201).json({ success: true, user: { id: profile._id.toString(), email: profile.email, fullName: profile.full_name, role: profile.role } });
  } catch (err) {
    console.error("POST /api/auth/signup error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("belvo_session", { path: "/", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
  res.json({ success: true, message: "Signed out" });
});

app.get("/api/auth/me", authenticatePortal, (req, res) => {
  res.json({ success: true, user: { id: req.user.userId, email: req.user.email, fullName: req.user.fullName || null, role: req.user.role } });
});

app.get("/api/client/dashboard", authenticatePortal, async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const clientId = req.user.userId;
    const db = await getDb();
    const payments = await db.collection("payments").find({ client_id: clientId }).toArray();
    const timelineEvents = await db.collection("timeline_events").find({ client_id: clientId, visible_to_client: true }).sort({ event_date: -1 }).limit(5).toArray();
    const paid = payments?.filter(p => p.status === "paid").length || 0;
    const pending = payments?.filter(p => p.status === "pending").length || 0;
    const overdue = payments?.filter(p => p.status === "overdue").length || 0;
    const cancelled = payments?.filter(p => p.status === "cancelled").length || 0;
    const outstandingAmount = payments?.filter(p => p.status === "pending" || p.status === "overdue").reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
    const upcoming = timelineEvents?.filter(e => e.status === "upcoming").length || 0;
    const completed = timelineEvents?.filter(e => e.status === "completed").length || 0;
    res.json({
      success: true,
      payments: { total: payments?.length || 0, paid, pending, overdue, cancelled, outstandingAmount },
      timeline: { totalVisible: timelineEvents?.length || 0, upcoming, completed, recent: (timelineEvents || []).map(e => ({ id: e.id, title: e.title, description: e.description || null, type: e.type, eventDate: e.event_date })) },
    });
  } catch (err) {
    console.error("GET /api/client/dashboard error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

function requireClient(req, res) {
  if (req.user.role !== "client") {
    res.status(403).json({ success: false, message: "Access denied" });
    return false;
  }
  return true;
}

app.get("/api/client/projects", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const projects = await db.collection("projects").find({ client_id: req.user.userId, visible_to_client: true }).sort({ expected_completion: 1 }).toArray();
    res.json({ success: true, data: projects.map(p => ({
      id: p._id?.toString() || p.id,
      name: p.name,
      health: p.health || "good",
      status: p.status || "not_started",
      description: p.description || null,
      progress: p.progress || 0,
      expectedCompletion: p.expected_completion || null,
      budget: Number(p.budget || 0),
      spent: Number(p.spent || 0),
      projectManager: p.project_manager || null,
      milestonesCount: Number(p.milestones_count || 0),
      documentsCount: Number(p.documents_count || 0),
      changeRequestsCount: Number(p.change_requests_count || 0),
    })) });
  } catch (err) {
    console.error("GET /api/client/projects error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/milestones", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const milestones = await db.collection("milestones").find({ client_id: req.user.userId }).sort({ expected_date: 1 }).toArray();
    res.json({ success: true, data: milestones.map(m => ({
      id: m._id?.toString() || m.id,
      projectId: m.project_id || null,
      projectName: m.project_name || null,
      title: m.title,
      status: m.status || "not_started",
      description: m.description || null,
      progress: m.progress || 0,
      expectedDate: m.expected_date || null,
      completionDate: m.completion_date || null,
      deliverables: m.deliverables || [],
    })) });
  } catch (err) {
    console.error("GET /api/client/milestones error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/verification", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const documents = await db.collection("verification_documents").find({ client_id: req.user.userId }).sort({ created_at: -1 }).toArray();
    res.json({ success: true, data: documents.map(d => ({
      id: d._id?.toString() || d.id,
      documentType: d.document_type,
      status: d.status || "pending",
      fileName: d.file_name || null,
      createdAt: d.created_at || null,
      documentNumber: d.document_number || null,
      rejectionReason: d.rejection_reason || null,
      fileUrl: d.file_url || null,
    })) });
  } catch (err) {
    console.error("GET /api/client/verification error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/timeline", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const events = await db.collection("timeline_events").find({ client_id: req.user.userId, visible_to_client: true }).sort({ event_date: -1 }).toArray();
    res.json({ success: true, data: events.map(e => ({
      id: e._id?.toString() || e.id,
      clientId: e.client_id || req.user.userId,
      title: e.title,
      description: e.description || null,
      type: e.type || "update",
      eventDate: e.event_date || e.created_at,
      status: e.status || "upcoming",
      visibleToClient: true,
      createdAt: e.created_at || e.event_date || null,
    })) });
  } catch (err) {
    console.error("GET /api/client/timeline error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/documents", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const docs = await db.collection("project_documents").find({ client_id: req.user.userId, visible_to_client: true }).sort({ created_at: -1 }).toArray();
    const projects = await db.collection("projects").find({ client_id: req.user.userId }).sort({ created_at: -1 }).toArray();
    res.json({ success: true, data: docs.map(d => ({
      id: d._id?.toString() || d.id,
      name: d.name,
      type: d.type || "other",
      version: Number(d.version || 1),
      projectId: d.project_id || null,
      projectName: d.project_name || null,
      milestoneTitle: d.milestone_title || null,
      createdAt: d.created_at || null,
      fileSize: d.file_size != null ? Number(d.file_size) : null,
      fileUrl: d.file_url || d.external_url || null,
    })), projects: projects.map(p => ({ id: p._id?.toString() || p.id, name: p.name })) });
  } catch (err) {
    console.error("GET /api/client/documents error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/payments", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const payments = await db.collection("payments").find({ client_id: req.user.userId }).sort({ due_date: -1, created_at: -1 }).toArray();
    const settings = await db.collection("payment_settings").findOne({ _id: "default" }).catch(() => null);
    res.json({ success: true, payments: payments.map(p => ({
      id: p._id?.toString() || p.id,
      clientId: p.client_id || req.user.userId,
      title: p.title || p.invoice_number || "Payment",
      amount: Number(p.amount || 0),
      currency: p.currency || "INR",
      status: p.status || "pending",
      dueDate: p.due_date || p.dueDate || null,
      paidAt: p.paid_at || null,
      notes: p.notes || null,
      createdAt: p.created_at || null,
      proofs: (p.proofs || []).map(pr => ({ id: pr._id?.toString() || pr.id || `proof-${Math.random().toString(36).slice(2)}`, paymentId: p._id?.toString() || p.id, fileName: pr.file_name || pr.fileName || "proof", filePath: pr.file_path || null, fileUrl: pr.file_url || null, mimeType: pr.mime_type || null, fileSize: pr.file_size != null ? Number(pr.file_size) : null, createdAt: pr.created_at || null })),
    })), settings: {
      upiId: settings?.upi_id || settings?.upiId || null,
      receiverName: settings?.receiver_name || settings?.receiverName || null,
      qrCodePath: settings?.qr_code_path || settings?.qrCodePath || null,
      qrCodeUrl: settings?.qr_code_url || settings?.qrCodeUrl || null,
      updatedAt: settings?.updated_at || settings?.updatedAt || null,
    } });
  } catch (err) {
    console.error("GET /api/client/payments error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/chat", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const messages = await db.collection("portal_messages").find({ client_id: req.user.userId }).sort({ created_at: 1 }).toArray();
    const profile = await db.collection("profiles").findOne({ _id: { $in: messages.map(m => m.sender_id).filter(Boolean) } });
    res.json({ success: true, data: messages.map(m => ({
      id: m._id?.toString() || m.id,
      senderId: m.sender_id || req.user.userId,
      senderName: m.sender_name || (m.sender_id === req.user.userId ? (req.user.fullName || "You") : (profile?.full_name || "Admin")),
      body: m.body || "",
      createdAt: m.created_at || null,
      attachmentUrl: m.attachment_url || null,
      attachmentName: m.attachment_name || null,
    })) });
  } catch (err) {
    console.error("GET /api/client/chat error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/reports", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const [projects, payments, changes] = await Promise.all([
      db.collection("projects").find({ client_id: req.user.userId, visible_to_client: true }).toArray(),
      db.collection("payments").find({ client_id: req.user.userId }).toArray(),
      db.collection("change_requests").find({ client_id: req.user.userId }).toArray(),
    ]);
    const activeProjects = projects.filter(p => p.status === "active" || p.status === "on_hold");
    const completedProjects = projects.filter(p => p.status === "completed");
    const paidPayments = payments.filter(p => p.status === "paid");
    const outstandingPayments = payments.filter(p => p.status === "pending" || p.status === "overdue");
    res.json({ success: true, data: {
      projects: {
        total: projects.length,
        active: activeProjects.length,
        completed: completedProjects.length,
        averageProgress: projects.length === 0 ? 0 : Math.round(projects.reduce((sum, p) => sum + Number(p.progress || 0), 0) / projects.length),
        totalBudget: projects.reduce((sum, p) => sum + Number(p.budget || 0), 0),
        totalSpent: projects.reduce((sum, p) => sum + Number(p.spent || 0), 0),
      },
      payments: {
        paid: paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        outstanding: outstandingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        overdueCount: payments.filter(p => p.status === "overdue").length,
      },
      changeRequests: {
        total: changes.length,
        pending: changes.filter(c => c.status === "pending").length,
        approved: changes.filter(c => c.status === "approved").length,
        rejected: changes.filter(c => c.status === "rejected").length,
      },
      projectRows: projects.map(p => ({
        id: p._id?.toString() || p.id,
        name: p.name,
        status: p.status || "not_started",
        health: p.health || "good",
        progress: Number(p.progress || 0),
        budget: Number(p.budget || 0),
        spent: Number(p.spent || 0),
      })),
    } });
  } catch (err) {
    console.error("GET /api/client/reports error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/meetings", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const meetings = await db.collection("meetings").find({ client_id: req.user.userId }).sort({ scheduled_at: -1 }).toArray();
    res.json({ success: true, data: meetings.map(m => ({
      id: m._id?.toString() || m.id,
      clientId: m.client_id || req.user.userId,
      title: m.title,
      status: m.status || "upcoming",
      scheduledAt: m.scheduled_at || null,
      durationMinutes: Number(m.duration_minutes || 45),
      agenda: m.agenda || null,
      participants: m.participants || null,
      meetingLink: m.meeting_link || null,
      createdAt: m.created_at || null,
    })) });
  } catch (err) {
    console.error("GET /api/client/meetings error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/client/meetings", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    const { title, date, time, durationMinutes, agenda, participants, meetingLink } = req.body;
    if (!title || !date || !time) {
      return res.status(400).json({ success: false, message: "Title, date, and time are required" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    const doc = {
      client_id: req.user.userId,
      title: String(title),
      status: "upcoming",
      scheduled_at: scheduledAt,
      duration_minutes: Number(durationMinutes || 45),
      agenda: String(agenda || ""),
      participants: String(participants || ""),
      meeting_link: String(meetingLink || ""),
      created_at: new Date().toISOString(),
    };
    const result = await db.collection("meetings").insertOne(doc);
    res.status(201).json({ success: true, message: "Meeting requested", id: result.insertedId.toString() });
  } catch (err) {
    console.error("POST /api/client/meetings error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/client/meetings/:id/status", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    const { status } = req.body;
    if (!["accepted", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const result = await db.collection("meetings").updateOne(
      { _id: new ObjectId(req.params.id), client_id: req.user.userId },
      { $set: { status } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Meeting not found" });
    }
    res.json({ success: true, message: "Meeting updated" });
  } catch (err) {
    console.error("POST /api/client/meetings/:id/status error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.delete("/api/client/meetings/:id", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const result = await db.collection("meetings").deleteOne({ _id: new ObjectId(req.params.id), client_id: req.user.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Meeting not found" });
    }
    res.json({ success: true, message: "Meeting deleted" });
  } catch (err) {
    console.error("DELETE /api/client/meetings/:id error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/api/client/change-requests", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const requests = await db.collection("change_requests").find({ client_id: req.user.userId }).sort({ created_at: -1 }).toArray();
    res.json({ success: true, data: requests.map(c => ({
      id: c._id?.toString() || c.id,
      title: c.title,
      status: c.status || "pending",
      impact: c.impact || "medium",
      priority: c.priority || "medium",
      description: c.description || "",
      estimatedCost: Number(c.estimated_cost || 0),
      projectName: c.project_name || null,
      createdAt: c.created_at || null,
      adminNote: c.admin_note || null,
    })) });
  } catch (err) {
    console.error("GET /api/client/change-requests error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/client/change-requests", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    const { title, projectId, estimatedCost, impact, priority, timelineImpact, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: "Title and description are required" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    let projectName = null;
    if (projectId) {
      const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) }).catch(() => null);
      if (project) projectName = project.name;
    }
    const doc = {
      client_id: req.user.userId,
      project_id: projectId || null,
      project_name: projectName,
      title: String(title),
      description: String(description),
      impact: impact || "medium",
      priority: priority || "medium",
      estimated_cost: Number(estimatedCost || 0),
      timeline_impact: String(timelineImpact || ""),
      status: "pending",
      admin_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.collection("change_requests").insertOne(doc);
    res.status(201).json({ success: true, message: "Change request submitted" });
  } catch (err) {
    console.error("POST /api/client/change-requests error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/client/chat", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    const { body } = req.body;
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: "Message body is required" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const profile = await db.collection("profiles").findOne({ _id: new ObjectId(req.user.userId) }).catch(() => null);
    const doc = {
      client_id: req.user.userId,
      sender_id: req.user.userId,
      sender_name: profile?.full_name || "Client",
      sender_role: "client",
      body: String(body).trim(),
      attachment_name: null,
      attachment_url: null,
      created_at: new Date().toISOString(),
    };
    await db.collection("portal_messages").insertOne(doc);
    res.status(201).json({ success: true, message: "Message sent" });
  } catch (err) {
    console.error("POST /api/client/chat error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/client/documents", authenticatePortal, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    try {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ success: false, message: err.code === "LIMIT_FILE_SIZE" ? "File too large. Max 5MB." : err.message });
        }
        return res.status(400).json({ success: false, message: err.message });
      }
      const { name, type, projectId, milestoneId } = req.body || {};
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }
      if (!(await isDbReady())) {
        return res.status(503).json({ success: false, message: "Database not configured" });
      }
      const db = await getDb();
      let projectName = null;
      if (projectId) {
        const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) }).catch(() => null);
        if (project) projectName = project.name;
      }
      let milestoneTitle = null;
      if (milestoneId) {
        const milestone = await db.collection("milestones").findOne({ _id: new ObjectId(milestoneId) }).catch(() => null);
        if (milestone) milestoneTitle = milestone.title;
      }
      const doc = {
        client_id: req.user.userId,
        project_id: projectId || null,
        project_name: projectName,
        milestone_id: milestoneId || null,
        milestone_title: milestoneTitle,
        name: String(name || file.originalname),
        type: String(type || "other"),
        version: 1,
        file_name: file.originalname,
        file_path: `documents/${req.user.userId}/${file.filename}`,
        file_url: `/uploads/${file.filename}`,
        mime_type: file.mimetype,
        file_size: file.size,
        visible_to_client: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await db.collection("project_documents").insertOne(doc);
      res.status(201).json({ success: true, message: "Document uploaded" });
    } catch (error) {
      console.error("POST /api/client/documents error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
});

app.get("/api/client/profile", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const profile = await db.collection("profiles").findOne({ _id: new ObjectId(req.user.userId) });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    res.json({ success: true, profile: {
      id: profile._id.toString(),
      fullName: profile.full_name || null,
      company: profile.company || null,
      email: profile.email,
      phone: profile.phone || null,
      gender: profile.gender || null,
      age: profile.age != null ? Number(profile.age) : null,
      website: profile.website || null,
      instagram: profile.instagram || null,
      linkedin: profile.linkedin || null,
      street: profile.street || null,
      city: profile.city || null,
      state: profile.state || null,
      postalCode: profile.postal_code || null,
      country: profile.country || null,
      gstNumber: profile.gst_number || null,
      bpitNumber: profile.bpit_number || null,
      emailNotifications: profile.email_notifications ?? true,
      weeklySummary: profile.weekly_summary ?? false,
      twoFactorEnabled: profile.two_factor_enabled ?? false,
    } });
  } catch (err) {
    console.error("GET /api/client/profile error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.put("/api/client/profile", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    const fields = ["full_name", "company", "phone", "gender", "age", "website", "instagram", "linkedin", "street", "city", "state", "postal_code", "country", "gst_number", "bpit_number", "email_notifications", "weekly_summary", "two_factor_enabled"];
    const allowed = ["fullName", "company", "phone", "gender", "age", "website", "instagram", "linkedin", "street", "city", "state", "postalCode", "country", "gstNumber", "bpitNumber", "emailNotifications", "weeklySummary", "twoFactorEnabled"];
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const update = {};
    allowed.forEach((key, index) => {
      if (req.body[key] !== undefined) {
        update[fields[index]] = typeof req.body[key] === "boolean" ? req.body[key] : String(req.body[key]);
      }
    });
    const db = await getDb();
    await db.collection("profiles").updateOne({ _id: new ObjectId(req.user.userId) }, { $set: update });
    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("PUT /api/client/profile error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/client/password", authenticatePortal, async (req, res) => {
  try {
    if (!requireClient(req, res)) return;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new passwords are required" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    const profile = await db.collection("profiles").findOne({ _id: new ObjectId(req.user.userId) });
    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }
    const valid = await bcrypt.compare(currentPassword, profile.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
    const password_hash = await bcrypt.hash(String(newPassword), 12);
    await db.collection("profiles").updateOne({ _id: new ObjectId(req.user.userId) }, { $set: { password_hash } });
    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    console.error("POST /api/client/password error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const EVENT_TITLES = {
  1: "React Free Webinar",
  2: "Flutter Workshop",
  3: "Founders Meet-up",
};

app.post("/api/register", async (req, res) => {
  try {
    const { eventId, name, email, whatsapp } = req.body;
    if (!eventId || !name || !email || !whatsapp) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const eventTitle = EVENT_TITLES[eventId] || `Event #${eventId}`;
    const timestamp = new Date().toISOString();
    const db = await getDb();
    await db.collection("book_calls").insertOne({
      type: "event-registration",
      created_at: timestamp,
      full_name: name,
      email,
      message: `Registered for ${eventTitle} (ID: ${eventId}) | WhatsApp: ${whatsapp}`,
    });
    if (SMTP_USER && SMTP_PASS && HR_EMAIL) {
      await emailTransporter.sendMail({
        from: `"Belvo Registrations" <${SMTP_USER}>`,
        to: HR_EMAIL,
        subject: `New Registration — ${name} for ${eventTitle}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>WhatsApp:</strong> ${whatsapp}</p><p><strong>Time:</strong> ${new Date(timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>`,
      });
    }
    res.status(201).json({
      success: true,
      message: "Registration successful!",
      registration: { name, eventTitle, registeredAt: timestamp },
    });
  } catch (err) {
    console.error("POST /api/register error:", err);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
});

app.post("/api/book-call", async (req, res) => {
  try {
    const { type, fullName, email, company, budget, projectType, message } = req.body;
    if (!type || !fullName || !email) {
      return res.status(400).json({ success: false, message: "Type, name, and email are required" });
    }
    if (!(await isDbReady())) {
      return res.status(503).json({ success: false, message: "Database not configured" });
    }
    const db = await getDb();
    await db.collection("book_calls").insertOne({
      type,
      created_at: new Date().toISOString(),
      full_name: String(fullName ?? ""),
      email: String(email ?? ""),
      company: String(company ?? ""),
      budget: String(budget ?? ""),
      project_type: String(projectType ?? ""),
      message: String(message ?? ""),
    });
    res.status(201).json({ success: true, message: "Submission saved" });
  } catch (err) {
    console.error("POST /api/book-call error:", err);
    res.status(500).json({ success: false, message: "Failed to save submission" });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

export default app;