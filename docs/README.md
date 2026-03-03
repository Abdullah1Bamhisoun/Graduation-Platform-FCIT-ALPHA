# Graduation Platform FCIT — Alpha

A full-stack web platform for managing graduation projects at the Faculty of Computing and Information Technology (FCIT). It supports the full project lifecycle — from group formation and milestone tracking to submissions, evaluations, and report generation.

---

## Tech Stack

### Frontend
- **React 18** + **TypeScript** with **Vite**
- **Tailwind CSS** + **Radix UI** components
- **React Router v6** for client-side routing
- **React Hook Form** + **Zod** for form validation
- **Recharts** for data visualization
- **Supabase JS** client for real-time data

### Backend
- **Node.js** + **Express** REST API
- **Supabase** (PostgreSQL) as the primary database
- **JWT** authentication with role-based access control
- **BullMQ** + **Redis** for background job queues
- **MinIO** for file/object storage
- **Nodemailer** for email notifications
- **Helmet** + **express-rate-limit** for security

### Infrastructure
- **Docker Compose** for local development (Redis, MinIO, devcontainer)

---

## User Roles

| Role | Description |
|---|---|
| **Admin** | Full platform management, user and settings control |
| **Coordinator** | Oversees groups, milestones, evaluations, and reports |
| **Supervisor** | Mentors assigned student groups, reviews submissions |
| **Student** | Submits work, tracks milestones, views feedback |

---

## Key Features

- **Authentication** — Secure login with JWT and role-based routing
- **Project Groups** — Group creation, member management, and project assignment
- **Milestones** — Define and track graduation project milestones with deadlines
- **Submissions** — File uploads via MinIO, submission history, and status tracking
- **Evaluations & Grading** — Structured evaluation forms with scoring
- **Presentations** — Schedule and manage project presentations
- **Announcements** — Platform-wide and group-targeted announcements
- **Reports** — Generate and export project progress reports
- **Calendar Events** — Shared academic calendar for deadlines and events
- **Week Statuses** — Weekly progress tracking per group
- **Email Notifications** — Automated emails via background job queues

---

## Project Structure

```
.
├── src/                    # React frontend
│   ├── pages/              # Route-level page components
│   │   ├── admin/
│   │   ├── coordinator/
│   │   ├── supervisor/
│   │   └── student/
│   ├── features/           # Feature modules (auth, dashboard, evaluations, etc.)
│   ├── components/         # Shared UI components
│   ├── services/           # API service layer
│   ├── hooks/              # Custom React hooks
│   └── types/              # TypeScript type definitions
│
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API route handlers
│       ├── controllers/    # Business logic
│       ├── middleware/      # Auth, validation, rate limiting
│       ├── services/       # External service integrations
│       ├── jobs/           # BullMQ background jobs
│       ├── migrations/     # Database migration scripts
│       └── config/         # App configuration
│
├── docs/                   # Project documentation
├── docker-compose.yml      # Local infrastructure (Redis, MinIO)
└── package.json            # Root scripts
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Docker & Docker Compose
- A [Supabase](https://supabase.com) project (for database and auth)

### 1. Start infrastructure

```bash
docker-compose up -d
```

This starts Redis and MinIO locally.

### 2. Configure environment variables

Create a `.env` file in `server/` based on the required variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ROOT_USER=your_minio_user
MINIO_ROOT_PASSWORD=your_minio_password
```

### 3. Install dependencies

```bash
npm install
cd server && npm install
```

### 4. Run the platform

```bash
# From the project root — starts both client and server concurrently
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000` (or configured port)
- MinIO Console: `http://localhost:9001`

### 5. Create an admin user

```bash
cd server && npm run create-admin
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run client` | Start frontend only (Vite dev server) |
| `npm run server` | Start backend only (nodemon) |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run lint` | Run ESLint on the frontend source |

---

## License

See [LICENSE](../LICENSE).
