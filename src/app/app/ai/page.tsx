import { permanentRedirect } from "next/navigation";

/** Rota legada de IA — recurso removido do produto. */
export default function AiRemovedRedirectPage() {
  permanentRedirect("/app");
}
