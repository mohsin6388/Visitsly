import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { whatsappApi } from "../../api/whatsappApi.js";
import { emailApi } from "../../api/emailApi.js";
import { uploadApi } from "../../api/uploadApi.js";
import WhatsAppPreview, {
  partsFromTemplate,
} from "../../components/WhatsAppPreview.jsx";
import { useAuthStore } from "../../store/authStore.js";
import { confirmDialog, Skeleton } from "../../components/ui/index.jsx";
import { uploadErrorMessage } from "../../lib/uploadError.js";

// WhatsApp template languages for the chat languages Visitsly supports.
const TEMPLATE_LANGUAGES = [
  ["en_US", "English (US)"],
  ["en_GB", "English (UK)"],
  ["hi", "Hindi"],
  ["ur", "Urdu"],
  ["ar", "Arabic"],
  ["bn", "Bengali"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["pa", "Punjabi"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["ru", "Russian"],
];

const EMAIL_CATEGORIES = [
  { value: "marketing", label: "Marketing" },
  { value: "follow_up", label: "Follow-up" },
  { value: "property_update", label: "Property update" },
  { value: "general", label: "General" },
];

function StatusBadge({ status }) {
  const value = String(status || "unknown").toUpperCase();
  const styles =
    value === "APPROVED"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : value === "REJECTED"
        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        : ["PENDING", "IN_APPEAL"].includes(value)
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-ink-600 dark:text-ink-300">
      {children}
    </label>
  );
}

export default function TemplateManagerPage({ channel = "email" }) {
  const isWhatsApp = channel === "whatsapp";
  const companyLabel = useAuthStore((s) => s.org?.name) || "Your Company";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailCategory, setEmailCategory] = useState("marketing");
  const [waCategory, setWaCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [sampleValues, setSampleValues] = useState("Mohsin, Noida");
  const [imageUrl, setImageUrl] = useState("");

  const resetForm = () => {
    setEditingId("");
    setName("");
    setSubject("");
    setBody("");
    setEmailCategory("marketing");
    setWaCategory("MARKETING");
    setLanguage("en_US");
    setHeaderText("");
    setFooterText("");
    setSampleValues("Mohsin, Noida");
    setImageUrl("");
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = isWhatsApp
        ? await whatsappApi.allTemplates()
        : await emailApi.templates();
      setItems(response.data?.templates || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          (isWhatsApp
            ? "Could not load WhatsApp templates. Check your WhatsApp connection."
            : "Could not load email templates."),
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isWhatsApp]);
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Bulk message → "New template · approval" lands here with ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      resetForm();
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOf = (item) => {
    const value = String(item.status || "").toUpperCase();
    if (value === "APPROVED") return "APPROVED";
    if (["REJECTED", "DISABLED", "PAUSED"].includes(value)) return "REJECTED";
    return "PENDING";
  };
  const statusCounts = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc[statusOf(item)] += 1;
          return acc;
        },
        { APPROVED: 0, PENDING: 0, REJECTED: 0 },
      ),
    [items],
  );
  const visibleItems =
    isWhatsApp && statusFilter !== "ALL"
      ? items.filter((item) => statusOf(item) === statusFilter)
      : items;
  const [selectedKey, setSelectedKey] = useState("");
  const keyOf = (item) => item.id || item._id || item.name;
  const selectedItem =
    visibleItems.find((item) => keyOf(item) === selectedKey) ||
    visibleItems[0] ||
    null;
  const openInBulk = (item) =>
    navigate(
      isWhatsApp
        ? `/outreach/whatsapp?template=${encodeURIComponent(`${item.name}::${item.language}`)}`
        : "/outreach/email",
    );

  const openCreate = () => {
    resetForm();
    setError("");
    setNotice("");
    setFormOpen(true);
  };
  const openEdit = (template) => {
    setError("");
    setNotice("");
    setEditingId(template._id);
    setName(template.name || "");
    setSubject(template.subject || "");
    setBody(template.body || "");
    setEmailCategory(template.category || "marketing");
    setImageUrl(template.imageUrl || "");
    setFormOpen(true);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }
    const sizeLimit = isWhatsApp ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > sizeLimit) {
      setError(
        isWhatsApp
          ? "WhatsApp template images must be under 5 MB."
          : "Email images must be under 25 MB.",
      );
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const result = await uploadApi.image(
        file,
        isWhatsApp ? "templates/whatsapp" : "templates/email",
      );
      const url = result.data?.url;
      if (!url) throw new Error("Cloudinary returned no image URL.");
      setImageUrl(url);
      setNotice("Image uploaded. Check the preview.");
    } catch (err) {
      setError(uploadErrorMessage(err, err.message || "Image upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const saveEmail = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim() || !subject.trim() || !body.trim()) {
      setError("Name, subject and message are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        category: emailCategory,
        imageUrl,
      };
      if (editingId) await emailApi.updateTemplate(editingId, payload);
      else await emailApi.createTemplate(payload);
      setNotice(
        editingId
          ? "Template updated."
          : "Template saved. You can now use it in email campaigns.",
      );
      setFormOpen(false);
      resetForm();
      await loadItems();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save the template.");
    } finally {
      setSaving(false);
    }
  };

  const submitWhatsApp = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim() || !body.trim()) {
      setError("Name and message body are required.");
      return;
    }
    const vars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const max = vars.length ? Math.max(...vars) : 0;
    const samples = sampleValues
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (max && samples.length < max) {
      setError(
        `The body uses {{1}} to {{${max}}}. Add ${max} comma-separated sample values.`,
      );
      return;
    }
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
      setError("Header image must be a public HTTPS URL.");
      return;
    }
    setSaving(true);
    try {
      const response = await whatsappApi.createTemplate({
        name: name.trim().toLowerCase(),
        category: waCategory,
        language,
        bodyText: body.trim(),
        headerText: imageUrl ? "" : headerText.trim(),
        headerImageUrl: imageUrl,
        footerText: footerText.trim(),
        sampleValues: samples,
      });
      setNotice(
        response.message ||
          "Submitted to Meta for review. Refresh after approval.",
      );
      setFormOpen(false);
      resetForm();
      await loadItems();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Could not submit to Meta. Check the name and sample values.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteEmail = async (template) => {
    if (
      !(await confirmDialog({
        title: `Delete "${template.name}"?`,
        message: "Past campaigns keep their content.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true,
      }))
    )
      return;
    setDeletingId(template._id);
    setError("");
    setNotice("");
    try {
      await emailApi.deleteTemplate(template._id);
      setNotice("Template deleted.");
      await loadItems();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not delete the template.",
      );
    } finally {
      setDeletingId("");
    }
  };

  const deleteWhatsApp = async (template) => {
    if (
      !(await confirmDialog({
        title: `Delete "${template.name}"?`,
        message: "It will also be removed from Meta. This cannot be undone.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true,
      }))
    )
      return;
    setDeletingId(template.name);
    setError("");
    setNotice("");
    try {
      const result = await whatsappApi.deleteTemplate(template.name);
      setNotice(result.message || "Template deleted from Meta.");
      await loadItems();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not delete from Meta.");
    } finally {
      setDeletingId("");
    }
  };

  const Icon = isWhatsApp ? MessageCircle : Mail;
  const previewBody = useMemo(() => {
    const values = sampleValues.split(",").map((v) => v.trim());
    return body
      .replace(
        /\{\{(\d+)\}\}/g,
        (whole, index) => values[Number(index) - 1] || whole,
      )
      .replace(/\{\{name\}\}/gi, "Mohsin")
      .replace(/\{\{email\}\}/gi, "mohsin@example.com")
      .replace(/\{\{phone\}\}/gi, "+91 98765 43210");
  }, [body, sampleValues]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${isWhatsApp ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"}`}
          >
            <Icon size={22} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">
              {isWhatsApp ? "WhatsApp Templates" : "Email Templates"}
            </h1>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              {isWhatsApp
                ? "Create templates and send them for Meta approval."
                : "No approval needed — use right after saving."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadItems}
            disabled={loading}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Create template
          </button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {formOpen && (
        <section className="card !p-4 sm:!p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
                {isWhatsApp
                  ? "Submit WhatsApp template"
                  : editingId
                    ? "Edit email template"
                    : "Create email template"}
              </h2>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                Write on the left; live preview updates on the right.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
              className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
              aria-label="Close template form"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form
              onSubmit={isWhatsApp ? submitWhatsApp : saveEmail}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Template name</FieldLabel>
                  <input
                    className="input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={isWhatsApp ? 120 : 100}
                    placeholder={
                      isWhatsApp ? "property_offer_2026" : "New property offer"
                    }
                    required
                  />
                  <p className="mt-1 text-[11px] text-ink-400">
                    {isWhatsApp
                      ? "Lowercase letters, numbers and underscores."
                      : "Name shown in your CRM."}
                  </p>
                </div>
                {isWhatsApp ? (
                  <div>
                    <FieldLabel>Meta category</FieldLabel>
                    <select
                      className="input-field"
                      value={waCategory}
                      onChange={(e) => setWaCategory(e.target.value)}
                    >
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <FieldLabel>Email category</FieldLabel>
                    <select
                      className="input-field"
                      value={emailCategory}
                      onChange={(e) => setEmailCategory(e.target.value)}
                    >
                      {EMAIL_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {isWhatsApp ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Language</FieldLabel>
                      <select
                        className="input-field"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {TEMPLATE_LANGUAGES.map(([code, label]) => (
                          <option key={code} value={code}>
                            {label} — {code}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-ink-400">
                        Make the same template name in each language your
                        customers use — reminders and follow-ups are sent in the
                        customer's chat language when a matching translation is
                        approved.
                      </p>
                    </div>
                    <div>
                      <FieldLabel>
                        Optional text header (ignored when image is selected)
                      </FieldLabel>
                      <input
                        className="input-field"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                        maxLength={60}
                        placeholder={`${companyLabel} — Property Update`}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Message body</FieldLabel>
                    <textarea
                      className="input-field resize-y"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      maxLength={1024}
                      placeholder={
                        "Hi {{1}}, we have properties in {{2}}. Book a site visit?"
                      }
                      required
                    />
                    <p className="mt-1 text-[11px] text-ink-400">
                      Use {"{{1}}"}, {"{{2}}"}. Sample values below are
                      submitted to Meta.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Sample values (comma separated)</FieldLabel>
                      <input
                        className="input-field"
                        value={sampleValues}
                        onChange={(e) => setSampleValues(e.target.value)}
                        placeholder="Mohsin, Noida"
                      />
                    </div>
                    <div>
                      <FieldLabel>Footer (optional)</FieldLabel>
                      <input
                        className="input-field"
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        maxLength={60}
                        placeholder={companyLabel}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <FieldLabel>Email subject</FieldLabel>
                    <input
                      className="input-field"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={200}
                      placeholder="New properties you may like"
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel>Email message</FieldLabel>
                    <textarea
                      className="input-field resize-y"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      maxLength={5000}
                      placeholder={
                        "Hi {{name}},\n\nWe have some new properties that may fit your needs…"
                      }
                      required
                    />
                    <p className="mt-1 text-[11px] text-ink-400">
                      Personalize with {"{{name}}"}, {"{{email}}"} or{" "}
                      {"{{phone}}"}.
                    </p>
                  </div>
                </>
              )}
              <div>
                <FieldLabel>
                  <span className="inline-flex items-center gap-2">
                    <ImagePlus size={15} />
                    {isWhatsApp
                      ? "Header image (optional)"
                      : "Email image (optional)"}
                  </span>
                </FieldLabel>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="btn-secondary inline-flex cursor-pointer items-center gap-2">
                    <UploadCloud size={15} />
                    {uploading ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                  </label>
                  <span className="text-xs text-ink-500 dark:text-ink-400">
                    JPG, PNG or WebP · up to{" "}
                    {isWhatsApp ? "5 MB (Meta limit)" : "25 MB"}
                  </span>
                </div>
                {imageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="min-w-0 truncate text-xs text-emerald-700 dark:text-emerald-300">
                      Uploaded to Cloudinary
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove image
                    </button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    resetForm();
                  }}
                  disabled={saving || uploading}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isWhatsApp ? (
                    <Send size={16} />
                  ) : (
                    <Save size={16} />
                  )}{" "}
                  {saving
                    ? "Saving…"
                    : isWhatsApp
                      ? "Submit for approval"
                      : editingId
                        ? "Update template"
                        : "Save template"}
                </button>
              </div>
            </form>
            <aside className="self-start rounded-2xl border border-ink-100 bg-slate-50 p-4 dark:border-ink-800 dark:bg-ink-950/50 lg:sticky lg:top-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-800 dark:text-white">
                  Live preview
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-ink-400">
                  {isWhatsApp ? "WhatsApp" : "Gmail style"}
                </span>
              </div>
              {isWhatsApp ? (
                <WhatsAppPreview
                  headerText={headerText}
                  imageUrl={imageUrl}
                  body={body}
                  footer={footerText}
                  values={sampleValues.split(",").map((v) => v.trim())}
                  caption="Preview with sample values."
                />
              ) : (
                <div className="mx-auto max-w-[430px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-800">
                      {companyLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">to me</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">
                      {subject || "Your email subject will appear here"}
                    </div>
                  </div>
                  <div className="min-h-56 p-4">
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt="Email header"
                        className="mb-4 max-h-56 w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                      {previewBody || "Your email content will appear here."}
                    </p>
                    <div className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-400">
                      {companyLabel} · Property updates
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-3 text-[11px] leading-5 text-ink-500 dark:text-ink-400">
                Final look may vary slightly by device and app.
              </p>
            </aside>
          </div>
        </section>
      )}

      {isWhatsApp && items.length > 0 && (
        <div
          role="tablist"
          aria-label="Template status"
          className="flex flex-wrap gap-2"
        >
          {[
            ["ALL", "All", items.length],
            ["APPROVED", "Approved", statusCounts.APPROVED],
            ["PENDING", "In review", statusCounts.PENDING],
            ["REJECTED", "Rejected", statusCounts.REJECTED],
          ].map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={statusFilter === key}
              onClick={() => setStatusFilter(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === key ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"}`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-14 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-500 dark:bg-ink-800">
            <FileText size={22} />
          </span>
          <h2 className="font-display text-base font-bold text-ink-900 dark:text-white">
            No templates yet
          </h2>
          <p className="mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">
            {isWhatsApp
              ? "Create one and wait for Meta approval."
              : "Create one, then use it in email campaigns."}
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Plus size={15} /> Create first template
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left: template list */}
          <div className="card min-w-0 !p-2">
            {visibleItems.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-ink-400">
                No templates in this filter.
              </p>
            ) : (
              <ul className="max-h-[calc(100vh-17rem)] space-y-1 overflow-y-auto">
                {visibleItems.map((item) => {
                  const key = item.id || item._id || item.name;
                  const active =
                    (selectedItem?.id ||
                      selectedItem?._id ||
                      selectedItem?.name) === key;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-900/20 dark:ring-brand-800" : "hover:bg-ink-50 dark:hover:bg-ink-800/60"}`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isWhatsApp ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"}`}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-900 dark:text-white">
                            {item.name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-400">
                            {isWhatsApp
                              ? `${item.category || "Template"} · ${item.language || ""}`
                              : `${EMAIL_CATEGORIES.find((c) => c.value === item.category)?.label || "General"}`}
                          </span>
                        </span>
                        {isWhatsApp && <StatusBadge status={item.status} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right: preview of the selected template */}
          {selectedItem ? (
            <article className="card min-w-0 !p-4 sm:!p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-display text-lg font-bold text-ink-900 dark:text-white">
                    {selectedItem.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                    {isWhatsApp
                      ? `${selectedItem.category || "Template"} · ${selectedItem.language || ""}`
                      : `Updated ${new Date(selectedItem.updatedAt || selectedItem.createdAt).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                {isWhatsApp ? (
                  <StatusBadge status={selectedItem.status} />
                ) : (
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    Saved
                  </span>
                )}
              </div>
              {isWhatsApp && statusOf(selectedItem) === "REJECTED" && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">
                  Rejected:{" "}
                  {String(
                    selectedItem.rejectedReason ||
                      "No reason given. Edit the content and submit a new template.",
                  )
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </p>
              )}
              {isWhatsApp && statusOf(selectedItem) === "PENDING" && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  In Meta review. It will be usable once approved.
                </p>
              )}
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-ink-950/50">
                {isWhatsApp ? (
                  <WhatsAppPreview
                    className="mx-auto max-w-sm"
                    {...partsFromTemplate(selectedItem)}
                    values={["Ayush", "Kanpur", "Sunday 11 am"]}
                  />
                ) : (
                  <div className="mx-auto max-w-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div className="text-sm font-semibold text-slate-800">
                        {companyLabel}
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {selectedItem.subject}
                      </div>
                    </div>
                    <div className="p-4">
                      {selectedItem.imageUrl && (
                        <img
                          src={selectedItem.imageUrl}
                          alt=""
                          className="mb-4 max-h-56 w-full rounded-lg object-contain"
                        />
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                        {selectedItem.body}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {isWhatsApp ? (
                  <>
                    <button
                      type="button"
                      onClick={() => deleteWhatsApp(selectedItem)}
                      disabled={deletingId === selectedItem.name}
                      className="btn-secondary !px-3 !py-2 text-xs text-red-600 dark:text-red-300"
                    >
                      {deletingId === selectedItem.name ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}{" "}
                      Delete from Meta
                    </button>
                    {statusOf(selectedItem) === "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => openInBulk(selectedItem)}
                        className="btn-primary !px-3 !py-2 text-xs inline-flex items-center gap-1.5"
                      >
                        Use in campaign <ArrowRight size={13} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(selectedItem)}
                      className="btn-secondary !px-3 !py-2 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEmail(selectedItem)}
                      disabled={deletingId === selectedItem._id}
                      className="btn-secondary !px-3 !py-2 text-xs text-red-600 dark:text-red-300"
                    >
                      {deletingId === selectedItem._id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}{" "}
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => openInBulk(selectedItem)}
                      className="btn-primary !px-3 !py-2 text-xs inline-flex items-center gap-1.5"
                    >
                      Use in campaign <ArrowRight size={13} />
                    </button>
                  </>
                )}
              </div>
            </article>
          ) : (
            <div className="card flex items-center justify-center py-16 text-sm text-ink-400">
              Select a template to preview it.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
