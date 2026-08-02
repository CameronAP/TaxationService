import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNumber, IsString, Matches, ValidateNested } from 'class-validator';
import { IntersectionType } from '@nestjs/mapped-types';


export class IsoDateDto {
  @IsDateString({ strict: true })
  @Matches(/T/, {
    message: 'Must be a full Date and Time ISO 8601',
  })
  date: string;
}

class ItemsDto {
  @IsString()
  itemId: string;
  @IsInt()
  cost: number;
  @IsNumber()
  taxRate: number;
}

export class SalesEventDto extends IsoDateDto {
  @IsString()
  invoiceId: string;
  @IsArray()
  @ValidateNested({ each: true})
  @Type(() => ItemsDto)
  items: ItemsDto[]

}

export class TaxEventDto extends IsoDateDto {
  @IsInt()
  amount: number;

}

export class AmendmentDto extends IntersectionType(ItemsDto, IsoDateDto) {
  @IsString()
  invoiceId: string;

}
