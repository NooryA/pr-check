import { describe, it, expect } from "vitest";
import { timeAgo, dedupePrs, buildSearchQuery } from "../src/utils";
import type { PRRecord } from "../src/types";

describe("timeAgo", () => {
  it("returns '< 1 hour' for recent dates", () => {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    expect(timeAgo(thirtyMinAgo.toISOString())).toBe("< 1 hour");
  });

  it("returns 'X hours' for same-day older", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(timeAgo(twoHoursAgo.toISOString())).toBe("2 hours");
  });

  it("returns '1 hour' for one hour ago", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    expect(timeAgo(oneHourAgo.toISOString())).toBe("1 hour");
  });

  it("returns 'X days' for older dates", () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(timeAgo(threeDaysAgo.toISOString())).toBe("3 days");
  });

  it("returns '1 day' for one day ago", () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(timeAgo(oneDayAgo.toISOString())).toBe("1 day");
  });

  it("accepts unix timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 3600;
    expect(timeAgo(thirtyDaysAgo)).toBe("30 days");
  });
});

describe("dedupePrs", () => {
  const basePr = (url: string, category: PRRecord["category"]): PRRecord => ({
    repo: "owner/repo",
    number: 1,
    title: "Test",
    url,
    authorLogin: "alice",
    createdAt: new Date().toISOString(),
    isDraft: false,
    reviewDecision: null,
    hasRequestedReviewers: true,
    category,
  });

  it("dedupes by URL and keeps review over assigned", () => {
    const url = "https://github.com/o/r/pull/1";
    const prReview = basePr(url, "review");
    const prAssigned = basePr(url, "assigned");
    const result = dedupePrs([prAssigned, prReview]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("review");
  });

  it("dedupes by URL and keeps assigned over authored", () => {
    const url = "https://github.com/o/r/pull/2";
    const prAuthored = basePr(url, "authored");
    const prAssigned = basePr(url, "assigned");
    const result = dedupePrs([prAuthored, prAssigned]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("assigned");
  });

  it("returns all PRs when URLs are unique", () => {
    const pr1 = basePr("https://github.com/o/r/pull/1", "review");
    const pr2 = basePr("https://github.com/o/r/pull/2", "assigned");
    const result = dedupePrs([pr1, pr2]);
    expect(result).toHaveLength(2);
  });
});

describe("buildSearchQuery", () => {
  it("returns only base query when no org or repos", () => {
    expect(
      buildSearchQuery({ baseQuery: "is:pr is:open review-requested:@me" })
    ).toBe("is:pr is:open review-requested:@me");
  });

  it("adds org when provided", () => {
    expect(
      buildSearchQuery({
        baseQuery: "is:pr is:open assignee:@me",
        org: "myorg",
      })
    ).toBe("is:pr is:open assignee:@me org:myorg");
  });

  it("adds repo terms when provided", () => {
    expect(
      buildSearchQuery({
        baseQuery: "is:pr is:open author:@me",
        repos: ["owner1/repoA", "owner2/repoB"],
      })
    ).toBe("is:pr is:open author:@me repo:owner1/repoA repo:owner2/repoB");
  });

  it("adds both org and repos when provided", () => {
    expect(
      buildSearchQuery({
        baseQuery: "is:pr is:open",
        org: "acme",
        repos: ["acme/foo"],
      })
    ).toBe("is:pr is:open org:acme repo:acme/foo");
  });
});
