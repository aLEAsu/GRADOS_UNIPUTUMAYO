# Plataforma de Grados - Frontend

University degree management platform frontend built with Angular 17+, PrimeNG, and Tailwind CSS.

## Stack

- **Framework**: Angular 17+
- **Component Architecture**: Standalone Components
- **UI Library**: PrimeNG 17+
- **Styling**: Tailwind CSS 3+
- **Language**: TypeScript 5.4+
- **HTTP**: Angular HttpClient with Interceptors
- **Forms**: Angular Reactive Forms
- **Routing**: Angular Router with Lazy Loading

## Project Structure

```
src/
├── app/
│   ├── core/                 # Core services, guards, interceptors
│   │   └── interceptors/
│   ├── shared/               # Shared components, pipes, directives
│   ├── features/             # Feature modules (dashboard, auth, etc.)
│   │   ├── dashboard/
│   │   └── auth/
│   ├── app.component.ts
│   ├── app.routes.ts
│   └── app.component.html
├── assets/                   # Static assets
├── environments/             # Environment configs
├── styles.css               # Global styles
├── index.html               # Entry point
└── main.ts                  # Bootstrap file
```

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm start
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Building

### Development Build

```bash
pnpm run build
```

### Production Build

```bash
pnpm run build:prod
```

The build artifacts will be stored in the `dist/plataforma-grados-utp/` directory.

## Testing

```bash
pnpm test
```

## Code Quality

### Linting

```bash
pnpm run lint
```

## Features

### Authentication
- JWT-based authentication
- Auth interceptor for automatic token injection
- Login and registration components

### Dashboard
- Main application dashboard
- User management interface

### UI/UX
- PrimeNG components for professional UI
- Tailwind CSS for custom styling
- Responsive design
- Dark mode support

## Color Scheme

- **Primary**: #1e40af (Blue 800)
- **Secondary**: #059669 (Emerald 600)
- **Accent**: #d97706 (Amber 600)

### Status Colors

- **Por Cargar**: Gray (#9ca3af)
- **Pendiente**: Yellow (#fbbf24)
- **En Revisión**: Blue (#3b82f6)
- **En Corrección**: Orange (#f97316)
- **Aprobado**: Green (#22c55e)
- **Finalizado**: Emerald (#10b981)

## Environment Variables

Create `.env` files in the root directory:

```bash
# Development
API_URL=http://localhost:3000/api/v1
GOOGLE_CLIENT_ID=your_google_client_id

# Production
API_URL=https://api.plataforma-grados-utp.com/api/v1
```

## Integration with External Student API

- Backend env vars (set in `backend/.env`):
	- `ITP_API_BASE_URL` — base URL of the external student API (e.g. `https://sistema-itp.example.com`).
	- `ITP_API_KEY` — API key used to authenticate requests to the external API.

	- `ITP_INTEGRATION_ENABLED` — `true`/`false`. When `false` (default for development), the backend
		will NOT call the external student API and will allow registered users to create degree processes
		locally for testing. Set to `true` in production to enable real eligibility validation.

- The backend exposes admin endpoints to sync and validate student data:
	- `POST /api/v1/integration/sync-student/:userId` — fetches and updates a student's `StudentProfile` from the external API. Requires `SECRETARY` or `ADMIN` role.
	- `GET /api/v1/integration/student-eligibility/:studentCode` — checks whether the student has completed required subjects. Requires `SECRETARY` or `ADMIN` role.

- Frontend service: `src/app/core/services/integration.service.ts` provides `syncStudentProfile(userId)` and `validateStudentEligibility(studentCode)` helpers that call the backend. Use them from an admin UI and include an admin JWT in requests.

- Quick example (admin):

```bash
curl -X POST "http://localhost:4000/api/v1/integration/sync-student/<USER_ID>" \
	-H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
	-H "Content-Type: application/json"
```

Notes:
- In development you can manually update `student_profiles.has_completed_subjects` via Prisma Studio (`npx prisma studio`) for testing.
- Do not disable the backend business rule that requires completed subjects in production.

## Configuration Files

- `angular.json` - Angular CLI configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `.editorconfig` - Editor configuration
- `.prettierrc` - Code formatter configuration

## Dependencies

### Production

- `@angular/*` - Angular framework packages
- `primeng` - PrimeNG UI component library
- `primeicons` - Icon library
- `tailwindcss` - Utility-first CSS framework
- `rxjs` - Reactive programming library

### Development

- `@angular/cli` - Angular CLI
- `typescript` - TypeScript compiler
- `karma` - Testing framework
- `jasmine` - Testing library

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Create a pull request

## License

This project is private and belongs to the Universidad Tecnológica del Perú.
