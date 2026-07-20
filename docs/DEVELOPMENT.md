# Guía de Desarrollo

Guía para configurar el ambiente de desarrollo local y directrices de codificación.

## Instalación Local

### Requisitos

- **Node.js**: 18.x o superior
- **npm**: 9.x o superior (viene con Node.js)
- **PostgreSQL**: 14+ (si no usas Docker)
- **Git**: Para control de versiones

### Instalación de Node.js

#### Windows/Mac
1. Descargar desde https://nodejs.org/ (LTS recomendado)
2. Ejecutar instalador
3. Instalar pnpm:
   ```bash
   corepack enable
   corepack prepare pnpm@latest --activate
   ```
4. Verificar instalación:
   ```bash
   node --version
   pnpm --version
   ```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install nodejs npm
corepack enable
corepack prepare pnpm@latest --activate

# Verificar versión
node --version
pnpm --version
```

### Clonar Repositorio

```bash
git clone <repository-url>
cd plataforma-grados-utp/backend
```

### Instalar Dependencias

```bash
cd backend
pnpm install

# Para frontend
cd ../frontend
pnpm install
```

### Configurar Base de Datos

#### Opción A: Con Docker (Recomendado)

```bash
# En raíz del proyecto
docker-compose -f docker-compose.dev.yml up -d

# Esperar 10 segundos a que PostgreSQL esté listo
sleep 10

# En la carpeta backend
pnpm run prisma:migrate:dev
pnpm run prisma:seed
```

#### Opción B: PostgreSQL Local

```bash
# Instalar PostgreSQL (si no está instalado)
# macOS
brew install postgresql

# Ubuntu
sudo apt install postgresql

# Crear base de datos
psql -U postgres
CREATE ROLE itp_admin WITH LOGIN PASSWORD 'itp_dev_2024';
CREATE DATABASE plataforma_grados OWNER itp_admin;

# En backend
pnpm run prisma:migrate:dev
pnpm run prisma:seed
```

### Iniciar Servidor de Desarrollo

```bash
cd backend
pnpm run start:dev

# El servidor estará disponible en http://localhost:3000
# Reloading automático cuando cambias archivos
```

## Estructura del Proyecto

```
backend/
├── src/
│   ├── main.ts                  # Punto de entrada
│   ├── app.module.ts            # Módulo principal
│   ├── config/                  # Configuración
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   └── auth.config.ts
│   ├── shared/                  # Código compartido
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   └── modules/                 # Módulos de la aplicación
│       ├── auth/
│       ├── users/
│       ├── admin/
│       ├── degrees/
│       ├── documents/
│       ├── approvals/
│       └── ...
├── prisma/                      # ORM Prisma
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── test/                        # Tests E2E
├── .env                         # Variables de entorno (local)
├── .env.example                 # Template
├── jest.config.js               # Jest configuration
├── tsconfig.json                # TypeScript configuration
├── package.json                 # Dependencias
└── Dockerfile                   # Imagen Docker
```

## Desarrollo de Módulos

### Crear un Nuevo Módulo

```bash
# NestJS CLI crea la estructura automáticamente
npx nest g module modules/nombre-modulo
npx nest g controller modules/nombre-modulo
npx nest g service modules/nombre-modulo
```

Estructura generada:
```
modules/nombre-modulo/
├── nombre-modulo.module.ts
├── nombre-modulo.controller.ts
├── nombre-modulo.service.ts
├── dto/
│   ├── create-nombre-modulo.dto.ts
│   └── update-nombre-modulo.dto.ts
└── nombre-modulo.controller.spec.ts
```

### Ejemplo de Módulo

```typescript
// nombre-modulo.module.ts
import { Module } from '@nestjs/common';
import { NombreModuloController } from './nombre-modulo.controller';
import { NombreModuloService } from './nombre-modulo.service';

@Module({
  controllers: [NombreModuloController],
  providers: [NombreModuloService],
  exports: [NombreModuloService], // Si otros módulos lo necesitan
})
export class NombreModuloModule {}

// nombre-modulo.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/services/prisma.service';

@Injectable()
export class NombreModuloService {
  constructor(private prisma: PrismaService) {}

  async create(data) {
    return this.prisma.model.create({ data });
  }
}

// nombre-modulo.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { NombreModuloService } from './nombre-modulo.service';

@Controller('api/v1/nombre-modulo')
export class NombreModuloController {
  constructor(private service: NombreModuloService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() data) {
    return this.service.create(data);
  }
}
```

## Estándares de Código

### Convenciones de Nombres

```typescript
// Clases: PascalCase
class UserService { }
class UserController { }

// Funciones y variables: camelCase
const getUserById = (id) => { };
const userName = 'John';

// Constantes: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 20;

// Archivos: kebab-case
user.service.ts
user.controller.ts
create-user.dto.ts
```

### Estructura de Archivos

```typescript
// 1. Imports organizados
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/services';  // Imports internos
import { User } from '@prisma/client';              // Imports externos

