import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TwoFactorService } from './two-factor.service';

@Controller('api/2fa')
@UseGuards(JwtAuthGuard)
export class TwoFactorController {
  constructor(private twoFactorService: TwoFactorService) {}

  @Get('status')
  async getStatus(@CurrentUser() user: { id: string }) {
    const enabled = await this.twoFactorService.isTwoFactorEnabled(user.id);
    return { enabled };
  }

  @Post('generate')
  async generate(@CurrentUser() user: { id: string }) {
    return this.twoFactorService.generateSecretForUser(user.id);
  }

  @Post('enable')
  async enable(
    @CurrentUser() user: { id: string },
    @Body() body: { token: string },
  ) {
    return this.twoFactorService.enableTwoFactor(user.id, body.token);
  }

  @Post('disable')
  async disable(
    @CurrentUser() user: { id: string },
    @Body() body: { token: string },
  ) {
    return this.twoFactorService.disableTwoFactor(user.id, body.token);
  }
}
