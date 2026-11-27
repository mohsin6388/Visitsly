import { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, ChevronDown, Home, MapPin, Pencil, Trash2 } from 'lucide-react';
import { propertyApi } from '../../api/propertyApi.js';
import { siteKey } from '../../api/siteApi.js';
import { confirmDialog, toast } from '../../components/ui/index.jsx';
import SiteBrochures from './SiteBrochures.jsx';

const PAGE = 100;
const MAX_PAGES = 5;

const fmtMoney = (n) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')} L` : `₹${Number(n).toLocaleString('en-IN')}`);
const range = (values, fmt) => {
  const nums = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!nums.length) return '';
  const lo = Math.min(...nums); const hi = Math.max(...nums);
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
};
const first = (units, key) => units.map((u) => u[key]).find((v) => v && String(v).trim()) || '';
const uniq = (list) => [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];

function Detail({ label, children }) {
  if (!children) return null;
  return <div className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</dt><dd className="mt-0.5 break-words text-xs text-ink-800 dark:text-ink-100">{children}</dd></div>;
}

/**
 * Properties → "Projects": the old "Sites & brochures" and "Cards" views in one.
 * One card per project with every detail (from its unit rows), its brochure(s) and photos
 * (the brochure / photo actions of SiteBrochures), plus select / edit / delete for its units.
 */
