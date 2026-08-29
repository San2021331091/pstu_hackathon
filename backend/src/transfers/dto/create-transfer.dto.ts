import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTransferDto {
  @Matches(/^01\d{9}$/, { message: 'recipientPhone must be a valid BD number (01XXXXXXXXX)' })
  recipientPhone: string;

  // taka as a string, validated to <= 2 decimal places; parsed to poisha server-side
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a number with up to 2 decimals' })
  amount: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;

  // client-generated UUID; makes retries idempotent
  @IsString()
  idempotencyKey: string;
}
