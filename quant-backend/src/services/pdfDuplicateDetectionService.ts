import { Types } from "mongoose";
import { DocumentFile } from "../models/DocumentFile";
import { logger } from "../utils/logger";
import { calculateFingerprintHammingDistance } from "./pdfPageFingerprintService";

// A 64-bit dHash threshold chosen conservatively for the initial rollout. It
// tolerates small rendering/compression differences without treating merely
// similar page layouts as a match.
export const MAX_PAGE_FINGERPRINT_HAMMING_DISTANCE = 6;
export const MIN_SUSPECTED_DUPLICATE_CONTAINMENT = 0.8;
export const NEAR_DUPLICATE_WORKLOAD_WARN_COMPARISON_COUNT = 50_000;

type FingerprintedDocument = {
  _id: Types.ObjectId;
  pageFingerprints?: string[];
};

type PageMatch = {
  newPageIndex: number;
  existingPageIndex: number;
  distance: number;
};

export type SuspectedDuplicate = {
  documentId: Types.ObjectId;
  similarity: number;
};

function getOneToOnePageMatches(
  newFingerprints: string[],
  existingFingerprints: string[],
): PageMatch[] {
  const possibleMatches: PageMatch[] = [];

  for (let newPageIndex = 0; newPageIndex < newFingerprints.length; newPageIndex += 1) {
    for (
      let existingPageIndex = 0;
      existingPageIndex < existingFingerprints.length;
      existingPageIndex += 1
    ) {
      const distance = calculateFingerprintHammingDistance(
        newFingerprints[newPageIndex],
        existingFingerprints[existingPageIndex],
      );
      if (distance <= MAX_PAGE_FINGERPRINT_HAMMING_DISTANCE) {
        possibleMatches.push({ newPageIndex, existingPageIndex, distance });
      }
    }
  }

  possibleMatches.sort((first, second) => first.distance - second.distance);
  const matchedNewPages = new Set<number>();
  const matchedExistingPages = new Set<number>();

  return possibleMatches.filter((match) => {
    if (
      matchedNewPages.has(match.newPageIndex) ||
      matchedExistingPages.has(match.existingPageIndex)
    ) {
      return false;
    }

    matchedNewPages.add(match.newPageIndex);
    matchedExistingPages.add(match.existingPageIndex);
    return true;
  });
}

export function calculatePageContainment(
  newFingerprints: string[],
  existingFingerprints: string[],
): number {
  if (newFingerprints.length === 0 || existingFingerprints.length === 0) {
    return 0;
  }

  return (
    getOneToOnePageMatches(newFingerprints, existingFingerprints).length /
    newFingerprints.length
  );
}

export async function findSuspectedDuplicate(
  courseId: Types.ObjectId,
  pageFingerprints: string[],
): Promise<SuspectedDuplicate | undefined> {
  if (pageFingerprints.length === 0) return undefined;

  const startedAt = Date.now();

  const candidates = (await DocumentFile.find({
    course: courseId,
    status: { $in: ["pending", "approved"] },
    pageFingerprints: { $exists: true, $ne: [] },
  })
    .select("_id pageFingerprints")
    .lean()) as FingerprintedDocument[];

  const candidatePageCount = candidates.reduce(
    (count, candidate) => count + (candidate.pageFingerprints?.length ?? 0),
    0,
  );
  const comparisonCount = pageFingerprints.length * candidatePageCount;

  let bestMatch: SuspectedDuplicate | undefined;

  for (const candidate of candidates) {
    const similarity = calculatePageContainment(
      pageFingerprints,
      candidate.pageFingerprints ?? [],
    );
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { documentId: candidate._id, similarity };
    }
  }

  if (comparisonCount >= NEAR_DUPLICATE_WORKLOAD_WARN_COMPARISON_COUNT) {
    logger.warn("Near-duplicate comparison workload is high", {
      courseId: courseId.toString(),
      candidateDocuments: candidates.length,
      candidatePages: candidatePageCount,
      uploadedPages: pageFingerprints.length,
      comparisonCount,
      durationMs: Date.now() - startedAt,
    });
  }

  if (
    !bestMatch ||
    bestMatch.similarity < MIN_SUSPECTED_DUPLICATE_CONTAINMENT
  ) {
    return undefined;
  }

  return bestMatch;
}
