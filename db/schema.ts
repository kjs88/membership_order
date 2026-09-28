import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orderJobs = sqliteTable("order_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  sourceSystem: text("source_system").notNull().default("미지정"),
  status: text("status").notNull().default("READY"),
  totalRows: integer("total_rows").notNull().default(0),
  readyRows: integer("ready_rows").notNull().default(0),
  holdRows: integer("hold_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  createdByName: text("created_by_name").notNull().default("알 수 없음"),
  createdByEmail: text("created_by_email").notNull().default(""),
  updatedByName: text("updated_by_name").notNull().default("알 수 없음"),
  updatedByEmail: text("updated_by_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orderRows = sqliteTable("order_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => orderJobs.id, { onDelete: "cascade" }),
  lineNo: integer("line_no").notNull(),
  orderId: text("order_id").notNull().default(""),
  category: text("category").notNull().default(""),
  productName: text("product_name").notNull().default(""),
  quantity: text("quantity").notNull().default(""),
  expectedPrice: text("expected_price").notNull().default(""),
  customerName: text("customer_name").notNull().default(""),
  recipientName: text("recipient_name").notNull().default(""),
  recipientPhone: text("recipient_phone").notNull().default(""),
  zipcode: text("zipcode").notNull().default(""),
  address: text("address").notNull().default(""),
  addressDetail: text("address_detail").notNull().default(""),
  memo: text("memo").notNull().default(""),
  status: text("status").notNull().default("READY"),
  reason: text("reason").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orderAuditLogs = sqliteTable("order_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => orderJobs.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  actorName: text("actor_name").notNull().default("알 수 없음"),
  actorEmail: text("actor_email").notNull().default(""),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
