import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Search,
  X,
  Calendar,
  CheckCircle2,
  Clock3,
  AlertCircle,
  BadgeCheck,
  Wallet,
  History,
  FileText,
  LogOut,
  Lock,
  Users,
  Save,
} from "lucide-react";

import logo from "./assets/logo.jpeg";

/**
 * Grade A Center
 * - Ali (admin): can add/edit projects, assign writers + writer pay, add payments, manage writers & passwords.
 * - Writers: view-only dashboard, only their assigned work + their payments.
 *
 * NOTE: This app uses Netlify Functions + Neon DB (NETLIFY_DATABASE_URL) so data is shared across devices.
 */

const SESSION_USER_KEY = "grade_a_center_active_user";
const SESSION_TOKEN_KEY = "grade_a_center_token";

const DEFAULT_USERS = [
  { id: "u_ali", name: "Ali", password: "5123", role: "admin", active: true },
  { id: "u_mousa", name: "Mousa", password: "M1", role: "worker", active: true },
  { id: "u_issa", name: "Issa", password: "Kuly", role: "worker", active: true },
];

const STATUS = {
  completed: { label: "Completed", icon: CheckCircle2 },
  not_started: { label: "Not Started", icon: AlertCircle },
  pending: { label: "Pending", icon: Clock3 },
  revision: { label: "Revision", icon: BadgeCheck },
};

const PROJECT_TYPES = {
  b7: "B7oothKw", // 70% rule (Ali receives 0.7)
  grade: "Grade A", // no deduction
  seniors: "Seniors", // no deduction, tracked separately
};

const PAYMENT_NOTE_OPTIONS = ["Wamd", "Knet", "Tap", "Other"];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function formatInt(n) {
  // No decimals shown. Truncates any decimals.
  const v = Math.trunc(Number(n || 0));
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(v);
}

function parseNumber(val) {
  const s = String(val ?? "").replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function safeDateInputValue(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function statusRowClass(status) {
  switch (status) {
    case "completed":
      return "bg-emerald-50";
    case "not_started":
      return "bg-rose-50";
    case "pending":
      return "bg-amber-50";
    case "revision":
      return "bg-sky-50";
    default:
      return "bg-white";
  }
}

function Pill({ status }) {
  const s = STATUS[status] || { label: "—" };
  const Icon = (STATUS[status] && STATUS[status].icon) || CheckCircle2;
  const base =
    status === "completed"
      ? "bg-emerald-100 text-emerald-800"
      : status === "not_started"
        ? "bg-rose-100 text-rose-800"
        : status === "pending"
          ? "bg-amber-100 text-amber-800"
          : status === "revision"
            ? "bg-sky-100 text-sky-800"
            : "bg-zinc-100 text-zinc-700";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${base}`}>
      <Icon className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close modal" />
          <motion.div
            className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="text-lg font-semibold">{title}</div>
              <button className="rounded-lg p-2 hover:bg-zinc-100" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-zinc-800">{label}</label>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200 ${
        props.className || ""
      }`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200 ${
        props.className || ""
      }`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-300 focus:ring-2 focus:ring-zinc-200 ${
        props.className || ""
      }`}
    />
  );
}

