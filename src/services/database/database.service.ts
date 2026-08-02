import { resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import { Injectable } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";

const sleep = (ms) => new Promise(rslve => setTimeout(rslve, ms));

const DATABASE_ENV_VAR = "DATABASE_FILE_PATH"

// This service is a mockup for a real database and stores entries in JSON
@Injectable()
export class DataBaseService {
    private DATABASE_PATH
    private WRITE_IN_PROGRESS: Boolean = false

    constructor(private readonly configService: ConfigService) {
        this.DATABASE_PATH = this.configService.get(DATABASE_ENV_VAR)
    }
    async readByDate(eventTypes: Array<string>, date: Date) {
        const res: any = { success: true }
        try {
            await this.writeInProgressCheck()
            const db = JSON.parse(await readFile(this.DATABASE_PATH, "utf8"));
            const records = {}
            for (const eventType of Object.values(eventTypes)) {
                const etRecords = db[eventType]
                if (Object.keys(etRecords)) {
                    const entries = Object.values(etRecords as [any]).filter(entry => new Date(entry.date) <= date)
                    records[eventType] = entries
                }
            }
            res.records = records
        } catch (error: any) {
            res.success = false
            res.error = error.message
            res.error.code = error.code ?? 500
        }
        return res
    }
    async readById(eventType: string, recordId: string) {
        const res: any = { success: true, }
        try {
            await this.writeInProgressCheck()
            const db = JSON.parse(await readFile(this.DATABASE_PATH, "utf8"));
            res.record = db[eventType][recordId]
        } catch (error: any) {
            res.success = false
            res.error = { message: error.message }
            res.error.code = error.code ?? 500
        }
        return res
    }
    async update(eventType: string, recordId: string, entry) {
        const res: any = { success: true }
        try {
            await this.writeInProgressCheck()
            this.WRITE_IN_PROGRESS = true

            const db = JSON.parse(await readFile(this.DATABASE_PATH, "utf8"));
            db[eventType][recordId] = { ...db[eventType][recordId], ...entry }
            await writeFile(this.DATABASE_PATH, JSON.stringify(db))
        } catch (error: any) {
            res.success = false
            res.error = { message: error.message }
            res.error.code = error.code ?? 500
        }
        this.WRITE_IN_PROGRESS = false
        return res
    }
    async create(eventType: string, recordId: string, record) {
        const res: any = { success: true }
        try {
            await this.writeInProgressCheck()
            this.WRITE_IN_PROGRESS = true
            const db = JSON.parse(await readFile(this.DATABASE_PATH, "utf8"));
            console.log("HERE")
            if (db[eventType][recordId]) {
                const error = new Error(`Conflict: Record with ID: ${recordId} already exists`) as Error & { code: number }
                error.code = 409
                throw error
            }
            db[eventType][recordId] = record
            await writeFile(this.DATABASE_PATH, JSON.stringify(db))
        } catch (error: any) {
            res.success = false
            res.error = { message: error.message }
            res.error.code = error.code ?? 500
        }
        this.WRITE_IN_PROGRESS = false
        return res
    }
    private async writeInProgressCheck() {
        let count = 0
        while (this.WRITE_IN_PROGRESS && count <= 10) {
            await sleep(100)
            if (count === 10 && this.WRITE_IN_PROGRESS) {
                throw new Error("Could not write due writing in progress")
            }
            count++
        }
    }
}
