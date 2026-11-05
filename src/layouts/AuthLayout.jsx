// import { useEffect, useLayoutEffect, useRef, useState } from "react";
// import { Outlet, Link, useLocation } from "react-router-dom";
// import { publicApi } from "../api/saasApi.js";
// import { BrandMark } from "../features/auth/AuthParts.jsx";

// // Point these at your landing-page sections if they live on another site.
// const NAV = [
//   { label: "Home", to: "/pricing" },
//   { label: "Platform", to: "/pricing" },
//   { label: "Pricing", to: "/pricing" },
//   { label: "FAQ", to: "/pricing" },
// ];

// const STATS = [
//   ["24/7", "AI replies"],
//   ["Meta", "WhatsApp API"],
//   ["CSV", "lead import"],
//   ["7 days", "free trial"],
// ];

// /* City silhouette with a warm dusk glow — stands in for the landing photo. */
// function CityBackdrop() {
//   const towers = [
//     [0, 300, 90],
//     [80, 220, 70],
//     [140, 340, 80],
//     [215, 260, 60],
//     [640, 200, 90],
//     [725, 280, 70],
//     [790, 160, 100],
//     [885, 300, 80],
//   ];
//   return (
//     <div aria-hidden="true" className="pointer-events-none absolute inset-0">
//       <div className="absolute inset-0 bg-[radial-gradient(700px_380px_at_50%_0%,rgba(245,165,36,.16),transparent_70%),linear-gradient(180deg,#0b2b27_0%,#06201d_60%,#041513_100%)]" />
//       <svg
//         viewBox="0 0 960 520"
//         preserveAspectRatio="xMidYMax slice"
//         className="absolute inset-x-0 bottom-0 h-full w-full opacity-70"
//       >
//         {towers.map(([x, h, w], i) => (
//           <g key={i}>
//             <rect x={x} y={520 - h} width={w} height={h} fill="#0c2f2a" />
//             {Array.from({ length: Math.floor(h / 28) }).map((_, r) =>
//               Array.from({ length: Math.floor(w / 18) }).map((__, c) =>
//                 (r * 5 + c * 3 + i) % 4 === 0 ? (
//                   <rect
//                     key={`${r}-${c}`}
//                     x={x + 7 + c * 18}
//                     y={520 - h + 12 + r * 28}
//                     width="6"
//                     height="10"
//                     fill="#f5a524"
//                     opacity="0.28"
//                   />
//                 ) : null,
//               ),
//             )}
//           </g>
//         ))}
//       </svg>
//       <div className="absolute inset-0 bg-gradient-to-r from-[#06201d]/80 via-transparent to-[#06201d]/60" />
//     </div>
//   );
// }

