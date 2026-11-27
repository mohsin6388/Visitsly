import { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Loader2, X } from 'lucide-react';
import { propertyApi } from '../../api/propertyApi.js';
import { confirmDialog, toast } from '../../components/ui/index.jsx';
import { uploadErrorMessage } from '../../lib/uploadError.js';

const PROPERTY_TYPES = ['Apartment', 'Villa', 'Plot', 'Commercial', 'Studio', 'Penthouse'];
const numToText = (v) => (v === null || v === undefined ? '' : String(v));
const textToNum = (v) => {
  const t = String(v ?? '').replace(/[₹,\s]/g, '');
  if (t === '') return { value: null };
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? { value: n } : { error: true };
};

function Field({ label, htmlFor, children, className = '' }) {
  return <div className={className}><label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-ink-600 dark:text-ink-300">{label}</label>{children}</div>;
}

/** Tag editor: type and press Enter / comma to add, click × to remove. */
function TagEditor({ id, tags, onChange }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const parts = String(raw).split(',').map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const have = new Set(tags.map((t) => t.toLowerCase()));
    const next = [...tags];
    parts.forEach((t) => { if (!have.has(t.toLowerCase())) { have.add(t.toLowerCase()); next.push(t.slice(0, 60)); } });
    onChange(next);
    setText('');
  };
  return <div className="rounded-lg border border-ink-200 bg-white p-2 dark:border-ink-700 dark:bg-ink-800">
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{t}<button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={11} /></button></span>)}
      <input id={id} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => add(text)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); } else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1)); }}
        placeholder={tags.length ? 'Add another…' : 'Type an amenity and press Enter'} className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none dark:text-white" />
    </div>
  </div>;
}

/**
 * Second step of "Add Property Brochure": the AI-extracted details in editable inputs.
 * Nothing exists in the database until "Save property" (POST /properties/brochure/confirm).
 */
