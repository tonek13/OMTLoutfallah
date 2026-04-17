import {
  IsString, IsNumber, IsEnum, IsOptional,
  IsPhoneNumber, Min, Max, MaxLength
} from 'class-validator';
import { Currency, TransferType } from '../entities/transfer.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({ example: 'fb6ba9bd-d2f7-42a3-a623-9302c9c317ff' })
  id!: string;

  @ApiProperty({ example: '9ec4feba-d622-4650-84f2-5220e4eb53d2' })
  senderId!: string;

  @ApiPropertyOptional({ example: '8e80e385-0cfa-4f90-b4ca-74f52ad648e2' })
  tenantId?: string | null;

  @ApiProperty({ example: 'OMT-2026-X9A31F' })
  referenceCode!: string;

  @ApiProperty({ example: 'PROCESSING' })
  status!: string;

  @ApiProperty({ example: 100 })
  amount!: number;

  @ApiProperty({ example: 3 })
  feeAmount!: number;

  @ApiProperty({ example: 103 })
  totalAmount!: number;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  currency!: Currency;

  @ApiProperty({ enum: TransferType, example: TransferType.DOMESTIC })
  type!: TransferType;

  @ApiProperty({ example: '+96170123456' })
  receiverPhone!: string;

  @ApiProperty({ example: 'John Doe' })
  receiverName!: string;

  @ApiPropertyOptional({ example: 'Monthly allowance' })
  note?: string;

  @ApiProperty({ example: false })
  isFlagged!: boolean;

  @ApiProperty({ example: '2026-03-27T12:00:00.000Z' })
  createdAt!: Date;
}

export class TransfersPaginationMetaDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  pages!: number;
}

export class TransferListResponseDto {
  @ApiProperty({ type: TransferResponseDto, isArray: true })
  data!: TransferResponseDto[];

  @ApiProperty({ type: TransfersPaginationMetaDto })
  meta!: TransfersPaginationMetaDto;
}

export class TransferCancelResponseDto {
  @ApiProperty({ example: 'Transfer cancelled successfully' })
  message!: string;
}