// /* Light dashboard card, cropped at the bottom like the landing hero. */
// function DashboardPeek() {
//   return (
//     <div className="relative mt-6 max-w-[620px] [@media(max-height:700px)]:hidden overflow-hidden rounded-t-2xl border border-white/10 bg-lp-paper shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]">
//       <div className="flex items-center gap-1.5 border-b border-slate-200/70 px-4 py-2.5">
//         <span className="h-2 w-2 rounded-full bg-red-400" />
//         <span className="h-2 w-2 rounded-full bg-amber-400" />
//         <span className="h-2 w-2 rounded-full bg-emerald-400" />
//         <span className="ml-3 rounded-full bg-lp-teal/10 px-3 py-0.5 text-[10px] font-medium text-lp-tealdark">
//           app.visitsly.com/dashboard
//         </span>
//       </div>
//       <div className="grid grid-cols-[150px_1fr] gap-4 p-4">
//         <div className="rounded-xl bg-white p-3 shadow-sm">
//           <p className="text-[10px] font-semibold text-slate-500">
//             Lead status
//           </p>
//           <svg
//             viewBox="0 0 36 36"
//             className="mx-auto mt-2 h-20 w-20 -rotate-90"
//             aria-hidden="true"
//           >
//             <circle
//               cx="18"
//               cy="18"
//               r="14"
//               fill="none"
//               stroke="#e5ecea"
//               strokeWidth="5"
//             />
//             <circle
//               cx="18"
//               cy="18"
//               r="14"
//               fill="none"
//               stroke="#0fb5a0"
//               strokeWidth="5"
//               strokeDasharray="56 88"
//               strokeLinecap="round"
//             />
//             <circle
//               cx="18"
//               cy="18"
//               r="14"
//               fill="none"
//               stroke="#f5a524"
//               strokeWidth="5"
//               strokeDasharray="14 88"
//               strokeDashoffset="-60"
//               strokeLinecap="round"
//             />
//           </svg>
//         </div>
//         <div className="rounded-xl bg-white p-3 shadow-sm">
//           <p className="text-[10px] font-semibold text-slate-500">
//             Replies this week
//           </p>
//           <svg
//             viewBox="0 0 200 70"
//             className="mt-2 h-20 w-full"
//             aria-hidden="true"
//           >
//             <defs>
//               <linearGradient id="peek-area" x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="0" stopColor="#0fb5a0" stopOpacity=".35" />
//                 <stop offset="1" stopColor="#0fb5a0" stopOpacity="0" />
//               </linearGradient>
//             </defs>
//             <path
//               d="M0 60 L30 52 L60 54 L95 40 L130 36 L165 22 L200 10 V70 H0Z"
//               fill="url(#peek-area)"
//             />
//             <path
//               d="M0 60 L30 52 L60 54 L95 40 L130 36 L165 22 L200 10"
//               fill="none"
//               stroke="#0fb5a0"
//               strokeWidth="1.8"
//             />
//           </svg>
//         </div>
//       </div>
//       <div className="px-4 pb-6">
//         {["New WhatsApp inquiry", "Site visit confirmed"].map((row, i) => (
//           <div
//             key={row}
//             className="mb-2 flex items-center justify-between rounded-lg bg-lp-card px-3 py-2 text-[11px] text-lp-ink"
//           >
//             <span className="font-medium">{row}</span>
//             <span
//               className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${i ? "bg-lp-teal/15 text-lp-tealdark" : "bg-lp-amber/25 text-amber-800"}`}
//             >
//               {i ? "Done" : "New"}
//             </span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* Keeps the auth card fully visible on any desktop screen height:
//    if the card is taller than the space available, it is scaled down to fit. */
// function FitCard({ children }) {
//   const areaRef = useRef(null);
//   const cardRef = useRef(null);
//   const [fit, setFit] = useState({ scale: 1, height: null });

//   useLayoutEffect(() => {
//     const measure = () => {
//       const area = areaRef.current;
//       const card = cardRef.current;
//       if (!area || !card) return;
//       if (window.innerWidth < 1024) {
//         setFit({ scale: 1, height: null });
//         return;
//       }
//       const style = window.getComputedStyle(area);
//       const avail =
//         area.clientHeight -
//         parseFloat(style.paddingTop) -
//         parseFloat(style.paddingBottom);
//       const natural = card.offsetHeight;
//       const scale = Math.max(0.5, Math.min(1, avail / natural));
//       setFit({ scale, height: natural * scale });
//     };
//     measure();
//     const ro = new ResizeObserver(measure);
//     ro.observe(cardRef.current);
//     ro.observe(areaRef.current);
//     window.addEventListener("resize", measure);
//     return () => {
//       ro.disconnect();
//       window.removeEventListener("resize", measure);
//     };
//   }, []);

//   return (
//     <main
//       ref={areaRef}
//       className="flex items-center justify-center px-4 pb-8 pt-20 sm:px-8 sm:pt-24 lg:min-h-0 lg:overflow-hidden lg:px-[3.5vw] lg:pb-5 lg:pt-[84px]"
//     >
//       <div
//         className="w-full max-w-[540px]"
//         style={{ height: fit.height ?? "auto" }}
//       >
//         <div
//           ref={cardRef}
//           style={{
//             transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined,
//             transformOrigin: "top center",
//           }}
//           className="w-full rounded-[28px] bg-lp-paper p-6 shadow-[0_40px_90px_-20px_rgba(0,0,0,.55)] ring-1 ring-white/30 sm:p-9 lg:[@media(max-height:820px)]:p-6"
//         >
//           {children}
//         </div>
//       </div>
//     </main>
//   );
// }

// export default function AuthLayout() {
//   // Respect configured white-label branding; Visitsly is the default brand.
//   const [brand, setBrand] = useState(null);
//   const { pathname } = useLocation();

//   useEffect(() => {
//     let active = true;
//     publicApi
//       .branding(window.location.host)
//       .then((response) => {
//         if (active) setBrand(response.data.branding);
//       })
//       .catch(() => {});
//     return () => {
//       active = false;
//     };
//   }, []);

