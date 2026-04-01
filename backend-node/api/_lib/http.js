export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res, allowed = ["GET"]) {
  res.setHeader("Allow", allowed.join(", "));
  return json(res, 405, { error: "Method Not Allowed", allowed });
}

export function parseNumberEnv(name, def) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : def;
}
