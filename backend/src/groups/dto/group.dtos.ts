import { ArrayMaxSize, IsArray, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString() @MinLength(2) @MaxLength(60)
  name: string;

  // member phone numbers (creator is added automatically)
  @IsArray()
  @ArrayMaxSize(20)
  @Matches(/^01\d{9}$/, { each: true, message: 'each member must be a valid BD number' })
  memberPhones: string[];
}

export class FundGroupDto {
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a number' })
  amount: string;
}

export class CreateProposalDto {
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a number' })
  amount: string;

  @Matches(/^01\d{9}$/, { message: 'recipientPhone must be a valid BD number' })
  recipientPhone: string;

  @IsString() @MinLength(3) @MaxLength(140)
  reason: string;
}

export class VoteDto {
  approve: boolean;
}