//   const configuredName = brand?.productName?.trim();
//   // Treat the previous hard-coded product name as legacy branding.
//   const name =
//     configuredName && configuredName.toLowerCase() !== "propai"
//       ? configuredName
//       : "Visitsly";

//   const onSignup = pathname.startsWith("/signup");

//   return (
//     <div className="min-h-screen bg-lp-paper p-2 sm:p-3 lg:h-screen lg:min-h-0 lg:overflow-hidden">
//       <div className="relative min-h-[calc(100dvh-1rem)] overflow-hidden rounded-[24px] bg-lp-ink sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-[32px] lg:h-[calc(100dvh-1.5rem)] lg:min-h-0">
//         <CityBackdrop />

//         {/* ───────── pill navigation ───────── */}
//         <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
//           <Link
//             to="/pricing"
//             aria-label={`${name} home`}
//             className="rounded-full bg-white px-3.5 py-2 shadow-lg shadow-black/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-lp-teal/40"
//           >
//             <BrandMark logoUrl={brand?.logoUrl} name={name} size="sm" />
//           </Link>

//           {/* <nav
//             aria-label="Primary"
//             className="hidden items-center gap-1 rounded-full bg-white/95 p-1.5 shadow-lg shadow-black/20 lg:flex"
//           >
//             {NAV.map((item, i) => (
//               <Link
//                 key={item.label}
//                 to={item.to}
//                 className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${i === 0 ? "bg-lp-card text-lp-ink" : "text-slate-600 hover:text-lp-ink"}`}
//               >
//                 {item.label}
//               </Link>
//             ))}
//           </nav> */}

//           <div className="hidden items-center gap-2 sm:flex">
//             <Link
//               to="/login"
//               className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/20 transition ${onSignup ? "bg-white text-lp-ink hover:bg-lp-card" : "bg-white text-lp-ink ring-2 ring-lp-teal"}`}
//             >
//               Login
//             </Link>
//             <Link
//               to="/signup"
//               className="rounded-full bg-lp-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-lp-teal/30 transition hover:bg-lp-tealdark"
//             >
//               Create account
//             </Link>
//           </div>
//         </header>

//         <div className="relative z-10 grid min-h-[inherit] lg:h-full lg:min-h-0 lg:grid-cols-[1.1fr_0.9fr]">
//           {/* ───────── hero copy (desktop) ───────── */}
//           <section className="hidden min-h-0 flex-col justify-between overflow-hidden pl-[6vw] pr-6 pt-[clamp(5.5rem,13vh,8rem)] lg:flex">
//             <div>
//               <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur">
//                 <span className="h-2 w-2 rounded-full bg-lp-teal" />
//                 WhatsApp CRM for property teams
//               </p>
//               <h2 className="mt-[2.4vh] font-display text-[clamp(38px,min(8vh,5.2vw),80px)] font-extrabold leading-[1] tracking-[-0.03em] text-white [word-spacing:0.06em]">
//                 Your leads.
//                 <br />
//                 <span className="text-lp-mint">Answered today.</span>
//               </h2>
//               <p className="mt-[2.4vh] max-w-[500px] text-[clamp(13px,1.9vh,16px)] leading-[1.6] text-white/70">
//                 WhatsApp inquiries, AI replies, property matching and site
//                 visits — all in one CRM built for brokers, builders and
//                 agencies.
//               </p>
//               <dl className="mt-[3vh] flex flex-wrap gap-x-9 gap-y-3">
//                 {STATS.map(([value, label]) => (
//                   <div key={value} className="flex items-baseline gap-2">
//                     <dt className="font-display text-xl font-extrabold tracking-[-0.03em] text-white">
//                       {value}
//                     </dt>
//                     <dd className="text-xs text-white/50">{label}</dd>
//                   </div>
//                 ))}
//               </dl>
//             </div>
//             <DashboardPeek />
//           </section>

//           {/* ───────── auth card ───────── */}
//           <FitCard>
//             <Outlet />
//           </FitCard>
//         </div>
//       </div>
//     </div>
//   );
// }

// import { useEffect, useLayoutEffect, useRef, useState } from "react";
// import { Outlet, Link, useLocation } from "react-router-dom";
// import { publicApi } from "../api/saasApi.js";
// import { BrandMark } from "../features/auth/AuthParts.jsx";

// // Point these at your landing-page sections if they live on another site.
// const NAV = [
//   { label: "Home", to: "https://visitsly.com" },
//   { label: "Platform", to: "https://visitsly.com" },
//   { label: "Pricing", to: "https://visitsly.com" },
//   { label: "FAQ", to: "https://visitsly.com" },
// ];

