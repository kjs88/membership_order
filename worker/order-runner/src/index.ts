import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { chromium, type Browser } from "playwright";
import { randomUUID } from "node:crypto";

type OrderRow = {
  lineNo?: number; sourceSystem?: string; orderId?: string; productName?: string;
  quantity?: string | number; expectedPrice?: string | number; recipientName?: string;
  recipientPhone?: string; zipcode?: string; address?: string; addressDetail?: string;
  memo?: string; status?: "READY" | "HOLD" | "FAILED"; reason?: string;
};
type OrderJob = { id: string; sourceSystem?: string; status?: string; rows?: OrderRow[] };
type WorkerReport = {
  workerId: string; startedAt: string; finishedAt: string; totalRows: number;
  successRows: number; failedRows: number; holdRows: number;
  reviewState: "WAITING_FOR_DASHBOARD" | "BLOCKED"; canSubmit: false;
  details: Array<{ lineNo: number; status: "FAILED" | "HOLD"; reason: string }>;
};

const databaseUrl = process.env.FIREBASE_DATABASE_URL;
if (!databaseUrl) throw new Error("FIREBASE_DATABASE_URL 환경변수가 필요합니다.");
initializeApp({ credential: applicationDefault(), databaseURL: databaseUrl });
const database = getDatabase();
const queuePath = process.env.FIREBASE_QUEUE_PATH || "order-ops/jobs";
const workerId = process.env.WORKER_ID || `web-worker-${randomUUID()}`;
const now = () => new Date().toISOString();

async function claimJob(jobId: string): Promise<OrderJob | null> {
  let claimed: OrderJob | null = null;
  await database.ref(`${queuePath}/${jobId}`).transaction((value) => {
    const current = value as OrderJob | null;
    if (!current || current.status !== "QUEUED") return;
    claimed = { ...current, id: jobId, status: "RUNNING" };
    return claimed;
  }, undefined, false);
  return claimed;
}

async function checkEroumSession(browser: Browser): Promise<string | null> {
  const serialized = process.env.EROUM_STORAGE_STATE_JSON;
  if (!serialized) return "서버에 이로움 로그인 세션이 설정되지 않았습니다.";
  let storageState: object;
  try { storageState = JSON.parse(serialized) as object; }
  catch { return "서버 로그인 세션 형식이 올바르지 않습니다."; }
  const context = await browser.newContext({ storageState });
  try {
    const page = await context.newPage();
    await page.goto("https://eroumcare.com/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    return page.url().includes("/bbs/login.php") ? "이로움 로그인이 만료되었습니다." : null;
  } catch (error) {
    return `이로움 접속 확인 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
  } finally { await context.close(); }
}

async function prepareReport(job: OrderJob): Promise<WorkerReport> {
  const startedAt = now();
  const rows = job.rows ?? [];
  let sessionIssue: string | null;
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    sessionIssue = await checkEroumSession(browser);
  } catch (error) {
    sessionIssue = `브라우저 시작 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
  } finally { await browser?.close(); }

  const details = rows.map((row, index) => {
    let reason = row.reason || "";
    if (row.status !== "READY") reason ||= "대시보드 검증에서 확인 대상으로 분류되었습니다.";
    else if (job.sourceSystem !== "이로움" && row.sourceSystem !== "이로움") reason = "현재 워커는 이로움 채널만 지원합니다.";
    else if (sessionIssue) reason = sessionIssue;
    else reason = "상품 매핑과 주문서 입력 어댑터 설정이 완료되지 않았습니다.";
    return { lineNo: row.lineNo ?? index + 1, status: "HOLD" as const, reason };
  });
  const holdRows = details.length;
  return {
    workerId, startedAt, finishedAt: now(), totalRows: rows.length,
    successRows: 0, failedRows: 0, holdRows,
    reviewState: holdRows ? "BLOCKED" : "WAITING_FOR_DASHBOARD",
    canSubmit: false, details,
  };
}

async function runOnce() {
  const snapshot = await database.ref(queuePath).orderByChild("status").equalTo("QUEUED").limitToFirst(10).get();
  for (const jobId of Object.keys((snapshot.val() ?? {}) as Record<string, unknown>)) {
    const job = await claimJob(jobId);
    if (!job) continue;
    try {
      const report = await prepareReport(job);
      const auditKey = database.ref(`${queuePath}/${jobId}/auditLogs`).push().key ?? randomUUID();
      await database.ref(`${queuePath}/${jobId}`).update({
        status: report.holdRows ? "HOLD" : "AWAITING_REVIEW",
        updatedAt: report.finishedAt, workerId, report,
        dashboardReview: { state: report.reviewState, required: true, finalSubmissionApproved: false, updatedAt: report.finishedAt },
        [`auditLogs/${auditKey}`]: {
          id: auditKey, jobId, action: "BACKGROUND_RUN_FINISHED", actorName: "서버 자동화 워커",
          actorEmail: "", detail: `총 ${report.totalRows}건 · 성공 ${report.successRows}건 · 실패 ${report.failedRows}건 · 보류 ${report.holdRows}건`,
          createdAt: report.finishedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 워커 오류";
      await database.ref(`${queuePath}/${jobId}`).update({ status: "FAILED", updatedAt: now(), workerId, error: message });
    }
  }
}

runOnce().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
