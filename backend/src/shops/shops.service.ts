import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShopDto } from './dto/create-shop.dto';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async createShop(userId: string, dto: CreateShopDto) {
    const existing = await this.prisma.shop.findUnique({ where: { ownerUserId: userId } });
    if (existing) {
      throw new ConflictException('You already have a shop');
    }

    return this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          ownerUserId: userId,
          name: dto.name,
          description: dto.description,
          logoUrl: dto.logoUrl,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { role: Role.SHOP_OWNER },
      });

      return shop;
    });
  }

  async findMyShop(userId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerUserId: userId } });
    if (!shop) {
      throw new NotFoundException('No shop found for this user');
    }
    return shop;
  }
}