// const STATS = [
//   ["24/7", "AI replies"],
//   ["Meta", "WhatsApp API"],
//   ["CSV", "lead import"],
//   ["7 days", "free trial"],
// ];

// /* City silhouette with a warm dusk glow — stands in for the landing photo. */
// function CityBackdrop() {
//   const towers = [
//     [0, 300, 90],
//     [80, 220, 70],
//     [140, 340, 80],
//     [215, 260, 60],
//     [640, 200, 90],
//     [725, 280, 70],
//     [790, 160, 100],
//     [885, 300, 80],
//   ];
//   return (
//     <div aria-hidden="true" className="pointer-events-none absolute inset-0">
//       <div className="absolute inset-0 bg-[radial-gradient(700px_380px_at_50%_0%,rgba(245,165,36,.16),transparent_70%),linear-gradient(180deg,#0b2b27_0%,#06201d_60%,#041513_100%)]" />
//       <svg
//         viewBox="0 0 960 520"
//         preserveAspectRatio="xMidYMax slice"
//         className="absolute inset-x-0 bottom-0 h-full w-full opacity-70"
//       >
//         {towers.map(([x, h, w], i) => (
//           <g key={i}>
//             <rect x={x} y={520 - h} width={w} height={h} fill="#0c2f2a" />
//             {Array.from({ length: Math.floor(h / 28) }).map((_, r) =>
//               Array.from({ length: Math.floor(w / 18) }).map((__, c) =>
//                 (r * 5 + c * 3 + i) % 4 === 0 ? (
//                   <rect
//                     key={`${r}-${c}`}
//                     x={x + 7 + c * 18}
//                     y={520 - h + 12 + r * 28}
//                     width="6"
//                     height="10"
//                     fill="#f5a524"
//                     opacity="0.28"
//                   />
//                 ) : null,
//               ),
//             )}
//           </g>
//         ))}
//       </svg>
//       <div className="absolute inset-0 bg-gradient-to-r from-[#06201d]/80 via-transparent to-[#06201d]/60" />
//     </div>
//   );
// }

// /* Light dashboard card, cropped at the bottom like the landing hero. */
// function DashboardPeek() {
//   return (
//     <div className="relative mt-6 max-w-[620px] [@media(max-height:700px)]:hidden overflow-hidden rounded-t-2xl border border-white/10 bg-lp-paper shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]">
//       <div className="flex items-center gap-1.5 border-b border-slate-200/70 px-4 py-2.5">
//         <span className="h-2 w-2 rounded-full bg-red-400" />
//         <span className="h-2 w-2 rounded-full bg-amber-400" />
//         <span className="h-2 w-2 rounded-full bg-emerald-400" />
//         <span className="ml-3 rounded-full bg-lp-teal/10 px-3 py-0.5 text-[10px] font-medium text-lp-tealdark">
//           app.visitsly.com/dashboard
//         </span>
//       </div>
//       <div className="grid grid-cols-[150px_1fr] gap-4 p-4">
//         <div className="rounded-xl bg-white p-3 shadow-sm">
//           <p className="text-[10px] font-semibold text-slate-500">
//             Lead status
//           </p>
//           <svg
//             viewBox="0 0 36 36"
//             className="mx-auto mt-2 h-20 w-20 -rotate-90"
//             aria-hidden="true"
//           >
//             <circle
//               cx="18"
//               cy="18"
//               r="14"
//               fill="none"
//               stroke="#e5ecea"
//               strokeWidth="5"
//             />
//             <circle
//               cx="18"
//               cy="18"
//               r="14"
//               fill="none"
//               stroke="#0fb5a0"
//               strokeWidth="5"
//               strokeDasharray="56 88"
//               strokeLinecap="round"
//             />
//             <circle
//               cx="18"
//               cy="18"
//               r="14"
//               fill="none"
//               stroke="#f5a524"
//               strokeWidth="5"
//               strokeDasharray="14 88"
//               strokeDashoffset="-60"
//               strokeLinecap="round"
//             />
//           </svg>
//         </div>
//         <div className="rounded-xl bg-white p-3 shadow-sm">
//           <p className="text-[10px] font-semibold text-slate-500">
//             Replies this week
//           </p>
//           <svg
//             viewBox="0 0 200 70"
//             className="mt-2 h-20 w-full"
//             aria-hidden="true"
//           >
//             <defs>
//               <linearGradient id="peek-area" x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="0" stopColor="#0fb5a0" stopOpacity=".35" />
//                 <stop offset="1" stopColor="#0fb5a0" stopOpacity="0" />
//               </linearGradient>
//             </defs>
//             <path
//               d="M0 60 L30 52 L60 54 L95 40 L130 36 L165 22 L200 10 V70 H0Z"
//               fill="url(#peek-area)"
//             />
//             <path
//               d="M0 60 L30 52 L60 54 L95 40 L130 36 L165 22 L200 10"
//               fill="none"
//               stroke="#0fb5a0"
//               strokeWidth="1.8"
//             />
//           </svg>
//         </div>
//       </div>
//       <div className="px-4 pb-6">
//         {["New WhatsApp inquiry", "Site visit confirmed"].map((row, i) => (
//           <div
//             key={row}
//             className="mb-2 flex items-center justify-between rounded-lg bg-lp-card px-3 py-2 text-[11px] text-lp-ink"
//           >
//             <span className="font-medium">{row}</span>
//             <span
//               className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${i ? "bg-lp-teal/15 text-lp-tealdark" : "bg-lp-amber/25 text-amber-800"}`}
//             >
//               {i ? "Done" : "New"}
//             </span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* Keeps the auth card fully visible on any desktop screen height:
//    if the card is taller than the space available, it is scaled down to fit. */
// function FitCard({ children, wide = false }) {
//   const areaRef = useRef(null);
//   const cardRef = useRef(null);
//   const [fit, setFit] = useState({ scale: 1, height: null });

