import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CaptchaService } from '../captcha/captcha.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private captchaService: CaptchaService,
  ) {}

  async register(dto: RegisterDto) {
    const captchaOk = await this.captchaService.verify(dto.captchaToken);
    if (!captchaOk) throw new BadRequestException('Captcha verification failed. Please try again.');
    const user = await this.usersService.create(dto);
    return this.loginResponse(user);
  }

  async login(dto: LoginDto) {
    const captchaOk = await this.captchaService.verify(dto.captchaToken);
    if (!captchaOk) throw new BadRequestException('Captcha verification failed. Please try again.');
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');
    return this.loginResponse(user);
  }

  private async loginResponse(user: { id: string; email: string; name: string | null; householdId: string; countryCode?: string | null }) {
    const payload = { sub: user.id, email: user.email, householdId: user.householdId };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        householdId: user.householdId,
        countryCode: user.countryCode ?? undefined,
      },
    };
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }
}
