/**
 * Homologação RTC — quando existir ambiente oficial; por ora hash-grade.
 */

export type RtcHomologationRun = {
  contentHash?: string;
  programVersion?: string;
  resultStatus?: "ok" | "errors" | "warnings" | "unknown";
};

export function isHomologationGradeRtcRun(run: RtcHomologationRun): boolean {
  return Boolean(
    run.contentHash &&
      run.contentHash.length >= 16 &&
      run.programVersion &&
      run.resultStatus &&
      run.resultStatus !== "unknown",
  );
}