//   useLayoutEffect(() => {
//     const measure = () => {
//       const area = areaRef.current;
//       const card = cardRef.current;
//       if (!area || !card) return;
//       if (window.innerWidth < 1024) {
//         setFit({ scale: 1, height: null });
//         return;
//       }
//       const style = window.getComputedStyle(area);
//       const avail =
//         area.clientHeight -
//         parseFloat(style.paddingTop) -
//         parseFloat(style.paddingBottom);
//       const natural = card.offsetHeight;
//       const scale = Math.max(0.5, Math.min(1, avail / natural));
//       setFit({ scale, height: natural * scale });
//     };
//     measure();
//     const ro = new ResizeObserver(measure);
//     ro.observe(cardRef.current);
//     ro.observe(areaRef.current);
//     window.addEventListener("resize", measure);
//     return () => {
//       ro.disconnect();
//       window.removeEventListener("resize", measure);
//     };
//   }, []);

//   return (
//     <main
//       ref={areaRef}
//       className="flex items-center justify-center px-4 pb-8 pt-20 sm:px-8 sm:pt-24 lg:min-h-0 lg:overflow-hidden lg:px-[3.5vw] lg:pb-5 lg:pt-[84px]"
//     >
//       <div
//         className={`w-full ${wide ? "max-w-[720px]" : "max-w-[540px]"}`}
//         style={{ height: fit.height ?? "auto" }}
//       >
//         <div
//           ref={cardRef}
//           style={{
//             transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined,
//             transformOrigin: "top center",
//           }}
//           className="w-full rounded-[28px] bg-lp-paper p-6 shadow-[0_40px_90px_-20px_rgba(0,0,0,.55)] ring-1 ring-white/30 sm:p-9 lg:[@media(max-height:820px)]:p-6"
//         >
//           {children}
//         </div>
//       </div>
//     </main>
//   );
// }

// export default function AuthLayout() {
//   // Respect configured white-label branding; Visitsly is the default brand.
//   const [brand, setBrand] = useState(null);
//   const { pathname } = useLocation();

//   useEffect(() => {
//     let active = true;
//     publicApi
//       .branding(window.location.host)
//       .then((response) => {
//         if (active) setBrand(response.data.branding);
//       })
//       .catch(() => {});
//     return () => {
//       active = false;
//     };
//   }, []);

//   const configuredName = brand?.productName?.trim();
//   // Treat the previous hard-coded product name as legacy branding.
//   const name =
//     configuredName && configuredName.toLowerCase() !== "propai"
//       ? configuredName
//       : "Visitsly";

//   const onSignup = pathname.startsWith("/signup");

