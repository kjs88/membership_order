"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OrderRow = {
  lineNo: number;
  orderId: string;
  category: string;
  productName: string;
  quantity: string;
  expectedPrice: string;
  customerName: string;
  recipientName: string;
  recipientPhone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
  memo: string;
  status: "READY" | "HOLD" | "FAILED";
  reason: string;
};

type Job = {
  id: number;
  filename: string;
  status: string;
  totalRows: number;
  readyRows: number;
  holdRows: number;
  failedRows: number;
  createdAt: string;
  rows?: OrderRow[];
};

type CalendarDay = {
  key: string;
  label: number;
  inMonth: boolean;
  isToday: boolean;
  jobs: Job[];
};

const requiredColumns = [
  "order_id",
  "category",
  "product_name",
  "quantity",
  "customer_name",
  "recipient_name",
  "recipient_phone",
  "address",
];

const sampleCsv =
  "order_id,category,product_name,quantity,expected_price,customer_name,recipient_name,recipient_phone,zipcode,address,address_detail,memo\n" +
  "TEST-001,급여판매,Handy,1,108000,우리케어,홍길동,010-0000-0000,12345,서울시 금천구 서부샛길 606,101호,샘플";

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("주문 행이 없습니다.");

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function cell(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value == null ? "" : String(value).trim();
}

function validateOrder(raw: Record<string, unknown>, index: number): OrderRow {
  const missing = requiredColumns.filter((column) => !cell(raw, column));
  const reasons: string[] = [];
  if (missing.length) reasons.push(`필수값 누락: ${missing.join(", ")}`);

  const quantity = cell(raw, "quantity");
  const parsedQuantity = Number(quantity);
  if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    reasons.push("수량 확인 필요");
  }

  const phone = cell(raw, "recipient_phone");
  if (phone && !/\d{2,3}-?\d{3,4}-?\d{4}/.test(phone)) {
    reasons.push("수취인 연락처 형식 확인 필요");
  }

  const address = cell(raw, "address");
  if (address && address.length < 6) reasons.push("배송지 주소가 너무 짧음");

  const category = cell(raw, "category");
  if (
    category &&
    ![
      "급여판매",
      "급여상품(판매)",
      "판매",
      "급여대여",
      "급여상품(대여)",
      "대여",
      "비급여",
      "비급여상품",
    ].includes(category)
  ) {
    reasons.push("상품 구분 확인 필요");
  }

  const expectedPrice = cell(raw, "expected_price");
  if (expectedPrice && !/^[0-9,]+$/.test(expectedPrice.replace(/원/g, ""))) {
    reasons.push("예상가 형식 확인 필요");
  }

  return {
    lineNo: index + 2,
    orderId: cell(raw, "order_id"),
    category,
    productName: cell(raw, "product_name"),
    quantity,
    expectedPrice,
    customerName: cell(raw, "customer_name"),
    recipientName: cell(raw, "recipient_name"),
    recipientPhone: phone,
    zipcode: cell(raw, "zipcode"),
    address,
    addressDetail: cell(raw, "address_detail"),
    memo: cell(raw, "memo"),
    status: reasons.length ? "FAILED" : "READY",
    reason: reasons.join("; "),
  };
}

function statusLabel(status: string) {
  if (status === "READY") return "검증 완료";
  if (status === "HOLD") return "보류";
  if (status === "FAILED") return "실패";
  if (status === "QUEUED") return "실행 대기";
  return status;
}

