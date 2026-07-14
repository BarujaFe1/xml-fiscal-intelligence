/**
 * Programa ECF — grade de homologação (espelha PVA contentHash).
 */

export type EcfHomologationRun = {
  contentHash?: string;
  programVersion?: string;
  resultStatus?: "ok" | "errors" | "warnings" | "unknown";
};

export function isHomologationGradeEcfRun(
  run: EcfHomologationRun,
): boolean {
  return Boolean(
    run.contentHash &&
      run.contentHash.length >= 16 &&
      run.programVersion &&
      run.resultStatus &&
      run.resultStatus !== "unknown",
  );
}
