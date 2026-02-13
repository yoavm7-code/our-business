import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  async getTemplates(businessId: string, entityType?: string) {
    return this.prisma.customFieldTemplate.findMany({
      where: {
        businessId,
        ...(entityType && { entityType }),
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async saveTemplate(
    businessId: string,
    dto: {
      name: string;
      entityType: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        options?: string[];
      }>;
    },
  ) {
    return this.prisma.customFieldTemplate.create({
      data: {
        businessId,
        name: dto.name,
        entityType: dto.entityType,
        fields: dto.fields as any,
      },
    });
  }

  async deleteTemplate(businessId: string, id: string) {
    const template = await this.prisma.customFieldTemplate.findFirst({
      where: { id, businessId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return this.prisma.customFieldTemplate.delete({ where: { id } });
  }

  async setDefault(businessId: string, id: string) {
    const template = await this.prisma.customFieldTemplate.findFirst({
      where: { id, businessId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Unset all other defaults for this entity type
    await this.prisma.customFieldTemplate.updateMany({
      where: {
        businessId,
        entityType: template.entityType,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set this one as default
    return this.prisma.customFieldTemplate.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}
