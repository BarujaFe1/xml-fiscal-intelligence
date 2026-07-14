/**
 * Programa PGE — grade de homologação (espelha PVA contentHash).
 */

export type ContribHomologationRun = {
  contentHash?: string;
  programVersion?: string;
  resultStatus?: "ok" | "errors" | "warnings" | "unknown";
};

export function isHomologationGradePgeRun(run: ContribHomologationRun): boolean {
  return Boolean(
    run.contentHash &&
      run.contentHash.length >= 16 &&
      run.programVersion &&
      run.resultStatus &&
      run.resultStatus !== "unknown",
  );
}
