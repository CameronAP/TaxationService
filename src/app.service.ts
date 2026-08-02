import {
  ConflictException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { DataBaseService, DBRes } from "./services/database/database.service";
import { AmendmentDto, SalesEventDto, TaxPaymentDto } from "./dto/requestFormat.dto";
import { ClassConstructor } from "class-transformer";

interface saleItem {
  itemId: string;
  cost: number;
  taxRate: number;
}
interface AmendmentItem extends saleItem {
  date: string;
}

interface SalesRecord {
  eventType: string;
  date: string;
  invoiceId: string;
  items: Array<saleItem>;
  amendments?: Array<AmendmentItem>;
}

interface TaxPaymentRecord {
  eventType: string;
  date: string;
  amount: number;
}

type EventDto = SalesEventDto | TaxPaymentDto;

@Injectable()
export class AppService {
  constructor(private readonly dbService: DataBaseService) {}
  EventTypes = {
    sales: "SALES",
    taxPayment: "TAX_PAYMENT",
  };
  EventTypesToDto: Record<string, ClassConstructor<EventDto>> = {
    [this.EventTypes.sales]: SalesEventDto,
    [this.EventTypes.taxPayment]: TaxPaymentDto,
  };
  async getTaxPosition(date: Date): Promise<number> {
    const res = await this.dbService.readByDate(Object.values(this.EventTypes), date);
    if (!res.success) {
      console.error(res.error);
      throw new InternalServerErrorException("Internal Server Error");
    }
    let position = 0;
    if (res.records) {
      for (const sale of res.records[this.EventTypes.sales] as Array<SalesRecord>) {
        const amendments = sale.amendments ?? [];
        amendments.sort((a, b) => {
          const aDate = new Date(a.date);
          const bDate = new Date(b.date);
          return aDate.getTime() - bDate.getTime();
        });
        for (const amendment of amendments) {
          let itemFound = false;
          for (let i = 0; i < sale.items.length; i++) {
            if (sale.items[i].itemId == amendment.itemId) {
              sale.items[i] = amendment;
              itemFound = true;
            }
          }
          if (!itemFound) sale.items.push(amendment);
        }
        sale.items.forEach((item) => {
          position += Math.round(item.cost * item.taxRate);
        }); // Rounded as per https://www.gov.uk/hmrc-internal-manuals/vat-trader-records/vatrec12030
      }
      for (const tp of res.records[this.EventTypes.taxPayment] as Array<TaxPaymentRecord>) {
        position -= tp.amount;
      }
    }
    return position;
  }

  async createTransaction(record: SalesEventDto | TaxPaymentDto, eventType: string): Promise<void> {
    const recordId = record instanceof TaxPaymentDto ? record.date : record.invoiceId;
    const errStr = "Internal Server Error: Failed to create transaction";

    let res: DBRes;
    if (eventType === this.EventTypes.taxPayment) {
      res = await this.dbService.create(eventType, recordId, record);
    } else {
      const readRes = await this.dbService.readById(eventType, recordId);
      if (!readRes.success) {
        console.error(readRes.error);
        throw new InternalServerErrorException(errStr);
      }
      const existantRecord = readRes.record as SalesRecord;
      if (existantRecord) {
        if (existantRecord.items) {
          // Sale event has already be created and populated with items
          throw new ConflictException(`Record with ID: ${recordId} already exists`);
        }
        res = await this.dbService.update(eventType, recordId, {
          ...existantRecord,
          ...record,
        });
      } else {
        res = await this.dbService.create(eventType, recordId, record);
      }
    }
    if (!res.success) {
      console.error(res.error);
      if (res.error?.code === HttpStatus.CONFLICT) throw new ConflictException(res.error.message);

      throw new InternalServerErrorException(errStr);
    }
  }

  async amendSale(amendmentDto: AmendmentDto): Promise<void> {
    const salesET = this.EventTypes.sales;
    const { invoiceId, ...amendmentItem } = amendmentDto;
    const errStr = "Internal Server Error: Failed to amend transaction";
    const readRes = await this.dbService.readById(salesET, invoiceId);
    if (!readRes.success) {
      console.error(readRes.error);
      throw new InternalServerErrorException(errStr);
    }
    const record = readRes.record as SalesRecord;
    let res: DBRes;
    if (record) {
      if (!record.amendments) record.amendments = [];
      record.amendments.push(amendmentItem);
      res = await this.dbService.update(salesET, invoiceId, record);
    } else {
      res = await this.dbService.create(salesET, invoiceId, {
        eventType: salesET,
        invoiceId: invoiceId,
        amendments: [amendmentItem],
      });
    }
    if (!res.success) {
      console.error(readRes.error);
      throw new InternalServerErrorException(errStr);
    }
  }
}
