/**
 * Local signing agent contract — runs OUTSIDE the browser/Vercel.
 * Never send PFX password to the web app or logs.
 */

export type LocalSignerRequest = {
  eventId: string;
  xmlUnsigned: string;
  contentHash: string;
  /** Agent must validate hash before signing. */
};

export type LocalSignerResponse = {
  eventId: string;
  xmlSigned: string;
  signedHash: string;
  agentVersion: string;
  signedAt: string;
};

export const LOCAL_SIGNER_PROTOCOL = {
  transport: "http://127.0.0.1:{port}/sign" as const,
  security: [
    "PFX e senha permanecem no agente local",
    "App envia apenas XML canônico + hash",
    "Agente recusa se contentHash não bater",
    "Sem log de senha / chave privada",
  ],
};

/** In-process stub for tests — marks XML as signed-demo (NOT valid for RFB). */
export async function stubLocalSign(req: LocalSignerRequest): Promise<LocalSignerResponse> {
  const { sha256Hex } = await import("@/lib/security/hash");
  const expected = await sha256Hex(req.xmlUnsigned);
  if (expected !== req.contentHash) {
    throw new Error("stub signer: contentHash mismatch");
  }
  const xmlSigned =
    req.xmlUnsigned.replace(
      "?>",
      '?>\n<!-- signed-by: xfi-local-signer-stub NOT_VALID_FOR_RFB -->',
    ) || req.xmlUnsigned;
  return {
    eventId: req.eventId,
    xmlSigned,
    signedHash: await sha256Hex(xmlSigned),
    agentVersion: "stub-0.1.0",
    signedAt: new Date().toISOString(),
  };
}