function Button({ variant = "primary", children, className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99]";
  const styles =
    variant === "primary"
      ? "bg-zinc-900 text-white hover:bg-zinc-800"
      : variant === "secondary"
        ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        : variant === "danger"
          ? "bg-rose-600 text-white hover:bg-rose-500"
          : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50";
  return (
    <button {...props} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-medium text-zinc-500">{title}</div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</div>
        </div>
        {Icon ? (
          <div className="rounded-2xl bg-zinc-100 p-2">
            <Icon className="h-5 w-5 text-zinc-700" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function downloadReceiptAsPdf({ accountName, role, received, remaining, payments, logoUrl }) {
  const generatedOn = new Date();
  const prettyDate = generatedOn.toISOString().slice(0, 10);

  const sorted = payments
    .slice()
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const rowsHtml = sorted
    .map((p, idx) => {
      const safeNote = escapeHtml(p.note || "—");
      return (
        "<tr>" +
        "<td>" +
        (idx + 1) +
        "</td>" +
        "<td>" +
        (p.date || "") +
        "</td>" +
        '<td class="num">' +
        formatInt(p.amount) +
        "</td>" +
        "<td>" +
        safeNote +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  const emptyRow = '<tr><td colspan="4" style="color:#6b7280; padding:16px;">No payments recorded.</td></tr>';
  const tableRows = rowsHtml ? rowsHtml : emptyRow;

  const summaryHtml =
    role === "admin"
      ? `<div class="grid grid2">
          ${kpi("Received", formatInt(received))}
          ${kpi("Remaining", formatInt(remaining))}
        </div>`
      : `<div class="grid grid2">
          ${kpi("Received", formatInt(received))}
          ${kpi("Remaining", formatInt(remaining))}
        </div>`;

  const html =
    "<!doctype html>" +
    '<html><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    "<title>Receipt History - Grade A Center</title>" +
    "<style>" +
    "@page{margin:18mm;}" +
    ":root{--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--soft:#f9fafb;}" +
    "*{box-sizing:border-box;}" +
    "body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact;}" +
    ".page{padding:0;max-width:920px;margin:0 auto;}" +
    ".top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}" +
    ".brand{font-size:22px;font-weight:900;letter-spacing:-0.02em;}" +
    ".meta{text-align:right;color:var(--muted);font-size:12px;line-height:1.4;}" +
    ".logoWrap{display:flex;gap:14px;align-items:center;}" +
    ".logo{width:130px;height:130px;object-fit:contain;border-radius:18px;border:1px solid var(--line);background:white;}" +
    ".card{margin-top:18px;border:1px solid var(--line);border-radius:14px;overflow:hidden;}" +
    ".card h2{margin:0;padding:14px 16px;font-size:13px;background:var(--soft);border-bottom:1px solid var(--line);}" +
    ".grid{display:grid;gap:12px;padding:16px;}" +
    ".grid2{grid-template-columns:repeat(2,1fr);}" +
    ".kpi{border:1px solid var(--line);border-radius:12px;padding:12px;}" +
    ".kpi .label{color:var(--muted);font-size:11px;}" +
    ".kpi .value{margin-top:6px;font-weight:900;font-size:18px;}" +
    "table{width:100%;border-collapse:collapse;}" +
    "thead th{background:var(--soft);font-size:12px;text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);}" +
    "tbody td{font-size:12px;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;}" +
    "tbody tr:last-child td{border-bottom:none;}" +
    ".num{text-align:right;font-variant-numeric:tabular-nums;}" +
    ".muted{color:var(--muted);}" +
    "</style></head><body>" +
    '<div class="page">' +
    '<div class="top">' +
    '<div class="logoWrap">' +
    (logoUrl ? '<img class="logo" src="' + logoUrl + '" />' : "") +
    '<div><div class="brand">Grade A Center</div><div class="muted" style="margin-top:6px;font-size:12px;">Account: ' +
    escapeHtml(accountName) +
    "</div></div></div>" +
    '<div class="meta"><div><strong>Generated:</strong> ' +
    prettyDate +
    "</div></div>" +
    "</div>" +
    '<div class="card"><h2>Summary</h2>' +
    summaryHtml +
    "</div>" +
    '<div class="card"><h2>Payment History</h2>' +
    "<table><thead><tr>" +
    '<th style="width:56px;">#</th>' +
    '<th style="width:150px;">Date</th>' +
    '<th style="width:160px;" class="num">Amount</th>' +
    "<th>Note</th>" +
    "</tr></thead><tbody>" +
    tableRows +
    "</tbody></table></div>" +
    "</div>" +
    "<script>setTimeout(function(){window.print();},300);</script>" +
    "</body></html>";

  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup blocked. Please allow popups to download the receipt.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();

  function kpi(label, value) {
    return `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(
      value
    )}</div></div>`;
  }
}

const DEFAULT_ROWS = [
  {
    id: uid(),
    project: "Landing page redesign",
    className: "Web",
    requirement: "Update hero section, clean UI, optimize mobile.",
    deadline: safeDateInputValue(new Date(Date.now() + 7 * 86400000).toISOString()),
    price: 500,
    writer: "Ali",
    assignedPay: 0,
    status: "pending",
    type: "b7",
    attachment: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    project: "E-commerce product copy",
    className: "Writing",
    requirement: "10 product descriptions (SEO).",
    deadline: safeDateInputValue(new Date(Date.now() + 3 * 86400000).toISOString()),
    price: 220,
    writer: "Ali",
    assignedPay: 0,
    status: "completed",
    type: "b7",
    attachment: null,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_PAYMENTS = [];

// Tiny sanity tests
function runSelfTests() {
  console.assert(parseNumber("1,250") === 1250, "parseNumber should parse commas");
  console.assert(parseNumber("abc") === 0, "parseNumber should return 0 for non-numeric");
  console.assert(clamp(-1, 0, 10) === 0, "clamp should clamp to min");
  console.assert(clamp(11, 0, 10) === 10, "clamp should clamp to max");
  console.assert(formatInt(75.99) === "75", "formatInt should truncate decimals");
}

function normalizeUsers(input, opts = {}) {
  const ensureAli = Boolean(opts.ensureAli);
  const arr = Array.isArray(input) ? input : [];
  const cleaned = arr
    .map((u) => ({
      id: String(u.id || uid()),
      name: String(u.name || "").trim(),
      password: String(u.password || ""),
      role: u.role === "admin" ? "admin" : "worker",
      active: u.active !== false,
    }))
    .filter((u) => u.name.length > 0);

  // Ensure Ali exists and is admin (admin view only)
  const hasAli = cleaned.some((u) => u.name === "Ali");
  const out = ensureAli ? (hasAli ? cleaned : [{ ...DEFAULT_USERS[0] }, ...cleaned]) : cleaned;

  // Ensure unique names
  const seen = new Set();
  return out.filter((u) => {
    if (seen.has(u.name)) return false;
    seen.add(u.name);
    return true;
  });
}

function normalizeAttachment(a) {
  if (!a || typeof a !== "object") return null;
  const name = String(a.name || "");
  const type = String(a.type || "");
  const dataUrl = String(a.dataUrl || "");
  if (!dataUrl) return null;
  return { name, type, dataUrl };
}

function normalizeRows(inRows, knownUsers) {
  const names = new Set((knownUsers || []).map((u) => u.name));
  return (Array.isArray(inRows) ? inRows : [])
    .map((r) => {
      const writer = names.has(String(r.writer || "")) ? String(r.writer) : "Ali";
      const rawType = String(r.type || "").toLowerCase();
      const type = rawType === "grade" ? "grade" : rawType === "seniors" ? "seniors" : "b7";
      return {
        id: String(r.id || uid()),
        project: String(r.project || "").trim(),
        className: String(r.className || "").trim(),
        requirement: String(r.requirement || "").trim(),
        deadline: safeDateInputValue(String(r.deadline || "")),
        price: Math.trunc(parseNumber(r.price)),
        writer,
        assignedPay: Math.trunc(parseNumber(r.assignedPay)),
        status: STATUS[r.status] ? r.status : "pending",
        type,
        attachment: normalizeAttachment(r.attachment),
        createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
      };
    })
    .filter((r) => r.project.length > 0);
}

function normalizePayments(inPayments, knownUsers) {
  const names = new Set((knownUsers || []).map((u) => u.name));
  return (Array.isArray(inPayments) ? inPayments : [])
    .map((p) => {
      const allowed = new Set([...names, "Seniors"]); 
      const recRaw = String(p.recipient || "");
      const recipient = allowed.has(recRaw) ? recRaw : "Ali";
      const note = String(p.note || "");
      return {
        id: String(p.id || uid()),
        recipient,
        amount: Math.trunc(parseNumber(p.amount)),
        date: safeDateInputValue(String(p.date || "")),
        note,
      };
    })
    .filter((p) => p.amount > 0 && p.date);
}

export default function App() {
  const [users, setUsers] = useState([]); // fetched from DB (or public list before login)
  const [activeUser, setActiveUser] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [syncError, setSyncError] = useState("");

  const [rows, setRows] = useState([]);
  const [payments, setPayments] = useState([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // admin only
  const [sortKey, setSortKey] = useState("deadline");
  const [sortDir, setSortDir] = useState("asc");

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    recipient: "Ali",
    amount: "",
    date: "",
    note: "Wamd",
    customNote: "",
  });

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [newWriter, setNewWriter] = useState({ name: "", password: "", role: "worker" });
  const [pwdDraft, setPwdDraft] = useState({});
  const [adminError, setAdminError] = useState("");

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTarget, setAuthTarget] = useState(null);
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState("");

  const [paymentFilter, setPaymentFilter] = useState("all"); // admin filter for payment history

  const fileInputRef = useRef(null);

  const activeUserObj = useMemo(() => users.find((u) => u.name === activeUser) || null, [users, activeUser]);
  const isAdmin = Boolean(activeUser === "Ali" && activeRole === "admin");

  useEffect(() => {
    runSelfTests();
  }, []);

  // Boot: fetch login users + restore session token
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setSyncError("");
      try {
        const res = await fetch("/.netlify/functions/public-users");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            // public list has no passwords (good)
            setUsers(
              normalizeUsers((data?.users || []).map((u) => ({ ...u, password: "", active: true })), { ensureAli: false })
            );
          }
        } else if (!cancelled) {
          setUsers(DEFAULT_USERS.map((u) => ({ ...u, password: "" })));
        }
      } catch {
        if (!cancelled) setUsers(DEFAULT_USERS.map((u) => ({ ...u, password: "" })));
      }

      const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (token) {
        try {
          const me = await fetch("/.netlify/functions/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (me.ok) {
            const data = await me.json();
            const u = data?.user;
            if (!cancelled && u?.name) {
              setActiveUser(u.name);
              setActiveRole(u.role || null);
              sessionStorage.setItem(SESSION_USER_KEY, u.name);
            }
          } else {
            sessionStorage.removeItem(SESSION_TOKEN_KEY);
            sessionStorage.removeItem(SESSION_USER_KEY);
          }
        } catch {
          // network failure: stay logged out
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load state from DB after login
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!activeUser) return;
      const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (!token) return;

      setSyncError("");
      try {
        const res = await fetch("/.netlify/functions/state", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          // invalid/expired
          if (!cancelled) logout(true);
          return;
        }
        const data = await res.json();
        const u = normalizeUsers(data.users || [], { ensureAli: Boolean(activeRole === "admin" && activeUser === "Ali") });
        if (cancelled) return;
        setUsers(u);
        setRows(normalizeRows(data.rows || [], u));
        setPayments(normalizePayments(data.payments || [], u));
        setHydrated(true);
      } catch {
        if (!cancelled) setSyncError("Could not sync with database. Check your connection.");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]);

  // If active user removed/disabled, logout
  useEffect(() => {
    if (!activeUser) return;
    const u = users.find((x) => x.name === activeUser);
    if (!u || u.active === false) logout(true);
  }, [users, activeUser]);

  // Save data to Neon (Ali admin only) - debounced
  useEffect(() => {
    if (!hydrated) return;
    if (!isAdmin) return;

    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return;

    const t = setTimeout(async () => {
      try {
        const res = await fetch("/.netlify/functions/state", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rows, payments, users }),
        });
        if (!res.ok) throw new Error("save failed");
      } catch {
        setSyncError("Could not save to database. Try again.");
      }
    }, 600);

    return () => clearTimeout(t);
  }, [rows, payments, users, hydrated, isAdmin]);

  const activeUserNames = useMemo(() => users.filter((u) => u.active !== false).map((u) => u.name), [users]);
  const allUserNames = useMemo(() => users.map((u) => u.name), [users]);

  const paymentRecipients = useMemo(() => {
    const out = [];
    const add = (n) => {
      if (!n) return;
      if (!out.includes(n)) out.push(n);
    };
    add("Ali");
    add("Seniors");
    allUserNames.forEach(add);
    return out;
  }, [allUserNames]);

  const visibleRows = useMemo(() => {
    if (!activeUser) return [];
    if (isAdmin) return rows;
    return rows.filter((r) => String(r.writer || "") === activeUser);
  }, [rows, activeUser, isAdmin]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = visibleRows;

    if (statusFilter !== "all") out = out.filter((r) => r.status === statusFilter);

    if (isAdmin && typeFilter !== "all") out = out.filter((r) => (r.type || "b7") === typeFilter);

    if (q) {
      out = out.filter((r) => {
        const hay = `${r.project} ${r.className} ${r.requirement} ${r.deadline} ${r.writer} ${r.status}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === "price") return (Number(av || 0) - Number(bv || 0)) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });

    return out;
  }, [visibleRows, query, statusFilter, sortKey, sortDir, isAdmin, typeFilter]);

  const basePaymentsForView = useMemo(() => {
    if (!activeUser) return [];
    if (!isAdmin) return payments.filter((p) => String(p.recipient || "") === activeUser);
    if (paymentFilter === "all") return payments;
    return payments.filter((p) => String(p.recipient || "") === paymentFilter);
  }, [payments, activeUser, isAdmin, paymentFilter]);

  const sortedPayments = useMemo(() => {
    return [...basePaymentsForView].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [basePaymentsForView]);

  const stats = useMemo(() => {
    if (!activeUser) return null;

    const totalProjects = visibleRows.length;
    const completed = visibleRows.filter((r) => r.status === "completed").length;
    const notStarted = visibleRows.filter((r) => r.status === "not_started").length;
    const pending = visibleRows.filter((r) => r.status === "pending").length;
    const revision = visibleRows.filter((r) => r.status === "revision").length;

    if (isAdmin) {
      const totalB7Price = visibleRows.reduce(
        (acc, r) => acc + ((r.type || "b7") === "b7" ? Number(r.price || 0) : 0),
        0
      );
      const gradeAWork = visibleRows.reduce(
        (acc, r) => acc + ((r.type || "b7") === "grade" ? Number(r.price || 0) : 0),
        0
      );
      const seniorWork = visibleRows.reduce(
        (acc, r) => acc + ((r.type || "b7") === "seniors" ? Number(r.price || 0) : 0),
        0
      );

      // Ali only receives 0.7 for B7oothKw projects
      const b7Cut = totalB7Price * 0.7;

      // Payments to Ali (B7 account)
      const receivedAli = payments
        .filter((p) => String(p.recipient || "") === "Ali")
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);

      const remaining = clamp(b7Cut - receivedAli, 0, Number.POSITIVE_INFINITY);

      // Seniors account (no deduction)
      const seniorReceived = payments
        .filter((p) => String(p.recipient || "") === "Seniors")
        .reduce((acc, p) => acc + Number(p.amount || 0), 0);

      const seniorRemaining = clamp(seniorWork - seniorReceived, 0, Number.POSITIVE_INFINITY);

      // Profit after paying writers (applies to all types; b7 uses 0.7, others use full price)
      const myWriters = visibleRows.reduce((acc, r) => {
        const writer = String(r.writer || "");
        if (!writer || writer === "Ali") return acc;
        const pay = Number(r.assignedPay || 0);
        const price = Number(r.price || 0);
        const type = r.type || "b7";
        const profit = type === "b7" ? price * 0.7 - pay : price - pay;
        return acc + profit;
      }, 0);

      return {
        role: "admin",
        totalProjects,
        completed,
        notStarted,
        pending,
        revision,
        b7Cut,
        received: receivedAli,
        remaining,
        seniorReceived,
        seniorRemaining,
        myWriters,
        gradeAWork,
        seniorWork,
      };
    }

    const totalWork = visibleRows.reduce((acc, r) => acc + Number(r.assignedPay || 0), 0);
    const received = payments
      .filter((p) => String(p.recipient || "") === activeUser)
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const remaining = clamp(totalWork - received, 0, Number.POSITIVE_INFINITY);

    return {
      role: "worker",
      totalProjects,
      completed,
      notStarted,
      pending,
      revision,
      totalWork,
      received,
      remaining,
    };
  }, [activeUser, isAdmin, visibleRows, payments]);

  // ---------- AUTH ----------
  function openAuth(userName) {
    setAuthTarget(userName);
    setAuthPass("");
    setAuthError("");
    setAuthModalOpen(true);
  }

  function closeAuth() {
    setAuthModalOpen(false);
    setAuthTarget(null);
    setAuthPass("");
    setAuthError("");
  }

  async function refreshPublicUsers() {
    try {
      const res = await fetch("/.netlify/functions/public-users");
      if (res.ok) {
        const data = await res.json();
        setUsers(normalizeUsers((data?.users || []).map((u) => ({ ...u, password: "", active: true })), { ensureAli: false }));
        return;
      }
    } catch {
      // ignore
    }
    setUsers(DEFAULT_USERS.map((u) => ({ ...u, password: "" })));
  }

  async function submitAuth() {
    const name = String(authTarget || "").trim();
    if (!name) return;
    setAuthError("");

    try {
      const res = await fetch("/.netlify/functions/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, password: authPass }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAuthError(err?.error || "Wrong password");
        return;
      }

      const data = await res.json();
      const token = String(data?.token || "");
      const user = data?.user;

      if (!token || !user?.name) {
        setAuthError("Login failed");
        return;
      }

      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_USER_KEY, user.name);
      setActiveUser(user.name);
      setActiveRole(user.role || null);
      closeAuth();
    } catch {
      setAuthError("Network error");
    }
  }

  async function logout(silent = false) {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);

    setActiveUser(null);
    setActiveRole(null);
    setHydrated(false);
    setRows([]);
    setPayments([]);
    setSyncError("");

    if (token) {
      fetch("/.netlify/functions/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    if (!silent) await refreshPublicUsers();
  }

  // ---------- PROJECTS (Admin only) ----------
  function openAddProject() {
    if (!isAdmin) return;
    setEditing({
      id: null,
      project: "",
      className: "",
      requirement: "",
      deadline: "",
      price: "",
      writer: "Ali",
      assignedPay: "",
      status: "pending",
      type: "b7",
      attachment: null,
    });
    setProjectModalOpen(true);
  }

  function openManageProject(row) {
    if (!isAdmin) return;
    setEditing({
      id: row.id,
      project: row.project || "",
      className: row.className || "",
      requirement: row.requirement || "",
      deadline: row.deadline || "",
      price: String(Math.trunc(Number(row.price || 0))),
      writer: row.writer || "Ali",
      assignedPay: String(Math.trunc(Number(row.assignedPay || 0))),
      status: row.status || "pending",
      type: row.type === "grade" ? "grade" : "b7",
      attachment: row.attachment || null,
    });
    setProjectModalOpen(true);
  }

  function closeProjectModal() {
    setProjectModalOpen(false);
    setEditing(null);
  }

  function saveProject() {
    if (!isAdmin) return;
    if (!editing) return;

    const writer = String(editing.writer || "Ali");
    const needsAssignedPay = writer !== "Ali";
    const assignedPay = Math.trunc(parseNumber(editing.assignedPay));

    const clean = {
      ...editing,
      project: String(editing.project || "").trim(),
      className: String(editing.className || "").trim(),
      requirement: String(editing.requirement || "").trim(),
      deadline: String(editing.deadline || "").trim(),
      price: Math.trunc(parseNumber(editing.price)),
      writer,
      assignedPay: needsAssignedPay ? assignedPay : 0,
      status: editing.status || "pending",
      type: editing.type === "grade" ? "grade" : "b7",
      attachment: editing.attachment || null,
    };

    if (!clean.project) {
      alert("Please enter a project name.");
      return;
    }
    if (clean.price < 0) {
      alert("Price must be 0 or more.");
      return;
    }
    if (needsAssignedPay && (!clean.assignedPay || clean.assignedPay <= 0)) {
      alert("Please enter the amount the writer will receive for this project.");
      return;
    }

    if (clean.id) {
      setRows((prev) => prev.map((r) => (r.id === clean.id ? { ...r, ...clean } : r)));
    } else {
      setRows((prev) => [{ ...clean, id: uid(), createdAt: new Date().toISOString() }, ...prev]);
    }

    closeProjectModal();
  }

  function deleteProject(id) {
    if (!isAdmin) return;
    const ok = confirm("Delete this project? This cannot be undone.");
    if (!ok) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    closeProjectModal();
  }

  // ---------- PAYMENTS (Admin only) ----------
  function openAddPayment() {
    if (!isAdmin) return;
    setNewPayment({
      recipient: "Ali",
      amount: "",
      date: safeDateInputValue(new Date().toISOString()),
      note: "Wamd",
      customNote: "",
    });
    setPaymentModalOpen(true);
  }

  function closePaymentModal() {
    setPaymentModalOpen(false);
    setNewPayment({ recipient: "Ali", amount: "", date: "", note: "Wamd", customNote: "" });
  }

  function savePayment() {
    if (!isAdmin) return;

    const recipient = String(newPayment.recipient || "Ali");
    const amount = Math.trunc(parseNumber(newPayment.amount));
    const date = String(newPayment.date || "").trim();

    let note = String(newPayment.note || "");
    if (note === "Other") note = String(newPayment.customNote || "").trim();

    if (!amount || amount <= 0) {
      alert("Enter an amount greater than 0.");
      return;
    }
    if (!date) {
      alert("Choose a date.");
      return;
    }

    setPayments((prev) => [{ id: uid(), recipient, amount, date, note }, ...prev]);
    closePaymentModal();
  }

  function deletePayment(id) {
    if (!isAdmin) return;
    const ok = confirm("Delete this payment record?");
    if (!ok) return;
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  // ---------- EXPORT / IMPORT (Admin only) ----------
  function exportJson() {
    if (!isAdmin) return;
    const payload = { rows, payments, users };
    downloadText(
      `grade-a-center-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2)
    );
  }

  async function importJson(file) {
    if (!isAdmin) return;

    try {
      const txt = await readFileAsText(file);
      const parsed = JSON.parse(txt);

      if (Array.isArray(parsed)) {
        const u = users.length ? users : DEFAULT_USERS;
        setRows(normalizeRows(parsed, u));
        setPayments([]);
        return;
      }

      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");

      const u = normalizeUsers(parsed.users || users || DEFAULT_USERS, { ensureAli: true });
      const r = normalizeRows(parsed.rows || DEFAULT_ROWS, u);
      const p = normalizePayments(parsed.payments || DEFAULT_PAYMENTS, u);

      setUsers(u);
      setRows(r.length ? r : DEFAULT_ROWS);
      setPayments(p);
    } catch {
      alert("Import failed. Please choose a valid exported JSON file.");
    }
  }

  // ---------- RECEIPT ----------
  function downloadMyReceipt() {
    if (!activeUser) return;

    // Admin can download receipt for: Ali, Seniors, or any writer (using payment filter)
    const target = isAdmin ? (paymentFilter === "all" ? "Ali" : paymentFilter) : activeUser;

    const targetPayments = payments.filter((p) => String(p.recipient || "") === target);
    const received = targetPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    let remaining = 0;

    if (target === "Ali") {
      const totalB7Price = rows.reduce((acc, r) => acc + ((r.type || "b7") === "b7" ? Number(r.price || 0) : 0), 0);
      const b7Cut = totalB7Price * 0.7;
      remaining = clamp(b7Cut - received, 0, Number.POSITIVE_INFINITY);
    } else if (target === "Seniors") {
      const totalSenior = rows.reduce(
        (acc, r) => acc + ((r.type || "b7") === "seniors" ? Number(r.price || 0) : 0),
        0
      );
      remaining = clamp(totalSenior - received, 0, Number.POSITIVE_INFINITY);
    } else {
      const totalWork = rows.reduce(
        (acc, r) => acc + (String(r.writer || "") === target ? Number(r.assignedPay || 0) : 0),
        0
      );
      remaining = clamp(totalWork - received, 0, Number.POSITIVE_INFINITY);
    }

    downloadReceiptAsPdf({
      accountName: target,
      role: isAdmin ? "admin" : "worker",
      received,
      remaining,
      payments: targetPayments,
      logoUrl: logo,
    });
  }

  // ---------- ADMIN PANEL (Ali only) ---------- (Ali only) ----------
  function openAdminPanel() {
    if (!isAdmin) return;
    setAdminError("");
    setPwdDraft({});
    setNewWriter({ name: "", password: "", role: "worker" });
    setAdminModalOpen(true);
  }

  function closeAdminPanel() {
    setAdminModalOpen(false);
    setAdminError("");
  }

  function addWriter() {
    if (!isAdmin) return;

    const name = String(newWriter.name || "").trim();
    const password = String(newWriter.password || "");
    const role = newWriter.role === "admin" ? "admin" : "worker";

    if (!name) {
      setAdminError("Writer name is required.");
      return;
    }
    if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      setAdminError("This name already exists.");
      return;
    }
    if (!password) {
      setAdminError("Password is required.");
      return;
    }

    setUsers((prev) => normalizeUsers([...prev, { id: uid(), name, password, role, active: true }], { ensureAli: true }));
    setNewWriter({ name: "", password: "", role: "worker" });
    setAdminError("");
  }

  function savePasswordFor(name) {
    if (!isAdmin) return;
    const newPass = String(pwdDraft[name] || "");
    if (!newPass) {
      setAdminError("Password cannot be empty.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.name === name ? { ...u, password: newPass } : u)));
    setPwdDraft((p) => ({ ...p, [name]: "" }));
    setAdminError("");
  }

  async function setUserActive(name, active) {
    if (!isAdmin) return;
    setAdminError("");
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) return;
    try {
      const res = await fetch("/.netlify/functions/user-status", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, active: Boolean(active) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAdminError(err?.error || "Could not update user.");
        return;
      }
      const data = await res.json();
      setUsers(normalizeUsers(data.users || [], { ensureAli: true }));
    } catch {
      setAdminError("Network error");
    }
  }

  // ---------- AUTH SCREEN ----------
  if (!activeUser) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <img src={logo} alt="Grade A Center" className="h-20 w-20 rounded-2xl object-contain" />
              <div className="text-2xl font-black tracking-tight text-zinc-900">Grade A Center</div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {users.map((u) => (
                <Button key={u.id} variant="primary" onClick={() => openAuth(u.name)} className="py-4">
                  <Lock className="h-4 w-4" /> {u.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Modal open={authModalOpen} title="Enter Password" onClose={closeAuth}>
          <div className="space-y-4">
            <div className="text-sm text-zinc-700">
              Account: <span className="font-semibold">{authTarget || "—"}</span>
            </div>
            <Field label="Password">
              <Input
                type="password"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAuth();
                }}
                autoFocus
              />
            </Field>
            {authError ? <div className="text-sm font-semibold text-rose-600">{authError}</div> : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeAuth}>
                Close
              </Button>
              <Button onClick={submitAuth}>Login</Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ---------- MAIN APP ----------
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Grade A Center" className="h-9 w-9 rounded-lg object-contain" />
              <div className="text-xl font-semibold tracking-tight text-zinc-900">Grade A Center</div>
              <span className="ml-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">
                {activeUser}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <>
                  <Button variant="secondary" onClick={exportJson}>
                    <Download className="h-4 w-4" /> Export Data
                  </Button>
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Import Data
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importJson(f);
                      e.target.value = "";
                    }}
                  />

                  <Button variant="secondary" onClick={openAdminPanel}>
                    <Users className="h-4 w-4" /> Admin Panel
                  </Button>

                  <Button variant="secondary" onClick={openAddPayment}>
                    <Wallet className="h-4 w-4" /> Add Payment
                  </Button>

                  <Button onClick={openAddProject}>
                    <Plus className="h-4 w-4" /> Add Project
                  </Button>
                </>
              ) : null}

              <Button variant="secondary" onClick={logout}>
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Summary */}
        {stats.role === "admin" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Senior Received" value={formatInt(stats.seniorReceived)} icon={Wallet} />
            <StatCard title="Senior Remaining" value={formatInt(stats.seniorRemaining)} icon={Wallet} />
            <StatCard title="Received" value={formatInt(stats.received)} icon={Wallet} />
            <StatCard title="Remaining" value={formatInt(stats.remaining)} icon={Wallet} />
            <StatCard title="Grade A Work" value={formatInt(stats.gradeAWork)} icon={Wallet} />
            <StatCard title="My Writers" value={formatInt(stats.myWriters)} icon={Wallet} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard title="Received" value={formatInt(stats.received)} icon={Wallet} />
            <StatCard title="Remaining" value={formatInt(stats.remaining)} icon={Wallet} />
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="not_started">Not Started</option>
                  <option value="revision">Revision</option>
                </Select>

                {isAdmin ? (
                  <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="all">All Types</option>
                    <option value="b7">B7oothKw</option>
                    <option value="grade">Grade A</option>
                    <option value="seniors">Seniors</option>
                  </Select>
                ) : null}

                <Select
                  value={`${sortKey}:${sortDir}`}
                  onChange={(e) => {
                    const [k, d] = e.target.value.split(":");
                    setSortKey(k);
                    setSortDir(d);
                  }}
                >
                  <option value="deadline:asc">Sort: Deadline ↑</option>
                  <option value="deadline:desc">Sort: Deadline ↓</option>
                  <option value="project:asc">Sort: Project A→Z</option>
                  <option value="project:desc">Sort: Project Z→A</option>
                  <option value="price:asc">Sort: Price ↑</option>
                  <option value="price:desc">Sort: Price ↓</option>
                  <option value="status:asc">Sort: Status</option>
                </Select>
              </div>
            </div>

            <div className="text-sm text-zinc-600">
              Showing <span className="font-semibold text-zinc-900">{filteredRows.length}</span> of{" "}
              <span className="font-semibold text-zinc-900">{visibleRows.length}</span>
            </div>
          </div>
        </div>

        {/* Projects Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            {isAdmin ? (
              <table className="min-w-[1120px] w-full text-left text-sm">
                <thead className="bg-zinc-900 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Project</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Requirement</th>
                    <th className="px-4 py-3 font-semibold">Deadline</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Writer</th>
                    <th className="px-4 py-3 font-semibold">Writer Pay</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-zinc-500" colSpan={9}>
                        No projects found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id} className={`${statusRowClass(r.status)} border-t border-zinc-200`}>
                        <td className="px-4 py-3 font-semibold text-zinc-900">{r.project}</td>
                        <td className="px-4 py-3 text-zinc-700">{r.className || "—"}</td>
                        <td className="px-4 py-3 text-zinc-700">
                          <div className="line-clamp-2 max-w-[520px]">{r.requirement || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-zinc-800">
                            <Calendar className="h-4 w-4 text-zinc-500" />
                            {r.deadline || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">{formatInt(r.price)}</td>
                        <td className="px-4 py-3 text-zinc-700">{r.writer || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          {r.writer !== "Ali" ? formatInt(r.assignedPay) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <Pill status={r.status} />
                            {r.attachment?.dataUrl ? (
                              <a
                                href={r.attachment.dataUrl}
                                download={r.attachment.name || "attachment"}
                                className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
                              >
                                <Download className="h-4 w-4" /> Download File
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button onClick={() => openManageProject(r)} className="w-full sm:w-auto">
                              <Pencil className="h-4 w-4" /> Manage
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-zinc-900 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Project</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Requirement</th>
                    <th className="px-4 py-3 font-semibold">Deadline</th>
                    <th className="px-4 py-3 font-semibold">Total Work</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-zinc-500" colSpan={6}>
                        No projects found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.id} className={`${statusRowClass(r.status)} border-t border-zinc-200`}>
                        <td className="px-4 py-3 font-semibold text-zinc-900">{r.project}</td>
                        <td className="px-4 py-3 text-zinc-700">{r.className || "—"}</td>
                        <td className="px-4 py-3 text-zinc-700">
                          <div className="line-clamp-2 max-w-[560px]">{r.requirement || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-zinc-800">
                            <Calendar className="h-4 w-4 text-zinc-500" />
                            {r.deadline || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">{formatInt(r.assignedPay)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <Pill status={r.status} />
                            {r.attachment?.dataUrl ? (
                              <a
                                href={r.attachment.dataUrl}
                                download={r.attachment.name || "attachment"}
                                className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
                              >
                                <Download className="h-4 w-4" /> Download File
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-semibold text-zinc-900">
              <History className="h-4 w-4" /> Payment History
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="min-w-[180px]">
                  <option value="all">All</option>
                  {paymentRecipients.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              ) : null}

              <Button variant="secondary" onClick={downloadMyReceipt}>
                <FileText className="h-4 w-4" /> Download Receipt History
              </Button>
              {isAdmin ? (
                <Button variant="secondary" onClick={openAddPayment}>
                  <Plus className="h-4 w-4" /> Add Payment
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={`w-full text-left text-sm ${isAdmin ? "min-w-[900px]" : "min-w-[720px]"}`}>
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-zinc-800">Date</th>
                  {isAdmin ? <th className="px-4 py-3 font-semibold text-zinc-800">Recipient</th> : null}
                  <th className="px-4 py-3 font-semibold text-zinc-800">Amount</th>
                  <th className="px-4 py-3 font-semibold text-zinc-800">Note</th>
                  {isAdmin ? <th className="px-4 py-3 font-semibold text-zinc-800 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {sortedPayments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-zinc-500" colSpan={isAdmin ? 5 : 4}>
                      No payments recorded.
                    </td>
                  </tr>
                ) : (
                  sortedPayments.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-200">
                      <td className="px-4 py-3 text-zinc-800">{p.date}</td>
                      {isAdmin ? <td className="px-4 py-3 text-zinc-700">{p.recipient}</td> : null}
                      <td className="px-4 py-3 font-semibold text-zinc-900">{formatInt(p.amount)}</td>
                      <td className="px-4 py-3 text-zinc-700">{p.note || "—"}</td>
                      {isAdmin ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button variant="danger" onClick={() => deletePayment(p.id)}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Project Modal (Admin only) */}
      <Modal open={projectModalOpen} title={editing?.id ? "Manage Project" : "Add Project"} onClose={closeProjectModal}>
        {editing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing((p) => ({ ...p, type: e.target.value }))}>
                  <option value="b7">B7oothKw</option>
                  <option value="grade">Grade A</option>
                  <option value="seniors">Seniors</option>
                </Select>
              </Field>

              <Field label="Project">
                <Input value={editing.project} onChange={(e) => setEditing((p) => ({ ...p, project: e.target.value }))} />
              </Field>

              <Field label="Class">
                <Input
                  value={editing.className}
                  onChange={(e) => setEditing((p) => ({ ...p, className: e.target.value }))}
                />
              </Field>

              <Field label="Deadline">
                <Input
                  type="date"
                  value={safeDateInputValue(editing.deadline)}
                  onChange={(e) => setEditing((p) => ({ ...p, deadline: e.target.value }))}
                />
              </Field>

              <Field label="Price">
                <Input
                  inputMode="numeric"
                  value={String(editing.price ?? "")}
                  onChange={(e) => setEditing((p) => ({ ...p, price: e.target.value }))}
                />
              </Field>

              <Field label="Writer">
                <Select value={editing.writer} onChange={(e) => setEditing((p) => ({ ...p, writer: e.target.value }))}>
                  {users.map((u) => (
                    <option key={u.id} value={u.name} disabled={u.active === false}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing((p) => ({ ...p, status: e.target.value }))}>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="not_started">Not Started</option>
                  <option value="revision">Revision</option>
                </Select>
              </Field>

              {editing.writer !== "Ali" ? (
                <Field label="Writer Pay">
                  <Input
                    inputMode="numeric"
                    value={String(editing.assignedPay ?? "")}
                    onChange={(e) => setEditing((p) => ({ ...p, assignedPay: e.target.value }))}
                  />
                </Field>
              ) : null}

              <Field label="Attachment">
                <div className="space-y-2">
                  <input
                    type="file"
                    className="block w-full text-sm text-zinc-700 file:mr-4 file:rounded-xl file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-zinc-900 hover:file:bg-zinc-200"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const dataUrl = await readFileAsDataUrl(f);
                      setEditing((p) => ({ ...p, attachment: { name: f.name, type: f.type || "", dataUrl } }));
                      e.target.value = "";
                    }}
                  />
                  {editing.attachment?.dataUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={editing.attachment.dataUrl}
                        download={editing.attachment.name || "attachment"}
                        className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
                      >
                        <Download className="h-4 w-4" /> Download Current File
                      </a>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setEditing((p) => ({ ...p, attachment: null }))}
                        className="px-3 py-2 text-xs"
                      >
                        <X className="h-4 w-4" /> Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Field>
            </div>

            <Field label="Requirement">
              <Textarea
                rows={4}
                value={editing.requirement}
                onChange={(e) => setEditing((p) => ({ ...p, requirement: e.target.value }))}
              />
            </Field>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {editing.id ? (
                <Button variant="danger" onClick={() => deleteProject(editing.id)} className="sm:mr-auto">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              ) : null}
              <Button variant="secondary" onClick={closeProjectModal}>
                Close
              </Button>
              <Button onClick={saveProject}>Save</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Payment Modal (Admin only) */}
      <Modal open={paymentModalOpen} title="Add Payment" onClose={closePaymentModal}>
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Recipient">
              <Select
                value={newPayment.recipient}
                onChange={(e) => setNewPayment((p) => ({ ...p, recipient: e.target.value }))}
              >
                {paymentRecipients.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Amount">
              <Input
                inputMode="numeric"
                value={newPayment.amount}
                onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
              />
            </Field>

            <Field label="Date">
              <Input
                type="date"
                value={safeDateInputValue(newPayment.date)}
                onChange={(e) => setNewPayment((p) => ({ ...p, date: e.target.value }))}
              />
            </Field>

            <Field label="Note">
              <div className="space-y-2">
                <Select
                  value={newPayment.note}
                  onChange={(e) => setNewPayment((p) => ({ ...p, note: e.target.value }))}
                >
                  {PAYMENT_NOTE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
                {newPayment.note === "Other" ? (
                  <Input
                    value={newPayment.customNote}
                    onChange={(e) => setNewPayment((p) => ({ ...p, customNote: e.target.value }))}
                  />
                ) : null}
              </div>
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closePaymentModal}>
              Close
            </Button>
            <Button onClick={savePayment}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Admin Panel Modal (Ali only) */}
      <Modal open={adminModalOpen} title="Admin Panel" onClose={closeAdminPanel}>
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b px-4 py-3 text-sm font-semibold text-zinc-900">Add Writer</div>
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
              <Field label="Name">
                <Input value={newWriter.name} onChange={(e) => setNewWriter((p) => ({ ...p, name: e.target.value }))} />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={newWriter.password}
                  onChange={(e) => setNewWriter((p) => ({ ...p, password: e.target.value }))}
                />
              </Field>
              <Field label="Role">
                <Select value={newWriter.role} onChange={(e) => setNewWriter((p) => ({ ...p, role: e.target.value }))}>
                  <option value="worker">worker</option>
                  <option value="admin">admin</option>
                </Select>
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pb-4">
              {adminError ? <div className="text-sm font-semibold text-rose-600">{adminError}</div> : <div />}
              <Button onClick={addWriter}>
                <Plus className="h-4 w-4" /> Add Writer
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b px-4 py-3 text-sm font-semibold text-zinc-900">Users</div>
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-6 sm:items-end">
                  <Field label="Name">
                    <Input value={u.name} disabled />
                  </Field>
                  <Field label="Role">
                    <Select
                      value={u.role}
                      onChange={(e) => {
                        const role = e.target.value === "admin" ? "admin" : "worker";
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)));
                      }}
                      disabled={u.name === "Ali"}
                    >
                      <option value="worker">worker</option>
                      <option value="admin">admin</option>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <div
                      className={`h-[46px] w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold flex items-center justify-between ${
                        u.active === false ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {u.active === false ? "Disabled" : "Active"}
                    </div>
                  </Field>
                  <Field label="New Password">
                    <Input
                      type="password"
                      value={pwdDraft[u.name] || ""}
                      onChange={(e) => setPwdDraft((p) => ({ ...p, [u.name]: e.target.value }))}
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    onClick={() => savePasswordFor(u.name)}
                    className="h-[46px]"
                    disabled={!pwdDraft[u.name]}
                  >
                    <Save className="h-4 w-4" /> Save
                  </Button>

                  {u.name === "Ali" ? (
                    <Button variant="secondary" className="h-[46px]" disabled>
                      Admin
                    </Button>
                  ) : u.active === false ? (
                    <Button className="h-[46px]" onClick={() => setUserActive(u.name, true)}>
                      Enable User
                    </Button>
                  ) : (
                    <Button variant="danger" className="h-[46px]" onClick={() => setUserActive(u.name, false)}>
                      Disable User
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={closeAdminPanel}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
