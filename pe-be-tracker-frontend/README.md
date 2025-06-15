# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Environment Variables 🛠️

This project relies on Vite's built-in environment system. **Only variables prefixed with `VITE_` are exposed to the browser bundle.**

Create per-environment files at the root of `pe-be-tracker-frontend`:

```
.env.development      # loaded while `npm run dev`
.env.production       # loaded when building/previewing the production bundle
.env.local            # values shared across modes, ignored by git
.env.<mode>.local     # mode-specific + git-ignored
```

Minimum required variables (copy/paste and tweak values):

```bash
# Base URL to your FastAPI backend (include /api/v1 if you use versioned routes)
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Timeout for API requests (ms)
VITE_API_TIMEOUT=10000

# Verbose logging of every request/response in the browser console
VITE_ENABLE_LOGGING=true
```

For convenience you can copy `cp env.example .env.development` and edit.

> **Note**: The repository intentionally does not commit any `.env.*` files. Add them locally or via your deployment platform's secret manager.
