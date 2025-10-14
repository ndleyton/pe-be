# PersonalBestie Frontend

A React + TypeScript fitness tracking application with local-first guest mode and Google OAuth authentication.

## 🚀 Features

- **Local-First Guest Mode**: Use the app without signing in - all data is stored locally and synced when you authenticate
- **Google OAuth Integration**: Secure authentication with automatic data sync
- **Workout Tracking**: Create workouts, add exercises, and track sets with detailed metrics
- **Exercise Type Management**: Built-in exercise library with the ability to create custom exercises
- **Responsive Design**: Works on desktop and mobile devices
- **Data Persistence**: IndexedDB (with localStorage fallback) for guest mode, secure cloud storage for authenticated users

## 🏃‍♂️ Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables** (see section below)

3. **Start the development server**:

   ```bash
   npm run dev
   ```

4. **Visit the app**: Open your browser to `http://localhost:5173`

## 📱 Guest Mode

The app includes a local-first guest mode that allows users to start tracking workouts immediately without signing in:

### How It Works

- **No Authentication Required**: Click "Try as Guest" on the welcome page
- **Local Storage**: All workout data is stored in your browser's IndexedDB (with an automatic localStorage fallback when necessary)
- **Survives Browser Restarts**: Data persists across browser sessions
- **Automatic Sync**: When you sign in, all local data is automatically uploaded to your account
- **Clean Transition**: After sync, only authenticated data is shown

### What's Stored Locally

- Workouts with start/end times, notes, and workout types
- Exercises with timestamps, notes, and exercise types
- Exercise sets with reps, intensity, rest time, and completion status
- Custom exercise types created while in guest mode

### Data Sync Process

1. User creates workouts/exercises while unauthenticated
2. Data is stored in IndexedDB (object store `keyval`, key `pe-guest-data`)
3. User signs in with Google OAuth
4. App automatically uploads all local data via REST APIs
5. Local cache is cleared after successful sync
6. User now sees their data in their authenticated account

### Guest Mode Banner

When using guest mode, a helpful banner appears at the top of the app:

- Explains that data is stored locally
- Shows count of saved workouts
- Encourages signing in for cross-device sync

## 🔐 Authentication

The app supports Google OAuth for secure authentication:

1. **Sign In**: Click "Sign in with Google" on the welcome page
2. **OAuth Flow**: Redirected to Google for authentication
3. **Data Sync**: Upon return, any guest data is automatically synced
4. **Secure Storage**: All future data is stored securely in the cloud

## 🧪 Testing

### Run Tests

```bash
npm test
```

### Test Coverage

The app includes comprehensive tests for:

- Guest data context and IndexedDB persistence
- Data sync functionality with mocked API calls
- Component rendering with guest/authenticated states
- Form submissions in both modes

## 🏗️ Architecture

### Key Components

- **GuestDataContext**: React context managing local data and sync operations
- **Forms**: WorkoutForm, ExerciseForm, AddExerciseSetForm with dual-mode support
- **Pages**: MyWorkoutsPage and WorkoutPage showing appropriate data based on auth state
- **Sync Utilities**: Functions to upload guest data to server APIs

### Data Flow

```
Guest Mode:
User Input → Forms → GuestDataContext → IndexedDB

Authenticated Mode:
User Input → Forms → API Client → Server Database

Sync Process:
IndexedDB → syncGuestDataToServer() → API Client → Server Database
```

## 🔗 API Endpoints

The frontend uses **nested API endpoints** that follow logical groupings:

```bash
# Exercise-related endpoints
/exercises/exercise-types/     # List and create exercise types
/exercises/intensity-units/    # List and create intensity units

# Workout-related endpoints
/workouts/workout-types/       # List and create workout types

# Other core endpoints
/workouts/                     # CRUD operations for workouts
/exercises/                    # CRUD operations for exercises
/exercise-sets/                # CRUD operations for exercise sets
```

> **Note**: All endpoints are defined in `src/shared/api/endpoints.ts` for type safety and consistency.

## Environment Variables 🛠️

This project relies on Vite's built-in environment system. **Only variables prefixed with `VITE_` are exposed to the browser bundle.**

Create per-environment files at the root of `personalbestie-frontend`:

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
