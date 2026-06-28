// Single source of truth for selectable models.
// `slug` is the public key the client sends; `upstream` is the OpenRouter
// model id; `label` is what's shown in the UI. Add new models here only —
// both the API route and the client read from this file, so there's no
// risk of the two lists drifting apart.

export const MODELS = {
  "deepseek-v3.2": { label: "DeepSeek V3.2", upstream: "deepseek/deepseek-v3.2" },
  "gemma-4-31b": { label: "Gemma 4 31B", upstream: "google/gemma-4-31b-it:free" },
  "llama-3.3-70b": { label: "Llama 3.3 70B", upstream: "meta-llama/llama-3.3-70b-instruct" },
  "ministral-8b": { label: "Ministral 8B", upstream: "mistralai/ministral-8b-2512" },
};

export const DEFAULT_MODEL = "deepseek-v3.2";

export function resolveUpstreamModel(slug) {
  return MODELS[slug]?.upstream ?? MODELS[DEFAULT_MODEL].upstream;
}
