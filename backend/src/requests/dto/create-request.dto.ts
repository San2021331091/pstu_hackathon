import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRequestDto {
  // Whom you are collecting from.
  @IsString()
  @Matches(/^01\d{9}$/, { message: 'payerPhone must be a valid BD number' })
  payerPhone: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a number with up to 2 decimals' })
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;
}
