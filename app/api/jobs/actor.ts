export type RequestActor = {
  name: string;
  email: string;
};

function decodeFullName(value: string | null, encoding: string | null) {
  if (!value || encoding !== "percent-encoded-utf-8") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export function getRequestActor(request: Request): RequestActor {
  const email = request.headers.get("oai-authenticated-user-email")?.trim() ?? "";
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const nameEncoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  const name = decodeFullName(encodedName, nameEncoding) || email || "로그인 사용자";

  return { name, email };
}

export function actorText(actor: RequestActor) {
  return actor.email ? `${actor.name} (${actor.email})` : actor.name;
}