function statusClass(status: string) {
  if (status === "READY") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "HOLD" || status === "QUEUED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "FAILED") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function downloadCsv(rows: OrderRow[], filename: string) {
  const headers = [
    "line_no",
    "order_id",
    "status",
    "reason",
    "category",
    "product_name",
    "quantity",
    "expected_price",
    "customer_name",
    "recipient_name",
    "recipient_phone",
    "zipcode",
    "address",
    "address_detail",
    "memo",
  ];
  const body = rows.map((row) =>
    [
      row.lineNo,
      row.orderId,
      row.status,
      row.reason,
      row.category,
      row.productName,
      row.quantity,
      row.expectedPrice,
      row.customerName,
      row.recipientName,
      row.recipientPhone,
      row.zipcode,
      row.address,
      row.addressDetail,
      row.memo,
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([`\uFEFF${headers.join(",")}\n${body.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.[^.]+$/, "") + "_report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadSample() {
  const blob = new Blob([`\uFEFF${sampleCsv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "eroumcare_order_sample.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function toDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(monthDate: Date, jobs: Job[]) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const todayKey = toDateKey(new Date());
  const jobsByDate = new Map<string, Job[]>();
  jobs.forEach((job) => {
    const key = toDateKey(job.createdAt);
    if (!key) return;
    jobsByDate.set(key, [...(jobsByDate.get(key) ?? []), job]);
  });

  return Array.from({ length: 42 }, (_, index): CalendarDay => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = toDateKey(date);
    return {
      key,
      label: date.getDate(),
      inMonth: date.getMonth() === monthDate.getMonth(),
      isToday: key === todayKey,
      jobs: jobsByDate.get(key) ?? [],
    };
  });
}

export default function OrderOpsApp() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [previewRows, setPreviewRows] = useState<OrderRow[]>([]);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [viewMode, setViewMode] = useState<"orders" | "calendar">("orders");

  const rows = activeJob?.rows ?? previewRows;
  const orderSummary = useMemo(
    () => ({
      total: rows.length,
      ready: rows.filter((row) => row.status === "READY").length,
      hold: rows.filter((row) => row.status === "HOLD").length,
      failed: rows.filter((row) => row.status === "FAILED").length,
    }),
    [rows],
  );
  const globalSummary = useMemo(
    () => ({
      total: jobs.reduce((sum, job) => sum + job.totalRows, 0),
      ready: jobs.reduce((sum, job) => sum + job.readyRows, 0),
      hold: jobs.reduce((sum, job) => sum + job.holdRows, 0),
      failed: jobs.reduce((sum, job) => sum + job.failedRows, 0),
    }),
    [jobs],
  );
  const summary = viewMode === "calendar" ? globalSummary : orderSummary;

  async function openJob(id: number) {
    const response = await fetch(`/api/jobs/${id}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "작업을 불러오지 못했습니다.");
      return;
    }
    setActiveJob(data.job);
    setPreviewRows([]);
    setFilename(data.job.filename);
  }

  async function loadJobs() {
    setLoading(true);
    try {
      const response = await fetch("/api/jobs");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "작업 목록을 불러오지 못했습니다.");
      setJobs(data.jobs);
      if (!activeJob && data.jobs[0]) await openJob(data.jobs[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 목록 오류");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setMessage("");
    setFilename(file.name);
    setActiveJob(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("현재 온라인 초안은 CSV 업로드를 먼저 지원합니다. 엑셀은 CSV로 저장해서 올려주세요.");
      return;
    }
    const rawRows = parseCsv(await file.text());
    const parsed = rawRows.map(validateOrder);
    setPreviewRows(parsed);
    setMessage(`${parsed.length}건을 읽었습니다. 저장하면 다른 PC에서도 이어서 볼 수 있습니다.`);
  }

  async function saveJob() {
    if (!previewRows.length || !filename) return;
    setLoading(true);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, rows: previewRows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setMessage("클라우드 작업으로 저장했습니다.");
      setPreviewRows([]);
      await loadJobs();
      await openJob(data.job.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 오류");
    } finally {
      setLoading(false);
    }
  }

  async function queueExecution() {
    if (!activeJob) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/${activeJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "QUEUED" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "실행 대기 전환 실패");
      setMessage("주문 실행 대기 상태로 바꿨습니다. 실행 에이전트 연결 후 처리됩니다.");
      await loadJobs();
      await openJob(activeJob.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상태 변경 오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTitle = activeJob ? activeJob.filename : filename || "새 주문 파일";

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-slate-950">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0f766e] text-white">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">이로움 주문 운영</h1>
              <p className="text-sm text-slate-600">주문 파일 검증, 승인 대기, 처리 리포트를 한 곳에서 관리합니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadJobs()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              새로고침
            </Button>
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              주문 CSV 업로드
            </Button>
            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={<FileSpreadsheet />} label="전체 주문" value={summary.total} />
          <MetricCard icon={<CheckCircle2 />} label="검증 완료" value={summary.ready} tone="ready" />
          <MetricCard icon={<PauseCircle />} label="확인 필요" value={summary.hold} tone="hold" />
          <MetricCard icon={<AlertCircle />} label="실패" value={summary.failed} tone="failed" />
        </section>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
          <Button
            variant={viewMode === "orders" ? "default" : "ghost"}
            onClick={() => setViewMode("orders")}
          >
            <ListChecks className="h-4 w-4" />
            주문 작업판
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "ghost"}
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="h-4 w-4" />
            전체 캘린더
          </Button>
        </div>

        {viewMode === "calendar" ? (
          <OperationsCalendar
            jobs={jobs}
            monthDate={calendarMonth}
            selectedDateKey={selectedDateKey}
            onMonthChange={setCalendarMonth}
            onSelectedDateChange={setSelectedDateKey}
            onOpenJob={(id) => {
              setViewMode("orders");
              void openJob(id);
            }}
          />
        ) : (
          <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <h2 className="font-semibold">클라우드 작업</h2>
              <p className="mt-1 text-sm text-slate-600">저장된 작업은 다른 PC에서도 이어서 볼 수 있습니다.</p>
            </div>
            <div className="max-h-[640px] overflow-auto p-2">
              {jobs.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  아직 저장된 주문 작업이 없습니다.
                </div>
              ) : (
                jobs.map((job) => (
                  <button
                    key={job.id}
                    className={`mb-2 w-full rounded-md border p-3 text-left transition ${
                      activeJob?.id === job.id
                        ? "border-[#0f766e] bg-teal-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => void openJob(job.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-medium">{job.filename}</span>
                      <Badge className={statusClass(job.status)}>{statusLabel(job.status)}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {job.totalRows}건 · 완료 {job.readyRows} · 실패 {job.failedRows}
                    </div>
                  </button>
                ))
              )}
            </div>
            </aside>

            <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{currentTitle}</h2>
                  {activeJob ? (
                    <Badge className={statusClass(activeJob.status)}>{statusLabel(activeJob.status)}</Badge>
                  ) : previewRows.length ? (
                    <Badge className="border-sky-200 bg-sky-50 text-sky-700">저장 전 미리보기</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  실제 이로움 주문 제출은 승인 정책과 실행 에이전트 연결 후 처리합니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => downloadCsv(rows, currentTitle)} disabled={!rows.length}>
                  <Download className="h-4 w-4" />
                  리포트 다운로드
                </Button>
                {!activeJob && previewRows.length ? (
                  <Button onClick={() => void saveJob()} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    클라우드 저장
                  </Button>
                ) : (
                  <Button onClick={() => void queueExecution()} disabled={!activeJob || activeJob.status === "QUEUED" || loading}>
                    <PlayCircle className="h-4 w-4" />
                    실행 대기 등록
                  </Button>
                )}
              </div>
            </div>

            {message ? <div className="border-b border-slate-200 bg-[#fff8e6] px-4 py-3 text-sm text-slate-800">{message}</div> : null}

            <Tabs defaultValue="rows" className="p-4">
              <TabsList>
                <TabsTrigger value="rows">주문 행</TabsTrigger>
                <TabsTrigger value="policy">실행 정책</TabsTrigger>
              </TabsList>
              <TabsContent value="rows" className="mt-4">
                {rows.length ? <OrderTable rows={rows} /> : <EmptyState />}
              </TabsContent>
              <TabsContent value="policy" className="mt-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <PolicyCard title="검증" text="필수값, 수량, 연락처, 주소, 상품 구분, 예상가 형식을 먼저 확인합니다." />
                  <PolicyCard title="승인" text="검증 완료 건만 실행 대기 상태로 넘깁니다. 실패·보류 행은 리포트에 남습니다." />
                  <PolicyCard title="제출" text="이로움 로그인, 장바구니 추가, 주문 확정은 별도 실행 에이전트와 사용자 승인 후 처리합니다." />
                </div>
              </TabsContent>
            </Tabs>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}

function OperationsCalendar({
  jobs,
  monthDate,
  selectedDateKey,
  onMonthChange,
  onSelectedDateChange,
  onOpenJob,
}: {
  jobs: Job[];
  monthDate: Date;
  selectedDateKey: string;
  onMonthChange: (date: Date) => void;
  onSelectedDateChange: (dateKey: string) => void;
  onOpenJob: (id: number) => void;
}) {
  const days = useMemo(() => buildCalendarDays(monthDate, jobs), [jobs, monthDate]);
  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(monthDate);
  const monthJobs = jobs.filter((job) => {
    const date = new Date(job.createdAt);
    return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
  });
  const queued = monthJobs.filter((job) => job.status === "QUEUED").length;
  const failed = monthJobs.filter((job) => job.status === "FAILED").length;
  const selectedJobs = jobs.filter((job) => toDateKey(job.createdAt) === selectedDateKey);
  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);

  function moveMonth(amount: number) {
    onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">전체 일정과 기록</h2>
            <p className="text-sm text-slate-600">업로드, 검증 결과, 실행 대기 상태를 월 단위로 봅니다.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-slate-200 bg-slate-50 text-slate-700">{jobs.length}개 작업</Badge>
          <Badge className="border-amber-200 bg-amber-50 text-amber-700">{queued}개 실행 대기</Badge>
          <Badge className="border-rose-200 bg-rose-50 text-rose-700">{failed}개 실패 포함</Badge>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="font-semibold">{monthLabel}</h3>
              <p className="text-sm text-slate-600">날짜를 선택하면 우측에 기록이 펼쳐집니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="이전 달" onClick={() => moveMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => onMonthChange(new Date())}>오늘</Button>
            <Button variant="outline" size="icon" aria-label="다음 달" onClick={() => moveMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <div key={day} className="px-2 py-2">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => (
            <button
              key={day.key}
              className={`min-h-[128px] border-b border-r border-slate-200 p-2 text-left last:border-r-0 ${
                day.inMonth ? "bg-white" : "bg-slate-50 text-slate-400"
              } ${selectedDateKey === day.key ? "ring-2 ring-inset ring-[#0f766e]" : ""}`}
              onClick={() => onSelectedDateChange(day.key)}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                    day.isToday ? "bg-[#0f766e] font-semibold text-white" : ""
                  }`}
                >
                  {day.label}
                </span>
                {day.jobs.length ? <span className="text-xs text-slate-500">{day.jobs.length}건</span> : null}
              </div>
              <div className="space-y-1">
                {day.jobs.slice(0, 3).map((job) => (
                  <span
                    key={job.id}
                    className={`block w-full rounded border px-2 py-1 text-xs leading-5 ${statusClass(job.status)}`}
                  >
                    <span className="block truncate font-medium">{job.filename}</span>
                    <span>{job.totalRows}건 · {statusLabel(job.status)}</span>
                  </span>
                ))}
                {day.jobs.length > 3 ? (
                  <div className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    +{day.jobs.length - 3}건 더 있음
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold">월간 현황</h3>
            <div className="mt-4 grid gap-3">
              <CalendarStat label="저장 작업" value={monthJobs.length} />
              <CalendarStat label="실행 대기" value={queued} />
              <CalendarStat label="실패 포함" value={failed} />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold">{selectedDateKey || "선택 날짜"} 기록</h3>
            <div className="mt-3 space-y-2">
              {selectedJobs.length ? (
                selectedJobs.map((job) => (
                  <CalendarRecord key={job.id} job={job} onOpenJob={onOpenJob} />
                ))
              ) : (
                <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                  이 날짜에 저장된 주문 작업이 없습니다.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="font-semibold">최근 기록</h3>
            <div className="mt-3 max-h-[360px] space-y-2 overflow-auto">
              {recentJobs.length ? (
                recentJobs.map((job) => (
                  <CalendarRecord key={job.id} job={job} onOpenJob={onOpenJob} compact />
                ))
              ) : (
                <p className="text-sm text-slate-600">아직 기록이 없습니다.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function CalendarRecord({
  job,
  onOpenJob,
  compact = false,
}: {
  job: Job;
  onOpenJob: (id: number) => void;
  compact?: boolean;
}) {
  const time = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(job.createdAt));

  return (
    <button
      className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left hover:border-[#0f766e] hover:bg-teal-50"
      onClick={() => onOpenJob(job.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{job.filename}</span>
          <span className="mt-1 block text-xs text-slate-500">
            {time} · {job.totalRows}건
            {!compact ? ` · 완료 ${job.readyRows} · 실패 ${job.failedRows}` : ""}
          </span>
        </span>
        <Badge className={statusClass(job.status)}>{statusLabel(job.status)}</Badge>
      </div>
    </button>
  );
}

function CalendarStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <strong className="text-lg">{value.toLocaleString()}</strong>
    </div>
  );
}

function OrderTable({ rows }: { rows: OrderRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">행</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>주문번호</TableHead>
            <TableHead>상품</TableHead>
            <TableHead>수량</TableHead>
            <TableHead>수취인</TableHead>
            <TableHead>배송지</TableHead>
            <TableHead>사유</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.lineNo}-${row.orderId}-${row.productName}`}>
              <TableCell>{row.lineNo}</TableCell>
              <TableCell>
                <Badge className={statusClass(row.status)}>{statusLabel(row.status)}</Badge>
              </TableCell>
              <TableCell>{row.orderId || "-"}</TableCell>
              <TableCell className="max-w-[220px] whitespace-normal font-medium">
                {row.productName || "-"}
                <div className="text-xs font-normal text-slate-500">{row.category}</div>
              </TableCell>
              <TableCell>{row.quantity || "-"}</TableCell>
              <TableCell>
                {row.recipientName || "-"}
                <div className="text-xs text-slate-500">{row.recipientPhone}</div>
              </TableCell>
              <TableCell className="max-w-[260px] whitespace-normal">
                {row.address} {row.addressDetail}
              </TableCell>
              <TableCell className="max-w-[260px] whitespace-normal text-slate-700">
                {row.reason || "주문 전 검증 통과"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <FileSpreadsheet className="mb-3 h-10 w-10 text-slate-400" />
      <h3 className="font-semibold">주문 CSV를 업로드하세요</h3>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        CSV 컬럼은 order_id, category, product_name, quantity, customer_name, recipient_name,
        recipient_phone, address를 포함해야 합니다.
      </p>
      <Button className="mt-4" variant="outline" onClick={downloadSample}>
        <Download className="h-4 w-4" />
        샘플 CSV
      </Button>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "neutral" | "ready" | "hold" | "failed";
}) {
  const colors = {
    neutral: "bg-slate-100 text-slate-700",
    ready: "bg-emerald-50 text-emerald-700",
    hold: "bg-amber-50 text-amber-700",
    failed: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${colors[tone]}`}>{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</div>
    </div>
  );
}

function PolicyCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
