import {
  IsString, IsNumber, IsEnum, IsOptional,
  IsPhoneNumber, Min, Max, MaxLength
} from 'class-validator';
import { Currency, TransferType } from '../entities/transfer.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransferDto {
  @ApiProperty({ example: '+96170123456' })
  @IsPhoneNumber()
  receiverPhone: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(100)
  receiverName: string;

  @ApiProperty({ example: 100.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(50000)          // daily limit guard at DTO level
  amount: number;

  @ApiProperty({ enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ enum: TransferType })
  @IsEnum(TransferType)
  type: TransferType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class TransferResponseDto {
  id: string;
  referenceCode: string;
  status: string;
  amount: number;
  feeAmount: number;
  totalAmount: number;
  currency: string;
  receiverPhone: string;
  receiverName: string;
  createdAt: Date;
}
