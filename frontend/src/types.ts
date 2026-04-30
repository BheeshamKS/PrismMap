export interface SelectedFile {
  path: string;
  score: number;
  reason: string;
}

export interface AnalysisResult {
  type: "result";
  selected_files: SelectedFile[];
  prompt: string;
  token_estimate: number;
}

export type SseEvent =
  | { type: "log"; message: string }
  | { type: "warning"; message: string }
  | AnalysisResult
  | { type: "error"; message: string };
