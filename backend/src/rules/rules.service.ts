import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  /** Suggest category for a description using rules (and later AI). */
  async suggestCategory(householdId: string, description: string): Promise<string | null> {
    const rules = await this.prisma.categoryRule.findMany({
      where: { householdId, isActive: true },
      orderBy: { priority: 'desc' },
      include: { category: true },
    });
    const normalized = description.toUpperCase().trim();
    for (const rule of rules) {
      const pattern = rule.pattern.toUpperCase();
      let match = false;
      if (rule.patternType === 'contains') match = normalized.includes(pattern);
      else if (rule.patternType === 'startsWith') match = normalized.startsWith(pattern);
      else if (rule.patternType === 'regex') {
        try {
          match = new RegExp(pattern, 'i').test(description);
        } catch {
          match = false;
        }
      }
      if (match) return rule.categoryId;
    }
    return null;
  }

  /** Learn from user correction: create or strengthen a rule. */
  async learnFromCorrection(
    householdId: string,
    description: string,
    categoryId: string,
  ): Promise<void> {
    const existing = await this.prisma.categoryRule.findFirst({
      where: { householdId, categoryId, pattern: description.trim().slice(0, 50) },
    });
    if (existing) return;
    await this.prisma.categoryRule.create({
      data: {
        householdId,
        categoryId,
        pattern: description.trim().slice(0, 80),
        patternType: 'contains',
        priority: 10,
      },
    });
  }

  async findAll(householdId: string) {
    return this.prisma.categoryRule.findMany({
      where: { householdId },
      orderBy: { priority: 'desc' },
      include: { category: true },
    });
  }

  async create(
    householdId: string,
    dto: { categoryId: string; pattern: string; patternType?: string; priority?: number },
  ) {
    return this.prisma.categoryRule.create({
      data: {
        householdId,
        categoryId: dto.categoryId,
        pattern: dto.pattern,
        patternType: dto.patternType ?? 'contains',
        priority: dto.priority ?? 0,
      },
      include: { category: true },
    });
  }

  async remove(householdId: string, id: string) {
    return this.prisma.categoryRule.deleteMany({
      where: { id, householdId },
    });
  }
}