export default function ProjectsView({ readOnly = false, search, city, selected, onSelectedChange, refreshKey, focusSite, onFocusHandled, onChanged, onEdit }) {
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState({});

  const loadUnits = useCallback(async () => {
    setError('');
    try {
      const all = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await propertyApi.list({ page, limit: PAGE, ...(search ? { search } : {}), ...(city ? { city } : {}) });
        all.push(...(res.data.properties || []));
        if (page >= (res.data.pagination?.totalPages || 1)) break;
      }
      setUnits(all);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load properties.');
    }
  }, [search, city]);
  useEffect(() => { loadUnits(); }, [loadUnits, refreshKey]);

  const byProject = useMemo(() => {
    const map = new Map();
    units.forEach((u) => { const k = siteKey(u.projectName); if (!map.has(k)) map.set(k, []); map.get(k).push(u); });
    return map;
  }, [units]);

  // With a search / city filter only projects that match are shown (same filters as the Excel sheet).
  const filtering = Boolean(search || city);
  const siteFilter = (site) => {
    if (!filtering) return true;
    if (byProject.has(siteKey(site.name))) return true;
    const q = search.trim().toLowerCase();
    const nameHit = q && `${site.name} ${site.location || ''}`.toLowerCase().includes(q);
    const cityHit = city && String(site.city || '').toLowerCase().includes(city.trim().toLowerCase());
    return Boolean((!q || nameHit) && (!city || cityHit) && (q || city));
  };

  const toggleIds = (ids, on) => onSelectedChange(on ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id)));

  const removeUnit = async (unit) => {
    if (!(await confirmDialog({ title: 'Delete property?', message: `${unit.projectName}${unit.bhk ? ` · ${unit.bhk} BHK` : ''} will be deleted. This cannot be undone.`, confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true }))) return;
    try { await propertyApi.remove(unit._id); toast.success('Property deleted.'); onSelectedChange(selected.filter((id) => id !== unit._id)); onChanged?.(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not delete the property.'); }
  };

  const renderExtras = (site) => {
    const list = byProject.get(siteKey(site.name)) || [];
    if (!list.length) return <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">No unit rows for this project yet — add a property with this project name.</p>;
    const ids = list.map((u) => u._id);
    const picked = ids.filter((id) => selected.includes(id)).length;
    const price = range(list.flatMap((u) => [u.budgetMin, u.budgetMax]), fmtMoney);
    const size = range(list.map((u) => u.sizeSqft), (n) => `${Number(n).toLocaleString('en-IN')} sq ft`);
    const bhks = uniq(list.map((u) => u.bhk)).join(', ');
    const types = uniq(list.map((u) => u.propertyType)).join(', ');
    const amenities = uniq(list.flatMap((u) => u.amenities || []));
    const rera = uniq(list.map((u) => u.reraNumber)).join(', ');
    const metro = first(list, 'nearbyMetro'); const school = first(list, 'nearbySchool'); const hospital = first(list, 'nearbyHospital');
    const maps = first(list, 'mapsLink');
    const unitPhotos = !site.images?.length ? uniq(list.flatMap((u) => u.images || [])).slice(0, 6) : [];
    const inactive = list.every((u) => u.isActive === false);
    const isOpen = Boolean(open[site.nameKey || siteKey(site.name)]);
    const toggleOpen = () => setOpen((o) => ({ ...o, [site.nameKey || siteKey(site.name)]: !isOpen }));
    return <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {!readOnly && <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-ink-600 dark:text-ink-300">
          <input type="checkbox" checked={picked === ids.length} ref={(el) => { if (el) el.indeterminate = picked > 0 && picked < ids.length; }} onChange={(e) => toggleIds(ids, e.target.checked)} aria-label={`Select all units of ${site.name}`} className="h-4 w-4" />
          {picked ? `${picked} selected` : 'Select'}
        </label>}
        {inactive && <span className="rounded-full bg-ink-800/80 px-2 py-0.5 font-medium text-white">Inactive</span>}
        {types && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-ink-600 dark:bg-ink-800 dark:text-ink-300">{types}</span>}
        {bhks && <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">{bhks} BHK</span>}
        {list.some((u) => u.parking) && <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-ink-600 dark:bg-ink-800 dark:text-ink-300"><Car size={10} /> Parking</span>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Detail label="Builder">{first(list, 'builderName')}</Detail>
        <Detail label="Price">{price || 'Not set'}</Detail>
        <Detail label="Size">{size}</Detail>
        <Detail label="RERA">{rera}</Detail>
        <Detail label="Nearby metro">{metro}</Detail>
        <Detail label="Nearby school">{school}</Detail>
        <Detail label="Nearby hospital">{hospital}</Detail>
        <Detail label="Map">{maps && <a href={maps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><MapPin size={11} /> Open map</a>}</Detail>
      </dl>
      {amenities.length > 0 && <div className="flex flex-wrap gap-1">{amenities.slice(0, 12).map((a) => <span key={a} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600 dark:bg-ink-800 dark:text-ink-300">{a}</span>)}{amenities.length > 12 && <span className="px-1 text-[11px] text-ink-400">+{amenities.length - 12} more</span>}</div>}
      {first(list, 'description') && <p className="line-clamp-3 text-xs text-ink-600 dark:text-ink-300">{first(list, 'description')}</p>}
      {unitPhotos.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">{unitPhotos.map((url) => <img key={url} src={url} alt={`${site.name} photo`} className="h-16 w-24 shrink-0 rounded-lg object-cover" />)}</div>}

      <div className="rounded-lg border border-ink-100 dark:border-ink-800">
        <button type="button" onClick={toggleOpen} aria-expanded={isOpen} className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-ink-700 dark:text-ink-200"><span className="inline-flex items-center gap-1.5"><Home size={13} /> {list.length} {list.length === 1 ? 'unit' : 'units'} · edit / delete</span><ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>
        {isOpen && <ul className="divide-y divide-ink-100 border-t border-ink-100 dark:divide-ink-800 dark:border-ink-800">{list.map((u) => <li key={u._id} className="flex items-center gap-2 px-3 py-2 text-xs">
          {!readOnly && <input type="checkbox" checked={selected.includes(u._id)} onChange={(e) => toggleIds([u._id], e.target.checked)} aria-label={`Select ${u.projectName} ${u.bhk || ''}`} className="h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1 truncate text-ink-700 dark:text-ink-200">{[u.bhk && `${u.bhk} BHK`, u.floor && `Floor ${u.floor}`, u.sizeSqft && `${u.sizeSqft} sq ft`, range([u.budgetMin, u.budgetMax], fmtMoney), u.availability && u.availability !== 'available' ? u.availability : ''].filter(Boolean).join(' · ') || 'Unit'}</span>
          {!readOnly && <button type="button" onClick={() => onEdit(u)} className="rounded p-1 text-ink-400 hover:text-brand-600" aria-label="Edit unit"><Pencil size={14} /></button>}
          {!readOnly && <button type="button" onClick={() => removeUnit(u)} className="rounded p-1 text-ink-400 hover:text-red-600" aria-label="Delete unit"><Trash2 size={14} /></button>}
        </li>)}</ul>}
      </div>
    </div>;
  };

  return <>
    {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
    <SiteBrochures
      readOnly={readOnly}
      focusSite={focusSite}
      onFocusHandled={onFocusHandled}
      refreshKey={refreshKey}
      onChanged={onChanged}
      renderExtras={renderExtras}
      siteFilter={siteFilter}
      emptyText={filtering ? 'No projects match your search.' : undefined}
    />
  </>;
}
