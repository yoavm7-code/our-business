import { Injectable, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const household = await this.prisma.household.create({
      data: { name: `${dto.name || 'User'}'s Household` },
    });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name ?? null,
        householdId: household.id,
      },
    });
    return { ...user, passwordHash: undefined };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true, householdId: true },
    });
  }

  async findById(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, householdId: true },
    });
    return u ?? null;
  }

  async update(id: string, dto: { name?: string; email?: string; password?: string }) {
    const data: { name?: string | null; email?: string; passwordHash?: string } = {};
    if (dto.name !== undefined) data.name = dto.name.trim() || null;
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing && existing.id !== id) throw new ConflictException('Email already in use');
        data.email = email;
      }
    }
    if (dto.password != null && dto.password.length >= 6) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (Object.keys(data).length === 0) return this.findById(id);
    const u = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, householdId: true },
    });
    return u;
  }
}
