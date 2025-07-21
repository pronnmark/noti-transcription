import { getDb } from "../client";
import { eq, and, or, SQL, count } from "drizzle-orm";
import { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";

export interface IRepository<T, CreateT> {
  findById(id: number | string): Promise<T | null>;
  findAll(limit?: number, offset?: number): Promise<T[]>;
  findMany(where?: SQL): Promise<T[]>;
  create(data: CreateT): Promise<T>;
  createMany(data: CreateT[]): Promise<T[]>;
  update(id: number | string, data: Partial<CreateT>): Promise<T>;
  updateMany(where: SQL, data: Partial<CreateT>): Promise<T[]>;
  delete(id: number | string): Promise<boolean>;
  deleteMany(where: SQL): Promise<number>;
  count(where?: SQL): Promise<number>;
  exists(id: number | string): Promise<boolean>;
}

export abstract class BaseRepository<T, CreateT>
  implements IRepository<T, CreateT>
{
  constructor(
    protected table: SQLiteTableWithColumns<any>,
    protected primaryKey: keyof T = "id" as keyof T
  ) {}

  async findById(id: number | string): Promise<T | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(this.table)
        .where(eq(this.table[this.primaryKey], id))
        .limit(1);
      return (result[0] as T) || null;
    } catch (error) {
      throw new Error(`Failed to find record by id ${id}: ${error}`);
    }
  }

  async findAll(limit?: number, offset?: number): Promise<T[]> {
    try {
      const db = getDb();
      const queryBuilder = db.select().from(this.table);

      if (limit && offset) {
        const result = await queryBuilder.limit(limit).offset(offset);
        return result as T[];
      } else if (limit) {
        const result = await queryBuilder.limit(limit);
        return result as T[];
      } else if (offset) {
        const result = await queryBuilder.offset(offset);
        return result as T[];
      } else {
        const result = await queryBuilder;
        return result as T[];
      }
    } catch (error) {
      throw new Error(`Failed to find all records: ${error}`);
    }
  }

  async findMany(where?: SQL): Promise<T[]> {
    try {
      const db = getDb();
      const queryBuilder = db.select().from(this.table);

      if (where) {
        const result = await queryBuilder.where(where);
        return result as T[];
      } else {
        const result = await queryBuilder;
        return result as T[];
      }
    } catch (error) {
      throw new Error(`Failed to find records: ${error}`);
    }
  }

  async create(data: CreateT): Promise<T> {
    try {
      const db = getDb();
      const [result] = await db.insert(this.table).values(data as any).returning();
      return result as T;
    } catch (error) {
      throw new Error(`Failed to create record: ${error}`);
    }
  }

  async createMany(data: CreateT[]): Promise<T[]> {
    try {
      const db = getDb();
      const result = await db.insert(this.table).values(data).returning();
      return result as T[];
    } catch (error) {
      throw new Error(`Failed to create records: ${error}`);
    }
  }

  async update(id: number | string, data: Partial<CreateT>): Promise<T> {
    try {
      const db = getDb();
      const [result] = await db
        .update(this.table)
        .set(data)
        .where(eq(this.table[this.primaryKey], id))
        .returning();

      if (!result) {
        throw new Error(`Record with id ${id} not found`);
      }

      return result as T;
    } catch (error) {
      throw new Error(`Failed to update record ${id}: ${error}`);
    }
  }

  async updateMany(where: SQL, data: Partial<CreateT>): Promise<T[]> {
    try {
      const db = getDb();
      const result = await db
        .update(this.table)
        .set(data)
        .where(where)
        .returning();
      return result as T[];
    } catch (error) {
      throw new Error(`Failed to update records: ${error}`);
    }
  }

  async delete(id: number | string): Promise<boolean> {
    try {
      const db = getDb();
      const result = await db
        .delete(this.table)
        .where(eq(this.table[this.primaryKey], id));
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete record ${id}: ${error}`);
    }
  }

  async deleteMany(where: SQL): Promise<number> {
    try {
      const db = getDb();
      const result = await db
        .delete(this.table)
        .where(where);
      return result.changes;
    } catch (error) {
      throw new Error(`Failed to delete records: ${error}`);
    }
  }

  async count(where?: SQL): Promise<number> {
    try {
      const db = getDb();
      const queryBuilder = db.select({ count: count() }).from(this.table);

      if (where) {
        const result = await queryBuilder.where(where);
        return Number(result[0]?.count) || 0;
      } else {
        const result = await queryBuilder;
        return Number(result[0]?.count) || 0;
      }
    } catch (error) {
      throw new Error(`Failed to count records: ${error}`);
    }
  }

  async exists(id: number | string): Promise<boolean> {
    try {
      const db = getDb();
      const result = await db
        .select({ id: this.table[this.primaryKey] })
        .from(this.table)
        .where(eq(this.table[this.primaryKey], id))
        .limit(1);
      return result.length > 0;
    } catch (error) {
      throw new Error(`Failed to check if record exists ${id}: ${error}`);
    }
  }
}