// 2. Decoradores
@Injectable()
export class UserService {
  // 3. Constructor
  constructor(private prisma: PrismaService) {}

  // 4. Métodos públicos
  async getUser(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // 5. Métodos privados
  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### Type Safety

Siempre usar tipos específicos:

```typescript
// Bien
async getUser(id: string): Promise<User | null> {
  return this.prisma.user.findUnique({ where: { id } });
}

// Evitar
async getUser(id) {
  return this.prisma.user.findUnique({ where: { id } });
}
```

### DTOs (Data Transfer Objects)

```typescript
// create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;
}

// En controller
@Post()
async create(@Body() createUserDto: CreateUserDto) {
  return this.userService.create(createUserDto);
}
```

### Manejo de Errores

```typescript
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new HttpException(
        'Usuario no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  async deleteUser(id: string) {
    try {
      return await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error.code === 'P2025') { // Prisma "not found" error
        throw new HttpException(
          'Usuario no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        'Error interno del servidor',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

## Testing

### Unit Tests

```typescript
// user.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '@shared/services';

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUser', () => {
    it('should return a user', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.getUser('1');
      expect(result).toEqual(mockUser);
    });
  });
});
```

Ejecutar tests:

```bash
npm run test                # Una vez
npm run test:watch          # Con watch
npm run test:cov            # Con coverage
```

### E2E Tests

```typescript
// user.controller.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@app/app.module';

describe('UserController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return a token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@itp.edu.co',
          password: 'Admin@2024',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });
  });
});
```

Ejecutar E2E tests:

```bash
npm run test:e2e
```

## Debugging

### VSCode Debugger

Crear `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "NestJS Debug",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/backend/node_modules/.bin/nest",
      "args": ["start", "--debug", "--watch"],
      "console": "integratedTerminal"
    }
  ]
}
```

Luego presionar F5 para iniciar debugging.

### Console Logging

```typescript
// Usar decorador @Logger
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async getUser(id: string) {
    this.logger.debug(`Getting user with id: ${id}`);
    // ...
  }
}
```

### Prisma Studio

```bash
npm run prisma:studio
# Abre interfaz gráfica en http://localhost:5555
```

## Git Workflow

### Branches

```bash
# Crear rama de feature
git checkout -b feat/nombre-feature

# Crear rama de bugfix
git checkout -b fix/nombre-bug

# Crear rama de docs
git checkout -b docs/nombre-doc
```

### Commits

Formato de mensajes:

```
type(scope): subject

body

footer
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Ejemplos:

```bash
git commit -m "feat(auth): add google oauth login"
git commit -m "fix(documents): resolve file upload issue"
git commit -m "docs(api): update swagger documentation"
```

### Pull Requests

1. Push branch: `git push origin feat/nombre-feature`
2. Crear PR en GitHub
3. Descripción clara de cambios
4. Esperar revisión
5. Aplicar feedback
6. Merge cuando esté aprobado

## Herramientas Útiles

### Comandos Comunes

```bash
# Linting y formateo
npm run lint              # Ejecutar ESLint
npm run lint:fix          # Arreglar automáticamente
npm run format            # Formatear con Prettier

# Compilación
npm run build             # Compilar a JavaScript
npm run build:prod        # Build para producción

# Base de datos
npm run prisma:generate   # Generar cliente Prisma
npm run prisma:migrate:dev # Crear migración
npm run prisma:studio     # Abrir Prisma Studio

# Desarrollo
npm run start:dev         # Servidor con hot-reload
npm run start:debug       # Servidor con debugger

# Testing
npm run test              # Tests unitarios
npm run test:watch        # Tests con watch
npm run test:cov          # Tests con cobertura
npm run test:e2e          # Tests E2E
```

### Extensiones VSCode Recomendadas

- **ES7+ React/Redux/React-Native snippets**
- **ESLint**
- **Prettier - Code formatter**
- **NestJS Schematics**
- **Prisma**
- **REST Client** (para testing de APIs)
- **Error Lens**
- **Todo Tree**

### Archivo .vscode/settings.json

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "files.exclude": {
    "**/.git": true,
    "**/node_modules": true,
    "**/dist": true
  }
}
```

## Troubleshooting

### npm install falla

```bash
# Limpiar cache
npm cache clean --force

# Reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Port 3000 ya está en uso

```bash
# Matar proceso
# macOS/Linux
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# O cambiar puerto
npm run start:dev -- --port 3001
```

### PostgreSQL connection refused

```bash
# Verificar que PostgreSQL está corriendo
pg_isready -h localhost -p 5432

# O con Docker
docker-compose ps
docker-compose logs postgres
```

### Errores de Prisma

```bash
# Regenerar cliente
npm run prisma:generate

# Forzar resync
npm run prisma:migrate:dev --name fix_schema
```

## Referencias

- NestJS Docs: https://docs.nestjs.com
- TypeScript Handbook: https://www.typescriptlang.org/docs
- Prisma Docs: https://www.prisma.io/docs
- ESLint Rules: https://eslint.org/docs/rules

---

**Última actualización**: Marzo 2026
