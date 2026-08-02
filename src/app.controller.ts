import {
  Controller,
  Get,
  Patch,
  Query,
  BadRequestException,
  HttpStatus,
  HttpCode,
  Post,
  Body,
} from "@nestjs/common";
import { AppService } from "./app.service";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AmendmentDto, IsoDateDto } from "./dto/requestFormat.dto";

interface taxPosQuery {
  date: string;
}

interface createTransactionBody {
  eventType: string;
  date: string;
  amount?: number;
  invoiceId?: string;
  items?: Array<any>;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("tax-position")
  @HttpCode(HttpStatus.OK)
  async getTaxPosition(@Query() query: taxPosQuery) {
    const dateString: string = query.date;
    const dateDto = plainToInstance(IsoDateDto, { date: dateString });
    const errors = await validate(dateDto);
    if (errors.length) {
      throw new BadRequestException(errors);
    }
    const taxPos = await this.appService.getTaxPosition(new Date(dateString));
    return { date: dateString, taxPosition: taxPos };
  }

  @Post("transactions")
  @HttpCode(HttpStatus.CREATED) // 201 intead of 202 given we know the create has finished when we return a response
  async createTransation(@Body() body: createTransactionBody) {
    const eventType: string = body.eventType;
    if (!Object.values(this.appService.EventTypes).includes(eventType)) {
      throw new BadRequestException(`Invalid tranaction type: ${eventType}`);
    }
    const dto = this.appService.EventTypesToDto[eventType];
    const recordDto = plainToInstance(dto, body);
    const errors = await validate(recordDto);
    if (errors.length) {
      throw new BadRequestException(errors);
    }
    await this.appService.createTransaction(recordDto, eventType);
  }

  @Patch("sale")
  async amendSale(@Body() body) {
    const amendmentDto = plainToInstance(AmendmentDto, body);
    const errors = await validate(amendmentDto);
    if (errors.length) {
      throw new BadRequestException(errors);
    }
    await this.appService.amendSale(amendmentDto);
  }
}
