export type PRCategory = "review" | "assigned" | "authored";

export type ReviewDecision =
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REVIEW_REQUIRED"
  | null;

export interface PRRecord {
  repo: string;
  number: number;
  title: string;
  url: string;
  authorLogin: string;
  createdAt: string;
  isDraft: boolean;
  reviewDecision: ReviewDecision;
  hasRequestedReviewers: boolean;
  category: PRCategory;
}

export interface PrCheckOptions {
  staleDays: number;
  limitPerCategory: number;
  org?: string;
  repos?: string[];
  noColor: boolean;
  json: boolean;
  quiet: boolean;
}

export interface GroupedResults {
  awaitingReview: PRRecord[];
  assignedToYou: PRRecord[];
  yourOpenPRs: PRRecord[];
  totalResponsibilityCount: number;
}

export interface PrCheckJsonOutput {
  awaitingReview: PRRecord[];
  assignedToYou: PRRecord[];
  yourOpenPRs: PRRecord[];
  totalResponsibilityCount: number;
  error?: string;
}
