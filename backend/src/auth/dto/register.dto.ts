import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @IsNotEmpty()
  @IsString()
  phone!: string;
}