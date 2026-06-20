# Plataforma de Gestión de Grados - UTP

Sistema de gestión integral de procesos de titulación para el Instituto Universitario del Putumayo.

## Descripción del Proyecto

Esta plataforma digital facilita la administración completa de los procesos de grado en sus diferentes modalidades (Tesis, Pasantías, Líneas de Investigación, Diplomados), permitiendo a estudiantes, asesores y personal administrativo colaborar en la presentación y aprobación de documentos requeridos.

## Características Principales

- **Gestión de Modalidades de Grado**: Soporte para múltiples modalidades de titulación con requisitos específicos
- **Seguimiento de Documentos**: Control integral del ciclo de vida de documentos (carga, revisión, aprobación)
- **Firmas Digitales**: Aplicación de firmas digitales a documentos finales
- **Notificaciones**: Sistema de notificaciones en tiempo real para cambios de estado
- **Auditoría**: Registro completo de todas las acciones realizadas en el sistema
- **Autenticación**: Soporte para autenticación local y Google OAuth
- **Control de Acceso**: Roles diferenciados (Estudiante, Asesor, Secretaría, Admin)

## Estructura del Proyecto

```
plataforma-grados-utp/
├── backend/              # API REST con NestJS
│   ├── src/
│   │   ├── modules/      # Módulos de aplicación
│   │   ├── config/       # Configuración
│   │   └── shared/       # Utilidades compartidas
│   ├── prisma/           # Esquema y migraciones
│   ├── test/             # Tests E2E
│   └── Dockerfile        # Imagen Docker
├── frontend/             # Aplicación Angular (pendiente)
├── docs/                 # Documentación
├── docker-compose.yml    # Orquestación en producción
├── docker-compose.dev.yml # Orquestación en desarrollo
└── .env.example          # Variables de entorno plantilla
```

## Requisitos Previos

- **Docker** y **Docker Compose** (para ejecución en contenedores)
- **Node.js** 18+ (para desarrollo local)
- **PostgreSQL** 14+ (si se ejecuta sin Docker)
- **npm** o **yarn**

## Instalación y Setup

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd plataforma-grados-utp
```

### 2. Configurar Variables de Entorno

Copiar el archivo de ejemplo y ajustar valores:

```bash
cp .env.example .env
```

Luego editar `.env` con valores específicos:

```env
DB_PASSWORD=tu_contraseña_segura
JWT_SECRET=tu_secret_jwt_seguro
CORS_ORIGIN=http://localhost:4200
```

Para el backend, copiar también:

```bash
cp backend/.env.example backend/.env
```

### 3. Instalación de Dependencias (Desarrollo Local)

```bash
cd backend
npm install
```

### 4. Inicializar Base de Datos

#### Opción A: Con Docker Compose

```bash
# Desarrollo (incluye pgAdmin y MailHog)
docker-compose -f docker-compose.dev.yml up -d

# Esperar a que PostgreSQL esté listo
sleep 10

# Aplicar migraciones
cd backend
npm run prisma:migrate:dev

# Ejecutar seed para llenar datos iniciales
npm run prisma:seed
```

#### Opción B: Desarrollo Local

```bash
# Asegurarse de que PostgreSQL está corriendo en localhost:5432
psql -U itp_admin -d plataforma_grados

# En el backend
# Usarlos dependiendo de si va a correr de forma local o entorno real
npm run prisma:migrate:dev // npm run prisma:migrate:prod
npm run prisma:seed
```

## Desarrollo

## Inicializar todo el entorno de desarollo (Produccion-Local)
npm run setup:dev

- Esto hará:
- prisma generate → genera el cliente Prisma.
- prisma migrate dev --env-file .env.development → aplica migraciones en tu DB de desarrollo.
- ts-node prisma/seed.ts → ejecuta el script de seed para poblar datos iniciales.


## Inicializar en Desarrollo (Entorno Real)
npm run setup:prod

- Genera cliente Prisma, aplica migraciones en .env.production y corre el seed.

## Ventajas de ambos (Dev-prod):
- Flujo unificado para dev y prod.
- Prisma siempre recibe el .env correcto.
- Tu equipo puede inicializar cualquier entorno con un solo comando.

### Ejecutar Backend en Desarrollo

```bash
cd backend

# Con reloading automático
npm run start:dev

# El servidor estará disponible en http://localhost:3000
```

### Ejecutar en Docker Compose

```bash
# Producción (solo backend + postgres)
docker-compose up -d