export default function BrochureReviewModal({ result, onCancel, onSaved }) {
  const { extracted = {}, brochure, warnings = [] } = result;
  const initial = useMemo(() => ({
    projectName: extracted.projectName || '', builderName: extracted.builderName || '', propertyType: extracted.propertyType || '',
    bhk: extracted.bhk || '', location: extracted.location || '', city: extracted.city || '',
    budgetMin: numToText(extracted.budgetMin), budgetMax: numToText(extracted.budgetMax), sizeSqft: numToText(extracted.sizeSqft),
    reraNumber: extracted.reraNumber || '', nearbyMetro: extracted.nearbyMetro || '', nearbySchool: extracted.nearbySchool || '',
    nearbyHospital: extracted.nearbyHospital || '', mapsLink: extracted.mapsLink || '', description: extracted.description || '',
  }), [extracted]);
  const [form, setForm] = useState(initial);
  const [amenities, setAmenities] = useState(extracted.amenities || []);
  const [parking, setParking] = useState(Boolean(extracted.parking));
  const [images, setImages] = useState(result.images || []);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined })); };
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || amenities.join('|') !== (extracted.amenities || []).join('|') || parking !== Boolean(extracted.parking) || images.length !== (result.images || []).length;

  const cancel = async () => {
    if (saving) return;
    if (dirty && !(await confirmDialog({ title: 'Discard these details?', message: 'Nothing has been saved yet. The extracted details will be discarded.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true }))) return;
    onCancel();
  };

  const save = async () => {
    const next = {};
    if (!form.projectName.trim()) next.projectName = 'Project name is required.';
    const min = textToNum(form.budgetMin); const max = textToNum(form.budgetMax); const size = textToNum(form.sizeSqft);
    if (min.error) next.budgetMin = 'Enter a number (0 or more).';
    if (max.error) next.budgetMax = 'Enter a number (0 or more).';
    if (size.error) next.sizeSqft = 'Enter a number (0 or more).';
    if (form.mapsLink.trim() && !/^https?:\/\//i.test(form.mapsLink.trim())) next.mapsLink = 'Must start with http:// or https://';
    setErrors(next);
    if (Object.keys(next).length) { toast.error('Please fix the highlighted fields.'); return; }
    setSaving(true);
    try {
      const res = await propertyApi.confirmBrochure({
        ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])),
        budgetMin: min.value, budgetMax: max.value, sizeSqft: size.value,
        amenities, parking, brochure, images,
      });
      toast.success('Property saved.');
      if (res.data?.warnings?.length) toast.info(res.data.warnings[0]);
      onSaved(res.data?.property);
    } catch (err) {
      toast.error(uploadErrorMessage(err, 'Could not save the property. Please try again.'));
    } finally { setSaving(false); }
  };

  const input = (key, label, props = {}) => <Field label={label} htmlFor={`rv-${key}`} className={props.className}>
    <input id={`rv-${key}`} value={form[key]} onChange={set(key)} disabled={saving} className={`input-field ${errors[key] ? '!border-red-400' : ''}`} {...props.input} />
    {errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>}
  </Field>;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Review details">
    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl dark:bg-ink-900">
      <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
        <div><h2 className="text-lg font-semibold text-ink-900 dark:text-white">Review details</h2><p className="mt-1 text-xs text-ink-500 dark:text-ink-400">The AI read these from your brochure. Check and correct them — the property is saved only when you press “Save property”.</p></div>
        <button type="button" onClick={cancel} disabled={saving} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 disabled:opacity-40 dark:hover:bg-ink-800" aria-label="Close"><X size={18} /></button>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        {warnings.length > 0 && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Please double-check</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-xs sm:text-sm">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>}

        <div className="grid gap-3 sm:grid-cols-2">
          {input('projectName', 'Project name *')}
          {input('builderName', 'Builder')}
          <Field label="Property type" htmlFor="rv-propertyType">
            <input id="rv-propertyType" list="rv-types" value={form.propertyType} onChange={set('propertyType')} disabled={saving} className="input-field" />
            <datalist id="rv-types">{PROPERTY_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          {input('bhk', 'BHK', { input: { placeholder: 'e.g. 2, 3 or 2-3' } })}
          {input('location', 'Location / area')}
          {input('city', 'City')}
          {input('budgetMin', 'Price from (₹)', { input: { inputMode: 'numeric', placeholder: 'e.g. 5000000' } })}
          {input('budgetMax', 'Price to (₹)', { input: { inputMode: 'numeric', placeholder: 'e.g. 9000000' } })}
          {input('sizeSqft', 'Size (sq ft)', { input: { inputMode: 'numeric' } })}
          {input('reraNumber', 'RERA number')}
          {input('nearbyMetro', 'Nearby metro')}
          {input('nearbySchool', 'Nearby school')}
          {input('nearbyHospital', 'Nearby hospital')}
          {input('mapsLink', 'Maps link', { className: 'sm:col-span-2', input: { placeholder: 'https://maps.google.com/…' } })}
        </div>

        <Field label="Amenities" htmlFor="rv-amenities"><TagEditor id="rv-amenities" tags={amenities} onChange={setAmenities} /></Field>

        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink-800 dark:text-ink-200">
          <button type="button" role="switch" aria-checked={parking} onClick={() => setParking((v) => !v)} disabled={saving} className={`relative h-6 w-11 shrink-0 rounded-full transition ${parking ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${parking ? 'left-[22px]' : 'left-0.5'}`} /></button>
          Parking available
        </label>

        <Field label="Description" htmlFor="rv-description"><textarea id="rv-description" rows={4} value={form.description} onChange={set('description')} disabled={saving} className="input-field" /></Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="mb-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Brochure</p>
            <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800"><FileText size={16} className="shrink-0 text-red-600" /><span className="truncate">{brochure?.originalName || 'brochure.pdf'}</span></div></div>
          <div><p className="mb-1 text-xs font-semibold text-ink-600 dark:text-ink-300">Photos ({images.length})</p>
            {images.length ? <div className="flex flex-wrap gap-2">{images.map((url) => <div key={url} className="group relative h-14 w-20 overflow-hidden rounded-lg bg-ink-100"><img src={url} alt="Property" className="h-full w-full object-cover" /><button type="button" disabled={saving} onClick={() => setImages((list) => list.filter((u) => u !== url))} className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 p-0.5 text-white group-hover:block" aria-label="Remove photo"><X size={11} /></button></div>)}</div> : <p className="text-xs text-ink-400">No photos uploaded.</p>}</div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
        <button type="button" onClick={cancel} disabled={saving} className="btn-secondary">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving…' : 'Save property'}</button>
      </div>
    </div>
  </div>;
}
