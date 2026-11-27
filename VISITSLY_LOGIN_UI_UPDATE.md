# Visitsly login/auth UI update

## Updated files
- `src/features/auth/LoginPage.jsx`: modern SaaS login form, blue/indigo styling, accessible inputs, improved error/loading states and Visitsly branding. Authentication, API calls, session storage and WhatsApp-first redirect logic are preserved.
- `src/layouts/AuthLayout.jsx`: redesigned split layout with Visitsly branding, premium dark product-story panel and a decorative workflow preview. White-label `brand.productName` and `brand.logoUrl` remain supported.
- `src/features/auth/SignupPage.jsx` and `src/features/auth/VerifyEmailPage.jsx`: visible brand copy updated to Visitsly and accent colors aligned to blue.
- Other visible `PropAI` product-name strings in frontend source were changed to `Visitsly`; lower-case internal integration keys/markers (for example `propai:billing`, `__propaiFacebookSdkMarker`, and `propai.cp`) were intentionally preserved to avoid breaking contracts or existing browser storage.
- `index.html`: updated browser title.
- `package.json` and `package-lock.json`: package name aligned to `visitsly-frontend`; dependencies unchanged.

## Validation
- TypeScript parser-based JSX syntax checks passed for all four modified React components.
- Full Vite production build was not run in this environment because frontend dependencies are not installed here.

## Apply
Replace the corresponding files in your frontend source with these updated versions, or use the full frontend ZIP. Install dependencies as usual and run `npm run dev`, then `npm run build` before production deployment.
