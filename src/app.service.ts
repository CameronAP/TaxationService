import { ConflictException, HttpCode, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataBaseService } from './services/database/database.service';
import { SalesEventDto, TaxEventDto } from './dto/requestFormat.dto';
import { ClassConstructor } from 'class-transformer';

interface saleItem {
  itemId: string
  cost: number
  taxRate: number
}
interface AmendmentItem extends saleItem { date: string }

interface SalesRecord {
  date: string
  invoiceId: string
  items: Array<saleItem>
  amendments: Array<AmendmentItem>
}

interface TaxPosRecord {
  date: string
  amount: number
}

interface DbRecords {
  eventType: Array<TaxPosRecord | SalesRecord>
}

type EventDto = SalesEventDto | TaxEventDto;

@Injectable()
export class AppService {
  constructor(private readonly dbService: DataBaseService) { }
  EventTypes = {
    sales: "SALES",
    taxPayment: "TAX_PAYMENT"
  }
  EventTypesToDto: Record<string, ClassConstructor<EventDto>> = {
    [this.EventTypes.sales]: SalesEventDto,
    [this.EventTypes.taxPayment]: TaxEventDto,
  };
  async getTaxPosition(date: Date): Promise<Number> {
    let position = 0
    const res = await this.dbService.readByDate(Object.values(this.EventTypes), date)
    if (!res.success) {
      console.error(res.error)
      throw new InternalServerErrorException("Internal Server Error")
    }
    const records: DbRecords = res.records
    if (records) {
      for (const sale of records[this.EventTypes.sales]) {
        const amendments = sale.amendments ?? []
        amendments.sort((a, b) => {
          const aDate = new Date(a.date)
          const bDate = new Date(b.date)
          return aDate.getTime() - bDate.getTime()
        })
        for (const amendment of amendments) {
          let itemFound = false
          for (let i = 0; i < sale.items.length; i++) {
            if (sale.items[i].itemId == amendment.itemId) {
              sale.items[i] = amendment
              itemFound = true
            }
          }
          if (!itemFound) sale.items.push(amendment)
        }
        sale.items.forEach(item => { position += Math.round(item.cost * item.taxRate) }); // Rounded as per https://www.gov.uk/hmrc-internal-manuals/vat-trader-records/vatrec12030
      }
      for (const tp of records[this.EventTypes.taxPayment]) {
        position -= tp.amount
      }
    }
    return position
  }

  async createTransaction(record, eventType: string) {
    const recordId = record.invoiceId ?? record.date
    const errStr = "Internal Server Error: Failed to create transaction"

    let res
    if (eventType === this.EventTypes.taxPayment) { res = await this.dbService.create(eventType, recordId, record) }
    else {
      const readRes = await this.dbService.readById(eventType, recordId)
      if (!readRes.success) {
        console.error(readRes.error)
        throw new InternalServerErrorException(errStr)
      }
      if (readRes.record) {
        if (readRes.record.items) {
          // Sale event has already be created and populated with items
          throw new ConflictException(`Record with ID: ${recordId} already exists`)
        }
        res = await this.dbService.update(eventType, recordId, { ...readRes.record, ...record })
      } else {
        res = await this.dbService.create(eventType, recordId, record)
      }
    }
    if (!res.success) {
      console.error(res.error.message)
      if (res.error.code === HttpStatus.CONFLICT) throw new ConflictException(res.error.message)

      throw new InternalServerErrorException(errStr)
    }
  }

  async amendSale(itemAmendment) {
    const salesET = this.EventTypes.sales
    const recordId = itemAmendment.invoiceId
    delete itemAmendment.invoiceId
    const errStr = "Internal Server Error: Failed to amend transaction"

    const readRes = await this.dbService.readById(salesET, recordId)
    if (!readRes.success) {
      console.error(readRes.error)
      throw new InternalServerErrorException(errStr)
    }
    const record = readRes.record
    let res
    if (record) {
      if (!record.amendments) record.amendments = []
      record.amendments.push({ ...itemAmendment })
      res = await this.dbService.update(salesET, recordId, record)
    } else {
      res = await this.dbService.create(salesET, recordId, {
        eventType: salesET,
        invoiceId: recordId,
        amendments: [{ ...itemAmendment }]
      })
    }
    if (!res.success) {
      console.error(readRes.error)
      throw new InternalServerErrorException(errStr)
    }
  }
}
