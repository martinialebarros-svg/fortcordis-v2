import { Request, Response } from "express";
import { query } from "../services/dbService";

export async function listAgents(_req: Request, res: Response): Promise<void> {
  const result = await query(
    `
      SELECT id, name, email, role, active, created_at
      FROM agents
      ORDER BY id ASC
    `
  );

  res.json({ data: result.rows });
}

export async function createAgent(req: Request, res: Response): Promise<void> {
  const name = req.body?.name ?? null;
  const email = req.body?.email;
  const role = req.body?.role ?? "agent";
  const active = req.body?.active ?? true;

  if (typeof email !== "string" || email.trim().length === 0) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const result = await query(
    `
      INSERT INTO agents (name, email, role, active, created_at)
      VALUES ($1, $2, $3, $4, now())
      RETURNING id, name, email, role, active, created_at
    `,
    [
      typeof name === "string" ? name.trim() : null,
      email.trim().toLowerCase(),
      typeof role === "string" && role.trim().length > 0 ? role.trim() : "agent",
      Boolean(active)
    ]
  );

  res.status(201).json(result.rows[0]);
}
