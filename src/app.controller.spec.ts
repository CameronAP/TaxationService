import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DataBaseService } from "./services/database/database.service";
import { BadRequestException, ConflictException } from "@nestjs/common";

class MockDataBaseService {
  readByDate = jest.fn();
  readById = jest.fn();
  update = jest.fn();
  create = jest.fn();
}

describe("AppController", () => {
  let appController: AppController;
  let mockDataBaseService: MockDataBaseService;
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataBaseService, useClass: MockDataBaseService }],
    }).compile();

    appController = module.get(AppController);
    appService = module.get(AppService);
    mockDataBaseService = module.get(DataBaseService);
  });

  describe("getTaxPosition", () => {
    it("Should return tax position of 0 when no records are returned", async () => {
      mockDataBaseService.readByDate.mockResolvedValue({ success: true });
      const date = "2026-08-03T12:30:00Z";
      const res = await appController.getTaxPosition({ date: date });
      expect(res.taxPosition).toBe(0);
      expect(res.date).toBe(date);
    });
    it("Should return tax position of -100 when 1 tax payment is returned", async () => {
      const date = "2026-08-03T12:30:00Z";
      mockDataBaseService.readByDate.mockResolvedValue({
        success: true,
        records: {
          [appService.EventTypes.sales]: [],
          [appService.EventTypes.taxPayment]: [{ date: date, amount: 100 }],
        },
      });
      const res = await appController.getTaxPosition({ date: date });
      expect(res.taxPosition).toBe(-100);
    });
    it("Should return tax position of 50 when 1 tax payment and 1 sale with no amendments are returned", async () => {
      const date = "2026-08-03T12:30:00Z";
      mockDataBaseService.readByDate.mockResolvedValue({
        success: true,
        records: {
          [appService.EventTypes.sales]: [
            {
              date: date,
              invoiceId: "123456",
              items: [
                { itemId: "Item1", cost: 100, taxRate: 0.5 },
                { itemId: "Item2", cost: 500, taxRate: 0.2 },
              ],
            },
          ],
          [appService.EventTypes.taxPayment]: [{ date: date, amount: 100 }],
        },
      });
      const res = await appController.getTaxPosition({ date: date });
      expect(res.taxPosition).toBe(50);
    });
    it("Should return tax position of 10 when 2 tax payment and 2 sale with one with amendments and one without are returned", async () => {
      const date = "2026-08-03T12:30:00Z";
      mockDataBaseService.readByDate.mockResolvedValue({
        success: true,
        records: {
          [appService.EventTypes.sales]: [
            {
              date: date,
              invoiceId: "1",
              items: [
                { itemId: "Item1", cost: 100, taxRate: 0.1 },
                { itemId: "Item2", cost: 500, taxRate: 0.2 },
              ],
            },
            {
              date: date,
              invoiceId: "2",
              items: [
                { itemId: "Item1", cost: 1000, taxRate: 0.5 },
                { itemId: "Item2", cost: 900, taxRate: 0.2 },
              ],
              amendments: [
                { date: date, itemId: "Item1", cost: 100, taxRate: 0.5 },
                { date: date, itemId: "Item2", cost: 100, taxRate: 0.5 },
              ],
            },
          ],
          [appService.EventTypes.taxPayment]: [
            { date: date, amount: 100 },
            { date: date, amount: 100 },
          ],
        },
      });
      const res = await appController.getTaxPosition({ date: date });
      expect(res.taxPosition).toBe(10);
      expect(res.date).toBe(date);
    });
    it("Should return tax position of 0 and use latest amendment when there are 2 for one item and one without are returned", async () => {
      mockDataBaseService.readByDate.mockResolvedValue({
        success: true,
        records: {
          [appService.EventTypes.sales]: [
            {
              date: "2026-08-03T12:30:00Z",
              invoiceId: "2",
              items: [{ itemId: "Item1", cost: 1000, taxRate: 0.5 }],
              amendments: [
                {
                  date: "2026-08-04T10:30:00Z",
                  itemId: "Item1",
                  cost: 2000,
                  taxRate: 0.5,
                }, // This amendment should be used
                {
                  date: "2026-08-03T13:30:00Z",
                  itemId: "Item1",
                  cost: 100,
                  taxRate: 0.5,
                },
              ],
            },
          ],
          [appService.EventTypes.taxPayment]: [{ date: "2026-08-03T12:30:00Z", amount: 1000 }],
        },
      });
      const res = await appController.getTaxPosition({
        date: "2026-08-03T12:30:00Z",
      });
      expect(res.taxPosition).toBe(0);
    });
    it("Should return tax position of 1000 by using amendment which adds new item", async () => {
      mockDataBaseService.readByDate.mockResolvedValue({
        success: true,
        records: {
          [appService.EventTypes.sales]: [
            {
              date: "2026-08-03T12:30:00Z",
              invoiceId: "2",
              items: [{ itemId: "Item1", cost: 1000, taxRate: 0.1 }],
              amendments: [
                {
                  date: "2026-08-04T10:30:00Z",
                  itemId: "Item2",
                  cost: 2000,
                  taxRate: 0.5,
                }, // This amendment should be used
              ],
            },
          ],
          [appService.EventTypes.taxPayment]: [{ date: "2026-08-03T12:30:00Z", amount: 100 }],
        },
      });
      const res = await appController.getTaxPosition({
        date: "2026-08-03T12:30:00Z",
      });
      expect(res.taxPosition).toBe(1000);
    });
  });
  describe("createTransation", () => {
    describe("Tax Payments", () => {
      it("Should create a taxPayment for a given date", async () => {
        mockDataBaseService.create.mockResolvedValue({ success: true });
        await appController.createTransation({
          eventType: "TAX_PAYMENT",
          date: "2026-08-03T12:30:00Z",
          amount: 1500,
        });
        expect(mockDataBaseService.create).toHaveBeenCalledWith("TAX_PAYMENT", "2026-08-03T12:30:00Z", {
          amount: 1500,
          date: "2026-08-03T12:30:00Z",
          eventType: "TAX_PAYMENT",
        });
      });
      it("Should raise a ConflictException if a taxpayment for that date already exists ", async () => {
        mockDataBaseService.create.mockResolvedValue({
          success: false,
          error: { message: "Conflict", code: 409 },
        });
        await expect(
          appController.createTransation({
            eventType: "TAX_PAYMENT",
            date: "2026-08-03T12:30:00Z",
            amount: 1500,
          }),
        ).rejects.toThrow(ConflictException);
      });
      it("Should raise a BadRequestError if the body is in incorrect format", async () => {
        await expect(
          appController.createTransation({
            eventType: "TAX_PAYMENT",
            date: "2026-08-03", // Incorrect date format
            amount: 1500,
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
    describe("Sale Events", () => {
      it("Should create a sale Event for a given date while no sale event already exists", async () => {
        mockDataBaseService.readById.mockResolvedValue({ success: true });
        mockDataBaseService.create.mockResolvedValue({ success: true });
        await appController.createTransation({
          eventType: "SALES",
          date: "2026-08-03T12:30:00Z",
          invoiceId: "Invoice 1",
          items: [{ itemId: "Item 1", cost: 1099, taxRate: 0.2 }],
        });
        expect(mockDataBaseService.create).toHaveBeenCalledWith("SALES", "Invoice 1", {
          date: "2026-08-03T12:30:00Z",
          eventType: "SALES",
          invoiceId: "Invoice 1",
          items: [{ cost: 1099, itemId: "Item 1", taxRate: 0.2 }],
        });
      });
      it("Should update sale event created by an amendment for an item the sale event doent have", async () => {
        mockDataBaseService.readById.mockResolvedValue({
          success: true,
          record: {
            eventType: "SALES",
            invoiceId: "Invoice 1",
            amendments: [
              {
                date: "2026-08-03T12:31:00Z",
                itemId: "Item 3",
                cost: 40000,
                taxRate: 0.15,
              },
            ],
          },
        });
        mockDataBaseService.update.mockResolvedValue({ success: true });
        await appController.createTransation({
          eventType: "SALES",
          date: "2026-08-03T12:30:00Z",
          invoiceId: "Invoice 1",
          items: [{ itemId: "Item 1", cost: 1099, taxRate: 0.2 }],
        });
        expect(mockDataBaseService.update).toHaveBeenCalledWith("SALES", "Invoice 1", {
          date: "2026-08-03T12:30:00Z",
          eventType: "SALES",
          invoiceId: "Invoice 1",
          items: [{ cost: 1099, itemId: "Item 1", taxRate: 0.2 }],
          amendments: [
            {
              date: "2026-08-03T12:31:00Z",
              itemId: "Item 3",
              cost: 40000,
              taxRate: 0.15,
            },
          ],
        });
      });
      it("Should raise Conflict error when a sale event created a sale event is found", async () => {
        mockDataBaseService.readById.mockResolvedValue({
          success: true,
          record: {
            eventType: "SALES",
            date: "2026-08-03T12:30:00Z",
            invoiceId: "Invoice 1",
            items: [{ itemId: "Item 1", cost: 1099, taxRate: 0.2 }],
          },
        });
        await expect(
          appController.createTransation({
            eventType: "SALES",
            date: "2026-08-03T12:30:00Z",
            invoiceId: "Invoice 1",
            items: [{ itemId: "Item 1", cost: 1099, taxRate: 0.2 }],
          }),
        ).rejects.toThrow(ConflictException);
      });
      it("Should create a sale Event for a given date while no sale event already exists", async () => {
        mockDataBaseService.readById.mockResolvedValue({ success: true });
        mockDataBaseService.create.mockResolvedValue({ success: true });
        await appController.createTransation({
          eventType: "SALES",
          date: "2026-08-03T12:30:00Z",
          invoiceId: "Invoice 1",
          items: [{ itemId: "Item 1", cost: 1099, taxRate: 0.2 }],
        });
        expect(mockDataBaseService.create).toHaveBeenCalledWith("SALES", "Invoice 1", {
          date: "2026-08-03T12:30:00Z",
          eventType: "SALES",
          invoiceId: "Invoice 1",
          items: [{ cost: 1099, itemId: "Item 1", taxRate: 0.2 }],
        });
      });
      it("Should raise a BadRequestError if the body is in incorrect format", async () => {
        await expect(
          appController.createTransation({
            eventType: "SALES",
            date: "2026-08-03T12:30:00Z",
            invoiceId: "Invoice 1",
            items: [{ itemId: "Item 1", cost: 1099.1, taxRate: 0.2 }], // Cost not an integer
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });
  describe("amendSale", () => {
    it("Should update existing sale event with amendment", async () => {
      mockDataBaseService.readById.mockResolvedValue({
        success: true,
        record: {
          eventType: "SALES",
          date: "2026-08-03T12:30:00Z",
          invoiceId: "Invoice 1",
          items: [{ itemId: "Item 1", cost: 1099, taxRate: 0.2 }],
        },
      });
      mockDataBaseService.update.mockResolvedValue({ success: true });
      await appController.amendSale({
        date: "2026-08-03T17:29:39Z",
        invoiceId: "Invoice 1",
        itemId: "Item 1",
        cost: 40000,
        taxRate: 0.15,
      });
      expect(mockDataBaseService.update).toHaveBeenCalledWith("SALES", "Invoice 1", {
        amendments: [
          {
            cost: 40000,
            date: "2026-08-03T17:29:39Z",
            itemId: "Item 1",
            taxRate: 0.15,
          },
        ],
        date: "2026-08-03T12:30:00Z",
        eventType: "SALES",
        invoiceId: "Invoice 1",
        items: [{ cost: 1099, itemId: "Item 1", taxRate: 0.2 }],
      });
    });
    it("Should update existing with amendments for a given date", async () => {
      mockDataBaseService.readById.mockResolvedValue({ success: true });
      mockDataBaseService.create.mockResolvedValue({ success: true });
      await appController.amendSale({
        date: "2026-08-03T17:29:39Z",
        invoiceId: "Invoice 1",
        itemId: "Item 1",
        cost: 40000,
        taxRate: 0.15,
      });
      expect(mockDataBaseService.create).toHaveBeenCalledWith("SALES", "Invoice 1", {
        amendments: [
          {
            cost: 40000,
            date: "2026-08-03T17:29:39Z",
            itemId: "Item 1",
            taxRate: 0.15,
          },
        ],
        eventType: "SALES",
        invoiceId: "Invoice 1",
      });
    });
    it("Should raise a BadRequestError if the body is in incorrect format", async () => {
      await expect(
        appController.amendSale({
          date: "2026-08-03T17:29:39Z",
          invoiceId: "Invoice 1",
          itemId: 1, // Not a string
          cost: 40000,
          taxRate: 0.15,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
