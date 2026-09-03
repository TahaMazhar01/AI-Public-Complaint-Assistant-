import type {
  CategoryId,
  ComplaintStatus,
  DepartmentId,
  Priority,
} from "../types";

/* The query surface both backends implement. */

export interface ComplaintFilters {
  status?: ComplaintStatus | "open" | "all";
  department?: DepartmentId | "all";
  priority?: Priority | "all";
  category?: CategoryId | "all";
  search?: string;
  /** Cluster children are real complaints but noise in a queue — the
      console lists parents and shows the corroboration count instead. */
  parentsOnly?: boolean;
  limit?: number;
}

export interface DuplicateInput {
  category: CategoryId;
  lat: number | null;
  lng: number | null;
  text: string;
  radiusM?: number;
}
