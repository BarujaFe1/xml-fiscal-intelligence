"use client";

import { Suspense } from "react";
import DocumentsPage from "./documents-inner";

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
      <DocumentsPage />
    </Suspense>
  );
}
