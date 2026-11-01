import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(
      dto.email,
      dto.password,
      dto.fullName,
      dto.phone,
    );

    return this.issueTokens(user.id, user.email, user.role, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user.id, user.email, user.role, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.currentHashedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(refreshToken, user.currentHashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user.id, user.email, user.role, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  }

  async logout(userId: string) {
    await this.usersService.setCurrentRefreshTokenHash(userId, null);
    return { success: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    userView: { id: string; email: string; fullName: string; role: string },
  ) {
    const accessToken = this.jwtService.sign({ sub: userId, email, role });

    const refreshToken = this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.setCurrentRefreshTokenHash(userId, refreshTokenHash);

    return { accessToken, refreshToken, user: userView };
  }
}