//   return (
//     <div className="min-h-screen bg-lp-paper p-2 sm:p-3 lg:h-screen lg:min-h-0 lg:overflow-hidden">
//       <div className="relative min-h-[calc(100dvh-1rem)] overflow-hidden rounded-[24px] bg-lp-ink sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-[32px] lg:h-[calc(100dvh-1.5rem)] lg:min-h-0">
//         <CityBackdrop />

//         {/* ───────── pill navigation ───────── */}
//         <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
//           <Link
//             to="/pricing"
//             aria-label={`${name} home`}
//             className="rounded-full bg-white px-3.5 py-2 shadow-lg shadow-black/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-lp-teal/40"
//           >
//             <BrandMark logoUrl={brand?.logoUrl} name={name} size="sm" />
//           </Link>

//           <nav
//             aria-label="Primary"
//             className="hidden items-center gap-1 rounded-full bg-white/95 p-1.5 shadow-lg shadow-black/20 lg:flex"
//           >
//             {NAV.map((item, i) => (
//               <Link
//                 key={item.label}
//                 to={item.to}
//                 className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${i === 0 ? "bg-lp-card text-lp-ink" : "text-slate-600 hover:text-lp-ink"}`}
//               >
//                 {item.label}
//               </Link>
//             ))}
//           </nav>

//           <div className="hidden items-center gap-2 sm:flex">
//             <Link
//               to="/login"
//               className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/20 transition ${onSignup ? "bg-white text-lp-ink hover:bg-lp-card" : "bg-white text-lp-ink ring-2 ring-lp-teal"}`}
//             >
//               Login
//             </Link>
//             <Link
//               to="/signup"
//               className="rounded-full bg-lp-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-lp-teal/30 transition hover:bg-lp-tealdark"
//             >
//               Create account
//             </Link>
//           </div>
//         </header>

//         <div
//           className={`relative z-10 grid min-h-[inherit] lg:h-full lg:min-h-0 ${onSignup ? "lg:grid-cols-[0.9fr_1.1fr]" : "lg:grid-cols-[1.1fr_0.9fr]"}`}
//         >
//           {/* ───────── hero copy (desktop) ───────── */}
//           <section className="hidden min-h-0 flex-col justify-between overflow-hidden pl-[6vw] pr-6 pt-[clamp(5.5rem,13vh,8rem)] lg:flex">
//             <div>
//               <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur">
//                 <span className="h-2 w-2 rounded-full bg-lp-teal" />
//                 WhatsApp CRM for property teams
//               </p>
//               <h2 className="mt-[2.4vh] font-display text-[clamp(38px,min(8vh,5.2vw),80px)] font-extrabold leading-[1] tracking-[-0.03em] text-white [word-spacing:0.06em]">
//                 Your leads.
//                 <br />
//                 <span className="text-lp-mint">Answered today.</span>
//               </h2>
//               <p className="mt-[2.4vh] max-w-[500px] text-[clamp(13px,1.9vh,16px)] leading-[1.6] text-white/70">
//                 WhatsApp inquiries, AI replies, property matching and site
//                 visits — all in one CRM built for brokers, builders and
//                 agencies.
//               </p>
//               <dl className="mt-[3vh] flex flex-wrap gap-x-9 gap-y-3">
//                 {STATS.map(([value, label]) => (
//                   <div key={value} className="flex items-baseline gap-2">
//                     <dt className="font-display text-xl font-extrabold tracking-[-0.03em] text-white">
//                       {value}
//                     </dt>
//                     <dd className="text-xs text-white/50">{label}</dd>
//                   </div>
//                 ))}
//               </dl>
//             </div>
//             <DashboardPeek />
//           </section>

//           {/* ───────── auth card ───────── */}
//           <FitCard wide={onSignup}>
//             <Outlet />
//           </FitCard>
//         </div>
//       </div>
//     </div>
//   );
// }

//====================================================================

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { publicApi } from "../api/saasApi.js";
import { BrandMark } from "../features/auth/AuthParts.jsx";

// Point these at your landing-page sections if they live on another site.
const NAV = [
  { label: "Home", to: "https://visitsly.com" },
  { label: "Platform", to: "https://visitsly.com" },
  { label: "Pricing", to: "https://visitsly.com" },
  { label: "FAQ", to: "https://visitsly.com" },
];

const STATS = [
  ["24/7", "AI replies"],
  ["Meta", "WhatsApp API"],
  ["CSV", "lead import"],
  ["7 days", "free trial"],
];

