import { IsIn, IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  // Bangladeshi mobile format, e.g. 01712345678
  @IsString()
  @Matches(/^01\d{9}$/, { message: 'phone must be a valid 11-digit BD number (01XXXXXXXXX)' })
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  // F1 - Regular User vs Agent (agents can Cash-In physical money for users)
  @IsOptional()
  @IsIn(['USER', 'AGENT'])
  accountType?: 'USER' | 'AGENT';

  // F5 - optional 4-6 digit PIN used to unfreeze after an Emergency Freeze
  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'pin must be 4-6 digits' })
  pin?: string;
}