# Desarrollo (con pgAdmin y MailHog)
docker-compose -f docker-compose.dev.yml up -d
```

### Acceder a Herramientas de Desarrollo

Con `docker-compose.dev.yml`:

- **pgAdmin**: http://localhost:5050
  - Email: admin@itp.edu.co
  - Contraseña: admin_dev

- **MailHog**: http://localhost:8025
  - Visualizar emails enviados en desarrollo

- **Prisma Studio**: Ejecutar `npm run prisma:studio` (requiere backend en ejecución)

## Migraciones y Seeds

### Crear Nueva Migración

```bash
cd backend
npm run prisma:migrate:dev -- --name descripcion_cambio
```

### Ejecutar Seeds

```bash
cd backend
npm run prisma:seed
```

El seed incluye:
- **Modalidades de Grado**: Tesis, Pasantías, Líneas de Investigación, Diplomados
- **Tipos de Documentos**: 10 tipos predefinidos según modalidades
- **Requisitos por Modalidad**: Mapeo de documentos requeridos
- **Usuarios de Prueba**:
  - SUPERADMIN: `admin@itp.edu.co` / `Admin@2024`
  - SECRETARY: `secretaria@itp.edu.co` / `Secretary@2024`

## Testing

### Unit Tests

```bash
cd backend
npm run test
npm run test:watch      # Con watch mode
npm run test:cov        # Con coverage report
```

### E2E Tests

```bash
cd backend
npm run test:e2e
```
## Despliegue Render
- Frontend: https://grados-uniputumayo-1.onrender.com
- Backend: https://grados-uniputumayo.onrender.com

## API Documentation

La documentación de la API está disponible mediante Swagger:

```bash
# Después de ejecutar el backend
# Swagger disponible en http://localhost:3000/api/docs
```

## Autenticación

### Credenciales de Prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| SUPERADMIN | admin@itp.edu.co | Admin@2024 |
| SECRETARY | secretaria@itp.edu.co | Secretary@2024 |

### Proceso de Login

1. POST `/api/v1/auth/login`
   ```json
   {
     "email": "admin@itp.edu.co",
     "password": "Admin@2024"
   }
   ```

2. Respuesta incluye `accessToken` y `refreshToken`

3. Incluir token en headers: `Authorization: Bearer <token>`

## Configuración de Correo Electrónico

### Desarrollo (MailHog)

MailHog está configurado para capturar todos los emails en desarrollo:
- SMTP: `localhost:1025`
- Web UI: `http://localhost:8025`

### Producción

Para producción, configurar en `.env`:

```env
MAIL_HOST=smtp.tu-proveedor.com
MAIL_PORT=587
MAIL_USER=tu_email@dominio.com
MAIL_PASS=tu_contraseña_app
MAIL_FROM=noreply@itp.edu.co
```

## Firmas Digitales

El sistema soporta firmas digitales en documentos PDF. Para configurar:

1. Generar certificado y clave privada:
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout private-key.pem -out certificate.pem -days 365 -nodes
   ```

2. Colocar archivos en `backend/signatures/`

3. Configurar rutas en `.env`:
   ```env
   SIGNATURE_PRIVATE_KEY_PATH=./signatures/private-key.pem
   SIGNATURE_CERT_PATH=./signatures/certificate.pem
   ```

## Variables de Entorno

### Archivo `.env` (proyecto root)

```env
# Credenciales de base de datos
DB_PASSWORD=itp_dev_2024

# JWT Secret para backend
JWT_SECRET=dev-secret-change-in-production-itp-2024

# CORS
CORS_ORIGIN=http://localhost:4200
```

### Archivo `backend/.env`

Ver sección completa en `backend/.env.example`

Principales variables:
- `DATABASE_URL`: Conexión PostgreSQL
- `JWT_SECRET` y `JWT_EXPIRATION`: Token JWT
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: OAuth Google
- `MAIL_*`: Configuración de correo
- `UPLOAD_DIR`: Directorio de uploads
- `SIGNATURE_*`: Configuración de firmas digitales
- `ITP_API_*`: APIs externas
- `LOG_LEVEL`: Nivel de logging

## Logs y Debugging

### Nivel de Log

Configurar en `.env`:

```env
LOG_LEVEL=debug     # debug, info, warn, error
```

### Prisma Logging

Activar logging de Prisma:

```env
DATABASE_LOGGING=true
```

## Comandos Útiles

```bash
# Backend
npm run build              # Compilar
npm run start              # Ejecutar en producción
npm run start:dev          # Ejecutar en desarrollo
npm run lint               # Linting
npm run format             # Formatear código
npm run prisma:studio      # Abrir Prisma Studio
npm run prisma:generate    # Generar cliente Prisma

# Docker
docker-compose up -d                              # Iniciar producción
docker-compose -f docker-compose.dev.yml up -d   # Iniciar desarrollo
docker-compose logs -f                            # Ver logs
docker-compose down                               # Detener
docker-compose ps                                 # Ver estado
```

## Mantenimiento y Monitoreo

### Health Check

La API incluye endpoint de health check:

```bash
GET /api/v1/health
```

### Revisión de Logs

```bash
# Docker
docker-compose logs -f backend

# Local
npm run start:dev  # Los logs aparecen en consola
```

### Base de Datos

```bash
# Acceder a pgAdmin
# URL: http://localhost:5050
# Credenciales en docker-compose.dev.yml

# O via psql
psql -U itp_admin -d plataforma_grados -h localhost
```

## Solución de Problemas

### Puerto 5432 ya en uso

```bash
# Cambiar puerto en docker-compose o matar proceso
lsof -i :5432
kill -9 <PID>
```

### Errores de Migración

```bash
# Resetear base de datos (CUIDADO: borra datos)
npm run prisma:migrate:dev -- --skip-generate
```

### Cambios en Dockerfile no se reflejan

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Contribución

Para contribuir:

1. Crear rama desde `main`
2. Realizar cambios siguiendo estándares del proyecto
3. Ejecutar tests: `npm run test`
4. Commit con mensajes descriptivos
5. Push y crear Pull Request

## Estándares de Código

- **Lenguaje**: TypeScript
- **Framework Backend**: NestJS
- **ORM**: Prisma
- **Linting**: ESLint
- **Formateo**: Prettier
- **Convención**: Camel case para variables, PascalCase para clases

## Seguridad

- Todas las contraseñas en `.env` son ejemplos, cambiar en producción
- JWT Secret debe ser fuerte y único por entorno
- Database credentials no deben estar en repositorio (usar `.gitignore`)
- Validar todas las entradas del usuario
- Implementar rate limiting en producción

## Licencia

UNLICENSED - Prohibido uso sin autorización

## Contacto y Soporte

Para preguntas o problemas, contactar al equipo de desarrollo de ITP.

---

**Última actualización**: Marzo 2026
**Versión**: 1.0.0
