import { IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^01\d{9}$/, { message: 'phone must be a valid 11-digit BD number' })
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
