/** Every successful response has exactly this shape. */
export function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function created(res, data, meta) {
  return ok(res, data, meta, 201);
}

export function noContent(res) {
  return res.status(204).send();
}
