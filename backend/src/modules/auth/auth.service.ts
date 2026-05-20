import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { User, UserRole, AcademicStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { JwtConfig } from '../../config/app.config';
import type { StringValue } from 'ms';

export interface JwtPayloadData {
  sub: string;
  email: string;
  role: UserRole;
  firstName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'passwordHash'>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtConfig: JwtConfig;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.jwtConfig = this.configService.get<JwtConfig>('jwt') || {
      accessSecret: 'fallback',
      refreshSecret: 'fallback-refresh',
      accessExpiration: '1h',
      refreshExpiration: '7d',
    };
  }

  async registerLocal(dto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: UserRole.STUDENT,
          emailVerified: false,
          isActive: true,
        },
      });

      // hasCompletedSubjects defaults to FALSE — must be validated via external API
      await tx.studentProfile.create({
        data: {
          userId: createdUser.id,
          studentCode: dto.studentCode,
          program: dto.program,
          faculty: dto.faculty ?? 'Por definir',
          semester: dto.semester ?? 1,
          academicStatus: AcademicStatus.ACTIVE,
          hasCompletedSubjects: false, // FIXED: was hardcoded to true
        },
      });

      return createdUser;
    });

    this.logger.log(`New user registered: ${user.email}`);

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async validateLocalUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async login(user: User): Promise<LoginResponse> {
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const tokens = this.generateTokens(user);
    const refreshExpiresMs = this.parseExpirationToMs(this.jwtConfig.refreshExpiration);

    // Create session record
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
        isActive: true,
      },
    });

    const { passwordHash, ...userWithoutPassword } = user;

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userWithoutPassword,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || !session.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (session.expiresAt < new Date()) {
      // Mark expired session as inactive
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Verify refresh token with the REFRESH secret
    try {
      this.jwtService.verify(refreshToken, {
        secret: this.jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    const user = session.user;
    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const tokens = this.generateTokens(user);
    const refreshExpiresMs = this.parseExpirationToMs(this.jwtConfig.refreshExpiration);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    return tokens;
  }

  async logout(userId: string, token: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { userId, token },
    });

    if (session) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { isActive: false },
      });
    }
  }

  async validateGoogleUser(profile: {
    id: string;
    displayName: string;
    name?: { givenName?: string; familyName?: string };
    emails?: Array<{ value: string }>;
  }): Promise<User> {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;

    if (!email) {
      throw new BadRequestException('Google profile does not contain email');
    }

    // Try to find user by googleId
    let user = await this.prisma.user.findUnique({ where: { googleId } });
    if (user) return user;

    // Try to find user by email and link
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { googleId },
      });
      return user;
    }

    // Create new user from Google profile
    const firstName = profile.name?.givenName || profile.displayName || 'User';
    const lastName = profile.name?.familyName || '';

    user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          googleId,
          firstName,
          lastName,
          role: UserRole.STUDENT,
          emailVerified: true,
          isActive: true,
        },
      });

      const baseCode = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      await tx.studentProfile.create({
        data: {
          userId: createdUser.id,
          studentCode: `${baseCode}-${createdUser.id.substring(0, 6).toUpperCase()}`,
          program: 'Por definir',
          faculty: 'Por definir',
          semester: 1,
          academicStatus: AcademicStatus.ACTIVE,
          hasCompletedSubjects: false, // FIXED: was hardcoded to true
        },
      });

      return createdUser;
    });

    return user;
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token);
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { emailVerified: true },
      });
    } catch {
      throw new BadRequestException('Invalid or expired verification token');
    }
  }

  /**
   * Generate access and refresh tokens with SEPARATE secrets
   */
  private generateTokens(user: User): AuthTokens {
    const payload: JwtPayloadData = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig.accessExpiration as StringValue,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: this.jwtConfig.refreshExpiration as StringValue,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Parse JWT expiration string (e.g., '7d', '1h') to milliseconds
   */
  private parseExpirationToMs(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || multipliers['d']);
  }
}
