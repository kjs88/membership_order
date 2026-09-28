import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderJobs, orderRows } from "../../../../db/schema";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toRouteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "저장소가 아직 준비되지 않았습니다. 사이트 배포 과정에서 데이터베이스가 생성됩니다.";
  }
  return message;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "작업 ID가 올바르지 않습니다." }, { status: 400 });

    const db = getDb();
    const [job] = await db.select().from(orderJobs).where(eq(orderJobs.id, id)).limit(1);
    if (!job) return Response.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });

    const rows = await db.select().from(orderRows).where(eq(orderRows.jobId, id)).orderBy(orderRows.lineNo);
    return Response.json({ job: { ...job, rows } });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "작업 ID가 올바르지 않습니다." }, { status: 400 });

    const payload = (await request.json()) as { status?: string };
    const status = payload.status;
    if (!status || !["READY", "HOLD", "FAILED", "QUEUED"].includes(status)) {
      return Response.json({ error: "상태값이 올바르지 않습니다." }, { status: 400 });
    }

    const db = getDb();
    const [job] = await db
      .update(orderJobs)
      .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(orderJobs.id, id))
      .returning();
    if (!job) return Response.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
    return Response.json({ job });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
