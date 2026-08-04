import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { decryptOrPassthrough, encrypt } from "../utils/crypto.utils.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : undefined,
});

const baseClient = new PrismaClient({ adapter });

const SENSITIVE_FIELDS: Record<string, readonly string[]> = {
  application: ["first_name", "last_name", "email", "phone"],
  spontaneous_application: ["first_name", "last_name", "email", "phone"],
  contact_message: ["first_name", "last_name", "email", "phone"],
};

type DataRecord = Record<string, unknown>;

function isDataRecord(value: unknown): value is DataRecord {
  return typeof value === "object" && value !== null;
}

function encryptData(model: string, data: DataRecord): void {
  const fields = SENSITIVE_FIELDS[model];
  if (!fields) {
    return;
  }

  for (const field of fields) {
    const value = data[field];
    if (typeof value === "string" && value.length > 0) {
      data[field] = encrypt(value);
    }
  }
}

function decryptData(model: string, result: unknown): void {
  const fields = SENSITIVE_FIELDS[model];
  if (!fields || result === undefined || result === null) {
    return;
  }

  const rows = Array.isArray(result) ? result : [result];
  for (const row of rows) {
    if (!isDataRecord(row)) {
      continue;
    }
    for (const field of fields) {
      const value = row[field];
      if (typeof value === "string" && value.length > 0) {
        row[field] = decryptOrPassthrough(value);
      }
    }
  }
}

const prisma = baseClient.$extends({
  query: {
    application: {
      async create({ args, query }) {
        encryptData("application", args.data as unknown as DataRecord);
        const result = await query(args);
        decryptData("application", result);
        return result;
      },
      async createMany({ args, query }) {
        const rows = Array.isArray(args.data) ? args.data : [args.data];
        for (const row of rows) {
          encryptData("application", row as unknown as DataRecord);
        }
        return query(args);
      },
      async update({ args, query }) {
        encryptData("application", args.data as unknown as DataRecord);
        const result = await query(args);
        decryptData("application", result);
        return result;
      },
      async updateMany({ args, query }) {
        encryptData("application", args.data as unknown as DataRecord);
        return query(args);
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        decryptData("application", result);
        return result;
      },
      async findUniqueOrThrow({ args, query }) {
        const result = await query(args);
        decryptData("application", result);
        return result;
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        decryptData("application", result);
        return result;
      },
      async findFirstOrThrow({ args, query }) {
        const result = await query(args);
        decryptData("application", result);
        return result;
      },
      async findMany({ args, query }) {
        const result = await query(args);
        decryptData("application", result);
        return result;
      },
    },
    spontaneous_application: {
      async create({ args, query }) {
        encryptData("spontaneous_application", args.data as unknown as DataRecord);
        const result = await query(args);
        decryptData("spontaneous_application", result);
        return result;
      },
      async createMany({ args, query }) {
        const rows = Array.isArray(args.data) ? args.data : [args.data];
        for (const row of rows) {
          encryptData("spontaneous_application", row as unknown as DataRecord);
        }
        return query(args);
      },
      async update({ args, query }) {
        encryptData("spontaneous_application", args.data as unknown as DataRecord);
        const result = await query(args);
        decryptData("spontaneous_application", result);
        return result;
      },
      async updateMany({ args, query }) {
        encryptData("spontaneous_application", args.data as unknown as DataRecord);
        return query(args);
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        decryptData("spontaneous_application", result);
        return result;
      },
      async findUniqueOrThrow({ args, query }) {
        const result = await query(args);
        decryptData("spontaneous_application", result);
        return result;
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        decryptData("spontaneous_application", result);
        return result;
      },
      async findFirstOrThrow({ args, query }) {
        const result = await query(args);
        decryptData("spontaneous_application", result);
        return result;
      },
      async findMany({ args, query }) {
        const result = await query(args);
        decryptData("spontaneous_application", result);
        return result;
      },
    },
    contact_message: {
      async create({ args, query }) {
        encryptData("contact_message", args.data as unknown as DataRecord);
        const result = await query(args);
        decryptData("contact_message", result);
        return result;
      },
      async createMany({ args, query }) {
        const rows = Array.isArray(args.data) ? args.data : [args.data];
        for (const row of rows) {
          encryptData("contact_message", row as unknown as DataRecord);
        }
        return query(args);
      },
      async update({ args, query }) {
        encryptData("contact_message", args.data as unknown as DataRecord);
        const result = await query(args);
        decryptData("contact_message", result);
        return result;
      },
      async updateMany({ args, query }) {
        encryptData("contact_message", args.data as unknown as DataRecord);
        return query(args);
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        decryptData("contact_message", result);
        return result;
      },
      async findUniqueOrThrow({ args, query }) {
        const result = await query(args);
        decryptData("contact_message", result);
        return result;
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        decryptData("contact_message", result);
        return result;
      },
      async findFirstOrThrow({ args, query }) {
        const result = await query(args);
        decryptData("contact_message", result);
        return result;
      },
      async findMany({ args, query }) {
        const result = await query(args);
        decryptData("contact_message", result);
        return result;
      },
    },
  },
});

export default prisma;