/* City silhouette with a warm dusk glow — stands in for the landing photo. */
function CityBackdrop() {
  const towers = [
    [0, 300, 90],
    [80, 220, 70],
    [140, 340, 80],
    [215, 260, 60],
    [640, 200, 90],
    [725, 280, 70],
    [790, 160, 100],
    [885, 300, 80],
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(700px_380px_at_50%_0%,rgba(245,165,36,.16),transparent_70%),linear-gradient(180deg,#0b2b27_0%,#06201d_60%,#041513_100%)]" />
      <svg
        viewBox="0 0 960 520"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-full w-full opacity-70"
      >
        {towers.map(([x, h, w], i) => (
          <g key={i}>
            <rect x={x} y={520 - h} width={w} height={h} fill="#0c2f2a" />
            {Array.from({ length: Math.floor(h / 28) }).map((_, r) =>
              Array.from({ length: Math.floor(w / 18) }).map((__, c) =>
                (r * 5 + c * 3 + i) % 4 === 0 ? (
                  <rect
                    key={`${r}-${c}`}
                    x={x + 7 + c * 18}
                    y={520 - h + 12 + r * 28}
                    width="6"
                    height="10"
                    fill="#f5a524"
                    opacity="0.28"
                  />
                ) : null,
              ),
            )}
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-[#06201d]/80 via-transparent to-[#06201d]/60" />
    </div>
  );
}

/* Light dashboard card, cropped at the bottom like the landing hero. */
function DashboardPeek() {
  return (
    <div className="relative mt-4 max-w-[560px] [@media(max-height:700px)]:hidden overflow-hidden rounded-t-2xl border border-white/10 bg-lp-paper shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)]">
      <div className="flex items-center gap-1.5 border-b border-slate-200/70 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-3 rounded-full bg-lp-teal/10 px-3 py-0.5 text-[10px] font-medium text-lp-tealdark">
          app.visitsly.com/dashboard
        </span>
      </div>
      <div className="grid grid-cols-[130px_1fr] gap-3 p-3">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-slate-500">
            Lead status
          </p>
          <svg
            viewBox="0 0 36 36"
            className="mx-auto mt-1 h-16 w-16 -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#e5ecea"
              strokeWidth="5"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#0fb5a0"
              strokeWidth="5"
              strokeDasharray="56 88"
              strokeLinecap="round"
            />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#f5a524"
              strokeWidth="5"
              strokeDasharray="14 88"
              strokeDashoffset="-60"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-slate-500">
            Replies this week
          </p>
          <svg
            viewBox="0 0 200 70"
            className="mt-1 h-16 w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="peek-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#0fb5a0" stopOpacity=".35" />
                <stop offset="1" stopColor="#0fb5a0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 60 L30 52 L60 54 L95 40 L130 36 L165 22 L200 10 V70 H0Z"
              fill="url(#peek-area)"
            />
            <path
              d="M0 60 L30 52 L60 54 L95 40 L130 36 L165 22 L200 10"
              fill="none"
              stroke="#0fb5a0"
              strokeWidth="1.8"
            />
          </svg>
        </div>
      </div>
      <div className="px-3 pb-4">
        {["New WhatsApp inquiry", "Site visit confirmed"].map((row, i) => (
          <div
            key={row}
            className="mb-1.5 flex items-center justify-between rounded-lg bg-lp-card px-3 py-1.5 text-[11px] text-lp-ink"
          >
            <span className="font-medium">{row}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${i ? "bg-lp-teal/15 text-lp-tealdark" : "bg-lp-amber/25 text-amber-800"}`}
            >
              {i ? "Done" : "New"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Keeps the auth card fully visible on any desktop screen height:
   if the card is taller than the space available, it is scaled down to fit. */
function FitCard({ children, wide = false }) {
  const areaRef = useRef(null);
  const cardRef = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: null });

  useLayoutEffect(() => {
    const measure = () => {
      const area = areaRef.current;
      const card = cardRef.current;
      if (!area || !card) return;
      if (window.innerWidth < 1024) {
        setFit({ scale: 1, height: null });
        return;
      }
      const style = window.getComputedStyle(area);
      const avail =
        area.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      const natural = card.offsetHeight;
      const scale = Math.max(0.5, Math.min(1, avail / natural));
      setFit({ scale, height: natural * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cardRef.current);
    ro.observe(areaRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <main
      ref={areaRef}
      className="flex items-center justify-center px-4 pb-8 pt-20 sm:px-8 sm:pt-24 lg:min-h-0 lg:overflow-hidden lg:px-[3.5vw] lg:pb-5 lg:pt-[84px]"
    >
      <div
        className={`w-full ${wide ? "max-w-[720px]" : "max-w-[540px]"}`}
        style={{ height: fit.height ?? "auto" }}
      >
        <div
          ref={cardRef}
          style={{
            transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined,
            transformOrigin: "top center",
          }}
          className="w-full rounded-[28px] bg-lp-paper p-6 shadow-[0_40px_90px_-20px_rgba(0,0,0,.55)] ring-1 ring-white/30 sm:p-9 lg:[@media(max-height:820px)]:p-6"
        >
          {children}
        </div>
      </div>
    </main>
  );
}

export default function AuthLayout() {
  // Respect configured white-label branding; Visitsly is the default brand.
  const [brand, setBrand] = useState(null);
  const { pathname } = useLocation();

  useEffect(() => {
    let active = true;
    publicApi
      .branding(window.location.host)
      .then((response) => {
        if (active) setBrand(response.data.branding);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const configuredName = brand?.productName?.trim();
  // Treat the previous hard-coded product name as legacy branding.
  const name =
    configuredName && configuredName.toLowerCase() !== "propai"
      ? configuredName
      : "Visitsly";

  const onSignup = pathname.startsWith("/signup");

  return (
    <div className="min-h-screen bg-lp-paper p-2 sm:p-3 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <div className="relative min-h-[calc(100dvh-1rem)] overflow-hidden rounded-[24px] bg-lp-ink sm:min-h-[calc(100dvh-1.5rem)] sm:rounded-[32px] lg:h-[calc(100dvh-1.5rem)] lg:min-h-0">
        <CityBackdrop />

        {/* ───────── pill navigation ───────── */}
        <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
          <Link
            to="/pricing"
            aria-label={`${name} home`}
            className="rounded-full bg-white px-3.5 py-2 shadow-lg shadow-black/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-lp-teal/40"
          >
            <BrandMark logoUrl={brand?.logoUrl} name={name} size="sm" />
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 rounded-full bg-white/95 p-1.5 shadow-lg shadow-black/20 lg:flex"
          >
            {NAV.map((item, i) => (
              <Link
                key={item.label}
                to={item.to}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${i === 0 ? "bg-lp-card text-lp-ink" : "text-slate-600 hover:text-lp-ink"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/login"
              className={`rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg shadow-black/20 transition ${onSignup ? "bg-white text-lp-ink hover:bg-lp-card" : "bg-white text-lp-ink ring-2 ring-lp-teal"}`}
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-lp-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-lp-teal/30 transition hover:bg-lp-tealdark"
            >
              Create account
            </Link>
          </div>
        </header>

        <div
          className={`relative z-10 grid min-h-[inherit] lg:h-full lg:min-h-0 ${onSignup ? "lg:grid-cols-[0.9fr_1.1fr]" : "lg:grid-cols-[1.1fr_0.9fr]"}`}
        >
          {/* ───────── hero copy (desktop) ───────── */}
          <section className="hidden min-h-0 flex-col justify-between overflow-hidden pl-[6vw] pr-6 pt-[clamp(5.5rem,13vh,8rem)] lg:flex">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-lp-teal" />
                WhatsApp CRM for property teams
              </p>
              <h2 className="mt-[2.4vh] font-display text-[clamp(38px,min(8vh,5.2vw),80px)] font-extrabold leading-[1] tracking-[-0.03em] text-white [word-spacing:0.06em]">
                Your leads.
                <br />
                <span className="text-lp-mint">Answered today.</span>
              </h2>
              <p className="mt-[2.4vh] max-w-[500px] text-[clamp(13px,1.9vh,16px)] leading-[1.6] text-white/70">
                WhatsApp inquiries, AI replies, property matching and site
                visits — all in one CRM built for brokers, builders and
                agencies.
              </p>
              <dl className="mt-[3vh] grid max-w-[520px] grid-cols-4 gap-4">
                {STATS.map(([value, label]) => (
                  <div key={value}>
                    <dt className="font-display text-[clamp(16px,2.6vh,22px)] font-extrabold tracking-[-0.03em] text-white">
                      {value}
                    </dt>
                    <dd className="mt-0.5 text-xs text-white/50">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <DashboardPeek />
          </section>

          {/* ───────── auth card ───────── */}
          <FitCard wide={onSignup}>
            <Outlet />
          </FitCard>
        </div>
      </div>
    </div>
  );
}
