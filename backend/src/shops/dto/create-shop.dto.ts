import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateShopDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}