import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: { [key: string]: jest.Mock };
  let jwtService: { [key: string]: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    fullName: 'Test User',
    phone: '0911000000',
    role: 'CUSTOMER',
    currentHashedRefreshToken: 'hashed-refresh-token',
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      setCurrentRefreshTokenHash: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('some-secret') } },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      usersService.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
        phone: '0911000000',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        'Test User',
        '0911000000',
      );
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.id).toBe('user-1');
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nope@example.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('returns new tokens for a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await authService.refresh('some-refresh-token');

      expect(result.accessToken).toBe('signed-token');
    });

    it('throws UnauthorizedException if the token signature is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(authService.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if the user no longer exists', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if the user has no stored refresh token (logged out)', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      usersService.findById.mockResolvedValue({ ...mockUser, currentHashedRefreshToken: null });

      await expect(authService.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if the token does not match the stored hash', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token hash', async () => {
      const result = await authService.logout('user-1');

      expect(usersService.setCurrentRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
      expect(result).toEqual({ success: true });
    });
  });
});

