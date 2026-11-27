import { useState } from "react";
import { useOrgRole } from "../../store/authStore.js";
import {
  Plus,
  Search,
  Trash2,
  Download,
  Upload,
  X,
  FileText,
  ImagePlus,
  Loader2,
  Table2,
  FolderOpen,
} from "lucide-react";

import { propertyApi } from "../../api/propertyApi.js";
import PropertyFormModal from "./PropertyFormModal.jsx";
import ImportPropertiesModal from "./ImportPropertiesModal.jsx";
import PropertySheet from "./PropertySheet.jsx";
import ProjectsView from "./ProjectsView.jsx";
import BrochureReviewModal from "./BrochureReviewModal.jsx";
import { confirmDialog, toast } from '../../components/ui/index.jsx';
import { useFeature } from "../saas/UpgradeCard.jsx";
import { showUpgrade } from "../../lib/saas.jsx";
import { uploadErrorMessage } from '../../lib/uploadError.js';

export default function PropertiesPage() {
  // "Excel mode" (spreadsheet grid) is the default view; cards are still available.
  // Agents see the Properties page read-only (the editable sheet and every write are owner-only on the server).
  const readOnly = useOrgRole() !== "owner";
  const [view, setView] = useState(readOnly ? "projects" : "sheet");
  const [sheetKey, setSheetKey] = useState(0);
  const [focusSite, setFocusSite] = useState("");
  const refreshSheet = () => setSheetKey((k) => k + 1);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);

  const [showImport, setShowImport] = useState(false);
  const canImport = useFeature("inventory");

  // ==========================================
  // BROCHURE UPLOAD STATE
  // ==========================================

  const [showBrochureUpload, setShowBrochureUpload] = useState(false);

  const [brochureFile, setBrochureFile] = useState(null);

  const [propertyImages, setPropertyImages] = useState([]);

  const [uploadingBrochure, setUploadingBrochure] = useState(false);

  const [brochureError, setBrochureError] = useState("");

  // Step 2 of the brochure flow: the extracted details waiting for the owner's review.
  const [reviewResult, setReviewResult] = useState(null);

  // ==========================================
  // BULK DELETE
  // ==========================================

  const handleBulkDelete = async () => {
    if (!selected.length || !(await confirmDialog({ title: `Delete ${selected.length} properties?`, message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true }))) {
      return;
    }

    try {
      await propertyApi.bulkDelete(selected);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not delete the selected properties.");
      return;
    }

    toast.success("Properties deleted.");
    setSelected([]);
    refreshSheet();
  };

  // ==========================================
  // BROCHURE MODAL OPEN
  // ==========================================

  const openBrochureUpload = () => {
    setBrochureFile(null);
    setPropertyImages([]);
    setBrochureError("");
    setShowBrochureUpload(true);
  };

  // ==========================================
  // BROCHURE MODAL CLOSE
  // ==========================================

  const closeBrochureUpload = () => {
    if (uploadingBrochure) return;

    setShowBrochureUpload(false);
    setBrochureFile(null);
    setPropertyImages([]);
    setBrochureError("");
  };

  // ==========================================
  // BROCHURE FILE SELECT
  // ==========================================

  const handleBrochureChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const MAX_BROCHURE_SIZE = 10 * 1024 * 1024; // 10 MB

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setBrochureError("Please select a valid PDF brochure.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_BROCHURE_SIZE) {
      setBrochureError("Brochure PDF must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    setBrochureError("");
    setBrochureFile(file);
  };

  // ==========================================
  // PROPERTY IMAGES SELECT
  // ==========================================

  const handleImagesChange = (event) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const MAX_IMAGES = 10;
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

    if (files.length > MAX_IMAGES) {
      setBrochureError("You can upload maximum 10 property images.");
      event.target.value = "";
      return;
    }

    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];

    const invalidImage = files.find(
      (file) => !allowedImageTypes.includes(file.type),
    );

    if (invalidImage) {
      setBrochureError(
        `${invalidImage.name} is not supported. Only JPG, JPEG and PNG images are allowed.`,
      );
      event.target.value = "";
      return;
    }

    const oversizedImage = files.find((file) => file.size > MAX_IMAGE_SIZE);

    if (oversizedImage) {
      setBrochureError(
        `${oversizedImage.name} is too large. Each image must be 5 MB or smaller.`,
      );
      event.target.value = "";
      return;
    }

    setBrochureError("");
    setPropertyImages(files);
  };

  // ==========================================
  // UPLOAD BROCHURE + IMAGES
  // ==========================================

  const handleBrochureUpload = async () => {
    if (!brochureFile && propertyImages.length === 0) {
      setBrochureError(
        "Please select a brochure PDF or at least one property image.",
      );

      return;
    }

    setBrochureError("");
    setUploadingBrochure(true);

    try {
      // Nothing is saved yet: extract, then let the owner review / edit the details.
      const res = await propertyApi.extractBrochure({
        brochure: brochureFile,
        images: propertyImages,
      });

      setShowBrochureUpload(false);
      setBrochureFile(null);
      setPropertyImages([]);
      setReviewResult(res.data);
    } catch (error) {
      console.error("Brochure upload failed:", error);

      setBrochureError(
        error?.response?.status === 413
          ? uploadErrorMessage(error)
          : (typeof error?.response?.data === "object" && error?.response?.data?.error) || uploadErrorMessage(error, "Failed to upload brochure. Please try again."),
      );
    } finally {
      setUploadingBrochure(false);
    }
  };

  return (
    <div>
      {/* ======================================
          HEADER
      ====================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-white">
          Properties
        </h1>

        <div className="flex flex-wrap gap-2">
          <div role="tablist" aria-label="View" className="inline-flex rounded-lg bg-ink-100 p-1 dark:bg-ink-800">
            {!readOnly && <button type="button" role="tab" aria-selected={view === "sheet"} onClick={() => setView("sheet")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${view === "sheet" ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white" : "text-ink-500 dark:text-ink-300"}`}><Table2 size={14} /> Excel mode</button>}
            <button type="button" role="tab" aria-selected={view === "projects"} onClick={() => setView("projects")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${view === "projects" ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white" : "text-ink-500 dark:text-ink-300"}`}><FolderOpen size={14} /> Projects</button>
          </div>
          {!readOnly && <>
          <a
            href={propertyApi.exportUrl()}
            className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <Download size={16} />
            Export
          </a>

          <button
            onClick={() => (canImport ? setShowImport(true) : showUpgrade('Inventory import / export is part of Inventory Management on the Builder Pro plan. Upgrade to bulk-import your inventory.'))}
            title={canImport ? undefined : 'Builder Pro feature — upgrade to unlock'}
            className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <Upload size={16} />
            Import CSV
          </button>

          {/* ==================================
              NEW BROCHURE BUTTON
          ================================== */}

          <button
            onClick={openBrochureUpload}
            className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-200"
          >
            <FileText size={16} />
            Add Brochure
          </button>

          <button
            onClick={() => {
              setEditingProperty(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            Add Property
          </button>
          </>}
        </div>
      </div>

      {/* ======================================
          SEARCH / FILTERS
      ====================================== */}

      <div className="card mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, location, description..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
          />
        </div>

        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Filter by city"
          className="w-40 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-800 dark:text-white"
        />

        {!readOnly && selected.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <Trash2 size={16} />
            Delete {selected.length}
          </button>
        )}
      </div>

      {view === "projects" ? (
        <ProjectsView
          readOnly={readOnly}
          search={search}
          city={city}
          selected={selected}
          onSelectedChange={setSelected}
          refreshKey={sheetKey}
          focusSite={focusSite}
          onFocusHandled={() => setFocusSite("")}
          onChanged={refreshSheet}
          onEdit={(property) => { setEditingProperty(property); setShowForm(true); }}
        />
      ) : (
        <PropertySheet
          search={search}
          city={city}
          refreshKey={sheetKey}
          onOpenFull={(property) => { setEditingProperty(property); setShowForm(true); }}
          onAddBrochure={(projectName) => { setFocusSite(projectName); setView("projects"); }}
        />
      )}

      {/* ======================================
          PROPERTY FORM
      ====================================== */}

      {showForm && (
        <PropertyFormModal
          property={editingProperty}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            refreshSheet();
          }}
        />
      )}

      {/* ======================================
          CSV IMPORT
      ====================================== */}

      {showImport && (
        <ImportPropertiesModal
          onClose={() => setShowImport(false)}
          onImported={refreshSheet}
        />
      )}

      {/* ======================================
          REVIEW EXTRACTED DETAILS (step 2)
      ====================================== */}

      {reviewResult && (
        <BrochureReviewModal
          result={reviewResult}
          onCancel={() => setReviewResult(null)}
          onSaved={() => {
            setReviewResult(null);
            refreshSheet();
          }}
        />
      )}

      {/* ======================================
          BROCHURE UPLOAD MODAL
      ====================================== */}

      {showBrochureUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-ink-900">
            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
              <div>
                <h2 className="text-lg font-semibold text-ink-900 dark:text-white">
                  Add Property Brochure
                </h2>

                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                  Upload brochure and property images. Property details are
                  extracted automatically and you can review them before saving.
                </p>
              </div>

              <button
                onClick={closeBrochureUpload}
                disabled={uploadingBrochure}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-40 dark:hover:bg-ink-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}

            <div className="space-y-5 p-5">
              {/* BROCHURE */}

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-800 dark:text-ink-200">
                  Brochure PDF
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-300 p-4 hover:border-brand-500 hover:bg-brand-50/50 dark:border-ink-700 dark:hover:bg-brand-900/10">
                  <div className="rounded-lg bg-red-100 p-2 text-red-600 dark:bg-red-900/20 dark:text-red-300">
                    <FileText size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800 dark:text-white">
                      {brochureFile ? brochureFile.name : "Choose brochure PDF"}
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      PDF only, maximum 10 MB
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleBrochureChange}
                    className="hidden"
                    disabled={uploadingBrochure}
                  />
                </label>
              </div>

              {/* IMAGES */}

              <div>
                <label className="mb-2 block text-sm font-medium text-ink-800 dark:text-ink-200">
                  Property Images
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-300 p-4 hover:border-brand-500 hover:bg-brand-50/50 dark:border-ink-700 dark:hover:bg-brand-900/10">
                  <div className="rounded-lg bg-brand-100 p-2 text-brand-600 dark:bg-brand-900/20 dark:text-brand-300">
                    <ImagePlus size={22} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-800 dark:text-white">
                      {propertyImages.length
                        ? `${propertyImages.length} image(s) selected`
                        : "Choose property images"}
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      JPG, JPEG, PNG • Maximum 10 images • 5 MB each
                    </p>
                  </div>

                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handleImagesChange}
                    className="hidden"
                    disabled={uploadingBrochure}
                  />
                </label>

                {propertyImages.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {propertyImages.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800 dark:text-ink-300"
                      >
                        <ImagePlus size={13} />

                        <span className="truncate">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ERROR */}

              {brochureError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
                  {brochureError}
                </div>
              )}

              {/* PROCESSING MESSAGE */}

              {uploadingBrochure && (
                <div className="flex items-center gap-3 rounded-lg bg-brand-50 px-3 py-3 text-sm text-brand-700 dark:bg-brand-900/20 dark:text-brand-200">
                  <Loader2 size={18} className="animate-spin" />

                  <div>
                    <p className="font-medium">Processing property...</p>

                    <p className="text-xs opacity-80">
                      Uploading files and extracting property details with AI.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}

            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
              <button
                onClick={closeBrochureUpload}
                disabled={uploadingBrochure}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-40 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                Cancel
              </button>

              <button
                onClick={handleBrochureUpload}
                disabled={uploadingBrochure}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingBrochure && (
                  <Loader2 size={16} className="animate-spin" />
                )}

                {uploadingBrochure ? "Processing..." : "Upload & Process"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
